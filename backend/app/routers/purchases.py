from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from ..schemas import PurchaseCreate, PurchaseResponse
from ..crud import create_purchase, get_purchases, delete_purchase

router = APIRouter(prefix="/api/purchases", tags=["Purchases"])

@router.post("", response_model=PurchaseResponse)
def add_purchase(purchase_in: PurchaseCreate, db: Session = Depends(get_db)):
    p = create_purchase(db, purchase_in)
    return PurchaseResponse(
        id=p.id,
        user_id=p.user_id,
        item_id=p.item_id,
        market_id=p.market_id,
        quantity=p.quantity,
        unit=p.unit,
        total_cost=p.total_cost,
        unit_cost=p.unit_cost,
        purchase_date=p.purchase_date,
        notes=p.notes,
        sync_id=p.sync_id,
        item_name_en=p.item.name_en if p.item else None,
        item_name_ta=p.item.name_ta if p.item else None,
        market_name_en=p.market.name_en if p.market else None,
        market_name_ta=p.market.name_ta if p.market else None
    )

@router.get("", response_model=List[PurchaseResponse])
def list_purchases(
    limit: int = 50,
    offset: int = 0,
    date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    db: Session = Depends(get_db)
):
    purchases = get_purchases(db, limit=limit, offset=offset, date_filter=date)
    return [
        PurchaseResponse(
            id=p.id,
            user_id=p.user_id,
            item_id=p.item_id,
            market_id=p.market_id,
            quantity=p.quantity,
            unit=p.unit,
            total_cost=p.total_cost,
            unit_cost=p.unit_cost,
            purchase_date=p.purchase_date,
            notes=p.notes,
            sync_id=p.sync_id,
            item_name_en=p.item.name_en if p.item else None,
            item_name_ta=p.item.name_ta if p.item else None,
            market_name_en=p.market.name_en if p.market else None,
            market_name_ta=p.market.name_ta if p.market else None
        )
        for p in purchases
    ]

@router.delete("/{purchase_id}")
def remove_purchase(purchase_id: int, db: Session = Depends(get_db)):
    ok = delete_purchase(db, purchase_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Purchase not found")
    return {"status": "success", "deleted_id": purchase_id}
