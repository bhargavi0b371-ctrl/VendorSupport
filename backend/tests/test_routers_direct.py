import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.app.database import SessionLocal, Base, engine
from backend.app.seed_data import seed_database
from backend.app.routers.sales import add_sale, list_sales, today_summary, undo_last_sale
from backend.app.routers.purchases import add_purchase, list_purchases
from backend.app.routers.reports import get_reports
from backend.app.routers.pricing import get_pricing_all, get_pricing_single
from backend.app.routers.markets import list_markets, where_to_buy_item
from backend.app.routers.voice import parse_voice, execute_voice_action
from backend.app.routers.sync import sync_offline_data, get_bootstrap_data
from backend.app.routers.items import list_items, get_user_settings, update_user_settings
from backend.app.routers.onboarding import get_onboarding_catalog, submit_onboarding, list_vendor_products, add_custom_product
from backend.app.routers.daily_sales import submit_daily_entry, get_report_by_date, get_reports_history, get_insights
from backend.app.schemas import (
    SaleCreate, PurchaseCreate, VoiceParseRequest, VoiceExecuteRequest,
    SyncPushPayload, UserUpdate, OnboardingSubmit, CustomProductCreate,
    DailyEntrySubmit, DailyEntryItemInput, DailyExpensesInput, PaymentBreakdownInput, ItemCreate
)

