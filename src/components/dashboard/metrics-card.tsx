import Link from "next/link"
import { BarChart3, BookOpen, Handshake, ArrowRight } from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="size-4 text-muted-foreground" />
          Metriky
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <Link href="/prehled" className="space-y-1 rounded-lg p-2 -m-2 transition-colors hover:bg-muted/50">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <BookOpen className="size-3.5" />
              Knižní body
            </div>
            <p className="text-2xl font-bold tabular-nums leading-none group flex items-center gap-2">
              {formatPointsWithLabel(bookPoints)}
              <ArrowRight className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </p>
          </Link>
          <Link href="/schuzky" className="space-y-1 rounded-lg p-2 -m-2 transition-colors hover:bg-muted/50">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Handshake className="size-3.5" />
              Zákaznické schůzky
            </div>
            <p className="text-2xl font-bold tabular-nums leading-none group flex items-center gap-2">
              {meetingCount} {meetingLabel(meetingCount)}
              <ArrowRight className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </p>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
