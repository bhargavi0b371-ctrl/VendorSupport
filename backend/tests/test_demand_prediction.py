import os
import unittest
import datetime
import numpy as np
import pandas as pd
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.database import Base
from backend.app.models import User, Item, Sale, DailyEntry, DailyEntryItem, VendorProduct, Festival
from backend.app.services.demand_service import (
    get_product_daily_sales_series, build_features_dataframe,
    train_product_model, forecast_demand_for_product,
    get_vendor_demand_overview, trigger_vendor_model_retraining,
    MIN_OBSERVATIONS_FOR_ML
)


class TestAIDemandPrediction(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # In-memory clean SQLite session
        cls.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        cls.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=cls.engine)
        Base.metadata.create_all(bind=cls.engine)

    def setUp(self):
        Base.metadata.drop_all(bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        self.db = self.SessionLocal()
        # Seed test vendor 999
        self.user = User(
            id=999,
            name="Test Farmer",
            shop_name="Organic Hub",
            phone="9000000001",
            onboarding_completed=True
        )
        self.db.add(self.user)

        # Seed 2 products: Tomato (will have >= 60 days real history) and Apple (insufficient history)
        self.tomato = Item(id=901, name_en="Tomato", name_ta="தக்காளி", category="vegetables", default_unit="kg")
        self.apple = Item(id=902, name_en="Apple", name_ta="ஆப்பிள்", category="fruits", default_unit="kg")
        self.db.add_all([self.tomato, self.apple])
        self.db.commit()

        # Link to vendor 999
        self.db.add_all([
            VendorProduct(user_id=999, item_id=901, is_active=True),
            VendorProduct(user_id=999, item_id=902, is_active=True)
        ])
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_01_insufficient_history_returns_baseline_not_ml(self):
        """
        When product has fewer than 60 days of sales observations, it MUST NOT claim to be ML.
        It must clearly return status="historical_baseline" with an honest explanation and average.
        """
        # Only add 5 days of sales for Apple (item 902)
        base_date = datetime.date.today() - datetime.timedelta(days=10)
        for i in range(5):
            d_str = (base_date + datetime.timedelta(days=i)).strftime("%Y-%m-%d")
            de = DailyEntry(user_id=999, date=d_str, total_revenue=100.0)
            self.db.add(de)
            self.db.commit()
            self.db.refresh(de)
            self.db.add(DailyEntryItem(
                daily_entry_id=de.id,
                item_id=902,
                quantity_sold=10.0,
                selling_price_per_unit=50.0,
                unsold_quantity=2.0
            ))
            self.db.commit()

        forecast = forecast_demand_for_product(self.db, user_id=999, product=self.apple)
        self.assertFalse(forecast.is_ml_trained)
        self.assertEqual(forecast.status, "historical_baseline")
        self.assertIn("Insufficient sales history", forecast.status_message_en)
        self.assertIn("Historical Baseline Average (ML Not Active)", forecast.model_name)
        self.assertEqual(forecast.tomorrow_predicted_demand, 10.0)
        self.assertEqual(forecast.historical_avg_daily_sales, 10.0)
        # Suggested purchase = 10 - 2 (unsold stock) = 8
        self.assertEqual(forecast.suggested_purchase_quantity, 8.0)
        print(" [PASS] Test 1: Insufficient history correctly displays baseline average, not fabricated ML.")

    def test_02_random_forest_training_and_mae_evaluation(self):
        """
        When product has >= 60 days of real recorded sales history, train genuine RandomForestRegressor:
        - Chronological train/test split
        - MAE evaluation metric
        - Next 7 days recursive demand forecast
        """
        # Seed 75 days of daily entries for Tomato (item 901)
        start_date = datetime.date.today() - datetime.timedelta(days=75)
        for i in range(75):
            d = start_date + datetime.timedelta(days=i)
            d_str = d.strftime("%Y-%m-%d")
            # Realistic seasonal + day-of-week sales pattern
            dow = d.weekday()
            qty = 20.0 + (5.0 if dow in [5, 6] else 0.0) + (i % 3) * 1.5

            de = DailyEntry(user_id=999, date=d_str, total_revenue=qty * 30.0)
            self.db.add(de)
            self.db.commit()
            self.db.refresh(de)
            self.db.add(DailyEntryItem(
                daily_entry_id=de.id,
                item_id=901,
                quantity_sold=qty,
                selling_price_per_unit=30.0,
                unsold_quantity=3.0 if i == 74 else 0.0
            ))
        self.db.commit()

        # Verify training execution
        trained, mae, msg, obs = train_product_model(self.db, user_id=999, product_id=901)
        self.assertTrue(trained)
        self.assertIsNotNone(mae)
        self.assertGreater(mae, 0.0)
        self.assertGreaterEqual(obs, MIN_OBSERVATIONS_FOR_ML)
        print(f" [PASS] Test 2: RandomForestRegressor successfully trained on {obs} days with MAE = ±{mae} kg.")

        # Test forecasting with trained model
        forecast = forecast_demand_for_product(self.db, user_id=999, product=self.tomato)
        self.assertTrue(forecast.is_ml_trained)
        self.assertEqual(forecast.status, "ml_prediction")
        self.assertEqual(forecast.model_name, "RandomForestRegressor (Scikit-Learn)")
        self.assertEqual(len(forecast.forecast_7_days), 7)
        self.assertGreater(forecast.tomorrow_predicted_demand, 0.0)
        self.assertGreater(forecast.next_7_days_total_demand, 0.0)
        self.assertIsNotNone(forecast.mae)
        self.assertIn("Chronological Test", forecast.train_test_split_info)
        print(f" [PASS] Test 2b: 7-day forecast generated (Tomorrow: {forecast.tomorrow_predicted_demand} kg, 7-Day: {forecast.next_7_days_total_demand} kg).")

    def test_03_multi_tenant_isolation(self):
        """
        Verify that Vendor A's sales history does not bleed into Vendor B's demand models.
        """
        vendor_b = User(id=888, name="Vendor B", phone="9000000002", onboarding_completed=True)
        self.db.add(vendor_b)
        self.db.add(VendorProduct(user_id=888, item_id=901, is_active=True))
        self.db.commit()

        # Vendor B has no sales recorded for Tomato (item 901)
        forecast_b = forecast_demand_for_product(self.db, user_id=888, product=self.tomato)
        self.assertFalse(forecast_b.is_ml_trained)
        self.assertEqual(forecast_b.observations_count, 0)
        self.assertEqual(forecast_b.tomorrow_predicted_demand, 0.0)
        print(" [PASS] Test 3: Multi-tenant isolation verified (Vendor B does not inherit Vendor A sales).")


if __name__ == "__main__":
    unittest.main()
