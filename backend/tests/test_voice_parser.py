from backend.app.database import SessionLocal
from backend.app.voice_parser import parse_voice_command

def run_tests():
    db = SessionLocal()
    test_cases = [
        "Sold 3 kg tomato for 90 rupees",
        "3 கிலோ தக்காளி 90 ரூபாய்க்கு வித்தேன்",
        "Bought 20 kg onion for 500 rupees",
        "20 கிலோ வெங்காயம் 500 ரூபாய்க்கு வாங்கினேன்",
        "what is my profit today",
        "இன்னைக்கு லாபம் என்ன",
        "best price for onion",
        "where to buy tomato",
        "undo"
    ]

    print("--- RUNNING VOICE PARSER TESTS ---")
    for text in test_cases:
        res = parse_voice_command(db, text)
        print(f"\nINPUT: {text}")
        print(f"ACTION: {res.action}")
        print(f"ITEM: {res.item_name_en} / {res.item_name_ta} (ID: {res.item_id})")
        print(f"QTY & UNIT: {res.quantity} {res.unit} | AMOUNT: ₹{res.amount}")
        print(f"EN CONFIRMATION: {res.spoken_confirmation_en}")
        print(f"TA CONFIRMATION: {res.spoken_confirmation_ta}")

    db.close()

if __name__ == "__main__":
    run_tests()
