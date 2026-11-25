from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from ..database import get_db
from ..crud import (
    authenticate_user, create_or_register_user, get_user,
    update_vendor_profile, get_user_by_phone
)
from ..schemas import (
    UserRegister, UserLogin, UserProfileUpdate, UserResponse, AuthResponse
)

router = APIRouter(prefix="/api/auth", tags=["Vendor Authentication & Profile"])

@router.post("/register", response_model=AuthResponse)
def register_vendor(payload: UserRegister, db: Session = Depends(get_db)):
    """
    Registers or updates vendor profile with shop name, vendor name, phone number, and security PIN.
    """
    if not payload.phone or not payload.phone.strip():
        raise HTTPException(status_code=400, detail="Phone number is required")
    if not payload.name or not payload.name.strip():
        raise HTTPException(status_code=400, detail="Vendor name is required")
    if not payload.shop_name or not payload.shop_name.strip():
        raise HTTPException(status_code=400, detail="Shop name is required")

    user = create_or_register_user(
        db=db,
        name=payload.name,
        shop_name=payload.shop_name,
        phone=payload.phone,
        pin=payload.pin or "1234",
        language=payload.language or "ta"
    )

    token = f"vv_token_{user.id}_{user.phone}"
    return AuthResponse(
        status="success",
        token=token,
        user=user,
        message_en=f"Welcome {user.name}! Your shop '{user.shop_name}' is verified.",
        message_ta=f"வணக்கம் {user.name}! உங்கள் கடை '{user.shop_name}' வெற்றிகரமாக இணைக்கப்பட்டது."
    )

@router.post("/login", response_model=AuthResponse)
def login_vendor(payload: UserLogin, db: Session = Depends(get_db)):
    """
    Authenticates vendor using phone number and security PIN.
    If phone exists, validates PIN.
    If default first user exists, allows easy login.
    """
    if not payload.phone or not payload.phone.strip():
        raise HTTPException(status_code=400, detail="Phone number is required")

    user = authenticate_user(db, phone=payload.phone, pin=payload.pin)
    if not user:
        # Check if user exists but PIN was wrong
        existing = get_user_by_phone(db, payload.phone)
        if existing:
            raise HTTPException(status_code=401, detail="Incorrect PIN. Please try again.")
        else:
            raise HTTPException(status_code=404, detail="Phone number not registered. Please sign up.")

    token = f"vv_token_{user.id}_{user.phone}"
    return AuthResponse(
        status="success",
        token=token,
        user=user,
        message_en=f"Welcome back to {user.shop_name}!",
        message_ta=f"மீண்டும் வருக {user.shop_name}!"
    )

@router.get("/me", response_model=UserResponse)
def get_current_vendor(user_id: int = Query(1, description="Vendor User ID"), db: Session = Depends(get_db)):
    """
    Retrieves the currently logged-in vendor profile details.
    """
    user = get_user(db, user_id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return user

@router.put("/profile", response_model=UserResponse)
def update_profile(
    payload: UserProfileUpdate,
    user_id: int = Query(1, description="Vendor User ID"),
    db: Session = Depends(get_db)
):
    """
    Updates vendor shop name, vendor name, phone number, PIN, or language.
    """
    user = update_vendor_profile(
        db=db,
        user_id=user_id,
        name=payload.name,
        shop_name=payload.shop_name,
        phone=payload.phone,
        pin=payload.pin,
        language=payload.language
    )
    if not user:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return user
