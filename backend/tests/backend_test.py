"""PIZO backend API tests - covers auth, venues, bookings, subs, creators, events, contact."""
import os
import uuid
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[1]
load_dotenv(ROOT_DIR / ".env")

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "")


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _unique_email(prefix="TEST_user"):
    return f"{prefix}_{uuid.uuid4().hex[:8]}@example.com"


@pytest.fixture(scope="session")
def user_auth(session):
    email = _unique_email()
    r = session.post(f"{API}/auth/register", json={
        "name": "Test User", "email": email, "password": "TestPass123!", "role": "user"
    })
    assert r.status_code == 200, r.text
    data = r.json()
    return {"token": data["token"], "user": data["user"], "email": email, "password": "TestPass123!"}


@pytest.fixture(scope="session")
def owner_auth(session):
    email = _unique_email("TEST_owner")
    r = session.post(f"{API}/auth/register", json={
        "name": "Test Owner", "email": email, "password": "OwnerPass123!", "role": "owner"
    })
    assert r.status_code == 200, r.text
    data = r.json()
    # ensure owner is onboarded for tests (pay onboarding fee)
    headers = {"Authorization": f"Bearer {data['token']}", "Content-Type": "application/json"}
    r2 = session.post(f"{API}/owners/onboard", json={"upi_id": "test@upi"}, headers=headers)
    assert r2.status_code == 200, r2.text
    return {"token": data["token"], "user": data["user"]}


def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- Health ----------
class TestHealth:
    def test_root(self, session):
        r = session.get(f"{API}/")
        assert r.status_code == 200
        assert "ahoy" in r.json()["message"].lower()


# ---------- Seed data ----------
class TestSeed:
    def test_venues_seeded(self, session):
        r = session.get(f"{API}/venues")
        assert r.status_code == 200
        venues = r.json()
        assert len(venues) >= 6
        # validate structure
        v = venues[0]
        for k in ["venue_id", "name", "category", "city", "price_per_hour"]:
            assert k in v
        assert "_id" not in v

    def test_events_seeded(self, session):
        r = session.get(f"{API}/events")
        assert r.status_code == 200
        events = r.json()
        assert len(events) >= 4
        assert "_id" not in events[0]

    def test_creators_seeded_with_rank(self, session):
        r = session.get(f"{API}/creators")
        assert r.status_code == 200
        creators = r.json()
        assert len(creators) >= 6
        # sorted desc by points, rank=1 has highest points
        assert creators[0]["rank"] == 1
        for i in range(len(creators) - 1):
            assert creators[i]["points"] >= creators[i + 1]["points"]
            assert creators[i]["rank"] == i + 1


