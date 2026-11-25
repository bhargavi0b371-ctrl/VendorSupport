from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

# User
class UserBase(BaseModel):
    name: str = "Murugan"
    shop_name: Optional[str] = "Murugan Vegetable Stall"
    phone: Optional[str] = None
    pin: Optional[str] = "1234"
    language: str = "ta"
    default_margin_pct: float = 20.0
    onboarding_completed: bool = False
    selected_categories: str = "[]"

class UserUpdate(BaseModel):
    name: Optional[str] = None
    shop_name: Optional[str] = None
    phone: Optional[str] = None
    pin: Optional[str] = None
    language: Optional[str] = None
    default_margin_pct: Optional[float] = None
    onboarding_completed: Optional[bool] = None
    selected_categories: Optional[str] = None

class UserRegister(BaseModel):
    name: str
    shop_name: str
    phone: str
    pin: str = "1234"
    language: str = "ta"

class UserLogin(BaseModel):
    phone: str
    pin: str

class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    shop_name: Optional[str] = None
    phone: Optional[str] = None
    pin: Optional[str] = None
    language: Optional[str] = None

class UserResponse(UserBase):
    id: int
    class Config:
        from_attributes = True

class AuthResponse(BaseModel):
    status: str = "success"
    token: str
    user: UserResponse
    message_en: str
    message_ta: str


# Item & Products
class ItemBase(BaseModel):
    name_en: str
    name_ta: str
    category: str
    default_unit: str = "kg"
    icon: str = "food-apple"
    color: str = "#4CAF50"
    is_active: bool = True
    is_custom: bool = False
    vendor_id: Optional[int] = None

class ItemCreate(BaseModel):
    name_en: str
    name_ta: Optional[str] = None
    category: str
    default_unit: str = "kg"
    icon: Optional[str] = "tag-outline"
    color: Optional[str] = "#1B5E20"

class ItemResponse(ItemBase):
    id: int
    class Config:
        from_attributes = True


# Vendor Products
class VendorProductResponse(BaseModel):
    id: int
    item_id: int
    name_en: str
    name_ta: str
    category: str
    default_unit: str
    icon: str
    color: str
    is_active: bool
    is_custom: bool = False


# Onboarding
class OnboardingCategory(BaseModel):
    id: str
    name_en: str
    name_ta: str
    icon: str
    items_count: int

class OnboardingSubmit(BaseModel):
    user_id: int = 1
    selected_categories: List[str] = []
    selected_item_ids: Optional[List[int]] = None
    product_ids: Optional[List[int]] = None
    custom_items: Optional[List[ItemCreate]] = None
    custom_products: Optional[List[ItemCreate]] = None

class CustomProductCreate(BaseModel):
    user_id: int = 1
    name_en: str
    name_ta: Optional[str] = None
    category: str
    default_unit: str = "kg"
    icon: Optional[str] = "tag-outline"
    color: Optional[str] = "#1B5E20"


# Market & Market Price
class MarketBase(BaseModel):
    name_en: str
    name_ta: str
    location: str
    distance_km: float
    transport_cost_per_km: float = 15.0
    map_url: Optional[str] = None
    opening_hours: str = "3:00 AM - 11:00 AM"

class MarketResponse(MarketBase):
    id: int
    class Config:
        from_attributes = True

class MarketPriceBase(BaseModel):
    item_id: int
    market_id: int
    date: str
    modal_price: float
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    source: str = "agmarknet"

class MarketPriceCreate(MarketPriceBase):
    pass

class MarketPriceResponse(MarketPriceBase):
    id: int
    item_name_en: Optional[str] = None
    item_name_ta: Optional[str] = None
    market_name_en: Optional[str] = None
    market_name_ta: Optional[str] = None
    class Config:
        from_attributes = True


# Festival
class FestivalBase(BaseModel):
    name_en: str
    name_ta: str
    start_date: str
    end_date: str
    description_en: Optional[str] = None
    description_ta: Optional[str] = None
    affected_items_json: str = "{}"

