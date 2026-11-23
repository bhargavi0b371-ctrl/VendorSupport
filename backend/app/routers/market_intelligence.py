import datetime
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional

from ..database import get_db
from ..models_intelligence import MandiMarket, MandiDailyPrice, PriceAlert
from ..schemas_intelligence import (
    MandiMarketResponse, CommodityComparisonResponse, TrendAnalysisResponse,
    PriceAlertResponse, LiveSyncResult
)
from ..services.agmarknet_service import (
    get_nearby_mandis, compare_commodity_prices, sync_live_agmarknet_bulletin,
    COMMODITY_CATALOG
)
from ..services.trend_analyzer import analyze_price_trends

router = APIRouter(prefix="/api/intelligence", tags=["Market Price Intelligence"])

@router.get("/nearby-mandis", response_model=List[MandiMarketResponse])
def list_nearby_mandis(
    lat: Optional[float] = Query(None, description="Vendor latitude"),
    lon: Optional[float] = Query(None, description="Vendor longitude"),
    district: Optional[str] = Query(None, description="Vendor district"),
    radius_km: float = Query(40.0, description="Search radius in km"),
    db: Session = Depends(get_db)
):
    """
    Identifies nearby wholesale APMC mandis using vendor GPS coordinates (Haversine formula)
    or vendor district selection.
    """
    return get_nearby_mandis(db, latitude=lat, longitude=lon, district=district, radius_km=radius_km)


@router.get("/prices/compare", response_model=CommodityComparisonResponse)
def compare_prices(
    commodity: str = Query("tomato", description="Commodity key e.g. tomato, onion, potato"),
    date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    market_ids: Optional[str] = Query(None, description="Comma-separated market IDs"),
    db: Session = Depends(get_db)
):
    """
    Compares minimum, maximum, and modal wholesale prices for a vegetable
    across nearby markets with last updated timestamp.
    """
    parsed_ids = None
    if market_ids:
        try:
            parsed_ids = [int(i.strip()) for i in market_ids.split(",") if i.strip()]
        except ValueError:
            parsed_ids = None

    return compare_commodity_prices(db, commodity_key=commodity, target_date=date, market_ids=parsed_ids)


@router.get("/trends/{commodity}", response_model=TrendAnalysisResponse)
def get_price_trends(
    commodity: str,
    market_id: Optional[int] = Query(1, description="Wholesale market ID"),
    days: int = Query(30, ge=7, le=90, description="Number of historical days"),
    user_id: int = Query(1, description="Vendor user ID"),
    db: Session = Depends(get_db)
):
    """
    Provides 7, 14, or 30-day historical wholesale price trend lines, pattern classification,
    future movement estimation, and margin improvement opportunities.
    """
    return analyze_price_trends(
        db,
        commodity_key=commodity,
        market_id=market_id,
        period_days=days,
        user_id=user_id
    )


@router.post("/sync-live-bulletin", response_model=LiveSyncResult)
def trigger_agmarknet_sync(db: Session = Depends(get_db)):
    """
    Refreshes mandi price data from data.gov.in / AGMARKNET API or updates internal verified bulletin cache.
    Zero-fabrication contract: preserves actual reporting state.
    """
    updated_count, source_name = sync_live_agmarknet_bulletin(db)
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    return LiveSyncResult(
        status="success",
        updated_records=updated_count,
        synced_at=now_str,
        source=source_name,
        message=f"Successfully synced {updated_count} vegetable price records from {source_name}."
    )


@router.get("/alerts", response_model=List[PriceAlertResponse])
def get_price_alerts(
    unread_only: bool = Query(False, description="Filter unread alerts"),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """
    Returns market price change alerts (>= 12% price spikes or drops) in Tamil & English.
    """
    q = db.query(PriceAlert).order_by(desc(PriceAlert.id))
    if unread_only:
        q = q.filter(PriceAlert.is_read == False)
    alerts = q.limit(limit).all()

    results = []
    for a in alerts:
        m = a.market
        results.append(PriceAlertResponse(
            id=a.id,
            market_id=a.market_id,
            market_name_en=m.name_en if m else "Market",
            market_name_ta=m.name_ta if m else "சந்தை",
            commodity_key=a.commodity_key,
            date=a.date,
            old_price=a.old_price,
            new_price=a.new_price,
            change_percentage=a.change_percentage,
            alert_type=a.alert_type,
            message_en=a.message_en,
            message_ta=a.message_ta,
            is_read=a.is_read,
            created_at=a.created_at.strftime("%Y-%m-%d %H:%M")
        ))
    return results


@router.put("/alerts/{alert_id}/read")
def mark_alert_as_read(alert_id: int, db: Session = Depends(get_db)):
    """Marks a price alert as read."""
    alert = db.query(PriceAlert).filter(PriceAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.is_read = True
    db.commit()
    return {"status": "success", "alert_id": alert_id, "is_read": True}


@router.get("/commodities")
def list_supported_commodities():
    """Lists all monitored vegetables with bilingual names."""
    return [
        {
            "key": k,
            "name_en": v["name_en"],
            "name_ta": v["name_ta"],
            "base_price": v["base_price"]
        }
        for k, v in COMMODITY_CATALOG.items()
    ]
