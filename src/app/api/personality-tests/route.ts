import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/auth-helpers";
import { MAX_DOCUMENT_SIZE } from "@/lib/storage/validation";
import { PERSONALITY_TEST_TYPES } from "@/lib/personality-tests/types";
import type { Insertable } from "@/lib/supabase/tables";
import { serverLogger } from "@/lib/server-logger";

interface CreatePersonalityTestRequest {
  profileId: string;
  key: string;
  testType: string;
  testTypeOther?: string;
  testedOn: string;
  fileName: string;
  fileSize: number;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) {
      return NextResponse.json({ error: "Profil nenalezen" }, { status: 403 });
    }

    const body: CreatePersonalityTestRequest = await request.json();
    const { profileId, key, testType, testTypeOther, testedOn, fileName, fileSize } = body;

    if (profileId !== profile.id) {
      return NextResponse.json({ error: "Nemůžeš nahrát test pro jinou osobu" }, { status: 403 });
    }
    if (!(PERSONALITY_TEST_TYPES as readonly string[]).includes(testType)) {
      return NextResponse.json({ error: "Neplatný typ testu" }, { status: 400 });
    }
    if (testType === "other" && !testTypeOther?.trim()) {
      return NextResponse.json({ error: "Zadej název testu" }, { status: 400 });
    }
    if (!DATE_RE.test(testedOn)) {
      return NextResponse.json({ error: "Neplatné datum" }, { status: 400 });
    }
    if (!fileName?.trim() || fileName.length > 255) {
      return NextResponse.json({ error: "Neplatný název souboru" }, { status: 400 });
    }
    if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_DOCUMENT_SIZE) {
      return NextResponse.json({ error: "Neplatná velikost souboru" }, { status: 400 });
    }
    if (!key.startsWith(`personality-test/${profileId}/`)) {
      return NextResponse.json({ error: "Neplatný klíč souboru" }, { status: 400 });
    }

    const payload: Insertable<"personality_tests"> = {
      profile_id: profileId,
      test_type: testType as Insertable<"personality_tests">["test_type"],
      test_type_other: testType === "other" ? testTypeOther!.trim() : null,
      tested_on: testedOn,
      file_path: key,
      file_name: fileName.trim(),
      file_size: fileSize,
      created_by_profile_id: profile.id,
      updated_by_profile_id: profile.id,
    };

    const { data, error } = await supabase
      .from("personality_tests")
      .insert(payload)
      .select()
      .single();

    if (error) {
      serverLogger.console.error("POST /api/personality-tests insert error:", error);
      return NextResponse.json({ error: "Nepodařilo se uložit test" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    serverLogger.console.error("POST /api/personality-tests error:", error);
    return NextResponse.json({ error: "Nepodařilo se uložit test" }, { status: 500 });
  }
}
