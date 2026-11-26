import os
import json
import joblib
import datetime
import logging
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error

from ..models import User, Item, Sale, DailyEntry, DailyEntryItem, VendorProduct, Festival
from ..schemas_demand import (
    ProductDemandForecast, DailyDemandPoint, HistoricalSalesPoint,
    VendorDemandOverviewResponse, RetrainResponse
)

logger = logging.getLogger(__name__)

# Minimum observations required to train genuine ML RandomForestRegressor
MIN_OBSERVATIONS_FOR_ML = 60

# Model persistence directory
MODEL_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "ml_models")
os.makedirs(MODEL_DIR, exist_ok=True)


def _get_model_path(user_id: int, product_id: int) -> str:
    return os.path.join(MODEL_DIR, f"rf_demand_u{user_id}_p{product_id}.joblib")


def _get_metadata_path(user_id: int, product_id: int) -> str:
    return os.path.join(MODEL_DIR, f"rf_meta_u{user_id}_p{product_id}.json")


def _get_active_festivals(db: Session, date_str: str) -> List[Dict[str, Any]]:
    """Checks for active festivals for a given date in the database."""
    festivals = db.query(Festival).filter(
        and_(Festival.start_date <= date_str, Festival.end_date >= date_str)
    ).all()
    results = []
    for f in festivals:
        affected = {}
        if f.affected_items_json:
            try:
                affected = json.loads(f.affected_items_json)
            except Exception:
                affected = {}
        results.append({
            "id": f.id,
            "name_en": f.name_en,
            "name_ta": f.name_ta,
            "affected": affected
        })
    return results


def get_product_daily_sales_series(db: Session, user_id: int, product_id: int) -> pd.DataFrame:
    """
    Safely extracts daily sales series for a vendor-product pair from real database records:
    1. DailyEntry + DailyEntryItem
    2. Direct Sale records
    Aggregates without double counting if a day has both.
    Fills missing calendar dates with 0 sales.
    """
    # 1. From DailyEntryItem
    de_records = (
        db.query(DailyEntry.date, DailyEntryItem.quantity_sold)
        .join(DailyEntryItem, DailyEntry.id == DailyEntryItem.daily_entry_id)
        .filter(DailyEntry.user_id == user_id, DailyEntryItem.item_id == product_id)
        .all()
    )

    # 2. From standalone Sales table
    sale_records = (
        db.query(Sale.sale_date, func.sum(Sale.quantity))
        .filter(Sale.user_id == user_id, Sale.item_id == product_id)
        .group_by(Sale.sale_date)
        .all()
    )

    # Merge by date (taking max or sum if distinct; take maximum recorded to avoid double-counting syncs)
    date_qty: Dict[str, float] = {}
    for d, q in de_records:
        if d:
            date_qty[d] = max(date_qty.get(d, 0.0), float(q or 0.0))

    for d, q in sale_records:
        if d:
            date_qty[d] = max(date_qty.get(d, 0.0), float(q or 0.0))

    if not date_qty:
        return pd.DataFrame(columns=["date", "quantity_sold"])

    # Build continuous calendar series from min date to today
    sorted_dates = sorted(date_qty.keys())
    start_date = datetime.datetime.strptime(sorted_dates[0], "%Y-%m-%d").date()
    end_date = max(datetime.date.today(), datetime.datetime.strptime(sorted_dates[-1], "%Y-%m-%d").date())

    full_dates = []
    quantities = []
    curr = start_date
    while curr <= end_date:
        d_str = curr.strftime("%Y-%m-%d")
        full_dates.append(d_str)
        quantities.append(date_qty.get(d_str, 0.0))
        curr += datetime.timedelta(days=1)

    df = pd.DataFrame({
        "date": full_dates,
        "quantity_sold": quantities
    })
    return df


