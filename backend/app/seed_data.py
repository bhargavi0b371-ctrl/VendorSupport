import datetime
import json
import os
from sqlalchemy.orm import Session
from .database import SessionLocal, engine, Base
from .models import User, Item, Market, MarketPrice, Festival, Sale, Purchase, VendorProduct, DailyEntry, DailyEntryItem

# Comprehensive categories with icons and names
CATEGORIES_CATALOG = [
    {"id": "vegetables", "name_en": "Vegetables", "name_ta": "காய்கறிகள்", "icon": "carrot"},
    {"id": "fruits", "name_en": "Fruits", "name_ta": "பழங்கள்", "icon": "food-apple"},
    {"id": "fruits_vegetables", "name_en": "Fruits & Vegetables", "name_ta": "பழங்கள் மற்றும் காய்கறிகள்", "icon": "fruit-grapes"},
    {"id": "flowers", "name_en": "Flowers", "name_ta": "மலர்கள் / பூக்கள்", "icon": "flower"},
    {"id": "street_food", "name_en": "Street Food", "name_ta": "தெருவோர உணவு / தின்பண்டங்கள்", "icon": "food"},
    {"id": "tea_coffee", "name_en": "Tea / Coffee", "name_ta": "டீ / காபி", "icon": "coffee"},
    {"id": "groceries", "name_en": "Groceries", "name_ta": "மளிகை பொருட்கள்", "icon": "basket"},
    {"id": "clothes", "name_en": "Clothes & Accessories", "name_ta": "துணிமணிகள் மற்றும் அணிகலன்கள்", "icon": "tshirt-crew"},
    {"id": "household_items", "name_en": "Household Items", "name_ta": "வீட்டு உபயோக பொருட்கள்", "icon": "home-outline"},
    {"id": "other", "name_en": "Other", "name_ta": "மற்றவை", "icon": "dots-horizontal-circle"}
]

