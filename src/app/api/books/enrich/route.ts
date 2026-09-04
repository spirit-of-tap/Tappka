import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { enrichBook, type EnrichmentProbe } from '@/lib/books/enrichment/enrich';
import { serverLogger } from "@/lib/server-logger";

/**
 * Courtesy guard, not a boundary: per-instance state does not hold across
 * serverless invocations. The hard spend limit lives on the Perplexity account.
 */
const MAX_PER_WINDOW = 20;
const WINDOW_MS = 60 * 60 * 1000;
const recentByProfile = new Map<string, number[]>();

function withinBudget(profileId: string): boolean {
  const now = Date.now();
  const recent = (recentByProfile.get(profileId) ?? []).filter((at) => now - at < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    recentByProfile.set(profileId, recent);
    return false;
  }
  recent.push(now);
  recentByProfile.set(profileId, recent);
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) return NextResponse.json({ error: 'Profil nenalezen' }, { status: 403 });

    if (!withinBudget(profile.id)) {
      return NextResponse.json(
        { error: 'Zkusil jsi to příliš mnohokrát. Zkus to za chvíli, nebo vyplň údaje ručně.' },
        { status: 429 },
      );
    }

    const body: Partial<EnrichmentProbe> = await request.json();
    if (!body.title?.trim() || !body.author?.trim()) {
      return NextResponse.json({ error: 'Název a autor jsou povinné' }, { status: 400 });
    }

    const outcome = await enrichBook({
      title: body.title.trim(),
      author: body.author.trim(),
      isbn_13: body.isbn_13 ?? null,
      page_count: body.page_count ?? null,
      publisher: body.publisher ?? null,
      published_year: body.published_year ?? null,
    });

    if (!outcome.ok) {
      return NextResponse.json({ error: outcome.message }, { status: 503 });
    }

    return NextResponse.json({ data: outcome.value, citations: outcome.citations });
  } catch (error) {
    serverLogger.console.error('POST /api/books/enrich error:', error);
    return NextResponse.json({ error: 'Nepodařilo se dohledat údaje' }, { status: 500 });
  }
}
