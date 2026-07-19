import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';

const AUTHOR_SELECT = `*, author:profiles!author_profile_id(id, name, picture, role)`;

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Nemáš oprávnění k této akci' }, { status: 403 });
    }

    const payload = await request.json();
    const update: Record<string, unknown> = {};

    if ('archived' in payload) {
      update.archived_at = payload.archived ? new Date().toISOString() : null;
    }
    if ('admin_response' in payload) {
      const resp = typeof payload.admin_response === 'string' ? payload.admin_response.trim() : '';
      if (resp) {
        update.admin_response = resp;
        update.admin_response_by = profile.id;
        update.admin_response_at = new Date().toISOString();
      } else {
        update.admin_response = null;
        update.admin_response_by = null;
        update.admin_response_at = null;
      }
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Nic k aktualizaci' }, { status: 400 });
    }

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
    console.error('PATCH /api/feedback/[id] error:', error);
    return NextResponse.json({ error: 'Nepodařilo se upravit zpětnou vazbu' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) return NextResponse.json({ error: 'Profil nenalezen' }, { status: 403 });

    const { error } = await supabase.from('feedback').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/feedback/[id] error:', error);
    return NextResponse.json({ error: 'Nepodařilo se smazat zpětnou vazbu' }, { status: 500 });
  }
}