# Rich predefined products across all categories
PREDEFINED_ITEMS = [
    # Vegetables: ["Tomato", "Onion", "Brinjal", "Drumstick", "Okra"]
    {"id": 1, "name_en": "Tomato", "name_ta": "தக்காளி", "category": "vegetables", "default_unit": "kg", "icon": "food-apple", "color": "#E53935"},
    {"id": 2, "name_en": "Onion", "name_ta": "வெங்காயம்", "category": "vegetables", "default_unit": "kg", "icon": "circle-outline", "color": "#8E24AA"},
    {"id": 3, "name_en": "Brinjal", "name_ta": "கத்தரிக்காய்", "category": "vegetables", "default_unit": "kg", "icon": "eggplant", "color": "#5E35B1"},
    {"id": 4, "name_en": "Drumstick", "name_ta": "முருங்கைக்காய்", "category": "vegetables", "default_unit": "kg", "icon": "leaf", "color": "#2E7D32"},
    {"id": 5, "name_en": "Okra", "name_ta": "வெண்டைக்காய்", "category": "vegetables", "default_unit": "kg", "icon": "leaf", "color": "#43A047"},
    {"id": 6, "name_en": "Potato", "name_ta": "உருளைக்கிழங்கு", "category": "vegetables", "default_unit": "kg", "icon": "circle-slice-8", "color": "#BCAAA4"},
    {"id": 7, "name_en": "Carrot", "name_ta": "கேரட்", "category": "vegetables", "default_unit": "kg", "icon": "carrot", "color": "#FB8C00"},
    {"id": 8, "name_en": "Green Chilli", "name_ta": "பச்சை மிளகாய்", "category": "vegetables", "default_unit": "kg", "icon": "chili-mild", "color": "#2E7D32"},
    {"id": 9, "name_en": "Ginger", "name_ta": "இஞ்சி", "category": "vegetables", "default_unit": "kg", "icon": "seed", "color": "#8D6E63"},
    {"id": 10, "name_en": "Coriander", "name_ta": "கொத்தமல்லி", "category": "vegetables", "default_unit": "bunch", "icon": "leaf", "color": "#43A047"},

    # Fruits: ["Banana", "Mango", "Guava", "Papaya", "Sapota"]
    {"id": 11, "name_en": "Banana", "name_ta": "வாழைப்பழம்", "category": "fruits", "default_unit": "dozen", "icon": "fruit-grapes", "color": "#FDD835"},
    {"id": 12, "name_en": "Mango", "name_ta": "மாம்பழம்", "category": "fruits", "default_unit": "kg", "icon": "fruit-cherries", "color": "#FBC02D"},
    {"id": 13, "name_en": "Guava", "name_ta": "கொய்யா", "category": "fruits", "default_unit": "kg", "icon": "circle", "color": "#8BC34A"},
    {"id": 14, "name_en": "Papaya", "name_ta": "பப்பாளி", "category": "fruits", "default_unit": "piece", "icon": "fruit-watermelon", "color": "#FF9800"},
    {"id": 15, "name_en": "Sapota", "name_ta": "சப்போட்டா", "category": "fruits", "default_unit": "kg", "icon": "circle-slice-8", "color": "#795548"},
    {"id": 16, "name_en": "Apple", "name_ta": "ஆப்பிள்", "category": "fruits", "default_unit": "kg", "icon": "food-apple-outline", "color": "#D32F2F"},
    {"id": 17, "name_en": "Orange", "name_ta": "ஆரஞ்சு", "category": "fruits", "default_unit": "kg", "icon": "fruit-citrus", "color": "#FF9800"},
    {"id": 18, "name_en": "Grapes", "name_ta": "திராட்சை", "category": "fruits", "default_unit": "kg", "icon": "fruit-grapes", "color": "#7B1FA2"},
    {"id": 19, "name_en": "Watermelon", "name_ta": "தர்பூசணி", "category": "fruits", "default_unit": "piece", "icon": "fruit-watermelon", "color": "#C2185B"},

    # Flowers: ["Jasmine", "Rose", "Marigold", "Kanakambaram", "Flower Garland"]
    {"id": 20, "name_en": "Jasmine", "name_ta": "மல்லிகைப்பூ", "category": "flowers", "default_unit": "kg", "icon": "flower", "color": "#FFF59D"},
    {"id": 21, "name_en": "Rose", "name_ta": "ரோஜாப்பூ", "category": "flowers", "default_unit": "bunch", "icon": "flower-poppy", "color": "#E91E63"},
    {"id": 22, "name_en": "Marigold", "name_ta": "சாமந்திப்பூ", "category": "flowers", "default_unit": "kg", "icon": "flower-tulip", "color": "#FFA000"},
    {"id": 23, "name_en": "Kanakambaram", "name_ta": "கனகாம்பரம்", "category": "flowers", "default_unit": "kg", "icon": "flower-outline", "color": "#FF5722"},
    {"id": 24, "name_en": "Flower Garland", "name_ta": "பூ மாலை", "category": "flowers", "default_unit": "piece", "icon": "necklace", "color": "#9C27B0"},

    # Street Food: ["Bajji", "Bonda", "Vadai", "Sundal", "Pani Puri"]
    {"id": 25, "name_en": "Bajji", "name_ta": "பஜ்ஜி", "category": "street_food", "default_unit": "piece", "icon": "food", "color": "#E65100"},
    {"id": 26, "name_en": "Bonda", "name_ta": "போண்டா", "category": "street_food", "default_unit": "piece", "icon": "circle", "color": "#FF9800"},
    {"id": 27, "name_en": "Vadai", "name_ta": "வடை", "category": "street_food", "default_unit": "piece", "icon": "circle-slice-8", "color": "#D84315"},
    {"id": 28, "name_en": "Sundal", "name_ta": "சுண்டல்", "category": "street_food", "default_unit": "cup", "icon": "bowl-mix", "color": "#8D6E63"},
    {"id": 29, "name_en": "Pani Puri", "name_ta": "பானி பூரி", "category": "street_food", "default_unit": "plate", "icon": "bowl-mix", "color": "#43A047"},
    {"id": 30, "name_en": "Samosa", "name_ta": "சமோசா", "category": "street_food", "default_unit": "piece", "icon": "triangle", "color": "#FFB300"},

    # TeaCoffee: ["Tea", "Filter Coffee", "Ginger Tea", "Sukku Coffee", "Badam Milk"]
    {"id": 31, "name_en": "Tea", "name_ta": "டீ", "category": "tea_coffee", "default_unit": "cup", "icon": "tea", "color": "#795548"},
    {"id": 32, "name_en": "Filter Coffee", "name_ta": "பில்டர் காபி", "category": "tea_coffee", "default_unit": "cup", "icon": "coffee", "color": "#6D4C41"},
    {"id": 33, "name_en": "Ginger Tea", "name_ta": "இஞ்சி டீ", "category": "tea_coffee", "default_unit": "cup", "icon": "cup-water", "color": "#A1887F"},
    {"id": 34, "name_en": "Sukku Coffee", "name_ta": "சுக்கு காபி", "category": "tea_coffee", "default_unit": "cup", "icon": "coffee-outline", "color": "#5D4037"},
    {"id": 35, "name_en": "Badam Milk", "name_ta": "பாதாம் பால்", "category": "tea_coffee", "default_unit": "cup", "icon": "cup", "color": "#FFE082"},

    # Groceries: ["Rice", "Dal", "Sugar", "Cooking Oil", "Tamarind", "Biscuit"]
    {"id": 36, "name_en": "Rice", "name_ta": "அரிசி", "category": "groceries", "default_unit": "kg", "icon": "grain", "color": "#F5F5F5"},
    {"id": 37, "name_en": "Dal", "name_ta": "பருப்பு", "category": "groceries", "default_unit": "kg", "icon": "seed", "color": "#FBC02D"},
    {"id": 38, "name_en": "Sugar", "name_ta": "சர்க்கரை", "category": "groceries", "default_unit": "kg", "icon": "cube-outline", "color": "#ECEFF1"},
    {"id": 39, "name_en": "Cooking Oil", "name_ta": "சமையல் எண்ணெய்", "category": "groceries", "default_unit": "litre", "icon": "bottle-tonic", "color": "#FFC107"},
    {"id": 40, "name_en": "Tamarind", "name_ta": "புளி", "category": "groceries", "default_unit": "kg", "icon": "seed-outline", "color": "#4E342E"},
    {"id": 50, "name_en": "Biscuit", "name_ta": "பிஸ்கட்", "category": "groceries", "default_unit": "packet", "icon": "cookie", "color": "#D7CCC8"},

    # Clothes: ["Saree", "Nighty", "Lungi", "Leggings", "Bangles"]
    {"id": 41, "name_en": "Saree", "name_ta": "சேலை", "category": "clothes", "default_unit": "piece", "icon": "tshirt-crew", "color": "#C2185B"},
    {"id": 42, "name_en": "Nighty", "name_ta": "நைட்டி", "category": "clothes", "default_unit": "piece", "icon": "tshirt-v", "color": "#8E24AA"},
    {"id": 43, "name_en": "Lungi", "name_ta": "லுங்கி", "category": "clothes", "default_unit": "piece", "icon": "hanger", "color": "#388E3C"},
    {"id": 44, "name_en": "Leggings", "name_ta": "லெக்கின்ஸ்", "category": "clothes", "default_unit": "piece", "icon": "tshirt-crew", "color": "#00897B"},
    {"id": 45, "name_en": "Bangles", "name_ta": "வளையல்கள்", "category": "clothes", "default_unit": "set", "icon": "circle-outline", "color": "#FFB300"},

    # Household Items: ["Broom", "Bucket", "Candle", "Agarbatti"]
    {"id": 51, "name_en": "Broom", "name_ta": "துடைப்பம்", "category": "household_items", "default_unit": "piece", "icon": "broom", "color": "#795548"},
    {"id": 52, "name_en": "Bucket", "name_ta": "வாளி", "category": "household_items", "default_unit": "piece", "icon": "bucket", "color": "#1976D2"},
    {"id": 53, "name_en": "Candle", "name_ta": "மெழுகுவர்த்தி", "category": "household_items", "default_unit": "packet", "icon": "candle", "color": "#FBC02D"},
    {"id": 54, "name_en": "Agarbatti", "name_ta": "ஊதுபத்தி", "category": "household_items", "default_unit": "packet", "icon": "flare", "color": "#F57C00"},

    # Other
    {"id": 46, "name_en": "Coconut", "name_ta": "தேங்காய்", "category": "other", "default_unit": "piece", "icon": "circle", "color": "#8D6E63"},
    {"id": 47, "name_en": "Lemon", "name_ta": "எலுமிச்சம்பழம்", "category": "other", "default_unit": "piece", "icon": "fruit-citrus", "color": "#FFEB3B"},
    {"id": 48, "name_en": "Betel Leaves", "name_ta": "வெற்றிலை", "category": "other", "default_unit": "bunch", "icon": "leaf", "color": "#2E7D32"}
]

