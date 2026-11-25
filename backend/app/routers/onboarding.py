from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from ..database import get_db
from ..models import Item
from ..seed_data import CATEGORIES_CATALOG, PREDEFINED_ITEMS
from ..crud import (
    save_vendor_onboarding, get_vendor_products, create_custom_item,
    toggle_vendor_product, get_user
)
from ..schemas import (
    OnboardingSubmit, CustomProductCreate, VendorProductResponse,
    ItemResponse, ItemCreate, UserResponse
)

router = APIRouter(prefix="/api", tags=["Onboarding & Products"])

@router.get("/onboarding/catalog")
def get_onboarding_catalog(db: Session = Depends(get_db)):
    """Returns all product categories and their items for the onboarding screen."""
    db_items = db.query(Item).filter(Item.is_active == True).all()
    items_list = [
        {
            "id": it.id,
            "name_en": it.name_en,
            "name_ta": it.name_ta,
            "category": it.category,
            "default_unit": it.default_unit,
            "icon": it.icon,
            "color": it.color,
            "is_custom": it.is_custom
        }
        for it in db_items
    ]

    categorized_items: Dict[str, List[Dict[str, Any]]] = {}
    for cat in CATEGORIES_CATALOG:
        categorized_items[cat["id"]] = []

    for it in items_list:
        c = (it["category"] or "").lower()
        # Normalization
        if "veg" in c:
            categorized_items["vegetables"].append(it)
            categorized_items["fruits_vegetables"].append(it)
        elif "fruit" in c:
            categorized_items["fruits"].append(it)
            categorized_items["fruits_vegetables"].append(it)
        elif "flower" in c:
            categorized_items["flowers"].append(it)
        elif "street" in c or "snack" in c or "food" in c:
            categorized_items["street_food"].append(it)
        elif "tea" in c or "coffee" in c:
            categorized_items["tea_coffee"].append(it)
        elif "groc" in c:
            categorized_items["groceries"].append(it)
        elif "cloth" in c or "access" in c:
            categorized_items["clothes"].append(it)
        elif "house" in c or "home" in c:
            if "household_items" in categorized_items:
                categorized_items["household_items"].append(it)
        else:
            if "other" in categorized_items:
                categorized_items["other"].append(it)

    return {
        "categories": CATEGORIES_CATALOG,
        "items_by_category": categorized_items,
        "all_predefined_items": items_list,
        "predefined_products": items_list
    }

@router.post("/onboarding", response_model=UserResponse)
def submit_onboarding(payload: OnboardingSubmit, db: Session = Depends(get_db)):
    """Saves vendor category choices, selected products, and any custom products."""
    item_ids = payload.selected_item_ids if payload.selected_item_ids is not None else (payload.product_ids or [])
    customs = payload.custom_items if payload.custom_items is not None else (payload.custom_products or [])
    user = save_vendor_onboarding(
        db=db,
        user_id=payload.user_id,
        selected_categories=payload.selected_categories,
        selected_item_ids=item_ids,
        custom_items=customs
    )
    return user

@router.get("/vendor/products", response_model=List[VendorProductResponse])
def list_vendor_products(user_id: int = 1, db: Session = Depends(get_db)):
    """Returns only the saved products for this vendor (used to populate daily sales entry)."""
    return get_vendor_products(db, user_id=user_id)

@router.post("/vendor/custom-product", response_model=ItemResponse)
def add_custom_product(payload: CustomProductCreate, db: Session = Depends(get_db)):
    """Allows vendor to add a new custom product with custom unit anytime."""
    new_item = create_custom_item(
        db=db,
        item_in=ItemCreate(
            name_en=payload.name_en,
            name_ta=payload.name_ta,
            category=payload.category,
            default_unit=payload.default_unit,
            icon=payload.icon,
            color=payload.color
        ),
        user_id=payload.user_id
    )
    return new_item

@router.put("/vendor/products/{item_id}")
def update_vendor_product_status(item_id: int, is_active: bool = Query(...), user_id: int = 1, db: Session = Depends(get_db)):
    """Toggles active/inactive status of a product in vendor's catalog."""
    ok = toggle_vendor_product(db, user_id=user_id, item_id=item_id, is_active=is_active)
    return {"status": "success", "item_id": item_id, "is_active": is_active}
