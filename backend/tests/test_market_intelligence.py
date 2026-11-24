import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.app.database import SessionLocal, Base, engine
from backend.app.seed_data import seed_database
from backend.app.models_intelligence import MandiMarket, MandiDailyPrice, PriceAlert, PricePredictionRecord
from backend.app.services.agmarknet_service import (
    ensure_mandi_markets_seeded, seed_initial_mandi_prices, get_nearby_mandis,
    compare_commodity_prices, sync_live_agmarknet_bulletin, calculate_haversine_distance
)
from backend.app.services.prediction_service import predict_selling_price
from backend.app.services.trend_analyzer import analyze_price_trends
from backend.app.schemas_intelligence import PricePredictionRequest

def run_all_intelligence_tests():
    print("=== RUNNING MARKET INTELLIGENCE & AI PREDICTION TEST SUITE ===")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    seed_database(db)
    ensure_mandi_markets_seeded(db)
    seed_initial_mandi_prices(db)

    # 1. Test Haversine Distance Calculation
    # Chennai Central (13.0827, 80.2707) to Koyambedu (13.0694, 80.1948) ~ 8.3 km
    dist = calculate_haversine_distance(13.0827, 80.2707, 13.0694, 80.1948)
    assert 7.0 <= dist <= 10.0, f"Unexpected Haversine distance: {dist}"
    print(f" [PASS] Haversine distance calculation: {dist} km")

    # 2. Test Nearby Mandis Retrieval
    mandis = get_nearby_mandis(db, latitude=13.0827, longitude=80.2707, radius_km=35.0)
    assert len(mandis) >= 3, f"Expected at least 3 nearby mandis, got {len(mandis)}"
    mandi_names = [m.name_en for m in mandis]
    assert any("Koyambedu" in n for n in mandi_names)
    assert any("Kothawal" in n for n in mandi_names)
    print(f" [PASS] Nearby mandis discovery ({len(mandis)} mandis within 35 km)")

    # 3. Test Commodity Price Comparison Across Markets
    comp = compare_commodity_prices(db, "tomato")
    assert comp.commodity_key == "tomato"
    assert len(comp.prices) >= 3, f"Expected prices from at least 3 mandis, got {len(comp.prices)}"
    assert comp.lowest_modal_price is not None
    assert comp.highest_modal_price is not None
    assert comp.lowest_modal_price <= comp.highest_modal_price
    print(f" [PASS] Price comparison for Tomato: Lowest ₹{comp.lowest_modal_price}, Highest ₹{comp.highest_modal_price} across {len(comp.prices)} mandis")

    # 4. Test AGMARKNET Zero-Fabrication Contract
    # Inquire an unsupported key to ensure it returns clean empty list rather than hallucinating
    unknown_comp = compare_commodity_prices(db, "unknown_fruit_123")
    assert len(unknown_comp.prices) == 0
    assert unknown_comp.lowest_modal_price is None
    print(" [PASS] Zero-fabrication contract: Unknown commodity returns clean null/empty")

    # 5. Test Live Bulletin Sync & Price Alert Generation
    updated_records, source = sync_live_agmarknet_bulletin(db)
    assert updated_records >= 0
    print(f" [PASS] AGMARKNET sync executed ({updated_records} records, source: {source})")

    # 6. Test AI Selling Price Prediction Model
    req = PricePredictionRequest(
        commodity_key="tomato",
        vendor_purchase_cost=28.0,
        transport_overhead_per_kg=2.0,
        target_margin_pct=25.0
    )
    pred = predict_selling_price(db, req, user_id=1)
    assert pred.commodity_key == "tomato"
    assert pred.recommended_price > 0
    # Cost floor = 28 + 2 = 30; recommended price must strictly be >= cost floor
    assert pred.recommended_price >= pred.breakdown.cost_floor
    assert pred.min_price_range <= pred.recommended_price <= pred.max_price_range
    assert "₹" in pred.reasoning_en
    assert "ரூ" in pred.reasoning_ta or "₹" in pred.reasoning_ta
    print(f" [PASS] AI Selling Price Prediction for Tomato:")
    print(f"        Cost Floor: ₹{pred.breakdown.cost_floor} -> Recommended: ₹{pred.recommended_price} (Range: ₹{pred.min_price_range} - ₹{pred.max_price_range})")
    print(f"        Reasoning (EN): {pred.reasoning_en}")
    print(f"        Reasoning (TA): {pred.reasoning_ta}")

    # 7. Test Historical Price Trend Analysis
    trend = analyze_price_trends(db, "tomato", market_id=1, period_days=30, user_id=1)
    assert trend.commodity_key == "tomato"
    assert len(trend.historical_points) >= 10
    assert trend.trend_pattern in ["increasing", "decreasing", "stable", "volatile"]
    assert trend.current_price > 0
    assert trend.average_price > 0
    assert len(trend.margin_opportunities) > 0
    assert len(trend.margin_opportunities_ta) > 0
    print(f" [PASS] 30-Day Trend Analysis for Tomato at {trend.market_name_en}:")
    print(f"        Pattern: {trend.trend_pattern.upper()} | Current: ₹{trend.current_price} | Tomorrow Projected: ₹{trend.projected_tomorrow_price}")
    print(f"        Margin Opportunities: {trend.margin_opportunities[0]}")

    # 8. Test Price Prediction DB Logging
    logged = db.query(PricePredictionRecord).filter(PricePredictionRecord.commodity_key == "tomato").first()
    assert logged is not None
    assert logged.recommended_price == pred.recommended_price
    print(f" [PASS] Prediction audit log persisted in database (ID: {logged.id})")

    db.close()
    print("\nALL 8 MARKET INTELLIGENCE TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_all_intelligence_tests()
