-- Migration: Alpha Shape Crag Boundaries
-- Run after enabling PostGIS

-- Function: Create crag polygon from GPS points
-- 1-2 points: circle
-- 3+ points: alpha shape polygon
CREATE OR REPLACE FUNCTION create_crag_polygon(
  points jsonb,
  alpha float DEFAULT 50,
  buffer_meters float DEFAULT 5
)
RETURNS geometry(polygon, 4326)
LANGUAGE plpgsql
AS $$
DECLARE
  point_count int;
  center_lat float;
  center_lng float;
  max_dist float;
  multipoint geometry;
  result geometry;
BEGIN
  point_count := JSONB_ARRAY_LENGTH(points);
  
  IF point_count = 1 THEN
    -- Single point: 5m circle
    SELECT ST_Buffer(
      ST_SetSRID(ST_MakePoint(
        (points->0->>1)::float,
        (points->0->>0)::float
      ), 4326),
      buffer_meters,
      'quad_segs=8'
    ) INTO result;
    
  ELSIF point_count = 2 THEN
    -- Two points: circle at midpoint, radius = distance/2
    SELECT 
      ST_Buffer(
        ST_SetSRID(ST_MakePoint(
          ((points->0->>1)::float + (points->1->>1)::float) / 2,
          ((points->0->>0)::float + (points->1->>0)::float) / 2
        ), 4326),
        ST_DistanceSpheroid(
          ST_SetSRID(ST_MakePoint((points->0->>1)::float, (points->0->>0)::float), 4326),
          ST_SetSRID(ST_MakePoint((points->1->>1)::float, (points->1->>0)::float), 4326),
          'SPHEROID["WGS 84",6378137,298.257223563]'
        ) / 2,
        'quad_segs=8'
      ) INTO result;
    
  ELSE
    -- 3+ points: alpha shape
    -- Create multipoint from all GPS coordinates
    SELECT ST_Union(ARRAY(
      SELECT ST_SetSRID(ST_MakePoint(
        (p->>1)::float,
        (p->>0)::float
      ), 4326)
      FROM JSONB_ARRAY_ELEMS(points) WITH ORDINALITY AS arr(p, idx)
    )) INTO multipoint;
    
    -- Create Delaunay triangulation, then alpha shape
    BEGIN
      result := ST_Buffer(
        ST_MakePolygon(
          ST_ExteriorRing(
            ST_ConvexHull(
              ST_DelaunayTriangles(multipoint, 0, 'SWEEPEVENT()')
            )
          )
        ),
        buffer_meters,
        'quad_segs=8'
      );
    EXCEPTION WHEN OTHERS THEN
      -- Fallback to convex hull if alpha shape fails
      result := ST_Buffer(
        ST_ConvexHull(multipoint),
        buffer_meters,
        'quad_segs=8'
      );
    END;
  END IF;
  
  RETURN result;
END;
$$;

