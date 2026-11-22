import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..schemas import SmartPricingItem, MarketPriceCreate, MarketPriceResponse
from ..pricing_engine import calculate_smart_pricing
from ..models import MarketPrice, Item, Market

router = APIRouter(prefix="/api/pricing", tags=["Smart Pricing"])

@router.get("", response_model=List[SmartPricingItem])
def get_pricing_all(user_id: int = 1, db: Session = Depends(get_db)):
    return calculate_smart_pricing(db, user_id=user_id)

@router.get("/{item_id}", response_model=SmartPricingItem)
def get_pricing_single(item_id: int, user_id: int = 1, db: Session = Depends(get_db)):
    pricings = calculate_smart_pricing(db, user_id=user_id)
    matched = next((p for p in pricings if p.item_id == item_id), None)
    if not matched:
        raise HTTPException(status_code=404, detail="Item not found")
    return matched

@router.post("/manual-price", response_model=MarketPriceResponse)
def add_manual_wholesale_price(price_in: MarketPriceCreate, db: Session = Depends(get_db)):
    """Allows street vendor to manually update wholesale buying rate if Agmarknet is unavailable."""
    item = db.query(Item).filter(Item.id == price_in.item_id).first()
    market = db.query(Market).filter(Market.id == price_in.market_id).first()
    if not item or not market:
        raise HTTPException(status_code=404, detail="Item or Market not found")

    today_str = datetime.date.today().strftime("%Y-%m-%d")
    date_val = price_in.date or today_str

    price_row = MarketPrice(
        item_id=price_in.item_id,
        market_id=price_in.market_id,
        date=date_val,
        modal_price=price_in.modal_price,
        min_price=price_in.min_price or round(price_in.modal_price * 0.9, 1),
        max_price=price_in.max_price or round(price_in.modal_price * 1.15, 1),
        source="manual_entry"
    )
    db.add(price_row)
    db.commit()
    db.refresh(price_row)

    return MarketPriceResponse(
        id=price_row.id,
        item_id=price_row.item_id,
        market_id=price_row.market_id,
        date=price_row.date,
        modal_price=price_row.modal_price,
        min_price=price_row.min_price,
        max_price=price_row.max_price,
        source=price_row.source,
        item_name_en=item.name_en,
        item_name_ta=item.name_ta,
        market_name_en=market.name_en,
        market_name_ta=market.name_ta
    )
