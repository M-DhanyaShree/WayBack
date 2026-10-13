import psycopg2

conn = psycopg2.connect('postgresql://wayback:password@localhost:5432/wayback_db')
cur = conn.cursor()

cur.execute("""
    SELECT t.id, t."driverId", t.status, t."sourceName", t."destName", t."returnToName", 
           t."availableWeight", t."availableVolume",
           v.type, v."capacityWeight", v."capacityVolume"
    FROM "Trip" t
    JOIN "Vehicle" v ON t."vehicleId" = v.id
    WHERE t.id = '0c48c7f4-adcf-43a5-9623-fe347742c9d7';
""")
row = cur.fetchone()
print("TRIP DETAILS:")
print("ID:", row[0])
print("DriverId:", row[1])
print("Status:", row[2])
print("Source:", row[3])
print("Dest:", row[4])
print("ReturnTo:", row[5])
print("availableWeight on Trip:", row[6])
print("availableVolume on Trip:", row[7])
print("Vehicle type:", row[8])
print("Vehicle capacityWeight:", row[9])
print("Vehicle capacityVolume:", row[10])

cur.execute("""
    SELECT l.id, l."customerId", l.status, l.weight, l."volumeCbf", l."goodsCategory", l.budget
    FROM "Load" l
    WHERE l.id = 'aa7a49cf-d054-4f6e-8b71-4ba8b94609e9';
""")
load_row = cur.fetchone()
print("\nLOAD DETAILS:")
print("ID:", load_row[0])
print("CustomerId:", load_row[1])
print("Status:", load_row[2])
print("Weight:", load_row[3])
print("Volume:", load_row[4])
print("Category:", load_row[5])
print("Budget:", load_row[6])

conn.close()
