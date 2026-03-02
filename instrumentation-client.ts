import posthog from "posthog-js";

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
  api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  defaults: "2026-01-30",
  capture_pageview: false, // Handled manually in posthog-pageview.tsx
  capture_pageleave: true,
});
