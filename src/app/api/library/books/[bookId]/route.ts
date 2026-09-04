import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { getBookLibraryInfo } from '@/lib/library/queries';
import { serverLogger } from "@/lib/server-logger";

interface RouteContext {
  params: Promise<{ bookId: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { bookId } = await params;
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null;
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const info = await getBookLibraryInfo(supabase, bookId);

    return NextResponse.json({ data: info });
  } catch (error) {
    serverLogger.console.error('GET /api/library/books/[bookId] error:', error);
    return NextResponse.json({ error: 'Nepodařilo se načíst informace o knize' }, { status: 500 });
  }
}
