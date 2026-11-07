import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { PlaybookRenderer } from "@/components/playbook/playbook-renderer"
import { PageHeader } from "@/components/ui/page-header"
import { PageShell } from "@/components/ui/page-shell"
import { getSessionProfile } from "@/lib/auth/session"
import { PLAYBOOK_CHAPTERS, getChapterBySlug } from "@/lib/playbook/content"

const FALLBACK_DESCRIPTION =
  "Příručka Tiimiakatemia Prague: procesy, pravidla a principy života v komunitě"

/** DESIGN.md: meta description ≤ ~90 chars, no trailing period. */
const MAX_DESCRIPTION_LENGTH = 88;

function metaDescriptionFromLead(lead: string): string {
  const sentence = lead.split(/(?<=[.!?])\s/)[0];
  if (sentence.length <= MAX_DESCRIPTION_LENGTH) return sentence.replace(/[.!?]$/, "");
  const cut = lead.slice(0, MAX_DESCRIPTION_LENGTH);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace === -1 ? MAX_DESCRIPTION_LENGTH : lastSpace)}…`;
}

interface PlaybookChapterPageProps {
  params: Promise<{ chapter: string }>
}

export function generateStaticParams() {
  return PLAYBOOK_CHAPTERS.map((chapter) => ({ chapter: chapter.slug }))
}

export async function generateMetadata({ params }: PlaybookChapterPageProps): Promise<Metadata> {
  const { chapter: slug } = await params
  const chapter = getChapterBySlug(slug)
  if (!chapter) return { title: "Playbook", description: FALLBACK_DESCRIPTION }
  return {
    title: chapter.title,
    description: chapter.lead ? metaDescriptionFromLead(chapter.lead) : FALLBACK_DESCRIPTION,
  }
}

export default async function PlaybookChapterPage({ params }: PlaybookChapterPageProps) {
  const profile = await getSessionProfile()
  if (!profile) redirect("/auth/login")

  const { chapter: slug } = await params
  const chapter = getChapterBySlug(slug)
  if (!chapter) notFound()

  return (
    <PageShell size="medium">
      <PageHeader
        title={chapter.title}
        description={chapter.lead}
        back={{ href: "/playbook", label: "Playbook" }}
      />
      <PlaybookRenderer sections={chapter.sections} />
    </PageShell>
  )
}
