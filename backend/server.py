from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, Header, UploadFile, File
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
import uuid
import random
import bcrypt
import jwt
import requests
import hmac
import hashlib
import razorpay
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Annotated
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)


# MongoDB setup - try real MongoDB first, fallback to mongomock with async wrapper
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'pizo')
print("ADMIN_TOKEN from env:", os.getenv("ADMIN_TOKEN"))

import asyncio

# Async wrappers to expose Motor-like async methods for a sync mongomock DB
class AsyncCursorWrapper:
    def __init__(self, cursor):
        self._cursor = cursor

    def sort(self, *args, **kwargs):
        try:
            self._cursor = self._cursor.sort(*args, **kwargs)
        except Exception:
            pass
        return self

    async def to_list(self, length=None):
        def collect():
            try:
                if length:
                    return list(self._cursor.limit(length))
                return list(self._cursor)
            except Exception:
                return list(self._cursor)
        return await asyncio.to_thread(collect)

class AsyncCollectionWrapper:
    def __init__(self, coll):
        self._coll = coll

    def find(self, *args, **kwargs):
        return AsyncCursorWrapper(self._coll.find(*args, **kwargs))

    async def find_one(self, *args, **kwargs):
        return await asyncio.to_thread(self._coll.find_one, *args, **kwargs)

    async def insert_many(self, docs):
        return await asyncio.to_thread(self._coll.insert_many, docs)

    async def insert_one(self, doc):
        return await asyncio.to_thread(self._coll.insert_one, doc)

    async def count_documents(self, filter):
        return await asyncio.to_thread(self._coll.count_documents, filter)

    async def update_one(self, *args, **kwargs):
        return await asyncio.to_thread(self._coll.update_one, *args, **kwargs)

    async def delete_many(self, *args, **kwargs):
        return await asyncio.to_thread(self._coll.delete_many, *args, **kwargs)

class AsyncDBWrapper:
    def __init__(self, sync_db):
        self._db = sync_db

    def __getattr__(self, name):
        return AsyncCollectionWrapper(self._db[name])

    def __getitem__(self, name):
        return AsyncCollectionWrapper(self._db[name])

try:
    from motor.motor_asyncio import AsyncIOMotorClient
    from pymongo import MongoClient as SyncMongoClient
    client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=2000)
    # Synchronously test connectivity with pymongo to detect offline MongoDB
    try:
        sync_test = SyncMongoClient(mongo_url, serverSelectionTimeoutMS=2000)
        sync_test.admin.command('ping')
        db = client[db_name]
        logging.info(f"Using real MongoDB at {mongo_url}")
        using_mock = False
    except Exception as conn_err:
        logging.warning(f"MongoDB ping failed ({conn_err}), falling back to mongomock")
        raise conn_err
except Exception:
    logging.warning("Using mongomock with async adapter")
    try:
        from mongomock import MongoClient
        sync_client = MongoClient()
        db = AsyncDBWrapper(sync_client[db_name])
        using_mock = True
    except Exception as mock_err:
        logging.error(f"Mongomock also failed: {mock_err}")
        raise
JWT_SECRET = os.environ.get('JWT_SECRET', 'pizo-super-secret-key-change-in-prod')
JWT_ALGO = 'HS256'
EMERGENT_AUTH_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

RAZORPAY_KEY_ID = os.environ.get('RAZORPAY_KEY_ID', '')
RAZORPAY_KEY_SECRET = os.environ.get('RAZORPAY_KEY_SECRET', '')
rzp_client = None
if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:
    rzp_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

app = FastAPI(title="PIZO API")
api_router = APIRouter(prefix="/api")


# ---------- Models ----------
def now_utc():
    return datetime.now(timezone.utc)

def iso(dt: datetime) -> str:
    return dt.isoformat()

class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: Optional[str] = "user"  # user or owner

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    name: str
    email: str
    role: str = "user"
    picture: Optional[str] = None
    auth_provider: str = "jwt"  # jwt or google
    owner_onboarded: bool = False
    wallet_balance: int = 0
    created_at: str

class VenueIn(BaseModel):
    name: str
    category: str
    city: str
    address: str
    price_per_hour: int
    rating: float = 4.5
    image: str
    images: List[str] = []
    amenities: List[str] = []
    description: str = ""
    owner_id: Optional[str] = None
    verified: bool = False
    reschedule_allowed: bool = True

class Venue(VenueIn):
    venue_id: str
    created_at: str

class BookingIn(BaseModel):
    venue_id: str
    date: str
    slot: str
    num_players: Optional[int] = 1
    coupons: Optional[List[str]] = []
    use_wallet: Optional[bool] = False
    payment_order_id: Optional[str] = None
    payment_id: Optional[str] = None

class BookingOrderIn(BaseModel):
    venue_id: str
    date: str
    slot: str
    num_players: Optional[int] = 1
    coupons: Optional[List[str]] = []
    use_wallet: Optional[bool] = False

class Booking(BaseModel):
    booking_id: str
    user_id: str
    venue_id: str
    venue_name: str
    date: str
    slot: str
    status: str = "confirmed"
    num_players: int = 1
    base_price: int = 0
    discount_pct: int = 0
    final_total: int = 0
    wallet_used: int = 0
    per_player: int = 0
    applied_coupons: List[str] = []
    share_token: str = ""
    qr_code: str = ""
    checked_in: bool = False
    refund_status: str = "none"
    refund_amount: int = 0
    refund_mode: Optional[str] = None
    refund_requested_at: Optional[str] = None
    refund_requested_reason: Optional[str] = None
    refund_admin: Optional[str] = None
    refund_processed_at: Optional[str] = None
    refund_processed_mode: Optional[str] = None
    message: Optional[str] = None
    created_at: str

class BookingRefundIn(BaseModel):
    amount: Optional[int] = None
    mode: str = "wallet"
    reason: Optional[str] = None

class AdminRefundActionIn(BaseModel):
    action: str
    mode: Optional[str] = None
    note: Optional[str] = None

class EventIn(BaseModel):
    title: str
    description: str
    date: str
    location: str
    category: str  # tournament, college, gaming, social
    image: str
    highlights: List[str] = []

class Event(EventIn):
    event_id: str
    created_at: str

class CreatorIn(BaseModel):
    name: str
    handle: str
    avatar: str
    bio: str
    category: str  # face, model, gamer, creator
    engagement: int = 0
    consistency: int = 0
    quality: int = 0

class Creator(CreatorIn):
    creator_id: str
    points: int = 0
    badges: List[str] = []
    rank: int = 0
    created_at: str

class SubscriptionIn(BaseModel):
    plan_id: str  # student, family, premium
    upi_id: str

class Subscription(BaseModel):
    subscription_id: str
    user_id: str
    plan_id: str
    plan_name: str
    amount: int
    status: str  # pending, active
    upi_ref: str
    starts_at: str
    expires_at: str
    created_at: str

class ContactIn(BaseModel):
    name: str
    email: EmailStr
    message: str

