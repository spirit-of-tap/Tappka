import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { getContentSources } from '@/lib/content-sources/queries';

const SEARCH_LIMIT = 10;

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const q = new URL(request.url).searchParams.get('q') ?? '';
    if (!q.trim()) return NextResponse.json({ data: [] });

    const sources = await getContentSources(supabase, { search: q, pageSize: SEARCH_LIMIT });
    return NextResponse.json({ data: sources });
  } catch (error) {
    console.error('GET /api/content-sources/search error:', error);
    return NextResponse.json({ error: 'Vyhledávání selhalo' }, { status: 500 });
  }
}
