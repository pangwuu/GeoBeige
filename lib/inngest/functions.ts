import { inngest } from "./client";
import { processVideoContent, generateTripMetadata } from "../ai/gemini";
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
    triggers: { event: "video/submitted" } 
  },
  async ({ event, step }) => {
    const { url, pinId } = event.data;
    console.log("DEBUG: Inngest workflow triggered for URL:", url, "Pin ID:", pinId);

    // 1. Scrape Instagram Metadata via Apify
    const metadata = await step.run("scrape-instagram", async () => {
      console.log("DEBUG: Starting scrape-instagram step...");
      // Return early if no token is found for local testing
      if (!process.env.APIFY_API_TOKEN) {
        console.warn("DEBUG: APIFY_API_TOKEN not found, using fallback demo data");
        return {
          transcription: "I just found the most incredible hidden bar in Melbourne. It's called Section 8 and it's built out of shipping containers. The vibes are 10/10.",
          caption: "Best bars in Melbourne #melbourne #travel",
          source_url: url
        };
      }

      // Call Apify Instagram Scraper (Post-processing might take 30-120 seconds)
      // Documentation verified: resultsType: "posts", addParentData: false
      const response = await fetch(`https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${process.env.APIFY_API_TOKEN}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          "directUrls": [url],
          "resultsType": "posts",
          "resultsLimit": 1,
          "addParentData": false
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("DEBUG: Apify Error:", errorText);
        throw new Error("Apify scraping failed");
      }
      
      const items = await response.json();
      const data = items[0];

      return {
        transcription: data?.caption || "",
        caption: `Post by ${data?.ownerUsername || 'Instagram User'}`,
        source_url: url
      };
    });

    console.log("DEBUG: Metadata extracted:", metadata);

    // 2. AI Extraction via Gemini
    const extraction = await step.run("ai-extraction", async () => {
      console.log("DEBUG: Starting ai-extraction step...");
      // @ts-ignore
      return await processVideoContent(metadata.transcription, metadata.caption);
    });

    console.log("DEBUG: AI extraction result:", extraction);

    // 3. Geocoding via Google (with caching)
    const coords = await step.run("geocoding", async () => {
      console.log("DEBUG: Starting geocoding step...");
      
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
        console.log("DEBUG: Venue cache HIT! Reusing coordinates for:", extraction.venueName);
        
        // Handle string format
        if (typeof existingVenue.location === 'string' && existingVenue.location.startsWith('POINT')) {
          const match = existingVenue.location.match(/POINT\((.+) (.+)\)/);
          if (match) return { lng: parseFloat(match[1]), lat: parseFloat(match[2]) };
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
          return { lng, lat };
        }
      }

      // If no cache hit, call Google
      // @ts-ignore
      return await geocode(extraction.venueName, extraction.locationContext);
    });

    console.log("DEBUG: Geocoding result:", coords);

    // 4. Update existing pin or save as new
    await step.run("save-to-db", async () => {
      console.log("DEBUG: Starting save-to-db step for pinId:", pinId);
      
      const pinData = {
        // @ts-ignore
        venue_name: extraction.venueName,
        // @ts-ignore
        city: extraction.locationContext, // Suburb + City info
        // @ts-ignore
        summary: extraction.summary,
        // @ts-ignore
        category: extraction.category,
        source_url: url,
        // @ts-ignore
        location: `POINT(${coords.lng} ${coords.lat})`,
        status: 'completed'
      };

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
        console.error("DEBUG: Supabase Error in workflow:", result.error);
        throw result.error;
      }
      console.log("DEBUG: Successfully saved pin to database:", result.data);

      // Trigger was here, removed.
    });

    return { success: true, extraction };
  }
);
