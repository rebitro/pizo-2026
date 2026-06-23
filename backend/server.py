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
    created_at: str

class VenueIn(BaseModel):
    name: str
    category: str  # turf, billiards, gaming, pickleball
    city: str
    address: str
    price_per_hour: int
    rating: float = 4.5
    image: str
    amenities: List[str] = []
    description: str = ""
    owner_id: Optional[str] = None

class Venue(VenueIn):
    venue_id: str
    created_at: str

class BookingIn(BaseModel):
    venue_id: str
    date: str  # YYYY-MM-DD
    slot: str  # e.g. "6:00 PM - 7:00 PM"

class Booking(BaseModel):
    booking_id: str
    user_id: str
    venue_id: str
    venue_name: str
    date: str
    slot: str
    status: str = "confirmed"
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

# ---------- Venues ----------
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
    booking_id = f"bk_{uuid.uuid4().hex[:10]}"
    doc = {
        "booking_id": booking_id,
        "user_id": user.user_id,
        "venue_id": body.venue_id,
        "venue_name": venue["name"],
        "date": body.date,
        "slot": body.slot,
        "status": "confirmed",
        "created_at": iso(now_utc()),
    }
    await db.bookings.insert_one(doc)
    doc.pop("_id", None)
    return doc

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
        "created_at": iso(now_utc()),
    }
    await db.contacts.insert_one(doc)
    return {"ok": True}

# ---------- Health ----------
@api_router.get("/")
async def root():
    return {"message": "PIZO API ahoy! ⚓"}

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
