import asyncio, traceback, sys
sys.path.insert(0, '.')
import server
from server import ReviewIn, User, iso, now_utc

async def main():
    try:
        await server.db.venues.delete_many({})
        await server.db.reviews.delete_many({})
        await server.db.users.delete_many({})
        # ensure venue
        await server.db.venues.insert_one({'venue_id':'venue_1','name':'Test Venue','price_per_hour':100,'created_at': iso(now_utc())})
        # create user in db
        await server.db.users.insert_one({'user_id':'u_test','name':'Tester','email':'t@example.com','role':'user','created_at': iso(now_utc()), 'wallet_balance':0, 'referral_code': None, 'wishlist': []})
        user_doc = await server.db.users.find_one({'user_id':'u_test'},{'_id':0})
        user = User(**user_doc)
        body = ReviewIn(target_type='venue', target_id='venue_1', rating=5, comment='great')
        res = await server.create_review(body, user)
        print('CREATE_REVIEW_OK:', res)
    except Exception:
        traceback.print_exc()

asyncio.run(main())
