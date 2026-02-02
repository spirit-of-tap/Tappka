/**
 * API Route: Confirm Upload
 * POST /api/storage/confirm-upload
 * 
 * Confirms successful upload and saves file key to database.
 * Optionally deletes old file if replacing.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/auth-helpers";
import { deleteFile } from "@/lib/storage/service";
import type { StorageContext } from "@/lib/storage/types";

interface ConfirmUploadRequest {
  context: StorageContext;
  entityId: string;
  key: string;
  deleteOldKey?: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }

    const body: ConfirmUploadRequest = await request.json();
    const { context, entityId, key, deleteOldKey } = body;

    console.log('[confirm-upload] Request body:', { context, entityId, key, deleteOldKey });

    // Validate input
    if (!context || !entityId || !key) {
      console.error('[confirm-upload] Missing required fields');
      return NextResponse.json(
        { error: "Chybí povinné údaje" },
        { status: 400 }
      );
    }

    // Get current user profile
    const profile = await getCurrentUserProfile(supabase);
    if (!profile) {
      return NextResponse.json(
        { error: "Profil nenalezen" },
        { status: 403 }
      );
    }

    // Authorization and update based on context
    if (context === "profile") {
      // Users can only update their own profile
      if (entityId !== profile.id) {
        return NextResponse.json(
          { error: "Nemáš oprávnění upravit tento profil" },
          { status: 403 }
        );
      }

      // Get old picture key if exists
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("picture")
        .eq("id", entityId)
        .single();

      // Update profile with new picture key
      console.log('[confirm-upload] Updating profile:', { profileId: entityId, key });
      const { data: updateData, error: updateError } = await supabase
        .from("profiles")
        .update({ picture: key })
        .eq("id", entityId)
        .select();

      console.log('[confirm-upload] Update result:', { data: updateData, error: updateError });

      if (updateError) {
        console.error("Error updating profile picture:", updateError);
        return NextResponse.json(
          { error: "Nepodařilo se aktualizovat profilový obrázek" },
          { status: 500 }
        );
      }

      // Delete old file if it exists and is a B2 key (not external URL)
      if (
        existingProfile?.picture &&
        !existingProfile.picture.startsWith("http")
      ) {
        try {
          await deleteFile(existingProfile.picture);
        } catch (error) {
          console.error("Error deleting old profile picture:", error);
          // Don't fail the request if old file deletion fails
        }
      }
    } else if (context === "team") {
      // Check if user is team admin
      const { data: teamMember } = await supabase
        .from("team_members")
        .select("role")
        .eq("team_id", entityId)
        .eq("profile_id", profile.id)
        .single();

      if (!teamMember || teamMember.role !== "admin") {
        return NextResponse.json(
          { error: "Nemáš oprávnění upravit tento tým" },
          { status: 403 }
        );
      }

      // Get old picture key if exists
      const { data: existingTeam } = await supabase
        .from("teams")
        .select("picture")
        .eq("id", entityId)
        .single();

      // Update team with new picture key
      const { error: updateError } = await supabase
        .from("teams")
        .update({ picture: key })
        .eq("id", entityId);

      if (updateError) {
        console.error("Error updating team picture:", updateError);
        return NextResponse.json(
          { error: "Nepodařilo se aktualizovat obrázek týmu" },
          { status: 500 }
        );
      }

      // Delete old file if it exists and is a B2 key (not external URL)
      if (existingTeam?.picture && !existingTeam.picture.startsWith("http")) {
        try {
          await deleteFile(existingTeam.picture);
        } catch (error) {
          console.error("Error deleting old team picture:", error);
          // Don't fail the request if old file deletion fails
        }
      }
    } else {
      return NextResponse.json(
        { error: "Neplatný kontext nahrávání" },
        { status: 400 }
      );
    }

    // Delete explicitly specified old key if provided
    if (deleteOldKey && !deleteOldKey.startsWith("http")) {
      try {
        await deleteFile(deleteOldKey);
      } catch (error) {
        console.error("Error deleting specified old file:", error);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Obrázek byl úspěšně nahrán",
    });
  } catch (error) {
    console.error("POST /api/storage/confirm-upload error:", error);
    return NextResponse.json(
      { error: "Nepodařilo se potvrdit nahrání" },
      { status: 500 }
    );
  }
}
