import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSignedStorageUrl } from "@/lib/storage/service";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("personality_tests")
      .select("file_path")
      .eq("id", id)
      .is("removed_at", null)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: "Test nenalezen" }, { status: 404 });
    }

    const url = await getSignedStorageUrl("documents", data.file_path);
    return NextResponse.redirect(url, 307);
  } catch (error) {
    console.error("GET /api/personality-tests/[id]/open error:", error);
    return NextResponse.json({ error: "Nepodařilo se otevřít soubor" }, { status: 500 });
  }
}
