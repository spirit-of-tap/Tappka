import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const { count, error } = await supabase
      .from('essays')
      .select('id', { count: 'exact', head: true })
      .eq('book_id', id)
      .is('removed_at', null);

    if (error) throw error;

    return NextResponse.json({ data: { count: count ?? 0 } });
  } catch (error) {
    console.error('GET /api/books/[id]/essays-count error:', error);
    return NextResponse.json({ error: 'Nepodařilo se načíst počet esejí' }, { status: 500 });
  }
}
