import requests, uuid, os
BASE = os.environ.get('REACT_APP_BACKEND_URL','http://127.0.0.1:8002').rstrip('/')
API = BASE + '/api'

s = requests.Session()

# Register referrer
email_a = f"referrer_{uuid.uuid4().hex[:6]}@example.com"
r = s.post(f"{API}/auth/register", json={"name":"Referrer","email":email_a,"password":"Pass123!","role":"user"})
print('register A', r.status_code, r.text)
data_a = r.json()
token_a = data_a['token']
ref_code = data_a['user'].get('referral_code')
print('A code:', ref_code)

# Register referee
email_b = f"referee_{uuid.uuid4().hex[:6]}@example.com"
r = s.post(f"{API}/auth/register", json={"name":"Referee","email":email_b,"password":"Pass123!","role":"user"})
print('register B', r.status_code, r.text)
data_b = r.json()
token_b = data_b['token']

# Get a venue
r = s.get(f"{API}/venues")
venue = r.json()[0]
vid = venue['venue_id']
print('venue', vid, venue['name'])

# Create booking as B with referral_code A
headers_b = {"Authorization": f"Bearer {token_b}", "Content-Type": "application/json"}
resp = s.post(f"{API}/bookings", json={"venue_id": vid, "date":"2026-02-02", "slot":"6:00 PM - 7:00 PM", "payment_id":"TESTPAY", "referral_code": ref_code}, headers=headers_b)
print('booking', resp.status_code, resp.text)

# Check wallets
r_a = s.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token_a}"})
r_b = s.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token_b}"})
print('A wallet', r_a.status_code, r_a.json().get('wallet_balance'))
print('B wallet', r_b.status_code, r_b.json().get('wallet_balance'))