def build_features_dataframe(df: pd.DataFrame, db: Optional[Session] = None) -> pd.DataFrame:
    """
    Engineers relevant temporal and lag features for RandomForestRegressor:
    - lag_1 (yesterday sales)
    - lag_2, lag_3
    - rolling_7_mean (7-day moving average)
    - lag_7 (same day last week sales)
    - day_of_week (0=Monday, 6=Sunday)
    - is_weekend (0 or 1)
    - month (1 to 12)
    - is_festival (0 or 1)
    """
    if len(df) < 8:
        return pd.DataFrame()

    df = df.copy()
    df["date_dt"] = pd.to_datetime(df["date"])
    df["day_of_week"] = df["date_dt"].dt.dayofweek
    df["is_weekend"] = df["day_of_week"].apply(lambda x: 1 if x in [5, 6] else 0)
    df["month"] = df["date_dt"].dt.month

    # Lag features
    df["lag_1"] = df["quantity_sold"].shift(1)
    df["lag_2"] = df["quantity_sold"].shift(2)
    df["lag_3"] = df["quantity_sold"].shift(3)
    df["lag_7"] = df["quantity_sold"].shift(7)
    df["rolling_7_mean"] = df["quantity_sold"].shift(1).rolling(window=7, min_periods=1).mean()

    # Festival feature if DB provided
    festival_flags = []
    if db is not None:
        for d_str in df["date"]:
            fests = _get_active_festivals(db, d_str)
            festival_flags.append(1 if len(fests) > 0 else 0)
    else:
        festival_flags = [0] * len(df)

    df["is_festival"] = festival_flags

    # Drop warm-up rows with NaN lags
    df_clean = df.dropna().reset_index(drop=True)
    return df_clean


FEATURE_COLS = ["lag_1", "lag_2", "lag_3", "lag_7", "rolling_7_mean", "day_of_week", "is_weekend", "month", "is_festival"]


def train_product_model(
    db: Session,
    user_id: int,
    product_id: int
) -> Tuple[bool, Optional[float], str, int]:
    """
    Chronological train/test split (80/20) and RandomForestRegressor training:
    - Strictly trains on real vendor historical sales observations.
    - Evaluates MAE on held-out recent test split.
    - Saves model and metadata joblib file.
    """
    df = get_product_daily_sales_series(db, user_id, product_id)
    obs_count = len(df[df["quantity_sold"] > 0]) # Non-zero observations

    if len(df) < MIN_OBSERVATIONS_FOR_ML or obs_count < 15:
        msg = f"Insufficient history: {len(df)} total daily observations ({obs_count} non-zero sales). Minimum required is {MIN_OBSERVATIONS_FOR_ML} days."
        return False, None, msg, len(df)

    feat_df = build_features_dataframe(df, db)
    if len(feat_df) < 30:
        return False, None, "Insufficient data after feature engineering lags.", len(df)

    # Chronological Split: 80% train, 20% test
    split_idx = int(len(feat_df) * 0.8)
    train_df = feat_df.iloc[:split_idx]
    test_df = feat_df.iloc[split_idx:]

    if len(test_df) == 0:
        test_df = train_df.iloc[-5:] # fallback small slice if dataset is exact

    X_train = train_df[FEATURE_COLS]
    y_train = train_df["quantity_sold"]

    X_test = test_df[FEATURE_COLS]
    y_test = test_df["quantity_sold"]

    # RandomForestRegressor
    rf = RandomForestRegressor(
        n_estimators=100,
        max_depth=6,
        random_state=42,
        min_samples_split=3,
        n_jobs=-1
    )
    rf.fit(X_train, y_train)

    # Evaluate MAE on test set
    y_pred = rf.predict(X_test)
    mae = float(round(mean_absolute_error(y_test, y_pred), 2))

    # Refit on entire dataset for production forecasting
    rf.fit(feat_df[FEATURE_COLS], feat_df["quantity_sold"])

    # Persist model and metadata
    model_path = _get_model_path(user_id, product_id)
    meta_path = _get_metadata_path(user_id, product_id)

    joblib.dump(rf, model_path)
    metadata = {
        "user_id": user_id,
        "product_id": product_id,
        "trained_at": datetime.datetime.now().isoformat(),
        "observations_count": len(df),
        "active_sales_count": obs_count,
        "mae": mae,
        "train_rows": len(train_df),
        "test_rows": len(test_df),
        "features": FEATURE_COLS
    }
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    return True, mae, "RandomForestRegressor trained successfully on chronological sales data.", len(df)


def get_latest_unsold_stock(db: Session, user_id: int, product_id: int) -> float:
    """Finds current unsold stock from latest DailyEntryItem."""
    latest_item = (
        db.query(DailyEntryItem)
        .join(DailyEntry, DailyEntry.id == DailyEntryItem.daily_entry_id)
        .filter(DailyEntry.user_id == user_id, DailyEntryItem.item_id == product_id)
        .order_by(DailyEntry.date.desc())
        .first()
    )
    if latest_item and latest_item.unsold_quantity is not None:
        return float(latest_item.unsold_quantity)
    return 0.0


