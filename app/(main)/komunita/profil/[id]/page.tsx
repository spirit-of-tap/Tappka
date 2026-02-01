import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Mail, Phone, Cake, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getProfileById, getProfilePictureUrl, getTeamPictureUrl } from '@/lib/komunita/queries';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ROLE_LABELS, ROLE_COLORS, YEAR_LABELS } from '@/lib/komunita/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

/**
 * Get user initials from name
 */
function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default async function ProfilePage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const profile = await getProfileById(supabase, id);

  if (!profile) {
    notFound();
  }

  const pictureUrl = getProfilePictureUrl(supabase, profile);
  const teamPictureUrl = profile.team ? getTeamPictureUrl(supabase, profile.team) : null;

  return (
    <div className="container mx-auto py-6 max-w-4xl space-y-6">
      {/* Back Button */}
      <Button variant="ghost" size="sm" asChild>
        <Link href="/komunita/lide">
          <ArrowLeft className="size-4 mr-2" />
          Zpět na komunitu
        </Link>
      </Button>

      {/* Profile Header */}
      <div className="flex flex-col items-center gap-4 text-center">
        <Avatar size="lg" className="size-24">
          <AvatarImage src={pictureUrl || undefined} alt={profile.name} />
          <AvatarFallback className="text-2xl">{getInitials(profile.name)}</AvatarFallback>
        </Avatar>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">{profile.name}</h1>
          <Badge
            variant="outline"
            className={cn('text-sm', ROLE_COLORS[profile.role])}
          >
            {ROLE_LABELS[profile.role]}
          </Badge>
        </div>
      </div>

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle>Kontaktní informace</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Mail className="size-5 text-muted-foreground" />
            <div>
              <div className="text-sm text-muted-foreground">Pracovní email</div>
              <a
                href={`mailto:${profile.work_email}`}
                className="text-sm font-medium hover:underline"
              >
                {profile.work_email}
              </a>
            </div>
          </div>

          {profile.personal_email && (
            <div className="flex items-center gap-3">
              <Mail className="size-5 text-muted-foreground" />
              <div>
                <div className="text-sm text-muted-foreground">Osobní email</div>
                <a
                  href={`mailto:${profile.personal_email}`}
                  className="text-sm font-medium hover:underline"
                >
                  {profile.personal_email}
                </a>
              </div>
            </div>
          )}

          {profile.phone_number && (
            <div className="flex items-center gap-3">
              <Phone className="size-5 text-muted-foreground" />
              <div>
                <div className="text-sm text-muted-foreground">Telefon</div>
                <a
                  href={`tel:${profile.phone_number}`}
                  className="text-sm font-medium hover:underline"
                >
                  {profile.phone_number}
                </a>
              </div>
            </div>
          )}

          {profile.date_of_birth && (
            <div className="flex items-center gap-3">
              <Cake className="size-5 text-muted-foreground" />
              <div>
                <div className="text-sm text-muted-foreground">Datum narození</div>
                <div className="text-sm font-medium">
                  {format(new Date(profile.date_of_birth), 'd. MMMM yyyy', { locale: cs })}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team Information */}
      {profile.team && (
        <Card>
          <CardHeader>
            <CardTitle>Tým</CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href={`/komunita/tymy/${profile.team.id}`}
              className="flex items-center gap-4 p-4 rounded-lg border hover:bg-accent transition-colors"
            >
              <Avatar size="lg">
                <AvatarImage src={teamPictureUrl || undefined} alt={profile.team.name} />
                <AvatarFallback>
                  <Users className="size-6" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="font-semibold">{profile.team.name}</h3>
                {profile.team.year && (
                  <p className="text-sm text-muted-foreground">
                    {YEAR_LABELS[profile.team.year]}
                  </p>
                )}
              </div>
              <ArrowLeft className="size-5 rotate-180 text-muted-foreground" />
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
