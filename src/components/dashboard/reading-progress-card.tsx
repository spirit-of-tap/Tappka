import Link from 'next/link';
import { ArrowRight, BookOpen } from 'lucide-react';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { PersonalProgress } from '@/components/essays/personal-progress';

interface ReadingProgressCardProps {
  stats: { approved_points: number; pending_points: number; essay_count: number };
}

export function ReadingProgressCard({ stats }: ReadingProgressCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="size-4 text-muted-foreground" />
          Čtení
        </CardTitle>
        <CardDescription>
          {stats.essay_count === 0
            ? 'Zatím žádné eseje'
            : `${stats.essay_count} ${stats.essay_count === 1 ? 'esej' : stats.essay_count < 5 ? 'eseje' : 'esejí'}`}
          {stats.pending_points > 0 &&
            ` · ${stats.pending_points} ${stats.pending_points === 1 ? 'kniha čeká' : stats.pending_points < 5 ? 'knihy čekají' : 'knih čeká'} na schválení`}
        </CardDescription>
        <CardAction>
          <Link
            href="/prehled"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline underline-offset-4"
          >
            Přehled
            <ArrowRight className="size-3.5" />
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        <PersonalProgress
          approved_points={stats.approved_points}
          pending_points={stats.pending_points}
        />
      </CardContent>
    </Card>
  );
}