# ---------- Auth helpers ----------
def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def make_jwt(user_id: str) -> str:
    payload = {"user_id": user_id, "exp": datetime.now(timezone.utc) + timedelta(hours=8)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

async def send_notification(user_id: Optional[str], venue_id: Optional[str], title: str, message: str, channel: str = "system"):
    doc = {
        "notification_id": f"notif_{uuid.uuid4().hex[:10]}",
        "user_id": user_id,
        "venue_id": venue_id,
        "title": title,
        "message": message,
        "channel": channel,
        "read": False,
        "created_at": iso(now_utc()),
    }
    await db.notifications.insert_one(doc)
    logger.info(f"NOTIFICATION [{channel}] user={user_id} venue={venue_id}: {title} - {message}")
    return doc

async def credit_wallet(user_id: str, amount: int, reason: str):
    if amount <= 0:
        return 0
    await db.users.update_one({"user_id": user_id}, {"$inc": {"wallet_balance": amount}})
    await db.wallet_transactions.insert_one({
        "transaction_id": f"wtx_{uuid.uuid4().hex[:10]}",
        "user_id": user_id,
        "amount": amount,
        "reason": reason,
        "created_at": iso(now_utc()),
    })
    return amount

async def calculate_booking_amount(venue: dict, body: BookingIn, user_doc: dict, consume_scratch: bool = True):
    base_price = int(venue.get("price_per_hour", 0))
    num_players = max(1, int(getattr(body, "num_players", 1) or 1))
    coupons = list(getattr(body, "coupons", []) or [])[:1]
    discount_pct = 0
    applied = []
    user_booking_count = await db.bookings.count_documents({"user_id": user_doc["user_id"], "status": "confirmed"})
    sub = await db.subscriptions.find_one({"user_id": user_doc["user_id"], "status": "active"})
    plan_id = sub["plan_id"] if sub else None
    pass_discount_map = {"premium": 12, "family": 10, "student": 8}
    if plan_id in pass_discount_map:
        discount_pct += pass_discount_map[plan_id]
        applied.append(f"PASS-{plan_id.upper()}")
    for code in coupons:
        c = code.upper().strip()
        if c == "FIRST10" and user_booking_count == 0 and base_price > 100:
            discount_pct += 10; applied.append("FIRST10")
        elif c == "LOYAL15" and user_booking_count >= 5:
            discount_pct += 15; applied.append("LOYAL15")
        elif c.startswith("SCRATCH-"):
            sc = await db.scratch_cards.find_one({"code": c, "user_id": user_doc["user_id"], "used": False})
            if sc:
                discount_pct += int(sc["discount_pct"])
                applied.append(c)
                if consume_scratch:
                    await db.scratch_cards.update_one({"_id": sc["_id"]}, {"$set": {"used": True}})
        elif c.startswith("CR-"):
            creator = await db.creators.find_one({"referral_code": c})
            if creator:
                discount_pct += 5; applied.append(c)
                await db.creators.update_one({"creator_id": creator["creator_id"]}, {"$inc": {"engagement": 5}})
    discount_pct = min(discount_pct, 40)
    final_total = int(base_price * (100 - discount_pct) / 100)
    wallet_balance = int(user_doc.get("wallet_balance", 0) or 0)
    wallet_used = 0
    if getattr(body, "use_wallet", False) and wallet_balance > 0:
        wallet_used = min(wallet_balance, final_total)
        final_total -= wallet_used
    per_player = int(round((base_price - (base_price * discount_pct / 100)) / num_players))
    return {
        "base_price": base_price,
        "num_players": num_players,
        "discount_pct": discount_pct,
        "final_total": final_total,
        "per_player": per_player,
        "applied_coupons": applied,
        "wallet_used": wallet_used,
    }

async def create_booking_record(body: BookingIn, user: User, payment_order_id: Optional[str] = None, payment_id: Optional[str] = None):
    venue = await db.venues.find_one({"venue_id": body.venue_id}, {"_id": 0})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    bdate = None
    try:
        from datetime import date as _d
        bdate = _d.fromisoformat(body.date)
        days_ahead = (bdate - now_utc().date()).days
        sub = await db.subscriptions.find_one({"user_id": user.user_id, "status": "active"})
        plan_id = sub["plan_id"] if sub else None
        max_days = 14 if plan_id in ("premium", "family", "student") else 7
        if days_ahead > max_days:
            raise HTTPException(status_code=403, detail=f"{'Pass holders' if plan_id else 'Normal users'} can only book up to {max_days} days ahead. Upgrade for more.")
    except HTTPException:
        raise
    except Exception:
        pass
    conflict = await db.bookings.find_one({"venue_id": body.venue_id, "date": body.date, "slot": body.slot, "status": {"$ne": "cancelled"}})
    if conflict:
        raise HTTPException(status_code=409, detail="Slot already booked. Pick another time.")
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    pricing = await calculate_booking_amount(venue, body, user_doc)
    if pricing["final_total"] > 0 and not payment_id:
        raise HTTPException(status_code=402, detail="Payment required before booking.")
    if payment_id and pricing["wallet_used"] > 0:
        await db.users.update_one({"user_id": user.user_id}, {"$inc": {"wallet_balance": -pricing["wallet_used"]}})
    elif pricing["wallet_used"] > 0 and pricing["final_total"] == 0:
        await db.users.update_one({"user_id": user.user_id}, {"$inc": {"wallet_balance": -pricing["wallet_used"]}})
    booking_id = f"bk_{uuid.uuid4().hex[:10]}"
    qr_code = f"QR-{uuid.uuid4().hex[:10].upper()}"
    doc = {
        "booking_id": booking_id,
        "user_id": user.user_id,
        "venue_id": body.venue_id,
        "venue_name": venue["name"],
        "date": body.date,
        "slot": body.slot,
        "status": "confirmed",
        "num_players": pricing["num_players"],
        "base_price": pricing["base_price"],
        "discount_pct": pricing["discount_pct"],
        "final_total": pricing["final_total"],
        "per_player": pricing["per_player"],
        "applied_coupons": pricing["applied_coupons"],
        "wallet_used": pricing["wallet_used"],
        "share_token": uuid.uuid4().hex[:8],
        "qr_code": qr_code,
        "checked_in": False,
        "refund_status": "none",
        "refund_amount": 0,
        "message": f"Booking confirmed. Booking ID {booking_id}. QR code: {qr_code}.",
        "payment_order_id": payment_order_id,
        "payment_id": payment_id,
        "created_at": iso(now_utc()),
    }
    await db.bookings.insert_one(doc)
    await send_notification(user.user_id, venue["venue_id"], "Booking Confirmed", f"Your booking {booking_id} for {venue['name']} is confirmed.")
    await send_notification(None, venue["venue_id"], "New Booking", f"Venue {venue['name']} has a new booking {booking_id}.")
    confirmed_bookings = await db.bookings.count_documents({"user_id": user.user_id, "status": "confirmed"})
    if confirmed_bookings > 0 and confirmed_bookings % 5 == 0:
        scratch_code = f"SCRATCH-{uuid.uuid4().hex[:8].upper()}"
        scratch_pct = random.choice([10, 15, 20])
        await db.scratch_cards.insert_one({
            "code": scratch_code,
            "user_id": user.user_id,
            "discount_pct": scratch_pct,
            "used": False,
            "revealed": False,
            "created_at": iso(now_utc()),
        })
        await send_notification(user.user_id, venue["venue_id"], "Scratch card unlocked!", f"You earned a scratch card for {scratch_pct}% off on your next booking. Reveal it from your dashboard.")
    doc.pop("_id", None)
    return Booking(**{k: v for k, v in doc.items() if k in Booking.model_fields})

async def current_user(
    request: Request,
    authorization: Optional[str] = Header(None),
) -> Optional[User]:
    # Try cookie (Emergent Google Auth session_token) first
    session_token = request.cookies.get("session_token")
    if session_token:
        sess = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
        if sess:
            expires_at = sess.get("expires_at")
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at)
            if expires_at and expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at and expires_at >= now_utc():
                u = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0})
                if u:
                    return User(**u)
    # Try Bearer JWT (custom auth)
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1]
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
            u = await db.users.find_one({"user_id": payload["user_id"]}, {"_id": 0})
            if u:
                return User(**u)
        except Exception:
            pass
    return None

async def require_user(request: Request, authorization: Optional[str] = Header(None)) -> User:
    u = await current_user(request, authorization)
    if not u:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return u

# ---------- Auth endpoints ----------
@api_router.post("/auth/register")
async def register(body: RegisterIn):
    existing = await db.users.find_one({"email": body.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    doc = {
        "user_id": user_id,
        "name": body.name,
        "email": body.email,
        "role": body.role or "user",
        "picture": None,
        "auth_provider": "jwt",
        "password_hash": hash_pw(body.password),
        "created_at": iso(now_utc()),
    }
    await db.users.insert_one(doc)
    token = make_jwt(user_id)
    return {"token": token, "user": {k: v for k, v in doc.items() if k not in ("password_hash", "_id")}}

@api_router.post("/auth/login")
async def login(body: LoginIn):
    u = await db.users.find_one({"email": body.email})
    if not u or not u.get("password_hash") or not verify_pw(body.password, u["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = make_jwt(u["user_id"])
    u.pop("_id", None)
    u.pop("password_hash", None)
    return {"token": token, "user": u}

@api_router.post("/auth/google/session")
async def google_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    try:
        r = requests.get(EMERGENT_AUTH_URL, headers={"X-Session-ID": session_id}, timeout=10)
        if r.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session")
        data = r.json()
    except requests.RequestException:
        raise HTTPException(status_code=502, detail="Auth provider unreachable")

    email = data["email"]
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": data.get("name"), "picture": data.get("picture")}},
        )
        user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_doc = {
            "user_id": user_id,
            "name": data.get("name", email.split("@")[0]),
            "email": email,
            "role": "user",
            "picture": data.get("picture"),
            "auth_provider": "google",
            "created_at": iso(now_utc()),
        }
        await db.users.insert_one(user_doc)

    expires_at = now_utc() + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": data["session_token"],
        "expires_at": expires_at,
        "created_at": now_utc(),
    })
    response.set_cookie(
        key="session_token",
        value=data["session_token"],
        max_age=7 * 24 * 60 * 60,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
    )
    user_doc.pop("password_hash", None)
    return {"user": user_doc}

@api_router.get("/auth/me")
async def me(request: Request, authorization: Optional[str] = Header(None)):
    u = await current_user(request, authorization)
    if not u:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return u.model_dump()

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_many({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}

# ---------- Owners ----------
OWNER_ONBOARD_FEE = 149

class OwnerOnboardIn(BaseModel):
    upi_id: str

@api_router.post("/owners/onboard")
async def owner_onboard(body: OwnerOnboardIn, user: User = Depends(require_user)):
    if user.owner_onboarded:
        u = await db.users.find_one({"user_id": user.user_id}, {"_id": 0, "password_hash": 0})
        return {"already_onboarded": True, "user": u, "amount": OWNER_ONBOARD_FEE}
    upi_ref = f"PIZO-OWN-{uuid.uuid4().hex[:8].upper()}"
    await db.owner_payments.insert_one({
        "payment_id": f"op_{uuid.uuid4().hex[:10]}",
        "user_id": user.user_id,
        "amount": OWNER_ONBOARD_FEE,
        "upi_id": body.upi_id,
        "upi_ref": upi_ref,
        "status": "paid",
        "created_at": iso(now_utc()),
    })
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {"owner_onboarded": True, "role": "owner"}},
    )
    u = await db.users.find_one({"user_id": user.user_id}, {"_id": 0, "password_hash": 0})
    return {"ok": True, "amount": OWNER_ONBOARD_FEE, "upi_ref": upi_ref, "user": u}

@api_router.get("/owners/status")
async def owner_status(user: User = Depends(require_user)):
    return {"owner_onboarded": user.owner_onboarded, "role": user.role, "fee": OWNER_ONBOARD_FEE}


# ---------- Owner features: sponsor events, notifications, venue edits, badges, messaging ----------
class SponsorEventIn(BaseModel):
    name: str
    phone: str
    address: str
    interest_type: str

