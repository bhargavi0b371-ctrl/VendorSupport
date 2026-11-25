import datetime
import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..schemas import SyncPushPayload, SyncResponse
from ..crud import (
    create_sale, create_purchase, create_daily_entry, get_items,
    get_markets, get_all_festivals, get_latest_market_prices,
    get_today_summary, get_vendor_products
)
from ..services.agmarknet_service import sync_live_agmarknet_bulletin

router = APIRouter(prefix="/api/sync", tags=["Offline Sync"])
logger = logging.getLogger(__name__)

@router.post("", response_model=SyncResponse)
def sync_offline_data(payload: SyncPushPayload, db: Session = Depends(get_db)):
    """
    Receives batch sales, purchases, and daily entries created while device was offline.
    Idempotent using client-generated sync_id UUIDs.
    """
    sales_count = 0
    purchases_count = 0
    daily_count = 0

    for s_in in payload.sales:
        create_sale(db, s_in)
        sales_count += 1

    for p_in in payload.purchases:
        create_purchase(db, p_in)
        purchases_count += 1

    for d_in in payload.daily_entries:
        create_daily_entry(db, d_in)
        daily_count += 1

    try:
        sync_live_agmarknet_bulletin(db)
    except Exception:
        logger.exception("Live Agmarknet refresh failed during offline sync")

    return SyncResponse(
        status="synced",
        synced_sales_count=sales_count,
        synced_purchases_count=purchases_count,
        synced_daily_entries_count=daily_count,
        server_time=datetime.datetime.now(datetime.timezone.utc).isoformat()
    )

@router.get("/bootstrap")
def get_bootstrap_data(user_id: int = 1, db: Session = Depends(get_db)):
    """
    Returns full catalog, vendor saved products, and market prices for initial offline seeding.
    """
    items = get_items(db)
    vendor_products = get_vendor_products(db, user_id=user_id)
    markets = get_markets(db)
    festivals = get_all_festivals(db)
    prices = get_latest_market_prices(db)
    summary = get_today_summary(db, user_id=user_id)

    return {
        "items": items,
        "vendor_products": vendor_products,
        "markets": markets,
        "festivals": festivals,
        "market_prices": prices,
        "today_summary": summary,
        "synced_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }
