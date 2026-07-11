import requests, uuid
API='http://127.0.0.1:8001/api'
email=f'authcheck_{uuid.uuid4().hex[:8]}@example.com'
r=requests.post(f'{API}/auth/register', json={'name':'Auth Check','email':email,'password':'TestPass123!','role':'user'}, timeout=10)
print('register', r.status_code, r.text)
if r.ok:
    token=r.json()['token']
    headers={'Authorization':f'Bearer {token}'}
    me=requests.get(f'{API}/auth/me', headers=headers, timeout=10)
    print('me', me.status_code, me.text)
    merch=requests.get(f'{API}/merch', headers=headers, timeout=10)
    print('merch', merch.status_code, merch.text[:500])
