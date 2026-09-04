import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/auth-helpers";
import { deleteFile } from "@/lib/storage/service";
import { MAX_DOCUMENT_SIZE } from "@/lib/storage/validation";
import { PERSONALITY_TEST_TYPES } from "@/lib/personality-tests/types";
import type { Updatable } from "@/lib/supabase/tables";
import { serverLogger } from "@/lib/server-logger";

interface UpdatePersonalityTestRequest {
  testType?: string;
  testTypeOther?: string;
  testedOn?: string;
  newKey?: string;
  fileName?: string;
  fileSize?: number;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) {
      return NextResponse.json({ error: "Profil nenalezen" }, { status: 403 });
    }

    const body: UpdatePersonalityTestRequest = await request.json();
    const { testType, testTypeOther, testedOn, newKey, fileName, fileSize } = body;

    const existing = await supabase
      .from("personality_tests")
      .select("id, profile_id, file_path, removed_at")
      .eq("id", id)
      .is("removed_at", null)
      .maybeSingle();

    if (existing.error || !existing.data) {
      return NextResponse.json({ error: "Test nenalezen" }, { status: 404 });
    }

    if (testType !== undefined && !(PERSONALITY_TEST_TYPES as readonly string[]).includes(testType)) {
      return NextResponse.json({ error: "Neplatný typ testu" }, { status: 400 });
    }
    if (testType === "other" && !testTypeOther?.trim()) {
      return NextResponse.json({ error: "Zadej název testu" }, { status: 400 });
    }
    if (testedOn !== undefined && !DATE_RE.test(testedOn)) {
      return NextResponse.json({ error: "Neplatné datum" }, { status: 400 });
    }
    if (newKey !== undefined) {
      if (!newKey.startsWith(`personality-test/${existing.data.profile_id}/`)) {
        return NextResponse.json({ error: "Neplatný klíč souboru" }, { status: 400 });
      }
      if (!fileName?.trim() || fileName.length > 255) {
        return NextResponse.json({ error: "Neplatný název souboru" }, { status: 400 });
      }
      if (typeof fileSize !== "number" || !Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_DOCUMENT_SIZE) {
        return NextResponse.json({ error: "Neplatná velikost souboru" }, { status: 400 });
      }
    }

    const update: Updatable<"personality_tests"> = { updated_by_profile_id: profile.id };
    if (testType !== undefined) {
      update.test_type = testType as Updatable<"personality_tests">["test_type"];
      update.test_type_other = testType === "other" ? testTypeOther!.trim() : null;
    }
    if (testedOn !== undefined) {
      update.tested_on = testedOn;
    }
    if (newKey !== undefined) {
      update.file_path = newKey;
      update.file_name = fileName!.trim();
      update.file_size = fileSize;
    }

    const { data: updated, error: updateError } = await supabase
      .from("personality_tests")
      .update(update)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (updateError || !updated) {
      return NextResponse.json({ error: "Nepodařilo se uložit změny" }, { status: 403 });
    }

    if (newKey !== undefined && newKey !== existing.data.file_path) {
      try {
        await deleteFile("documents", existing.data.file_path);
      } catch (error) {
        serverLogger.console.error("Error deleting old personality test file:", error);
      }
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    serverLogger.console.error("PATCH /api/personality-tests/[id] error:", error);
    return NextResponse.json({ error: "Nepodařilo se uložit změny" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) {
      return NextResponse.json({ error: "Profil nenalezen" }, { status: 403 });
    }

    const existing = await supabase
      .from("personality_tests")
      .select("id, file_path")
      .eq("id", id)
      .is("removed_at", null)
      .maybeSingle();

    if (existing.error || !existing.data) {
      return NextResponse.json({ error: "Test nenalezen" }, { status: 404 });
    }

    const { data: removed, error: updateError } = await supabase
      .from("personality_tests")
      .update({ removed_at: new Date().toISOString(), updated_by_profile_id: profile.id })
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (updateError || !removed) {
      return NextResponse.json({ error: "Nepodařilo se odstranit test" }, { status: 403 });
    }

    try {
      await deleteFile("documents", existing.data.file_path);
    } catch (error) {
      serverLogger.console.error("Error deleting personality test file:", error);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    serverLogger.console.error("DELETE /api/personality-tests/[id] error:", error);
    return NextResponse.json({ error: "Nepodařilo se odstranit test" }, { status: 500 });
  }
}
