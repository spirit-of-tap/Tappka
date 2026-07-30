import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getAvailableCopyForBook } from '@/lib/library/queries';

interface RouteContext {
  params: Promise<{ bookId: string }>;
}

export async function POST(_request: NextRequest, { params }: RouteContext) {
  try {
    const { bookId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) return NextResponse.json({ error: 'Profil nenalezen' }, { status: 403 });

    const availableCopyId = await getAvailableCopyForBook(supabase, bookId);
    if (!availableCopyId) {
      return NextResponse.json({ error: 'Žádná dostupná kopie' }, { status: 409 });
    }

    const now = new Date().toISOString();
    const dueAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: loan, error } = await supabase
      .from('book_loans')
      .insert({
        library_book_id: availableCopyId,
        borrower_id: profile.id,
        borrowed_at: now,
        due_at: dueAt,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data: loan }, { status: 201 });
  } catch (error) {
    console.error('POST /api/library/books/[bookId]/borrow error:', error);
    return NextResponse.json({ error: 'Nepodařilo se vypůjčit knihu' }, { status: 500 });
  }
}
