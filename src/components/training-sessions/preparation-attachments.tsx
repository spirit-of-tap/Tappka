"use client"

import { Download, FileText, Image as ImageIcon, Plus, Trash2, Upload } from "lucide-react"
import { useRouter } from "next/navigation"
import { useId, useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/responsive-dialog"
import { Spinner } from "@/components/ui/spinner"
import { formatFileSize } from "@/lib/personality-tests/format"
import {
  TS_ATTACHMENT_ACCEPT,
  TS_ATTACHMENT_LIMITS,
  validateAttachmentCandidate,
} from "@/lib/training-sessions/attachments"
import type { TsAttachmentSummary } from "@/lib/training-sessions/types"
import { cn } from "@/lib/utils"

const UPLOAD_ERROR_MESSAGE = "Přílohu se nepodařilo nahrát"
const DELETE_ERROR_MESSAGE = "Přílohu se nepodařilo odebrat"
const GUIDANCE = "Jen podklady, třeba kniha, článek nebo pracovní list. Samotná příprava patří do textu."
const LABEL_PLACEHOLDER = "Např. Kniha k přečtení"
const FORMATS_HINT = `PDF, Word, Excel, PowerPoint nebo obrázek · max ${TS_ATTACHMENT_LIMITS.maxBytes / 1024 / 1024} MB`

interface PreparationAttachmentsProps {
  sessionId: string
  attachments: TsAttachmentSummary[]
  canEdit: boolean
}

function attachmentHref(sessionId: string, attachmentId: string): string {
  return `/api/training-sessions/${sessionId}/attachments/${attachmentId}`
}

async function readError(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  return body.error ?? fallback
}

export function PreparationAttachments({ sessionId, attachments, canEdit }: PreparationAttachmentsProps) {
  const headingId = useId()
  const [adding, setAdding] = useState(false)
  if (!canEdit && attachments.length === 0) return null
  const canAdd = canEdit && attachments.length < TS_ATTACHMENT_LIMITS.maxPerSession

  return (
    <section aria-labelledby={headingId} className="space-y-2">
      <div className="flex min-h-8 items-center justify-between gap-2">
        <h3 id={headingId} className="text-sm font-semibold">
          Přílohy
          {attachments.length > 0 && (
            <span className="ml-1.5 font-normal text-muted-foreground tabular-nums">{attachments.length}</span>
          )}
        </h3>
        {canAdd && attachments.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" aria-hidden />
            Přidat přílohu
          </Button>
        )}
      </div>

      {attachments.length > 0 ? (
        <ul className="divide-y rounded-lg border bg-card">
          {attachments.map((attachment) => (
            <AttachmentRow key={attachment.id} sessionId={sessionId} attachment={attachment} canEdit={canEdit} />
          ))}
        </ul>
      ) : (
        // Only facilitators reach this branch: viewers see nothing when there are no attachments.
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex w-full items-center gap-3 rounded-lg border border-dashed p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Plus className="size-4" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium">Přidat přílohu</span>
            <span className="block text-xs text-muted-foreground">{GUIDANCE}</span>
          </span>
        </button>
      )}

      {canEdit && <AddAttachmentDialog sessionId={sessionId} open={adding} onOpenChange={setAdding} />}
    </section>
  )
}

