import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export function BetaBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("h-5 shrink-0 px-1.5 text-[10px] font-medium text-muted-foreground", className)}
    >
      Beta
    </Badge>
  )
}
