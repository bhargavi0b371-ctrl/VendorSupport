from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from ..database import get_db
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
    """Returns all 9 product categories and their predefined items for the onboarding screen."""
    categorized_items: Dict[str, List[Dict[str, Any]]] = {}
    for cat in CATEGORIES_CATALOG:
        categorized_items[cat["id"]] = []

    # Map items into categories (and fruits_vegetables gets both)
    for it in PREDEFINED_ITEMS:
        c = it["category"]
        if c in categorized_items:
            categorized_items[c].append(it)
        if c in ["fruits", "vegetables"]:
            categorized_items["fruits_vegetables"].append(it)

    return {
        "categories": CATEGORIES_CATALOG,
        "items_by_category": categorized_items,
        "all_predefined_items": PREDEFINED_ITEMS
    }

@router.post("/onboarding", response_model=UserResponse)
def submit_onboarding(payload: OnboardingSubmit, db: Session = Depends(get_db)):
    """Saves vendor category choices, selected products, and any custom products."""
    user = save_vendor_onboarding(
        db=db,
        user_id=payload.user_id,
        selected_categories=payload.selected_categories,
        selected_item_ids=payload.selected_item_ids,
        custom_items=payload.custom_items
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