class FestivalResponse(FestivalBase):
    id: int
    is_active_today: Optional[bool] = False
    class Config:
        from_attributes = True


# Single Sale & Purchase
class SaleCreate(BaseModel):
    user_id: int = 1
    item_id: int
    quantity: float
    unit: str = "kg"
    amount: float
    sale_date: Optional[str] = None
    voice_raw_text: Optional[str] = None
    sync_id: Optional[str] = None

class SaleResponse(BaseModel):
    id: int
    user_id: int
    item_id: int
    quantity: float
    unit: str
    amount: float
    unit_price: float
    sale_date: str
    voice_raw_text: Optional[str] = None
    sync_id: Optional[str] = None
    item_name_en: Optional[str] = None
    item_name_ta: Optional[str] = None
    class Config:
        from_attributes = True

class PurchaseCreate(BaseModel):
    user_id: int = 1
    item_id: int
    market_id: Optional[int] = None
    quantity: float
    unit: str = "kg"
    total_cost: float
    purchase_date: Optional[str] = None
    notes: Optional[str] = None
    sync_id: Optional[str] = None

class PurchaseResponse(BaseModel):
    id: int
    user_id: int
    item_id: int
    market_id: Optional[int] = None
    quantity: float
    unit: str
    total_cost: float
    unit_cost: float
    purchase_date: str
    notes: Optional[str] = None
    sync_id: Optional[str] = None
    item_name_en: Optional[str] = None
    item_name_ta: Optional[str] = None
    market_name_en: Optional[str] = None
    market_name_ta: Optional[str] = None
    class Config:
        from_attributes = True


# Daily Sales Entry Schemas
class DailyEntryItemInput(BaseModel):
    item_id: int
    quantity_sold: float = 0.0
    selling_price_per_unit: float = 0.0
    selling_price: Optional[float] = None
    purchase_cost_per_unit: float = 0.0
    purchase_cost: Optional[float] = None
    unsold_quantity: float = 0.0
    damaged_quantity: float = 0.0
    notes: Optional[str] = None

class DailyExpensesInput(BaseModel):
    transport: float = 0.0
    rent: float = 0.0
    packaging: float = 0.0
    other: float = 0.0

class PaymentBreakdownInput(BaseModel):
    cash: float = 0.0
    upi: float = 0.0
    digital_other: float = 0.0
    credit_pending: float = 0.0

class DailyEntrySubmit(BaseModel):
    user_id: int = 1
    date: Optional[str] = None  # defaults to today YYYY-MM-DD
    entry_date: Optional[str] = None
    items: List[DailyEntryItemInput] = []
    expenses: Optional[DailyExpensesInput] = None
    payments: Optional[PaymentBreakdownInput] = None
    transport_cost: Optional[float] = 0.0
    rent_cost: Optional[float] = 0.0
    packaging_cost: Optional[float] = 0.0
    other_expenses: Optional[float] = 0.0
    cash_collection: Optional[float] = 0.0
    upi_collection: Optional[float] = 0.0
    other_digital_collection: Optional[float] = 0.0
    pending_credit: Optional[float] = 0.0
    notes: Optional[str] = None
    sync_id: Optional[str] = None


# Daily Sales Report Responses
class ProductSalesDetail(BaseModel):
    item_id: int
    name_en: str
    name_ta: str
    unit: str
    quantity_sold: float
    selling_price_per_unit: float
    purchase_cost_per_unit: float
    item_revenue: float
    item_cogs: float
    gross_profit: float
    gross_margin_pct: float
    unsold_quantity: float
    unsold_stock_value: float
    damaged_quantity: float
    wastage_loss: float

