from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..schemas import ItemResponse, UserResponse, UserUpdate
from ..crud import get_items, get_item_by_id, get_user, update_user

router = APIRouter(prefix="/api", tags=["Items & Settings"])

@router.get("/items", response_model=List[ItemResponse])
def list_items(db: Session = Depends(get_db)):
    return get_items(db)

@router.get("/items/{item_id}", response_model=ItemResponse)
def get_item(item_id: int, db: Session = Depends(get_db)):
    it = get_item_by_id(db, item_id)
    if not it:
        raise HTTPException(status_code=404, detail="Item not found")
    return it

@router.get("/settings/user", response_model=UserResponse)
def get_user_settings(user_id: int = 1, db: Session = Depends(get_db)):
    u = get_user(db, user_id=user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    return u

@router.put("/settings/user", response_model=UserResponse)
def update_user_settings(user_update: UserUpdate, user_id: int = 1, db: Session = Depends(get_db)):
    u = update_user(db, user_id, user_update)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    return u
