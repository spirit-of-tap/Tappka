import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getTeamById, getTeamPictureUrl, getProfilePictureUrl } from '@/lib/komunita/queries';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserCard } from '@/components/komunita/user-card';
import { TeamBookPointsChart } from '@/components/teams/team-book-points-chart';
import { TeamCustomerMeetingsChart } from '@/components/teams/team-customer-meetings-chart';
import { YEAR_LABELS, ROLE_LABELS } from '@/lib/komunita/types';
import { getTeamBookPointsStats } from '@/lib/essays/queries';
import { getTeamCustomerMeetingsStats } from '@/lib/customer-meetings/queries';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function TeamPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const [team, bookStats, meetingStats] = await Promise.all([
    getTeamById(supabase, id),
    getTeamBookPointsStats(supabase, id).catch(() => []),
    getTeamCustomerMeetingsStats(id).catch(() => []),
  ]);

  if (!team) {
    notFound();
  }

  const teamPictureUrl = getTeamPictureUrl(supabase, team);

  // Group profiles by role
  const coaches = team.profiles.filter((p) => p.role === 'coach');
  const mentors = team.profiles.filter((p) => p.role === 'mentor');
  const students = team.profiles.filter((p) => p.role === 'student' || p.role === 'admin');

  const backHref = `/komunita/tymy/${team.id}`;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Back Button */}
      <Button variant="ghost" size="sm" asChild>
        <Link href="/komunita">
          <ArrowLeft className="size-4 mr-2" />
          Zpět na komunitu
        </Link>
      </Button>

      {/* Team Header */}
      <div className="flex items-center gap-4">
        <Avatar size="lg" className="size-20">
          <AvatarImage src={teamPictureUrl || undefined} alt={team.name} />
          <AvatarFallback className="text-2xl">
            <Users className="size-8" />
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-2">
          <h1 className="text-3xl font-bold">{team.name}</h1>
          <div className="flex items-center gap-2 flex-wrap">
            {team.onboardingYear && (
              <Badge variant="outline">{YEAR_LABELS[team.onboardingYear]}</Badge>
            )}
            <span className="text-sm text-muted-foreground">
              {team.profiles.length} {team.profiles.length === 1 ? 'člen' : team.profiles.length < 5 ? 'členové' : 'členů'}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="clenove">
        <TabsList>
          <TabsTrigger value="clenove">Členové</TabsTrigger>
          <TabsTrigger value="statistiky">Statistiky</TabsTrigger>
        </TabsList>

        <TabsContent value="clenove" className="mt-4 space-y-6">
      {/* Coaches */}
      {coaches.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">{ROLE_LABELS.coach}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {coaches.map((profile) => {
              const pictureUrl = getProfilePictureUrl(supabase, profile);
              return (
                <UserCard
                  key={profile.id}
                  profile={{ ...profile, team }}
                  pictureUrl={pictureUrl}
                  from={backHref}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Mentors */}
      {mentors.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">{ROLE_LABELS.mentor}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {mentors.map((profile) => {
              const pictureUrl = getProfilePictureUrl(supabase, profile);
              return (
                <UserCard
                  key={profile.id}
                  profile={{ ...profile, team }}
                  pictureUrl={pictureUrl}
                  from={backHref}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Students */}
      {students.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">{ROLE_LABELS.student}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {students.map((profile) => {
              const pictureUrl = getProfilePictureUrl(supabase, profile);
              return (
                <UserCard
                  key={profile.id}
                  profile={{ ...profile, team }}
                  pictureUrl={pictureUrl}
                  from={backHref}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {team.profiles.length === 0 && (
        <div className="text-center py-12 space-y-2">
          <Users className="size-12 mx-auto text-muted-foreground" />
          <h3 className="font-semibold text-lg">Tým nemá žádné členy</h3>
          <p className="text-sm text-muted-foreground">
            V tomto týmu zatím nejsou žádní členové
          </p>
        </div>
      )}
        </TabsContent>

        <TabsContent value="statistiky" className="mt-4">
          <Tabs defaultValue="bookpoints">
            <TabsList>
              <TabsTrigger value="bookpoints">Knižní body</TabsTrigger>
              <TabsTrigger value="schuzky">Zákaznické schůzky</TabsTrigger>
            </TabsList>
            <TabsContent value="bookpoints" className="mt-4 space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Knižní body — přehled týmu</h2>
                <p className="text-sm text-muted-foreground">Schválené a čekající knihy na cestu k cíli 120 bodů</p>
              </div>
              <TeamBookPointsChart stats={bookStats} />
            </TabsContent>
            <TabsContent value="schuzky" className="mt-4 space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Zákaznické schůzky — přehled týmu</h2>
                <p className="text-sm text-muted-foreground">Počet schůzek napříč členy týmu</p>
              </div>
              <TeamCustomerMeetingsChart stats={meetingStats} />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}
