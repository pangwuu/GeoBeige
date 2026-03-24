"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { generateItineraryFromPins } from "@/lib/ai/gemini";
import { getDirections, TransportMode } from "@/lib/google/directions";
import { decodePostGISPoint } from "@/lib/utils/postgis";
import { revalidatePath } from "next/cache";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getAISuggestedItinerary(prompt: string, suburb?: string) {
  // Fetch pins in the relevant area
  let query = supabaseAdmin.from('pins').select('*').eq('status', 'completed');
  if (suburb) {
    query = query.ilike('city', `%${suburb}%`);
  }
  
  const { data: pins, error } = await query;
  if (error || !pins) {
    return { error: "Failed to fetch nearby locations." };
  }

  // Call Gemini to structure the itinerary
  try {
    const suggestion = await generateItineraryFromPins(pins, prompt);
    return { success: true, suggestion };
  } catch (error) {
    return { error: "Failed to generate itinerary with AI." };
  }
}

export async function generateRouteData(stopPinIds: string[], transportMode: TransportMode = 'transit') {
  // Fetch the pins to get their coordinates
  const { data: pins, error } = await supabaseAdmin
    .from('pins')
    .select('id, location, venue_name')
    .in('id', stopPinIds);

  if (error || !pins || pins.length < 2) {
    return { error: "Need at least 2 valid locations to generate a route." };
  }

  // Ensure pins are in the correct order as requested
  const orderedPins = stopPinIds.map(id => pins.find(p => p.id === id)).filter(Boolean);

  // Calculate directions for each leg (A -> B, B -> C...)
  const legs = [];
  for (let i = 0; i < orderedPins.length - 1; i++) {
    const originPin = orderedPins[i];
    const destPin = orderedPins[i + 1];

    if (!originPin || !destPin) continue;

    const originCoords = decodePostGISPoint(originPin.location);
    const destCoords = decodePostGISPoint(destPin.location);

    if (!originCoords || !destCoords) {
      continue;
    }

    try {
      const directions = await getDirections(
        { lat: originCoords.lat, lng: originCoords.lng },
        { lat: destCoords.lat, lng: destCoords.lng },
        transportMode
      );
      legs.push({
        from_pin_id: originPin.id,
        to_pin_id: destPin.id,
        ...directions
      });
    } catch (err) {
    }
  }

  return { success: true, legs };
}

export async function saveItinerary(itinerary: {
  title: string;
  description?: string;
  stops: { pinId: string; dwell_time_minutes: number; notes?: string }[];
  legs: { from_pin_id: string; to_pin_id: string; polyline: string; duration_seconds: number; distance_meters: number; mode: TransportMode }[];
}) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    return { error: "You must be signed in to save an itinerary." };
  }

  const userId = userData.user.id;

  try {
    // 1. Create Itinerary
    const { data: newItinerary, error: itinError } = await supabaseAdmin
      .from('itineraries')
      .insert({
        title: itinerary.title,
        description: itinerary.description,
        created_by: userId
      })
      .select()
      .single();

    if (itinError) throw itinError;

    // 2. Create Stops
    const stopInserts = itinerary.stops.map((stop, index) => ({
      itinerary_id: newItinerary.id,
      pin_id: stop.pinId,
      stop_order: index + 1,
      dwell_time_minutes: stop.dwell_time_minutes,
      notes: stop.notes
    }));

    const { data: newStops, error: stopsError } = await supabaseAdmin
      .from('itinerary_stops')
      .insert(stopInserts)
      .select();

    if (stopsError) throw stopsError;

    // 3. Create Legs
    const legInserts = itinerary.legs.map((leg) => {
      const fromStop = newStops.find(s => s.pin_id === leg.from_pin_id);
      const toStop = newStops.find(s => s.pin_id === leg.to_pin_id);
      
      // Ensure transport mode is lowercase to match database CHECK constraint
      // and provide fallback if missing
      const rawMode = (leg.mode || 'transit').toLowerCase();
      const dbMode = rawMode === 'walk' ? 'walking' : 
                     rawMode === 'drive' ? 'driving' :
                     rawMode === 'bicycle' ? 'bicycling' : rawMode;

      return {
        itinerary_id: newItinerary.id,
        from_stop_id: fromStop.id,
        to_stop_id: toStop.id,
        transport_mode: dbMode,
        duration_seconds: leg.duration_seconds,
        distance_meters: leg.distance_meters,
        polyline: leg.polyline
      };
    });

    const { error: legsError } = await supabaseAdmin
      .from('itinerary_legs')
      .insert(legInserts);

    if (legsError) throw legsError;

    revalidatePath("/");
    return { success: true, itineraryId: newItinerary.id };
  } catch (err) {
    return { error: "An error occurred while saving your itinerary." };
  }
}

