import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // If the env vars are not set, skip proxy check. You can remove this
  // once you setup the project.

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and
  // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: If you remove getClaims() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  const pathname = request.nextUrl.pathname;
  const isPublicRoute = pathname === "/" || pathname.startsWith("/auth");
  const isVerifyEmailRoute = pathname === "/auth/verify-email";
  const isPendingApprovalRoute = pathname === "/auth/pending-approval";

  // Redirect to login if not authenticated (except for public routes)
  if (!isPublicRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  // Check for email identity verification first if user is authenticated
  // This check runs for protected routes and pending-approval route
  // Skip this check only for verify-email route and other auth routes
  if (user && !isVerifyEmailRoute && (!isPublicRoute || isPendingApprovalRoute)) {
    // Check if user has an email identity (not just OAuth providers like Google)
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (authUser) {
      const identities = authUser.identities || [];
      const hasEmailIdentity = identities.some(
        (identity) => identity.provider === "email"
      );

      // If no email identity, redirect to verify email page
      if (!hasEmailIdentity) {
        const url = request.nextUrl.clone();
        url.pathname = "/auth/verify-email";
        return NextResponse.redirect(url);
      }
    }
  }

  // Check for linked profile if user is authenticated and not on public routes
  // Skip this check for verify-email and pending-approval routes
  if (user && !isPublicRoute && !isVerifyEmailRoute && !isPendingApprovalRoute) {
    // Get the public.users row linked to this auth user
    const { data: publicUser } = await supabase
      .from("users")
      .select("id")
      .eq("auth_user_id", user.sub)
      .single();

    // If no publicUser or no linked profile, redirect to pending approval
    if (!publicUser) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/pending-approval";
      return NextResponse.redirect(url);
    }

    // Check if there's a profile linked to this user
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", publicUser.id)
      .single();

    if (!profile) {
      // User doesn't have a linked profile, redirect to pending approval
      const url = request.nextUrl.clone();
      url.pathname = "/auth/pending-approval";
      return NextResponse.redirect(url);
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse;
}
