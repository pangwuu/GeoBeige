import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { processVideoWorkflow } from "@/lib/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    processVideoWorkflow,
  ],
  isDev: process.env.NODE_ENV !== "production",
});
