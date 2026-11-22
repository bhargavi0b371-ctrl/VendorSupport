from backend.app.database import SessionLocal
from backend.app.crud import get_items, get_today_summary, get_period_report
from backend.app.pricing_engine import calculate_smart_pricing, rank_markets_for_item
from backend.app.voice_parser import parse_voice_command

db = SessionLocal()
items = get_items(db)
print(f"Items count: {len(items)}")
today = get_today_summary(db)
print(f"Today summary: {today}")
pricing = calculate_smart_pricing(db)
print(f"Pricing count: {len(pricing)}, first item: {pricing[0].name_en} -> {pricing[0].suggested_selling_price}")
ranking = rank_markets_for_item(db, 1)
print(f"Rankings count: {len(ranking)}, best: {ranking[0].name_en}")
res = parse_voice_command(db, "Sold 3 kg tomato for 90 rupees")
print(f"Voice result: {res.action}, {res.item_name_en}, {res.amount}")
db.close()
print("All quick checks passed successfully!")
