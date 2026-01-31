import { LoginForm } from "@/components/login-form";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { DEFAULT_LOGGED_IN_PAGE } from "@/lib/constants/auth";
import { validateRedirectUrl } from "@/lib/utils";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const supabase = await createClient();
  // Use getUser() instead of getClaims() to validate the user actually exists
  // getClaims() can return truthy values even with invalid/deleted users
  const { data: { user }, error } = await supabase.auth.getUser();

  // Only redirect if we have a valid user (not just claims)
  // This prevents infinite redirect loops when token is invalid but claims exist
  if (!error && user) {
    // Use next parameter if available, otherwise default
    const params = await searchParams;
    const next = params.next;

    // Get origin from headers for validation
    const headersList = await headers();
    const host = headersList.get("host");
    const protocol = headersList.get("x-forwarded-proto") || "http";
    const origin = host ? `${protocol}://${host}` : "";

    // Validate next parameter to prevent open redirects
    const validatedNext = next ? validateRedirectUrl(next, origin) : null;
    const redirectTo = validatedNext ?? DEFAULT_LOGGED_IN_PAGE;
    redirect(redirectTo);
  }

  const params = await searchParams;
  const next = params.next;

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm next={next} />
      </div>
    </div>
  );
}
