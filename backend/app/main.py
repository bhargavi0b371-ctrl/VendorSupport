from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base, SessionLocal
from .seed_data import seed_database
from .routers import (
    sales, purchases, reports, pricing, markets, voice, sync, items,
    onboarding, daily_sales, market_intelligence, price_prediction
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()
    yield

app = FastAPI(
    title="VendorVoice API",
    description="Voice-First Mobile Backend for Street Vendors in India (Tamil & English)",
    version="2.0.0",
    lifespan=lifespan
)

# Enable CORS for React Native / Expo web and mobile clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all route modules
app.include_router(onboarding.router)
app.include_router(daily_sales.router)
app.include_router(sales.router)
app.include_router(purchases.router)
app.include_router(reports.router)
app.include_router(pricing.router)
app.include_router(markets.router)
app.include_router(voice.router)
app.include_router(sync.router)
app.include_router(items.router)
app.include_router(market_intelligence.router)
app.include_router(price_prediction.router)

@app.get("/")
def root():
    return {
        "app": "VendorVoice API",
        "version": "2.0.0",
        "status": "online",
        "description": "Voice-First street vendor sales, profit tracking, onboarding, and smart pricing engine",
        "languages": ["Tamil (தமிழ்)", "English"],
        "docs_url": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
