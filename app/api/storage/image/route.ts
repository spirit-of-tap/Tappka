import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generatePresignedDownload } from '@/lib/storage/service';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const key = request.nextUrl.searchParams.get('key');
  if (!key) return new NextResponse('Missing key', { status: 400 });

  const { url } = await generatePresignedDownload(key);
  return NextResponse.redirect(url);
}
