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
  boxed = true,
  children,
}: BirthGivingDetailSectionProps) {
  const header = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="size-4 text-muted-foreground" />}
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          {title}
        </h2>
        {badge}
      </div>
      {action}
    </div>
  );

  if (!boxed) {
    return (
      <div className="space-y-3">
        {header}
        {children}
      </div>
    );
  }

  return (
    <Card className="space-y-3 p-3 sm:p-4">
      {header}
      {children}
    </Card>
  );
}
