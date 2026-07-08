/**
 * API Route: Delete File
 * DELETE /api/storage/delete
 * 
 * Deletes a file from B2 storage and removes reference from database.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/auth-helpers";
import { deleteFile } from "@/lib/storage/service";
import type { StorageContext } from "@/lib/storage/types";

interface DeleteRequest {
  context: StorageContext;
  entityId: string;
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }

    const body: DeleteRequest = await request.json();
    const { context, entityId } = body;

    // Validate input
    if (!context || !entityId) {
      return NextResponse.json(
        { error: "Chybí povinné údaje" },
        { status: 400 }
      );
    }

    // Get current user profile
    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) {
      return NextResponse.json(
        { error: "Profil nenalezen" },
        { status: 403 }
      );
    }

    // Authorization and deletion based on context
    if (context === "profile") {
      // Users can only delete their own profile picture
      if (entityId !== profile.id) {
        return NextResponse.json(
          { error: "Nemáš oprávnění smazat tento obrázek" },
          { status: 403 }
        );
      }

      // Get current picture key
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("picture")
        .eq("id", entityId)
        .single();

      if (!existingProfile?.picture) {
        return NextResponse.json(
          { error: "Profil nemá nastavený obrázek" },
          { status: 404 }
        );
      }

      // Delete from B2 (only if it's a B2 key, not external URL)
      if (!existingProfile.picture.startsWith("http")) {
        try {
          await deleteFile(existingProfile.picture);
        } catch (error) {
          console.error("Error deleting file from B2:", error);
          // Continue to remove DB reference even if B2 deletion fails
        }
      }

      // Remove from database
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ picture: null })
        .eq("id", entityId);

      if (updateError) {
        console.error("Error removing profile picture from DB:", updateError);
        return NextResponse.json(
          { error: "Nepodařilo se odstranit obrázek z databáze" },
          { status: 500 }
        );
      }
    } else if (context === "team") {
      // Team pictures can only be managed by an admin of that team.
      // Membership lives on profiles.team_id (there is no team_members table).
      if (profile.team_id !== entityId || profile.role !== "admin") {
        return NextResponse.json(
          { error: "Nemáš oprávnění smazat tento obrázek" },
          { status: 403 }
        );
      }

      // Get current picture key
      const { data: existingTeam } = await supabase
        .from("teams")
        .select("picture")
        .eq("id", entityId)
        .single();

      if (!existingTeam?.picture) {
        return NextResponse.json(
          { error: "Tým nemá nastavený obrázek" },
          { status: 404 }
        );
      }

      // Delete from B2 (only if it's a B2 key, not external URL)
      if (!existingTeam.picture.startsWith("http")) {
        try {
          await deleteFile(existingTeam.picture);
        } catch (error) {
          console.error("Error deleting file from B2:", error);
          // Continue to remove DB reference even if B2 deletion fails
        }
      }

      // Remove from database
      const { error: updateError } = await supabase
        .from("teams")
        .update({ picture: null })
        .eq("id", entityId);

      if (updateError) {
        console.error("Error removing team picture from DB:", updateError);
        return NextResponse.json(
          { error: "Nepodařilo se odstranit obrázek z databáze" },
          { status: 500 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Neplatný kontext mazání" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Obrázek byl úspěšně smazán",
    });
  } catch (error) {
    console.error("DELETE /api/storage/delete error:", error);
    return NextResponse.json(
      { error: "Nepodařilo se smazat obrázek" },
      { status: 500 }
    );
  }
}
