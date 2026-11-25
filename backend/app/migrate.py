import sqlite3
import os

def migrate_db():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    db_path = os.path.join(base_dir, "vendorvoice.db")

    if not os.path.exists(db_path):
        return

    con = sqlite3.connect(db_path)
    cur = con.cursor()

    # Check users table columns
    cur.execute("PRAGMA table_info(users)")
    cols = [col[1] for col in cur.fetchall()]

    if "onboarding_completed" not in cols:
        print("Migrating users: adding onboarding_completed...")
        cur.execute("ALTER TABLE users ADD COLUMN onboarding_completed BOOLEAN DEFAULT 0")

    if "selected_categories" not in cols:
        print("Migrating users: adding selected_categories...")
        cur.execute("ALTER TABLE users ADD COLUMN selected_categories TEXT DEFAULT '[]'")

    if "shop_name" not in cols:
        print("Migrating users: adding shop_name...")
        cur.execute("ALTER TABLE users ADD COLUMN shop_name VARCHAR(150) DEFAULT 'My Shop'")

    if "pin" not in cols:
        print("Migrating users: adding pin...")
        cur.execute("ALTER TABLE users ADD COLUMN pin VARCHAR(20) DEFAULT '1234'")

    if "password_hash" not in cols:
        print("Migrating users: adding password_hash...")
        cur.execute("ALTER TABLE users ADD COLUMN password_hash VARCHAR(200)")

    # Check items table columns
    cur.execute("PRAGMA table_info(items)")
    item_cols = [col[1] for col in cur.fetchall()]

    if "is_custom" not in item_cols:
        print("Migrating items: adding is_custom...")
        cur.execute("ALTER TABLE items ADD COLUMN is_custom BOOLEAN DEFAULT 0")

    if "vendor_id" not in item_cols:
        print("Migrating items: adding vendor_id...")
        cur.execute("ALTER TABLE items ADD COLUMN vendor_id INTEGER")

    con.commit()
    con.close()
    print("Database migration completed!")

if __name__ == "__main__":
    migrate_db()
