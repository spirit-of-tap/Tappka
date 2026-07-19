import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { BOOK_CATEGORY_LABELS } from '@/lib/books/types';
import { tagNamesFromJoin } from '@/lib/books/tags';
import { patchEsejeSheetXml } from '@/lib/portfolio/generate-eseje-sheet';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

  const profile = await getCurrentUserProfile(supabase, { user });
  if (!profile) return NextResponse.json({ error: 'Profil nenalezen' }, { status: 403 });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'Soubor chybí' }, { status: 400 });

  const origin = request.headers.get('origin') ?? `https://${request.headers.get('host')}`;

  const essayData = await supabase
    .from('essays')
    .select(`
      id,
      essay_revisions(title, revision_no, invalid_since),
      book:books!book_id(
        id,
        title,
        author,
        book_points,
        source,
        book_tags(tags(name))
      )
    `)
    .eq('author_profile_id', profile.id)
    .not('published_at', 'is', null)
    .is('removed_at', null)
    .not('book_id', 'is', null)
    .order('created_at', { ascending: true });

  if (essayData.error) throw essayData.error;

  const rows = (essayData.data ?? []).map((essay, i) => {
    const rawBook = Array.isArray(essay.book) ? essay.book[0] : essay.book;
    const book = rawBook as {
      title: string;
      author: string;
      book_points: number | null;
      book_tags?: { tags: { name: string } | null }[] | null;
    } | null;
    const tags = tagNamesFromJoin(book?.book_tags);
    const firstTag = tags[0] ?? '';
    const category = BOOK_CATEGORY_LABELS[firstTag] ?? firstTag;
    const revisions = essay.essay_revisions as { title: string; revision_no: number; invalid_since: string | null }[] | null;
    const valid = (revisions ?? []).filter((r) => r.invalid_since == null);
    const essayTitle = valid.length === 0
      ? ''
      : valid.reduce((best, row) => (row.revision_no > best.revision_no ? row : best)).title;

    return {
      index: i + 1,
      bookTitle: book?.title ?? '',
      author: book?.author ?? '',
      essayId: essay.id,
      essayTitle,
      essayUrl: `${origin}/eseje/${essay.id}`,
      category,
      source: 'Kniha',
      points: Number(book?.book_points ?? 0),
    };
  });

  // Load the xlsx as a ZIP and surgically patch only the Eseje worksheet XML.
  // Everything else (styles, drawings, images, formulas, other sheets) stays untouched.
  const JSZip = (await import('jszip')).default;
  const arrayBuf = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuf);

  // Resolve Eseje sheet filename from workbook relationships
  const wbXml = await zip.file('xl/workbook.xml')!.async('string');
  const wbRelsXml = await zip.file('xl/_rels/workbook.xml.rels')!.async('string');

  const esejeRid =
    wbXml.match(/name="Eseje"[^>]*r:id="([^"]+)"/)?.[1] ??
    wbXml.match(/r:id="([^"]+)"[^>]*name="Eseje"/)?.[1];
  if (!esejeRid) return NextResponse.json({ error: 'List "Eseje" nenalezen v souboru' }, { status: 400 });

  const esejeTarget = wbRelsXml.match(new RegExp(`Id="${esejeRid}"[^>]*Target="([^"]+)"`))?.[1];
  if (!esejeTarget) return NextResponse.json({ error: 'Soubor listu "Eseje" nenalezen' }, { status: 400 });

  const esejeEntry = zip.file(`xl/${esejeTarget}`);
  if (!esejeEntry) return NextResponse.json({ error: 'XML listu "Eseje" nenalezeno' }, { status: 400 });

  const esejeXml = await esejeEntry.async('string');
  zip.file(`xl/${esejeTarget}`, patchEsejeSheetXml(esejeXml, rows));

  const outputBuffer = await zip.generateAsync({
    type: 'arraybuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return new NextResponse(outputBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      'X-Essay-Count': String(rows.length),
    },
  });
}
