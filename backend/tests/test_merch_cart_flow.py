import os
import uuid
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
API = f"{BASE_URL}/api"


def test_cart_items_are_visible_in_chest_and_checkout_works():
    email = f"merch_cart_{uuid.uuid4().hex[:8]}@example.com"
    reg = requests.post(
        f"{API}/auth/register",
        json={"name": "Cart User", "email": email, "password": "TestPass123!", "role": "user"},
        timeout=10,
    )
    assert reg.status_code == 200, reg.text
    token = reg.json()["token"]
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    add = requests.post(
        f"{API}/merch/cart",
        headers=headers,
        json={"item_id": "m1", "size": "M", "color": "Black", "quantity": 1},
        timeout=10,
    )
    assert add.status_code == 200, add.text

    chest = requests.get(f"{API}/me/chest", headers=headers, timeout=10)
    assert chest.status_code == 200, chest.text
    body = chest.json()
    assert body["item_count"] >= 1
    assert any(item["item_id"] == "m1" for item in body["items"])

    checkout = requests.post(
        f"{API}/merch/checkout",
        headers=headers,
        json={
            "items": [{"item_id": "m1", "size": "M", "color": "Black", "quantity": 1}],
            "shipping_address": "12 Pirate Lane",
            "phone": "9999999999",
            "email": email,
            "payment_method": "cod",
        },
        timeout=10,
    )
    assert checkout.status_code == 200, checkout.text
    order = checkout.json()["order"]
    assert order["payment_method"] == "cod"


def test_cod_merch_refund_requires_delivery_before_cancel():
    email = f"merch_refund_{uuid.uuid4().hex[:8]}@example.com"
    reg = requests.post(
        f"{API}/auth/register",
        json={"name": "Refund User", "email": email, "password": "TestPass123!", "role": "user"},
        timeout=10,
    )
    assert reg.status_code == 200, reg.text
    token = reg.json()["token"]
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    checkout = requests.post(
        f"{API}/merch/checkout",
        headers=headers,
        json={
            "items": [{"item_id": "m1", "size": "M", "color": "Black", "quantity": 1}],
            "shipping_address": "12 Pirate Lane",
            "phone": "9999999999",
            "email": email,
            "payment_method": "cod",
        },
        timeout=10,
    )
    assert checkout.status_code == 200, checkout.text
    order_id = checkout.json()["order"]["order_id"]

    refund = requests.post(
        f"{API}/me/merch/orders/{order_id}/cancel",
        headers=headers,
        json={"refund_mode": "wallet"},
        timeout=10,
    )
    assert refund.status_code == 400, refund.text
    assert "delivery" in refund.text.lower()
