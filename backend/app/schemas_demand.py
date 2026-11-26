from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class DailyDemandPoint(BaseModel):
    date: str
    day_name: str
    predicted_demand: float
    confidence_lower: Optional[float] = None
    confidence_upper: Optional[float] = None
    is_festival: bool = False
    festival_name: Optional[str] = None

class HistoricalSalesPoint(BaseModel):
    date: str
    quantity_sold: float

class ProductDemandForecast(BaseModel):
    product_id: int
    product_name_en: str
    product_name_ta: str
    category: str
    unit: str

    # Prediction Status & Method
    status: str # "ml_prediction" | "historical_baseline" | "no_data"
    is_ml_trained: bool
    status_message_en: str
    status_message_ta: str

    # Core Demand Metrics
    tomorrow_predicted_demand: float
    next_7_days_total_demand: float
    historical_avg_daily_sales: float

    # Inventory & Suggested Purchase
    current_unsold_stock: float
    suggested_purchase_quantity: float

    # Recommendation & Reasoning
    trend: str # "increasing" | "decreasing" | "stable" | "insufficient_data"
    recommendation_en: str
    recommendation_ta: str

    # Model Evaluation (Only populated when trained on real data)
    observations_count: int
    model_name: Optional[str] = None
    mae: Optional[float] = None # Mean Absolute Error on chronological test set
    train_test_split_info: Optional[str] = None
    last_trained_at: Optional[str] = None

    # Chart Data (Next 7 days predictions and recent actuals)
    forecast_7_days: List[DailyDemandPoint] = []
    recent_actual_sales: List[HistoricalSalesPoint] = []

class VendorDemandOverviewResponse(BaseModel):
    user_id: int
    generated_at: str
    total_products_tracked: int
    ml_models_active: int
    baseline_products: int
    products: List[ProductDemandForecast]

class RetrainResponse(BaseModel):
    user_id: int
    status: str
    trained_products_count: int
    skipped_products_count: int
    details: List[Dict[str, Any]]
