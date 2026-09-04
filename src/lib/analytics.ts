import posthog from "posthog-js";

// Pilot scope: only GA features. Add others when they leave beta.
export const FEATURES = ["reservations", "cteni"] as const;
export type FeatureKey = (typeof FEATURES)[number];

type AllowedProp = string | number | boolean;

export function trackFeature(
  feature: FeatureKey,
  action: string,
  props: Record<string, AllowedProp> = {},
): void {
  try {
    posthog.capture("feature_interaction", { feature, action, ...props });
  } catch {
    // ignore — analytics must never break the app
  }
}

export function trackView(
  feature: FeatureKey,
  props: Record<string, AllowedProp> = {},
): void {
  try {
    posthog.capture("feature_view", { feature, ...props });
  } catch {
    // ignore — analytics must never break the app
  }
}
