import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getBookComments } from '@/lib/books/queries';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const comments = await getBookComments(supabase, id);
    return NextResponse.json({ data: comments });
  } catch (error) {
    console.error('GET /api/books/[id]/comments error:', error);
    return NextResponse.json({ error: 'Nepodařilo se načíst komentáře' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) return NextResponse.json({ error: 'Profil nenalezen' }, { status: 403 });

    const { body } = await request.json();
    if (!body?.trim()) {
      return NextResponse.json({ error: 'Text komentáře je povinný' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('book_comments')
      .insert({ book_id: id, author_profile_id: profile.id, body: body.trim() })
      .select(`*, author:profiles!author_profile_id(id, name, picture, role)`)
      .single();

    if (error) throw error;
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('POST /api/books/[id]/comments error:', error);
    return NextResponse.json({ error: 'Nepodařilo se přidat komentář' }, { status: 500 });
  }
}
