/**
 * Google Maps Routes API (V2) Wrapper
 * More modern, faster, and better for multi-stop optimization.
 */

export type TransportMode = 'transit' | 'walking' | 'driving' | 'bicycling';

export interface DirectionResult {
  polyline: string;
  duration_seconds: number;
  distance_meters: number;
  mode: TransportMode;
}

export async function getDirections(
  origin: { lat: number, lng: number }, 
  destination: { lat: number, lng: number }, 
  mode: TransportMode = 'transit'
): Promise<DirectionResult> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY is missing from environment variables.");
  }

  // Map our internal lowercase modes to Routes API V2 Enums
  const modeMap: Record<TransportMode, string> = {
    'transit': 'TRANSIT',
    'walking': 'WALK',
    'driving': 'DRIVE',
    'bicycling': 'BICYCLE'
  };
  
  const routeMode = modeMap[mode] || 'TRANSIT';

  // Documentation: https://developers.google.com/maps/documentation/routes/compute_route_directions
  const endpoint = "https://routes.googleapis.com/directions/v2:computeRoutes";

  const body = {
    origin: {
      location: { latLng: { latitude: origin.lat, longitude: origin.lng } }
    },
    destination: {
      location: { latLng: { latitude: destination.lat, longitude: destination.lng } }
    },
    travelMode: routeMode,
    routingPreference: routeMode === 'DRIVE' ? 'TRAFFIC_AWARE' : undefined,
    computeAlternativeRoutes: false,
    routeModifiers: {
      avoidTolls: false,
      avoidHighways: false,
      avoidFerries: false
    },
    // languageCode: "en-AU",
    units: "METRIC",
    polylineEncoding: "ENCODED_POLYLINE"
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        // FieldMask is REQUIRED for Routes API V2 to save bandwidth/cost
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline'
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Google Routes API failed: ${data.error?.message || response.statusText}`);
    }

    if (!data.routes || data.routes.length === 0) {
      throw new Error("No routes found between stops.");
    }

    const route = data.routes[0];

    return {
      polyline: route.polyline.encodedPolyline,
      // Routes API returns duration as a string like "1200s"
      duration_seconds: parseInt(route.duration.replace('s', '')),
      distance_meters: route.distanceMeters,
      mode: mode
    };
  } catch (error) {
    throw error;
  }
}
