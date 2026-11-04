import Link from 'next/link';
import { PenLine, DoorOpen, Search, Inbox, ScrollText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CTENI_SCROLLKY_HREF } from '@/lib/constants/cteni';

interface QuickActionsProps {
  isCoach: boolean;
  unreadCount?: number;
}

export function QuickActions({ isCoach, unreadCount = 0 }: QuickActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {isCoach ? (
        <Button asChild>
          <Link href="/cteni/eseje/ke-kontrole">
            <Inbox className="size-4 mr-1.5" />
            Zkontrolovat eseje
            {unreadCount > 0 && (
              <span className="ml-1.5 rounded-full bg-primary-foreground/20 px-1.5 text-xs tabular-nums">
                {unreadCount}
              </span>
            )}
          </Link>
        </Button>
      ) : (
        <Button asChild>
          <Link href="/cteni/eseje/nova">
            <PenLine className="size-4 mr-1.5" />
            Napsat esej
          </Link>
        </Button>
      )}
      <Button asChild variant="outline">
        <Link href="/reservations">
          <DoorOpen className="size-4 mr-1.5" />
          Rezervovat místnost
        </Link>
      </Button>
      <Button asChild variant="outline">
        <Link href="/cteni/hledat">
          <Search className="size-4 mr-1.5" />
          Hledat knihu
        </Link>
      </Button>
      <Button asChild variant="outline">
        <Link href={CTENI_SCROLLKY_HREF}>
          <ScrollText className="size-4 mr-1.5" />
          Scrollky
        </Link>
      </Button>
    </div>
  );
}
