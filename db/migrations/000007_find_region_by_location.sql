-- Migration: Add region lookup by location function
-- Run after enabling PostGIS

CREATE OR REPLACE FUNCTION find_region_by_location(
  search_lat double precision,
  search_lng double precision
)
RETURNS TABLE (
  id uuid,
  name text,
  country_code text,
  center_lat double precision,
  center_lon double precision
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.name,
    r.country_code,
    r.center_lat,
    r.center_lon
  FROM regions r
  WHERE r.center_lat IS NOT NULL 
    AND r.center_lon IS NOT NULL
    AND ST_DWithin(
      ST_SetSRID(ST_MakePoint(r.center_lon, r.center_lat), 4326),
      ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326),
      50000  -- 50km radius
    )
  ORDER BY 
    ST_Distance(
      ST_SetSRID(ST_MakePoint(r.center_lon, r.center_lat), 4326),
      ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326)
    )
  LIMIT 1;
END;
$$;
