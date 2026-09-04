import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import type { Database } from '@/lib/supabase/database.types';
import { serverLogger } from "@/lib/server-logger";

const AUTHOR_SELECT = `*, author:profiles!author_profile_id(id, name, picture, role)`;

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null;
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Nemáš oprávnění k této akci' }, { status: 403 });
    }

    const payload = await request.json();
    const hasResolved = 'resolved' in payload || 'archived' in payload;

    if (!hasResolved) {
      return NextResponse.json({ error: 'Nic k aktualizaci' }, { status: 400 });
    }

    const resolved = 'resolved' in payload ? Boolean(payload.resolved) : Boolean(payload.archived);
    const update: Database['public']['Tables']['feedback']['Update'] = {
      resolved_at: resolved ? new Date().toISOString() : null,
      updated_by_profile_id: profile.id,
    };

    const { data, error } = await supabase
      .from('feedback')
      .update(update)
      .eq('id', id)
      .select(AUTHOR_SELECT)
      .single();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Zpětná vazba nenalezena' }, { status: 404 });
    return NextResponse.json({ data });
  } catch (error) {
    serverLogger.console.error('PATCH /api/feedback/[id] error:', error);
    return NextResponse.json({ error: 'Nepodařilo se upravit zpětnou vazbu' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null;
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) return NextResponse.json({ error: 'Profil nenalezen' }, { status: 403 });

    const { error } = await supabase.from('feedback').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    serverLogger.console.error('DELETE /api/feedback/[id] error:', error);
    return NextResponse.json({ error: 'Nepodařilo se smazat zpětnou vazbu' }, { status: 500 });
  }
}
