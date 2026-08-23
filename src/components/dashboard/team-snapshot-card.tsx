import Link from 'next/link';
import { ArrowRight, Users } from 'lucide-react';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ProfileAvatar } from '@/components/profile-avatar';

interface TeamSnapshotCardProps {
  stats: {
    profile: { id: string; name: string; picture: string | null };
    approved_points: number;
    pending_points: number;
  }[];
  hasTeam: boolean;
  teamName?: string | null;
}

export function TeamSnapshotCard({ stats, hasTeam, teamName }: TeamSnapshotCardProps) {
  const top = [...stats].sort((a, b) => b.approved_points - a.approved_points).slice(0, 3);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="size-4 text-muted-foreground" />
          {teamName ? `Tým ${teamName}` : 'Tým'}
        </CardTitle>
        <CardDescription>Nejlepší čtenáři:ky podle knižních bodů</CardDescription>
        <CardAction>
          <Link
            href="/cteni/prehled"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline underline-offset-4"
          >
            Celý tým
            <ArrowRight className="size-3.5" />
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {!hasTeam ? (
          <p className="text-sm text-muted-foreground">Nemáš přiřazený tým.</p>
        ) : top.length === 0 ? (
          <p className="text-sm text-muted-foreground">Tým zatím nemá žádné body.</p>
        ) : (
          <ul className="space-y-3">
            {top.map((row, i) => (
              <li key={row.profile.id}>
                <Link
                  href={`/komunita/profil/${row.profile.id}`}
                  className="group focus-ring flex items-center gap-3 rounded-md"
                >
                  <span className="w-4 text-sm tabular-nums text-muted-foreground">
                    {i + 1}.
                  </span>
                  <ProfileAvatar picture={row.profile.picture} name={row.profile.name} size={28} />
                  <span className="flex-1 truncate text-sm group-hover:underline underline-offset-4">
                    {row.profile.name}
                  </span>
                  <span className="text-sm font-medium tabular-nums">
                    {row.approved_points} b.
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
