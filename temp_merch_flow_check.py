import requests, uuid
API='http://127.0.0.1:8001/api'
email=f'merchflow_{uuid.uuid4().hex[:8]}@example.com'
reg=requests.post(f'{API}/auth/register', json={'name':'Flow Test','email':email,'password':'TestPass123!','role':'user'}, timeout=10)
print('register', reg.status_code)
token=reg.json()['token']
headers={'Authorization':f'Bearer {token}','Content-Type':'application/json'}
add=requests.post(f'{API}/merch/cart', headers=headers, json={'item_id':'m1','size':'M','color':'Black','quantity':1}, timeout=10)
print('add', add.status_code, add.text)
checkout=requests.post(f'{API}/merch/checkout', headers=headers, json={'items':[{'item_id':'m1','size':'M','color':'Black','quantity':1}], 'shipping_address':'123 Test','phone':'9999999999','email':email,'payment_method':'cod','name':'Flow Test'}, timeout=10)
print('checkout', checkout.status_code, checkout.text)
orders=requests.get(f'{API}/me/merch/orders', headers=headers, timeout=10)
print('orders', orders.status_code, orders.text)
