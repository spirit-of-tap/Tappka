import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/auth-helpers";
import { formatUrl, validateIco } from "@/lib/teams/links";
import { serverLogger } from "@/lib/server-logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null;

    if (!user) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) {
      return NextResponse.json({ error: "Profil nenalezen" }, { status: 403 });
    }

    const isMember = profile.team_id === id;
    const isAdmin = profile.role === "admin";

    if (!isMember && !isAdmin) {
      return NextResponse.json(
        { error: "Nemáš oprávnění upravovat tento tým" },
        { status: 403 },
      );
    }

    const body = await request.json();

    // Validate IČO
    if (body.ico !== undefined) {
      const icoValidation = validateIco(body.ico);
      if (!icoValidation.ok) {
        return NextResponse.json({ error: icoValidation.error }, { status: 400 });
      }
      body.ico = icoValidation.value;
    }

    // Format website and linkedin URLs
    if (body.website_url !== undefined) {
      body.website_url = formatUrl(body.website_url);
    }
    if (body.linkedin_url !== undefined) {
      body.linkedin_url = formatUrl(body.linkedin_url);
    }
    if (body.instagram_url !== undefined && typeof body.instagram_url === "string") {
      body.instagram_url = body.instagram_url.trim() || null;
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by_profile_id: profile.id,
    };

    if (body.picture !== undefined) updatePayload.picture = body.picture;
    if (body.group_picture !== undefined) updatePayload.group_picture = body.group_picture;
    if (body.website_url !== undefined) updatePayload.website_url = body.website_url;
    if (body.instagram_url !== undefined) updatePayload.instagram_url = body.instagram_url;
    if (body.linkedin_url !== undefined) updatePayload.linkedin_url = body.linkedin_url;
    if (body.ico !== undefined) updatePayload.ico = body.ico;

    const { data, error } = await supabase
      .from("teams")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      serverLogger.console.error("Error updating team:", error);
      return NextResponse.json(
        { error: "Nepodařilo se aktualizovat údaje týmu" },
        { status: 500 },
      );
    }

    return NextResponse.json({ team: data });
  } catch (error) {
    serverLogger.console.error("PATCH /api/teams/[id] error:", error);
    return NextResponse.json(
      { error: "Došlo k neočekávané chybě" },
      { status: 500 },
    );
  }
}
