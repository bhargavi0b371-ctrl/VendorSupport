# VendorVoice (வெண்டார் வாய்ஸ்)
### Voice-First Mobile & Web App for Indian Street Vendors (Tamil & English)

VendorVoice is an accessible, offline-first mobile assistant designed specifically for vegetable, fruit, and flower street vendors across India. It features large touch targets, high visual contrast, minimal text, and a bilingual voice interface supporting spoken Tamil (தமிழ்) and English.

---

## 🌟 Key Features

1. **Voice-First Sales & Purchases Recording**:
   - Speak naturally: *"Sold 3 kg tomato for 90 rupees"* or Tamil *"3 கிலோ தக்காளி 90 ரூபாய்க்கு வித்தேன்"*.
   - Automatic intent and entity extraction: `{action, item, quantity, unit, amount}`.
   - Spoken audio confirmation for every action with instant 1-tap **Undo** option.
2. **Offline-First Resilience**:
   - Saves all transactions locally in local SQLite/AsyncStorage storage with client-generated UUIDs (`sync_id`).
   - Automatically synchronizes queued transactions when an internet connection returns.
3. **Daily Net Profit Tracking**:
   - $\text{Profit} = \text{Total Sales} - \text{Total Purchase Cost}$.
   - Live profit card (vibrant green if profitable, high-contrast red if loss).
   - Tap-to-speak profit: *"Today's sales: ₹1,310, purchases: ₹850, net profit: ₹460"*.
