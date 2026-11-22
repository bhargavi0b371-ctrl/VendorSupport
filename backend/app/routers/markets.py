from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..schemas import MarketResponse, MarketRankingItem
from ..crud import get_markets, get_items
from ..pricing_engine import rank_markets_for_item
from ..market_scraper import sync_market_prices_to_db

router = APIRouter(prefix="/api/markets", tags=["Markets & Where to Buy"])

@router.get("", response_model=List[MarketResponse])
def list_markets(db: Session = Depends(get_db)):
    return get_markets(db)

@router.get("/where-to-buy/{item_id}", response_model=List[MarketRankingItem])
def where_to_buy_item(
    item_id: int,
    batch_kg: float = Query(25.0, description="Estimated purchase batch in kg/units"),
    db: Session = Depends(get_db)
):
    rankings = rank_markets_for_item(db, item_id=item_id, batch_quantity=batch_kg)
    if not rankings:
        raise HTTPException(status_code=404, detail="No price data available for this item")
    return rankings

@router.post("/sync-agmarknet")
def trigger_agmarknet_sync(db: Session = Depends(get_db)):
    """Fetches or re-synchronizes daily Agmarknet mandi market prices."""
    count = sync_market_prices_to_db(db)
    return {
        "status": "success",
        "synced_records": count,
        "message": f"Successfully updated {count} market price records from Agmarknet."
    }