class DailySalesReportResponse(BaseModel):
    entry_id: Optional[int] = None
    user_id: int
    date: str

    # Key Financials
    total_sales_revenue: float
    total_cogs: float
    gross_profit: float
    total_daily_expenses: float
    net_profit: float
    profit_margin_pct: float

    # Collections
    expenses_breakdown: DailyExpensesInput
    payments_breakdown: PaymentBreakdownInput
    total_collected: float
    pending_credit: float

    # Product Performance
    items_breakdown: List[ProductSalesDetail]
    best_selling_product: Optional[Dict[str, Any]] = None
    lowest_selling_product: Optional[Dict[str, Any]] = None
    most_profitable_product: Optional[Dict[str, Any]] = None

    # Stock & Wastage (kept cleanly separate from financial losses)
    total_unsold_stock_value: float
    total_wastage_loss: float

    # AI Insights
    ai_insights: Optional[Dict[str, Any]] = None


# AI Sales Insights
class AIInsightsResponse(BaseModel):
    stock_advice: List[Dict[str, Any]]
    expected_demand_tomorrow: List[Dict[str, Any]]
    highest_profit_products: List[Dict[str, Any]]
    wastage_reduction_tips: List[str]
    wastage_reduction_tips_ta: List[str]
    sales_improvement_suggestions: List[str]
    sales_improvement_suggestions_ta: List[str]
    promotional_offers: List[str]
    promotional_offers_ta: List[str]


# Smart Pricing & Markets
class SmartPricingItem(BaseModel):
    item_id: int
    name_en: str
    name_ta: str
    category: str
    unit: str
    wholesale_cost: float
    vendor_margin_pct: float
    suggested_selling_price: float
    festival_name_en: Optional[str] = None
    festival_name_ta: Optional[str] = None
    festival_uplift_pct: float = 0.0
    festival_tag: Optional[str] = None
    yesterday_price: Optional[float] = None
    price_trend: str = "stable"
    price_source: Optional[str] = "mock"
    icon: str
    color: str

class MarketRankingItem(BaseModel):
    market_id: int
    name_en: str
    name_ta: str
    location: str
    distance_km: float
    wholesale_price: float
    transport_cost_estimate: float
    total_estimated_landed_cost: float
    rank: int
    map_url: str
    opening_hours: str
    is_best_deal: bool = False


# Voice
class VoiceParseRequest(BaseModel):
    text: str
    language: Optional[str] = "auto"

class VoiceParseResponse(BaseModel):
    action: str
    item_id: Optional[int] = None
    item_name_en: Optional[str] = None
    item_name_ta: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = "kg"
    amount: Optional[float] = None
    cost: Optional[float] = None
    unsold: Optional[float] = None
    damaged: Optional[float] = None
    expense_transport: Optional[float] = None
    payment_cash: Optional[float] = None
    payment_upi: Optional[float] = None
    confidence: float = 1.0
    spoken_confirmation_en: str
    spoken_confirmation_ta: str
    raw_text: str
    can_execute: bool = False

class VoiceExecuteRequest(BaseModel):
    action: str
    item_id: Optional[int] = None
    quantity: Optional[float] = None
    unit: Optional[str] = "kg"
    amount: Optional[float] = None
    raw_text: Optional[str] = None


# Reports
class DailyReportSummary(BaseModel):
    date: str
    total_sales: float
    total_purchases: float
    net_profit: float
    sales_count: int
    purchases_count: int

class PeriodReportResponse(BaseModel):
    period: str
    total_sales: float
    total_purchases: float
    net_profit: float
    profit_margin_pct: float
    chart_data: List[Dict[str, Any]]
    top_selling_items: List[Dict[str, Any]]


# Sync
class SyncPushPayload(BaseModel):
    sales: List[SaleCreate] = []
    purchases: List[PurchaseCreate] = []
    daily_entries: List[DailyEntrySubmit] = []

class SyncResponse(BaseModel):
    status: str
    synced_sales_count: int
    synced_purchases_count: int
    synced_daily_entries_count: int = 0
    server_time: str
