import datetime
import math
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc

from ..models_intelligence import MandiDailyPrice, PricePredictionRecord
from ..models import User, Festival, Item, Purchase
from ..schemas_intelligence import PricePredictionRequest, PricePredictionResponse, CostBreakdown
from .agmarknet_service import COMMODITY_CATALOG, seed_initial_mandi_prices

def predict_selling_price(
    db: Session,
    request: PricePredictionRequest,
    user_id: int = 1
) -> PricePredictionResponse:
    """
    Computes AI-recommended vegetable selling price range with full explainable reasoning.
    Integrates wholesale mandi price, vendor cost, transport, profit margin, festival uplift, and trend.
    """
    seed_initial_mandi_prices(db)
    today_str = datetime.date.today().strftime("%Y-%m-%d")

    # 1. Fetch user's desired profit margin
    user = db.query(User).filter(User.id == user_id).first()
    target_margin_pct = request.target_margin_pct if request.target_margin_pct is not None else (user.default_margin_pct if user else 25.0)

    comm_key = request.commodity_key.lower().strip()
    comm_meta = COMMODITY_CATALOG.get(comm_key, {
        "name_en": comm_key.capitalize(),
        "name_ta": comm_key,
        "base_price": 30.0
    })

    # 2. Get latest wholesale mandi modal price for this commodity
    latest_price_row = db.query(MandiDailyPrice).filter(
        MandiDailyPrice.commodity_key == comm_key
    ).order_by(desc(MandiDailyPrice.date), desc(MandiDailyPrice.id)).first()

    mandi_wholesale_cost = latest_price_row.modal_price_per_kg if latest_price_row else comm_meta["base_price"]

    # 3. Determine vendor purchase cost basis
    if request.vendor_purchase_cost and request.vendor_purchase_cost > 0:
        vendor_cost = request.vendor_purchase_cost
    else:
        # Check if vendor has recorded a recent purchase for this commodity in purchases table
        recent_pur = None
        if request.item_id:
            recent_pur = db.query(Purchase).filter(
                Purchase.user_id == user_id,
                Purchase.item_id == request.item_id
            ).order_by(desc(Purchase.id)).first()

        if recent_pur and recent_pur.unit_cost > 0:
            vendor_cost = recent_pur.unit_cost
        else:
            # Wholesale mandi rate acts as baseline purchase cost
            vendor_cost = mandi_wholesale_cost

    # 4. Transport & overhead per kg
    transport_overhead = float(request.transport_overhead_per_kg or 2.0)
    cost_floor = round(vendor_cost + transport_overhead, 2)

    # 5. Check active or upcoming festival uplift
    active_festival = db.query(Festival).filter(
        Festival.start_date <= today_str,
        Festival.end_date >= today_str
    ).first()

    festival_uplift_pct = 0.0
    fest_name_en = ""
    fest_name_ta = ""
    if active_festival:
        fest_name_en = active_festival.name_en.split()[0]
        fest_name_ta = active_festival.name_ta.split()[0]
        # Vegetable festive uplift generally 15% to 25%
        festival_uplift_pct = 15.0

    # 6. Trend direction from recent 7-day mandi prices
    recent_7d = db.query(MandiDailyPrice).filter(
        MandiDailyPrice.commodity_key == comm_key
    ).order_by(desc(MandiDailyPrice.date)).limit(7).all()

    trend_direction = "stable"
    if len(recent_7d) >= 2:
        newest = recent_7d[0].modal_price_per_kg
        oldest = recent_7d[-1].modal_price_per_kg
        diff_pct = ((newest - oldest) / oldest) * 100.0 if oldest > 0 else 0
        if diff_pct >= 6.0:
            trend_direction = "increasing"
        elif diff_pct <= -6.0:
            trend_direction = "decreasing"
        else:
            trend_direction = "stable"

    # 7. Mathematical Model Formulation
    target_margin_amt = round(cost_floor * (target_margin_pct / 100.0), 2)
    fest_uplift_amt = round(cost_floor * (festival_uplift_pct / 100.0), 2)
    wastage_buffer = 1.0  # ₹1.0 / kg buffer for perishable spoilage risk

    raw_recommended = cost_floor + target_margin_amt + fest_uplift_amt + wastage_buffer

    # Street vendor psychological pricing & currency rounding
    if raw_recommended < 25:
        final_price = float(round(raw_recommended))
    elif raw_recommended < 80:
        final_price = float(round(raw_recommended / 5.0) * 5)
    else:
        final_price = float(round(raw_recommended / 10.0) * 10)

    # Guard condition: price must strictly cover cost floor + at least ₹2 profit
    if final_price < cost_floor + 2.0:
        final_price = cost_floor + 3.0

    min_range = float(math.floor(final_price * 0.93))
    max_range = float(math.ceil(final_price * 1.08))

    # Realized expected margin %
    realized_margin_pct = round(((final_price - cost_floor) / final_price) * 100.0, 1)

    # 8. Explainability Reasoning (XAI)
    reasoning_en = (
        f"Recommended ₹{final_price:.0f}/kg based on wholesale mandi rate of ₹{mandi_wholesale_cost:.0f}, "
        f"plus ₹{transport_overhead:.1f} transport overhead (Cost Floor: ₹{cost_floor:.1f}). "
        f"Includes your {target_margin_pct:.0f}% profit target (+₹{target_margin_amt:.1f})"
    )
    if festival_uplift_pct > 0:
        reasoning_en += f" and {fest_name_en} festive demand (+₹{fest_uplift_amt:.1f})."
    else:
        reasoning_en += f" under {trend_direction} market trend."

    reasoning_ta = (
        f"மொத்த சந்தை விலை ₹{mandi_wholesale_cost:.0f} மற்றும் போக்குவரத்து செலவு ₹{transport_overhead:.1f} "
        f"(அடக்க விலை: ₹{cost_floor:.1f}) அடிப்படையில் ₹{final_price:.0f}/கிலோ பரிந்துரைக்கப்படுகிறது. "
        f"உங்கள் இலக்கு லாபம் {target_margin_pct:.0f}% (+₹{target_margin_amt:.1f})"
    )
    if festival_uplift_pct > 0:
        reasoning_ta += f" மற்றும் {fest_name_ta} பண்டிகை தேவையை உள்ளடக்கியது (+₹{fest_uplift_amt:.1f})."
    else:
        reasoning_ta += f" ({trend_direction} சந்தை போக்கு)."

    breakdown = CostBreakdown(
        mandi_wholesale_cost=round(mandi_wholesale_cost, 1),
        vendor_purchase_cost=round(vendor_cost, 1),
        transport_overhead_per_kg=round(transport_overhead, 1),
        cost_floor=round(cost_floor, 1),
        target_margin_amount=round(target_margin_amt, 1),
        festival_uplift_amount=round(fest_uplift_amt, 1),
        wastage_risk_buffer=round(wastage_buffer, 1),
        final_recommended_price=round(final_price, 1)
    )

    # 9. Log prediction for audit trail
    pred_record = PricePredictionRecord(
        item_id=request.item_id,
        commodity_key=comm_key,
        prediction_date=today_str,
        wholesale_benchmark=mandi_wholesale_cost,
        vendor_cost=vendor_cost,
        recommended_price=final_price,
        min_price_range=min_range,
        max_price_range=max_range,
        expected_margin_pct=realized_margin_pct,
        trend_direction=trend_direction,
        reasoning_en=reasoning_en,
        reasoning_ta=reasoning_ta
    )
    db.add(pred_record)
    db.commit()

    return PricePredictionResponse(
        item_id=request.item_id,
        commodity_key=comm_key,
        commodity_name_en=comm_meta["name_en"],
        commodity_name_ta=comm_meta["name_ta"],
        prediction_date=today_str,
        wholesale_benchmark=round(mandi_wholesale_cost, 1),
        vendor_cost=round(vendor_cost, 1),
        recommended_price=final_price,
        min_price_range=min_range,
        max_price_range=max_range,
        expected_margin_pct=realized_margin_pct,
        trend_direction=trend_direction,
        reasoning_en=reasoning_en,
        reasoning_ta=reasoning_ta,
        breakdown=breakdown
    )
