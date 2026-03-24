"use server";

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function searchPlaces(query: string) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return [];

  // Use Google Places Autocomplete/Search
  // We'll use the "Text Search" for better POI results
  const endpoint = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}&region=au`;
  
  try {
    const response = await fetch(endpoint);
    const data = await response.json();
    
    if (data.status === "OK") {
      return data.results.map((place: any) => ({
        id: place.place_id,
        text: place.name,
        place_name: place.formatted_address,
        center: [place.geometry.location.lng, place.geometry.location.lat],
        category: place.types?.some((t: string) => ['bar', 'pub', 'liquor_store', 'night_club', 'winery'].includes(t)) ? 'Drinks' : 
                  (place.types?.some((t: string) => ['restaurant', 'cafe', 'food', 'bakery', 'meal_takeaway'].includes(t)) ? 'Food' : 
                  (place.types?.some((t: string) => ['tourist_attraction', 'park', 'museum', 'amusement_park', 'gym'].includes(t)) ? 'Activity' : 'Other'))
      }));
    }
    return [];
  } catch (error) {
    console.error("Google Places search error:", error);
    return [];
  }
}

export async function addManualPin(data: {
  venue_name: string;
  city: string;
  lng: number;
  lat: number;
  category: string;
  summary?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Please sign in to add places." };
  }

  try {
    // Ensure category matches CHECK constraint (Food, Drinks, Activity, Other)
    const allowedCategories = ['Food', 'Drinks', 'Activity', 'Other'];
    const validatedCategory = allowedCategories.includes(data.category) 
      ? data.category 
      : (allowedCategories.find(c => c.toLowerCase() === data.category?.toLowerCase()) || 'Activity');

    const { data: result, error } = await supabaseAdmin.from('pins').insert({
      venue_name: data.venue_name,
      city: data.city,
      summary: data.summary || "Manually added to map.",
      category: validatedCategory,
      location: `POINT(${data.lng} ${data.lat})`,
      status: 'completed'
    }).select();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: "Database insertion failed" };
  }
}
