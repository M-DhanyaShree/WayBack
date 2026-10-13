import os
import psycopg2
import pandas as pd
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

DATABASE_URL = os.getenv('DATABASE_URL')


def get_connection():
    return psycopg2.connect(DATABASE_URL)


def extract_recommendation_dataset() -> pd.DataFrame:
    conn = get_connection()
    query = """
        SELECT
            r.id,
            r.route_overlap,
            r.distance_deviation,
            r.capacity_utilization,
            r.time_compatibility,
            r.score,
            CASE r.vehicle_type
                WHEN 'TRUCK'      THEN 0
                WHEN 'MINI_TRUCK' THEN 1
                WHEN 'PICKUP'     THEN 2
                WHEN 'TEMPO'      THEN 3
                WHEN 'VAN'        THEN 4
                ELSE 5
            END AS vehicle_type_enc,
            r.trip_source_lat,
            r.trip_source_lng,
            r.trip_dest_lat,
            r.trip_dest_lng,
            r.load_pickup_lat,
            r.load_pickup_lng,
            r.load_drop_lat,
            r.load_drop_lng,
            COALESCE(r.cust_reliability, 5.0) AS cust_reliability,
            CASE r.status
                WHEN 'ACCEPTED' THEN 1
                ELSE 0
            END AS accepted,
            CASE r.status
                WHEN 'COMPLETED' THEN 1
                ELSE 0
            END AS delivery_success
        FROM "Recommendation" r
        WHERE r.status IN ('ACCEPTED', 'REJECTED', 'COMPLETED', 'CANCELLED')
    """
    df = pd.read_sql(query, conn)
    conn.close()
    return df


FEATURE_COLUMNS = [
    'route_overlap',
    'distance_deviation',
    'capacity_utilization',
    'time_compatibility',
    'vehicle_type_enc',
    'trip_source_lat',
    'trip_source_lng',
    'trip_dest_lat',
    'trip_dest_lng',
    'load_pickup_lat',
    'load_pickup_lng',
    'load_drop_lat',
    'load_drop_lng',
    'cust_reliability',
]
