import os
import sys
import unittest
import datetime

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.app.database import SessionLocal, Base, engine
from backend.app.seed_data import seed_database
from backend.app.models import User, Item, VendorProduct, DailyEntry, DailyEntryItem, Sale, Purchase
from backend.app.schemas import (
    UserRegister, OnboardingSubmit, CustomProductCreate,
    DailyEntrySubmit, DailyEntryItemInput, SyncPushPayload,
    SaleCreate, PurchaseCreate
)
from backend.app.routers.auth import register_vendor
from backend.app.routers.onboarding import get_onboarding_catalog, submit_onboarding, list_vendor_products, add_custom_product
from backend.app.routers.daily_sales import submit_daily_entry, get_report_by_date
from backend.app.routers.sync import sync_offline_data

class TestVendorVoiceScenarios(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        cls.db = SessionLocal()
        seed_database(cls.db)

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def test_scenario_a_new_vendor_registration(self):
        """Scenario A: Register a completely new vendor. Verify Manage My Products appears before Home."""
        phone = f"987{os.urandom(3).hex()}"
        reg_payload = UserRegister(
            name="Ravi Kumar",
            shop_name="Ravi Fresh Farm Direct",
            phone=phone,
            pin="1234",
            language="ta"
        )
        res = register_vendor(reg_payload, db=self.db)
        self.assertEqual(res.status, "success")
        self.assertFalse(res.user.onboarding_completed, "New vendor must have onboarding_completed=False")
        self.assertEqual(res.user.shop_name, "Ravi Fresh Farm Direct")

    def test_scenarios_b_through_i_complete_workflow(self):
        """
        Executes Scenarios B through I in sequence:
        B: Select only Tomato, Tea and Biscuit -> Verify ONLY these 3 appear.
        C: Remove Biscuit -> Verify Biscuit disappears.
        D: Add custom product -> Verify correct unit.
        E: Restart / fresh DB session -> Verify persistence.
        F: Enter sales for Tomato and Tea -> Verify unused items not created.
        G: Resubmit/edit report multiple times -> Verify no revenue/profit duplication.
        H: Offline sync -> Verify ingestion.
        I: Two different vendors -> Verify complete data isolation.
        """
        # --- Vendor 1 Registration ---
        phone_v1 = f"910{os.urandom(3).hex()}"
        res_v1 = register_vendor(UserRegister(
            name="Vendor One",
            shop_name="V1 Organic Store",
            phone=phone_v1,
            pin="1111",
            language="en"
        ), db=self.db)
        v1_id = res_v1.user.id

        # Look up Tomato, Tea, Biscuit from catalog
        catalog = get_onboarding_catalog(db=self.db)
        all_items = catalog["all_predefined_items"]

        tomato = next(it for it in all_items if it["name_en"].lower() == "tomato")
        tea = next(it for it in all_items if it["name_en"].lower() == "tea")
        biscuit = next(it for it in all_items if it["name_en"].lower() == "biscuit")

        self.assertIsNotNone(tomato, "Tomato must exist in catalog")
        self.assertIsNotNone(tea, "Tea must exist in catalog")
        self.assertIsNotNone(biscuit, "Biscuit must exist in catalog")

        # --- SCENARIO B: Select only Tomato, Tea and Biscuit ---
        submit_onboarding(OnboardingSubmit(
            user_id=v1_id,
            selected_categories=["vegetables", "tea_coffee", "groceries"],
            selected_item_ids=[tomato["id"], tea["id"], biscuit["id"]],
            custom_items=[]
        ), db=self.db)

        v1_products_b = list_vendor_products(user_id=v1_id, db=self.db)
        v1_names_b = {p.name_en.lower() for p in v1_products_b}
        self.assertEqual(len(v1_products_b), 3, f"Expected exactly 3 products, got {len(v1_products_b)}")
        self.assertEqual(v1_names_b, {"tomato", "tea", "biscuit"})

        # --- SCENARIO C: Remove Biscuit and save. Reopen daily entry. Verify Biscuit disappears ---
        submit_onboarding(OnboardingSubmit(
            user_id=v1_id,
            selected_categories=["vegetables", "tea_coffee"],
            selected_item_ids=[tomato["id"], tea["id"]],
            custom_items=[]
        ), db=self.db)

        v1_products_c = list_vendor_products(user_id=v1_id, db=self.db)
        v1_names_c = {p.name_en.lower() for p in v1_products_c}
        self.assertEqual(len(v1_products_c), 2)
        self.assertNotIn("biscuit", v1_names_c, "Biscuit must disappear from Product-wise list after removal")
        self.assertEqual(v1_names_c, {"tomato", "tea"})

        # --- SCENARIO D: Add a custom product and verify it appears with the correct unit ---
        custom_item = add_custom_product(CustomProductCreate(
            user_id=v1_id,
            name_en="Nannari Sarbath",
            name_ta="நன்னாரி சர்பத்",
            category="tea_coffee",
            default_unit="bottle",
            icon="cup",
            color="#FF9800"
        ), db=self.db)

        self.assertEqual(custom_item.default_unit, "bottle")
        self.assertEqual(custom_item.name_en, "Nannari Sarbath")

        v1_products_d = list_vendor_products(user_id=v1_id, db=self.db)
        nannari_entry = next((p for p in v1_products_d if "nannari" in p.name_en.lower()), None)
        self.assertIsNotNone(nannari_entry, "Custom product must be in vendor products")
        self.assertEqual(nannari_entry.default_unit, "bottle", "Custom unit must be preserved")

        # --- SCENARIO E: Restart the app / fresh DB session and verify selected product list persists ---
        fresh_db = SessionLocal()
        try:
            v1_persisted = list_vendor_products(user_id=v1_id, db=fresh_db)
            persisted_names = {p.name_en.lower() for p in v1_persisted}
            self.assertEqual(len(v1_persisted), 3)
            self.assertIn("tomato", persisted_names)
            self.assertIn("tea", persisted_names)
            self.assertIn("nannari sarbath", persisted_names)
        finally:
            fresh_db.close()

        # --- SCENARIO F: Enter sales for only Tomato and Tea. Verify Biscuit / Nannari does not create an empty sales record ---
        # Tomato: 10 kg sold @ 40, cost 25, unsold 2 kg, damaged 1 kg
        # Tea: 20 cup sold @ 12, cost 5, unsold 0, damaged 0
        # Nannari Sarbath: completely unused (0 sold, 0 unsold, 0 damaged)
        today_date = "2026-11-25"
        daily_in = DailyEntrySubmit(
            user_id=v1_id,
            date=today_date,
            entry_date=today_date,
            transport_cost=50.0,
            rent_cost=30.0,
            packaging_cost=10.0,
            other_expenses=10.0,
            cash_collection=500.0,
            upi_collection=140.0,
            other_digital_collection=0.0,
            pending_credit=0.0,
            items=[
                DailyEntryItemInput(
                    item_id=tomato["id"],
                    quantity_sold=10.0,
                    selling_price_per_unit=40.0,
                    purchase_cost_per_unit=25.0,
                    unsold_quantity=2.0,
                    damaged_quantity=1.0
                ),
                DailyEntryItemInput(
                    item_id=tea["id"],
                    quantity_sold=20.0,
                    selling_price_per_unit=12.0,
                    purchase_cost_per_unit=5.0,
                    unsold_quantity=0.0,
                    damaged_quantity=0.0
                )
            ]
        )

        res_report = submit_daily_entry(daily_in, db=self.db)

        # Financial Verifications:
        # Revenue = 10 * 40 + 20 * 12 = 400 + 240 = 640
        # COGS = 10 * 25 + 20 * 5 = 250 + 100 = 350
        # Gross Profit = 640 - 350 = 290
        # Wastage Loss = 1 * 25 = 25
        # Total Expenses = 50 + 30 + 10 + 10 = 100
        # Net Profit = 290 - 100 - 25 = 165
        self.assertEqual(res_report.total_sales_revenue, 640.0)
        self.assertEqual(res_report.total_cogs, 350.0)
        self.assertEqual(res_report.gross_profit, 290.0)
        self.assertEqual(res_report.total_wastage_loss, 25.0)
        self.assertEqual(res_report.total_daily_expenses, 100.0)
        self.assertEqual(res_report.net_profit, 165.0)

        # Verify only 2 items in breakdown (unused Nannari / Biscuit excluded)
        self.assertEqual(len(res_report.items_breakdown), 2)
        breakdown_names = [it.name_en.lower() for it in res_report.items_breakdown]
        self.assertIn("tomato", breakdown_names)
        self.assertIn("tea", breakdown_names)

        # Verify Sale records units preserved (not hardcoded kg)
        tea_sale = self.db.query(Sale).filter(Sale.user_id == v1_id, Sale.item_id == tea["id"]).first()
        self.assertIsNotNone(tea_sale)
        self.assertEqual(tea_sale.unit, "cup", "Unit for tea in sales table must be cup, not kg")

        # --- SCENARIO G: Edit the daily report multiple times. Verify revenue and profit are not duplicated ---
        daily_in_edit1 = DailyEntrySubmit(
            user_id=v1_id,
            date=today_date,
            entry_date=today_date,
            transport_cost=50.0,
            rent_cost=30.0,
            packaging_cost=10.0,
            other_expenses=10.0,
            cash_collection=560.0,
            upi_collection=140.0,
            items=[
                DailyEntryItemInput(
                    item_id=tomato["id"],
                    quantity_sold=10.0,
                    selling_price_per_unit=40.0,
                    purchase_cost_per_unit=25.0,
                    unsold_quantity=2.0,
                    damaged_quantity=1.0
                ),
                DailyEntryItemInput(
                    item_id=tea["id"],
                    quantity_sold=25.0, # edited from 20 to 25
                    selling_price_per_unit=12.0,
                    purchase_cost_per_unit=5.0,
                    unsold_quantity=0.0,
                    damaged_quantity=0.0
                )
            ]
        )
        report_edit1 = submit_daily_entry(daily_in_edit1, db=self.db)

        # New Revenue = 400 + 300 = 700
        # New COGS = 250 + 125 = 375
        # New Gross Profit = 700 - 375 = 325
        # New Net Profit = 325 - 100 - 25 = 200
        self.assertEqual(report_edit1.total_sales_revenue, 700.0)
        self.assertEqual(report_edit1.net_profit, 200.0)

        # Check DB count of DailyEntry for this date is exactly 1 (upsert, not duplicate)
        entries_count = self.db.query(DailyEntry).filter(DailyEntry.user_id == v1_id, DailyEntry.date == today_date).count()
        self.assertEqual(entries_count, 1, "Must update existing DailyEntry without duplicate rows")

        # Resubmit edit again
        report_edit2 = submit_daily_entry(daily_in_edit1, db=self.db)
        self.assertEqual(report_edit2.total_sales_revenue, 700.0)
        self.assertEqual(report_edit2.net_profit, 200.0)
        entries_count2 = self.db.query(DailyEntry).filter(DailyEntry.user_id == v1_id, DailyEntry.date == today_date).count()
        self.assertEqual(entries_count2, 1)

        # --- SCENARIO H: Test offline changes and synchronization after connectivity returns ---
        sync_res = sync_offline_data(SyncPushPayload(
            sales=[
                SaleCreate(
                    user_id=v1_id,
                    item_id=tomato["id"],
                    quantity=3.0,
                    unit="kg",
                    amount=120.0,
                    unit_price=40.0,
                    sync_id=f"offline_sale_{os.urandom(4).hex()}"
                )
            ],
            purchases=[
                PurchaseCreate(
                    user_id=v1_id,
                    item_id=tomato["id"],
                    quantity=25.0,
                    unit="kg",
                    total_cost=625.0,
                    purchase_date="2026-11-25",
                    sync_id=f"offline_pur_{os.urandom(4).hex()}"
                )
            ],
            daily_entries=[]
        ), db=self.db)

        self.assertEqual(sync_res.status, "synced")
        self.assertEqual(sync_res.synced_sales_count, 1)
        self.assertEqual(sync_res.synced_purchases_count, 1)

        # --- SCENARIO I: Test with two different vendor accounts and verify complete data isolation ---
        phone_v2 = f"920{os.urandom(3).hex()}"
        res_v2 = register_vendor(UserRegister(
            name="Vendor Two",
            shop_name="V2 Street Snacks",
            phone=phone_v2,
            pin="2222",
            language="ta"
        ), db=self.db)
        v2_id = res_v2.user.id
        self.assertNotEqual(v1_id, v2_id)

        # Vendor 2 onboards with only Flower Garland and Samosa
        garland = next(it for it in all_items if "garland" in it["name_en"].lower())
        samosa = next(it for it in all_items if "samosa" in it["name_en"].lower())

        submit_onboarding(OnboardingSubmit(
            user_id=v2_id,
            selected_categories=["flowers", "street_food"],
            selected_item_ids=[garland["id"], samosa["id"]],
            custom_items=[]
        ), db=self.db)

        # 1. Vendor 2's products must ONLY be Garland and Samosa
        v2_prods = list_vendor_products(user_id=v2_id, db=self.db)
        v2_ids = {p.id for p in v2_prods}
        self.assertEqual(len(v2_prods), 2)
        self.assertIn(garland["id"], v2_ids)
        self.assertIn(samosa["id"], v2_ids)
        self.assertNotIn(tomato["id"], v2_ids, "Vendor 2 must NOT have Vendor 1's products")

        # 2. Vendor 1's products must STILL be Tomato, Tea, Nannari Sarbath
        v1_prods_verify = list_vendor_products(user_id=v1_id, db=self.db)
        v1_ids_verify = {p.id for p in v1_prods_verify}
        self.assertIn(tomato["id"], v1_ids_verify)
        self.assertNotIn(garland["id"], v1_ids_verify, "Vendor 1 must NOT have Vendor 2's products")
        self.assertNotIn(samosa["id"], v1_ids_verify, "Vendor 1 must NOT have Vendor 2's products")

        # 3. Vendor 2 daily sales report must be clean/empty (revenue 0), not showing Vendor 1's sales
        v2_report = get_report_by_date(date="2026-11-25", user_id=v2_id, db=self.db)
        self.assertEqual(v2_report.total_sales_revenue, 0.0, "Vendor 2 revenue must be 0")
        self.assertEqual(v2_report.net_profit, 0.0, "Vendor 2 profit must be 0")
        self.assertEqual(len(v2_report.items_breakdown), 0)

if __name__ == "__main__":
    unittest.main()