# ---------- Auth ----------
class TestAuth:
    def test_register_returns_token_and_user(self, session):
        email = _unique_email()
        r = session.post(f"{API}/auth/register", json={
            "name": "Reg User", "email": email, "password": "Pass1234!", "role": "user"
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data and isinstance(data["token"], str)
        assert data["user"]["email"] == email
        assert "password_hash" not in data["user"]

    def test_register_duplicate_email(self, session, user_auth):
        r = session.post(f"{API}/auth/register", json={
            "name": "Dup", "email": user_auth["email"], "password": "x", "role": "user"
        })
        assert r.status_code == 400

    def test_login_success(self, session, user_auth):
        r = session.post(f"{API}/auth/login", json={
            "email": user_auth["email"], "password": user_auth["password"]
        })
        assert r.status_code == 200
        assert "token" in r.json()

    def test_login_invalid(self, session):
        r = session.post(f"{API}/auth/login", json={
            "email": "nope@nope.com", "password": "wrong"
        })
        assert r.status_code == 401

    def test_me_with_token(self, session, user_auth):
        r = session.get(f"{API}/auth/me", headers=auth_headers(user_auth["token"]))
        assert r.status_code == 200
        assert r.json()["email"] == user_auth["email"]

    def test_me_without_token(self, session):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401


# ---------- Venues ----------
class TestVenues:
    def test_filter_turf_mumbai(self, session):
        r = session.get(f"{API}/venues", params={"category": "turf", "city": "Mumbai"})
        assert r.status_code == 200
        venues = r.json()
        assert len(venues) >= 1
        for v in venues:
            assert v["category"] == "turf"
            assert v["city"] == "Mumbai"

    def test_get_single_venue(self, session):
        all_v = session.get(f"{API}/venues").json()
        vid = all_v[0]["venue_id"]
        r = session.get(f"{API}/venues/{vid}")
        assert r.status_code == 200
        assert r.json()["venue_id"] == vid

    def test_get_venue_not_found(self, session):
        r = session.get(f"{API}/venues/does_not_exist")
        assert r.status_code == 404

    def test_create_venue_requires_auth(self, session):
        r = requests.post(f"{API}/venues", json={
            "name": "x", "category": "turf", "city": "Mumbai", "address": "a",
            "price_per_hour": 100, "image": "https://x.com/i.jpg"
        })
        assert r.status_code == 401

    def test_create_venue_as_owner(self, session, owner_auth):
        payload = {
            "name": "TEST_Owner Venue", "category": "turf", "city": "Mumbai",
            "address": "Test Rd", "price_per_hour": 800, "image": "https://x.com/i.jpg",
            "amenities": ["A", "B"], "description": "test"
        }
        r = session.post(f"{API}/venues", json=payload, headers=auth_headers(owner_auth["token"]))
        assert r.status_code == 200, r.text
        v = r.json()
        assert v["owner_id"] == owner_auth["user"]["user_id"]
        # verify persistence
        r2 = session.get(f"{API}/venues/{v['venue_id']}")
        assert r2.status_code == 200
        assert r2.json()["name"] == payload["name"]


# ---------- Bookings ----------
class TestBookings:
    def test_booking_quote_returns_discount_breakdown(self, session, user_auth):
        venues = session.get(f"{API}/venues").json()
        vid = venues[0]["venue_id"]
        r = session.post(f"{API}/bookings/quote", json={
            "venue_id": vid,
            "date": "2026-02-01",
            "slot": "6:00 PM - 7:00 PM",
            "num_players": 2,
            "coupons": []
        }, headers=auth_headers(user_auth["token"]))
        assert r.status_code == 200, r.text
        data = r.json()
        assert "base_price" in data
        assert "final_total" in data
        assert "discount_pct" in data
        assert "applied_coupons" in data

    def test_create_booking_and_list(self, session, user_auth):
        venues = session.get(f"{API}/venues").json()
        vid = venues[0]["venue_id"]
        # include a test payment_id so booking proceeds in test environment
        slots_to_try = [
            "6:00 PM - 7:00 PM", "7:00 PM - 8:00 PM", "8:00 PM - 9:00 PM", "5:00 PM - 6:00 PM",
            "9:00 PM - 10:00 PM", "4:00 PM - 5:00 PM"
        ]
        r = None
        for slot in slots_to_try:
            r = session.post(f"{API}/bookings", json={
                "venue_id": vid, "date": "2026-02-01", "slot": slot, "payment_id": "TESTPAY"
            }, headers=auth_headers(user_auth["token"]))
            if r.status_code == 200:
                break
        assert r is not None and r.status_code == 200, r.text
        bk = r.json()
        assert bk["status"] == "confirmed"
        assert bk["venue_name"] == venues[0]["name"]

        r2 = session.get(f"{API}/bookings/me", headers=auth_headers(user_auth["token"]))
        assert r2.status_code == 200
        ids = [b["booking_id"] for b in r2.json()]
        assert bk["booking_id"] in ids

    def test_booking_invalid_venue(self, session, user_auth):
        r = session.post(f"{API}/bookings", json={
            "venue_id": "venue_doesnotexist", "date": "2026-02-01", "slot": "x"
        }, headers=auth_headers(user_auth["token"]))
        assert r.status_code == 404


# ---------- Subscriptions ----------
class TestSubscriptions:
    def test_create_premium_sub(self, session, user_auth):
        r = session.post(f"{API}/subscriptions", json={
            "plan_id": "premium", "upi_id": "test@upi"
        }, headers=auth_headers(user_auth["token"]))
        assert r.status_code == 200, r.text
        sub = r.json()
        assert sub["status"] == "active"
        assert sub["plan_id"] == "premium"
        assert sub["amount"] == 999
        assert sub["upi_ref"].startswith("UPI-")

        r2 = session.get(f"{API}/subscriptions/me", headers=auth_headers(user_auth["token"]))
        assert r2.status_code == 200
        assert any(s["subscription_id"] == sub["subscription_id"] for s in r2.json())

    def test_invalid_plan(self, session, user_auth):
        r = session.post(f"{API}/subscriptions", json={
            "plan_id": "bogus", "upi_id": "x@upi"
        }, headers=auth_headers(user_auth["token"]))
        assert r.status_code == 400


# ---------- Reviews ----------
class TestReviews:
    def test_submit_and_fetch_reviews_for_venue(self, session, user_auth):
        venues = session.get(f"{API}/venues").json()
        vid = venues[0]["venue_id"]
        r = session.post(f"{API}/reviews", json={
            "target_type": "venue",
            "target_id": vid,
            "rating": 5,
            "comment": "Great venue"
        }, headers=auth_headers(user_auth["token"]))
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["rating"] == 5
        r2 = session.get(f"{API}/reviews/venue/{vid}")
        assert r2.status_code == 200
        data = r2.json()
        assert data["review_count"] >= 1
        assert data["average_rating"] >= 4

    def test_submit_and_fetch_reviews_for_creator(self, session, user_auth):
        creators = session.get(f"{API}/creators").json()
        cid = creators[0]["creator_id"]
        r = session.post(f"{API}/reviews", json={
            "target_type": "creator",
            "target_id": cid,
            "rating": 4,
            "comment": "Great creator"
        }, headers=auth_headers(user_auth["token"]))
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["rating"] == 4
        r2 = session.get(f"{API}/reviews/creator/{cid}")
        assert r2.status_code == 200
        data = r2.json()
        assert data["review_count"] >= 1
        assert data["average_rating"] >= 4


# ---------- Contact ----------
class TestContact:
    def test_submit_contact(self, session):
        r = session.post(f"{API}/contact", json={
            "name": "Test", "email": "test@test.com", "message": "hi"
        })
        assert r.status_code == 200
        assert r.json()["ok"] is True


class TestMerchCheckout:
    def test_cart_checkout_and_admin_status_flow(self, session, user_auth):
        r = session.get(f"{API}/merch", headers=auth_headers(user_auth["token"]))
        assert r.status_code == 200
        item = r.json()["items"][0]

        r = session.post(f"{API}/merch/cart", json={
            "item_id": item["id"],
            "size": "M",
            "color": "Black",
            "quantity": 2,
        }, headers=auth_headers(user_auth["token"]))
        assert r.status_code == 200
        cart = r.json()["cart"]
        assert any(i["item_id"] == item["id"] for i in cart["items"])

        r = session.post(f"{API}/merch/checkout", json={
            "items": cart["items"],
            "shipping_address": "123 Test Street",
            "phone": "9999999999",
            "email": user_auth["email"],
            "payment_method": "cod",
        }, headers=auth_headers(user_auth["token"]))
        assert r.status_code == 200
        order = r.json()["order"]
        assert order["status"] == "pending"
        assert order["payment_method"] == "cod"

        r = session.get(f"{API}/me/merch/orders", headers=auth_headers(user_auth["token"]))
        assert r.status_code == 200
        assert any(o["order_id"] == order["order_id"] for o in r.json()["orders"])

        admin_headers = {"X-Admin-Token": ADMIN_TOKEN}
        r = session.get(f"{API}/admin/merch/orders", headers=admin_headers)
        assert r.status_code == 200
        assert any(o["order_id"] == order["order_id"] for o in r.json())

        r = session.put(f"{API}/admin/merch/orders/{order['order_id']}", json={"status": "shipped"}, headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["status"] == "shipped"
