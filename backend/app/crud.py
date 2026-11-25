import datetime
import json
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from .models import (
    User, Item, Market, MarketPrice, Festival, Sale, Purchase,
    VendorProduct, DailyEntry, DailyEntryItem
)
from .schemas import (
    SaleCreate, PurchaseCreate, UserUpdate, ItemCreate,
    DailyEntrySubmit, DailySalesReportResponse, ProductSalesDetail,
    DailyExpensesInput, PaymentBreakdownInput, VendorProductResponse
)

# --- Users & Authentication ---
def get_user(db: Session, user_id: int = 1) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()

def get_user_by_phone(db: Session, phone: str) -> Optional[User]:
    clean_phone = phone.strip() if phone else ""
    return db.query(User).filter(User.phone == clean_phone).first()

def authenticate_user(db: Session, phone: str, pin: str) -> Optional[User]:
    clean_phone = phone.strip() if phone else ""
    clean_pin = pin.strip() if pin else ""
    user = db.query(User).filter(User.phone == clean_phone).first()
    if user and (user.pin == clean_pin or not user.pin):
        return user
    return None

def create_or_register_user(
    db: Session,
    name: str,
    shop_name: str,
    phone: str,
    pin: str = "1234",
    language: str = "ta"
) -> User:
    clean_phone = phone.strip() if phone else ""
    existing = get_user_by_phone(db, clean_phone)
    if existing:
        existing.name = name.strip() or existing.name
        existing.shop_name = shop_name.strip() or existing.shop_name
        existing.pin = pin.strip() or existing.pin
        existing.language = language or existing.language
        db.commit()
        db.refresh(existing)
        return existing

    new_user = User(
        name=name.strip() or "Vendor",
        shop_name=shop_name.strip() or "My Shop",
        phone=clean_phone,
        pin=pin.strip() or "1234",
        language=language or "ta",
        onboarding_completed=False,
        selected_categories="[]"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

def update_vendor_profile(
    db: Session,
    user_id: int,
    name: Optional[str] = None,
    shop_name: Optional[str] = None,
    phone: Optional[str] = None,
    pin: Optional[str] = None,
    language: Optional[str] = None
) -> Optional[User]:
    user = get_user(db, user_id)
    if not user:
        return None
    if name is not None:
        user.name = name.strip()
    if shop_name is not None:
        user.shop_name = shop_name.strip()
    if phone is not None:
        user.phone = phone.strip()
    if pin is not None and pin.strip():
        user.pin = pin.strip()
    if language is not None:
        user.language = language
    db.commit()
    db.refresh(user)
    return user

def update_user(db: Session, user_id: int, user_update: UserUpdate) -> Optional[User]:
    user = get_user(db, user_id)
    if not user:
        return None
    for field, val in user_update.model_dump(exclude_unset=True).items():
        setattr(user, field, val)
    db.commit()
    db.refresh(user)
    return user


# --- Items & Catalog ---
def get_items(db: Session, active_only: bool = True, category: Optional[str] = None) -> List[Item]:
    q = db.query(Item)
    if active_only:
        q = q.filter(Item.is_active == True)
    if category:
        q = q.filter(Item.category == category)
    items = q.order_by(Item.id).all()
    unique_items = []
    seen_names = set()
    for item in items:
        normalized_name = item.name_en.strip().casefold()
        if normalized_name not in seen_names:
            seen_names.add(normalized_name)
            unique_items.append(item)
    return unique_items

def get_item_by_id(db: Session, item_id: int) -> Optional[Item]:
    return db.query(Item).filter(Item.id == item_id).first()

def create_custom_item(db: Session, item_in: ItemCreate, user_id: int = 1) -> Item:
    name_en = item_in.name_en.strip()
    existing_item = db.query(Item).filter(
        Item.is_custom == True,
        Item.vendor_id == user_id,
        func.lower(func.trim(Item.name_en)) == name_en.casefold()
    ).order_by(Item.id).first()

    if existing_item:
        link = db.query(VendorProduct).filter(
            VendorProduct.user_id == user_id,
            VendorProduct.item_id == existing_item.id
        ).first()
        if link:
            link.is_active = True
        else:
            db.add(VendorProduct(user_id=user_id, item_id=existing_item.id, is_active=True))
        db.commit()
        return existing_item

    name_ta = item_in.name_ta if item_in.name_ta else name_en
    new_item = Item(
        name_en=name_en,
        name_ta=name_ta,
        category=item_in.category,
        default_unit=item_in.default_unit,
        icon=item_in.icon or "tag-outline",
        color=item_in.color or "#1B5E20",
        is_active=True,
        is_custom=True,
        vendor_id=user_id
    )
    db.add(new_item)
    db.commit()
    db.refresh(new_item)

    # Automatically link to vendor's product list
    link = VendorProduct(user_id=user_id, item_id=new_item.id, is_active=True)
    db.add(link)
    db.commit()
    return new_item


# --- Vendor Products (Onboarding & Saved Products) ---
def get_vendor_products(db: Session, user_id: int = 1) -> List[VendorProductResponse]:
    """Retrieves all active products saved for this vendor's shop."""
    vps = db.query(VendorProduct).filter(
        VendorProduct.user_id == user_id,
        VendorProduct.is_active == True
    ).all()

    if not vps:
        return []

    results = []
    for vp in vps:
        it = vp.item
        if it and it.is_active:
            results.append(VendorProductResponse(
                id=it.id,
                item_id=it.id,
                name_en=it.name_en,
                name_ta=it.name_ta,
                category=it.category,
                default_unit=it.default_unit,
                icon=it.icon,
                color=it.color,
                is_active=vp.is_active,
                is_custom=it.is_custom
            ))
    return results

def save_vendor_onboarding(
    db: Session,
    user_id: int,
    selected_categories: List[str],
    selected_item_ids: List[int],
    custom_items: Optional[List[ItemCreate]] = None
) -> User:
    """Saves vendor onboarding category and product selections."""
    user = get_user(db, user_id)
    if not user:
        user = User(id=user_id, name="Vendor", language="ta")
        db.add(user)
        db.commit()
        db.refresh(user)

    user.selected_categories = json.dumps(selected_categories)
    user.onboarding_completed = True

    # 1. Clear previous vendor products to set new selection
    db.query(VendorProduct).filter(VendorProduct.user_id == user_id).delete()

    # 2. Add predefined selected products
    for item_id in selected_item_ids:
        db.add(VendorProduct(user_id=user_id, item_id=item_id, is_active=True))

    # 3. Add any custom items entered during onboarding
    if custom_items:
        for c_item in custom_items:
            created = create_custom_item(db, c_item, user_id=user_id)
            # Link is created inside create_custom_item

    db.commit()
    db.refresh(user)
    return user

def toggle_vendor_product(db: Session, user_id: int, item_id: int, is_active: bool) -> bool:
    vp = db.query(VendorProduct).filter(
        VendorProduct.user_id == user_id,
        VendorProduct.item_id == item_id
    ).first()

    if vp:
        vp.is_active = is_active
    else:
        vp = VendorProduct(user_id=user_id, item_id=item_id, is_active=is_active)
        db.add(vp)

    db.commit()
    return True


# --- Daily Sales Entry & Comprehensive Report ---
def create_daily_entry(db: Session, entry_in: DailyEntrySubmit) -> DailyEntry:
    today_str = datetime.date.today().strftime("%Y-%m-%d")
    entry_date = entry_in.date or entry_in.entry_date or today_str

    # Compute Expenses
    if entry_in.expenses:
        exp_transport = float(entry_in.expenses.transport or entry_in.transport_cost or 0.0)
        exp_rent = float(entry_in.expenses.rent or entry_in.rent_cost or 0.0)
        exp_packaging = float(entry_in.expenses.packaging or entry_in.packaging_cost or 0.0)
        exp_other = float(entry_in.expenses.other or entry_in.other_expenses or 0.0)
    else:
        exp_transport = float(entry_in.transport_cost or 0.0)
        exp_rent = float(entry_in.rent_cost or 0.0)
        exp_packaging = float(entry_in.packaging_cost or 0.0)
        exp_other = float(entry_in.other_expenses or 0.0)
    total_expenses = float(exp_transport + exp_rent + exp_packaging + exp_other)

    # Compute Payments
    if entry_in.payments:
        pay_cash = float(entry_in.payments.cash or entry_in.cash_collection or 0.0)
        pay_upi = float(entry_in.payments.upi or entry_in.upi_collection or 0.0)
        pay_digital_other = float(entry_in.payments.digital_other or entry_in.other_digital_collection or 0.0)
        pay_credit_pending = float(entry_in.payments.credit_pending or entry_in.pending_credit or 0.0)
    else:
        pay_cash = float(entry_in.cash_collection or 0.0)
        pay_upi = float(entry_in.upi_collection or 0.0)
        pay_digital_other = float(entry_in.other_digital_collection or 0.0)
        pay_credit_pending = float(entry_in.pending_credit or 0.0)

    # Calculate item-wise financials
    total_revenue = 0.0
    total_cogs = 0.0
    total_unsold_val = 0.0
    total_wastage = 0.0

    items_to_save = []
    for it_in in entry_in.items:
        if it_in.quantity_sold <= 0 and it_in.unsold_quantity <= 0 and it_in.damaged_quantity <= 0:
            continue

        sp = it_in.selling_price_per_unit if it_in.selling_price_per_unit > 0 else (it_in.selling_price or 0.0)
        cost = it_in.purchase_cost_per_unit if it_in.purchase_cost_per_unit > 0 else (it_in.purchase_cost or 0.0)

        item_rev = round(it_in.quantity_sold * sp, 2)
        item_cogs = round(it_in.quantity_sold * cost, 2)
        item_gross = round(item_rev - item_cogs, 2)
        item_wastage = round(it_in.damaged_quantity * cost, 2)
        item_unsold_val = round(it_in.unsold_quantity * cost, 2)

        total_revenue += item_rev
        total_cogs += item_cogs
        total_wastage += item_wastage
        total_unsold_val += item_unsold_val

        items_to_save.append({
            "item_id": it_in.item_id,
            "quantity_sold": it_in.quantity_sold,
            "selling_price_per_unit": sp,
            "purchase_cost_per_unit": cost,
            "unsold_quantity": it_in.unsold_quantity,
            "damaged_quantity": it_in.damaged_quantity,
            "item_revenue": item_rev,
            "item_cogs": item_cogs,
            "item_gross_profit": item_gross,
            "wastage_loss": item_wastage,
            "unsold_stock_value": item_unsold_val
        })

    gross_profit = round(total_revenue - total_cogs, 2)
    # Net profit accounts for total daily expenses AND wastage loss without double-counting
    net_profit = round(gross_profit - total_expenses - total_wastage, 2)
    margin_pct = round((net_profit / total_revenue * 100), 1) if total_revenue > 0 else 0.0

    # If existing entry for this date and user, update it
    existing_entry = db.query(DailyEntry).filter(
        DailyEntry.user_id == entry_in.user_id,
        DailyEntry.date == entry_date
    ).first()

    if existing_entry:
        entry = existing_entry
        entry.expense_transport = exp_transport
        entry.expense_rent = exp_rent
        entry.expense_packaging = exp_packaging
        entry.expense_other = exp_other
        entry.total_expenses = total_expenses
        entry.payment_cash = pay_cash
        entry.payment_upi = pay_upi
        entry.payment_digital_other = pay_digital_other
        entry.payment_credit_pending = pay_credit_pending
        entry.total_revenue = round(total_revenue, 2)
        entry.total_cogs = round(total_cogs, 2)
        entry.gross_profit = gross_profit
        entry.net_profit = net_profit
        entry.total_unsold_value = round(total_unsold_val, 2)
        entry.total_wastage_loss = round(total_wastage, 2)
        entry.profit_margin_pct = margin_pct
        entry.notes = entry_in.notes
        # Delete existing items to replace with updated batch
        db.query(DailyEntryItem).filter(DailyEntryItem.daily_entry_id == entry.id).delete()
        # Delete prior sales records created for this daily entry to avoid duplicates
        db.query(Sale).filter(
            Sale.user_id == entry_in.user_id,
            Sale.sale_date == entry_date,
            Sale.voice_raw_text == "Daily Sales Entry"
        ).delete()
    else:
        entry = DailyEntry(
            user_id=entry_in.user_id,
            date=entry_date,
            expense_transport=exp_transport,
            expense_rent=exp_rent,
            expense_packaging=exp_packaging,
            expense_other=exp_other,
            total_expenses=total_expenses,
            payment_cash=pay_cash,
            payment_upi=pay_upi,
            payment_digital_other=pay_digital_other,
            payment_credit_pending=pay_credit_pending,
            total_revenue=round(total_revenue, 2),
            total_cogs=round(total_cogs, 2),
            gross_profit=gross_profit,
            net_profit=net_profit,
            total_unsold_value=round(total_unsold_val, 2),
            total_wastage_loss=round(total_wastage, 2),
            profit_margin_pct=margin_pct,
            notes=entry_in.notes,
            sync_id=entry_in.sync_id
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)

    # Save daily entry items
    for it_dict in items_to_save:
        de_item = DailyEntryItem(
            daily_entry_id=entry.id,
            **it_dict
        )
        db.add(de_item)

        # Also insert into sales table for backwards compatibility with correct item unit
        if it_dict["quantity_sold"] > 0:
            item_obj = db.query(Item).filter(Item.id == it_dict["item_id"]).first()
            item_unit = item_obj.default_unit if item_obj and item_obj.default_unit else "kg"
            db.add(Sale(
                user_id=entry_in.user_id,
                item_id=it_dict["item_id"],
                quantity=it_dict["quantity_sold"],
                unit=item_unit,
                amount=it_dict["item_revenue"],
                unit_price=it_dict["selling_price_per_unit"],
                sale_date=entry_date,
                voice_raw_text="Daily Sales Entry"
            ))

    db.commit()
    db.refresh(entry)
    return entry


def get_daily_sales_report(db: Session, user_id: int = 1, target_date: Optional[str] = None) -> DailySalesReportResponse:
    """Generates the comprehensive daily sales report with product breakdowns, best/lowest selling, and AI insights."""
    requested_explicit_date = bool(target_date)
    if not target_date:
        target_date = datetime.date.today().strftime("%Y-%m-%d")

    entry = db.query(DailyEntry).filter(
        DailyEntry.user_id == user_id,
        DailyEntry.date == target_date
    ).first()

    # If no daily entry for today and not explicitly requested, check latest available entry
    if not entry and not requested_explicit_date:
        entry = db.query(DailyEntry).filter(DailyEntry.user_id == user_id).order_by(desc(DailyEntry.date)).first()
        if entry:
            target_date = entry.date

    if not entry:
        # Default empty structure if no entries found for the target date
        return DailySalesReportResponse(
            entry_id=None,
            user_id=user_id,
            date=target_date,
            total_sales_revenue=0.0,
            total_cogs=0.0,
            gross_profit=0.0,
            total_daily_expenses=0.0,
            net_profit=0.0,
            profit_margin_pct=0.0,
            expenses_breakdown=DailyExpensesInput(),
            payments_breakdown=PaymentBreakdownInput(),
            total_collected=0.0,
            pending_credit=0.0,
            items_breakdown=[],
            best_selling_product=None,
            lowest_selling_product=None,
            most_profitable_product=None,
            total_unsold_stock_value=0.0,
            total_wastage_loss=0.0,
            ai_insights=None
        )

    # Product-wise details
    product_details: List[ProductSalesDetail] = []
    for de_it in entry.items:
        it = de_it.item
        if not it:
            continue
        margin_pct = round((de_it.item_gross_profit / de_it.item_revenue * 100), 1) if de_it.item_revenue > 0 else 0.0

        product_details.append(ProductSalesDetail(
            item_id=it.id,
            name_en=it.name_en,
            name_ta=it.name_ta,
            unit=it.default_unit,
            quantity_sold=de_it.quantity_sold,
            selling_price_per_unit=de_it.selling_price_per_unit,
            purchase_cost_per_unit=de_it.purchase_cost_per_unit,
            item_revenue=de_it.item_revenue,
            item_cogs=de_it.item_cogs,
            gross_profit=de_it.item_gross_profit,
            gross_margin_pct=margin_pct,
            unsold_quantity=de_it.unsold_quantity,
            unsold_stock_value=de_it.unsold_stock_value,
            damaged_quantity=de_it.damaged_quantity,
            wastage_loss=de_it.wastage_loss
        ))

    # Determine best selling (by revenue), lowest selling, and most profitable
    best_selling = None
    lowest_selling = None
    most_profitable = None

    if product_details:
        sorted_by_revenue = sorted(product_details, key=lambda x: x.item_revenue, reverse=True)
        sorted_by_profit = sorted(product_details, key=lambda x: x.gross_profit, reverse=True)

        best = sorted_by_revenue[0]
        best_selling = {
            "item_id": best.item_id,
            "name_en": best.name_en,
            "name_ta": best.name_ta,
            "revenue": best.item_revenue,
            "quantity_sold": best.quantity_sold,
            "unit": best.unit
        }

        lowest = sorted_by_revenue[-1]
        lowest_selling = {
            "item_id": lowest.item_id,
            "name_en": lowest.name_en,
            "name_ta": lowest.name_ta,
            "revenue": lowest.item_revenue,
            "quantity_sold": lowest.quantity_sold,
            "unit": lowest.unit
        }

        most_prof = sorted_by_profit[0]
        most_profitable = {
            "item_id": most_prof.item_id,
            "name_en": most_prof.name_en,
            "name_ta": most_prof.name_ta,
            "gross_profit": most_prof.gross_profit,
            "gross_margin_pct": most_prof.gross_margin_pct
        }

    # Generate AI insights for this daily entry
    ai_insights = generate_ai_insights(db, user_id=user_id, entry=entry, product_details=product_details)

    total_collected = round(entry.payment_cash + entry.payment_upi + entry.payment_digital_other, 2)

    return DailySalesReportResponse(
        entry_id=entry.id,
        user_id=user_id,
        date=entry.date,
        total_sales_revenue=entry.total_revenue,
        total_cogs=entry.total_cogs,
        gross_profit=entry.gross_profit,
        total_daily_expenses=entry.total_expenses,
        net_profit=entry.net_profit,
        profit_margin_pct=entry.profit_margin_pct,
        expenses_breakdown=DailyExpensesInput(
            transport=entry.expense_transport,
            rent=entry.expense_rent,
            packaging=entry.expense_packaging,
            other=entry.expense_other
        ),
        payments_breakdown=PaymentBreakdownInput(
            cash=entry.payment_cash,
            upi=entry.payment_upi,
            digital_other=entry.payment_digital_other,
            credit_pending=entry.payment_credit_pending
        ),
        total_collected=total_collected,
        pending_credit=entry.payment_credit_pending,
        items_breakdown=product_details,
        best_selling_product=best_selling,
        lowest_selling_product=lowest_selling,
        most_profitable_product=most_profitable,
        total_unsold_stock_value=entry.total_unsold_value,
        total_wastage_loss=entry.total_wastage_loss,
        ai_insights=ai_insights
    )


# --- AI Sales Insights Engine ---
def generate_ai_insights(
    db: Session,
    user_id: int,
    entry: Optional[DailyEntry] = None,
    product_details: Optional[List[ProductSalesDetail]] = None
) -> Dict[str, Any]:
    """Generates intelligent, actionable vendor suggestions based on historical performance and festival calendar."""
    if not entry:
        entry = db.query(DailyEntry).filter(DailyEntry.user_id == user_id).order_by(desc(DailyEntry.date)).first()

    stock_advice = []
    expected_demand = []
    highest_profit = []
    wastage_tips = []
    wastage_tips_ta = []
    sales_tips = []
    sales_tips_ta = []
    promo_offers = []
    promo_offers_ta = []

    # Check previous daily entry to detect real historical sales trends
    prev_entry = db.query(DailyEntry).filter(
        DailyEntry.user_id == user_id,
        DailyEntry.date < (entry.date if entry else datetime.date.today().strftime("%Y-%m-%d"))
    ).order_by(desc(DailyEntry.date)).first()

    prev_items_map = {}
    if prev_entry:
        for p_it in prev_entry.items:
            prev_items_map[p_it.item_id] = p_it.quantity_sold

    if product_details:
        for p in product_details:
            total_stock = p.quantity_sold + p.unsold_quantity + p.damaged_quantity
            sell_through = (p.quantity_sold / total_stock) if total_stock > 0 else 0.0

            # 1. Stock Advice & Historical Sales Trends
            rec_purchase = max(0.0, round((p.quantity_sold * 1.1) - p.unsold_quantity, 1))

            if p.item_id in prev_items_map and prev_items_map[p.item_id] > 0:
                prev_qty = prev_items_map[p.item_id]
                growth_pct = round(((p.quantity_sold - prev_qty) / prev_qty) * 100.0, 1)
                if growth_pct >= 10.0:
                    stock_advice.append({
                        "item_id": p.item_id,
                        "name_en": p.name_en,
                        "name_ta": p.name_ta,
                        "action": "stock_more",
                        "percentage": f"+{growth_pct}%",
                        "message_en": f"📈 {p.name_en} sales increased +{growth_pct}% vs previous day. Recommended purchase tomorrow: {rec_purchase} {p.unit}.",
                        "message_ta": f"📈 {p.name_ta} விற்பனை +{growth_pct}% அதிகரித்துள்ளது. நாளை பரிந்துரைக்கப்படும் கொள்முதல்: {rec_purchase} {p.unit}."
                    })
                elif growth_pct <= -15.0:
                    stock_advice.append({
                        "item_id": p.item_id,
                        "name_en": p.name_en,
                        "name_ta": p.name_ta,
                        "action": "stock_less",
                        "percentage": f"{growth_pct}%",
                        "message_en": f"📉 {p.name_en} sales slowed by {abs(growth_pct)}%. Recommended purchase tomorrow: {rec_purchase} {p.unit}.",
                        "message_ta": f"📉 {p.name_ta} விற்பனை {abs(growth_pct)}% குறைந்துள்ளது. நாளை பரிந்துரைக்கப்படும் கொள்முதல்: {rec_purchase} {p.unit}."
                    })
            elif sell_through >= 0.85:
                stock_advice.append({
                    "item_id": p.item_id,
                    "name_en": p.name_en,
                    "name_ta": p.name_ta,
                    "action": "stock_more",
                    "percentage": "+20%",
                    "message_en": f"Stock {rec_purchase} {p.unit} of {p.name_en} tomorrow (sold out {int(sell_through*100)}% of stock).",
                    "message_ta": f"நாளை {p.name_ta} {rec_purchase} {p.unit} வாங்கவும் ({int(sell_through*100)}% விற்று தீர்ந்துவிட்டது)."
                })
            elif p.damaged_quantity > 0 or sell_through < 0.6:
                stock_advice.append({
                    "item_id": p.item_id,
                    "name_en": p.name_en,
                    "name_ta": p.name_ta,
                    "action": "stock_less",
                    "percentage": "-15%",
                    "message_en": f"Unsold stock: {p.unsold_quantity} {p.unit}. Stock {rec_purchase} {p.unit} tomorrow to avoid excess.",
                    "message_ta": f"மீதமுள்ள சரக்கு: {p.unsold_quantity} {p.unit}. தேவைக்கு மேல் தேங்காமல் இருக்க நாளை {rec_purchase} {p.unit} வாங்கவும்."
                })

            # 2. Low profit margin detection & selling price recommendation
            if p.gross_margin_pct < 18.0 and p.quantity_sold > 0:
                rec_sp = round(p.purchase_cost_per_unit * 1.25, 1)
                sales_tips.append(
                    f"Low margin on {p.name_en} ({p.gross_margin_pct}%). Consider adjusting selling price to ₹{rec_sp}/{p.unit} to achieve 25% profit margin."
                )
                sales_tips_ta.append(
                    f"{p.name_ta} லாப வரம்பு குறைவு ({p.gross_margin_pct}%). 25% லாபம் பெற விற்பனை விலையை ₹{rec_sp}/{p.unit} என மாற்றலாம்."
                )

            # 3. Highest profit items
            if p.gross_profit > 100:
                highest_profit.append({
                    "item_id": p.item_id,
                    "name_en": p.name_en,
                    "name_ta": p.name_ta,
                    "profit": p.gross_profit,
                    "margin": f"{p.gross_margin_pct}%"
                })

            # 4. Wastage Tips for damaged items
            if p.damaged_quantity > 0:
                loss_amt = int(p.wastage_loss)
                wastage_tips.append(f"Store {p.name_en} in shade with damp gunny bag to avoid ₹{loss_amt} spoilage loss.")
                wastage_tips_ta.append(f"{p.name_ta} அழுகாமல் இருக்க நிழலிலும் ஈர சாக்கிலும் வைக்கவும் (₹{loss_amt} சேதாரம் தவிர்க்கலாம்).")

        # 4. Next day demand forecast
        today_date = datetime.date.today()
        tomorrow_date = (today_date + datetime.timedelta(days=1)).strftime("%Y-%m-%d")

        # Check festival multiplier for tomorrow
        active_fest = db.query(Festival).filter(
            Festival.start_date <= tomorrow_date,
            Festival.end_date >= tomorrow_date
        ).first()

        for p in product_details[:4]:
            multiplier = 1.15 if active_fest else 1.05
            forecast_qty = round(p.quantity_sold * multiplier, 1)
            reason_en = f"High festive demand ({active_fest.name_en.split()[0]})" if active_fest else "Steady weekday trend"
            reason_ta = f"பண்டிகை தேவை ({active_fest.name_ta.split()[0]})" if active_fest else "வழக்கமான தினசரி தேவை"

            expected_demand.append({
                "item_id": p.item_id,
                "name_en": p.name_en,
                "name_ta": p.name_ta,
                "expected_qty": forecast_qty,
                "unit": p.unit,
                "reason_en": reason_en,
                "reason_ta": reason_ta
            })

        # 5. Promotional offers & Combo suggestions
        if len(product_details) >= 2:
            it1 = product_details[0]
            it2 = product_details[1]
            combo_price = int(it1.selling_price_per_unit * 2 + it2.selling_price_per_unit - 10)
            promo_offers.append(f"Combo Deal: 2 {it1.unit} {it1.name_en} + 1 {it2.unit} {it2.name_en} for ₹{combo_price} (Save ₹10)")
            promo_offers_ta.append(f"சிறப்பு ஆஃபர்: 2 {it1.unit} {it1.name_ta} + 1 {it2.unit} {it2.name_ta} = ₹{combo_price} (₹10 தள்ளுபடி)")

        promo_offers.append("Evening Clearance: Offer 15% discount after 6:00 PM for leftover perishable stock.")
        promo_offers_ta.append("மாலை நேர தள்ளுபடி: மீதமுள்ள காய்கறிகளை மாலை 6 மணிக்கு மேல் 15% கழிவில் விற்று முடிக்கவும்.")

        sales_tips.append("Accept UPI QR payments prominently; vendors with UPI signs record 30% higher customer basket size.")
        sales_tips_ta.append("கூகிள் பே / UPI போர்டை முன்னால் வைக்கவும்; சில்லறை தட்டுப்பாடு இன்றி 30% கூடுதல் விற்பனை ஆகும்.")

    return {
        "stock_advice": stock_advice,
        "expected_demand_tomorrow": expected_demand,
        "highest_profit_products": highest_profit,
        "wastage_reduction_tips": wastage_tips if wastage_tips else ["Sell older stock first (FIFO) and keep items elevated from hot ground."],
        "wastage_reduction_tips_ta": wastage_tips_ta if wastage_tips_ta else ["பழைய சரக்கை முதலில் விற்கவும், தரை சூடு படாமல் பலகையில் வைக்கவும்."],
        "sales_improvement_suggestions": sales_tips if sales_tips else ["Display price tags clearly to attract walk-in buyers."],
        "sales_improvement_suggestions_ta": sales_tips_ta if sales_tips_ta else ["தெளிவான விலை போர்டு வைத்தால் வாடிக்கையாளர்கள் தயங்காமல் வாங்குவர்."],
        "promotional_offers": promo_offers,
        "promotional_offers_ta": promo_offers_ta
    }


def get_daily_entries_history(db: Session, user_id: int = 1) -> List[Dict[str, Any]]:
    """Returns list of dates with submitted daily reports."""
    entries = db.query(DailyEntry).filter(
        DailyEntry.user_id == user_id
    ).order_by(desc(DailyEntry.date)).all()

    return [
        {
            "id": e.id,
            "date": e.date,
            "total_revenue": e.total_revenue,
            "total_sales_revenue": e.total_revenue,
            "net_profit": e.net_profit,
            "profit_margin_pct": e.profit_margin_pct,
            "items_count": len(e.items)
        }
        for e in entries
    ]


# --- Sales & Purchases (Existing compatibility) ---
def create_sale(db: Session, sale_in: SaleCreate) -> Sale:
    today_str = datetime.date.today().strftime("%Y-%m-%d")
    sale_date = sale_in.sale_date or today_str
    unit_price = round(sale_in.amount / sale_in.quantity, 2) if sale_in.quantity > 0 else 0.0

    if sale_in.sync_id:
        existing = db.query(Sale).filter(Sale.sync_id == sale_in.sync_id).first()
        if existing:
            return existing

    db_sale = Sale(
        user_id=sale_in.user_id,
        item_id=sale_in.item_id,
        quantity=sale_in.quantity,
        unit=sale_in.unit,
        amount=sale_in.amount,
        unit_price=unit_price,
        sale_date=sale_date,
        voice_raw_text=sale_in.voice_raw_text,
        sync_id=sale_in.sync_id
    )
    db.add(db_sale)
    db.commit()
    db.refresh(db_sale)
    return db_sale

def get_sales(db: Session, limit: int = 50, offset: int = 0, date_filter: Optional[str] = None) -> List[Sale]:
    q = db.query(Sale)
    if isinstance(date_filter, str) and date_filter.strip():
        q = q.filter(Sale.sale_date == date_filter.strip())
    return q.order_by(desc(Sale.id)).offset(offset).limit(limit).all()

def get_sale_by_id(db: Session, sale_id: int) -> Optional[Sale]:
    return db.query(Sale).filter(Sale.id == sale_id).first()

def delete_sale(db: Session, sale_id: int) -> bool:
    sale = get_sale_by_id(db, sale_id)
    if sale:
        db.delete(sale)
        db.commit()
        return True
    return False

def get_last_sale(db: Session, user_id: int = 1) -> Optional[Sale]:
    return db.query(Sale).filter(Sale.user_id == user_id).order_by(desc(Sale.id)).first()

def create_purchase(db: Session, purchase_in: PurchaseCreate) -> Purchase:
    today_str = datetime.date.today().strftime("%Y-%m-%d")
    purchase_date = purchase_in.purchase_date or today_str
    unit_cost = round(purchase_in.total_cost / purchase_in.quantity, 2) if purchase_in.quantity > 0 else 0.0

    if purchase_in.sync_id:
        existing = db.query(Purchase).filter(Purchase.sync_id == purchase_in.sync_id).first()
        if existing:
            return existing

    db_purchase = Purchase(
        user_id=purchase_in.user_id,
        item_id=purchase_in.item_id,
        market_id=purchase_in.market_id,
        quantity=purchase_in.quantity,
        unit=purchase_in.unit,
        total_cost=purchase_in.total_cost,
        unit_cost=unit_cost,
        purchase_date=purchase_date,
        notes=purchase_in.notes,
        sync_id=purchase_in.sync_id
    )
    db.add(db_purchase)
    db.commit()
    db.refresh(db_purchase)
    return db_purchase

def get_purchases(db: Session, limit: int = 50, offset: int = 0, date_filter: Optional[str] = None) -> List[Purchase]:
    q = db.query(Purchase)
    if isinstance(date_filter, str) and date_filter.strip():
        q = q.filter(Purchase.purchase_date == date_filter.strip())
    return q.order_by(desc(Purchase.id)).offset(offset).limit(limit).all()

def delete_purchase(db: Session, purchase_id: int) -> bool:
    p = db.query(Purchase).filter(Purchase.id == purchase_id).first()
    if p:
        db.delete(p)
        db.commit()
        return True
    return False


# --- Markets & Prices ---
def get_markets(db: Session) -> List[Market]:
    return db.query(Market).all()

def get_latest_market_prices(db: Session, target_date: Optional[str] = None) -> List[MarketPrice]:
    if not target_date:
        target_date = datetime.date.today().strftime("%Y-%m-%d")
    latest_date_row = db.query(MarketPrice.date).filter(MarketPrice.date <= target_date).order_by(desc(MarketPrice.date)).first()
    if not latest_date_row:
        latest_date_row = db.query(MarketPrice.date).order_by(desc(MarketPrice.date)).first()
    if not latest_date_row:
        return []
    return db.query(MarketPrice).filter(MarketPrice.date == latest_date_row[0]).all()

def get_item_price_history(db: Session, item_id: int, days: int = 7) -> List[MarketPrice]:
    return db.query(MarketPrice).filter(
        MarketPrice.item_id == item_id
    ).order_by(desc(MarketPrice.date)).limit(days * 3).all()

def get_active_festivals(db: Session, target_date: Optional[str] = None) -> List[Festival]:
    if not target_date:
        target_date = datetime.date.today().strftime("%Y-%m-%d")
    return db.query(Festival).filter(
        Festival.start_date <= target_date,
        Festival.end_date >= target_date
    ).all()

def get_all_festivals(db: Session) -> List[Festival]:
    return db.query(Festival).order_by(Festival.start_date).all()

def get_today_summary(db: Session, user_id: int = 1, target_date: Optional[str] = None) -> Dict[str, Any]:
    if not target_date:
        target_date = datetime.date.today().strftime("%Y-%m-%d")

    # Check if a DailyEntry exists for today
    de = db.query(DailyEntry).filter(DailyEntry.user_id == user_id, DailyEntry.date == target_date).first()
    if de:
        return {
            "date": target_date,
            "total_sales": de.total_revenue,
            "total_purchases": de.total_cogs + de.total_expenses,
            "net_profit": de.net_profit,
            "sales_count": len(de.items),
            "purchases_count": 1
        }

    sales = db.query(Sale).filter(Sale.user_id == user_id, Sale.sale_date == target_date).all()
    purchases = db.query(Purchase).filter(Purchase.user_id == user_id, Purchase.purchase_date == target_date).all()

    total_sales = sum(s.amount for s in sales)
    total_purchases = sum(p.total_cost for p in purchases)
    net_profit = total_sales - total_purchases

    return {
        "date": target_date,
        "total_sales": round(total_sales, 2),
        "total_purchases": round(total_purchases, 2),
        "net_profit": round(net_profit, 2),
        "sales_count": len(sales),
        "purchases_count": len(purchases)
    }

def get_period_report(db: Session, user_id: int = 1, period: str = "daily") -> Dict[str, Any]:
    today = datetime.date.today()
    chart_data = []

    if period == "daily":
        num_days = 7
        total_sales = 0.0
        total_purchases = 0.0

        for i in range(num_days - 1, -1, -1):
            d = today - datetime.timedelta(days=i)
            d_str = d.strftime("%Y-%m-%d")
            day_name = d.strftime("%a")

            de = db.query(DailyEntry).filter(DailyEntry.user_id == user_id, DailyEntry.date == d_str).first()
            if de:
                d_sales = de.total_revenue
                d_purchases = de.total_cogs + de.total_expenses
                d_profit = de.net_profit
            else:
                d_sales = db.query(func.sum(Sale.amount)).filter(Sale.user_id == user_id, Sale.sale_date == d_str).scalar() or 0.0
                d_purchases = db.query(func.sum(Purchase.total_cost)).filter(Purchase.user_id == user_id, Purchase.purchase_date == d_str).scalar() or 0.0
                d_profit = d_sales - d_purchases

            total_sales += d_sales
            total_purchases += d_purchases

            chart_data.append({
                "label": day_name,
                "date": d_str,
                "sales": round(d_sales, 2),
                "purchases": round(d_purchases, 2),
                "profit": round(d_profit, 2)
            })

    elif period == "weekly":
        total_sales = 0.0
        total_purchases = 0.0
        for w in range(3, -1, -1):
            end_d = today - datetime.timedelta(days=w * 7)
            start_d = end_d - datetime.timedelta(days=6)
            s_str = start_d.strftime("%Y-%m-%d")
            e_str = end_d.strftime("%Y-%m-%d")

            # Check DailyEntries in this week
            de_entries = db.query(DailyEntry).filter(
                DailyEntry.user_id == user_id, DailyEntry.date >= s_str, DailyEntry.date <= e_str
            ).all()

            if de_entries:
                w_sales = sum(de.total_revenue for de in de_entries)
                w_purchases = sum(de.total_cogs + de.total_expenses for de in de_entries)
                w_profit = sum(de.net_profit for de in de_entries)
            else:
                w_sales = db.query(func.sum(Sale.amount)).filter(
                    Sale.user_id == user_id, Sale.sale_date >= s_str, Sale.sale_date <= e_str
                ).scalar() or 0.0
                w_purchases = db.query(func.sum(Purchase.total_cost)).filter(
                    Purchase.user_id == user_id, Purchase.purchase_date >= s_str, Purchase.purchase_date <= e_str
                ).scalar() or 0.0
                w_profit = w_sales - w_purchases

            total_sales += w_sales
            total_purchases += w_purchases

            chart_data.append({
                "label": f"Wk {4 - w}",
                "date_range": f"{start_d.strftime('%b %d')} - {end_d.strftime('%b %d')}",
                "sales": round(w_sales, 2),
                "purchases": round(w_purchases, 2),
                "profit": round(w_profit, 2)
            })

    else:
        total_sales = 0.0
        total_purchases = 0.0
        for m in range(5, -1, -1):
            d = today - datetime.timedelta(days=m * 30)
            month_prefix = d.strftime("%Y-%m")
            month_label = d.strftime("%b")

            de_entries = db.query(DailyEntry).filter(
                DailyEntry.user_id == user_id, DailyEntry.date.like(f"{month_prefix}%")
            ).all()

            if de_entries:
                m_sales = sum(de.total_revenue for de in de_entries)
                m_purchases = sum(de.total_cogs + de.total_expenses for de in de_entries)
                m_profit = sum(de.net_profit for de in de_entries)
            else:
                m_sales = db.query(func.sum(Sale.amount)).filter(
                    Sale.user_id == user_id, Sale.sale_date.like(f"{month_prefix}%")
                ).scalar() or 0.0
                m_purchases = db.query(func.sum(Purchase.total_cost)).filter(
                    Purchase.user_id == user_id, Purchase.purchase_date.like(f"{month_prefix}%")
                ).scalar() or 0.0
                m_profit = m_sales - m_purchases

            total_sales += m_sales
            total_purchases += m_purchases

            chart_data.append({
                "label": month_label,
                "month": month_prefix,
                "sales": round(m_sales, 2),
                "purchases": round(m_purchases, 2),
                "profit": round(m_profit, 2)
            })

    net_profit = total_sales - total_purchases
    profit_margin_pct = round((net_profit / total_sales * 100), 1) if total_sales > 0 else 0.0

    # Aggregate top selling items from BOTH DailyEntryItem and Sale
    item_stats: Dict[int, Dict[str, float]] = {}

    # 1. From DailyEntryItem
    daily_items = db.query(DailyEntryItem).join(DailyEntry).filter(
        DailyEntry.user_id == user_id
    ).all()
    for di in daily_items:
        if di.item_id not in item_stats:
            item_stats[di.item_id] = {"total_qty": 0.0, "total_revenue": 0.0}
        item_stats[di.item_id]["total_qty"] += di.quantity_sold
        item_stats[di.item_id]["total_revenue"] += di.item_revenue

    # 2. From standalone Sales
    sales_items = db.query(
        Sale.item_id,
        func.sum(Sale.quantity).label("qty"),
        func.sum(Sale.amount).label("rev")
    ).filter(Sale.user_id == user_id).group_by(Sale.item_id).all()
    for si in sales_items:
        if si.item_id not in item_stats:
            item_stats[si.item_id] = {"total_qty": 0.0, "total_revenue": 0.0}
        item_stats[si.item_id]["total_qty"] += float(si.qty or 0)
        item_stats[si.item_id]["total_revenue"] += float(si.rev or 0)

    # Sort by total revenue descending
    sorted_items = sorted(item_stats.items(), key=lambda x: x[1]["total_revenue"], reverse=True)[:5]

    top_selling = []
    for item_id, stats in sorted_items:
        if stats["total_revenue"] <= 0 and stats["total_qty"] <= 0:
            continue
        item = get_item_by_id(db, item_id)
        if item:
            top_selling.append({
                "item_id": item.id,
                "name_en": item.name_en,
                "name_ta": item.name_ta,
                "total_qty": round(stats["total_qty"], 1),
                "unit": item.default_unit,
                "total_revenue": round(stats["total_revenue"], 2),
                "icon": item.icon,
                "color": item.color
            })

    return {
        "period": period,
        "total_sales": round(total_sales, 2),
        "total_revenue": round(total_sales, 2),
        "total_purchases": round(total_purchases, 2),
        "net_profit": round(net_profit, 2),
        "profit_margin_pct": profit_margin_pct,
        "chart_data": chart_data,
        "top_selling_items": top_selling
    }
