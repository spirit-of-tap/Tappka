import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    await supabase.rpc('record_essay_view', { p_essay_id: id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/essays/[id]/view error:', error);
    return NextResponse.json({ error: 'Nepodařilo se zaznamenat zobrazení' }, { status: 500 });
  }
}
