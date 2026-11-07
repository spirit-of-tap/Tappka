import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { BookOpen } from "lucide-react"

import { PageHeader } from "@/components/ui/page-header"
import { PageShell } from "@/components/ui/page-shell"
import { getSessionProfile } from "@/lib/auth/session"
import { PLAYBOOK_FALLBACK_DESCRIPTION } from "@/lib/playbook/constants"
import { PLAYBOOK_CHAPTERS } from "@/lib/playbook/content"
import { pluralizeCz } from "@/lib/utils/pluralize-cz"

export const metadata: Metadata = {
  title: "Playbook",
  description: PLAYBOOK_FALLBACK_DESCRIPTION,
}

export default async function PlaybookHomePage() {
  const profile = await getSessionProfile()
  if (!profile) redirect("/auth/login")

  return (
    <PageShell size="medium">
      <PageHeader
        title="Playbook"
        description={PLAYBOOK_FALLBACK_DESCRIPTION}
        count={{
          value: PLAYBOOK_CHAPTERS.length,
          label: pluralizeCz(PLAYBOOK_CHAPTERS.length, ["kapitola", "kapitoly", "kapitol"]),
        }}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {PLAYBOOK_CHAPTERS.map((chapter) => (
          <Link
            key={chapter.slug}
            href={`/playbook/${chapter.slug}`}
            className="group flex items-start gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-accent hover:text-accent-foreground focus-ring"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BookOpen className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1">
              <h2 className="text-sm font-semibold leading-tight">{chapter.title}</h2>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {chapter.sections.length}{" "}
                {pluralizeCz(chapter.sections.length, ["sekce", "sekce", "sekcí"])}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </PageShell>
  )
}
