import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
)
from sqlalchemy.orm import relationship
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), nullable=False, default="Vendor")
    phone = Column(String(20), nullable=True)
    language = Column(String(10), default="ta")  # 'ta' (Tamil) or 'en' (English)
    default_margin_pct = Column(Float, default=20.0)  # Default target margin 20%
    onboarding_completed = Column(Boolean, default=False)
    selected_categories = Column(Text, default="[]")  # JSON list of category IDs
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    sales = relationship("Sale", back_populates="user", cascade="all, delete-orphan")
    purchases = relationship("Purchase", back_populates="user", cascade="all, delete-orphan")
    vendor_products = relationship("VendorProduct", back_populates="user", cascade="all, delete-orphan")
    daily_entries = relationship("DailyEntry", back_populates="user", cascade="all, delete-orphan")


class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name_en = Column(String(100), nullable=False)
    name_ta = Column(String(100), nullable=False)
    category = Column(String(50), nullable=False)  # vegetable, fruit, flower, street_food, etc.
    default_unit = Column(String(20), default="kg")  # kg, gram, piece, litre, packet, dozen, bunch
    icon = Column(String(50), default="food-apple")
    color = Column(String(20), default="#4CAF50")
    is_active = Column(Boolean, default=True)
    is_custom = Column(Boolean, default=False)
    vendor_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # custom item owner

    sales = relationship("Sale", back_populates="item")
    purchases = relationship("Purchase", back_populates="item")
    market_prices = relationship("MarketPrice", back_populates="item")
    vendor_links = relationship("VendorProduct", back_populates="item")
    daily_entry_items = relationship("DailyEntryItem", back_populates="item")


class VendorProduct(Base):
    """Mapping of items a vendor specifically sells."""
    __tablename__ = "vendor_products"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False, index=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="vendor_products")
    item = relationship("Item", back_populates="vendor_links")


class Market(Base):
    __tablename__ = "markets"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name_en = Column(String(150), nullable=False)
    name_ta = Column(String(150), nullable=False)
    location = Column(String(150), nullable=False)
    distance_km = Column(Float, default=5.0)
    transport_cost_per_km = Column(Float, default=15.0)  # in rupees
    map_url = Column(String(300), nullable=True)
    opening_hours = Column(String(100), default="3:00 AM - 11:00 AM")

    prices = relationship("MarketPrice", back_populates="market")
    purchases = relationship("Purchase", back_populates="market")


class MarketPrice(Base):
    __tablename__ = "market_prices"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False, index=True)
    market_id = Column(Integer, ForeignKey("markets.id"), nullable=False, index=True)
    date = Column(String(10), nullable=False, index=True)  # YYYY-MM-DD
    modal_price = Column(Float, nullable=False)  # typical wholesale price / kg
    min_price = Column(Float, nullable=True)
    max_price = Column(Float, nullable=True)
    source = Column(String(50), default="agmarknet")  # agmarknet, data.gov.in, manual_entry
    recorded_at = Column(DateTime, default=datetime.datetime.utcnow)

    item = relationship("Item", back_populates="market_prices")
    market = relationship("Market", back_populates="prices")


class Festival(Base):
    __tablename__ = "festivals"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name_en = Column(String(100), nullable=False)
    name_ta = Column(String(100), nullable=False)
    start_date = Column(String(10), nullable=False)  # YYYY-MM-DD
    end_date = Column(String(10), nullable=False)    # YYYY-MM-DD
    description_en = Column(String(255), nullable=True)
    description_ta = Column(String(255), nullable=True)
    affected_items_json = Column(Text, default="{}")


class Sale(Base):
    __tablename__ = "sales"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), default=1, index=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False, index=True)
    quantity = Column(Float, nullable=False)
    unit = Column(String(20), default="kg")
    amount = Column(Float, nullable=False)  # total price in ₹
    unit_price = Column(Float, nullable=False)  # amount / quantity
    sale_date = Column(String(10), nullable=False, index=True)  # YYYY-MM-DD
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    voice_raw_text = Column(String(255), nullable=True)
    sync_id = Column(String(64), nullable=True, unique=True, index=True)

    user = relationship("User", back_populates="sales")
    item = relationship("Item", back_populates="sales")


class Purchase(Base):
    __tablename__ = "purchases"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), default=1, index=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False, index=True)
    market_id = Column(Integer, ForeignKey("markets.id"), nullable=True)
    quantity = Column(Float, nullable=False)
    unit = Column(String(20), default="kg")
    total_cost = Column(Float, nullable=False)  # in ₹
    unit_cost = Column(Float, nullable=False)  # total_cost / quantity
    purchase_date = Column(String(10), nullable=False, index=True)  # YYYY-MM-DD
    notes = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    sync_id = Column(String(64), nullable=True, unique=True, index=True)

    user = relationship("User", back_populates="purchases")
    item = relationship("Item", back_populates="purchases")
    market = relationship("Market", back_populates="purchases")


class DailyEntry(Base):
    """Consolidated daily sales, expenses, and payment breakdown."""
    __tablename__ = "daily_entries"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), default=1, index=True)
    date = Column(String(10), nullable=False, index=True)  # YYYY-MM-DD

    # Daily Expenses
    expense_transport = Column(Float, default=0.0)
    expense_rent = Column(Float, default=0.0)
    expense_packaging = Column(Float, default=0.0)
    expense_other = Column(Float, default=0.0)
    total_expenses = Column(Float, default=0.0)

    # Payment Breakdown
    payment_cash = Column(Float, default=0.0)
    payment_upi = Column(Float, default=0.0)
    payment_digital_other = Column(Float, default=0.0)
    payment_credit_pending = Column(Float, default=0.0)

    # Financial Aggregates
    total_revenue = Column(Float, default=0.0)
    total_cogs = Column(Float, default=0.0)  # Cost of Goods Sold
    gross_profit = Column(Float, default=0.0)  # Revenue - COGS
    net_profit = Column(Float, default=0.0)    # Gross Profit - Total Expenses
    total_unsold_value = Column(Float, default=0.0)
    total_wastage_loss = Column(Float, default=0.0)
    profit_margin_pct = Column(Float, default=0.0)

    notes = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    sync_id = Column(String(64), nullable=True, unique=True, index=True)

    user = relationship("User", back_populates="daily_entries")
    items = relationship("DailyEntryItem", back_populates="daily_entry", cascade="all, delete-orphan")


class DailyEntryItem(Base):
    """Product-wise record in a daily entry."""
    __tablename__ = "daily_entry_items"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    daily_entry_id = Column(Integer, ForeignKey("daily_entries.id"), nullable=False, index=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False, index=True)

    quantity_sold = Column(Float, default=0.0)
    selling_price_per_unit = Column(Float, default=0.0)
    purchase_cost_per_unit = Column(Float, default=0.0)
    unsold_quantity = Column(Float, default=0.0)
    damaged_quantity = Column(Float, default=0.0)

    item_revenue = Column(Float, default=0.0)  # quantity_sold * selling_price_per_unit
    item_cogs = Column(Float, default=0.0)     # quantity_sold * purchase_cost_per_unit
    item_gross_profit = Column(Float, default=0.0) # item_revenue - item_cogs
    wastage_loss = Column(Float, default=0.0)      # damaged_quantity * purchase_cost_per_unit
    unsold_stock_value = Column(Float, default=0.0)# unsold_quantity * purchase_cost_per_unit

    daily_entry = relationship("DailyEntry", back_populates="items")
    item = relationship("Item", back_populates="daily_entry_items")
