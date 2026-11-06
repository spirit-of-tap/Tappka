import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface KasaSectionProps {
  id: string;
  title: string;
  /** Prvek vpravo od nadpisu (štítek, odkaz). */
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Sekce stránky kasy: nadpis + obsah, oddělené jen linkou — žádné karty. */
export function KasaSection({ id, title, aside, className, children }: KasaSectionProps) {
  return (
    <section aria-labelledby={id} className={cn("space-y-5 border-t pt-8", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id={id} className="font-heading text-xl font-semibold tracking-tight">
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