export async function getItineraries() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    return { success: true, itineraries: [] };
  }

  const { data, error } = await supabaseAdmin
    .from('itineraries')
    .select(`
      *,
      stops:itinerary_stops(
        *,
        pin:pins(*)
      ),
      legs:itinerary_legs(*)
    `)
    .eq('created_by', userData.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return { error: "Failed to fetch itineraries." };
  }

  return { success: true, itineraries: data };
}

export async function deleteItinerary(id: string) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) return { error: "Unauthorized" };

  const { error } = await supabaseAdmin
    .from('itineraries')
    .delete()
    .eq('id', id)
    .eq('created_by', userData.user.id);

  if (error) {
    return { error: "Failed to delete itinerary." };
  }

  revalidatePath("/");
  return { success: true };
}

export async function updateItinerary(id: string, updates: { title?: string; description?: string }) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) return { error: "Unauthorized" };

  const { error } = await supabaseAdmin
    .from('itineraries')
    .update(updates)
    .eq('id', id)
    .eq('created_by', userData.user.id);

  if (error) {
    return { error: "Failed to update itinerary." };
  }

  revalidatePath("/");
  return { success: true };
}

export async function optimiseRoute(stopPinIds: string[]) {
  if (stopPinIds.length < 2) return { success: true, optimizedIds: stopPinIds };
  if (stopPinIds.length > 6) return { error: "Too many stops to optimize." };

  // Fetch pin coordinates
  const { data: pins, error } = await supabaseAdmin
    .from('pins')
    .select('id, location')
    .in('id', stopPinIds);

  if (error || !pins) return { error: "Failed to fetch pin locations." };

  const coordsMap = new Map();
  pins.forEach(p => {
    const c = decodePostGISPoint(p.location);
    if (c) coordsMap.set(p.id, c);
  });

  // Simple Haversine distance for optimization
  const getDistance = (p1: any, p2: any) => {
    const R = 6371;
    const dLat = (p2.lat - p1.lat) * Math.PI / 180;
    const dLon = (p2.lng - p1.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  // Generate all permutations
  const getPermutations = (arr: any[]): any[][] => {
    if (arr.length <= 1) return [arr];
    const perms = [];
    for (let i = 0; i < arr.length; i++) {
      const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
      const innerPerms = getPermutations(rest);
      for (const p of innerPerms) {
        perms.push([arr[i], ...p]);
      }
    }
    return perms;
  };

  const permutations = getPermutations(stopPinIds);
  let bestOrder = stopPinIds;
  let minDistance = Infinity;

  permutations.forEach(order => {
    let totalDist = 0;
    for (let i = 0; i < order.length - 1; i++) {
      const c1 = coordsMap.get(order[i]);
      const c2 = coordsMap.get(order[i + 1]);
      if (c1 && c2) totalDist += getDistance(c1, c2);
    }
    if (totalDist < minDistance) {
      minDistance = totalDist;
      bestOrder = order;
    }
  });

  return { success: true, optimizedIds: bestOrder };
}
