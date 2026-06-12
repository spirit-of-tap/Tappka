import Link from 'next/link';
import { PenLine, DoorOpen, Search, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QuickActionsProps {
  isCoach: boolean;
  unreadCount?: number;
}

export function QuickActions({ isCoach, unreadCount = 0 }: QuickActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {isCoach ? (
        <Button asChild>
          <Link href="/eseje/ke-kontrole">
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
          <Link href="/eseje/nova">
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
        <Link href="/hledat">
          <Search className="size-4 mr-1.5" />
          Hledat knihu
        </Link>
      </Button>
    </div>
  );
}
