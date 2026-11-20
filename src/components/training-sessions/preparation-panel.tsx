"use client"

import { FileText, Link2Off, Megaphone } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { DraftRecoveryBanner } from "@/components/editor-drafts/draft-recovery-banner"
import { TiptapEditor } from "@/components/essays/tiptap-editor"
import { TiptapRenderer } from "@/components/essays/tiptap-renderer"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/responsive-alert-dialog"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { isDraftNewerThan } from "@/lib/editor-drafts/draft-storage"
import { useEditorDraft } from "@/lib/editor-drafts/use-editor-draft"
import { contentTextFromJson, EMPTY_DOC, normalizeContentJson } from "@/lib/essays/content-text"
import { countWords } from "@/lib/essays/text-stats"
import { findPreparationLink, isLinkOnlyPreparation } from "@/lib/training-sessions/preparation-links"
import type { TsAttachmentSummary } from "@/lib/training-sessions/types"

import { CopyPreparationButton } from "./copy-preparation-button"
import { CopyTeamsMessageButton } from "./copy-teams-message-button"
import { LinkOnlyPreparationSteps } from "./link-only-preparation-steps"
import { PreparationAttachments } from "./preparation-attachments"
import { PreparationInProgress } from "./preparation-in-progress"
import { PreparationMoveIllustration } from "./preparation-move-illustration"

interface PreparationPanelProps {
  sessionId: string
  topic: string
  canEdit: boolean
  /** Off when the page already shows the copy icon next to its "Příprava" heading. */
  showCopy?: boolean
  /** Before the TS starts a missing preparation is "being written"; afterwards it is just missing. */
  upcoming: boolean
  contentJson: object | null
  publishedAt: string | null
  /** Supporting files shown under the text; never a substitute for it. */
  attachments: TsAttachmentSummary[]
  /** For the facilitators' Teams announcement. */
  startsAt: string
  endsAt: string
  facilitatorNames: string[]
}

const SAVE_SUCCESS_MESSAGE = "Příprava uložena"
const SAVE_ERROR_MESSAGE = "Přípravu se nepodařilo uložit"

interface PreparationDraftPayload {
  contentJson: object
}

/**
 * Untrusted localStorage payloads must be coerced before render: a tampered
 * entry like `{ savedAt, payload: null }` passes the storage shape check but
 * would crash the banner's word count otherwise.
 */
function sanitizePreparationDraft(payload: unknown): PreparationDraftPayload {
  const p = (typeof payload === "object" && payload !== null ? payload : {}) as Record<string, unknown>
  return { contentJson: (p.contentJson ?? {}) as object }
}

