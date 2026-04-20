import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getUserBookPointsStats } from '@/lib/essays/queries';
import { BOOK_CATEGORY_LABELS } from '@/lib/books/types';
import { buildEsejeSheet } from '@/lib/portfolio/generate-eseje-sheet';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

  const profile = await getCurrentUserProfile(supabase, { user });
  if (!profile) return NextResponse.json({ error: 'Profil nenalezen' }, { status: 403 });

  // Parse uploaded file
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'Soubor chybí' }, { status: 400 });

  const origin = request.headers.get('origin') ?? `https://${request.headers.get('host')}`;

  // Fetch user data in parallel
  const [essayData, stats] = await Promise.all([
    supabase
      .from('essays')
      .select(`id, title, book:books!book_id(id, title, author, book_points, tags, source)`)
      .eq('author_profile_id', profile.id)
      .eq('published', true)
      .not('book_id', 'is', null)
      .order('created_at', { ascending: true }),
    getUserBookPointsStats(supabase, profile.id),
  ]);

  if (essayData.error) throw essayData.error;

  const rows = (essayData.data ?? []).map((essay, i) => {
    const book = (Array.isArray(essay.book) ? essay.book[0] : essay.book) as {
      title: string; author: string; book_points: number; tags: string[];
    } | null;
    const firstTag = book?.tags?.[0] ?? '';
    const category = BOOK_CATEGORY_LABELS[firstTag] ?? firstTag;

    return {
      index: i + 1,
      bookTitle: book?.title ?? '',
      author: book?.author ?? '',
      essayId: essay.id as string,
      essayTitle: essay.title as string,
      essayUrl: `${origin}/eseje/${essay.id}`,
      category,
      source: 'Kniha',
      points: book?.book_points ?? 0,
    };
  });

  const portfolioStats = {
    approvedPoints: stats.approved_points,
    pendingPoints: stats.pending_points,
    essayCount: stats.essay_count,
  };

  // Load template with ExcelJS
  const arrayBuf = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await wb.xlsx.load(arrayBuf as any);

  // Replace Eseje sheet with beautifully styled generated sheet
  await buildEsejeSheet(wb, rows, portfolioStats);

  // Write to buffer and return
  const outputBuffer = await wb.xlsx.writeBuffer();

  return new NextResponse(outputBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      'X-Essay-Count': String(rows.length),
    },
  });
}
