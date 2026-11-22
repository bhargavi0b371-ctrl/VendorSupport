from fastapi.testclient import TestClient
from backend.app.main import app

def run_all():
    print("Testing API endpoints with TestClient...")
    with TestClient(app) as client:
        # 1. Root
        res = client.get("/")
        assert res.status_code == 200, f"Root failed: {res.text}"
        assert res.json()["app"] == "VendorVoice API"
        print(" [PASS] Root endpoint")

        # 2. Items
        res = client.get("/api/items")
        assert res.status_code == 200, f"Items failed: {res.text}"
        items = res.json()
        assert len(items) >= 10
        names = [it["name_en"] for it in items]
        assert "Tomato" in names
        assert "Onion" in names
        print(f" [PASS] Items endpoint ({len(items)} items)")

        # 3. Create Sale & Summary & Undo
        payload = {
            "user_id": 1,
            "item_id": 1,
            "quantity": 3.0,
            "unit": "kg",
            "amount": 120.0,
            "voice_raw_text": "Sold 3 kg tomato for 120 rupees"
        }
        res = client.post("/api/sales", json=payload)
        assert res.status_code == 200, f"Sale create failed: {res.text}"
        data = res.json()
        sale_id = data["id"]
        assert data["amount"] == 120.0
        assert data["unit_price"] == 40.0
        print(f" [PASS] Create sale (id: {sale_id})")

        sum_res = client.get("/api/sales/today-summary")
        assert sum_res.status_code == 200
        assert sum_res.json()["total_sales"] > 0
        print(" [PASS] Today summary")

        undo_res = client.post("/api/sales/undo-last")
        assert undo_res.status_code == 200
        assert undo_res.json()["deleted_sale_id"] == sale_id
        print(" [PASS] Undo last sale")

        # 4. Purchases
        p_res = client.post("/api/purchases", json={
            "user_id": 1,
            "item_id": 2,
            "market_id": 1,
            "quantity": 10.0,
            "unit": "kg",
            "total_cost": 340.0
        })
        assert p_res.status_code == 200
        assert p_res.json()["unit_cost"] == 34.0
        print(" [PASS] Purchases endpoint")

        # 5. Reports
        for p in ["daily", "weekly", "monthly"]:
            rep_res = client.get(f"/api/reports?period={p}")
            assert rep_res.status_code == 200
            assert "total_sales" in rep_res.json()
            assert "net_profit" in rep_res.json()
        print(" [PASS] Reports endpoint (daily, weekly, monthly)")

        # 6. Smart Pricing
        price_res = client.get("/api/pricing")
        assert price_res.status_code == 200
        pricings = price_res.json()
        assert len(pricings) >= 10
        print(f" [PASS] Smart Pricing endpoint ({len(pricings)} pricing entries calculated)")

        # 7. Markets & Where to Buy
        m_res = client.get("/api/markets")
        assert m_res.status_code == 200
        wtb_res = client.get("/api/markets/where-to-buy/1?batch_kg=25")
        assert wtb_res.status_code == 200
        assert wtb_res.json()[0]["is_best_deal"] is True
        print(" [PASS] Markets and 'Where to buy' ranking endpoint")

        # 8. Voice Parse & Execute
        v_res = client.post("/api/voice/parse", json={"text": "3 கிலோ தக்காளி 90 ரூபாய்க்கு வித்தேன்"})
        assert v_res.status_code == 200
        v_data = v_res.json()
        assert v_data["action"] == "sale"
        assert v_data["amount"] == 90.0

        exec_res = client.post("/api/voice/execute", json={
            "action": "sale",
            "item_id": 1,
            "quantity": 2.0,
            "unit": "kg",
            "amount": 80.0,
            "raw_text": "2 kg tomato 80 rs"
        })
        assert exec_res.status_code == 200
        assert exec_res.json()["status"] == "success"
        print(" [PASS] Voice parse and execute endpoints")

        # 9. Offline Batch Sync
        sync_res = client.post("/api/sync", json={
            "sales": [{"user_id": 1, "item_id": 1, "quantity": 2.0, "unit": "kg", "amount": 80.0, "sync_id": "sync-uuid-1"}],
            "purchases": [{"user_id": 1, "item_id": 2, "quantity": 10.0, "unit": "kg", "total_cost": 300.0, "sync_id": "sync-uuid-2"}]
        })
        assert sync_res.status_code == 200
        assert sync_res.json()["synced_sales_count"] == 1
        print(" [PASS] Offline sync endpoint")

        # 10. Settings User
        set_res = client.put("/api/settings/user", json={"default_margin_pct": 25.0, "language": "ta"})
        assert set_res.status_code == 200
        assert set_res.json()["default_margin_pct"] == 25.0
        print(" [PASS] User settings update endpoint")

    print("\nALL 10 API TEST SUITES PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_all()
