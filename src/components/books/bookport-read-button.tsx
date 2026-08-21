import { BookOpen } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { BookportMatch } from '@/lib/books/bookport';

interface BookportReadButtonProps {
  match: BookportMatch;
}

/**
 * Outbound link that opens the book on Bookport via the ČZU eduID login.
 * Shows a tooltip explaining what Bookport is and the known login issue.
 */
export function BookportReadButton({ match }: BookportReadButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button asChild variant="default" className="w-44 gap-2">
          <a href={match.loginUrl} target="_blank" rel="noopener noreferrer">
            <BookOpen className="size-3.5" />
            Číst zdarma
          </a>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs text-center">
        Bookport je online knihovna s tisíci e-knih. Knihu si zde zdarma
        přečtete po přihlášení univerzitním účtem ČZU. Pokud se přihlášení
        nepodaří, pomůže změna hesla v is.czu.cz.
      </TooltipContent>
    </Tooltip>
  );
}
