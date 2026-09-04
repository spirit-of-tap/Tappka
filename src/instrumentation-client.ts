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
    before_send: (event) => {
      // Group chunk-load failures (deploy version skew) into one issue.
      if (event?.event === "$exception") {
        const list = (event.properties?.["$exception_list"] ?? []) as Array<{
          $exception_type?: string;
          $exception_message?: string;
        }>;
        const first = list[0];
        const message = first?.$exception_message ?? "";
        if (
          first?.$exception_type === "ChunkLoadError" ||
          /chunk|loading chunk|dynamically imported module/i.test(message)
        ) {
          event.properties = {
            ...event.properties,
            $exception_fingerprint: "chunk-load-error",
          };
        }
      }
      return event;
    },
  });
}