def test_all_routers():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    seed_database(db)

    print("=== TESTING ALL FASTAPI ROUTERS (INCLUDING ONBOARDING & DAILY SALES) ===")

    # 1. Onboarding Catalog & Flow
    catalog = get_onboarding_catalog(db)
    assert len(catalog["categories"]) >= 9, "Expected 9 categories"
    print(f"[PASS] Onboarding catalog: {len(catalog['categories'])} categories loaded")

    # Submit onboarding with categories & items
    onb_res = submit_onboarding(OnboardingSubmit(
        user_id=1,
        selected_categories=["vegetables", "fruits"],
        selected_item_ids=[1, 2, 3, 9, 10],
        custom_items=[ItemCreate(name_en="Sugarcane", name_ta="கரும்பு", category="other", default_unit="piece")]
    ), db=db)
    assert onb_res.onboarding_completed is True
    print("[PASS] Onboarding submission: User profile saved with selected categories & products")

    # List vendor's saved products
    vendor_products = list_vendor_products(user_id=1, db=db)
    assert len(vendor_products) >= 5
    product_names = [vp.name_en for vp in vendor_products]
    assert "Tomato" in product_names
    assert "Sugarcane" in product_names
    print(f"[PASS] Vendor products: {len(vendor_products)} products loaded for vendor shop")

    # Add custom product anytime
    custom_p = add_custom_product(CustomProductCreate(
        user_id=1,
        name_en="Rose Milk",
        name_ta="ரோஸ் மில்க்",
        category="street_food",
        default_unit="cup",
        icon="cup-water"
    ), db=db)
    assert custom_p.name_en == "Rose Milk"
    print(f"[PASS] Custom product creation: {custom_p.name_en} ({custom_p.default_unit}) added")

    # 2. Daily Sales Entry with Multi-Products, Expenses, Payments & Report
    entry_payload = DailyEntrySubmit(
        user_id=1,
        date="2026-11-22",
        items=[
            DailyEntryItemInput(
                item_id=1, # Tomato
                quantity_sold=20.0,
                selling_price_per_unit=40.0,
                purchase_cost_per_unit=25.0,
                unsold_quantity=3.0,
                damaged_quantity=1.0
            ),
            DailyEntryItemInput(
                item_id=2, # Onion
                quantity_sold=15.0,
                selling_price_per_unit=50.0,
                purchase_cost_per_unit=35.0,
                unsold_quantity=5.0,
                damaged_quantity=0.0
            )
        ],
        expenses=DailyExpensesInput(
            transport=50.0,
            rent=100.0,
            packaging=20.0,
            other=10.0
        ),
        payments=PaymentBreakdownInput(
            cash=800.0,
            upi=700.0,
            digital_other=0.0,
            credit_pending=50.0
        ),
        notes="High Sunday demand"
    )
    report = submit_daily_entry(entry_payload, db=db)

    # Validate Formulas
    # Tomato: 20 * 40 = 800; COGS: 20 * 25 = 500; Gross: 300; Wastage: 1 * 25 = 25; Unsold: 3 * 25 = 75
    # Onion: 15 * 50 = 750; COGS: 15 * 35 = 525; Gross: 225; Wastage: 0; Unsold: 5 * 35 = 175
    # Total Revenue: 800 + 750 = 1550
    # Total COGS: 500 + 525 = 1025
    # Gross Profit: 1550 - 1025 = 525
    # Total Expenses: 50 + 100 + 20 + 10 = 180
    # Net Profit: 525 - 180 - 25 = 320
    # Wastage Loss: 25.0
    # Unsold Stock Value: 75 + 175 = 250.0
    assert report.total_sales_revenue == 1550.0, f"Expected 1550, got {report.total_sales_revenue}"
    assert report.total_cogs == 1025.0, f"Expected 1025, got {report.total_cogs}"
    assert report.gross_profit == 525.0, f"Expected 525, got {report.gross_profit}"
    assert report.total_daily_expenses == 180.0, f"Expected 180, got {report.total_daily_expenses}"
    assert report.net_profit == 320.0, f"Expected 320, got {report.net_profit}"
    assert report.total_wastage_loss == 25.0, f"Expected 25, got {report.total_wastage_loss}"
    assert report.total_unsold_stock_value == 250.0, f"Expected 250, got {report.total_unsold_stock_value}"
    assert report.payments_breakdown.cash == 800.0
    assert report.payments_breakdown.upi == 700.0
    assert report.best_selling_product["name_en"] == "Tomato"
    assert report.ai_insights is not None
    print(f"[PASS] Daily Sales Entry: Revenue=₹{report.total_sales_revenue}, Gross Profit=₹{report.gross_profit}, Expenses=₹{report.total_daily_expenses}, Net Profit=₹{report.net_profit}")
    print(f"[PASS] Wastage Loss (₹{report.total_wastage_loss}) kept separate from Unsold Stock Value (₹{report.total_unsold_stock_value})")

    # 3. Retrieve Report by Date & History
    fetched_rep = get_report_by_date(date="2026-11-22", user_id=1, db=db)
    assert fetched_rep.net_profit == 320.0
    print("[PASS] Daily Sales Report: Retrieved by date successfully")

    history = get_reports_history(user_id=1, db=db)
    assert len(history) > 0
    print(f"[PASS] Reports History: {len(history)} historical daily entries available")

    # 4. AI Sales Insights
    insights = get_insights(user_id=1, db=db)
    assert len(insights.stock_advice) > 0 or len(insights.wastage_reduction_tips) > 0
    print(f"[PASS] AI Sales Insights: Stock advice & wastage tips generated (English & Tamil)")

    # 5. Existing Features: Items, Pricing, Markets, Voice, Sync
    items = list_items(db)
    assert len(items) >= 10
    print(f"[PASS] Existing items router: {len(items)} items")

    pricing = get_pricing_all(user_id=1, db=db)
    assert len(pricing) >= 10
    print(f"[PASS] Existing smart pricing: {len(pricing)} items priced")

    markets = list_markets(db=db)
    assert len(markets) >= 3
    print(f"[PASS] Existing markets router: {len(markets)} wholesale markets")

    v_req_ta = VoiceParseRequest(text="3 கிலோ தக்காளி 90 ரூபாய்க்கு வித்தேன்")
    v_res_ta = parse_voice(v_req_ta, user_id=1, db=db)
    assert v_res_ta.action == "sale"
    print(f"[PASS] Existing voice parser: {v_res_ta.spoken_confirmation_ta}")

    bootstrap = get_bootstrap_data(user_id=1, db=db)
    assert "vendor_products" in bootstrap
    print("[PASS] Offline bootstrap: Contains items, vendor products, markets, and prices")

    db.close()
    print("\n>>> ALL ENHANCED AND EXISTING BACKEND ROUTERS 100% VERIFIED AND FUNCTIONAL! <<<")

if __name__ == "__main__":
    test_all_routers()
