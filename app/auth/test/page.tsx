import { notFound } from "next/navigation";
import { AuthTestPageClient } from "./auth-test-page-client";

/**
 * Server component wrapper for auth test page
 * Only accessible in preview and local testing environments
 */
export default function AuthTestPage() {
  const isPreview = process.env.VERCEL_ENV === "preview";
  const isLocal = process.env.NODE_ENV === "development";

  if (!isPreview && !isLocal) {
    notFound();
  }

  return <AuthTestPageClient />;
}
