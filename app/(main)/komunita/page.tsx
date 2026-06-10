import { createClient } from '@/lib/supabase/server';
import { getProfiles, getTeamsWithCount, getProfilePictureUrl } from '@/lib/komunita/queries';
import { KomunitaContent } from '@/components/komunita/komunita-content';

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
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Komunita</h1>
        <p className="text-muted-foreground">
          Prohlížejte a kontaktujte členy komunity
        </p>
      </div>

      <KomunitaContent
        profiles={profiles}
        pictureUrls={pictureUrls}
        teams={teamsWithCount}
        initialQuery={params.search}
      />
    </div>
  );
}
