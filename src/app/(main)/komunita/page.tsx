import { createClient } from '@/lib/supabase/server';
import { getProfiles, getTeamsWithCount, getProfilePictureUrl } from '@/lib/komunita/queries';
import { KomunitaContent } from '@/components/komunita/komunita-content';
import { PageHeader } from '@/components/ui/page-header';
import { PageShell } from '@/components/ui/page-shell';

export const metadata = {
  title: 'Komunita',
  description: 'Prohlížej si členy:ky komunity a kontaktuj je',
};

interface PageProps {
  searchParams: Promise<{
    search?: string;
  }>;
}

export default async function KomunitaPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createClient();

  // Load all teams (badges) and all active profiles once; filtering happens client-side.
  const [teamsWithCount, profiles] = await Promise.all([
    getTeamsWithCount(supabase),
    getProfiles(supabase),
  ]);

  const pictureUrls: Record<string, string | null> = {};
  for (const profile of profiles) {
    pictureUrls[profile.id] = getProfilePictureUrl(supabase, profile);
  }

  return (
    <PageShell>
      <PageHeader
        title="Komunita"
        description="Prohlížej si členy:ky komunity a kontaktuj je"
      />

      <KomunitaContent
        profiles={profiles}
        pictureUrls={pictureUrls}
        teams={teamsWithCount}
        initialQuery={params.search}
      />
    </PageShell>
  );
}