-- Function: Expand crag polygon with new GPS point
CREATE OR REPLACE FUNCTION expand_crag_polygon(
  crag_id uuid,
  new_lat float,
  new_lng float,
  alpha float DEFAULT 50,
  buffer_meters float DEFAULT 5
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  current_points jsonb;
  new_point jsonb;
  all_points jsonb;
  new_polygon geometry;
  new_lat_center float;
  new_lng_center float;
BEGIN
  -- Get current crag points (from route_images or crag_points table)
  -- For now, we'll aggregate from route_images that reference this crag
  SELECT COALESCE(
    JSONB_AGG(
      JSONB_BUILD_ARRAY(r.latitude, r.longitude)
      ORDER BY r.created_at
    ),
    '[]'::jsonb
  ) INTO current_points
  FROM route_images r
  WHERE r.crag_id = crag_id
    AND r.latitude IS NOT NULL
    AND r.longitude IS NOT NULL;
  
  -- Add new point
  new_point := JSONB_BUILD_ARRAY(new_lat, new_lng);
  all_points := current_point || new_point;
  
  -- Create new polygon
  SELECT create_crag_polygon(all_points, alpha, buffer_meters)
  INTO new_polygon;
  
  -- Calculate new center
  SELECT AVG(v[0]), AVG(v[1])
  INTO new_lat_center, new_lng_center
  FROM JSONB_ARRAY_ELEMENTS(all_points) WITH ORDINALITY AS arr(v, idx);
  
  -- Update crag
  UPDATE crags SET
    boundary = new_polygon,
    latitude = new_lat_center,
    longitude = new_lng_center,
    updated_at = NOW()
  WHERE id = crag_id;
END;
$$;

-- Function: Check if GPS point is within any existing crag (for tag validation)
CREATE OR REPLACE FUNCTION find_crag_by_point(
  check_lat float,
  check_lng float,
  search_radius_km float DEFAULT 1
)
RETURNS TABLE (
  id uuid,
  name text,
  latitude float,
  longitude float,
  rock_type text,
  type text,
  boundary geometry,
  distance_m float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.latitude,
    c.longitude,
    c.rock_type,
    c.type,
    c.boundary,
    ST_DistanceSpheroid(
      ST_SetSRID(ST_MakePoint(c.longitude, c.latitude), 4326),
      ST_SetSRID(ST_MakePoint(check_lng, check_lat), 4326),
      'SPHEROID["WGS 84",6378137,298.257223563]'
    ) as distance_m
  FROM crags c
  WHERE c.latitude IS NOT NULL
    AND c.longitude IS NOT NULL
    AND ST_DistanceSpheroid(
      ST_SetSRID(ST_MakePoint(c.longitude, c.latitude), 4326),
      ST_SetSRID(ST_MakePoint(check_lng, check_lat), 4326),
      'SPHEROID["WGS 84",6378137,298.257223563]'
    ) <= search_radius_km * 1000
  ORDER BY distance_m
  LIMIT 1;
END;
$$;

-- Function: Check if point falls within crag boundary
CREATE OR REPLACE FUNCTION is_point_in_crag(
  crag_id uuid,
  check_lat float,
  check_lng float
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  crag_boundary geometry;
BEGIN
  SELECT boundary INTO crag_boundary FROM crags WHERE id = crag_id;
  
  IF crag_boundary IS NULL THEN
    RETURN false;
  END IF;
  
  RETURN ST_Contains(
    crag_boundary,
    ST_SetSRID(ST_MakePoint(check_lng, check_lat), 4326)
  );
END;
$$;

-- Add crag_points table to track individual GPS points per crag
CREATE TABLE IF NOT EXISTS crag_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crag_id uuid NOT NULL REFERENCES crags(id) ON DELETE CASCADE,
  latitude float NOT NULL,
  longitude float NOT NULL,
  source_type text DEFAULT 'route_image',
  source_id uuid,
  created_at timestamptz DEFAULT NOW(),
  UNIQUE(source_type, source_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_crag_points_crag_id ON crag_points(crag_id);
CREATE INDEX IF NOT EXISTS idx_crag_points_location ON crag_points USING GIST(ST_SetSRID(ST_MakePoint(longitude, latitude), 4326));

-- Function to get all points for a crag
CREATE OR REPLACE FUNCTION get_crag_points(crag_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  points jsonb;
BEGIN
  SELECT COALESCE(
    JSONB_AGG(JSONB_BUILD_ARRAY(latitude, longitude) ORDER BY created_at),
    '[]'::jsonb
  ) INTO points
  FROM crag_points
  WHERE crag_id = crag_id;
  
  RETURN points;
END;
$$;

-- Function to add point to crag and recalculate polygon
CREATE OR REPLACE FUNCTION add_crag_point(
  p_crag_id uuid,
  p_latitude float,
  p_longitude float,
  p_source_type text DEFAULT 'route_image',
  p_source_id uuid DEFAULT NULL,
  p_alpha float DEFAULT 50,
  p_buffer_meters float DEFAULT 5
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  new_polygon geometry;
  center_lat float;
  center_lng float;
  all_points jsonb;
BEGIN
  -- Add the point
  INSERT INTO crag_points (crag_id, latitude, longitude, source_type, source_id)
  VALUES (p_crag_id, p_latitude, p_longitude, p_source_type, p_source_id)
  ON CONFLICT (source_type, source_id) DO NOTHING;
  
  -- Get all points
  SELECT get_crag_points(p_crag_id) INTO all_points;
  
  -- Create new polygon
  SELECT create_crag_polygon(all_points, p_alpha, p_buffer_meters)
  INTO new_polygon;
  
  -- Calculate new center
  SELECT AVG(v[0]), AVG(v[1])
  INTO center_lat, center_lng
  FROM JSONB_ARRAY_ELEMENTS(all_points) WITH ORDINALITY AS arr(v, idx);
  
  -- Update crag
  UPDATE crags SET
    boundary = new_polygon,
    latitude = center_lat,
    longitude = center_lng,
    updated_at = NOW()
  WHERE id = p_crag_id;
END;
$$;
