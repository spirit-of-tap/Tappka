import { getSessionProfile } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { getProfiles, getProfilePictureUrl } from '@/lib/komunita/queries';
import { KomunitaContent } from '@/components/komunita/komunita-content';
import { PageHeader } from '@/components/ui/page-header';
import { PageShell } from '@/components/ui/page-shell';

export const metadata = {
  title: 'Komunita',
  description: 'Najdi lidi z komunity, jejich tým a kontakt',
};

interface PageProps {
  searchParams: Promise<{
    search?: string;
  }>;
}

export default async function KomunitaPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createClient();

  // Load all active profiles once; filtering happens client-side.
  const [viewer, profiles] = await Promise.all([getSessionProfile(), getProfiles(supabase)]);

  const pictureUrls: Record<string, string | null> = {};
  for (const profile of profiles) {
    pictureUrls[profile.id] = getProfilePictureUrl(supabase, profile);
  }

  return (
    <PageShell>
      <PageHeader
        title="Komunita"
        description="Najdi lidi z komunity, jejich tým a kontakt"
      />

      <KomunitaContent
        profiles={profiles}
        pictureUrls={pictureUrls}
        viewerTeamId={viewer?.team_id ?? null}
        initialQuery={params.search}
      />
    </PageShell>
  );
}
