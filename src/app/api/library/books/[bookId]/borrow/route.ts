import { NextRequest, NextResponse, after } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { trackServer } from '@/lib/analytics-server';
import { parseLibraryLabelCode } from '@/lib/library/label-code';
import { getAvailableCopyByLabelCode, getAvailableCopyForBook } from '@/lib/library/queries';
import { notifyBookBorrowed } from '@/lib/notifications/library-notifications';

const LOAN_DURATION_DAYS = 30;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

interface RouteContext {
  params: Promise<{ bookId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { bookId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) return NextResponse.json({ error: 'Profil nenalezen' }, { status: 403 });

    const rawLabelCode = request.nextUrl.searchParams.get('label');
    const labelCode = rawLabelCode == null ? null : parseLibraryLabelCode(rawLabelCode);
    if (rawLabelCode != null && labelCode == null) {
      return NextResponse.json({ error: 'Neplatný kód štítku' }, { status: 400 });
    }

    const availableCopyId = labelCode == null
      ? await getAvailableCopyForBook(supabase, bookId)
      : await getAvailableCopyByLabelCode(supabase, bookId, labelCode);
    if (!availableCopyId) {
      const message = labelCode == null ? 'Žádná dostupná kopie' : 'Tento výtisk není dostupný';
      return NextResponse.json({ error: message }, { status: 409 });
    }

    const now = new Date().toISOString();
    const dueAt = new Date(Date.now() + LOAN_DURATION_DAYS * MILLISECONDS_PER_DAY).toISOString();

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

    after(() => {
      trackServer('feature_interaction', profile.id, {
        feature: 'cteni',
        action: 'book_borrowed',
      });
      notifyBookBorrowed(supabase, {
        bookId,
        borrowerProfileId: profile.id,
        dueAt,
        origin: new URL(request.url).origin,
      }).catch((err) => console.error('notifyBookBorrowed failed:', err));
    });

    return NextResponse.json({ data: loan }, { status: 201 });
  } catch (error) {
    console.error('POST /api/library/books/[bookId]/borrow error:', error);
    return NextResponse.json({ error: 'Nepodařilo se vypůjčit knihu' }, { status: 500 });
  }
}
