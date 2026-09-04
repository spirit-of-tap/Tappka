import { withPostHogConfig } from "@posthog/nextjs-config";
import type { NextConfig } from "next";

import { POSTHOG_UI_HOST } from "./src/lib/posthog-config";

const posthogApiKey = process.env.POSTHOG_API_KEY;
const posthogProjectId = process.env.POSTHOG_PROJECT_ID;
const posthogSourceMapsEnabled = Boolean(
  posthogApiKey?.trim() && posthogProjectId?.trim()
);

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
  ],
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
      },
      {
        protocol: 'https',
        hostname: 'books.google.com',
      },
      {
        protocol: 'https',
        hostname: 'covers.openlibrary.org',
      },
      {
        protocol: 'https',
        hostname: 'i.pravatar.cc',
      },
      {
        protocol: 'https',
        hostname: 'pravatar.cc',
      },
    ],
  },
  skipTrailingSlashRedirect: true,
};

export default withPostHogConfig(nextConfig, {
  personalApiKey: posthogApiKey ?? "",
  projectId: posthogProjectId,
  host: process.env.POSTHOG_HOST ?? POSTHOG_UI_HOST,
  sourcemaps: {
    enabled: posthogSourceMapsEnabled,
    deleteAfterUpload: true,
  },
});
