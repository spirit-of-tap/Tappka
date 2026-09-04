import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/auth-helpers";
import { deleteFile } from "@/lib/storage/service";
import {
  authorizeAction,
  getCurrentPictureKey,
  setPictureRef,
} from "@/lib/storage/authorization";
import { contextToBucket } from "@/lib/storage/buckets";
import { isExternalUrl } from "@/lib/storage/public-url";
import type { StorageContext } from "@/lib/storage/types";
import { serverLogger } from "@/lib/server-logger";

interface ConfirmUploadRequest {
  context: StorageContext;
  entityId: string;
  key: string;
  deleteOldKey?: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }

    const body: ConfirmUploadRequest = await request.json();
    const { context, entityId, key, deleteOldKey } = body;

    if (!context || !entityId || !key) {
      return NextResponse.json({ error: "Chybí povinné údaje" }, { status: 400 });
    }

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) {
      return NextResponse.json({ error: "Profil nenalezen" }, { status: 403 });
    }

    const authError = authorizeAction(context, entityId, profile);
    if (authError) {
      return NextResponse.json({ error: authError }, { status: 403 });
    }

    const existingKey = await getCurrentPictureKey(supabase, context, entityId);

    const result = await setPictureRef(supabase, context, entityId, key, context === "profile");
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Delete old picture if it exists and is not an external URL
    const oldKey = deleteOldKey ?? existingKey;
    if (oldKey && !isExternalUrl(oldKey)) {
      try {
        await deleteFile(contextToBucket(context), oldKey);
      } catch (error) {
        serverLogger.console.error("Error deleting old picture:", error);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Obrázek byl úspěšně nahrán",
    });
  } catch (error) {
    serverLogger.console.error("POST /api/storage/confirm-upload error:", error);
    return NextResponse.json(
      { error: "Nepodařilo se potvrdit nahrání" },
      { status: 500 }
    );
  }
}
