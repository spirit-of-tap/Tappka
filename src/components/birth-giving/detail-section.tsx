import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";

interface BirthGivingDetailSectionProps {
  title: string;
  icon?: LucideIcon;
  badge?: ReactNode;
  action?: ReactNode;
  boxed?: boolean;
  children: ReactNode;
}

export function BirthGivingDetailSection({
  title,
  icon: Icon,
  badge,
  action,
  boxed = false,
  children,
}: BirthGivingDetailSectionProps) {
  const header = (
    <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="size-4 text-muted-foreground" />}
        <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          {title}
        </h2>
        {badge}
      </div>
      {action}
    </div>
  );

  if (!boxed) {
    return (
      <section className="space-y-3">
        {header}
        {children}
      </section>
    );
  }

  return (
    <Card className="space-y-3 p-3.5 sm:p-4">
      {header}
      {children}
    </Card>
  );
}
