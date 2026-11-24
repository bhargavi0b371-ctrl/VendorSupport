from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas_intelligence import PricePredictionRequest, PricePredictionResponse
from ..services.prediction_service import predict_selling_price

router = APIRouter(prefix="/api/prediction", tags=["AI Selling Price Prediction"])

@router.post("/recommend-selling-price", response_model=PricePredictionResponse)
def get_selling_price_recommendation(
    payload: PricePredictionRequest,
    user_id: int = Query(1, description="Vendor User ID"),
    db: Session = Depends(get_db)
):
    """
    AI-Based Selling Price Recommendation Engine:
    Recommends fair selling price range based on wholesale mandi rates, vendor purchase costs,
    transport overhead, target margin %, seasonal demand, and explainable reasoning.
    """
    return predict_selling_price(db, payload, user_id=user_id)


@router.get("/commodity-breakdown/{commodity_key}", response_model=PricePredictionResponse)
def get_commodity_prediction_breakdown(
    commodity_key: str,
    user_id: int = Query(1, description="Vendor User ID"),
    db: Session = Depends(get_db)
):
    """
    Quick helper endpoint to get instant AI pricing recommendation and cost breakdown
    for a specific vegetable.
    """
    req = PricePredictionRequest(commodity_key=commodity_key)
    return predict_selling_price(db, req, user_id=user_id)
