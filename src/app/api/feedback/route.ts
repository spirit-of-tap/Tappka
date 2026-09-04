import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { serverLogger } from "@/lib/server-logger";

const MAX_BODY_LENGTH = 4000;

const AUTHOR_SELECT = `*, author:profiles!author_profile_id(id, name, picture, role)`;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) return NextResponse.json({ error: 'Profil nenalezen' }, { status: 403 });

    const { body } = await request.json();
    const trimmed = typeof body === 'string' ? body.trim() : '';
    if (!trimmed) {
      return NextResponse.json({ error: 'Text zpětné vazby je povinný' }, { status: 400 });
    }
    if (trimmed.length > MAX_BODY_LENGTH) {
      return NextResponse.json({ error: 'Text je příliš dlouhý' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('feedback')
      .insert({
        author_profile_id: profile.id,
        body: trimmed,
        created_by_profile_id: profile.id,
        updated_by_profile_id: profile.id,
      })
      .select(AUTHOR_SELECT)
      .single();

    if (error) throw error;
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    serverLogger.console.error('POST /api/feedback error:', error);
    return NextResponse.json({ error: 'Nepodařilo se odeslat zpětnou vazbu' }, { status: 500 });
  }
}
