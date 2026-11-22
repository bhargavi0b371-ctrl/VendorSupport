import re
import datetime
from typing import Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from .models import Item, MarketPrice, Market, Sale, Purchase, Festival, User
from .schemas import VoiceParseResponse
from .pricing_engine import calculate_smart_pricing, rank_markets_for_item
from .crud import get_today_summary, get_last_sale, delete_sale

# Tamil number words mapping
TAMIL_NUMBERS = {
    "அரை": 0.5,
    "கால்": 0.25,
    "முக்கால்": 0.75,
    "ஒன்னு": 1.0,
    "ஒன்று": 1.0,
    "ரெண்டு": 2.0,
    "இரண்டு": 2.0,
    "மூணு": 3.0,
    "மூன்று": 3.0,
    "நாலு": 4.0,
    "நான்கு": 4.0,
    "அஞ்சு": 5.0,
    "ஐந்து": 5.0,
    "ஆறு": 6.0,
    "ஏழு": 7.0,
    "எட்டு": 8.0,
    "ஒன்பது": 9.0,
    "பத்து": 10.0,
    "பதினைந்து": 15.0,
    "பதினஞ்சு": 15.0,
    "இருபது": 20.0,
    "இருபத்தைந்து": 25.0,
    "முப்பது": 30.0,
    "நாற்பது": 40.0,
    "ஐம்பது": 50.0,
    "நூறு": 100.0,
}

ENGLISH_NUMBERS = {
    "half": 0.5,
    "quarter": 0.25,
    "one": 1.0,
    "two": 2.0,
    "three": 3.0,
    "four": 4.0,
    "five": 5.0,
    "six": 6.0,
    "seven": 7.0,
    "eight": 8.0,
    "nine": 9.0,
    "ten": 10.0,
    "fifteen": 15.0,
    "twenty": 20.0,
    "twenty five": 25.0,
    "thirty": 30.0,
    "forty": 40.0,
    "fifty": 50.0,
    "hundred": 100.0,
}

# Item keyword dictionaries
ITEM_SYNONYMS = {
    1: ["tomato", "tomatoes", "thakkali", "தக்காளி"],
    2: ["onion", "onions", "vengayam", "venkaayam", "வெங்காயம்", "சின்ன வெங்காயம்", "பெரிய வெங்காயம்"],
    3: ["potato", "potatoes", "urulai", "urulaikizhangu", "உருளைக்கிழங்கு", "உருளை"],
    4: ["jasmine", "jasmine flower", "malli", "malligai", "malligaipoo", "மல்லிகை", "மல்லிகைப்பூ", "மல்லி"],
    5: ["marigold", "samanthi", "saamanthi", "சாமந்தி", "சாமந்திப்பூ"],
    6: ["banana", "bananas", "vazhaipazham", "vaazhai", "வாழைப்பழம்", "வாழை"],
    7: ["apple", "apples", "aappil", "ஆப்பிள்"],
    8: ["chilli", "green chilli", "chilies", "milagai", "pachai milagai", "பச்சை மிளகாய்", "மிளகாய்"],
    9: ["ginger", "inji", "இஞ்சி"],
    10: ["coriander", "kothamalli", "kotthamalli", "கொத்தமல்லி", "மல்லித்தழை"]
}

def extract_item(text: str) -> Optional[int]:
    """Finds matching item ID from text."""
    lower_text = text.lower()
    for item_id, syns in ITEM_SYNONYMS.items():
        for syn in syns:
            # Word boundary matching for short words or direct inclusion for tamil
            if any(ord(c) > 127 for c in syn):
                if syn in lower_text:
                    return item_id
            else:
                pattern = r'\b' + re.escape(syn) + r'\b'
                if re.search(pattern, lower_text):
                    return item_id
    return None

def extract_quantity_and_unit(text: str) -> Tuple[float, str]:
    """Extracts quantity and unit (kg, bunch, etc.)."""
    lower = text.lower()
    qty = 1.0
    unit = "kg"

    # Check for unit
    if any(u in lower for u in ["bunch", "bunches", "kattu", "கட்டு", "கொத்து"]):
        unit = "bunch"
    elif any(u in lower for u in ["gram", "grams", "gm", "gms", "கிராம்"]):
        unit = "gram"
    elif any(u in lower for u in ["muzham", "முழம்", "piece", "pieces", "எண்ணிக்கை"]):
        unit = "bunch"
    else:
        unit = "kg"

    # Check for Tamil numbers
    for word, val in TAMIL_NUMBERS.items():
        if word in lower:
            qty = val
            break
    else:
        # Check for English number words
        for word, val in ENGLISH_NUMBERS.items():
            pattern = r'\b' + re.escape(word) + r'\b'
            if re.search(pattern, lower):
                qty = val
                break
        else:
            # Check for numeric pattern like "3 kg", "2.5", "1/2"
            num_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:kg|kilo|கிலோ|கிராம்|gm|bunch|கட்டு)?', lower)
            if num_match:
                try:
                    qty = float(num_match.group(1))
                except ValueError:
                    qty = 1.0

    return qty, unit