export function PreparationPanel({
  sessionId,
  topic,
  canEdit,
  showCopy = true,
  upcoming,
  contentJson,
  publishedAt,
  attachments,
  startsAt,
  endsAt,
  facilitatorNames,
}: PreparationPanelProps) {
  const router = useRouter()
  const [doc, setDoc] = useState<object>(contentJson ?? EMPTY_DOC)
  const [pending, setPending] = useState(false)
  const [linkWarningOpen, setLinkWarningOpen] = useState(false)
  // Remounts the editor after a draft restore: TiptapEditor only applies
  // initialContent to an empty editor, so a non-empty one must be recreated
  // to visibly show the restored doc.
  const [editorKey, setEditorKey] = useState(0)

  // Save entry for the window Ctrl+S shortcut below. Null for viewers, so the
  // browser keeps its own "save page" behavior there.
  const saveShortcutRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "s") return
      const save = saveShortcutRef.current
      if (!save) return
      event.preventDefault()
      save()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  // Recovery net: mirrors the doc into localStorage so a closed tab does not
  // eat the preparation. Viewers hydrate it too but never render the banner.
  const { draft, update, discard } = useEditorDraft<PreparationDraftPayload>(`preparation:${sessionId}`)
  const [draftBannerDismissed, setDraftBannerDismissed] = useState(false)
  const docRef = useRef(doc)
  docRef.current = doc

  if (!canEdit) {
    if (!publishedAt || !contentJson || contentTextFromJson(contentJson) === "") {
      if (upcoming) {
        return (
          <Empty className="py-8">
            <EmptyHeader>
              <PreparationInProgress />
              <EmptyTitle className="mt-2">Facilitace na přípravě pracuje</EmptyTitle>
              <EmptyDescription>Jakmile bude hotová, objeví se tady.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )
      }
      return (
        <Empty className="py-8">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileText className="size-6 text-muted-foreground" aria-hidden />
            </EmptyMedia>
            <EmptyTitle>Příprava chybí</EmptyTitle>
            <EmptyDescription>K tomuto setkání příprava nevznikla.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )
    }
    return (
      <div className="space-y-6">
        {showCopy ? (
          <div className="relative">
            <div className="absolute right-0 top-0">
              <CopyPreparationButton topic={topic} contentJson={contentJson} />
            </div>
            <TiptapRenderer content={contentJson} />
          </div>
        ) : (
          <TiptapRenderer content={contentJson} />
        )}
        <PreparationAttachments sessionId={sessionId} attachments={attachments} canEdit={false} />
      </div>
    )
  }

  // The announcement links to what others will see, so it waits for a saved, non-empty preparation.
  const isSavedWithText = Boolean(publishedAt) && contentJson !== null && contentTextFromJson(contentJson) !== ""

  async function saveNow() {
    setPending(true)
    const saving = docRef.current
    try {
      const res = await fetch(`/api/training-sessions/${sessionId}/preparation`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentJson: saving }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(body.error ?? SAVE_ERROR_MESSAGE)
        return
      }
      // The saved content is safely on the server; the local draft is redundant
      // unless the person kept typing while the save was in flight.
      if (JSON.stringify(docRef.current) === JSON.stringify(saving)) discard()
      toast.success(SAVE_SUCCESS_MESSAGE)
      router.refresh()
    } catch {
      toast.error(SAVE_ERROR_MESSAGE)
    } finally {
      setPending(false)
    }
  }

  function handleSaveClick() {
    // The Uložit button is disabled while saving, but the keyboard shortcut
    // bypasses it — guard here instead of at each caller.
    if (pending) return
    if (isLinkOnlyPreparation(doc)) {
      setLinkWarningOpen(true)
      return
    }
    void saveNow()
  }

  // The window shortcut goes through the same path as the Uložit button, so
  // the link-only warning still applies. Assigned during render like the
  // editor's own callback refs (onChangeRef in TiptapEditor).
  saveShortcutRef.current = handleSaveClick

  function handleConfirmLinkOnly() {
    setLinkWarningOpen(false)
    void saveNow()
  }

  // Live nudge: flags a link-only draft under the editor, before saving even comes up.
  // The modal on save stays as the backstop.
  const showLinkHint = isLinkOnlyPreparation(doc)
  const linkHref = showLinkHint ? findPreparationLink(doc) : null
  const showDraftBanner = draft !== null && !draftBannerDismissed && isDraftNewerThan(draft, publishedAt)
  const safeDraftPayload = draft !== null ? sanitizePreparationDraft(draft.payload) : null

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {showDraftBanner && draft !== null && safeDraftPayload !== null && (
          <DraftRecoveryBanner
            savedAt={draft.savedAt}
            wordCount={safeDraftPayload !== null ? countWords(contentTextFromJson(safeDraftPayload.contentJson)) : undefined}
            onRestore={() => {
              setDoc(normalizeContentJson(safeDraftPayload.contentJson))
              setEditorKey((key) => key + 1)
              setDraftBannerDismissed(true)
            }}
            onDiscard={() => {
              discard()
              setDraftBannerDismissed(true)
            }}
          />
        )}
        <TiptapEditor
          key={editorKey}
          initialContent={doc}
          onChange={(json) => {
            setDoc(json)
            update({ contentJson: json })
            // The restore offer shows a frozen snapshot; once the person edits
            // over it, the offer is withdrawn. The draft keeps updating.
            setDraftBannerDismissed(true)
          }}
          placeholder="Co je potřeba si připravit, přečíst nebo promyslet předem?"
        />
        {showLinkHint && (
          <div role="note" aria-label="Příprava je zatím jen odkaz" className="space-y-3 rounded-lg bg-warning/10 p-4">
            <div className="flex items-start gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-warning/15 text-warning-strong">
                <Link2Off className="size-4" aria-hidden />
              </span>
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-warning-strong">Zatím je tu jen odkaz</p>
                <p className="text-sm text-muted-foreground">
                  Stejně jako eseje i příprava patří přímo do Tappky, ať ji mají všichni po ruce i za rok. Přenést
                  ji zabere pár vteřin:
                </p>
              </div>
            </div>
            <div className="sm:pl-11">
              <LinkOnlyPreparationSteps href={linkHref} />
            </div>
          </div>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">Uloženou přípravu uvidí všichni, kdo si TS otevřou.</p>
          <Button
            size="sm"
            disabled={pending}
            onClick={handleSaveClick}
            title="Uložit (Ctrl+S)"
            className="self-start sm:self-auto"
          >
            Uložit
          </Button>
        </div>
      </div>
      <AlertDialog open={linkWarningOpen} onOpenChange={setLinkWarningOpen}>
        <AlertDialogContent>
          <div className="pt-2">
            <PreparationMoveIllustration />
          </div>
          <AlertDialogHeader>
            <AlertDialogTitle>Vložit přípravu rovnou do Tappky?</AlertDialogTitle>
            <AlertDialogDescription>
              V přípravě je jen odkaz na dokument mimo Tappku. Ostatní ho musí otevírat bokem, a když se změní
              přístup nebo dokument zmizí, z historie TS zmizí i příprava. Odkaz klidně nech pod textem jako
              zdroj.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-lg bg-muted/50 p-3">
            <LinkOnlyPreparationSteps href={linkHref} />
          </div>
          {/* Primary last: right on desktop, on top in the mobile drawer (its footer is column-reversed). */}
          <AlertDialogFooter>
            <AlertDialogAction variant="ghost" onClick={handleConfirmLinkOnly}>
              Uložit jen odkaz
            </AlertDialogAction>
            <AlertDialogCancel variant="default">Doplním text sem</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <PreparationAttachments sessionId={sessionId} attachments={attachments} canEdit />
      {isSavedWithText && (
        <div className="flex flex-col gap-3 rounded-lg bg-muted/50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-success/10 text-success-strong">
              <Megaphone className="size-4" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-medium">Příprava je hotová? Dej týmu vědět</p>
              <p className="text-xs text-muted-foreground">Zkopíruj zprávu s odkazem a vlož ji do Teams.</p>
            </div>
          </div>
          <CopyTeamsMessageButton
            sessionId={sessionId}
            topic={topic}
            startsAt={startsAt}
            endsAt={endsAt}
            facilitatorNames={facilitatorNames}
          />
        </div>
      )}
    </div>
  )
}
