import { inngest } from "./client";
import { processVideoContent } from "../ai/gemini";
import { geocode } from "../geocoding";
import { createClient } from "@supabase/supabase-js";

// We use the service_role (secret) key here to bypass RLS in background jobs
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const processVideoWorkflow = inngest.createFunction(
  { 
    id: "process-video",
    // @ts-ignore
    triggers: { event: "video/submitted" },
    onFailure: async ({ event, error, step }) => {
      const { pinId } = event.data.event.data; // Original event data is nested in onFailure
      if (pinId) {
        await supabaseAdmin
          .from('pins')
          .update({ 
            status: 'failed',
            venue_name: 'Analysis Failed',
            summary: `We encountered an error processing this video: ${error.message || 'Unknown error'}. You can try deleting this pin and submitting the link again.`
          })
          .eq('id', pinId);
      }
    }
  },
  async ({ event, step }) => {
    const { url, pinId } = event.data;

    try {
      // 1. Scrape Video Metadata (Instagram or TikTok)
      const metadata = await step.run("scrape-video", async () => {
      
      const isTikTok = url.includes("tiktok.com");
      const isInstagram = url.includes("instagram.com");

      if (!process.env.APIFY_API_TOKEN) {
        return {
          transcription: "I just found the most incredible hidden bar in Melbourne. It's called Section 8 and it's built out of shipping containers. The vibes are 10/10.",
          caption: "Best bars in Melbourne #melbourne #travel",
          source_url: url
        };
      }
// Branch based on platform
const actorId = isTikTok ? "clockworks~tiktok-scraper" : "apify~instagram-scraper";
const body = isTikTok 
  ? { "postURLs": [url], "resultsPerPage": 1 }
  : { "directUrls": [url], "resultsType": "posts", "resultsLimit": 1, "addParentData": false };

const response = await fetch(`https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${process.env.APIFY_API_TOKEN}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body)
});

if (!response.ok) {
  const errorText = await response.text();
  console.error(`Apify ${isTikTok ? 'TikTok' : 'Instagram'} Error:`, errorText);
  throw new Error("Apify scraping failed");
}

const items = await response.json();
const data = items[0];

// Normalise data for Gemini
return {
  transcription: isTikTok ? (data?.text || "") : (data?.caption || ""),
  caption: isTikTok ? `TikTok by ${data?.authorMeta?.name || 'User'}` : `Instagram by ${data?.ownerUsername || 'User'}`,
  source_url: url
};

    });


    // 2. AI Extraction via Gemini
    const extraction = await step.run("ai-extraction", async () => {
      // @ts-ignore
      return await processVideoContent(metadata.transcription, metadata.caption);
    });


    // 3. Geocoding via Google (with caching)
    const geocodingResult = await step.run("geocoding", async () => {
      
      // Check if we've already geocoded this exact venue/suburb combo
      const { data: existingVenue } = await supabaseAdmin
        .from('pins')
        .select('location')
        .eq('venue_name', extraction.venueName)
        .eq('city', extraction.locationContext)
        .neq('location', 'POINT(0 0)')
        .limit(1)
        .maybeSingle();

      if (existingVenue?.location) {
        
        // Handle string format
        if (typeof existingVenue.location === 'string' && existingVenue.location.startsWith('POINT')) {
          const match = existingVenue.location.match(/POINT\((.+) (.+)\)/);
          if (match) return { coords: { lng: parseFloat(match[1]), lat: parseFloat(match[2]) } };
        }
        
        // Handle WKB (hex string) format
        if (typeof existingVenue.location === 'string' && existingVenue.location.length > 40) {
          const isEWKB = existingVenue.location.includes("0101000020");
          const offset = isEWKB ? 18 : 10;
          const bytes = new Uint8Array(existingVenue.location.length / 2);
          for (let i = 0; i < existingVenue.location.length; i += 2) {
            bytes[i / 2] = parseInt(existingVenue.location.substring(i, i + 2), 16);
          }
          const view = new DataView(bytes.buffer);
          const lng = view.getFloat64(offset / 2, true);
          const lat = view.getFloat64((offset / 2) + 8, true);
          return { coords: { lng, lat } };
        }
      }

      // If no cache hit, call Google
      try {
        const coords = await geocode(extraction.venueName, extraction.locationContext);
        return { coords };
      } catch (err: any) {
        return { 
          coords: { lng: 0, lat: 0 }, 
          error: err.message || "Address not found" 
        };
      }
    });


    // 4. Update existing pin or save as new
    await step.run("save-to-db", async () => {
      
      const coords = geocodingResult.coords;
      const isGeocoded = coords.lng !== 0 || coords.lat !== 0;

      // Ensure category matches CHECK constraint (Food, Drinks, Activity, Other)
      const allowedCategories = ['Food', 'Drinks', 'Activity', 'Other'];
      const rawCategory = (extraction.category || 'Other').toString();
      const validatedCategory = allowedCategories.includes(rawCategory) 
        ? rawCategory 
        : (allowedCategories.find(c => c.toLowerCase() === rawCategory.toLowerCase()) || 'Other');

      const pinData = {
        // @ts-ignore
        venue_name: extraction.venueName,
        // @ts-ignore
        city: extraction.locationContext, // Suburb + City info
        summary: extraction.summary,
        category: validatedCategory,
        suggested_dwell_time: extraction.suggestedDwellTime,
        source_url: url,
        // @ts-ignore
        location: `POINT(${coords.lng} ${coords.lat})`,
        status: isGeocoded ? 'completed' : 'failed'
      };

      // If geocoding failed, add a helpful hint to the summary
      if (!isGeocoded) {
        pinData.summary = `📍 Location Resolution Failed: We found the vibe but couldn't pin "${extraction.venueName}" exactly. \n\nClick Edit to search manually!\n\n---\n${extraction.summary}`;
      }

      let result;
      if (pinId) {
        // Update the existing "processing" pin
        result = await supabaseAdmin
          .from('pins')
          .update(pinData)
          .eq('id', pinId)
          .select();
      } else {
        // Fallback for events without a pinId
        result = await supabaseAdmin
          .from('pins')
          .insert(pinData)
          .select();
      }

      if (result.error) {
        throw result.error;
      }

      // Trigger was here, removed.
    });

    return { success: true, extraction };
    } catch (error: any) {
      // Mark as failed immediately if we catch a non-retryable or caught error
      if (pinId) {
        await supabaseAdmin
          .from('pins')
          .update({ 
            status: 'failed',
            venue_name: 'Analysis Failed',
            summary: `Analysis stopped: ${error.message || 'Unknown processing error'}.`
          })
          .eq('id', pinId);
      }
      throw error; // Re-throw to allow Inngest retries if appropriate
    }
  }
);
