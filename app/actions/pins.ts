"use server";

import { inngest } from "@/lib/inngest/client";
import { revalidatePath } from "next/cache";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Use admin client to insert pending pins
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function submitVideoUrl(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Please sign in to add videos." };
  }

  const url = formData.get("url") as string;

  if (!url) {
    return { error: "URL is required" };
  }

  try {
    // 0. Check if this exact video already exists to save ALL costs (AI + Geocoding)
    const { data: existingPin } = await supabaseAdmin
      .from('pins')
      .select('id')
      .eq('source_url', url)
      .maybeSingle();

    if (existingPin) {
      return { success: true };
    }

    // 1. Create a "pending" pin immediately for UX feedback
    const { data: pin, error } = await supabaseAdmin.from('pins').insert({
      venue_name: "Analysing...",
      status: 'processing',
      source_url: url,
      location: 'POINT(0 0)', // Placeholder to satisfy NOT NULL constraint
      summary: "We're extracting the vibe and location from your video..."
    }).select().single();

    if (error) {
      console.error("DEBUG: Error creating pending pin:", error);
      return { error: "Failed to queue video" };
    }

    // 2. Trigger the Inngest background workflow with the pin ID
    await inngest.send({
      name: "video/submitted",
      data: { 
        url,
        pinId: pin.id 
      },
    });

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("DEBUG: Unexpected error in submitVideoUrl:", error);
    return { error: "An unexpected error occurred" };
  }
}

export async function deletePin(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  try {
    const { error } = await supabaseAdmin
      .from('pins')
      .delete()
      .eq('id', id);

    if (error) {
      console.error("DEBUG: Error deleting pin:", error);
      return { error: "Failed to delete" };
    }

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("DEBUG: Unexpected error in deletePin:", error);
    return { error: "An unexpected error occurred" };
  }
}

export async function updatePin(id: string, updates: {
  venue_name?: string;
  summary?: string;
  category?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  try {
    const { error } = await supabaseAdmin
      .from('pins')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error("DEBUG: Error updating pin:", error);
      return { error: "Failed to update" };
    }

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("DEBUG: Unexpected error in updatePin:", error);
    return { error: "An unexpected error occurred" };
  }
}
