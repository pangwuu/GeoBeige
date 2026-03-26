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
  traveller_type?: 'fast' | 'typical' | 'slow';
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
        traveller_type: itinerary.traveller_type || 'typical',
        created_by: userId
      })
      .select()
      .single();

    if (itinError) throw new Error("Could not create the itinerary record.");

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

    if (stopsError) throw new Error("Failed to link locations to your itinerary.");

    // 3. Create Legs
    const legInserts = itinerary.legs.map((leg) => {
      const fromStop = newStops.find(s => s.pin_id === leg.from_pin_id);
      const toStop = newStops.find(s => s.pin_id === leg.to_pin_id);
      
      // Ensure transport mode is lowercase to match database CHECK constraint
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

    if (legsError) throw new Error("Failed to save the route timing between stops.");

    revalidatePath("/");
    return { success: true, itineraryId: newItinerary.id };
  } catch (err: any) {
    return { error: err.message || "Something went wrong while saving." };
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

export async function toggleItineraryPrivacy(id: string, isPublic: boolean) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) return { error: "Unauthorized" };

  try {
    let slug = null;
    if (isPublic) {
      // Get current slug or generate new one
      const { data: current } = await supabaseAdmin
        .from('itineraries')
        .select('share_slug, title')
        .eq('id', id)
        .single();

      if (!current?.share_slug) {
        const baseSlug = (current?.title || 'trip')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
        const randomStr = Math.random().toString(36).substring(2, 7);
        slug = `${baseSlug}-${randomStr}`;
      } else {
        slug = current.share_slug;
      }
    }

    const { error } = await supabaseAdmin
      .from('itineraries')
      .update({ 
        is_public: isPublic,
        share_slug: slug
      })
      .eq('id', id)
      .eq('created_by', userData.user.id);

    if (error) throw error;

    revalidatePath("/");
    return { success: true, slug };
  } catch (error) {
    return { error: "Failed to update sharing settings." };
  }
}

export async function getPublicItinerary(slug: string) {
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
    .eq('share_slug', slug)
    .eq('is_public', true)
    .single();

  if (error || !data) {
    return { error: "Itinerary not found or is private." };
  }

  return { success: true, itinerary: data };
}

export async function updateItinerary(id: string, updates: { title?: string; description?: string; traveller_type?: 'fast' | 'typical' | 'slow' }) {
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

  const { data: pins, error } = await supabaseAdmin
    .from('pins')
    .select('id, location')
    .in('id', stopPinIds);

  if (error || !pins) return { error: "Failed to fetch pin locations." };

  const coordsMap = new Map<string, { lat: number; lng: number }>();
  pins.forEach(p => {
    const c = decodePostGISPoint(p.location);
    if (c) coordsMap.set(p.id, c);
  });

  const haversine = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    const R = 6371;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLon = (b.lng - a.lng) * Math.PI / 180;
    const x =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  };

  const dist = (idA: string, idB: string) => {
    const a = coordsMap.get(idA);
    const b = coordsMap.get(idB);
    return a && b ? haversine(a, b) : Infinity;
  };

  const routeDistance = (route: string[]) =>
    route.slice(0, -1).reduce((sum, id, i) => sum + dist(id, route[i + 1]), 0);

  // Nearest neighbour: start from first stop, always visit closest unvisited next.
  // Produces a decent initial route in O(n²) rather than exploring all O(n!) paths.
  const nearestNeighbour = (ids: string[]): string[] => {
    const unvisited = new Set(ids);
    const route = [ids[0]];
    unvisited.delete(ids[0]);

    while (unvisited.size > 0) {
      const last = route[route.length - 1];
      let nearest = '';
      let nearestDist = Infinity;
      for (const id of unvisited) {
        const d = dist(last, id);
        if (d < nearestDist) { nearestDist = d; nearest = id; }
      }
      route.push(nearest);
      unvisited.delete(nearest);
    }
    return route;
  };

  // 2-opt: repeatedly find two edges that would be shorter if uncrossed and swap them.
  // A swap reverses the sub-route between the two edges, removing the crossing.
  // Repeats until no improvement is found (local optimum).
  const twoOpt = (route: string[]): string[] => {
    let best = [...route];
    let improved = true;

    while (improved) {
      improved = false;
      for (let i = 0; i < best.length - 1; i++) {
        for (let j = i + 2; j < best.length; j++) {
          const currentCost = dist(best[i], best[i + 1]) + dist(best[j], best[(j + 1) % best.length]);
          const swappedCost = dist(best[i], best[j]) + dist(best[i + 1], best[(j + 1) % best.length]);

          if (swappedCost < currentCost - 1e-10) {
            best = [
              ...best.slice(0, i + 1),
              ...best.slice(i + 1, j + 1).reverse(),
              ...best.slice(j + 1),
            ];
            improved = true;
          }
        }
      }
    }
    return best;
  };

  const initial = nearestNeighbour(stopPinIds);
  const optimized = twoOpt(initial);

  return { success: true, optimizedIds: optimized };
}