4. **Smart Pricing Engine**:
   - $\text{Suggested Price} = \text{Wholesale Cost} \times (1 + \text{Margin \%}) \times (1 + \text{Festival Uplift \%})$.
   - Item-specific festival multipliers (e.g. *Pongal Harvest +15%*, *Diwali puja flowers +50%*).
   - Price trend indicators (arrow up/down/stable vs yesterday's mandi rate).
   - Manual wholesale price override option if Agmarknet is unavailable.
5. **Where to Buy (Mandi Ranking)**:
   - Evaluates nearby wholesale markets (e.g., Koyambedu, Madhavaram, Kothawal Chavadi).
   - Ranks mandis by **Total Landed Cost**:
     $$\text{Landed Cost per kg} = \text{Wholesale Price} + \frac{\text{Distance (km)} \times \text{Transport Cost per km}}{\text{Batch Quantity (25 kg)}}$$
   - Highlights the **#1 Best Deal** and includes one-tap Google Maps navigation links.
6. **Accessible Low-Literacy UI**:
   - Extra-large touch targets (minimum 56–84px height).
   - Visual icon grid with high-contrast color badges and emojis for all items.
   - Dual-language Tamil & English toggle anywhere with one tap.

---

## 📁 Project Structure

```
VendorSupport/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI application, CORS, Lifespan startup
│   │   ├── database.py          # SQLite database connection & SessionLocal
│   │   ├── models.py            # 7 SQLAlchemy tables (users, items, markets, etc.)
│   │   ├── schemas.py           # Pydantic schemas for requests & responses
│   │   ├── crud.py              # Database operations & profit aggregations
│   │   ├── pricing_engine.py    # Smart pricing & mandi ranking algorithm
│   │   ├── voice_parser.py      # Bilingual Tamil & English voice intent parser
│   │   ├── market_scraper.py    # Agmarknet / data.gov.in price fetcher & fallback
│   │   ├── seed_data.py         # Seeds 10 items, 3 markets, 5 festivals, sample records
│   │   └── routers/
│   │       ├── sales.py         # POST sale, GET today-summary, POST undo-last
│   │       ├── purchases.py     # POST purchase, GET purchase history
│   │       ├── reports.py       # Daily (7d), weekly (4w), monthly (6m) reports
│   │       ├── pricing.py       # Smart pricing suggestions & manual price override
│   │       ├── markets.py       # Where to buy ranking & Agmarknet sync
│   │       ├── voice.py         # Voice parsing & execute endpoint
│   │       ├── sync.py          # Offline batch push & bootstrap sync
│   │       └── items.py         # Item catalog & user settings
│   ├── tests/
│   │   ├── test_api.py          # Full API test suite
│   │   ├── test_voice_parser.py # Voice command parser verification
│   │   └── test_routers_direct.py # 100% direct router test verification
│   ├── requirements.txt
│   └── run_backend.py
├── frontend/
│   ├── package.json
│   ├── app.json
│   ├── App.js                   # Root navigator & accessible bottom nav bar
│   ├── index.js                 # Expo entry point
│   ├── src/
│   │   ├── api/
│   │   │   └── client.js        # API client with offline fallback & sync queue
│   │   ├── db/
│   │   │   └── localDb.js       # Local storage & offline queue manager
│   │   ├── context/
│   │   │   ├── LanguageContext.js # Tamil / English dictionary provider
│   │   │   └── SyncContext.js     # Online/offline detector & auto-sync
│   │   ├── hooks/
│   │   │   └── useVoice.js      # Speech-to-text & Expo-Speech TTS feedback
│   │   ├── constants/
│   │   │   ├── theme.js         # Accessible high-contrast color palette
│   │   │   └── translations.js  # English & Tamil dictionaries
│   │   ├── components/
│   │   │   ├── Header.js        # Top bar with language toggle & sync pill
│   │   │   ├── BigButton.js     # Accessible large touch button
│   │   │   └── QuickItemGrid.js # Visual item selector grid
│   │   └── screens/
│   │       ├── HomeScreen.js        # Big mic button, sales, profit, price alerts
│   │       ├── VoiceEntryScreen.js  # Voice listening, parsed JSON card, confirm/undo
│   │       ├── PurchasesScreen.js   # Buying cost per item (voice or manual)
│   │       ├── ReportsScreen.js     # Daily/weekly/monthly charts & profit breakdown
│   │       ├── SmartPricingScreen.js# Today's wholesale, suggested price, festival tag
│   │       ├── WhereToBuyScreen.js  # Nearby markets ranked by price & distance
│   │       └── SettingsScreen.js    # Language switch, items catalog, margin %
└── mock_data/
    └── agmarknet_mock_prices.json   # 240 sample Agmarknet mandi market prices
```

---

## 🗄️ Database Tables & Schema

1. **`users`**: Vendor profile, selected language (`ta`/`en`), default target margin percentage.
2. **`items`**: 10 seeded commodities with English & Tamil names, categories, units, and visual colors:
   - Tomato (தக்காளி), Onion (வெங்காயம்), Potato (உருளைக்கிழங்கு), Jasmine Flower (மல்லிகைப்பூ), Marigold (சாமந்திப்பூ), Banana (வாழைப்பழம்), Apple (ஆப்பிள்), Green Chilli (பச்சை மிளகாய்), Ginger (இஞ்சி), Coriander (கொத்தமல்லி).
3. **`markets`**: 3 major wholesale markets with coordinates, distance, and transport rates:
   - Koyambedu Wholesale Market (கோயம்பேடு மொத்த சந்தை) - 4.5 km
   - Madhavaram Wholesale Market (மாதவரம் மொத்த சந்தை) - 9.8 km
   - Kothawal Chavadi Market (கொத்தவால் சாவடி) - 13.2 km
4. **`market_prices`**: Daily wholesale modal, min, and max prices from Agmarknet / data.gov.in.
5. **`festivals`**: 5 South Indian festivals with item-specific demand uplift multipliers:
   - Pongal Harvest Festival (பொங்கல்) - Jan (+15% to +45%)
   - Diwali (தீபாவளி) - Oct/Nov (+35% to +60%)
   - Ayudha Pooja (ஆயுத பூஜை) - Oct (+35% to +70%)
   - Tamil New Year / Puthandu (தமிழ்ப் புத்தாண்டு) - April (+15% to +35%)
   - Vinayakar Chaturthi (விநாயகர் சதுர்த்தி) - Aug/Sep (+15% to +50%)
6. **`sales`**: Vendor sales transactions with item, quantity, unit, amount in ₹, and `sync_id`.
7. **`purchases`**: Buying costs logged at wholesale mandis with unit cost and market link.

---

## 🚀 Step-by-Step Run Instructions

### 1. Backend Setup & Startup (Python FastAPI)

```bash
# 1. Navigate to the backend directory
cd backend

# 2. Install dependencies (FastAPI, Uvicorn, SQLAlchemy, Pydantic, Httpx)
python -m pip install -r requirements.txt

# 3. Initialize and seed the SQLite database (auto-creates vendorvoice.db with seed data)
python -m backend.app.seed_data

# 4. Start the FastAPI server on port 8000
python run_backend.py
# Or directly with uvicorn:
# uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```
The backend API is accessible at:
- API Base: `http://localhost:8000`
- Interactive Swagger Documentation: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/`

### 2. Run Backend Verification Tests

```bash
# Runs full test suite verifying all 10 API endpoints and business logic
python -m backend.tests.test_routers_direct

# Runs voice parser unit test with Tamil and English speech test cases
python -m backend.tests.test_voice_parser
```

### 3. Frontend Setup & Startup (React Native Expo SDK 58 for Expo Go)

The frontend is upgraded to **Expo SDK 58** (`expo@~58.0.26`, `react-native@0.88.1`, `react@19.3.0`), providing native compatibility with the latest version of the **Expo Go** mobile app on Android & iOS.

```bash
# 1. Navigate to the frontend directory
cd frontend

# 2. Start the Expo development server
npm start
# Or for web browser preview:
# npm run web
```

#### How to view on your mobile phone with Expo Go:
1. Open the **Expo Go** app on your Android phone or iPhone.
2. Scan the QR code displayed in the terminal.
3. The app loads directly onto your physical device with microphone access, local offline storage, and text-to-speech audio in Tamil & English!

---

## 🎙️ Supported Voice Commands (Tamil & English)

| Action | English Phrase | Tamil Phrase (தமிழ்) |
|---|---|---|
| **Record Sale** | *"Sold 3 kg tomato for 90 rupees"* | *"3 கிலோ தக்காளி 90 ரூபாய்க்கு வித்தேன்"* |
| **Record Sale (Quick)** | *"Tomato 2 kg 80 rs"* | *"2 கிலோ தக்காளி 80 ரூபாய்"* |
| **Record Purchase** | *"Bought 20 kg onion for 500 rupees"* | *"20 கிலோ வெங்காயம் 500 ரூபாய்க்கு வாங்கினேன்"* |
| **Check Today's Profit** | *"What is my profit today?"* | *"இன்னைக்கு லாபம் என்ன?"* |
| **Check Best Price** | *"Best price for onion"* | *"வெங்காயம் நல்ல விலை என்ன?"* |
| **Find Where to Buy** | *"Where to buy tomato?"* | *"தக்காளி எங்கே வாங்கலாம்?"* |
| **Undo Last Action** | *"Undo"* / *"Cancel"* | *"திரும்பப் பெறு"* / *"ரத்து செய்"* |
