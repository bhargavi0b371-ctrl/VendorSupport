from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from ..schemas import SaleCreate, SaleResponse, DailyReportSummary
from ..crud import create_sale, get_sales, get_sale_by_id, delete_sale, get_last_sale, get_today_summary

router = APIRouter(prefix="/api/sales", tags=["Sales"])

@router.post("", response_model=SaleResponse)
def add_sale(sale_in: SaleCreate, db: Session = Depends(get_db)):
    sale = create_sale(db, sale_in)
    return SaleResponse(
        id=sale.id,
        user_id=sale.user_id,
        item_id=sale.item_id,
        quantity=sale.quantity,
        unit=sale.unit,
        amount=sale.amount,
        unit_price=sale.unit_price,
        sale_date=sale.sale_date,
        voice_raw_text=sale.voice_raw_text,
        sync_id=sale.sync_id,
        item_name_en=sale.item.name_en if sale.item else None,
        item_name_ta=sale.item.name_ta if sale.item else None
    )

@router.get("", response_model=List[SaleResponse])
def list_sales(
    limit: int = 50,
    offset: int = 0,
    date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    db: Session = Depends(get_db)
):
    sales = get_sales(db, limit=limit, offset=offset, date_filter=date)
    return [
        SaleResponse(
            id=s.id,
            user_id=s.user_id,
            item_id=s.item_id,
            quantity=s.quantity,
            unit=s.unit,
            amount=s.amount,
            unit_price=s.unit_price,
            sale_date=s.sale_date,
            voice_raw_text=s.voice_raw_text,
            sync_id=s.sync_id,
            item_name_en=s.item.name_en if s.item else None,
            item_name_ta=s.item.name_ta if s.item else None
        )
        for s in sales
    ]

@router.get("/today-summary", response_model=DailyReportSummary)
def today_summary(user_id: int = 1, db: Session = Depends(get_db)):
    summary = get_today_summary(db, user_id=user_id)
    return DailyReportSummary(**summary)

@router.post("/undo-last")
def undo_last_sale(user_id: int = 1, db: Session = Depends(get_db)):
    last = get_last_sale(db, user_id=user_id)
    if not last:
        raise HTTPException(status_code=404, detail="No recent sales to undo")
    deleted_id = last.id
    amt = last.amount
    item_en = last.item.name_en if last.item else "Item"
    item_ta = last.item.name_ta if last.item else "பொருள்"
    qty = last.quantity
    unit = last.unit

    delete_sale(db, deleted_id)
    return {
        "status": "success",
        "deleted_sale_id": deleted_id,
        "amount": amt,
        "item_name_en": item_en,
        "item_name_ta": item_ta,
        "message_en": f"Undid sale of {qty} {unit} {item_en} (₹{amt:.0f})",
        "message_ta": f"{qty} {unit} {item_ta} (₹{amt:.0f}) விற்பனை ரத்து செய்யப்பட்டது"
    }

@router.delete("/{sale_id}")
def remove_sale(sale_id: int, db: Session = Depends(get_db)):
    ok = delete_sale(db, sale_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Sale not found")
    return {"status": "success", "deleted_id": sale_id}
