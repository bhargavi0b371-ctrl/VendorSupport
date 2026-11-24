from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class MandiMarketResponse(BaseModel):
    id: int
    market_code: str
    name_en: str
    name_ta: str
    district: str
    state: str
    latitude: float
    longitude: float
    distance_km: Optional[float] = None

    class Config:
        from_attributes = True


class MandiPriceItem(BaseModel):
    market_id: int
    market_name_en: str
    market_name_ta: str
    district: str
    commodity_key: str
    commodity_name_en: str
    commodity_name_ta: str
    date: str
    min_price_per_kg: Optional[float] = None
    max_price_per_kg: Optional[float] = None
    modal_price_per_kg: float
    arrival_tonnes: Optional[float] = 0.0
    distance_km: Optional[float] = None
    source: str = "agmarknet"
    fetched_at: str

    class Config:
        from_attributes = True


class CommodityComparisonResponse(BaseModel):
    commodity_key: str
    commodity_name_en: str
    commodity_name_ta: str
    date: str
    prices: List[MandiPriceItem]
    lowest_modal_price: Optional[float] = None
    highest_modal_price: Optional[float] = None
    best_market_id: Optional[int] = None
    best_market_name_en: Optional[str] = None
    best_market_name_ta: Optional[str] = None


class PricePredictionRequest(BaseModel):
    item_id: Optional[int] = None
    commodity_key: str = "tomato"
    vendor_purchase_cost: Optional[float] = None
    transport_overhead_per_kg: Optional[float] = 2.0
    target_margin_pct: Optional[float] = None


class CostBreakdown(BaseModel):
    mandi_wholesale_cost: float
    vendor_purchase_cost: float
    transport_overhead_per_kg: float
    cost_floor: float
    target_margin_amount: float
    festival_uplift_amount: float
    wastage_risk_buffer: float
    final_recommended_price: float


class PricePredictionResponse(BaseModel):
    item_id: Optional[int] = None
    commodity_key: str
    commodity_name_en: str
    commodity_name_ta: str
    prediction_date: str
    wholesale_benchmark: float
    vendor_cost: float
    recommended_price: float
    min_price_range: float
    max_price_range: float
    expected_margin_pct: float
    trend_direction: str
    reasoning_en: str
    reasoning_ta: str
    breakdown: CostBreakdown


class TrendDataPoint(BaseModel):
    date: str
    modal_price: float
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    vendor_cost: Optional[float] = None


class TrendAnalysisResponse(BaseModel):
    commodity_key: str
    commodity_name_en: str
    commodity_name_ta: str
    market_id: int
    market_name_en: str
    market_name_ta: str
    period_days: int
    current_price: float
    previous_price: float
    price_change_pct: float
    trend_pattern: str  # increasing, decreasing, stable, volatile
    average_price: float
    min_price_period: float
    max_price_period: float
    projected_tomorrow_price: float
    historical_points: List[TrendDataPoint]
    margin_opportunities: List[str]
    margin_opportunities_ta: List[str]


class PriceAlertResponse(BaseModel):
    id: int
    market_id: int
    market_name_en: str
    market_name_ta: str
    commodity_key: str
    date: str
    old_price: float
    new_price: float
    change_percentage: float
    alert_type: str
    message_en: str
    message_ta: str
    is_read: bool
    created_at: str

    class Config:
        from_attributes = True


class LiveSyncResult(BaseModel):
    status: str
    updated_records: int
    synced_at: str
    source: str
    message: str
