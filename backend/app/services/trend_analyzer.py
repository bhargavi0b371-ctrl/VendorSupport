import datetime
import math
import statistics
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc

from ..models_intelligence import MandiMarket, MandiDailyPrice
from ..models import Purchase
from ..schemas_intelligence import TrendAnalysisResponse, TrendDataPoint
from .agmarknet_service import COMMODITY_CATALOG, seed_initial_mandi_prices

def analyze_price_trends(
    db: Session,
    commodity_key: str,
    market_id: Optional[int] = None,
    period_days: int = 30,
    user_id: int = 1
) -> TrendAnalysisResponse:
    """
    Computes time-series trend analysis, regression slope, future price projection,
    and identifies actionable margin improvement opportunities.
    """
    seed_initial_mandi_prices(db)
    comm_key = commodity_key.lower().strip()
    comm_meta = COMMODITY_CATALOG.get(comm_key, {
        "name_en": comm_key.capitalize(),
        "name_ta": comm_key,
        "base_price": 30.0
    })

    # Default to Market 1 (Koyambedu) if not specified
    target_market_id = market_id or 1
    market = db.query(MandiMarket).filter(MandiMarket.id == target_market_id).first()
    m_name_en = market.name_en if market else "Wholesale Mandi"
    m_name_ta = market.name_ta if market else "மொத்த சந்தை"

    # Fetch ordered historical prices
    prices = db.query(MandiDailyPrice).filter(
        MandiDailyPrice.commodity_key == comm_key,
        MandiDailyPrice.market_id == target_market_id
    ).order_by(MandiDailyPrice.date).all()

    # Limit to requested period
    if len(prices) > period_days:
        prices = prices[-period_days:]

    # Fetch vendor's recent purchase history for this commodity
    vendor_purchases = db.query(Purchase).filter(
        Purchase.user_id == user_id
    ).order_by(desc(Purchase.id)).limit(10).all()

    vendor_cost_map = {}
    for vp in vendor_purchases:
        if vp.purchase_date:
            vendor_cost_map[vp.purchase_date] = vp.unit_cost

    historical_points: List[TrendDataPoint] = []
    modal_values: List[float] = []

    for pr in prices:
        modal_values.append(pr.modal_price_per_kg)
        v_cost = vendor_cost_map.get(pr.date)
        historical_points.append(TrendDataPoint(
            date=pr.date,
            modal_price=pr.modal_price_per_kg,
            min_price=pr.min_price_per_kg,
            max_price=pr.max_price_per_kg,
            vendor_cost=v_cost
        ))

    if not modal_values:
        # Fallback if no records found
        base_p = comm_meta["base_price"]
        modal_values = [base_p]
        today_str = datetime.date.today().strftime("%Y-%m-%d")
        historical_points = [TrendDataPoint(date=today_str, modal_price=base_p)]

    current_price = modal_values[-1]
    prev_price = modal_values[-2] if len(modal_values) >= 2 else current_price
    price_change_pct = round(((current_price - prev_price) / prev_price) * 100.0, 1) if prev_price > 0 else 0.0

    avg_price = round(statistics.mean(modal_values), 1)
    min_price = min(modal_values)
    max_price = max(modal_values)

    # Linear Regression Slope: y = alpha + beta * x
    n = len(modal_values)
    beta = 0.0
    if n >= 3:
        x_vals = list(range(n))
        x_mean = statistics.mean(x_vals)
        y_mean = statistics.mean(modal_values)
        numerator = sum((x - x_mean) * (y - y_mean) for x, y in zip(x_vals, modal_values))
        denominator = sum((x - x_mean) ** 2 for x in x_vals)
        if denominator > 0:
            beta = numerator / denominator

    # Volatility (standard deviation of daily percentage returns)
    volatility = 0.0
    if n >= 3:
        returns = []
        for i in range(1, n):
            if modal_values[i - 1] > 0:
                returns.append((modal_values[i] - modal_values[i - 1]) / modal_values[i - 1])
        if returns and len(returns) >= 2:
            volatility = statistics.stdev(returns)

    # Trend pattern classification
    if volatility > 0.09:
        trend_pattern = "volatile"
    elif beta > 0.35:
        trend_pattern = "increasing"
    elif beta < -0.35:
        trend_pattern = "decreasing"
    else:
        trend_pattern = "stable"

    # Future 1-Day Price Projection
    # Exponential smoothing with trend: y_(t+1) = current_price + (beta * 0.75)
    projected_tomorrow = round(current_price + (beta * 0.75), 1)
    # Ensure reasonable bounds
    projected_tomorrow = max(projected_tomorrow, min_price * 0.9)
    projected_tomorrow = min(projected_tomorrow, max_price * 1.15)

    # Actionable Margin Improvement Opportunities
    opportunities_en = []
    opportunities_ta = []

    if trend_pattern == "increasing":
        opportunities_en.append(
            f"Wholesale prices for {comm_meta['name_en']} are trending UP (+₹{beta:.1f}/day). "
            f"Consider stocking up early tomorrow morning to lock in lower wholesale rates."
        )
        opportunities_ta.append(
            f"{comm_meta['name_ta']} மொத்த விலை உயர்ந்து வருகிறது (+₹{beta:.1f}/நாள்). "
            f"குறைந்த விலையில் கொள்முதல் செய்ய நாளை அதிகாலையிலேயே வாங்குங்கள்."
        )
    elif trend_pattern == "decreasing":
        opportunities_en.append(
            f"Wholesale prices are declining (-₹{abs(beta):.1f}/day). "
            f"Buy in tighter daily batches (15-20 kg) to avoid holding higher-cost inventory."
        )
        opportunities_ta.append(
            f"மொத்த விலை இறங்குமுகத்தில் உள்ளது (-₹{abs(beta):.1f}/நாள்). "
            f"விலை குறையும் போது தேக்கத்தை தவிர்க்க குறைந்த அளவில் (15-20 கிலோ) தினசரி எடுக்கவும்."
        )
    else:
        opportunities_en.append(
            f"Market rates are steady around ₹{avg_price:.0f}/kg. Maintain stable retail pricing with 25-30% margin."
        )
        opportunities_ta.append(
            f"சந்தை விலை ₹{avg_price:.0f}/கிலோ அளவில் சீராக உள்ளது. 25-30% நிலையான லாபத்துடன் விற்கலாம்."
        )

    # Compare vendor historical purchases vs market
    if vendor_purchases:
        avg_v_cost = statistics.mean([vp.unit_cost for vp in vendor_purchases if vp.unit_cost > 0] or [current_price])
        if avg_v_cost > current_price:
            savings = round(avg_v_cost - current_price, 1)
            opportunities_en.append(
                f"Your recent purchase cost averaged ₹{avg_v_cost:.1f}, but current mandi modal rate is ₹{current_price:.1f}. "
                f"Buying directly from {m_name_en} can save you up to ₹{savings}/kg."
            )
            opportunities_ta.append(
                f"உங்கள் முந்தைய கொள்முதல் விலை சராசரியாக ₹{avg_v_cost:.1f}, ஆனால் தற்போதைய சந்தை விலை ₹{current_price:.1f}. "
                f"{m_name_ta} சந்தையில் நேரடியாக வாங்கினால் கிலோவுக்கு ₹{savings} சேமிக்கலாம்."
            )

    return TrendAnalysisResponse(
        commodity_key=comm_key,
        commodity_name_en=comm_meta["name_en"],
        commodity_name_ta=comm_meta["name_ta"],
        market_id=target_market_id,
        market_name_en=m_name_en,
        market_name_ta=m_name_ta,
        period_days=period_days,
        current_price=round(current_price, 1),
        previous_price=round(prev_price, 1),
        price_change_pct=price_change_pct,
        trend_pattern=trend_pattern,
        average_price=avg_price,
        min_price_period=min_price,
        max_price_period=max_price,
        projected_tomorrow_price=projected_tomorrow,
        historical_points=historical_points,
        margin_opportunities=opportunities_en,
        margin_opportunities_ta=opportunities_ta
    )
