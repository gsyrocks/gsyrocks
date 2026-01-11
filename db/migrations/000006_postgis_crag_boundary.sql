-- Migration: Add PostGIS support and nearby crags function
-- Run after enabling PostGIS extension and adding boundary column

-- Create function to find crags near a location using PostGIS
-- Returns crags ordered by distance from the search point
CREATE OR REPLACE FUNCTION find_crags_near_location(
  search_lat double precision,
  search_lng double precision,
  radius_km double precision DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  name text,
  latitude double precision,
  longitude double precision,
  region_id uuid,
  rock_type text,
  type text,
  boundary geometry(polygon, 4326),
  distance_km double precision,
  contains_point boolean
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH search_point AS (
    SELECT ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326) as geom
  )
  SELECT
    c.id,
    c.name,
    c.latitude,
    c.longitude,
    c.region_id,
    c.rock_type,
    c.type,
    c.boundary,
    CASE
      WHEN c.boundary IS NOT NULL THEN
        ST_DistanceSpheroid(
          ST_Centroid(c.boundary),
          ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326),
          'SPHEROID["WGS 84",6378137,298.257223563]'
        ) / 1000
      ELSE
        ST_DistanceSpheroid(
          ST_SetSRID(ST_MakePoint(c.longitude, c.latitude), 4326),
          ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326),
          'SPHEROID["WGS 84",6378137,298.257223563]'
        ) / 1000
    END as distance_km,
    CASE
      WHEN c.boundary IS NOT NULL THEN
        ST_Contains(c.boundary, ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326))
      ELSE false
    END as contains_point
  FROM crags c, search_point sp
  WHERE
    CASE
      WHEN c.boundary IS NOT NULL THEN
        ST_DWithin(
          c.boundary,
          ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326),
          radius_km * 1000
        )
      ELSE
        ST_DistanceSpheroid(
          ST_SetSRID(ST_MakePoint(c.longitude, c.latitude), 4326),
          ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326),
          'SPHEROID["WGS 84",6378137,298.257223563]'
        ) <= radius_km * 1000
    END
  ORDER BY
    contains_point DESC,
    distance_km ASC;
END;
$$;

-- Function to convert polygon vertices to PostGIS geometry
CREATE OR REPLACE FUNCTION vertices_to_polygon(vertices jsonb)
RETURNS geometry(polygon, 4326)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN ST_SetSRID(
    ST_MakePolygon(
      ST_MakeLine(
        ARRAY(
          SELECT JSONB_ARRAY_ELEMS(vertices) ->> 0::double precision,
                 JSONB_ARRAY_ELEMS(vertices) ->> 1::double precision
          FROM JSONB_ARRAY_ELEMS(vertices) WITH ORDINALITY AS arr(v, idx)
          ORDER BY idx
        )
      )
    ),
    4326
  );
END;
$$;
