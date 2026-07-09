import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { uploadFile, generateFileKey } from '@/lib/storage/service';
import { getPublicStorageUrl } from '@/lib/storage/public-url';

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) return NextResponse.json({ error: 'Profil nenalezen' }, { status: 403 });

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'Soubor chybí' }, { status: 400 });

    const ext = ALLOWED_TYPES[file.type];
    if (!ext) return NextResponse.json({ error: 'Nepodporovaný formát' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.byteLength > MAX_BYTES) return NextResponse.json({ error: 'Soubor je příliš velký (max 5 MB)' }, { status: 400 });

    const key = generateFileKey('essay-images', profile.id, ext);
    await uploadFile(key, buffer, file.type);

    const src = getPublicStorageUrl(key);
    return NextResponse.json({ src }, { status: 201 });
  } catch (error) {
    console.error('POST /api/essays/upload-image error:', error);
    return NextResponse.json({ error: 'Upload selhal' }, { status: 500 });
  }
}
