export async function geocode(venueName: string, locationContext: string) {
  // Google is the gold standard for "Venue Name, Suburb, City" queries
  const query = `${venueName}, ${locationContext}, Australia`;
  console.log(`DEBUG: Google Geocoding query: "${query}"`);

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY is not defined. Please add it to your .env.local");
  }

  // Google Geocoding API endpoint
  const endpoint = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`;

  try {
    const response = await fetch(endpoint);
    const data = await response.json();

    if (data.status === "OK" && data.results.length > 0) {
      const { lat, lng } = data.results[0].geometry.location;
      console.log(`DEBUG: Google Geocoding success: [${lng}, ${lat}] - ${data.results[0].formatted_address}`);
      return { lng, lat };
    }

    if (data.status === "ZERO_RESULTS") {
      console.warn(`DEBUG: Google Geocoding found no results for "${query}"`);
      // Fallback: Try searching just the venue and the city if suburb-level fails
      return await fallbackGeocode(venueName, apiKey);
    }

    throw new Error(`Google Geocoding failed with status: ${data.status}`);
  } catch (error) {
    console.error("DEBUG: Geocoding Error:", error);
    throw error;
  }
}

async function fallbackGeocode(venueName: string, apiKey: string) {
  const query = `${venueName}, Australia`;
  console.log(`DEBUG: Retrying with broader query: "${query}"`);
  
  const endpoint = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`;
  const response = await fetch(endpoint);
  const data = await response.json();

  if (data.status === "OK" && data.results.length > 0) {
    const { lat, lng } = data.results[0].geometry.location;
    return { lng, lat };
  }
  
  throw new Error("Could not find coordinates even with fallback.");
}