def forecast_demand_for_product(
    db: Session,
    user_id: int,
    product: Item
) -> ProductDemandForecast:
    """
    Generates 7-day demand forecast for a single product:
    - Uses trained RandomForestRegressor if available.
    - If history is insufficient, falls back to honest historical average baseline.
    - Calculates suggested purchase = predicted_demand - current_unsold_stock.
    """
    product_id = product.id
    df = get_product_daily_sales_series(db, user_id, product_id)
    current_stock = get_latest_unsold_stock(db, user_id, product_id)

    # Recent actual sales for charts (last 7 recorded days)
    recent_actuals: List[HistoricalSalesPoint] = []
    if not df.empty:
        non_zero_recent = df.tail(7)
        for _, r in non_zero_recent.iterrows():
            recent_actuals.append(HistoricalSalesPoint(
                date=r["date"],
                quantity_sold=float(r["quantity_sold"])
            ))

    # Calculate historical baseline
    non_zero_sales = df[df["quantity_sold"] > 0]["quantity_sold"]
    if len(non_zero_sales) > 0:
        hist_avg = float(round(non_zero_sales.mean(), 2))
    elif len(df) > 0:
        hist_avg = float(round(df["quantity_sold"].mean(), 2))
    else:
        hist_avg = 0.0

    model_path = _get_model_path(user_id, product_id)
    meta_path = _get_metadata_path(user_id, product_id)

    # Attempt to train if not yet trained and data is adequate
    if not os.path.exists(model_path) and len(df) >= MIN_OBSERVATIONS_FOR_ML:
        train_product_model(db, user_id, product_id)

    # Case 1: Genuine ML Model Exists
    if os.path.exists(model_path) and os.path.exists(meta_path):
        try:
            rf: RandomForestRegressor = joblib.load(model_path)
            with open(meta_path, "r", encoding="utf-8") as f:
                meta = json.load(f)

            # Rolling 7-day multi-step recursive forecast
            forecast_points: List[DailyDemandPoint] = []
            today = datetime.date.today()
            sim_df = df.copy()

            for step in range(1, 8):
                target_date = today + datetime.timedelta(days=step)
                t_str = target_date.strftime("%Y-%m-%d")
                day_name = target_date.strftime("%a")

                # Build feature vector from current sim_df history
                feat_df = build_features_dataframe(sim_df, db)
                if feat_df.empty:
                    pred_val = hist_avg
                else:
                    last_row = feat_df.iloc[-1].to_dict()
                    # Construct feature vector for target_date
                    active_fests = _get_active_festivals(db, t_str)
                    fest_flag = 1 if len(active_fests) > 0 else 0
                    fest_name = active_fests[0]["name_en"] if active_fests else None

                    input_row = {
                        "lag_1": float(sim_df["quantity_sold"].iloc[-1]),
                        "lag_2": float(sim_df["quantity_sold"].iloc[-2]) if len(sim_df) >= 2 else float(sim_df["quantity_sold"].iloc[-1]),
                        "lag_3": float(sim_df["quantity_sold"].iloc[-3]) if len(sim_df) >= 3 else float(sim_df["quantity_sold"].iloc[-1]),
                        "lag_7": float(sim_df["quantity_sold"].iloc[-7]) if len(sim_df) >= 7 else float(sim_df["quantity_sold"].iloc[-1]),
                        "rolling_7_mean": float(sim_df["quantity_sold"].tail(7).mean()),
                        "day_of_week": target_date.weekday(),
                        "is_weekend": 1 if target_date.weekday() in [5, 6] else 0,
                        "month": target_date.month,
                        "is_festival": fest_flag
                    }
                    X_pred = pd.DataFrame([input_row])[FEATURE_COLS]
                    pred_val = max(0.0, float(round(rf.predict(X_pred)[0], 2)))

                forecast_points.append(DailyDemandPoint(
                    date=t_str,
                    day_name=day_name,
                    predicted_demand=pred_val,
                    confidence_lower=round(max(0.0, pred_val - (meta.get("mae", 1.0) * 1.2)), 2),
                    confidence_upper=round(pred_val + (meta.get("mae", 1.0) * 1.2), 2),
                    is_festival=bool(fest_flag) if 'fest_flag' in locals() else False,
                    festival_name=fest_name if 'fest_name' in locals() else None
                ))

                # Append prediction to sim_df for next step recursive lag
                sim_df = pd.concat([
                    sim_df,
                    pd.DataFrame([{"date": t_str, "quantity_sold": pred_val}])
                ], ignore_index=True)

            tomorrow_demand = forecast_points[0].predicted_demand if forecast_points else 0.0
            next_7_demand = round(sum(p.predicted_demand for p in forecast_points), 2)
            suggested_purchase = max(0.0, round(tomorrow_demand - current_stock, 2))

            # Smart trend and recommendation
            if tomorrow_demand > (hist_avg * 1.15):
                trend = "increasing"
                rec_en = f"Demand is expected to increase by {round(((tomorrow_demand - hist_avg) / (hist_avg or 1)) * 100)}%. Consider stocking up to capture higher customer sales."
                rec_ta = f"தேவை வழக்கத்தை விட அதிகரிக்கும் என்று கணிக்கப்பட்டுள்ளது. விற்பனையை அதிகரிக்க கூடுதல் சரக்கு வாங்கலாம்."
            elif tomorrow_demand < (hist_avg * 0.85):
                trend = "decreasing"
                rec_en = f"Demand is expected to decrease. Purchase less ({suggested_purchase} {product.default_unit}) to reduce possible wastage loss."
                rec_ta = f"தேவை குறைய வாய்ப்புள்ளது. நஷ்டம் மற்றும் வீணாவதைத் தவிர்க்க குறைவான அளவு ({suggested_purchase} {product.default_unit}) வாங்கவும்."
            else:
                trend = "stable"
                rec_en = f"Demand is expected to remain stable near your usual average. Maintain approximately usual stock."
                rec_ta = f"விற்பனை வழக்கமான அளவில் நிலையாக இருக்கும். வழக்கமான இருப்பு போதுமானது."

            return ProductDemandForecast(
                product_id=product_id,
                product_name_en=product.name_en,
                product_name_ta=product.name_ta,
                category=product.category,
                unit=product.default_unit or "kg",
                status="ml_prediction",
                is_ml_trained=True,
                status_message_en=f"Predicted using RandomForestRegressor model trained on {meta.get('observations_count', 0)} daily sales observations.",
                status_message_ta=f"உங்கள் உண்மையான {meta.get('observations_count', 0)} நாள் விற்பனைத் தரவில் பயிற்றுவிக்கப்பட்ட AI மாடல் மூலம் கணிக்கப்பட்டது.",
                tomorrow_predicted_demand=tomorrow_demand,
                next_7_days_total_demand=next_7_demand,
                historical_avg_daily_sales=hist_avg,
                current_unsold_stock=current_stock,
                suggested_purchase_quantity=suggested_purchase,
                trend=trend,
                recommendation_en=rec_en,
                recommendation_ta=rec_ta,
                observations_count=meta.get("observations_count", len(df)),
                model_name="RandomForestRegressor (Scikit-Learn)",
                mae=meta.get("mae"),
                train_test_split_info=f"80% Train ({meta.get('train_rows')} days) / 20% Chronological Test ({meta.get('test_rows')} days)",
                last_trained_at=meta.get("trained_at"),
                forecast_7_days=forecast_points,
                recent_actual_sales=recent_actuals
            )
        except Exception as e:
            logger.warning(f"Error loading trained ML model for product {product_id}: {e}")

    # Case 2: Insufficient History / Baseline Fallback
    # Fallback to pure historical average; explicitly tell vendor this is NOT an ML model yet
    today = datetime.date.today()
    baseline_points: List[DailyDemandPoint] = []
    for step in range(1, 8):
        target_date = today + datetime.timedelta(days=step)
        baseline_points.append(DailyDemandPoint(
            date=target_date.strftime("%Y-%m-%d"),
            day_name=target_date.strftime("%a"),
            predicted_demand=hist_avg,
            confidence_lower=round(max(0.0, hist_avg * 0.8), 2),
            confidence_upper=round(hist_avg * 1.2, 2),
            is_festival=False
        ))

    tomorrow_demand = hist_avg
    next_7_demand = round(hist_avg * 7.0, 2)
    suggested_purchase = max(0.0, round(tomorrow_demand - current_stock, 2))

    obs_total = len(df)
    status_en = (
        f"Insufficient sales history ({obs_total} / {MIN_OBSERVATIONS_FOR_ML} days recorded). "
        "Showing historical average baseline. Record at least 60 days of daily sales to activate ML RandomForest forecasting."
    )
    status_ta = (
        f"போதுமான விற்பனை வரலாறு இல்லை ({obs_total} / {MIN_OBSERVATIONS_FOR_ML} நாட்கள் பதிவு). "
        "வரலாற்று சராசரி காட்டப்படுகிறது. AI மாடலை இயக்க குறைந்தது 60 நாட்கள் தினசரி விற்பனையை பதிவு செய்யவும்."
    )

    rec_en = f"Maintain approximately usual stock based on past average sales ({hist_avg} {product.default_unit})."
    rec_ta = f"வழக்கமான சராசரி விற்பனையின் அடிப்படையில் ({hist_avg} {product.default_unit}) தேவையான அளவு வாங்கவும்."

    return ProductDemandForecast(
        product_id=product_id,
        product_name_en=product.name_en,
        product_name_ta=product.name_ta,
        category=product.category,
        unit=product.default_unit or "kg",
        status="historical_baseline" if obs_total > 0 else "no_data",
        is_ml_trained=False,
        status_message_en=status_en,
        status_message_ta=status_ta,
        tomorrow_predicted_demand=tomorrow_demand,
        next_7_days_total_demand=next_7_demand,
        historical_avg_daily_sales=hist_avg,
        current_unsold_stock=current_stock,
        suggested_purchase_quantity=suggested_purchase,
        trend="stable" if hist_avg > 0 else "insufficient_data",
        recommendation_en=rec_en,
        recommendation_ta=rec_ta,
        observations_count=obs_total,
        model_name="Historical Baseline Average (ML Not Active)",
        mae=None,
        train_test_split_info="None (Requires >= 60 days)",
        last_trained_at=None,
        forecast_7_days=baseline_points,
        recent_actual_sales=recent_actuals
    )


