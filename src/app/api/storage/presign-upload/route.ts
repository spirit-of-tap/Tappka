/**
 * API Route: Generate Presigned Upload URL
 * POST /api/storage/presign-upload
 *
 * Generates a presigned PUT URL for direct browser upload to Supabase Storage.
 * Validates user permissions and file constraints.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/auth-helpers";
import { generatePresignedUpload } from "@/lib/storage/service";
import {
  validateImageUpload,
  validatePersonalityTestUpload,
  validateTeamDocumentUpload,
  getFileExtension,
} from "@/lib/storage/validation";
import type { StorageContext } from "@/lib/storage/types";

interface PresignUploadRequest {
  context: StorageContext;
  entityId: string;
  contentType: string;
  fileSize: number;
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

    const body: PresignUploadRequest = await request.json();
    const { context, entityId, contentType, fileSize } = body;

    // Validate input
    if (!context || !entityId || !contentType || !fileSize) {
      return NextResponse.json(
        { error: "Chybí povinné údaje" },
        { status: 400 }
      );
    }

    // Validate file type and size
    const validationError = context === "team-document"
      ? validateTeamDocumentUpload(contentType, fileSize)
      : context === "personality-test"
        ? validatePersonalityTestUpload(contentType, fileSize)
        : validateImageUpload(contentType, fileSize);
    if (validationError) {
      return NextResponse.json(
        { error: validationError.message },
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

    // Authorization checks
    if (context === "team-document") {
      const { data: document, error } = await supabase
        .from("team_documents")
        .select("team_id")
        .eq("id", entityId)
        .is("removed_at", null)
        .maybeSingle();

      if (error || !document || document.team_id !== profile.team_id) {
        return NextResponse.json(
          { error: "Nemáš oprávnění nahrát verzi tohoto dokumentu" },
          { status: 403 }
        );
      }
    } else if (context === "personality-test") {
      // Users can only upload to their own profile
      if (entityId !== profile.id) {
        return NextResponse.json(
          { error: "Nemůžeš nahrát soubor pro jinou osobu" },
          { status: 403 }
        );
      }
    } else if (context === "profile") {
      // Users can only upload to their own profile
      if (entityId !== profile.id) {
        return NextResponse.json(
          { error: "Nemáš oprávnění nahrát obrázek pro tento profil" },
          { status: 403 }
        );
      }
    } else if (context === "team") {
      // Team pictures can only be managed by an admin of that team.
      // Membership lives on profiles.team_id (there is no team_members table).
      if (profile.team_id !== entityId) {
        return NextResponse.json(
          { error: "Nejsi členem:kou tohoto týmu" },
          { status: 403 }
        );
      }

      // Only admins can change team picture
      if (profile.role !== "admin") {
        return NextResponse.json(
          { error: "Pouze administrátoři mohou měnit obrázek týmu" },
          { status: 403 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Neplatný kontext nahrávání" },
        { status: 400 }
      );
    }

    // Generate presigned upload URL
    const fileExtension = getFileExtension(contentType);
    const presignedData = await generatePresignedUpload({
      context,
      entityId,
      contentType,
      fileExtension,
    });

    return NextResponse.json({
      success: true,
      data: presignedData,
    });
  } catch (error) {
    console.error("POST /api/storage/presign-upload error:", error);
    return NextResponse.json(
      { error: "Nepodařilo se vygenerovat URL pro nahrávání" },
      { status: 500 }
    );
  }
}
