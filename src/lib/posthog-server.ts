import { PostHog } from "posthog-node";

import { POSTHOG_INGESTION_HOST } from "@/lib/posthog-config";

let posthogInstance: PostHog | null = null;

export function getPostHogServer(): PostHog | null {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!apiKey) return null;

  if (!posthogInstance) {
    posthogInstance = new PostHog(apiKey, {
      host: POSTHOG_INGESTION_HOST,
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return posthogInstance;
}
