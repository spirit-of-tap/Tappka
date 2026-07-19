import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteParams {
  params: Promise<{ listId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { listId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const body = await request.json();
    const book_id = body?.book_id;
    const position = body?.position ?? 0;
    if (!book_id) return NextResponse.json({ error: 'book_id je povinný' }, { status: 400 });

    const { error } = await supabase
      .from('team_reading_list_books')
      .insert({ list_id: listId, book_id, position });

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'Kniha již je v seznamu' }, { status: 409 });
      throw error;
    }
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('POST list books error:', error);
    return NextResponse.json({ error: 'Nepodařilo se přidat knihu' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { listId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const body = await request.json();
    const { book_id, note } = body;
    if (!book_id) return NextResponse.json({ error: 'book_id je povinný' }, { status: 400 });

    const { error } = await supabase
      .from('team_reading_list_books')
      .update({ note: note ?? null })
      .eq('list_id', listId)
      .eq('book_id', book_id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PATCH list books error:', error);
    return NextResponse.json({ error: 'Nepodařilo se uložit poznámku' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { listId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const body = await request.json();
    const book_id = body?.book_id;
    if (!book_id) return NextResponse.json({ error: 'book_id je povinný' }, { status: 400 });

    const { error } = await supabase
      .from('team_reading_list_books')
      .delete()
      .eq('list_id', listId)
      .eq('book_id', book_id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE list books error:', error);
    return NextResponse.json({ error: 'Nepodařilo se odebrat knihu' }, { status: 500 });
  }
}
