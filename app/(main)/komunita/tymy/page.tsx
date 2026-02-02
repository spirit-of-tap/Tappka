import Link from 'next/link';
import { Users as UsersIcon, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getTeamsWithCount, getTeamPictureUrl } from '@/lib/komunita/queries';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { YEAR_LABELS } from '@/lib/komunita/types';

export default async function KomunitaTymyPage() {
  const supabase = await createClient();

  // Fetch teams with member counts
  const teams = await getTeamsWithCount(supabase);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Týmy</h1>
        <p className="text-muted-foreground">
          Prohlížejte týmy a jejich členy
        </p>
      </div>

      {/* Results Count */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <UsersIcon className="size-4" />
        <span>
          {teams.length} {teams.length === 1 ? 'tým' : teams.length < 5 ? 'týmy' : 'týmů'}
        </span>
      </div>

      {/* Teams Grid */}
      {teams.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <UsersIcon className="size-12 mx-auto text-muted-foreground" />
          <h3 className="font-semibold text-lg">Žádné týmy</h3>
          <p className="text-sm text-muted-foreground">
            V komunitě zatím nejsou žádné týmy
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team) => {
            const teamPictureUrl = getTeamPictureUrl(supabase, team);
            return (
              <Link key={team.id} href={`/komunita/tymy/${team.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardContent className="p-6 space-y-4">
                    {/* Team Avatar and Name */}
                    <div className="flex items-center gap-4">
                      <Avatar size="lg" className="size-16">
                        <AvatarImage src={teamPictureUrl || undefined} alt={team.name} />
                        <AvatarFallback className="text-lg">
                          <UsersIcon className="size-6" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg truncate">{team.name}</h3>
                        {team.year && (
                          <Badge variant="outline" className="mt-1">
                            {YEAR_LABELS[team.year]}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Team Stats */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <UsersIcon className="size-4" />
                        <span>
                          {team.member_count} {team.member_count === 1 ? 'člen' : team.member_count < 5 ? 'členové' : 'členů'}
                        </span>
                      </div>
                      <ArrowRight className="size-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
