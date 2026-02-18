/**
 * API Route: Training Session Prep File Management
 * /api/training-sessions/[id]/prep
 *
 * GET - Get presigned download URL for the prep file
 * POST - Get presigned upload URL and confirm upload
 * DELETE - Remove the prep file
 *
 * Authorization:
 * - GET: Any authenticated user can download
 * - POST/DELETE: Only facilitators of the training session
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/auth-helpers";
import {
  generatePresignedUpload,
  generatePresignedDownload,
  deleteFile,
} from "@/lib/storage/service";
import {
  validateDocumentUpload,
  getDocumentExtension,
} from "@/lib/storage/validation";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Check if user is a facilitator of the training session
 */
async function isFacilitator(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string,
  profileId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("training_session_facilitators")
    .select("id")
    .eq("training_session_id", sessionId)
    .eq("user_id", profileId)
    .maybeSingle();

  return !!data;
}

/**
 * GET /api/training-sessions/[id]/prep
 * Get presigned download URL for the prep file
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }

    // Get the training session with prep file info
    const { data: session, error } = await supabase
      .from("training_sessions")
      .select("prep_file_key, prep_file_name")
      .eq("id", id)
      .maybeSingle();

    if (error || !session) {
      return NextResponse.json(
        { error: "Training session nenalezen" },
        { status: 404 }
      );
    }

    if (!session.prep_file_key) {
      return NextResponse.json(
        { error: "Příprava nebyla nahrána" },
        { status: 404 }
      );
    }

    // Generate presigned download URL
    const downloadData = await generatePresignedDownload(session.prep_file_key);

    return NextResponse.json({
      success: true,
      data: {
        url: downloadData.url,
        fileName: session.prep_file_name,
        expiresAt: downloadData.expiresAt,
      },
    });
  } catch (error) {
    console.error("GET /api/training-sessions/[id]/prep error:", error);
    return NextResponse.json(
      { error: "Nepodařilo se získat odkaz ke stažení" },
      { status: 500 }
    );
  }
}

interface PrepUploadRequest {
  action: "presign" | "confirm";
  // For presign action
  contentType?: string;
  fileSize?: number;
  fileName?: string;
  // For confirm action
  key?: string;
}

/**
 * POST /api/training-sessions/[id]/prep
 * Two-step upload: presign -> upload to B2 -> confirm
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) {
      return NextResponse.json(
        { error: "Profil nenalezen" },
        { status: 403 }
      );
    }

    // Check if training session exists
    const { data: session, error: sessionError } = await supabase
      .from("training_sessions")
      .select("id, prep_file_key")
      .eq("id", id)
      .maybeSingle();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: "Training session nenalezen" },
        { status: 404 }
      );
    }

    // Check if user is a facilitator
    const canUpload = await isFacilitator(supabase, id, profile.id);
    if (!canUpload) {
      return NextResponse.json(
        { error: "Pouze facilitátoři mohou nahrávat přípravu" },
        { status: 403 }
      );
    }

    const body: PrepUploadRequest = await request.json();

    if (body.action === "presign") {
      // Validate required fields for presign
      if (!body.contentType || !body.fileSize || !body.fileName) {
        return NextResponse.json(
          { error: "Chybí povinné údaje (contentType, fileSize, fileName)" },
          { status: 400 }
        );
      }

      // Validate file type and size
      const validationError = validateDocumentUpload(
        body.contentType,
        body.fileSize
      );
      if (validationError) {
        return NextResponse.json(
          { error: validationError.message },
          { status: 400 }
        );
      }

      // Generate presigned upload URL
      const fileExtension = getDocumentExtension(body.contentType);
      const presignedData = await generatePresignedUpload({
        context: "training-session-prep",
        entityId: id,
        contentType: body.contentType,
        fileExtension,
      });

      return NextResponse.json({
        success: true,
        data: {
          url: presignedData.url,
          key: presignedData.key,
          expiresAt: presignedData.expiresAt,
        },
      });
    } else if (body.action === "confirm") {
      // Validate required fields for confirm
      if (!body.key || !body.fileName) {
        return NextResponse.json(
          { error: "Chybí povinné údaje (key, fileName)" },
          { status: 400 }
        );
      }

      // Validate that the key belongs to this session's prep folder
      const expectedPrefix = `training-session-prep/${id}/`;
      if (!body.key.startsWith(expectedPrefix)) {
        return NextResponse.json(
          { error: "Neplatný klíč souboru" },
          { status: 400 }
        );
      }

      // Update training session with new file info first (before touching B2)
      const { error: updateError } = await supabase
        .from("training_sessions")
        .update({
          prep_file_key: body.key,
          prep_file_name: body.fileName,
        })
        .eq("id", id);

      if (updateError) {
        console.error("Error updating training session:", updateError);
        return NextResponse.json(
          { error: "Nepodařilo se uložit informace o souboru" },
          { status: 500 }
        );
      }

      // Delete old file from B2 only after DB update succeeded
      if (session.prep_file_key) {
        try {
          await deleteFile(session.prep_file_key);
        } catch (error) {
          console.warn("Error deleting old prep file from B2 (DB already updated):", error);
          // Don't fail the request — DB is consistent; orphaned B2 file is recoverable
        }
      }

      return NextResponse.json({
        success: true,
        message: "Příprava byla úspěšně nahrána",
      });
    } else {
      return NextResponse.json(
        { error: "Neplatná akce (použijte 'presign' nebo 'confirm')" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("POST /api/training-sessions/[id]/prep error:", error);
    return NextResponse.json(
      { error: "Nepodařilo se zpracovat požadavek" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/training-sessions/[id]/prep
 * Remove the prep file
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) {
      return NextResponse.json(
        { error: "Profil nenalezen" },
        { status: 403 }
      );
    }

    // Check if training session exists and get current file info
    const { data: session, error: sessionError } = await supabase
      .from("training_sessions")
      .select("id, prep_file_key")
      .eq("id", id)
      .maybeSingle();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: "Training session nenalezen" },
        { status: 404 }
      );
    }

    // Check if user is a facilitator
    const canDelete = await isFacilitator(supabase, id, profile.id);
    if (!canDelete) {
      return NextResponse.json(
        { error: "Pouze facilitátoři mohou mazat přípravu" },
        { status: 403 }
      );
    }

    if (!session.prep_file_key) {
      return NextResponse.json(
        { error: "Žádná příprava k smazání" },
        { status: 404 }
      );
    }

    // Clear file info from training session first (before touching B2)
    const { error: updateError } = await supabase
      .from("training_sessions")
      .update({
        prep_file_key: null,
        prep_file_name: null,
      })
      .eq("id", id);

    if (updateError) {
      console.error("Error clearing prep file info:", updateError);
      return NextResponse.json(
        { error: "Nepodařilo se odstranit informace o souboru" },
        { status: 500 }
      );
    }

    // Delete the file from B2 only after DB update succeeded
    try {
      await deleteFile(session.prep_file_key);
    } catch (error) {
      console.warn("Error deleting prep file from B2 (DB already updated):", error);
      // Don't fail the request — DB is consistent; orphaned B2 file is recoverable
    }

    return NextResponse.json({
      success: true,
      message: "Příprava byla smazána",
    });
  } catch (error) {
    console.error("DELETE /api/training-sessions/[id]/prep error:", error);
    return NextResponse.json(
      { error: "Nepodařilo se smazat přípravu" },
      { status: 500 }
    );
  }
}
