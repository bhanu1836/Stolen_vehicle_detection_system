import os
from datetime import datetime, timezone

from passlib.context import CryptContext
from pymongo import MongoClient

MONGODB_URI = os.getenv(
    "MONGODB_URI",
    "mongodb+srv://bhanu:1234@nodeexpress.vkh6d.mongodb.net/stolen_vehicle_portal?appName=nodeExpress",
)
MONGODB_DB = os.getenv("MONGODB_DB", "stolen_vehicle_portal")

ADMIN_EMAIL = os.getenv("ADMIN_SEED_EMAIL", "r210389@rguktrkv.ac.in").lower()
ADMIN_PASSWORD = os.getenv("ADMIN_SEED_PASSWORD", "admin@123")
POLICE_EMAIL = os.getenv("POLICE_SEED_EMAIL", "police@gmail.com").lower()
POLICE_PASSWORD = os.getenv("POLICE_SEED_PASSWORD", "police@123")

pwd_context = CryptContext(schemes=["pbkdf2_sha256", "bcrypt"], deprecated="auto")


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def upsert_staff(db, email: str, password: str, role: str, full_name: str) -> None:
    users_col = db["users"]
    password_hash = pwd_context.hash(password)
    users_col.update_one(
        {"email": email},
        {
            "$set": {
                "full_name": full_name,
                "email": email,
                "role": role,
                "is_active": True,
                "password_hash": password_hash,
                "updated_at": now_utc(),
            },
            "$setOnInsert": {
                "phone": "",
                "created_at": now_utc(),
            },
        },
        upsert=True,
    )


def run() -> None:
    if not MONGODB_URI:
        raise RuntimeError("MONGODB_URI is required. Set it to your MongoDB Atlas connection string.")

    client = MongoClient(MONGODB_URI)
    db = client[MONGODB_DB]
    users_col = db["users"]

    users_col.create_index("email", unique=True)
    users_col.create_index("role")

    upsert_staff(db, ADMIN_EMAIL, ADMIN_PASSWORD, "admin", "Portal Admin")
    upsert_staff(db, POLICE_EMAIL, POLICE_PASSWORD, "police", "Assigned Police")

    print("Staff users seeded successfully.")


if __name__ == "__main__":
    run()
