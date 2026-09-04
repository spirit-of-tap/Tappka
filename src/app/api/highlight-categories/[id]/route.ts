import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import type { HighlightCategoryInput } from '@/lib/books/types';
import { serverLogger } from "@/lib/server-logger";

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function requireCoach() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null;
  if (!user) return { supabase, error: NextResponse.json({ error: 'Neautorizováno' }, { status: 401 }) };

  const profile = await getCurrentUserProfile(supabase, { user });
  if (!profile || (profile.role !== 'coach' && profile.role !== 'admin')) {
    return { supabase, error: NextResponse.json({ error: 'Nemáš oprávnění' }, { status: 403 }) };
  }

  return { supabase, profile, error: null };
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const ctx = await requireCoach();
    if (ctx.error) return ctx.error;

    const { id } = await params;
    const body: HighlightCategoryInput = await request.json();

    if (body.name !== undefined && !body.name.trim()) {
      return NextResponse.json({ error: 'Název kategorie je povinný' }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updated_by_profile_id: ctx.profile!.id };
    if (body.name?.trim()) updates.name = body.name.trim();
    if (body.description !== undefined) updates.description = body.description?.trim() || null;

    if (!body.name && body.description === undefined) {
      return NextResponse.json({ error: 'Žádné změny' }, { status: 400 });
    }

    const { data, error } = await ctx.supabase!
      .from('highlight_categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Kategorie nenalezena' }, { status: 404 });

    return NextResponse.json({ data });
  } catch (error) {
    serverLogger.console.error('PATCH /api/highlight-categories/[id] error:', error);
    return NextResponse.json({ error: 'Nepodařilo se upravit kategorii' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const ctx = await requireCoach();
    if (ctx.error) return ctx.error;

    const { id } = await params;
    // FK is ON DELETE SET NULL, so deleting a category un-highlights its books.
    const { error } = await ctx.supabase!
      .from('highlight_categories')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    serverLogger.console.error('DELETE /api/highlight-categories/[id] error:', error);
    return NextResponse.json({ error: 'Nepodařilo se smazat kategorii' }, { status: 500 });
  }
}
