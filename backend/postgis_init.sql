-- 1. Enable Spatial Features
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Attach Geometry to Trip
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "sourceLocation" geometry(Point, 4326);
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "destLocation" geometry(Point, 4326);
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "returnLocation" geometry(Point, 4326);
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "routeLine" geometry(LineString, 4326);
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "returnCorridor" geometry(LineString, 4326);

-- 3. Attach Geometry to Load
ALTER TABLE "Load" ADD COLUMN IF NOT EXISTS "pickupLocation" geometry(Point, 4326);
ALTER TABLE "Load" ADD COLUMN IF NOT EXISTS "dropLocation" geometry(Point, 4326);

-- 4. Safe Dual-Write Migration for existing records
UPDATE "Trip" SET "sourceLocation" = ST_SetSRID(ST_MakePoint("sourceLng", "sourceLat"), 4326) WHERE "sourceLat" IS NOT NULL;
UPDATE "Trip" SET "destLocation" = ST_SetSRID(ST_MakePoint("destLng", "destLat"), 4326) WHERE "destLat" IS NOT NULL;
UPDATE "Trip" SET "returnLocation" = ST_SetSRID(ST_MakePoint(COALESCE("returnToLng", "sourceLng"), COALESCE("returnToLat", "sourceLat")), 4326) WHERE "returnToLat" IS NOT NULL OR "sourceLat" IS NOT NULL;

UPDATE "Load" SET "pickupLocation" = ST_SetSRID(ST_MakePoint("pickupLng", "pickupLat"), 4326) WHERE "pickupLat" IS NOT NULL;
UPDATE "Load" SET "dropLocation" = ST_SetSRID(ST_MakePoint("dropLng", "dropLat"), 4326) WHERE "dropLat" IS NOT NULL;

-- 5. Create Spatial Indexes
CREATE INDEX IF NOT EXISTS "trip_routeLine_idx" ON "Trip" USING GIST ("routeLine");
CREATE INDEX IF NOT EXISTS "trip_returnLoc_idx" ON "Trip" USING GIST ("returnLocation");
CREATE INDEX IF NOT EXISTS "load_pickupLoc_idx" ON "Load" USING GIST ("pickupLocation");
CREATE INDEX IF NOT EXISTS "load_dropLoc_idx" ON "Load" USING GIST ("dropLocation");
