from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from ..crud import (
    create_daily_entry, get_daily_sales_report,
    get_daily_entries_history, generate_ai_insights
)
from ..schemas import DailyEntrySubmit, DailySalesReportResponse, AIInsightsResponse

router = APIRouter(prefix="/api/daily-sales", tags=["Daily Sales Entry & Reports"])

@router.post("", response_model=DailySalesReportResponse)
def submit_daily_entry(entry_in: DailyEntrySubmit, db: Session = Depends(get_db)):
    """
    Submits product-wise sales, expenses, and payment breakdown.
    Immediately returns the full calculated Daily Sales Report with AI Insights!
    """
    saved_entry = create_daily_entry(db, entry_in)
    report = get_daily_sales_report(db, user_id=saved_entry.user_id, target_date=saved_entry.date)
    return report

@router.get("/report", response_model=DailySalesReportResponse)
def get_report_by_date(
    date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    user_id: int = 1,
    db: Session = Depends(get_db)
):
    """Retrieves the full Daily Sales Report for a specific date (defaults to today)."""
    return get_daily_sales_report(db, user_id=user_id, target_date=date)

@router.get("/history")
def get_reports_history(user_id: int = 1, db: Session = Depends(get_db)):
    """Returns list of previous dates with submitted reports for vendor to revisit."""
    return get_daily_entries_history(db, user_id=user_id)

@router.get("/insights", response_model=AIInsightsResponse)
def get_insights(user_id: int = 1, db: Session = Depends(get_db)):
    """Generates AI Sales Insights based on historical vendor data."""
    raw = generate_ai_insights(db, user_id=user_id)
    return AIInsightsResponse(**raw)