def seed_database(db: Session = None):
    should_close = False
    if db is None:
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        should_close = True

    try:
        # 1. User
        user = db.query(User).filter(User.id == 1).first()
        if not user:
            user = User(
                id=1,
                name="Murugan (முருகன்)",
                phone="9876543210",
                language="ta",
                default_margin_pct=25.0,
                onboarding_completed=True,
                selected_categories=json.dumps(["vegetables", "fruits", "flowers"]),
                created_at=datetime.datetime.now(datetime.timezone.utc)
            )
            db.add(user)
            db.commit()

        # 2. Predefined Items
        for it in PREDEFINED_ITEMS:
            existing = db.query(Item).filter(
                Item.name_en.ilike(it["name_en"])
            ).first()
            if not existing:
                new_item = Item(
                    name_en=it["name_en"],
                    name_ta=it["name_ta"],
                    category=it["category"],
                    default_unit=it["default_unit"],
                    icon=it["icon"],
                    color=it["color"],
                    is_active=True,
                    is_custom=False
                )
                db.add(new_item)
            else:
                existing.category = it["category"]
                existing.name_ta = it["name_ta"]
                existing.default_unit = it["default_unit"]
                existing.icon = it["icon"]
                existing.color = it["color"]
                existing.is_active = True
        db.commit()

        # 3. Vendor Products Mapping for User 1
        # If user has no vendor products linked, link the core vegetable/fruit/flower items
        if db.query(VendorProduct).filter(VendorProduct.user_id == 1).count() == 0:
            default_item_ids = [1, 2, 3, 4, 5, 6, 9, 10, 14, 15]
            for i_id in default_item_ids:
                db.add(VendorProduct(user_id=1, item_id=i_id, is_active=True))
            db.commit()

        # 4. Markets
        if db.query(Market).count() == 0:
            markets_data = [
                Market(id=1, name_en="Koyambedu Wholesale Market", name_ta="கோயம்பேடு மொத்த சந்தை", location="Koyambedu, Chennai", distance_km=4.5, transport_cost_per_km=15.0, map_url="https://maps.google.com/?q=Koyambedu+Wholesale+Market+Complex+Chennai", opening_hours="03:00 AM - 11:00 AM"),
                Market(id=2, name_en="Madhavaram Wholesale Market", name_ta="மாதவரம் மொத்த சந்தை", location="Madhavaram, Chennai", distance_km=9.8, transport_cost_per_km=15.0, map_url="https://maps.google.com/?q=Madhavaram+Market+Chennai", opening_hours="04:00 AM - 12:00 PM"),
                Market(id=3, name_en="Kothawal Chavadi Market", name_ta="கொத்தவால் சாவடி சந்தை", location="George Town, Chennai", distance_km=13.2, transport_cost_per_km=18.0, map_url="https://maps.google.com/?q=Kothawal+Chavadi+Chennai", opening_hours="02:30 AM - 10:30 AM")
            ]
            db.add_all(markets_data)
            db.commit()

        # 5. Festivals
        today_date = datetime.date.today()
        current_year = today_date.year

        if db.query(Festival).count() == 0:
            festivals_data = [
                Festival(id=1, name_en="Pongal Harvest Festival", name_ta="தை பொங்கல் திருவிழா", start_date=f"{current_year}-01-13", end_date=f"{current_year}-01-17", description_en="High demand for bananas, sugarcane, turmeric, flowers, and vegetables.", description_ta="கரும்பு, வாழை, மஞ்சள், பூக்கள் மற்றும் காய்கறிகளுக்கு அதிக தேவை.", affected_items_json=json.dumps({"items": {"1": 15, "9": 30, "14": 45, "15": 40}, "categories": {"flowers": 40, "fruits": 25, "vegetables": 15}})),
                Festival(id=2, name_en="Diwali Festival of Lights", name_ta="தீபாவளி பண்டிகை", start_date=f"{current_year}-10-28", end_date=f"{current_year}-11-03", description_en="Huge flower and fruit puja demand across all temples and homes.", description_ta="பூக்கள், பழங்கள் மற்றும் பூஜை பொருட்களுக்கு உச்சகட்ட தேவை.", affected_items_json=json.dumps({"items": {"14": 60, "15": 50, "9": 35, "10": 40}, "categories": {"flowers": 55, "fruits": 35}})),
                Festival(id=3, name_en="Ayudha Pooja & Vijayadashami", name_ta="ஆயுத பூஜை மற்றும் விஜயதசமி", start_date=f"{current_year}-10-09", end_date=f"{current_year}-10-13", description_en="Maximum demand for yellow marigold, jasmine, bananas, apples, and lemons.", description_ta="சாமந்தி, மல்லிகை, வாழைப்பழம் மற்றும் பழங்களுக்கு பெரும் தேவை.", affected_items_json=json.dumps({"items": {"14": 70, "15": 65, "9": 40, "33": 50}, "categories": {"flowers": 65, "fruits": 35}})),
                Festival(id=4, name_en="Tamil New Year (Puthandu)", name_ta="தமிழ்ப் புத்தாண்டு", start_date=f"{current_year}-04-12", end_date=f"{current_year}-04-16", description_en="Fresh mangoes, bananas, neem flowers, and vegetables.", description_ta="காய்கறிகள், வாழை மற்றும் பூக்களுக்கு சிறப்பு மங்கல தேவை.", affected_items_json=json.dumps({"items": {"1": 20, "12": 35, "14": 35, "9": 30}, "categories": {"flowers": 35, "fruits": 25, "vegetables": 15}})),
                Festival(id=5, name_en="Vinayakar Chaturthi", name_ta="விநாயகர் சதுர்த்தி", start_date=f"{current_year}-08-28", end_date=f"{current_year}-09-02", description_en="Flowers, durva grass, fruits, and bananas for modak offerings.", description_ta="விநாயகர் வழிபாட்டிற்கு மலர்கள் மற்றும் பழங்களுக்கு கிராக்கி.", affected_items_json=json.dumps({"items": {"14": 50, "15": 45, "9": 35, "6": 20}, "categories": {"flowers": 45, "fruits": 30}}))
            ]
            db.add_all(festivals_data)
            db.commit()

        # 6. Sample Daily Entry with Multi-Products, Expenses, and Payments
        today_str = today_date.strftime("%Y-%m-%d")
        yesterday_str = (today_date - datetime.timedelta(days=1)).strftime("%Y-%m-%d")

        if db.query(DailyEntry).count() == 0:
            # Sample Daily Entry for Today
            de_today = DailyEntry(
                user_id=1,
                date=today_str,
                expense_transport=60.0,
                expense_rent=100.0,
                expense_packaging=25.0,
                expense_other=15.0,
                total_expenses=200.0,
                payment_cash=920.0,
                payment_upi=650.0,
                payment_digital_other=0.0,
                payment_credit_pending=80.0,
                total_revenue=1650.0,
                total_cogs=1120.0,
                gross_profit=530.0,
                net_profit=330.0,
                total_unsold_value=240.0,
                total_wastage_loss=50.0,
                profit_margin_pct=20.0,
                notes="Morning market sales"
            )
            db.add(de_today)
            db.commit()
            db.refresh(de_today)

            # Add products for today's entry
            items_today = [
                DailyEntryItem(
                    daily_entry_id=de_today.id,
                    item_id=1, # Tomato
                    quantity_sold=25.0,
                    selling_price_per_unit=40.0,
                    purchase_cost_per_unit=28.0,
                    unsold_quantity=4.0,
                    damaged_quantity=1.0,
                    item_revenue=1000.0,
                    item_cogs=700.0,
                    item_gross_profit=300.0,
                    wastage_loss=28.0,
                    unsold_stock_value=112.0
                ),
                DailyEntryItem(
                    daily_entry_id=de_today.id,
                    item_id=2, # Onion
                    quantity_sold=10.0,
                    selling_price_per_unit=45.0,
                    purchase_cost_per_unit=34.0,
                    unsold_quantity=3.0,
                    damaged_quantity=0.0,
                    item_revenue=450.0,
                    item_cogs=340.0,
                    item_gross_profit=110.0,
                    wastage_loss=0.0,
                    unsold_stock_value=102.0
                ),
                DailyEntryItem(
                    daily_entry_id=de_today.id,
                    item_id=14, # Jasmine
                    quantity_sold=0.4,
                    selling_price_per_unit=500.0,
                    purchase_cost_per_unit=320.0,
                    unsold_quantity=0.1,
                    damaged_quantity=0.05,
                    item_revenue=200.0,
                    item_cogs=128.0,
                    item_gross_profit=72.0,
                    wastage_loss=16.0,
                    unsold_stock_value=32.0
                )
            ]
            db.add_all(items_today)
            db.commit()

        # 7. Seed Market Prices for all items
        if db.query(MarketPrice).count() == 0:
            prices_to_add = []
            for day_offset in range(7, -1, -1):
                cur_d = (today_date - datetime.timedelta(days=day_offset)).strftime("%Y-%m-%d")
                for it in PREDEFINED_ITEMS[:16]:
                    base_p = 30.0 + (it["id"] % 5) * 8.0
                    for m_id in [1, 2, 3]:
                        daily_p = round(base_p * (1.0 + (day_offset % 3 - 1) * 0.04), 1)
                        prices_to_add.append(MarketPrice(
                            item_id=it["id"],
                            market_id=m_id,
                            date=cur_d,
                            modal_price=daily_p,
                            min_price=round(daily_p * 0.9, 1),
                            max_price=round(daily_p * 1.15, 1),
                            source="agmarknet"
                        ))
            db.add_all(prices_to_add)
            db.commit()

    finally:
        if should_close:
            db.close()

if __name__ == "__main__":
    seed_database()
