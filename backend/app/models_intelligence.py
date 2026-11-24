import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
)
from sqlalchemy.orm import relationship
from .database import Base

class MandiMarket(Base):
    """Wholesale APMC / AGMARKNET market locations across districts."""
    __tablename__ = "mandi_markets"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    market_code = Column(String(50), unique=True, index=True, nullable=False)
    name_en = Column(String(150), nullable=False)
    name_ta = Column(String(150), nullable=False)
    district = Column(String(100), nullable=False, index=True)
    state = Column(String(100), default="Tamil Nadu", index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    prices = relationship("MandiDailyPrice", back_populates="market", cascade="all, delete-orphan")
    alerts = relationship("PriceAlert", back_populates="market", cascade="all, delete-orphan")


class MandiDailyPrice(Base):
    """Daily market wholesale prices ingested from data.gov.in / AGMARKNET."""
    __tablename__ = "mandi_daily_prices"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    market_id = Column(Integer, ForeignKey("mandi_markets.id"), nullable=False, index=True)
    commodity_key = Column(String(100), nullable=False, index=True)  # normalized (e.g. "tomato", "onion")
    commodity_name_en = Column(String(100), nullable=False)
    commodity_name_ta = Column(String(100), nullable=False)
    date = Column(String(10), nullable=False, index=True)  # YYYY-MM-DD
    min_price_per_kg = Column(Float, nullable=True)
    max_price_per_kg = Column(Float, nullable=True)
    modal_price_per_kg = Column(Float, nullable=False)
    arrival_tonnes = Column(Float, default=0.0)
    source = Column(String(50), default="agmarknet")
    fetched_at = Column(DateTime, default=datetime.datetime.utcnow)

    market = relationship("MandiMarket", back_populates="prices")


class PricePredictionRecord(Base):
    """Logged AI selling price predictions and recommendations."""
    __tablename__ = "price_predictions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    item_id = Column(Integer, nullable=True, index=True)
    commodity_key = Column(String(100), nullable=False, index=True)
    prediction_date = Column(String(10), nullable=False, index=True)  # YYYY-MM-DD
    wholesale_benchmark = Column(Float, nullable=False)
    vendor_cost = Column(Float, nullable=False)
    recommended_price = Column(Float, nullable=False)
    min_price_range = Column(Float, nullable=False)
    max_price_range = Column(Float, nullable=False)
    expected_margin_pct = Column(Float, default=25.0)
    trend_direction = Column(String(20), default="stable")  # increasing, decreasing, stable, volatile
    reasoning_en = Column(Text, nullable=True)
    reasoning_ta = Column(Text, nullable=True)
    generated_at = Column(DateTime, default=datetime.datetime.utcnow)


class PriceAlert(Base):
    """Significant market price change notifications for vendors."""
    __tablename__ = "price_alerts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    market_id = Column(Integer, ForeignKey("mandi_markets.id"), nullable=False, index=True)
    commodity_key = Column(String(100), nullable=False, index=True)
    date = Column(String(10), nullable=False, index=True)  # YYYY-MM-DD
    old_price = Column(Float, nullable=False)
    new_price = Column(Float, nullable=False)
    change_percentage = Column(Float, nullable=False)
    alert_type = Column(String(20), default="spike")  # spike, drop
    message_en = Column(String(255), nullable=False)
    message_ta = Column(String(255), nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    market = relationship("MandiMarket", back_populates="alerts")
