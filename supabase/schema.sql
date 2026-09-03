-- =============================================================================
-- GeoVibe - Supabase Database Schema & Initial Setup
-- Run this in your Supabase SQL Editor (Dashboard -> SQL Editor)
-- =============================================================================

-- 1. Enable PostGIS Extension for geospatial calculations
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Pins Table
CREATE TABLE IF NOT EXISTS public.pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  venue_name TEXT NOT NULL,
  city TEXT,
  summary TEXT,
  category TEXT NOT NULL CHECK (category IN ('Food', 'Drinks', 'Activity', 'Other')) DEFAULT 'Other',
  suggested_dwell_time INTEGER NOT NULL DEFAULT 60,
  source_url TEXT,
  location GEOMETRY(Point, 4326) DEFAULT ST_SetSRID(ST_MakePoint(0, 0), 4326),
  status TEXT NOT NULL CHECK (status IN ('processing', 'completed', 'failed')) DEFAULT 'processing',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Spatial index and lookup indexes for pins
CREATE INDEX IF NOT EXISTS pins_location_idx ON public.pins USING GIST(location);
CREATE INDEX IF NOT EXISTS pins_user_id_idx ON public.pins(user_id);
CREATE INDEX IF NOT EXISTS pins_source_url_idx ON public.pins(source_url);
CREATE INDEX IF NOT EXISTS pins_status_idx ON public.pins(status);

-- 3. Itineraries Table
CREATE TABLE IF NOT EXISTS public.itineraries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  traveller_type TEXT NOT NULL CHECK (traveller_type IN ('fast', 'typical', 'slow')) DEFAULT 'typical',
  is_public BOOLEAN NOT NULL DEFAULT false,
  share_slug TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS itineraries_created_by_idx ON public.itineraries(created_by);
CREATE INDEX IF NOT EXISTS itineraries_share_slug_idx ON public.itineraries(share_slug);

-- 4. Itinerary Stops Table
CREATE TABLE IF NOT EXISTS public.itinerary_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  itinerary_id UUID NOT NULL REFERENCES public.itineraries(id) ON DELETE CASCADE,
  pin_id UUID NOT NULL REFERENCES public.pins(id) ON DELETE CASCADE,
  stop_order INTEGER NOT NULL,
  dwell_time_minutes INTEGER NOT NULL DEFAULT 60,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS itinerary_stops_itinerary_id_idx ON public.itinerary_stops(itinerary_id);
CREATE INDEX IF NOT EXISTS itinerary_stops_pin_id_idx ON public.itinerary_stops(pin_id);

-- 5. Itinerary Legs (Routes) Table
CREATE TABLE IF NOT EXISTS public.itinerary_legs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  itinerary_id UUID NOT NULL REFERENCES public.itineraries(id) ON DELETE CASCADE,
  from_stop_id UUID NOT NULL REFERENCES public.itinerary_stops(id) ON DELETE CASCADE,
  to_stop_id UUID NOT NULL REFERENCES public.itinerary_stops(id) ON DELETE CASCADE,
  transport_mode TEXT NOT NULL CHECK (transport_mode IN ('walking', 'driving', 'transit', 'bicycling')) DEFAULT 'transit',
  duration_seconds INTEGER NOT NULL,
  distance_meters INTEGER NOT NULL,
  polyline TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS itinerary_legs_itinerary_id_idx ON public.itinerary_legs(itinerary_id);

-- 6. Enable Realtime Replication for Pins
-- This powers the live map pin updates when Inngest finishes processing
ALTER PUBLICATION supabase_realtime ADD TABLE public.pins;

-- 7. Row Level Security (RLS) Policies
ALTER TABLE public.pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itineraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itinerary_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itinerary_legs ENABLE ROW LEVEL SECURITY;

-- Pins Policies:
-- Allow everyone (including guests) to view pins on the shared map
CREATE POLICY "Pins are viewable by everyone" 
  ON public.pins FOR SELECT 
  USING (true);

-- Authenticated users can insert their own pins
CREATE POLICY "Users can insert their own pins" 
  ON public.pins FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own pins
CREATE POLICY "Users can update their own pins" 
  ON public.pins FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = user_id);

-- Users can delete their own pins
CREATE POLICY "Users can delete their own pins" 
  ON public.pins FOR DELETE 
  TO authenticated 
  USING (auth.uid() = user_id);

-- Service role bypasses RLS automatically (used by Inngest background jobs)

-- Itineraries Policies:
-- Users can view their own itineraries, or public itineraries
CREATE POLICY "Users can view own or public itineraries" 
  ON public.itineraries FOR SELECT 
  USING (auth.uid() = created_by OR is_public = true);

CREATE POLICY "Users can insert their own itineraries" 
  ON public.itineraries FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own itineraries" 
  ON public.itineraries FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own itineraries" 
  ON public.itineraries FOR DELETE 
  TO authenticated 
  USING (auth.uid() = created_by);

-- Itinerary Stops Policies:
CREATE POLICY "Stops are viewable if itinerary is viewable" 
  ON public.itinerary_stops FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.itineraries 
      WHERE itineraries.id = itinerary_stops.itinerary_id 
        AND (itineraries.created_by = auth.uid() OR itineraries.is_public = true)
    )
  );

CREATE POLICY "Users can manage stops for their own itineraries" 
  ON public.itinerary_stops FOR ALL 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.itineraries 
      WHERE itineraries.id = itinerary_stops.itinerary_id 
        AND itineraries.created_by = auth.uid()
    )
  );

-- Itinerary Legs Policies:
CREATE POLICY "Legs are viewable if itinerary is viewable" 
  ON public.itinerary_legs FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.itineraries 
      WHERE itineraries.id = itinerary_legs.itinerary_id 
        AND (itineraries.created_by = auth.uid() OR itineraries.is_public = true)
    )
  );

CREATE POLICY "Users can manage legs for their own itineraries" 
  ON public.itinerary_legs FOR ALL 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.itineraries 
      WHERE itineraries.id = itinerary_legs.itinerary_id 
        AND itineraries.created_by = auth.uid()
    )
  );
