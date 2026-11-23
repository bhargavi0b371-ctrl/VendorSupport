from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from backend.app.crud import create_custom_item, get_items
from backend.app.database import Base
from backend.app.models import Item, User, VendorProduct
from backend.app.schemas import ItemCreate


def create_test_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    return engine, Session(engine)


def test_catalog_returns_one_row_per_product_name():
    engine, db = create_test_session()
    try:
        db.add_all([
            Item(name_en="Sugarcane", name_ta="கரும்பு", category="other"),
            Item(name_en=" sugarcane ", name_ta="கரும்பு", category="other"),
            Item(name_en="Rose Milk", name_ta="ரோஸ் மில்க்", category="street_food"),
            Item(name_en="rose milk", name_ta="ரோஸ் மில்க்", category="street_food"),
        ])
        db.commit()

        names = [item.name_en.strip().casefold() for item in get_items(db)]

        assert names.count("sugarcane") == 1
        assert names.count("rose milk") == 1
    finally:
        db.close()
        engine.dispose()


def test_readding_custom_item_reuses_vendor_item():
    engine, db = create_test_session()
    try:
        db.add(User(id=1, name="Vendor"))
        db.commit()
        product = ItemCreate(
            name_en="Rose Milk",
            name_ta="ரோஸ் மில்க்",
            category="street_food",
            default_unit="cup",
        )

        first = create_custom_item(db, product, user_id=1)
        second = create_custom_item(
            db,
            product.model_copy(update={"name_en": " rose milk "}),
            user_id=1,
        )

        assert first.id == second.id
        assert db.query(Item).filter(Item.vendor_id == 1, Item.is_custom == True).count() == 1
        assert db.query(VendorProduct).filter(
            VendorProduct.user_id == 1,
            VendorProduct.item_id == first.id,
        ).count() == 1
    finally:
        db.close()
        engine.dispose()
