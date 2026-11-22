import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database import SessionLocal, Base, engine
from backend.app.seed_data import seed_database
import backend.tests.test_api as test_api

def run():
    print("Initializing test database...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    seed_database(db)
    db.close()

    tests = [
        ("Root Endpoint", test_api.test_root_endpoint),
        ("Items List", test_api.test_items_list),
        ("Sales and Undo", test_api.test_sales_and_undo),
        ("Purchases", test_api.test_purchases),
        ("Reports", test_api.test_reports),
        ("Smart Pricing", test_api.test_smart_pricing),
        ("Markets and Ranking", test_api.test_markets_and_ranking),
        ("Voice Parse and Execute", test_api.test_voice_parse_and_execute),
        ("Offline Sync", test_api.test_offline_sync),
        ("Settings User", test_api.test_settings_user),
    ]

    passed = 0
    for name, fn in tests:
        try:
            fn()
            print(f"[PASS] {name}")
            passed += 1
        except Exception as e:
            print(f"[FAIL] {name}: {e}")
            import traceback
            traceback.print_exc()

    print(f"\nAll tests completed: {passed}/{len(tests)} passed.")
    if passed != len(tests):
        sys.exit(1)

if __name__ == "__main__":
    run()
