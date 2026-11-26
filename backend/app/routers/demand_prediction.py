from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from ..database import get_db
from ..models import Item
from ..schemas_demand import (
    VendorDemandOverviewResponse, ProductDemandForecast, RetrainResponse
)
from ..services.demand_service import (
    get_vendor_demand_overview, forecast_demand_for_product,
    trigger_vendor_model_retraining, train_product_model
)

router = APIRouter(prefix="/api/demand", tags=["AI Demand Prediction"])


@router.get("/forecast", response_model=VendorDemandOverviewResponse)
def get_vendor_demand_forecast(
    user_id: int = Query(1, description="Vendor User ID"),
    db: Session = Depends(get_db)
):
    """
    Returns AI-based demand forecast for all products selected by the logged-in vendor.
    - Uses trained RandomForestRegressor when >= 60 historical observations exist.
    - Clearly marks insufficient-history products with historical baseline and warning.
    - Keeps vendor sales completely isolated.
    """
    return get_vendor_demand_overview(db, user_id=user_id)


@router.get("/product/{product_id}", response_model=ProductDemandForecast)
def get_product_demand_forecast(
    product_id: int,
    user_id: int = Query(1, description="Vendor User ID"),
    db: Session = Depends(get_db)
):
    """
    Returns detailed 7-day demand prediction and evaluation metrics for a single product.
    """
    product = db.query(Item).filter(Item.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return forecast_demand_for_product(db, user_id=user_id, product=product)


@router.post("/retrain", response_model=RetrainResponse)
def retrain_vendor_models(
    user_id: int = Query(1, description="Vendor User ID"),
    db: Session = Depends(get_db)
):
    """
    Triggers chronological retraining of RandomForestRegressor models for the vendor's products.
    """
    return trigger_vendor_model_retraining(db, user_id=user_id)


@router.post("/train/{product_id}")
def train_single_product_model(
    product_id: int,
    user_id: int = Query(1, description="Vendor User ID"),
    db: Session = Depends(get_db)
):
    """
    Forces training attempt for a specific product and returns detailed evaluation MAE.
    """
    success, mae, message, obs = train_product_model(db, user_id, product_id)
    return {
        "user_id": user_id,
        "product_id": product_id,
        "trained": success,
        "mae": mae,
        "observations_count": obs,
        "message": message
    }
