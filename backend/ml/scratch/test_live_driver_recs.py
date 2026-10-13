import psycopg2
import jwt
import urllib.request
import json
import datetime

conn = psycopg2.connect('postgresql://wayback:password@localhost:5432/wayback_db')
cur = conn.cursor()

trip_id = '0c48c7f4-adcf-43a5-9623-fe347742c9d7'
cur.execute('SELECT "driverId" FROM "Trip" WHERE id = %s', (trip_id,))
driver_id = cur.fetchone()[0]

secret = 'dadc4f28-9e2d-4cce-9ca3-cfd2066f7330'
payload = {
    'userId': driver_id,
    'role': 'DRIVER',
    'iat': int(datetime.datetime.utcnow().timestamp()),
    'exp': int((datetime.datetime.utcnow() + datetime.timedelta(hours=1)).timestamp())
}
token = jwt.encode(payload, secret, algorithm='HS256')

req = urllib.request.Request(f'http://localhost:5000/api/v1/recommendations/trip/{trip_id}',
                             headers={'Authorization': f'Bearer {token}'})
res = urllib.request.urlopen(req)
data = json.loads(res.read().decode('utf-8'))
print('API Response Status:', data.get('status'))
recs = data.get('data', {}).get('recommendations', [])
print(f'Total Recommendations Returned: {len(recs)}')
for r in recs:
    print(f"- Load: {r['load']['goodsCategory']} ({r['load']['weight']} kg) | Score: {r['score']} | Match: {r['matchQuality']}")
    print(f"  Pickup: {r['load']['pickupName']} -> Drop: {r['load']['dropName']}")

conn.close()
