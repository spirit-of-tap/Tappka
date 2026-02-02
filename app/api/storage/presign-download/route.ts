/**
 * API Route: Generate Presigned Download URL
 * GET /api/storage/presign-download?key=<file-key>
 * 
 * Generates a presigned GET URL for secure download from private B2 bucket.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generatePresignedDownload } from "@/lib/storage/service";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    console.log('[presign-download] Request for key:', key);

    if (!key) {
      return NextResponse.json(
        { error: "Chybí klíč souboru" },
        { status: 400 }
      );
    }

    // Generate presigned download URL
    const presignedData = await generatePresignedDownload(key);
    
    console.log('[presign-download] Generated URL:', presignedData.url.substring(0, 100) + '...');

    return NextResponse.json({
      success: true,
      data: presignedData,
    });
  } catch (error) {
    console.error("GET /api/storage/presign-download error:", error);
    return NextResponse.json(
      { error: "Nepodařilo se vygenerovat URL pro stažení" },
      { status: 500 }
    );
  }
}
