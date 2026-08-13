import { createClient } from '@/lib/supabase/server';
import { getProfiles, getTeamsWithCount, getProfilePictureUrl } from '@/lib/komunita/queries';
import { KomunitaContent } from '@/components/komunita/komunita-content';
import { PageShell } from '@/components/ui/page-shell';

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
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Komunita</h1>
        <p className="text-muted-foreground">
          Prohlížejte a kontaktujte členy:ky komunity
        </p>
      </div>

      <KomunitaContent
        profiles={profiles}
        pictureUrls={pictureUrls}
        teams={teamsWithCount}
        initialQuery={params.search}
      />
    </PageShell>
  );
}
