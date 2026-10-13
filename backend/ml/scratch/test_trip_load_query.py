import psycopg2

conn = psycopg2.connect('postgresql://wayback:password@localhost:5432/wayback_db')
cur = conn.cursor()

trip_id = '0c48c7f4-adcf-43a5-9623-fe347742c9d7'

print(f"Testing spatial query for Trip: {trip_id}")

cur.execute("""
    SELECT t.id, t."sourceName", t."destName", t."returnToName", 
           t."availableWeight", t."availableVolume",
           v."capacityWeight", v."capacityVolume"
    FROM "Trip" t
    JOIN "Vehicle" v ON t."vehicleId" = v.id
    WHERE t.id = %s
""", (trip_id,))
trip_info = cur.fetchone()
print(f"Trip: {trip_info[1]} -> {trip_info[2]} -> {trip_info[3]}")
print(f"Trip availableWeight: {trip_info[4]} | Vehicle capacityWeight: {trip_info[6]}")

cur.execute("""
    SELECT l.id, l."pickupName", l."dropName", l.weight, l."volumeCbf", l.status,
           ST_Distance(l."pickupLocation"::geography, t."destLocation"::geography) as dist_pickup_to_dest,
           ST_Distance(l."dropLocation"::geography, t."returnLocation"::geography) as dist_drop_to_return,
           ST_DWithin(l."pickupLocation"::geography, t."destLocation"::geography, 30000) as pickup_in_radius,
           ST_DWithin(l."dropLocation"::geography, t."returnLocation"::geography, 30000) as drop_in_radius
    FROM "Load" l
    CROSS JOIN "Trip" t
    WHERE t.id = %s
      AND l.status IN ('PENDING', 'SCHEDULED')
""", (trip_id,))

rows = cur.fetchall()
print(f"\nFound {len(rows)} pending loads in DB:")
for r in rows:
    load_id, p_name, d_name, weight, vol, status, d_p, d_d, in_p, in_d = r
    print(f"\nLoad ID: {load_id}")
    print(f"  Pickup: {p_name} | Drop: {d_name}")
    print(f"  Weight: {weight} kg | Vol: {vol} cbf | Status: {status}")
    print(f"  Distance Pickup -> Trip Dest: {d_p/1000.0:.2f} km (In 30km radius: {in_p})")
    print(f"  Distance Drop -> Trip Return: {d_d/1000.0:.2f} km (In 30km radius: {in_d})")

conn.close()
