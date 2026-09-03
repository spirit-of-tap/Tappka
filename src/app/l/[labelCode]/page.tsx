import { notFound, redirect } from 'next/navigation';

import { getSessionProfile } from '@/lib/auth/session';
import { parseLibraryLabelCode } from '@/lib/library/label-code';
import { getLibraryCopyByLabelCode } from '@/lib/library/queries';
import { createClient } from '@/lib/supabase/server';

interface LibraryLabelPageProps {
  params: Promise<{ labelCode: string }>;
}

export const metadata = {
  title: 'Knihovna | Tappka',
  robots: { index: false, follow: false },
};

export default async function LibraryLabelPage({ params }: LibraryLabelPageProps) {
  const { labelCode: rawLabelCode } = await params;
  const labelCode = parseLibraryLabelCode(rawLabelCode);
  if (labelCode == null) notFound();

  const supabase = await createClient();
  const copy = await getLibraryCopyByLabelCode(supabase, labelCode);

  if (!copy) {
    const profile = await getSessionProfile();
    if (profile?.role === 'coach' || profile?.role === 'admin') {
      redirect(`/knihovna/stitky?label=${labelCode}`);
    }
    notFound();
  }

  redirect(`/cteni/knihy/${copy.bookId}/pujcit?label=${labelCode}`);
}
