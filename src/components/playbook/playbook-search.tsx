"use client"

import { useMemo, useState } from "react"
import { Search } from "lucide-react"
import Link from "next/link"

import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { PLAYBOOK_CHAPTERS } from "@/lib/playbook/content"
import {
  MIN_QUERY_LENGTH,
  buildPlaybookIndex,
  highlightPlaybookSnippet,
  normalizePlaybookText,
  searchPlaybook,
  type PlaybookSearchResult,
} from "@/lib/playbook/search"

type PlaybookIndex = ReturnType<typeof buildPlaybookIndex>

// The index is built lazily at module scope: MiniSearch is environment-agnostic
// and the content is static, so it is created once per client bundle and shared
// across mounts (search box appears in the sidebar on every playbook page).
let index: PlaybookIndex | null = null

function getIndex(): PlaybookIndex {
  index ??= buildPlaybookIndex(PLAYBOOK_CHAPTERS)
  return index
}

interface ChapterResultGroup {
  chapterSlug: string
  chapterTitle: string
  results: PlaybookSearchResult[]
}

export function PlaybookSearch() {
  const [query, setQuery] = useState("")

  const canSearch = normalizePlaybookText(query.trim()).length >= MIN_QUERY_LENGTH
  const results = useMemo(
    () => (canSearch ? searchPlaybook(getIndex(), query) : []),
    [canSearch, query],
  )

  // Results arrive ranked across chapters; group them so each chapter heading
  // renders once, in the order of that chapter's best result.
  const groups = useMemo(() => {
    const byChapter = new Map<string, ChapterResultGroup>()
    for (const result of results) {
      const existing = byChapter.get(result.chapterSlug)
      if (existing) existing.results.push(result)
      else {
        byChapter.set(result.chapterSlug, {
          chapterSlug: result.chapterSlug,
          chapterTitle: result.chapterTitle,
          results: [result],
        })
      }
    }
    return Array.from(byChapter.values())
  }, [results])

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          role="searchbox"
          aria-label="Hledat v playbooku"
          placeholder="Hledat v playbooku…"
          autoComplete="off"
          className="pl-8"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {canSearch && results.length === 0 ? (
        <Empty className="gap-3 p-4 md:p-4">
          <EmptyHeader>
            <EmptyTitle>Nic jsme nenašli</EmptyTitle>
            <EmptyDescription>Zkus jiný výraz, nebo si projdi kapitoly.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : groups.length > 0 ? (
        <ul className="space-y-3">
          {groups.map((group) => (
            <li key={group.chapterSlug} className="space-y-1">
              <h4 className="px-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.chapterTitle}
              </h4>
              <ul className="space-y-0.5">
                {group.results.map((result) => (
                  <li key={`${result.chapterSlug}/${result.sectionSlug}`}>
                    <Link
                      href={`/playbook/${result.chapterSlug}#${result.sectionSlug}`}
                      className="block rounded-md px-1.5 py-1 transition-colors hover:bg-accent focus-ring"
                    >
                      <span className="block text-sm font-medium">{result.sectionTitle}</span>
                      <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">
                        {/* Note: prefix/fuzzy matches may produce snippets without
                            literal query substrings, so no <mark> appears — by design. */}
                        {highlightPlaybookSnippet(result.snippet, query).map((segment, index) =>
                          segment.match ? (
                            <mark
                              key={index}
                              className="rounded-sm bg-primary/15 font-medium text-foreground"
                            >
                              {segment.text}
                            </mark>
                          ) : (
                            <span key={index}>{segment.text}</span>
                          ),
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
