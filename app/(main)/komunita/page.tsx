import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { getProfiles, getTeamsWithCount, getProfilePictureUrl } from '@/lib/komunita/queries';
import { SearchBar } from '@/components/komunita/search-bar';
import { TeamBadges } from '@/components/komunita/team-badges';
import { UserCard } from '@/components/komunita/user-card';
import { Users } from 'lucide-react';

interface PageProps {
  searchParams: Promise<{
    search?: string;
  }>;
}

export default async function KomunitaPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createClient();

  // Fetch teams (badges) and profiles in parallel
  const [teamsWithCount, profiles] = await Promise.all([
    getTeamsWithCount(supabase),
    getProfiles(supabase, {
      search: params.search,
    }),
  ]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Komunita</h1>
        <p className="text-muted-foreground">
          Prohlížejte a kontaktujte členy komunity
        </p>
      </div>

      {/* Search Bar */}
      <Suspense fallback={<div className="h-12 bg-muted animate-pulse rounded-xl" />}>
        <SearchBar />
      </Suspense>

      {/* Team Badges */}
      <TeamBadges teams={teamsWithCount} />

      {/* Results Count */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Users className="size-4" />
        <span>
          {profiles.length} {profiles.length === 1 ? 'člověk' : profiles.length < 5 ? 'lidé' : 'lidí'}
        </span>
      </div>

      {/* People Grid */}
      {profiles.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <Users className="size-12 mx-auto text-muted-foreground" />
          <h3 className="font-semibold text-lg">Nikdo nebyl nalezen</h3>
          <p className="text-sm text-muted-foreground">
            Zkuste upravit vyhledávání nebo filtry
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {profiles.map((profile) => {
            const pictureUrl = getProfilePictureUrl(supabase, profile);
            return <UserCard key={profile.id} profile={profile} pictureUrl={pictureUrl} />;
          })}
        </div>
      )}
    </div>
  );
}
