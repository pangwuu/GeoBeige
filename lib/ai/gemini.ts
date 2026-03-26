import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const geminiModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash-lite", // Using 2.5-flash-lite as it's a stable model with JSON mode support. do not change it to 1.5 flash. 2.5 exists now
  generationConfig: { responseMimeType: "application/json" }
});

export async function processVideoContent(videoTranscription: string, caption: string) {
  const prompt = `
    Analyze the following video content (transcription and caption) to extract a venue name, city, and a brief summary.
    Transcription: ${videoTranscription}
    Caption: ${caption}

    Task:
    1. Identify the EXACT venue name and the most specific location possible (Suburb, Area, or Full Street Address).
    2. Categorize as 'Food', 'Drinks', 'Activity', or 'Other'. Use 'Other' for anything that doesn't fit the first three.
    3. Predict a "Suggested Dwell Time" in minutes (e.g., 30 for coffee, 60 for drinks, 90 for dinner, 120 for activity).
    4. Write a "Vibe Summary": EXACTLY 3 punchy bullet points.
       - Each bullet point must be under 5 words.
       - Focus on the sensory "vibe" (e.g., "Neon lights, loud techno").
       - Separate bullet points with ONLY a plain newline character (\n). DO NOT use <br> or HTML tags.

    Output ONLY a valid JSON object:
    {
      "venueName": "...",
      "locationContext": "e.g., Surry Hills, Sydney",
      "summary": "...",
      "category": "Food" | "Drinks" | "Activity" | "Other",
      "suggestedDwellTime": 60
    }
  `;

  const result = await geminiModel.generateContent(prompt);
  const response = await result.response;
  const text = response.text();
  try {
    const parsed = JSON.parse(text);
    // Ensure suggestedDwellTime is a number and within reasonable bounds
    parsed.suggestedDwellTime = Number(parsed.suggestedDwellTime) || 60;
    return parsed;
  } catch (err) {
    console.error("Gemini JSON Parse Error:", text);
    throw new Error("We encountered an error processing the AI response. Please try again.");
  }
}

export async function generateItineraryFromPins(pins: any[], userPrompt: string) {
  const pinsContext = pins.map(p => ({
    id: p.id,
    venue: p.venue_name,
    category: p.category,
    summary: p.summary,
    city: p.city,
    suggestedDwellTime: p.suggested_dwell_time || 60
  }));

  const prompt = `
    You are a professional travel curator. Create a logical, multi-stop itinerary using a SUBSET of the provided pins based on the user's request.
    
    User Request: "${userPrompt}"
    Available Pins: ${JSON.stringify(pinsContext)}

    Task:
    1. Select 2-5 pins that best fit the request and geographical logic.
    2. Order them sequentially (e.g., Activity -> Food -> Activity).
    3. Provide a Title and a brief Description for the itinerary.
    4. For each stop, provide a "dwell_time_minutes" (use the suggestedDwellTime from the pin as a baseline, but adjust if it makes sense for the flow).
    5. Use Australian English spelling.

    Output ONLY a valid JSON object:
    {
      "title": "...",
      "description": "...",
      "stops": [
        { "pinId": "...", "dwell_time_minutes": 90, "notes": "..." },
        ...
      ]
    }
  `;

  const result = await geminiModel.generateContent(prompt);
  const response = await result.response;
  const text = response.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    console.error("Gemini JSON Parse Error:", text);
    throw new Error("We encountered an error processing the AI response. Please try again.");
  }
}
