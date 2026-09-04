import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getUserActiveLoanForBook } from '@/lib/library/queries';
import { serverLogger } from "@/lib/server-logger";

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

    const loanId = await getUserActiveLoanForBook(supabase, profile.id, bookId);
    if (!loanId) {
      return NextResponse.json({ error: 'Žádná aktivní výpůjčka' }, { status: 404 });
    }

    const now = new Date().toISOString();

    const { data: loan, error } = await supabase
      .from('book_loans')
      .update({ returned_at: now })
      .eq('id', loanId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data: loan });
  } catch (error) {
    serverLogger.console.error('POST /api/library/books/[bookId]/return error:', error);
    return NextResponse.json({ error: 'Nepodařilo se vrátit knihu' }, { status: 500 });
  }
}
