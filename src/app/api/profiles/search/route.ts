import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getProfiles } from '@/lib/komunita/queries';
import { serverLogger } from '@/lib/server-logger';

const SEARCH_RESULT_LIMIT = 8;

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null;
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const q = new URL(request.url).searchParams.get('q')?.trim() ?? '';
    if (!q) return NextResponse.json({ data: [] });
    if (q.length < 2) return NextResponse.json({ data: [] });

    const profiles = await getProfiles(supabase, { search: q });

    const limited = profiles.slice(0, SEARCH_RESULT_LIMIT);
    if (limited.length === 0) return NextResponse.json({ data: [] });

    const ids = limited.map((p) => p.id);
    const { data: essayRows, error: essayError } = await supabase
      .from('essays')
      .select('author_profile_id')
      .in('author_profile_id', ids)
      .not('published_at', 'is', null)
      .is('removed_at', null)
      .limit(500);
    if (essayError) throw essayError;

    const countByAuthor = new Map<string, number>();
    for (const row of (essayRows ?? []) as Array<{ author_profile_id: string }>) {
      countByAuthor.set(row.author_profile_id, (countByAuthor.get(row.author_profile_id) ?? 0) + 1);
    }

    const data = limited.map((p) => ({
      id: p.id,
      name: p.name,
      picture: p.picture,
      role: p.role,
      team: p.team ? { id: p.team.id, name: p.team.name } : null,
      essay_count: countByAuthor.get(p.id) ?? 0,
    }));

    return NextResponse.json({ data });
  } catch (error) {
    serverLogger.console.error('GET /api/profiles/search error:', error);
    return NextResponse.json({ error: 'Hledání lidí selhalo' }, { status: 500 });
  }
}
