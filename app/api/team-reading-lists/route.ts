import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getTeamReadingLists } from '@/lib/books/team-lists';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });
    const lists = await getTeamReadingLists(supabase);
    return NextResponse.json({ data: lists });
  } catch (error) {
    console.error('GET /api/team-reading-lists error:', error);
    return NextResponse.json({ error: 'Nepodařilo se načíst seznamy' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) return NextResponse.json({ error: 'Profil nenalezen' }, { status: 403 });
    if (!profile.team_id) return NextResponse.json({ error: 'Nejsi v týmu' }, { status: 403 });

    const body = await request.json();
    const title = body?.title?.trim();
    const month = body?.month ?? null;
    if (!title) return NextResponse.json({ error: 'Název je povinný' }, { status: 400 });

    const { data, error } = await supabase
      .from('team_reading_lists')
      .insert({
        team_id: profile.team_id,
        title,
        month,
        created_by_profile_id: profile.id,
      })
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('POST /api/team-reading-lists error:', error);
    return NextResponse.json({ error: 'Nepodařilo se vytvořit seznam' }, { status: 500 });
  }
}
