import Link from "next/link"
import { BookOpen, Handshake, ArrowRight } from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card"
import { DASHBOARD_SECTION, DashboardCardTitle } from "@/components/dashboard/dashboard-card-title"
import { formatPointsWithLabel } from "@/lib/books/points"

function meetingLabel(n: number): string {
  if (n === 1) return "schůzka"
  if (n >= 2 && n <= 4) return "schůzky"
  return "schůzek"
}

interface MetricsCardProps {
  bookPoints: number
  meetingCount: number
}

export function MetricsCard({ bookPoints, meetingCount }: MetricsCardProps) {
  return (
    <Card className={DASHBOARD_SECTION}>
      <CardHeader>
        <DashboardCardTitle className="text-foreground">Metriky</DashboardCardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <Link href="/cteni/prehled" className="space-y-1 rounded-lg p-2 -m-2 transition-colors hover:bg-muted/50">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <BookOpen className="size-3.5" />
              Knižní body
            </div>
            <p className="font-heading text-xl font-extrabold tabular-nums leading-none whitespace-nowrap group flex items-center gap-2 text-chart-5">
              {formatPointsWithLabel(bookPoints)}
              <ArrowRight className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </p>
          </Link>
          <Link href="/schuzky" className="space-y-1 rounded-lg p-2 -m-2 transition-colors hover:bg-muted/50">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Handshake className="size-3.5" />
              Zákaznické schůzky
            </div>
            <p className="font-heading text-xl font-extrabold tabular-nums leading-none whitespace-nowrap group flex items-center gap-2 text-chart-2-strong">
              {meetingCount} {meetingLabel(meetingCount)}
              <ArrowRight className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </p>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
