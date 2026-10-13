import psycopg2
import json

conn = psycopg2.connect('postgresql://wayback:password@localhost:5432/wayback_db')
cur = conn.cursor()

print('=== 1. ACTIVE / RECENT TRIPS ===')
cur.execute("""
    SELECT t.id, t."driverId", u.name, t.status, t."sourceName", t."destName", t."returnToName", 
           t."sourceLat", t."sourceLng", t."destLat", t."destLng", t."returnToLat", t."returnToLng",
           t."sourceLocation" IS NOT NULL as has_source_loc,
           t."destLocation" IS NOT NULL as has_dest_loc,
           t."returnLocation" IS NOT NULL as has_ret_loc,
           t."routeLine" IS NOT NULL as has_route_line,
           t."availableWeight", t."availableVolume",
           v.type, v."capacityWeight", v."capacityVolume"
    FROM "Trip" t
    JOIN "User" u ON t."driverId" = u.id
    JOIN "Vehicle" v ON t."vehicleId" = v.id
    ORDER BY t."createdAt" DESC
    LIMIT 3;
""")
trips = cur.fetchall()
for t in trips:
    print(f"Trip ID: {t[0]}")
    print(f"  Driver: {t[2]} ({t[1]}), Status: {t[3]}")
    print(f"  From: {t[4]} -> To: {t[5]} -> Return To: {t[6]}")
    print(f"  Coords: Source=({t[7]}, {t[8]}), Dest=({t[9]}, {t[10]}), Return=({t[11]}, {t[12]})")
    print(f"  Geom Flags: sourceLoc={t[13]}, destLoc={t[14]}, returnLoc={t[15]}, routeLine={t[16]}")
    print(f"  Vehicle: {t[19]}, CapWeight={t[20]}, CapVol={t[21]}, AvailWeight={t[17]}, AvailVol={t[18]}")

print('\n=== 2. RECENT PENDING LOADS ===')
cur.execute("""
    SELECT l.id, l."customerId", u.name, l.status, l."pickupName", l."dropName",
           l."pickupLat", l."pickupLng", l."dropLat", l."dropLng",
           l."pickupLocation" IS NOT NULL as has_pickup_loc,
           l."dropLocation" IS NOT NULL as has_drop_loc,
           l.weight, l."volumeCbf", l."goodsCategory", l.budget, l."latestPickupAt"
    FROM "Load" l
    JOIN "User" u ON l."customerId" = u.id
    ORDER BY l."createdAt" DESC
    LIMIT 5;
""")
loads = cur.fetchall()
for l in loads:
    print(f"Load ID: {l[0]}")
    print(f"  Customer: {l[2]} ({l[1]}), Status: {l[3]}")
    print(f"  Pickup: {l[4]} ({l[6]}, {l[7]})")
    print(f"  Drop: {l[5]} ({l[8]}, {l[9]})")
    print(f"  Geom Flags: pickupLoc={l[10]}, dropLoc={l[11]}")
    print(f"  Weight={l[12]}, Vol={l[13]}, Category={l[14]}, Budget={l[15]}, LatestPickup={l[16]}")

print('\n=== 3. EXISTING RECOMMENDATIONS ===')
cur.execute("""
    SELECT r.id, r."tripId", r."loadId", r.score, r.status, r."matchQuality", r."createdAt"
    FROM "Recommendation" r
    ORDER BY r."createdAt" DESC
    LIMIT 5;
""")
recs = cur.fetchall()
for r in recs:
    print(f"Rec ID: {r[0]} | Trip: {r[1]} | Load: {r[2]} | Score: {r[3]} | Status: {r[4]} | Quality: {r[5]}")

conn.close()
