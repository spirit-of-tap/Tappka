import { redirect } from 'next/navigation';

import { LibraryLabelAssignment } from '@/components/library/library-label-assignment';
import { PageHeader } from '@/components/ui/page-header';
import { PageShell } from '@/components/ui/page-shell';
import { getSessionProfile } from '@/lib/auth/session';
import { parseLibraryLabelCode } from '@/lib/library/label-code';

interface LibraryLabelsPageProps {
  searchParams: Promise<{ label?: string; book?: string }>;
}

const PAGE_DESCRIPTION = 'Naskenuj štítek a přiřaď ho ke konkrétnímu výtisku';

export const metadata = {
  title: 'Přiřazení štítků | Tappka',
  description: PAGE_DESCRIPTION,
  robots: { index: false, follow: false },
};

export default async function LibraryLabelsPage({ searchParams }: LibraryLabelsPageProps) {
  const profile = await getSessionProfile();
  if (!profile || (profile.role !== 'coach' && profile.role !== 'admin')) {
    redirect('/');
  }

  const { label, book } = await searchParams;
  const initialLabelCode = label ? parseLibraryLabelCode(label) : null;

  return (
    <PageShell size="narrow">
      <PageHeader
        title="Přiřazení knihovních štítků"
        description={PAGE_DESCRIPTION}
        back={{ href: '/cteni/sprava', label: 'Zpět na správu knihovny' }}
      />
      <LibraryLabelAssignment initialLabelCode={initialLabelCode} initialBookId={book ?? null} />
    </PageShell>
  );
}