function AttachmentRow({
  sessionId,
  attachment,
  canEdit,
}: {
  sessionId: string
  attachment: TsAttachmentSummary
  canEdit: boolean
}) {
  const Icon = attachment.content_type.startsWith("image/") ? ImageIcon : FileText
  return (
    <li className="group flex items-center gap-1 pr-1.5">
      <a
        href={attachmentHref(sessionId, attachment.id)}
        aria-label={`Stáhnout ${attachment.label}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{attachment.label}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {attachment.file_name} · {formatFileSize(attachment.file_size)}
          </span>
        </span>
        <Download className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </a>
      {canEdit && <DeleteAttachmentButton sessionId={sessionId} attachment={attachment} />}
    </li>
  )
}

function DeleteAttachmentButton({ sessionId, attachment }: { sessionId: string; attachment: TsAttachmentSummary }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  async function remove() {
    setPending(true)
    try {
      const res = await fetch(attachmentHref(sessionId, attachment.id), { method: "DELETE" })
      if (!res.ok) {
        toast.error(await readError(res, DELETE_ERROR_MESSAGE))
        return
      }
      toast.success("Příloha odebrána")
      setOpen(false)
      router.refresh()
    } catch {
      toast.error(DELETE_ERROR_MESSAGE)
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Odebrat ${attachment.label}`}
        className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-4" />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Odebrat přílohu?</AlertDialogTitle>
            <AlertDialogDescription>
              Soubor „{attachment.file_name}“ zmizí z přípravy pro všechny. Tuhle akci nevrátíš.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zpět</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(event) => {
                event.preventDefault()
                void remove()
              }}
            >
              {pending && <Spinner className="size-4" />}
              Odebrat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function AddAttachmentDialog({
  sessionId,
  open,
  onOpenChange,
}: {
  sessionId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const ids = useId()
  const fileInput = useRef<HTMLInputElement>(null)
  const [label, setLabel] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function changeOpen(next: boolean) {
    if (pending) return
    if (!next) {
      setLabel("")
      setFile(null)
      setError(null)
    }
    onOpenChange(next)
  }

  function pick(next: File | null) {
    setFile(next)
    setError(null)
  }

  async function upload(event: React.FormEvent) {
    event.preventDefault()
    if (!file) {
      setError("Vyber soubor")
      return
    }
    const candidate = { label, fileName: file.name, contentType: file.type, fileSize: file.size }
    const invalid = validateAttachmentCandidate(candidate)
    if (invalid) {
      setError(invalid)
      return
    }
    setError(null)
    setPending(true)
    try {
      const base = `/api/training-sessions/${sessionId}/attachments`
      const urlRes = await fetch(`${base}/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(candidate),
      })
      if (!urlRes.ok) throw new Error(await readError(urlRes, UPLOAD_ERROR_MESSAGE))
      const { data } = (await urlRes.json()) as { data: { url: string; key: string } }

      const putRes = await fetch(data.url, { method: "PUT", headers: { "Content-Type": file.type }, body: file })
      if (!putRes.ok) throw new Error(UPLOAD_ERROR_MESSAGE)

      const registerRes = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: data.key, label, fileName: file.name }),
      })
      if (!registerRes.ok) throw new Error(await readError(registerRes, UPLOAD_ERROR_MESSAGE))

      toast.success("Příloha přidána")
      setPending(false)
      changeOpen(false)
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : UPLOAD_ERROR_MESSAGE)
      setPending(false)
    }
  }

  const fileId = `${ids}-file`
  const labelId = `${ids}-label`

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={(event) => void upload(event)} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Přidat přílohu</DialogTitle>
            <DialogDescription>{GUIDANCE}</DialogDescription>
          </DialogHeader>

          <input
            ref={fileInput}
            id={fileId}
            type="file"
            aria-label="Soubor"
            accept={TS_ATTACHMENT_ACCEPT}
            className="sr-only"
            onChange={(event) => pick(event.target.files?.[0] ?? null)}
          />
          <label
            htmlFor={fileId}
            onDragOver={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragging(false)
              pick(event.dataTransfer.files[0] ?? null)
            }}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-lg border border-dashed p-4 transition-colors hover:border-primary/40 hover:bg-primary/5",
              dragging && "border-primary bg-primary/5",
            )}
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              {file ? <FileText className="size-5" aria-hidden /> : <Upload className="size-5" aria-hidden />}
            </span>
            <span className="min-w-0 flex-1">
              {file ? (
                <>
                  <span className="block truncate text-sm font-medium">{file.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {formatFileSize(file.size)} · klikni pro výměnu
                  </span>
                </>
              ) : (
                <>
                  <span className="block text-sm font-medium">Vyber soubor nebo ho sem přetáhni</span>
                  <span className="block text-xs text-muted-foreground">{FORMATS_HINT}</span>
                </>
              )}
            </span>
          </label>

          <div className="space-y-1.5">
            <Label htmlFor={labelId}>Co příloha obsahuje</Label>
            <Input
              id={labelId}
              value={label}
              maxLength={TS_ATTACHMENT_LIMITS.labelMax}
              placeholder={LABEL_PLACEHOLDER}
              onChange={(event) => setLabel(event.target.value)}
            />
          </div>

          {error && (
            <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => changeOpen(false)}>
              Zrušit
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner className="size-4" />}
              Přidat
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
