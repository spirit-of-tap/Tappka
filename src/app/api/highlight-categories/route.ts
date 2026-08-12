import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getHighlightCategories } from '@/lib/books/queries';
import type { HighlightCategoryInput } from '@/lib/books/types';

async function requireCoach() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, error: NextResponse.json({ error: 'Neautorizováno' }, { status: 401 }) };

  const profile = await getCurrentUserProfile(supabase, { user });
  if (!profile || (profile.role !== 'coach' && profile.role !== 'admin')) {
    return { supabase, error: NextResponse.json({ error: 'Nemáš oprávnění' }, { status: 403 }) };
  }

  return { supabase, profile, error: null };
}

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const categories = await getHighlightCategories(supabase);
    return NextResponse.json({ data: categories });
  } catch (error) {
    console.error('GET /api/highlight-categories error:', error);
    return NextResponse.json({ error: 'Nepodařilo se načíst kategorie' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireCoach();
    if (ctx.error) return ctx.error;

    const body: HighlightCategoryInput = await request.json();
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Název kategorie je povinný' }, { status: 400 });
    }

    const { data, error } = await ctx.supabase!
      .from('highlight_categories')
      .insert({
        name: body.name.trim(),
        description: body.description?.trim() || null,
        created_by_profile_id: ctx.profile!.id,
        updated_by_profile_id: ctx.profile!.id,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('POST /api/highlight-categories error:', error);
    return NextResponse.json({ error: 'Nepodařilo se vytvořit kategorii' }, { status: 500 });
  }
}
