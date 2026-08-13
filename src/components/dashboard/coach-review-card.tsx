import Link from 'next/link';
import { ArrowRight, Inbox } from 'lucide-react';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { CoachReviewEssay } from '@/lib/essays/types';

interface CoachReviewCardProps {
  essays: CoachReviewEssay[];
  hasTeam: boolean;
}

export function CoachReviewCard({ essays, hasTeam }: CoachReviewCardProps) {
  const preview = essays.slice(0, 3);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Inbox className="size-4 text-muted-foreground" />
          Ke kontrole
        </CardTitle>
        <CardDescription>
          {!hasTeam
            ? 'Nemáš přiřazený tým'
            : essays.length === 0
              ? 'Vše přečteno'
              : `${essays.length} ${essays.length === 1 ? 'nepřečtená esej' : essays.length < 5 ? 'nepřečtené eseje' : 'nepřečtených esejí'}`}
        </CardDescription>
        <CardAction>
          <Link
            href="/cteni/eseje/ke-kontrole"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline underline-offset-4"
          >
            Otevřít
            <ArrowRight className="size-3.5" />
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {preview.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {hasTeam
              ? 'Žádné eseje nečekají na kontrolu. 🎉'
              : 'Eseje tvého týmu se zobrazí, jakmile ti bude tým přiřazen.'}
          </p>
        ) : (
          <ul className="space-y-3">
            {preview.map((essay) => (
              <li key={essay.id}>
                <Link href={`/cteni/eseje/${essay.id}`} className="group block">
                  <p className="text-sm font-medium group-hover:underline underline-offset-4 line-clamp-1">
                    {essay.title}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {essay.author?.name ?? 'Neznámý:á autor:ka'}
                    {essay.book && ` · ${essay.book.title_cs}`}
                    {' · '}
                    {new Date(essay.created_at).toLocaleDateString('cs-CZ', {
                      day: 'numeric',
                      month: 'numeric',
                    })}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
