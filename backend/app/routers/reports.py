from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..schemas import PeriodReportResponse
from ..crud import get_period_report

router = APIRouter(prefix="/api/reports", tags=["Reports"])

@router.get("", response_model=PeriodReportResponse)
def get_reports(
    period: str = Query("daily", pattern="^(daily|weekly|monthly)$"),
    user_id: int = 1,
    db: Session = Depends(get_db)
):
    report_dict = get_period_report(db, user_id=user_id, period=period)
    return PeriodReportResponse(**report_dict)
