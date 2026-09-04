import posthog from "posthog-js";

if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: "/ingest",
    defaults: "2026-01-30",
    capture_pageview: false,
    capture_pageleave: true,
    capture_heatmaps: true,
    enable_recording_console_log: false,
    autocapture: {
      css_selector_ignorelist: [
        "[data-ph-no-capture]",
        ".ph-no-capture",
        "[data-sensitive]",
      ],
    },
    mask_all_element_attributes: false,
    mask_all_text: false,
    opt_out_capturing_by_default: true,
    opt_out_capturing_persistence_type: "localStorage",
  });
}
