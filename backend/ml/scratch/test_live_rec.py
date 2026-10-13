import psycopg2
import jwt
import urllib.request
import json
import datetime

conn = psycopg2.connect('postgresql://wayback:password@localhost:5432/wayback_db')
cur = conn.cursor()

cur.execute("""
    SELECT t.id, u.id, u.phone, u.role 
    FROM "Trip" t 
    JOIN "User" u ON t."driverId" = u.id 
    LIMIT 1
""")
row = cur.fetchone()
if not row:
    print('No trip found.')
else:
    trip_id, driver_id, phone, role = row
    print(f'Trip ID: {trip_id}, Driver ID: {driver_id}, Phone: {phone}')

    secret = 'dadc4f28-9e2d-4cce-9ca3-cfd2066f7330'
    payload = {
        'userId': driver_id,
        'role': role,
        'iat': int(datetime.datetime.utcnow().timestamp()),
        'exp': int((datetime.datetime.utcnow() + datetime.timedelta(hours=1)).timestamp())
    }
    token = jwt.encode(payload, secret, algorithm='HS256')

    req = urllib.request.Request(f'http://localhost:5000/api/v1/recommendations/trip/{trip_id}',
                                 headers={'Authorization': f'Bearer {token}'})
    res = urllib.request.urlopen(req)
    recs = json.loads(res.read().decode('utf-8'))
    print('Recommendations Response Status:', recs.get('status'))
    data = recs.get('data', [])
    print(f'Found {len(data)} recommendations:')
    for item in data[:3]:
        print(f" - Load ID: {item.get('load', {}).get('id')}")
        print(f"   Score: {item.get('score')}")
        print(f"   isMLFallback: {item.get('isMLFallback')}")
        print(f"   rawAcceptanceProb: {item.get('rawAcceptanceProb')}")
        print(f"   rawDeliveryProb: {item.get('rawDeliveryProb')}")
        print(f"   featureVector: {item.get('featureVector')[:5]}...")
