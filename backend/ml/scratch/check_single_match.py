import psycopg2

conn = psycopg2.connect('postgresql://wayback:password@localhost:5432/wayback_db')
cur = conn.cursor()

trip_id = '0c48c7f4-adcf-43a5-9623-fe347742c9d7'
load_id = 'aa7a49cf-d054-4f6e-8b71-4ba8b94609e9'

cur.execute("""
    SELECT 
        l.weight,
        l."volumeCbf",
        t."availableWeight",
        t."availableVolume",
        v."capacityWeight",
        v."capacityVolume",
        ST_Distance(l."pickupLocation"::geography, t."destLocation"::geography) as d_pickup_to_dest,
        ST_Distance(l."dropLocation"::geography, t."returnLocation"::geography) as d_drop_to_return,
        ST_DWithin(l."pickupLocation"::geography, t."destLocation"::geography, 30000) as in_p,
        ST_DWithin(l."dropLocation"::geography, t."returnLocation"::geography, 30000) as in_d,
        l."pickupLocation" IS NOT NULL as has_pickup_geom,
        l."dropLocation" IS NOT NULL as has_drop_geom,
        t."destLocation" IS NOT NULL as has_dest_geom,
        t."returnLocation" IS NOT NULL as has_ret_geom
    FROM "Load" l
    CROSS JOIN "Trip" t
    JOIN "Vehicle" v ON t."vehicleId" = v.id
    WHERE t.id = %s AND l.id = %s
""", (trip_id, load_id))

r = cur.fetchone()
print('Load weight:', r[0], 'kg')
print('Load volume:', r[1], 'cbf')
print('Trip availableWeight:', r[2], 'kg')
print('Trip availableVolume:', r[3], 'cbf')
print('Vehicle capacityWeight:', r[4], 'kg')
print('Vehicle capacityVolume:', r[5], 'cbf')
print('Distance Pickup -> Trip Dest:', r[6]/1000.0, 'km (In 30km radius:', r[8], ')')
print('Distance Drop -> Trip Return:', r[7]/1000.0, 'km (In 30km radius:', r[9], ')')
print('Geometry Flags: has_pickup_geom =', r[10], ', has_drop_geom =', r[11], ', has_dest_geom =', r[12], ', has_ret_geom =', r[13])

conn.close()
