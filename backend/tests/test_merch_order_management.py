import os
import uuid

import requests

API = os.getenv("API_BASE", "http://127.0.0.1:8000/api")


def test_merch_order_can_be_edited_and_cancelled_with_wallet_refund():
    email = f"merch_edit_{uuid.uuid4().hex[:8]}@example.com"
    reg = requests.post(
        f"{API}/auth/register",
        json={"name": "Edit User", "email": email, "password": "TestPass123!", "role": "user"},
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
            "shipping_address": "Old Address",
            "phone": "9999999999",
            "email": email,
            "payment_method": "cod",
            "name": "Old Name",
        },
        timeout=10,
    )
    assert checkout.status_code == 200, checkout.text
    order_id = checkout.json()["order"]["order_id"]

    update = requests.put(
        f"{API}/me/merch/orders/{order_id}",
        headers=headers,
        json={"name": "New Name", "phone": "1111111111", "shipping_address": "New Address"},
        timeout=10,
    )
    assert update.status_code == 200, update.text
    updated = update.json()["order"]
    assert updated["name"] == "New Name"
    assert updated["phone"] == "1111111111"
    assert updated["shipping_address"] == "New Address"

    cancel = requests.post(
        f"{API}/me/merch/orders/{order_id}/cancel",
        headers=headers,
        json={"refund_mode": "none", "reason": "Changed mind"},
        timeout=10,
    )
    assert cancel.status_code == 200, cancel.text
    cancelled = cancel.json()["order"]
    assert cancelled["status"] in {"refunded", "cancelled"}
