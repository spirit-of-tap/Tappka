import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/auth-helpers";
import { deleteFile } from "@/lib/storage/service";
import {
  authorizeAction,
  getCurrentPictureKey,
  clearPictureRef,
} from "@/lib/storage/authorization";
import { contextToBucket } from "@/lib/storage/buckets";
import { isExternalUrl } from "@/lib/storage/public-url";
import type { StorageContext } from "@/lib/storage/types";

interface DeleteRequest {
  context: StorageContext;
  entityId: string;
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }

    const body: DeleteRequest = await request.json();
    const { context, entityId } = body;

    if (!context || !entityId) {
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

    if (!existingKey) {
      return NextResponse.json(
        { error: "Profil nemá nastavený obrázek" },
        { status: 404 }
      );
    }

    if (!isExternalUrl(existingKey)) {
      try {
        await deleteFile(contextToBucket(context), existingKey);
      } catch (error) {
        console.error("Error deleting file from storage:", error);
      }
    }

    const result = await clearPictureRef(supabase, context, entityId);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
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
