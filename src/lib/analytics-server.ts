import { getPostHogServer } from "./posthog-server";

type AllowedProp = string | number | boolean;

export async function trackServer(
  event: string,
  distinctId: string,
  properties: Record<string, AllowedProp> = {},
): Promise<void> {
  const client = getPostHogServer();
  if (!client) return;
  try {
    await client.captureImmediate({ distinctId, event, properties });
  } catch {
    // ignore — analytics must never break the app
  }
}