class VenueEditIn(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    price_per_hour: Optional[int] = None
    rating: Optional[float] = None
    image: Optional[str] = None
    images: Optional[List[str]] = None
    amenities: Optional[List[str]] = None
    description: Optional[str] = None
    verified: Optional[bool] = None

class SlotToggleIn(BaseModel):
    date: str
    slot: str

@api_router.post("/owner/sponsor-events")
async def create_sponsor_event(body: SponsorEventIn, user: User = Depends(require_user)):
    doc = body.model_dump()
    doc.update({"owner_id": user.user_id, "created_at": iso(now_utc())})
    await db.sponsor_events.insert_one(doc)
    return {"ok": True}

@api_router.get("/owner/sponsor-events")
async def list_sponsor_events(user: User = Depends(require_user)):
    docs = await db.sponsor_events.find({"owner_id": user.user_id}, {"_id": 0}).to_list(100)
    return docs

@api_router.get("/owner/notifications")
async def owner_notifications(user: User = Depends(require_user)):
    venues = await db.venues.find({"owner_id": user.user_id}, {"venue_id": 1, "_id": 0}).to_list(200)
    venue_ids = [v["venue_id"] for v in venues]
    docs = await db.notifications.find({"venue_id": {"$in": venue_ids}}, {"_id": 0}).to_list(200)
    return docs

@api_router.post("/owner/notifications/mark-read")
async def mark_notification_read(notification_id: str, user: User = Depends(require_user)):
    await db.notifications.update_one({"notification_id": notification_id, "user_id": user.user_id}, {"$set": {"read": True}})
    return {"ok": True}

@api_router.get("/notifications/me")
async def my_notifications(user: User = Depends(require_user)):
    docs = await db.notifications.find({"user_id": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return docs

@api_router.post("/notifications/mark-read")
async def mark_my_notification(notification_id: str, user: User = Depends(require_user)):
    await db.notifications.update_one({"notification_id": notification_id, "user_id": user.user_id}, {"$set": {"read": True}})
    return {"ok": True}

@api_router.put("/owner/venues/{venue_id}")
async def edit_venue(venue_id: str, body: VenueEditIn, user: User = Depends(require_user)):
    v = await db.venues.find_one({"venue_id": venue_id}, {"_id": 0})
    if not v:
        raise HTTPException(status_code=404, detail="Venue not found")
    if v.get("owner_id") != user.user_id:
        raise HTTPException(status_code=403, detail="Not allowed")
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    if update:
        await db.venues.update_one({"venue_id": venue_id}, {"$set": update})
    updated = await db.venues.find_one({"venue_id": venue_id}, {"_id": 0})
    return updated

@api_router.post("/owner/venues/{venue_id}/slots/toggle")
async def toggle_slot(venue_id: str, body: SlotToggleIn, user: User = Depends(require_user)):
    v = await db.venues.find_one({"venue_id": venue_id}, {"_id": 0})
    if not v:
        raise HTTPException(status_code=404, detail="Venue not found")
    if v.get("owner_id") != user.user_id:
        raise HTTPException(status_code=403, detail="Not allowed")
    disabled = v.get("disabled_slots", [])
    key = {"date": body.date, "slot": body.slot}
    if key in disabled:
        disabled = [d for d in disabled if not (d.get("date")==body.date and d.get("slot")==body.slot)]
        action = "enabled"
    else:
        disabled.append(key)
        action = "disabled"
    await db.venues.update_one({"venue_id": venue_id}, {"$set": {"disabled_slots": disabled}})
    return {"ok": True, "action": action}

# ---------- Staff auth & QR verification ----------
class StaffLoginIn(BaseModel):
    staff_id: str
    password: str

@api_router.post("/staff/login")
async def staff_login(body: StaffLoginIn):
    s = await db.staff.find_one({"staff_id": body.staff_id})
    if not s:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not bcrypt.checkpw(body.password.encode(), s.get("password_hash").encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = uuid.uuid4().hex
    await db.staff_sessions.insert_one({"staff_id": body.staff_id, "token": token, "created_at": iso(now_utc())})
    return {"token": token}

@api_router.post("/staff/verify-qr")
async def staff_verify_qr(booking_id: str, token: Optional[str] = Header(None)):
    # simple token check
    session = await db.staff_sessions.find_one({"token": token})
    if not session:
        raise HTTPException(status_code=401, detail="Unauthorized")
    b = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    await db.bookings.update_one({"booking_id": booking_id}, {"$set": {"status": "verified"}})
    return {"ok": True, "booking": b}

# ---------- Owner-Admin messaging ----------
class MessageIn(BaseModel):
    subject: str
    message: str

@api_router.post("/owner/messages")
async def owner_message(body: MessageIn, user: User = Depends(require_user)):
    msg = body.model_dump()
    msg.update({"from_user": user.user_id, "to": "admin", "replies": [], "created_at": iso(now_utc()), "message_id": f"msg_{uuid.uuid4().hex[:10]}"})
    await db.messages.insert_one(msg)
    return {"ok": True}


@api_router.get("/owner/messages")
async def owner_get_messages(user: User = Depends(require_user)):
    docs = await db.messages.find({"from_user": user.user_id}, {"_id": 0}).to_list(200)
    return docs

@api_router.get("/admin/messages")
async def admin_messages(x_admin_token: str = Header(..., alias="X-Admin-Token")):
    require_admin(x_admin_token)
    docs = await db.messages.find({}, {"_id": 0}).to_list(200)
    return docs

@api_router.get("/admin/refunds")
async def admin_refunds(x_admin_token: str = Header(..., alias="X-Admin-Token")):
    require_admin(x_admin_token)
    docs = await db.bookings.find(
        {"refund_status": {"$in": ["pending", "refunded", "rejected"]}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    return {"refunds": docs}

@api_router.post("/admin/refunds/{booking_id}/process")
async def admin_process_refund(booking_id: str, body: AdminRefundActionIn, x_admin_token: str = Header(..., alias="X-Admin-Token")):
    require_admin(x_admin_token)
    if body.action not in {"approve", "reject"}:
        raise HTTPException(status_code=400, detail="Action must be approve or reject")
    booking = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.get("refund_status") != "pending":
        raise HTTPException(status_code=400, detail="No pending refund to process")

    update = {
        "refund_admin": x_admin_token,
        "refund_admin_note": body.note or "",
        "refund_processed_at": iso(now_utc()),
        "refund_processed_mode": body.mode.lower() if body.mode else booking.get("refund_mode"),
    }
    if body.action == "approve":
        approved_mode = update["refund_processed_mode"] or booking.get("refund_mode") or "upi"
        if approved_mode not in {"wallet", "upi"}:
            raise HTTPException(status_code=400, detail="Invalid refund mode")
        update["refund_status"] = "refunded"
        update["status"] = "cancelled"
        if approved_mode == "wallet":
            await credit_wallet(booking["user_id"], booking["refund_amount"], f"Admin-approved refund for booking {booking_id}")
            await send_notification(booking["user_id"], booking.get("venue_id"), "Refund Completed", f"₹{booking['refund_amount']} credited to wallet for booking {booking_id}.")
        else:
            await send_notification(booking["user_id"], booking.get("venue_id"), "Refund Approved", f"UPI refund for booking {booking_id} has been approved and will be processed in 1-2 working days.")
    else:
        update["refund_status"] = "rejected"
        update["status"] = "confirmed"
        await send_notification(booking["user_id"], booking.get("venue_id"), "Refund Rejected", f"Refund request for booking {booking_id} was rejected by admin.")

    await db.bookings.update_one({"booking_id": booking_id}, {"$set": update})
    return {"ok": True, "refund_status": update["refund_status"], "refund_processed_mode": update["refund_processed_mode"]}


@api_router.get("/admin/sponsor-events")
async def admin_sponsor_events(x_admin_token: str = Header(..., alias="X-Admin-Token")):
    require_admin(x_admin_token)
    docs = await db.sponsor_events.find({}, {"_id": 0}).to_list(500)
    return docs

@api_router.post("/admin/messages/{message_id}/reply")
async def admin_reply(message_id: str, reply: str, x_admin_token: str = Header(..., alias="X-Admin-Token")):
    require_admin(x_admin_token)
    r = {"admin_token": x_admin_token, "reply": reply, "created_at": iso(now_utc())}
    await db.messages.update_one({"message_id": message_id}, {"$push": {"replies": r}})
    return {"ok": True}

# ---------- Badges / Gamification ----------
@api_router.get("/owner/badges")
async def owner_badges(user: User = Depends(require_user)):
    venues = await db.venues.find({"owner_id": user.user_id}, {"venue_id": 1, "name": 1, "_id": 0}).to_list(200)
    venue_ids = [v["venue_id"] for v in venues]
    # compute bookings per venue
    counts = {}
    for vid in venue_ids:
        c = await db.bookings.count_documents({"venue_id": vid})
        counts[vid] = c
    if counts:
        top_vid = max(counts, key=counts.get)
        top_name = next((v["name"] for v in venues if v["venue_id"]==top_vid), top_vid)
        badges = [
            {"badge": "Most Booked Venue", "venue_id": top_vid, "venue_name": top_name, "value": counts[top_vid]},
        ]
    else:
        badges = []
    return {"badges": badges}


@api_router.get("/venues", response_model=List[Venue])
async def list_venues(category: Optional[str] = None, city: Optional[str] = None, sort: Optional[str] = None):
    q = {}
    if category and category != "all":
        q["category"] = category
    if city and city != "all":
        q["city"] = city
    sort_map = {
        "price_asc":  [("price_per_hour", 1)],
        "price_desc": [("price_per_hour", -1)],
        "rating":     [("rating", -1)],
        "newest":     [("created_at", -1)],
    }
    cursor = db.venues.find(q, {"_id": 0})
    if sort in sort_map:
        cursor = cursor.sort(sort_map[sort])
    docs = await cursor.to_list(500)
    # ensure images list always present
    for d in docs:
        if not d.get("images"):
            d["images"] = [d.get("image")] if d.get("image") else []
    return docs

@api_router.post("/venues", response_model=Venue)
async def create_venue(body: VenueIn, user: User = Depends(require_user)):
    if user.role == "owner" and not user.owner_onboarded:
        raise HTTPException(status_code=402, detail="Owner onboarding fee (₹149) required before listing venues.")
    venue_id = f"venue_{uuid.uuid4().hex[:10]}"
    doc = body.model_dump()
    doc.update({"venue_id": venue_id, "created_at": iso(now_utc()), "owner_id": user.user_id})
    await db.venues.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.get("/venues/{venue_id}", response_model=Venue)
async def get_venue(venue_id: str):
    v = await db.venues.find_one({"venue_id": venue_id}, {"_id": 0})
    if not v:
        raise HTTPException(status_code=404, detail="Venue not found")
    return v

# ---------- Bookings ----------
@api_router.post("/bookings", response_model=Booking)
async def create_booking(body: BookingIn, user: User = Depends(require_user)):
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    booking = await create_booking_record(body, user, body.payment_order_id, body.payment_id)
    if booking.wallet_used > 0 and booking.final_total == 0:
        await send_notification(user.user_id, booking.venue_id, "Wallet payment used", f"₹{booking.wallet_used} used from wallet for booking {booking.booking_id}.")
    return booking

@api_router.post("/payments/booking/order")
async def create_booking_order(body: BookingOrderIn, user: User = Depends(require_user)):
    venue = await db.venues.find_one({"venue_id": body.venue_id}, {"_id": 0})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    pricing = await calculate_booking_amount(venue, body, user_doc, consume_scratch=False)
    if pricing["final_total"] <= 0:
        return {"ok": True, "amount": 0, "currency": "INR", "order_id": None}
    if not rzp_client:
        raise HTTPException(503, "Razorpay not configured")
    amount_paise = int(pricing["final_total"]) * 100
    receipt = f"pizo-booking-{uuid.uuid4().hex[:8]}"
    notes = {"user_id": user.user_id, "purpose": "booking", "venue_id": body.venue_id, "date": body.date, "slot": body.slot}
    try:
        order = rzp_client.order.create({
            "amount": amount_paise,
            "currency": "INR",
            "receipt": receipt[:40],
            "payment_capture": 1,
            "notes": notes,
        })
    except Exception as e:
        logger.error(f"Booking order create failed: {e}")
        raise HTTPException(502, "Payment provider error")
    await db.rzp_orders.insert_one({
        "order_id": order["id"],
        "user_id": user.user_id,
        "amount": pricing["final_total"],
        "purpose": "booking",
        "booking_payload": body.model_dump(),
        "status": "created",
        "created_at": iso(now_utc()),
    })
    return {
        "ok": True,
        "order_id": order["id"],
        "amount": order["amount"],
        "currency": order["currency"],
        "key_id": RAZORPAY_KEY_ID,
    }

@api_router.post("/merch/purchase")
async def purchase_merch(body: dict, user: User = Depends(require_user)):
    item_id = body.get("item_id")
    use_wallet = bool(body.get("use_wallet"))
    if not item_id:
        raise HTTPException(status_code=400, detail="Item ID required")
    item = next((m for m in MERCH if m["id"] == item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Merch item not found")
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    price = await get_merch_price(user_doc, item)
    wallet_balance = int(user_doc.get("wallet_balance", 0) or 0)
    if use_wallet and wallet_balance >= price:
        await db.users.update_one({"user_id": user.user_id}, {"$inc": {"wallet_balance": -price}})
        order_doc = {
            "order_id": f"mo_{uuid.uuid4().hex[:10]}",
            "user_id": user.user_id,
            "item_id": item_id,
            "item_name": item["name"],
            "amount": price,
            "payment_type": "wallet",
            "status": "paid",
            "created_at": iso(now_utc()),
        }
        await db.merch_orders.insert_one(order_doc)
        await send_notification(user.user_id, None, "Merch purchased", f"You bought {item['name']} for ₹{price} using wallet.")
        return {"ok": True, "order": order_doc}
    if use_wallet:
        raise HTTPException(status_code=400, detail="Insufficient wallet balance for this item")
    raise HTTPException(status_code=400, detail="Use Razorpay checkout for merch purchase")

@api_router.get("/me/merch/orders")
async def my_merch_orders(user: User = Depends(require_user)):
    orders = await db.merch_orders.find({"user_id": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"orders": orders}

@api_router.post("/bookings/{booking_id}/refund")
async def refund_booking(booking_id: str, body: BookingRefundIn, user: User = Depends(require_user)):
    b = await db.bookings.find_one({"booking_id": booking_id, "user_id": user.user_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    if b.get("status") != "confirmed":
        raise HTTPException(status_code=400, detail="Only confirmed bookings can be refunded")
    if b.get("refund_status") not in ("none", "rejected"):
        raise HTTPException(status_code=400, detail="Refund already requested or processed")
    refund_amount = body.amount or b.get("final_total", 0)
    if refund_amount <= 0 or refund_amount > b.get("final_total", 0):
        raise HTTPException(status_code=400, detail="Invalid refund amount")
    refund_mode = (body.mode or "wallet").lower()
    if refund_mode not in {"wallet", "upi"}:
        raise HTTPException(status_code=400, detail="Refund mode must be 'wallet' or 'upi'")

    update = {
        "refund_amount": refund_amount,
        "refund_mode": refund_mode,
        "refund_requested_at": iso(now_utc()),
        "refund_requested_reason": body.reason or "",
        "refund_requested_by": user.user_id,
        "refund_admin": None,
    }

    if refund_mode == "wallet":
        await credit_wallet(user.user_id, refund_amount, f"Refund for booking {booking_id}")
        update.update({
            "refund_status": "refunded",
            "refund_processed_at": iso(now_utc()),
            "refund_processed_mode": "wallet",
            "status": "cancelled",
        })
        await send_notification(user.user_id, b.get("venue_id"), "Refund Completed", f"₹{refund_amount} credited to your wallet for booking {booking_id}.")
    else:
        update.update({
            "refund_status": "pending",
            "refund_processed_at": None,
            "refund_processed_mode": None,
            "status": "refund_pending",
        })
        await send_notification(user.user_id, b.get("venue_id"), "Refund Requested", f"Refund request for booking {booking_id} is pending admin approval. UPI payout may take 1-2 working days.")

    await db.bookings.update_one({"booking_id": booking_id}, {"$set": update})
    return {
        "ok": True,
        "refund_status": update["refund_status"],
        "refund_mode": refund_mode,
        "refund_amount": refund_amount,
    }

class BookingRescheduleIn(BaseModel):
    date: str
    slot: str

@api_router.post("/bookings/{booking_id}/reschedule")
async def reschedule_booking(booking_id: str, body: BookingRescheduleIn, user: User = Depends(require_user)):
    b = await db.bookings.find_one({"booking_id": booking_id, "user_id": user.user_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    if b.get("status") != "confirmed":
        raise HTTPException(status_code=400, detail="Only confirmed bookings can be rescheduled")
    venue = await db.venues.find_one({"venue_id": b["venue_id"]}, {"_id": 0})
    if not venue or not venue.get("reschedule_allowed", True):
        raise HTTPException(status_code=403, detail="Reschedule not allowed for this venue")
    conflict = await db.bookings.find_one({"venue_id": b["venue_id"], "date": body.date, "slot": body.slot, "status": {"$ne": "cancelled"}})
    if conflict:
        raise HTTPException(status_code=409, detail="New slot already booked")
    await db.bookings.update_one({"booking_id": booking_id}, {"$set": {"date": body.date, "slot": body.slot, "message": f"Rescheduled to {body.date} {body.slot}. Booking ID {booking_id}.", "status": "confirmed"}})
    await send_notification(user.user_id, b.get("venue_id"), "Booking Rescheduled", f"Your booking {booking_id} was rescheduled to {body.date} {body.slot}.")
    return {"ok": True, "date": body.date, "slot": body.slot}

@api_router.get("/bookings/me", response_model=List[Booking])
async def my_bookings(user: User = Depends(require_user)):
    docs = await db.bookings.find({"user_id": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return docs

@api_router.get("/bookings/owner")
async def owner_bookings(user: User = Depends(require_user)):
    venues = await db.venues.find({"owner_id": user.user_id}, {"_id": 0}).to_list(500)
    venue_ids = [v["venue_id"] for v in venues]
    bookings = await db.bookings.find({"venue_id": {"$in": venue_ids}}, {"_id": 0}).to_list(1000)
    revenue = sum(int(v.get("price_per_hour", 0)) for v in venues for b in bookings if b["venue_id"] == v["venue_id"])
    return {"venues": venues, "bookings": bookings, "revenue": revenue, "footfall": len(bookings)}

# ---------- Events ----------
@api_router.get("/events", response_model=List[Event])
async def list_events():
    docs = await db.events.find({}, {"_id": 0}).sort("date", -1).to_list(200)
    return docs

@api_router.post("/events", response_model=Event)
async def create_event(body: EventIn, user: User = Depends(require_user)):
    event_id = f"ev_{uuid.uuid4().hex[:10]}"
    doc = body.model_dump()
    doc.update({"event_id": event_id, "created_at": iso(now_utc())})
    await db.events.insert_one(doc)
    doc.pop("_id", None)
    return doc

# ---------- Creators ----------
@api_router.get("/creators", response_model=List[Creator])
async def list_creators():
    docs = await db.creators.find({}, {"_id": 0}).to_list(200)
    # compute points & rank
    for d in docs:
        d["points"] = int(d.get("engagement", 0) * 0.4 + d.get("consistency", 0) * 0.3 + d.get("quality", 0) * 0.3)
    docs.sort(key=lambda x: x["points"], reverse=True)
    for i, d in enumerate(docs):
        d["rank"] = i + 1
    return docs

@api_router.post("/creators", response_model=Creator)
async def create_creator(body: CreatorIn, user: User = Depends(require_user)):
    creator_id = f"cr_{uuid.uuid4().hex[:10]}"
    doc = body.model_dump()
    doc.update({
        "creator_id": creator_id,
        "points": 0,
        "badges": [],
        "rank": 0,
        "created_at": iso(now_utc()),
    })
    await db.creators.insert_one(doc)
    doc.pop("_id", None)
    return doc

# ---------- Slot availability ----------
SLOTS_ALL = ["6:00 AM - 7:00 AM","8:00 AM - 9:00 AM","11:00 AM - 12:00 PM","4:00 PM - 5:00 PM","6:00 PM - 7:00 PM","8:00 PM - 9:00 PM"]

@api_router.get("/venues/{venue_id}/availability")
async def availability(venue_id: str, date: str):
    booked = await db.bookings.find({"venue_id": venue_id, "date": date, "status": {"$ne": "cancelled"}}, {"_id": 0, "slot": 1}).to_list(50)
    booked_slots = [b["slot"] for b in booked]
    return {"date": date, "slots": [{"slot": s, "available": s not in booked_slots} for s in SLOTS_ALL]}

# ---------- Scratch cards ----------
@api_router.get("/scratch/me")
async def my_scratch(user: User = Depends(require_user)):
    cards = await db.scratch_cards.find({"user_id": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return cards

@api_router.post("/scratch/{code}/reveal")
async def reveal_scratch(code: str, user: User = Depends(require_user)):
    sc = await db.scratch_cards.find_one({"code": code, "user_id": user.user_id})
    if not sc: raise HTTPException(404, "Card not found")
    await db.scratch_cards.update_one({"code": code}, {"$set": {"revealed": True}})
    return {"code": code, "discount_pct": sc["discount_pct"], "used": sc.get("used", False)}

# ---------- Find a Pirate ----------
class PirateAlertIn(BaseModel):
    sport: str
    location: str
    price_per_player: int
    date: str
    time: str
    players_needed: int
    note: str = ""

@api_router.get("/pirates/alerts")
async def list_alerts():
    docs = await db.pirate_alerts.find({"status": "open"}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return docs

@api_router.post("/pirates/alerts")
async def create_alert(body: PirateAlertIn, user: User = Depends(require_user)):
    doc = {**body.model_dump(), "alert_id": f"pa_{uuid.uuid4().hex[:10]}",
           "user_id": user.user_id, "user_name": user.name, "status": "open",
           "responders": [], "created_at": iso(now_utc())}
    await db.pirate_alerts.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.post("/pirates/alerts/{alert_id}/join")
async def join_alert(alert_id: str, payload: dict, user: User = Depends(require_user)):
    contact = payload.get("contact", "")
    await db.pirate_alerts.update_one({"alert_id": alert_id}, {"$addToSet": {"responders": {"user_id": user.user_id, "name": user.name, "contact": contact, "joined_at": iso(now_utc())}}})
    return {"ok": True}

@api_router.get("/pirates/my-alerts")
async def my_alerts(user: User = Depends(require_user)):
    posted = await db.pirate_alerts.find({"user_id": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    joined = await db.pirate_alerts.find({"responders.user_id": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"posted": posted, "joined": joined}

# ---------- Event registration ----------
class EventRegIn(BaseModel):
    event_id: str

@api_router.post("/events/{event_id}/register")
async def register_event(event_id: str, user: User = Depends(require_user)):
    ev = await db.events.find_one({"event_id": event_id})
    if not ev: raise HTTPException(404, "Event not found")
    reg_id = f"reg_{uuid.uuid4().hex[:8]}"
    await db.event_regs.insert_one({"reg_id": reg_id, "event_id": event_id, "user_id": user.user_id, "user_name": user.name, "created_at": iso(now_utc())})
    return {"ok": True, "reg_id": reg_id}

# ---------- Merch (Premium-only catalog) ----------
MERCH = [
    {"id":"m1","name":"Pirate Crew Tee","price":899,"image":"https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600","category":"tee"},
    {"id":"m2","name":"Gold Anchor Cap","price":699,"image":"https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=600","category":"cap"},
    {"id":"m3","name":"Captain Hoodie","price":1799,"image":"https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600","category":"hoodie"},
    {"id":"m4","name":"Skull Sticker Pack","price":199,"image":"https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=600","category":"sticker"},
    {"id":"m5","name":"PIZO Tote Bag","price":499,"image":"https://images.unsplash.com/photo-1597481499750-3e6b22637e12?w=600","category":"bag"},
    {"id":"m6","name":"Crew Wristband","price":299,"image":"https://images.unsplash.com/photo-1622445275576-721325763afe?w=600","category":"accessory"},
]

async def get_merch_price(user_doc: dict, item: dict) -> int:
    price = int(item["price"])
    if not user_doc:
        return price
    sub = await db.subscriptions.find_one({"user_id": user_doc["user_id"], "status": "active", "plan_id": {"$in": ["premium", "family"]}})
    if sub:
        return int(price * 0.9)
    return price

@api_router.get("/merch")
async def list_merch(user: User = Depends(require_user)):
    sub = await db.subscriptions.find_one({"user_id": user.user_id, "status": "active", "plan_id": {"$in": ["premium","family"]}})
    is_premium = bool(sub)
    items = []
    for m in MERCH:
        m2 = dict(m)
        if is_premium:
            m2["original_price"] = m["price"]
            m2["price"] = int(m["price"] * 0.9)
            m2["discount_pct"] = 10
        items.append(m2)
    return {"is_premium": is_premium, "items": items}


@api_router.post("/merch/add")
async def add_to_chest(body: dict, user: User = Depends(require_user)):
    item_id = body.get("item_id")
    if not item_id:
        raise HTTPException(status_code=400, detail="item_id required")
    # verify exists
    found = next((m for m in MERCH if m["id"] == item_id), None)
    if not found:
        raise HTTPException(status_code=404, detail="Merch item not found")
    await db.user_chest.insert_one({"user_id": user.user_id, "item_id": item_id, "added_at": iso(now_utc())})
    return {"ok": True}

class CreatorJoinIn(BaseModel):
    name: str
    phone: str
    instagram: str
    youtube: str
    bio: str = ""
    category: str = "creator"

@api_router.post("/creators/join")
async def creator_join(body: CreatorJoinIn, user: User = Depends(require_user)):
    existing = await db.creators.find_one({"user_id": user.user_id})
    if existing:
        return {"already_joined": True, "referral_code": existing.get("referral_code")}
    referral = f"CR-{uuid.uuid4().hex[:6].upper()}"
    doc = {
        "creator_id": f"cr_{uuid.uuid4().hex[:10]}",
        "user_id": user.user_id,
        "name": body.name,
        "handle": body.instagram,
        "phone": body.phone,
        "bio": body.bio,
        "category": body.category,
        "engagement": 0,
        "consistency": 0,
        "quality": 0,
        "points": 0,
        "badges": ["Rookie"],
        "rank": 0,
        "referral_code": referral,
        "video_links": [],
        "created_at": iso(now_utc()),
    }
    await db.creators.insert_one(doc)
    return {"ok": True, "referral_code": referral}

class CreatorVideoIn(BaseModel):
    url: str
    views: int = 0

@api_router.post("/creators/video")
async def creator_video(body: CreatorVideoIn, user: User = Depends(require_user)):
    creator = await db.creators.find_one({"user_id": user.user_id})
    if not creator: raise HTTPException(403, "Join Creator Club first")
    pts = (body.views // 1000) * 2
    await db.creators.update_one(
        {"creator_id": creator["creator_id"]},
        {"$push": {"video_links": {"url": body.url, "views": body.views, "added_at": iso(now_utc())}},
         "$inc": {"engagement": pts}}
    )
    return {"ok": True, "points_earned": pts}

# ---------- Owner: slot management + staff + analytics ----------
COMMISSION_PCT = 9
PAYOUT_SCHEDULE = "Every Monday at 11:00 AM IST (T+1 week settlement)"

@api_router.get("/owner/analytics")
async def owner_analytics(user: User = Depends(require_user)):
    venues = await db.venues.find({"owner_id": user.user_id}, {"_id": 0}).to_list(500)
    vids = [v["venue_id"] for v in venues]
    bookings = await db.bookings.find({"venue_id": {"$in": vids}}, {"_id": 0}).to_list(2000)
    gross = sum(b.get("final_total", 0) for b in bookings)
    commission = int(gross * COMMISSION_PCT / 100)
    payout = gross - commission
    return {
        "venues": venues, "bookings": bookings,
        "footfall": sum(b.get("num_players", 1) for b in bookings),
        "gross_revenue": gross, "commission_pct": COMMISSION_PCT,
        "commission_amount": commission, "net_payout": payout,
        "payout_schedule": PAYOUT_SCHEDULE,
    }

class StaffIn(BaseModel):
    name: str
    password: Optional[str] = None

@api_router.post("/owner/staff")
async def create_staff(body: StaffIn, user: User = Depends(require_user)):
    # Only owners may create staff
    if user.role != "owner":
        raise HTTPException(status_code=403, detail="Only owners may create staff")
    token = f"STAFF-{uuid.uuid4().hex[:16]}"
    plain_password = body.password or uuid.uuid4().hex[:8]
    doc = {
        "staff_id": f"st_{uuid.uuid4().hex[:8]}",
        "owner_id": user.user_id,
        "name": body.name,
        "password_hash": hash_pw(plain_password),
        "scan_token": token,
        "created_at": iso(now_utc()),
    }
    await db.staff.insert_one(doc)
    return {
        "staff_id": doc["staff_id"],
        "name": doc["name"],
        "scan_token": doc["scan_token"],
        "password": plain_password,
        "created_at": doc["created_at"],
    }

@api_router.get("/owner/staff")
async def list_staff(user: User = Depends(require_user)):
    docs = await db.staff.find({"owner_id": user.user_id}, {"_id": 0, "password_hash": 0}).to_list(50)
    return docs

@api_router.delete("/owner/staff/{staff_id}")
async def delete_staff(staff_id: str, user: User = Depends(require_user)):
    # Only owners may delete their own staff; return proper status codes
    try:
        if user.role != "owner":
            raise HTTPException(status_code=403, detail="Not allowed")
        # perform ownership-aware delete to avoid revealing other owners' staff
        res = await db.staff.delete_one({"staff_id": staff_id, "owner_id": user.user_id})
        if getattr(res, "deleted_count", None) == 0:
            # either not found or not owned by this user
            # check if staff exists to differentiate 404 vs 403
            existing = await db.staff.find_one({"staff_id": staff_id})
            if existing:
                raise HTTPException(status_code=403, detail="Not allowed to delete this staff")
            raise HTTPException(status_code=404, detail="Staff member not found")
        await db.staff_sessions.delete_many({"staff_id": staff_id})
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error deleting staff")
        # Return the underlying error message to help debug 500s during development
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/staff/scan")
async def staff_scan(payload: dict):
    token = payload.get("scan_token"); booking_id = payload.get("booking_id")
    st = await db.staff.find_one({"scan_token": token})
    if not st: raise HTTPException(401, "Invalid staff token")
    bk = await db.bookings.find_one({"booking_id": booking_id})
    if not bk: raise HTTPException(404, "Booking not found")
    await db.bookings.update_one({"booking_id": booking_id}, {"$set": {"checked_in": True}})
    return {"ok": True, "booking_id": booking_id, "guest": bk["user_id"]}

# ---------- Verify venue (admin/owner toggle) ----------
@api_router.post("/venues/{venue_id}/verify")
async def verify_venue(venue_id: str, user: User = Depends(require_user)):
    # Demo: any onboarded owner of the venue can request/toggle verified=True
    await db.venues.update_one({"venue_id": venue_id}, {"$set": {"verified": True}})
    return {"ok": True}

# ---------- Subscriptions (mock UPI) ----------
PLAN_CATALOG = {
    "student": {"name": "Student Pass", "amount": 599},
    "family": {"name": "Family Pass", "amount": 1499},
    "premium": {"name": "Premium Pass", "amount": 999},
}

@api_router.post("/subscriptions", response_model=Subscription)
async def create_subscription(body: SubscriptionIn, user: User = Depends(require_user)):
    plan = PLAN_CATALOG.get(body.plan_id)
    if not plan:
        raise HTTPException(status_code=400, detail="Invalid plan")
    sub_id = f"sub_{uuid.uuid4().hex[:10]}"
    starts = now_utc()
    expires = starts + timedelta(days=30)
    doc = {
        "subscription_id": sub_id,
        "user_id": user.user_id,
        "plan_id": body.plan_id,
        "plan_name": plan["name"],
        "amount": plan["amount"],
        "status": "active",  # mocked active for demo
        "upi_ref": f"UPI-{uuid.uuid4().hex[:8].upper()}",
        "starts_at": iso(starts),
        "expires_at": iso(expires),
        "created_at": iso(starts),
    }
    await db.subscriptions.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.get("/subscriptions/me", response_model=List[Subscription])
async def my_subs(user: User = Depends(require_user)):
    docs = await db.subscriptions.find({"user_id": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return docs

# ---------- Contact ----------
@api_router.post("/contact")
async def contact(body: ContactIn):
    doc = {
        "contact_id": f"ct_{uuid.uuid4().hex[:10]}",
        **body.model_dump(),
        "forward_to": "crewpizo.in@gmail.com",
        "created_at": iso(now_utc()),
    }
    await db.contacts.insert_one(doc)
    # Email forwarding to crewpizo.in@gmail.com configured (SMTP creds needed for live send)
    logger.info(f"NEW CONTACT for crewpizo.in@gmail.com: {body.email} - {body.name}")
    return {"ok": True, "forwarded_to": "crewpizo.in@gmail.com"}

# ---------- Health ----------
@api_router.get("/")
async def root():
    return {"message": "PIZO API ahoy! ⚓"}

# ---------- Admin (token-gated) ----------
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "pizo-admin-2026")

def require_admin(x_admin_token: str = Header(..., alias="X-Admin-Token")):
    if x_admin_token != ADMIN_TOKEN:
        raise HTTPException(status_code=401, detail="Admin token required")
    return True

# ---------- Overview ----------
@api_router.get("/admin/overview")
async def admin_overview(_: bool = Depends(require_admin)):
    return {
        "users": await db.users.count_documents({}),
        "venues": await db.venues.count_documents({}),
        "verified_venues": await db.venues.count_documents({"verified": True}),
        "bookings": await db.bookings.count_documents({}),
        "subscriptions": await db.subscriptions.count_documents({"status":"active"}),
        "contacts": await db.contacts.count_documents({}),
        "creators": await db.creators.count_documents({}),
        "owners": await db.users.count_documents({"role":"owner"}),
        "events": await db.events.count_documents({}),
        "plans": await db.subscriptions.count_documents({}),
        "merch": len(MERCH),
    }

# ---------- Venues CRUD ----------
class AdminVenueUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    price_per_hour: Optional[int] = None
    rating: Optional[float] = None
    image: Optional[str] = None
    images: Optional[List[str]] = None
    amenities: Optional[List[str]] = None
    description: Optional[str] = None
    verified: Optional[bool] = None
    owner_id: Optional[str] = None

@api_router.get("/admin/venues")
async def admin_venues(_: bool = Depends(require_admin)):
    return await db.venues.find({}, {"_id": 0}).to_list(500)

@api_router.post("/admin/venues")
async def admin_create_venue(body: VenueIn, _: bool = Depends(require_admin)):
    venue_id = f"venue_{uuid.uuid4().hex[:10]}"
    doc = body.model_dump()
    doc.update({"venue_id": venue_id, "created_at": iso(now_utc())})
    if not doc.get("images"): doc["images"] = [doc["image"]] if doc.get("image") else []
    await db.venues.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.put("/admin/venues/{venue_id}")
async def admin_update_venue(venue_id: str, body: AdminVenueUpdate, _: bool = Depends(require_admin)):
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    if not upd: raise HTTPException(400, "No fields to update")
    r = await db.venues.update_one({"venue_id": venue_id}, {"$set": upd})
    if r.matched_count == 0: raise HTTPException(404, "Venue not found")
    return await db.venues.find_one({"venue_id": venue_id}, {"_id": 0})

@api_router.delete("/admin/venues/{venue_id}")
async def admin_delete_venue(venue_id: str, _: bool = Depends(require_admin)):
    r = await db.venues.delete_one({"venue_id": venue_id})
    if r.deleted_count == 0: raise HTTPException(404, "Venue not found")
    await db.bookings.delete_many({"venue_id": venue_id})
    return {"ok": True}

@api_router.post("/admin/venues/{venue_id}/verify")
async def admin_verify(venue_id: str, _: bool = Depends(require_admin)):
    await db.venues.update_one({"venue_id": venue_id}, {"$set": {"verified": True}})
    return {"ok": True}

@api_router.post("/admin/venues/{venue_id}/unverify")
async def admin_unverify(venue_id: str, _: bool = Depends(require_admin)):
    await db.venues.update_one({"venue_id": venue_id}, {"$set": {"verified": False}})
    return {"ok": True}

# ---------- Users CRUD ----------
class AdminUserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    owner_onboarded: Optional[bool] = None
    picture: Optional[str] = None

@api_router.get("/admin/users")
async def admin_users(_: bool = Depends(require_admin), role: Optional[str] = None):
    q = {}
    if role: q["role"] = role
    return await db.users.find(q, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(1000)

@api_router.put("/admin/users/{user_id}")
async def admin_update_user(user_id: str, body: AdminUserUpdate, _: bool = Depends(require_admin)):
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    if not upd: raise HTTPException(400, "No fields to update")
    r = await db.users.update_one({"user_id": user_id}, {"$set": upd})
    if r.matched_count == 0: raise HTTPException(404, "User not found")
    return await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})

@api_router.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, _: bool = Depends(require_admin)):
    r = await db.users.delete_one({"user_id": user_id})
    if r.deleted_count == 0: raise HTTPException(404, "User not found")
    await db.subscriptions.delete_many({"user_id": user_id})
    await db.bookings.delete_many({"user_id": user_id})
    await db.creators.delete_many({"user_id": user_id})
    return {"ok": True}

# ---------- Owners CRUD ----------
@api_router.get("/admin/owners")
async def admin_owners(_: bool = Depends(require_admin)):
    return await db.users.find({"role":"owner"}, {"_id":0,"password_hash":0}).to_list(500)

@api_router.put("/admin/owners/{user_id}")
async def admin_update_owner(user_id: str, body: dict, _: bool = Depends(require_admin)):
    upd = {k: v for k, v in body.items() if v is not None}
    if not upd: raise HTTPException(400, "No fields to update")
    r = await db.users.update_one({"user_id": user_id, "role":"owner"}, {"$set": upd})
    if r.matched_count == 0: raise HTTPException(404, "Owner not found")
    return await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})

@api_router.delete("/admin/owners/{user_id}")
async def admin_delete_owner(user_id: str, _: bool = Depends(require_admin)):
    r = await db.users.delete_one({"user_id": user_id, "role":"owner"})
    if r.deleted_count == 0: raise HTTPException(404, "Owner not found")
    await db.venues.delete_many({"owner_id": user_id})
    await db.bookings.delete_many({"user_id": user_id})
    return {"ok": True}

# ---------- Merch CRUD ----------
@api_router.get("/admin/merch")
async def admin_merch(_: bool = Depends(require_admin)):
    return MERCH

@api_router.post("/admin/merch")
async def admin_add_merch(body: dict, _: bool = Depends(require_admin)):
    global MERCH
    new_item = {
        "id": f"m{uuid.uuid4().hex[:6]}",
        "name": body["name"],
        "price": body["price"],
        "image": body["image"],
        "category": body.get("category","misc")
    }
    MERCH.append(new_item)
    return new_item

@api_router.put("/admin/merch/{id}")
async def admin_update_merch(id: str, body: dict, _: bool = Depends(require_admin)):
    global MERCH
    for m in MERCH:
        if m["id"] == id:
            m.update(body)
            return m
    raise HTTPException(404, "Merch not found")

@api_router.delete("/admin/merch/{id}")
async def admin_delete_merch(id: str, _: bool = Depends(require_admin)):
    global MERCH
    MERCH = [m for m in MERCH if m["id"] != id]
    return {"ok": True}

# ---------- Plans CRUD ----------
@api_router.get("/admin/plans")
async def admin_plans(_: bool = Depends(require_admin)):
    return await db.subscriptions.find({}, {"_id":0}).to_list(500)

@api_router.post("/admin/plans")
async def admin_add_plan(body: dict, _: bool = Depends(require_admin)):
    plan_id = f"plan_{uuid.uuid4().hex[:8]}"
    doc = {
        "plan_id": plan_id,
        "plan_name": body["plan_name"],
        "amount": body["amount"],
        "benefits": body.get("benefits", []),
        "created_at": iso(now_utc())
    }
    await db.subscriptions.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.put("/admin/plans/{plan_id}")
async def admin_update_plan(plan_id: str, body: dict, _: bool = Depends(require_admin)):
    upd = {k: v for k, v in body.items() if v is not None}
    if not upd: raise HTTPException(400, "No fields to update")
    r = await db.subscriptions.update_one({"plan_id": plan_id}, {"$set": upd})
    if r.matched_count == 0: raise HTTPException(404, "Plan not found")
    return await db.subscriptions.find_one({"plan_id": plan_id}, {"_id": 0})

@api_router.delete("/admin/plans/{plan_id}")
async def admin_delete_plan(plan_id: str, _: bool = Depends(require_admin)):
    await db.subscriptions.delete_many({"plan_id": plan_id})
    return {"ok": True}

# ---------- Events CRUD ----------
@api_router.post("/admin/events")
async def admin_add_event(body: EventIn, _: bool = Depends(require_admin)):
    event_id = f"ev_{uuid.uuid4().hex[:10]}"
    doc = body.model_dump()
    doc.update({"event_id": event_id, "created_at": iso(now_utc())})
    await db.events.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.get("/admin/events")
async def admin_events(_: bool = Depends(require_admin)):
    return await db.events.find({}, {"_id": 0}).to_list(500)


@api_router.put("/admin/events/{event_id}")
async def admin_update_event(event_id: str, body: EventIn, _: bool = Depends(require_admin)):
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    if not upd: raise HTTPException(400, "No fields to update")
    r = await db.events.update_one({"event_id": event_id}, {"$set": upd})
    if r.matched_count == 0: raise HTTPException(404, "Event not found")
    return await db.events.find_one({"event_id": event_id}, {"_id": 0})

@api_router.delete("/admin/events/{event_id}")
async def admin_delete_event(event_id: str, _: bool = Depends(require_admin)):
    r = await db.events.delete_one({"event_id": event_id})
    if r.deleted_count == 0: raise HTTPException(404, "Event not found")
    await db.event_regs.delete_many({"event_id": event_id})
    return {"ok": True}

# ---------- creators CRUD ----------
@api_router.post("/admin/creators")
async def admin_add_creator(body: CreatorIn, _: bool = Depends(require_admin)):
    creator_id = f"cr_{uuid.uuid4().hex[:10]}"
    doc = body.model_dump()
    doc.update({"creator_id": creator_id, "created_at": iso(now_utc())})
    await db.creators.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.get("/admin/creators")
async def admin_creators(_: bool = Depends(require_admin)):
    return await db.creators.find({}, {"_id": 0}).to_list(500)

# ---------- owners CRUD ----------
@api_router.put("/admin/owners/{user_id}")
async def admin_update_owner(user_id: str, body: dict, _: bool = Depends(require_admin)):
    upd = {k: v for k, v in body.items() if v is not None}
    if not upd: raise HTTPException(400, "No fields to update")
    r = await db.users.update_one({"user_id": user_id, "role":"owner"}, {"$set": upd})
    if r.matched_count == 0: raise HTTPException(404, "Owner not found")
    return await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})

# ----------contacts CRUD ----------
@api_router.delete("/admin/contacts/{contact_id}")
async def admin_delete_contact(contact_id: str, _: bool = Depends(require_admin)):
    r = await db.contacts.delete_one({"contact_id": contact_id})
    if r.deleted_count == 0: raise HTTPException(404, "Contact not found")
    return {"ok": True}

@api_router.get("/admin/contacts")
async def admin_contacts(_: bool = Depends(require_admin)):
    return await db.contacts.find(
        {}, 
        {"_id": 0, "contact_id": 1, "name": 1, "email": 1, "message": 1}
    ).to_list(500)




# ---------- Razorpay payments ----------
class RzpOrderIn(BaseModel):
    amount: int  # rupees
    purpose: str  # subscription / owner_onboard / merch_purchase / wallet_topup
    plan_id: Optional[str] = None
    notes: Optional[dict] = None
    purchase_payload: Optional[dict] = None

@api_router.get("/payments/razorpay/config")
async def razorpay_config():
    return {"key_id": RAZORPAY_KEY_ID, "enabled": bool(rzp_client)}

@api_router.post("/payments/razorpay/order")
async def create_rzp_order(body: RzpOrderIn, user: User = Depends(require_user)):
    if not rzp_client:
        raise HTTPException(503, "Razorpay not configured")
    amount_paise = int(body.amount) * 100
    receipt = f"pizo-{body.purpose[:8]}-{uuid.uuid4().hex[:8]}"
    notes = body.notes or {}
    notes.update({"user_id": user.user_id, "purpose": body.purpose})
    if body.plan_id: notes["plan_id"] = body.plan_id
    try:
        order = rzp_client.order.create({
            "amount": amount_paise,
            "currency": "INR",
            "receipt": receipt[:40],
            "payment_capture": 1,
            "notes": notes,
        })
    except Exception as e:
        logger.error(f"Razorpay order create failed: {e}")
        raise HTTPException(502, "Payment provider error")
    await db.rzp_orders.insert_one({
        "order_id": order["id"],
        "user_id": user.user_id,
        "amount": body.amount,
        "purpose": body.purpose,
        "plan_id": body.plan_id,
        "notes": body.notes or {},
        "purchase_payload": body.purchase_payload or {},
        "status": "created",
        "created_at": iso(now_utc()),
    })
    return {
        "order_id": order["id"],
        "amount": order["amount"],
        "currency": order["currency"],
        "key_id": RAZORPAY_KEY_ID,
        "name": user.name,
        "email": user.email,
    }

class RzpVerifyIn(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    purpose: str
    plan_id: Optional[str] = None
    booking_payload: Optional[dict] = None
    purchase_payload: Optional[dict] = None

def verify_rzp_signature(order_id: str, payment_id: str, signature: str) -> bool:
    body = f"{order_id}|{payment_id}".encode()
    expected = hmac.new(RAZORPAY_KEY_SECRET.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)

@api_router.post("/payments/razorpay/verify")
async def verify_rzp_payment(body: RzpVerifyIn, user: User = Depends(require_user)):
    if not verify_rzp_signature(body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature):
        raise HTTPException(400, "Invalid payment signature")
    await db.rzp_orders.update_one(
        {"order_id": body.razorpay_order_id},
        {"$set": {"status": "paid", "payment_id": body.razorpay_payment_id, "paid_at": iso(now_utc())}}
    )
    # Fulfill based on purpose
    if body.purpose == "subscription":
        plan = PLAN_CATALOG.get(body.plan_id or "")
        if not plan: raise HTTPException(400, "Invalid plan")
        sub_id = f"sub_{uuid.uuid4().hex[:10]}"
        starts = now_utc()
        expires = starts + timedelta(days=30)
        doc = {
            "subscription_id": sub_id, "user_id": user.user_id,
            "plan_id": body.plan_id, "plan_name": plan["name"],
            "amount": plan["amount"], "status": "active",
            "upi_ref": body.razorpay_payment_id,
            "payment_id": body.razorpay_payment_id,
            "order_id": body.razorpay_order_id,
            "starts_at": iso(starts), "expires_at": iso(expires),
            "created_at": iso(starts),
        }
        await db.subscriptions.insert_one(doc)
        doc.pop("_id", None)
        return {"ok": True, "subscription": doc}
    elif body.purpose == "owner_onboard":
        await db.owner_payments.insert_one({
            "payment_id": f"op_{uuid.uuid4().hex[:10]}",
            "user_id": user.user_id, "amount": OWNER_ONBOARD_FEE,
            "rzp_payment_id": body.razorpay_payment_id,
            "rzp_order_id": body.razorpay_order_id,
            "status": "paid", "created_at": iso(now_utc()),
        })
        await db.users.update_one(
            {"user_id": user.user_id},
            {"$set": {"owner_onboarded": True, "role": "owner"}},
        )
        u = await db.users.find_one({"user_id": user.user_id}, {"_id": 0, "password_hash": 0})
        return {"ok": True, "user": u}
    elif body.purpose == "booking":
        if not body.booking_payload:
            raise HTTPException(status_code=400, detail="Booking payload required")
        booking_request = BookingIn.model_validate(body.booking_payload)
        booking = await create_booking_record(booking_request, user, body.razorpay_order_id, body.razorpay_payment_id)
        return {"ok": True, "booking": booking}
    elif body.purpose == "merch_purchase":
        if not body.purchase_payload:
            raise HTTPException(status_code=400, detail="Purchase payload required")
        item_id = body.purchase_payload.get("item_id")
        if not item_id:
            raise HTTPException(status_code=400, detail="Item ID required")
        item = next((m for m in MERCH if m["id"] == item_id), None)
        if not item:
            raise HTTPException(status_code=404, detail="Merch item not found")
        price = await get_merch_price(user.model_dump(), item) if isinstance(user, User) else item["price"]
        order_doc = {
            "order_id": f"mo_{uuid.uuid4().hex[:10]}",
            "user_id": user.user_id,
            "item_id": item_id,
            "item_name": item["name"],
            "amount": price,
            "payment_type": "razorpay",
            "payment_id": body.razorpay_payment_id,
            "order_reference_id": body.razorpay_order_id,
            "status": "paid",
            "created_at": iso(now_utc()),
        }
        await db.merch_orders.insert_one(order_doc)
        await send_notification(user.user_id, None, "Merch purchase confirmed", f"You bought {item['name']} for ₹{price}.")
        return {"ok": True, "order": order_doc}
    elif body.purpose == "wallet_topup":
        # Credit user's wallet with the amount recorded in rzp_orders
        order = await db.rzp_orders.find_one({"order_id": body.razorpay_order_id})
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        amount = int(order.get("amount", 0))
        if amount <= 0:
            return {"ok": True}
        await credit_wallet(user.user_id, amount, f"Wallet top-up via Razorpay {body.razorpay_payment_id}")
        await db.rzp_orders.update_one({"order_id": body.razorpay_order_id}, {"$set": {"status": "paid", "payment_id": body.razorpay_payment_id, "paid_at": iso(now_utc())}})
        return {"ok": True, "credited": amount}
    return {"ok": True}

# ---------- File uploads (local storage, served via /api/uploads/<file>) ----------
ALLOWED_IMG_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MAX_IMG_BYTES = 8 * 1024 * 1024  # 8 MB

@api_router.post("/uploads/image")
async def upload_image(file: UploadFile = File(...), user: User = Depends(require_user)):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_IMG_EXT:
        raise HTTPException(400, "Only jpg/jpeg/png/webp/gif allowed")
    data = await file.read()
    if len(data) > MAX_IMG_BYTES:
        raise HTTPException(413, "File too large (max 8MB)")
    fname = f"{uuid.uuid4().hex}{ext}"
    fpath = UPLOAD_DIR / fname
    fpath.write_bytes(data)
    return {"url": f"/api/uploads/{fname}", "filename": fname, "size": len(data)}

# ---------- Creator: my profile + enhanced video upload ----------
@api_router.get("/creators/me")
async def my_creator(user: User = Depends(require_user)):
    creator = await db.creators.find_one({"user_id": user.user_id}, {"_id": 0})
    if not creator:
        return {"joined": False}
    # compute points & rank similar to list_creators
    all_c = await db.creators.find({}, {"_id": 0}).to_list(500)
    for d in all_c:
        d["points"] = int(d.get("engagement", 0) * 0.4 + d.get("consistency", 0) * 0.3 + d.get("quality", 0) * 0.3)
    all_c.sort(key=lambda x: x["points"], reverse=True)
    rank = next((i+1 for i, d in enumerate(all_c) if d["creator_id"] == creator["creator_id"]), 0)
    creator["rank"] = rank
    creator["points"] = int(creator.get("engagement", 0) * 0.4 + creator.get("consistency", 0) * 0.3 + creator.get("quality", 0) * 0.3)
    creator["total_creators"] = len(all_c)
    creator["video_links"] = creator.get("video_links", [])
    return {"joined": True, **creator}

class CreatorVideoIn2(BaseModel):
    url: str
    title: Optional[str] = ""
    platform: Optional[str] = "instagram"  # instagram / youtube / other
    thumbnail: Optional[str] = ""
    views: int = 0

@api_router.post("/creators/video2")
async def creator_video2(body: CreatorVideoIn2, user: User = Depends(require_user)):
    creator = await db.creators.find_one({"user_id": user.user_id})
    if not creator: raise HTTPException(403, "Join Creator Club first")
    pts = (max(0, body.views) // 1000) * 2
    video = {
        "video_id": f"vid_{uuid.uuid4().hex[:8]}",
        "url": body.url, "title": body.title or "Untitled Reel",
        "platform": body.platform or "instagram",
        "thumbnail": body.thumbnail or "",
        "views": int(body.views or 0),
        "added_at": iso(now_utc()),
    }
    await db.creators.update_one(
        {"creator_id": creator["creator_id"]},
        {"$push": {"video_links": video},
         "$inc": {"engagement": pts}}
    )
    return {"ok": True, "video": video, "points_earned": pts}

@api_router.delete("/creators/video/{video_id}")
async def delete_creator_video(video_id: str, user: User = Depends(require_user)):
    creator = await db.creators.find_one({"user_id": user.user_id})
    if not creator: raise HTTPException(403, "Not a creator")
    await db.creators.update_one(
        {"creator_id": creator["creator_id"]},
        {"$pull": {"video_links": {"video_id": video_id}}}
    )
    return {"ok": True}

# ---------- Event Videos (admin/owner posts community video links) ----------
class EventVideoIn(BaseModel):
    event_id: Optional[str] = None  # link to a specific event or general
    title: str
    url: str
    platform: str = "youtube"  # youtube / instagram / other
    thumbnail: Optional[str] = ""
    description: Optional[str] = ""

@api_router.get("/event-videos")
async def list_event_videos():
    docs = await db.event_videos.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return docs

@api_router.post("/event-videos")
async def add_event_video(body: EventVideoIn, user: User = Depends(require_user), x_admin_token: Optional[str] = Header(None)):
    # Allow admin OR owners
    is_admin = (x_admin_token == ADMIN_TOKEN)
    if not is_admin and user.role not in ("owner", "admin"):
        raise HTTPException(403, "Only admin or owners can post event videos")
    vid_id = f"evv_{uuid.uuid4().hex[:10]}"
    doc = {
        **body.model_dump(),
        "video_id": vid_id,
        "posted_by": user.user_id,
        "posted_by_name": user.name,
        "created_at": iso(now_utc()),
    }
    await db.event_videos.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.delete("/event-videos/{video_id}")
async def delete_event_video(video_id: str, user: User = Depends(require_user), x_admin_token: Optional[str] = Header(None)):
    is_admin = (x_admin_token == ADMIN_TOKEN)
    doc = await db.event_videos.find_one({"video_id": video_id})
    if not doc: raise HTTPException(404, "Not found")
    if not is_admin and doc.get("posted_by") != user.user_id:
        raise HTTPException(403, "Not allowed")
    await db.event_videos.delete_one({"video_id": video_id})
    return {"ok": True}

# ---------- Venue: owner-side edit/delete + multi-image ----------
class VenueImageIn(BaseModel):
    images: List[str]  # up to 3 image URLs (can be /api/uploads/... or external)

@api_router.put("/venues/{venue_id}/images")
async def update_venue_images(venue_id: str, body: VenueImageIn, user: User = Depends(require_user)):
    v = await db.venues.find_one({"venue_id": venue_id}, {"_id": 0})
    if not v: raise HTTPException(404, "Not found")
    if v.get("owner_id") != user.user_id:
        raise HTTPException(403, "Not your venue")
    imgs = list(body.images)[:3]
    if not imgs: raise HTTPException(400, "Provide at least one image")
    await db.venues.update_one({"venue_id": venue_id}, {"$set": {"images": imgs, "image": imgs[0]}})
    return {"ok": True, "images": imgs}

@api_router.delete("/venues/{venue_id}")
async def delete_my_venue(venue_id: str, user: User = Depends(require_user)):
    v = await db.venues.find_one({"venue_id": venue_id}, {"_id": 0})
    if not v: raise HTTPException(404, "Not found")
    if v.get("owner_id") != user.user_id and user.role != "admin":
        raise HTTPException(403, "Not your venue")
    await db.venues.delete_one({"venue_id": venue_id})
    return {"ok": True}

# ---------- Seed ----------
async def seed_data():
    try:
        if await db.venues.count_documents({}) == 0:
            venues = [
            {"name": "Pirate's Cove Turf", "category": "turf", "city": "Mumbai", "address": "Bandra West", "price_per_hour": 1200, "rating": 4.8, "image": "https://images.pexels.com/photos/399187/pexels-photo-399187.jpeg", "amenities": ["Floodlights", "Parking", "Cafe"], "description": "Premium 5-a-side football turf with FIFA-grade grass.", "owner_id": None},
            {"name": "Crimson Cue Billiards", "category": "billiards", "city": "Mumbai", "address": "Andheri East", "price_per_hour": 400, "rating": 4.7, "image": "https://images.pexels.com/photos/5055749/pexels-photo-5055749.jpeg", "amenities": ["AC", "Lounge", "Snacks"], "description": "8 pool & snooker tables in a chill, retro-lit lounge.", "owner_id": None},
            {"name": "Kraken Gaming Lounge", "category": "gaming", "city": "Bangalore", "address": "Indiranagar", "price_per_hour": 250, "rating": 4.9, "image": "https://images.pexels.com/photos/9072386/pexels-photo-9072386.jpeg", "amenities": ["RTX 4080 PCs", "PS5", "Energy Drinks"], "description": "Esports-grade rigs, 240Hz monitors, full BGMI/Valorant rooms.", "owner_id": None},
            {"name": "Anchor Pickleball Arena", "category": "pickleball", "city": "Pune", "address": "Koregaon Park", "price_per_hour": 600, "rating": 4.6, "image": "https://images.unsplash.com/photo-1511512578047-dfb367046420?crop=entropy&cs=srgb&fm=jpg&q=85", "amenities": ["Indoor Courts", "Coach", "Rentals"], "description": "Dedicated indoor pickleball with US-spec courts.", "owner_id": None},
            {"name": "Galleon Football Park", "category": "turf", "city": "Bangalore", "address": "HSR Layout", "price_per_hour": 1500, "rating": 4.7, "image": "https://images.pexels.com/photos/399187/pexels-photo-399187.jpeg", "amenities": ["Floodlights", "Showers"], "description": "Two 7-a-side turfs with night-game lighting.", "owner_id": None},
            {"name": "Black Pearl Esports", "category": "gaming", "city": "Mumbai", "address": "Powai", "price_per_hour": 300, "rating": 4.8, "image": "https://images.pexels.com/photos/9072386/pexels-photo-9072386.jpeg", "amenities": ["RGB Setup", "VR Room", "Cafe"], "description": "Tournament-ready arena hosting weekly LAN events.", "owner_id": None},
        ]
            for v in venues:
                v["venue_id"] = f"venue_{uuid.uuid4().hex[:10]}"
                v["created_at"] = iso(now_utc())
            await db.venues.insert_many(venues)

        if await db.events.count_documents({}) == 0:
            events = [
                {"event_id": f"ev_{uuid.uuid4().hex[:10]}", "title": "Pirates Cup BGMI Open 2025", "description": "₹1L prize pool, 64 squads, two-day LAN finals at Mumbai HQ.", "date": "2025-09-21", "location": "Mumbai HQ", "category": "tournament", "image": "https://images.pexels.com/photos/14266493/pexels-photo-14266493.jpeg", "highlights": ["64 teams", "₹1L prize", "Live cast"], "created_at": iso(now_utc())},
                {"event_id": f"ev_{uuid.uuid4().hex[:10]}", "title": "College Clash — Valorant Cup", "description": "30+ colleges battled for the Pirates Gauntlet trophy.", "date": "2025-08-12", "location": "Pune", "category": "college", "image": "https://images.pexels.com/photos/9072386/pexels-photo-9072386.jpeg", "highlights": ["30 colleges", "Brand booths", "After-party"], "created_at": iso(now_utc())},
                {"event_id": f"ev_{uuid.uuid4().hex[:10]}", "title": "Night Turf Showdown", "description": "Friday-night 5-a-side league across 3 cities.", "date": "2025-07-04", "location": "Multi-city", "category": "social", "image": "https://images.pexels.com/photos/399187/pexels-photo-399187.jpeg", "highlights": ["48 teams", "DJ Night", "Drone shoot"], "created_at": iso(now_utc())},
                {"event_id": f"ev_{uuid.uuid4().hex[:10]}", "title": "Creator Meetup — Crew of the Coast", "description": "Top 50 creators, sponsor lounges, content workshops.", "date": "2025-10-05", "location": "Bangalore", "category": "gaming", "image": "https://images.pexels.com/photos/15864904/pexels-photo-15864904.jpeg", "highlights": ["50 creators", "Brand deals", "Reel station"], "created_at": iso(now_utc())},
            ]
            await db.events.insert_many(events)

        if await db.creators.count_documents({}) == 0:
            creators = [
                {"name": "Aisha Verma", "handle": "@aishaplays", "avatar": "https://i.pravatar.cc/300?img=47", "bio": "BGMI streamer & sneaker head. 12k+ subs.", "category": "gamer", "engagement": 92, "consistency": 88, "quality": 94, "badges": ["Top 10", "Streak Master"]},
                {"name": "Rohan Kapoor", "handle": "@rohankreels", "avatar": "https://i.pravatar.cc/300?img=12", "bio": "Football reels & turf vlogs across Mumbai.", "category": "creator", "engagement": 88, "consistency": 91, "quality": 86, "badges": ["Reel King"]},
                {"name": "Tara Iyer", "handle": "@tara.iyer", "avatar": "https://i.pravatar.cc/300?img=32", "bio": "Model & pickleball ambassador. Pune.", "category": "model", "engagement": 95, "consistency": 79, "quality": 90, "badges": ["Face of August"]},
                {"name": "Nikhil Shetty", "handle": "@nik.cuesports", "avatar": "https://i.pravatar.cc/300?img=15", "bio": "Pro 8-ball player. Daily trick shots.", "category": "creator", "engagement": 82, "consistency": 94, "quality": 88, "badges": ["Consistency"]},
                {"name": "Maya D'Souza", "handle": "@mayasnaps", "avatar": "https://i.pravatar.cc/300?img=23", "bio": "Lifestyle x esports photog.", "category": "face", "engagement": 80, "consistency": 76, "quality": 96, "badges": ["Quality Pro"]},
                {"name": "Arjun Mehta", "handle": "@arjun.valo", "avatar": "https://i.pravatar.cc/300?img=8", "bio": "Valorant duelist. Radiant rank, EU servers.", "category": "gamer", "engagement": 78, "consistency": 84, "quality": 82, "badges": ["Rising"]},
            ]
            for c in creators:
                c["creator_id"] = f"cr_{uuid.uuid4().hex[:10]}"
                c["points"] = int(c["engagement"] * 0.4 + c["consistency"] * 0.3 + c["quality"] * 0.3)
                c["rank"] = 0
                c["created_at"] = iso(now_utc())
            await db.creators.insert_many(creators)
    except Exception as e:
        logging.warning(f"Seed data failed (using mock DB?): {e}")
        pass

@app.on_event("startup")
async def on_startup():
    await seed_data()

app.include_router(api_router)

# Static file serving for uploads (under /api/uploads to match ingress)
app.mount("/api/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


# ---------- Admin: Users ----------
@api_router.get("/admin/users")
async def list_users():
    docs = await db.users.find({}, {"_id":0, "password_hash":0}).to_list(500)
    return docs

@api_router.put("/admin/users/{user_id}")
async def edit_user(user_id: str, body: dict):
    await db.users.update_one({"user_id": user_id}, {"$set": body})
    return {"ok": True}

@api_router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str):
    await db.users.delete_many({"user_id": user_id})
    return {"ok": True}


# ---------- Admin: Owners ----------
@api_router.get("/admin/owners")
async def list_owners():
    docs = await db.users.find({"role":"owner"}, {"_id":0, "password_hash":0}).to_list(500)
    return docs

@api_router.put("/admin/owners/{owner_id}")
async def edit_owner(owner_id: str, body: dict):
    await db.users.update_one({"user_id": owner_id}, {"$set": body})
    return {"ok": True}

@api_router.delete("/admin/owners/{owner_id}")
async def delete_owner(owner_id: str):
    await db.users.delete_many({"user_id": owner_id})
    return {"ok": True}

@api_router.get("/owner/analytics/revenue")
async def owner_revenue(user: User = Depends(require_user)):
    venues = await db.venues.find({"owner_id": user.user_id}, {"_id": 0}).to_list(500)
    bookings = await db.bookings.find({"venue_id": {"$in": [v["venue_id"] for v in venues]}}, {"_id": 0}).to_list(1000)
    revenue_by_cat = {}
    for v in venues:
        cat = v.get("category", "other")
        count = sum(1 for b in bookings if b["venue_id"] == v["venue_id"])
        revenue_by_cat[cat] = revenue_by_cat.get(cat, 0) + (v["price_per_hour"] * count)
    return [{"category": k, "revenue": v} for k, v in revenue_by_cat.items()]

@api_router.get("/owner/analytics/badges")
async def owner_badges(user: User = Depends(require_user)):
    venues = await db.venues.find({"owner_id": user.user_id}, {"_id": 0}).to_list(500)
    bookings = await db.bookings.find({"venue_id": {"$in": [v["venue_id"] for v in venues]}}, {"_id": 0}).to_list(1000)
    # Top venue by revenue
    top_venue = None
    most_booked = None
    if venues:
        top_venue = max(venues, key=lambda v: sum(b["final_total"] for b in bookings if b["venue_id"] == v["venue_id"]))
        most_booked = max(venues, key=lambda v: sum(1 for b in bookings if b["venue_id"] == v["venue_id"]))
    return {
        "top_venue": top_venue["name"] if top_venue else None,
        "most_booked": most_booked["name"] if most_booked else None
    }

class SponsorIn(BaseModel):
    name: str
    phone: str
    address: str
    type: str  # cash / merch / passes

@api_router.post("/owner/sponsors")
async def sponsor_request(body: SponsorIn, user: User = Depends(require_user)):
    doc = body.model_dump()
    doc.update({
        "sponsor_id": f"sp_{uuid.uuid4().hex[:10]}",
        "owner_id": user.user_id,
        "created_at": iso(now_utc())
    })
    await db.sponsors.insert_one(doc)
    return {"ok": True, "sponsor": doc}





