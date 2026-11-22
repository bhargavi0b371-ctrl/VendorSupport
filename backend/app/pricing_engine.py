import datetime
import json
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc
from .models import Item, Market, MarketPrice, Festival, User
from .schemas import SmartPricingItem, MarketRankingItem

def calculate_smart_pricing(db: Session, user_id: int = 1) -> List[SmartPricingItem]:
    """
    Computes for every item:
    - Today's wholesale price (modal price from latest market data)
    - Vendor's profit margin
    - Active festival uplift multiplier
    - Suggested fair selling price: wholesale * (1 + margin) * (1 + festival_uplift)
    - Price trend vs yesterday
    """
    user = db.query(User).filter(User.id == user_id).first()
    margin_pct = user.default_margin_pct if user else 20.0

    today_str = datetime.date.today().strftime("%Y-%m-%d")
    yesterday_str = (datetime.date.today() - datetime.timedelta(days=1)).strftime("%Y-%m-%d")

    # Find active festivals today
    active_festivals = db.query(Festival).filter(
        Festival.start_date <= today_str,
        Festival.end_date >= today_str
    ).all()

    # If no active festival today, find the upcoming festival within next 10 days for proactive awareness
    upcoming_festival = None
    if not active_festivals:
        next_week_str = (datetime.date.today() + datetime.timedelta(days=10)).strftime("%Y-%m-%d")
        upcoming = db.query(Festival).filter(
            Festival.start_date >= today_str,
            Festival.start_date <= next_week_str
        ).order_by(Festival.start_date).first()
        if upcoming:
            upcoming_festival = upcoming

    items = db.query(Item).filter(Item.is_active == True).all()
    results = []

    for item in items:
        # Latest price for this item
        latest_price_row = db.query(MarketPrice).filter(
            MarketPrice.item_id == item.id
        ).order_by(desc(MarketPrice.date), MarketPrice.id).first()

        wholesale_cost = latest_price_row.modal_price if latest_price_row else 30.0

        # Yesterday's price to check trend
        prev_price_row = db.query(MarketPrice).filter(
            MarketPrice.item_id == item.id,
            MarketPrice.date < (latest_price_row.date if latest_price_row else today_str)
        ).order_by(desc(MarketPrice.date)).first()

        yesterday_price = prev_price_row.modal_price if prev_price_row else wholesale_cost
        if wholesale_cost > yesterday_price * 1.03:
            trend = "up"
        elif wholesale_cost < yesterday_price * 0.97:
            trend = "down"
        else:
            trend = "stable"

        # Check festival uplift
        festival_uplift_pct = 0.0
        festival_name_en = None
        festival_name_ta = None
        festival_tag = None

        matched_festival = active_festivals[0] if active_festivals else (upcoming_festival if upcoming_festival else None)
        if matched_festival:
            try:
                demands = json.loads(matched_festival.affected_items_json)
                items_demand = demands.get("items", {})
                categories_demand = demands.get("categories", {})

                # Check specific item match first, then category match
                if str(item.id) in items_demand:
                    festival_uplift_pct = float(items_demand[str(item.id)])
                elif item.category in categories_demand:
                    festival_uplift_pct = float(categories_demand[item.category])

                if festival_uplift_pct > 0:
                    festival_name_en = matched_festival.name_en
                    festival_name_ta = matched_festival.name_ta
                    short_name = festival_name_en.split()[0]
                    short_name_ta = festival_name_ta.split()[0]
                    festival_tag = f"{short_name} +{int(festival_uplift_pct)}% ({short_name_ta})"
            except Exception:
                festival_uplift_pct = 0.0

        # Formula: wholesale * (1 + margin) * (1 + festival_uplift)
        base_with_margin = wholesale_cost * (1.0 + (margin_pct / 100.0))
        suggested = base_with_margin * (1.0 + (festival_uplift_pct / 100.0))

        # Street vendor roundings:
        # If suggested < 20, round to nearest 1
        # If suggested < 100, round to nearest 5
        # If suggested >= 100, round to nearest 10
        if suggested < 20:
            suggested_rounded = round(suggested)
        elif suggested < 100:
            suggested_rounded = round(suggested / 5.0) * 5
        else:
            suggested_rounded = round(suggested / 10.0) * 10

        # Ensure suggested is at least cost + 1
        if suggested_rounded <= wholesale_cost:
            suggested_rounded = wholesale_cost + 2.0

        results.append(SmartPricingItem(
            item_id=item.id,
            name_en=item.name_en,
            name_ta=item.name_ta,
            category=item.category,
            unit=item.default_unit,
            wholesale_cost=round(wholesale_cost, 1),
            vendor_margin_pct=margin_pct,
            suggested_selling_price=float(suggested_rounded),
            festival_name_en=festival_name_en,
            festival_name_ta=festival_name_ta,
            festival_uplift_pct=festival_uplift_pct,
            festival_tag=festival_tag,
            yesterday_price=round(yesterday_price, 1),
            price_trend=trend,
            icon=item.icon,
            color=item.color
        ))

    return results


def rank_markets_for_item(db: Session, item_id: int, batch_quantity: float = 25.0) -> List[MarketRankingItem]:
    """
    Ranks wholesale markets for a given item considering wholesale price + transport cost.
    Typical street vendor buys 20-30 kg per trip.
    """
    item = db.query(Item).filter(Item.id == item_id).first()
    markets = db.query(Market).all()
    rankings = []

    for m in markets:
        # Get latest price for item at this market
        price_row = db.query(MarketPrice).filter(
            MarketPrice.item_id == item_id,
            MarketPrice.market_id == m.id
        ).order_by(desc(MarketPrice.date), desc(MarketPrice.id)).first()

        wholesale_p = price_row.modal_price if price_row else 30.0
        # Round trip transport cost (auto/loading)
        transport_total = m.distance_km * m.transport_cost_per_km
        transport_per_kg = transport_total / max(batch_quantity, 1.0)
        total_landed = wholesale_p + transport_per_kg

        rankings.append({
            "market_id": m.id,
            "name_en": m.name_en,
            "name_ta": m.name_ta,
            "location": m.location,
            "distance_km": m.distance_km,
            "wholesale_price": round(wholesale_p, 1),
            "transport_cost_estimate": round(transport_total, 1),
            "total_estimated_landed_cost": round(total_landed, 1),
            "map_url": m.map_url or f"https://maps.google.com/?q={m.name_en}",
            "opening_hours": m.opening_hours
        })

    # Sort by total estimated landed cost ascending
    rankings.sort(key=lambda x: x["total_estimated_landed_cost"])

    result_items = []
    for idx, item_data in enumerate(rankings):
        result_items.append(MarketRankingItem(
            **item_data,
            rank=idx + 1,
            is_best_deal=(idx == 0)
        ))

    return result_items
