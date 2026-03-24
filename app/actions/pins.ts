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

export async function submitVideoUrl(url: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Please sign in to add videos." };
  }

  if (!url || typeof url !== 'string') {
    return { error: "Valid URL is required" };
  }

  try {
    // 0. Check if THIS user has already submitted this exact video
    const { data: existingPin } = await supabaseAdmin
      .from('pins')
      .select('id')
      .eq('source_url', url)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingPin) {
      return { success: true, message: "Already in your collection" };
    }

    // 1. Create a "pending" pin immediately for UX feedback
    const { data: pin, error } = await supabaseAdmin.from('pins').insert({
      venue_name: "Analysing...",
      status: 'processing',
      source_url: url,
      category: 'Other', 
      user_id: user.id,
      location: 'POINT(0 0)', 
      summary: "We're extracting the vibe and location from your video..."
    }).select().single();

    if (error) {
      console.error("Supabase Insertion Error:", error);
      return { error: `Database error: ${error.message} (${error.code})` };
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
      return { error: "Failed to delete" };
    }

    revalidatePath("/");
    return { success: true };
  } catch (error) {
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
      return { error: "Failed to update" };
    }

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    return { error: "An unexpected error occurred" };
  }
}
