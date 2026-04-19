import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { searchBooksLocally } from '@/lib/books/queries';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const q = new URL(request.url).searchParams.get('q')?.trim() ?? '';
    if (!q) return NextResponse.json({ data: [] });

    const results = await searchBooksLocally(supabase, q);
    return NextResponse.json({ data: results });
  } catch (error) {
    console.error('GET /api/books/search error:', error);
    return NextResponse.json({ error: 'Hledání selhalo' }, { status: 500 });
  }
}
