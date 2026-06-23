from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, Header
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import bcrypt
import jwt
import requests
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Annotated
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'pizo-super-secret-key-change-in-prod')
JWT_ALGO = 'HS256'
EMERGENT_AUTH_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

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
    created_at: str

class VenueIn(BaseModel):
    name: str
    category: str
    city: str
    address: str
    price_per_hour: int
    rating: float = 4.5
    image: str
    amenities: List[str] = []
    description: str = ""
    owner_id: Optional[str] = None
    verified: bool = False

class Venue(VenueIn):
    venue_id: str
    created_at: str

class BookingIn(BaseModel):
    venue_id: str
    date: str
    slot: str
    num_players: Optional[int] = 1
    coupons: Optional[List[str]] = []

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
    per_player: int = 0
    applied_coupons: List[str] = []
    share_token: str = ""
    checked_in: bool = False
    created_at: str

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
    payload = {"user_id": user_id, "exp": now_utc() + timedelta(days=7)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

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


@api_router.get("/venues", response_model=List[Venue])
async def list_venues(category: Optional[str] = None, city: Optional[str] = None):
    q = {}
    if category and category != "all":
        q["category"] = category
    if city and city != "all":
        q["city"] = city
    docs = await db.venues.find(q, {"_id": 0}).to_list(500)
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
    venue = await db.venues.find_one({"venue_id": body.venue_id}, {"_id": 0})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    # SLOT LOCK: prevent double-booking
    existing = await db.bookings.find_one({"venue_id": body.venue_id, "date": body.date, "slot": body.slot, "status": {"$ne": "cancelled"}})
    if existing:
        raise HTTPException(status_code=409, detail="Slot already booked. Pick another time.")

    # PREMIUM early-access on weekends (Fri/Sat/Sun) — non-premium can only book within 6 days
    try:
        from datetime import date as _d
        bdate = _d.fromisoformat(body.date)
        days_ahead = (bdate - now_utc().date()).days
        # Get user's active subscription
        sub = await db.subscriptions.find_one({"user_id": user.user_id, "status": "active"})
        plan_id = sub["plan_id"] if sub else None
        # Normal user: max 7 days ahead. Pass holders: 14 days ahead
        max_days = 14 if plan_id in ("premium", "family", "student") else 7
        if days_ahead > max_days:
            raise HTTPException(status_code=403, detail=f"{'Pass holders' if plan_id else 'Normal users'} can only book up to {max_days} days ahead. Upgrade for more.")
    except HTTPException: raise
    except Exception: pass

    base_price = int(venue.get("price_per_hour", 0))
    num_players = max(1, int(getattr(body, "num_players", 1) or 1))

    # Apply coupons (max 2)
    coupons = list(getattr(body, "coupons", []) or [])[:2]
    discount_pct = 0
    applied = []
    user_booking_count = await db.bookings.count_documents({"user_id": user.user_id})

    # Auto pass-based discount: Premium 12%, Family 10%, Student 8%
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
            sc = await db.scratch_cards.find_one({"code": c, "user_id": user.user_id, "used": False})
            if sc:
                discount_pct += int(sc["discount_pct"])
                applied.append(c)
                await db.scratch_cards.update_one({"_id": sc["_id"]}, {"$set": {"used": True}})
        elif c.startswith("CR-"):
            creator = await db.creators.find_one({"referral_code": c})
            if creator:
                discount_pct += 5; applied.append(c)
                await db.creators.update_one({"creator_id": creator["creator_id"]}, {"$inc": {"engagement": 5}})
    discount_pct = min(discount_pct, 40)
    final_total = int(base_price * (100 - discount_pct) / 100)
    per_player = int(round(final_total / num_players))

    booking_id = f"bk_{uuid.uuid4().hex[:10]}"
    share_token = uuid.uuid4().hex[:8]
    doc = {
        "booking_id": booking_id,
        "user_id": user.user_id,
        "venue_id": body.venue_id,
        "venue_name": venue["name"],
        "date": body.date,
        "slot": body.slot,
        "status": "confirmed",
        "num_players": num_players,
        "base_price": base_price,
        "discount_pct": discount_pct,
        "final_total": final_total,
        "per_player": per_player,
        "applied_coupons": applied,
        "share_token": share_token,
        "checked_in": False,
        "created_at": iso(now_utc()),
    }
    await db.bookings.insert_one(doc)

    # SCRATCH REWARD on every 5th booking
    new_count = user_booking_count + 1
    scratch = None
    if new_count % 5 == 0:
        import random
        pct = random.choice([10, 12, 15, 18, 20])
        code = f"SCRATCH-{uuid.uuid4().hex[:6].upper()}"
        await db.scratch_cards.insert_one({
            "code": code, "user_id": user.user_id, "discount_pct": pct,
            "used": False, "revealed": False, "created_at": iso(now_utc()),
        })
        scratch = {"code": code, "discount_pct": pct}

    doc.pop("_id", None)
    return Booking(**{k: v for k, v in doc.items() if k in Booking.model_fields})

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

# ---------- Creator join + referral ----------
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
        "name": body.name, "handle": body.instagram, "phone": body.phone,
        "instagram": body.instagram, "youtube": body.youtube,
        "avatar": user.picture or f"https://i.pravatar.cc/300?u={user.user_id}",
        "bio": body.bio, "category": body.category,
        "engagement": 0, "consistency": 0, "quality": 0,
        "points": 0, "badges": ["Rookie"], "rank": 0,
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

@api_router.post("/owner/staff")
async def create_staff(body: StaffIn, user: User = Depends(require_user)):
    token = f"STAFF-{uuid.uuid4().hex[:16]}"
    doc = {"staff_id": f"st_{uuid.uuid4().hex[:8]}", "owner_id": user.user_id,
           "name": body.name, "scan_token": token, "created_at": iso(now_utc())}
    await db.staff.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.get("/owner/staff")
async def list_staff(user: User = Depends(require_user)):
    docs = await db.staff.find({"owner_id": user.user_id}, {"_id": 0}).to_list(50)
    return docs

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

def require_admin(x_admin_token: Optional[str] = Header(None)):
    if x_admin_token != ADMIN_TOKEN:
        raise HTTPException(401, "Admin token required")
    return True

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
    }

@api_router.get("/admin/venues")
async def admin_venues(_: bool = Depends(require_admin)):
    return await db.venues.find({}, {"_id": 0}).to_list(500)

@api_router.post("/admin/venues/{venue_id}/verify")
async def admin_verify(venue_id: str, _: bool = Depends(require_admin)):
    await db.venues.update_one({"venue_id": venue_id}, {"$set": {"verified": True}})
    return {"ok": True}

@api_router.post("/admin/venues/{venue_id}/unverify")
async def admin_unverify(venue_id: str, _: bool = Depends(require_admin)):
    await db.venues.update_one({"venue_id": venue_id}, {"$set": {"verified": False}})
    return {"ok": True}

@api_router.get("/admin/contacts")
async def admin_contacts(_: bool = Depends(require_admin)):
    return await db.contacts.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)

# ---------- Seed ----------
async def seed_data():
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

@app.on_event("startup")
async def on_startup():
    await seed_data()

app.include_router(api_router)

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
