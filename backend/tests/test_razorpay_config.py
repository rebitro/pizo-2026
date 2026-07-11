import importlib
import sys

import pytest


@pytest.fixture
def server_module(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "test-jwt-secret")
    monkeypatch.setenv("ADMIN_TOKEN", "test-admin-token")
    monkeypatch.setenv("RAZORPAY_KEY_ID", "test_rzp_key")
    monkeypatch.setenv("RAZORPAY_KEY_SECRET", "test_rzp_secret")
    sys.modules.pop("backend.server", None)
    return importlib.import_module("backend.server")


def test_razorpay_requires_env_credentials_when_missing(monkeypatch, server_module):
    monkeypatch.delenv("RAZORPAY_KEY_ID", raising=False)
    monkeypatch.delenv("RAZORPAY_KEY_SECRET", raising=False)

    importlib.reload(server_module)

    assert server_module.RAZORPAY_KEY_ID in (None, "")
    assert server_module.RAZORPAY_KEY_SECRET in (None, "")
    assert server_module.rzp_client is None