def extract_amount(text: str) -> Optional[float]:
    """Extracts money/rupees amount from text."""
    lower = text.lower()

    # Look for patterns like "90 rupees", "90 rs", "for 90", "₹90", "90 ரூபாய்க்கு", "90 ரூபாய்"
    patterns = [
        r'(?:ரூ|rs\.?|inr|₹)\s*(\d+(?:\.\d+)?)',
        r'(\d+(?:\.\d+)?)\s*(?:ரூபாய்|ரூபாய்க்கு|ரூபா|ரூ)',
        r'(\d+(?:\.\d+)?)\s*(?:rupees|rupee|rs|bucks)',
        r'(?:for|cost|price|மதிப்பு)\s*(\d+(?:\.\d+)?)',
    ]

    for pat in patterns:
        m = re.search(pat, lower)
        if m:
            return float(m.group(1))

    # If two numbers in text and second number > first, typically quantity and price
    all_nums = re.findall(r'\b\d+(?:\.\d+)?\b', lower)
    if len(all_nums) >= 2:
        return float(all_nums[-1])

    return None

def parse_voice_command(db: Session, text: str, user_id: int = 1) -> VoiceParseResponse:
    """
    Parses voice text into structured command and spoken confirmation.
    """
    raw = text.strip()
    lower = raw.lower()

    # 1. UNDO COMMAND
    if any(k in lower for k in ["undo", "cancel", "வேண்டாம்", "திரும்பப் பெறு", "கேன்சல்", "ரத்து"]):
        last_s = get_last_sale(db, user_id)
        if last_s:
            return VoiceParseResponse(
                action="undo",
                item_id=last_s.item_id,
                spoken_confirmation_en=f"Last sale of {last_s.quantity} {last_s.unit} for ₹{last_s.amount:.0f} was cancelled.",
                spoken_confirmation_ta=f"கடைசி விற்பனை (₹{last_s.amount:.0f}) ரத்து செய்யப்பட்டது.",
                raw_text=raw,
                can_execute=True
            )
        else:
            return VoiceParseResponse(
                action="undo",
                spoken_confirmation_en="No recent sales to undo.",
                spoken_confirmation_ta="ரத்து செய்ய எந்த விற்பனையும் இல்லை.",
                raw_text=raw,
                can_execute=False
            )

    # 2. QUERY PROFIT COMMAND
    if any(k in lower for k in ["profit", "my profit", "earnings", "income", "லாபம்", "வருமானம்", "இன்னைக்கு லாபம்", "இன்றைய லாபம்"]):
        today_data = get_today_summary(db, user_id)
        net = today_data["net_profit"]
        sales = today_data["total_sales"]
        purchases = today_data["total_purchases"]

        return VoiceParseResponse(
            action="query_profit",
            spoken_confirmation_en=f"Today's total sales: ₹{sales:.0f}, Purchases: ₹{purchases:.0f}. Your net profit is ₹{net:.0f}.",
            spoken_confirmation_ta=f"இன்றைய விற்பனை ₹{sales:.0f}, வாங்கியது ₹{purchases:.0f}. உங்கள் நிகர லாபம் ₹{net:.0f}.",
            raw_text=raw,
            can_execute=True
        )

    # 3. QUERY WHERE TO BUY COMMAND
    if any(k in lower for k in ["where to buy", "which market", "where to purchase", "best market", "எங்கே வாங்கலாம்", "எங்கு மலிவு", "எந்த சந்தை", "சந்தை எங்கே"]):
        item_id = extract_item(raw) or 1
        item = db.query(Item).filter(Item.id == item_id).first()
        rankings = rank_markets_for_item(db, item_id)
        best = rankings[0] if rankings else None

        if best and item:
            return VoiceParseResponse(
                action="query_market",
                item_id=item_id,
                item_name_en=item.name_en,
                item_name_ta=item.name_ta,
                spoken_confirmation_en=f"Best market for {item.name_en} is {best.name_en} at ₹{best.wholesale_price:.0f} per {item.default_unit}.",
                spoken_confirmation_ta=f"{item.name_ta} வாங்க சிறந்த சந்தை {best.name_ta}. மொத்த விலை ₹{best.wholesale_price:.0f}.",
                raw_text=raw,
                can_execute=True
            )

    # 4. QUERY BEST PRICE / SUGGESTED PRICE
    if any(k in lower for k in ["best price", "rate", "cost", "today price", "what is price", "விலை", "ரேட்", "என்ன விலை", "விலை சொல்லு"]):
        item_id = extract_item(raw) or 1
        item = db.query(Item).filter(Item.id == item_id).first()
        pricings = calculate_smart_pricing(db, user_id)
        matched = next((p for p in pricings if p.item_id == item_id), None)

        if matched and item:
            fest_note_en = f" with {matched.festival_tag}" if matched.festival_tag else ""
            fest_note_ta = f" ({matched.festival_tag})" if matched.festival_tag else ""
            return VoiceParseResponse(
                action="query_price",
                item_id=item_id,
                item_name_en=item.name_en,
                item_name_ta=item.name_ta,
                spoken_confirmation_en=f"Wholesale price for {item.name_en} is ₹{matched.wholesale_cost:.0f}. Suggested selling price is ₹{matched.suggested_selling_price:.0f}{fest_note_en}.",
                spoken_confirmation_ta=f"{item.name_ta} மொத்த விலை ₹{matched.wholesale_cost:.0f}. விற்க வேண்டிய விலை ₹{matched.suggested_selling_price:.0f}{fest_note_ta}.",
                raw_text=raw,
                can_execute=True
            )

    # 5. RECORD PURCHASE
    if any(k in lower for k in ["bought", "purchase", "purchased", "வாங்கினேன்", "எடுத்தேன்", "வாங்கியது", "கொள்முதல்"]):
        item_id = extract_item(raw)
        qty, unit = extract_quantity_and_unit(raw)
        amount = extract_amount(raw)

        if not item_id:
            item_id = 1
        item = db.query(Item).filter(Item.id == item_id).first()
        item_en = item.name_en if item else "Item"
        item_ta = item.name_ta if item else "பொருள்"

        if not amount:
            # Fallback to wholesale cost * qty
            amount = round(qty * 30.0, 0)

        return VoiceParseResponse(
            action="purchase",
            item_id=item_id,
            item_name_en=item_en,
            item_name_ta=item_ta,
            quantity=qty,
            unit=unit,
            amount=amount,
            spoken_confirmation_en=f"Bought {qty:g} {unit} of {item_en} for ₹{amount:.0f}.",
            spoken_confirmation_ta=f"{qty:g} {unit} {item_ta} ₹{amount:.0f}-க்கு வாங்கப்பட்டது.",
            raw_text=raw,
            can_execute=True
        )

    # 6. RECORD SALE (Default or explicit sale words)
    # e.g., "Sold 3 kg tomato for 90 rupees" / "3 கிலோ தக்காளி 90 ரூபாய்க்கு வித்தேன்"
    item_id = extract_item(raw)
    qty, unit = extract_quantity_and_unit(raw)
    amount = extract_amount(raw)

    if item_id:
        item = db.query(Item).filter(Item.id == item_id).first()
        item_en = item.name_en
        item_ta = item.name_ta
    else:
        # Default to tomato
        item_id = 1
        item = db.query(Item).filter(Item.id == item_id).first()
        item_en = item.name_en if item else "Tomato"
        item_ta = item.name_ta if item else "தக்காளி"

    if not amount:
        # Estimate based on qty
        amount = round(qty * 40.0, 0)

    # Spoken confirmations
    conf_en = f"Recorded sale: {qty:g} {unit} {item_en} for ₹{amount:.0f}."
    conf_ta = f"{qty:g} {unit} {item_ta} ₹{amount:.0f}-க்கு விற்பனை பதிவு செய்யப்பட்டது."

    return VoiceParseResponse(
        action="sale",
        item_id=item_id,
        item_name_en=item_en,
        item_name_ta=item_ta,
        quantity=qty,
        unit=unit,
        amount=amount,
        spoken_confirmation_en=conf_en,
        spoken_confirmation_ta=conf_ta,
        raw_text=raw,
        can_execute=True
    )