def get_vendor_demand_overview(db: Session, user_id: int) -> VendorDemandOverviewResponse:
    """Generates demand forecasts for all active products selected by the logged-in vendor."""
    vps = (
        db.query(VendorProduct)
        .filter(VendorProduct.user_id == user_id, VendorProduct.is_active == True)
        .all()
    )

    forecasts: List[ProductDemandForecast] = []
    ml_count = 0
    baseline_count = 0

    for vp in vps:
        item = vp.item
        if not item:
            continue
        fc = forecast_demand_for_product(db, user_id, item)
        if fc.is_ml_trained:
            ml_count += 1
        else:
            baseline_count += 1
        forecasts.append(fc)

    # Sort so products with ML predictions or higher demand appear first
    forecasts.sort(key=lambda x: (x.is_ml_trained, x.tomorrow_predicted_demand), reverse=True)

    return VendorDemandOverviewResponse(
        user_id=user_id,
        generated_at=datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        total_products_tracked=len(forecasts),
        ml_models_active=ml_count,
        baseline_products=baseline_count,
        products=forecasts
    )


def trigger_vendor_model_retraining(db: Session, user_id: int) -> RetrainResponse:
    """Retrains models for all active products of the vendor that have sufficient history."""
    vps = (
        db.query(VendorProduct)
        .filter(VendorProduct.user_id == user_id, VendorProduct.is_active == True)
        .all()
    )

    trained_count = 0
    skipped_count = 0
    details = []

    for vp in vps:
        item = vp.item
        if not item:
            continue
        success, mae, message, obs = train_product_model(db, user_id, item.id)
        if success:
            trained_count += 1
            details.append({
                "product_id": item.id,
                "name": item.name_en,
                "status": "trained",
                "mae": mae,
                "observations": obs,
                "message": message
            })
        else:
            skipped_count += 1
            details.append({
                "product_id": item.id,
                "name": item.name_en,
                "status": "skipped",
                "observations": obs,
                "message": message
            })

    return RetrainResponse(
        user_id=user_id,
        status="completed",
        trained_products_count=trained_count,
        skipped_products_count=skipped_count,
        details=details
    )
