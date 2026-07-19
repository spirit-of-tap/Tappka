import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { searchExternalBooks, searchExternalByIsbn } from '@/lib/books/external';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim() ?? '';
    const isbn = searchParams.get('isbn')?.trim() ?? '';

    if (!q && !isbn) return NextResponse.json({ data: [] });

    let results;
    if (isbn) {
      const result = await searchExternalByIsbn(isbn);
      results = result ? [result] : [];
    } else {
      results = await searchExternalBooks(q);
    }

    return NextResponse.json({ data: results });
  } catch (error) {
    console.error('GET /api/books/external-search error:', error);
    return NextResponse.json({ error: 'Externí hledání selhalo' }, { status: 500 });
  }
}
