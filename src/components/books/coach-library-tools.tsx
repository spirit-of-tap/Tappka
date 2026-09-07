'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  BookCopy,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FilterX,
  Plus,
  QrCode,
  Search,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/responsive-alert-dialog';
import { Spinner } from '@/components/ui/spinner';
import { ProfileAvatar } from '@/components/profile-avatar';
import { StorageImage } from '@/components/storage/storage-image';
import { LibraryImportScanner } from '@/components/library/library-import-scanner';
import { cn } from '@/lib/utils';
import type { PhysicalLibraryBookItem, PhysicalLibraryCopy } from '@/lib/library/types';

interface CoachLibraryToolsProps {
  initialInventory: PhysicalLibraryBookItem[];
}

function formatCopyAvailability(available: number, total: number) {
  if (total === 1) {
    return available === 1 ? '1 výtisk k dispozici' : 'Vypůjčeno';
  }
  if (available === 0) {
    return `0/${total} k dispozici (vše půjčeno)`;
  }
  return `${available}/${total} k dispozici`;
}

export function CoachLibraryTools({ initialInventory }: CoachLibraryToolsProps) {
  const [inventory, setInventory] = useState(initialInventory);
  const [query, setQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'borrowed' | 'available'>('all');
  const [showScanner, setShowScanner] = useState(false);
  const [expandedBookIds, setExpandedBookIds] = useState<Set<string>>(
    () => new Set(initialInventory.map((i) => i.book.id)),
  );

  const [addingCopyBookId, setAddingCopyBookId] = useState<string | null>(null);
  const [deletingCopy, setDeletingCopy] = useState<{
    copy: PhysicalLibraryCopy;
    bookTitle: string;
    bookId: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);


  // Filtered inventory
  const filteredInventory = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inventory.filter((item) => {
      if (filterMode === 'borrowed' && item.totalCopies === item.availableCopies) return false;
      if (filterMode === 'available' && item.availableCopies === 0) return false;

      if (q) {
        const hasLabelMatch = item.copies.some(
          (c) => c.label_code != null && String(c.label_code).includes(q),
        );
        const textMatch = `${item.book.title_cs} ${item.book.author} ${item.book.isbn_13 ?? ''}`
          .toLowerCase()
          .includes(q);
        if (!hasLabelMatch && !textMatch) return false;
      }

      return true;
    });
  }, [inventory, query, filterMode]);

  const toggleExpand = (bookId: string) => {
    setExpandedBookIds((prev) => {
      const next = new Set(prev);
      if (next.has(bookId)) next.delete(bookId);
      else next.add(bookId);
      return next;
    });
  };

  const handleAddCopy = async (bookId: string) => {
    setAddingCopyBookId(bookId);
    try {
      const res = await fetch('/api/library/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_id: bookId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Nepodařilo se přidat výtisk');
      }
      const json = await res.json();
      const newCopy: PhysicalLibraryCopy = {
        id: json.data.id,
        label_code: json.data.label_code ?? null,
        created_at: json.data.created_at ?? new Date().toISOString(),
        loan: null,
      };

      setInventory((prev) =>
        prev.map((item) => {
          if (item.book.id !== bookId) return item;
          return {
            ...item,
            totalCopies: item.totalCopies + 1,
            availableCopies: item.availableCopies + 1,
            copies: [newCopy, ...item.copies],
          };
        }),
      );
      toast.success('Nový výtisk byl úspěšně přidán.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Chyba při přidávání výtisku.');
    } finally {
      setAddingCopyBookId(null);
    }
  };

  const handleDeleteCopy = async () => {
    if (!deletingCopy) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/library/books?copy_id=${deletingCopy.copy.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Nepodařilo se smazat výtisk');
      }

      setInventory((prev) =>
        prev
          .map((item) => {
            if (item.book.id !== deletingCopy.bookId) return item;
            const updatedCopies = item.copies.filter((c) => c.id !== deletingCopy.copy.id);
            return {
              ...item,
              totalCopies: item.totalCopies - 1,
              availableCopies: deletingCopy.copy.loan ? item.availableCopies : item.availableCopies - 1,
              copies: updatedCopies,
            };
          })
          .filter((item) => item.totalCopies > 0),
      );

      toast.success('Výtisk byl z evidence smazán.');
      setDeletingCopy(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Chyba při mazání výtisku.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* Action Header Card */}
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <div className="rounded-lg bg-muted p-2 text-foreground shrink-0">
              <BookCopy className="size-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Správa fyzického fondu</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Přehled výtisků, kontrola vypůjčených knih a správa čárových kódů pro TAP knihovnu.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant={showScanner ? 'default' : 'outline'}
              onClick={() => setShowScanner((prev) => !prev)}
              className="gap-1.5"
            >
              <Plus className="size-4" />
              <span>{showScanner ? 'Zavřít skener' : 'Naskenovat / přidat výtisk'}</span>
            </Button>
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link href="/knihovna/stitky">
                <QrCode className="size-4" />
                <span>Přiřazení štítků</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* Collapsible Scanner / Add copy tool */}
        {showScanner && (
          <div className="mt-4 pt-4 border-t space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Skenování a evidence nového výtisku
            </h4>
            <LibraryImportScanner />
          </div>
        )}
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Hledat podle názvu knihy, autora nebo kódu štítku…"
            className="pl-8"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition-colors',
              filterMode === 'all'
                ? 'bg-foreground text-background font-medium'
                : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
          >
            <span>Všechny</span>
            <span className="opacity-70 text-[10px]">({inventory.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('available')}
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition-colors',
              filterMode === 'available'
                ? 'bg-foreground text-background font-medium'
                : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
          >
            <span>Pouze volné</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('borrowed')}
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition-colors',
              filterMode === 'borrowed'
                ? 'bg-foreground text-background font-medium'
                : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
          >
            <span>Vypůjčené</span>
          </button>

          {(query.trim() !== '' || filterMode !== 'all') && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setQuery('');
                setFilterMode('all');
              }}
              className="gap-1 h-7 text-xs ml-1"
            >
              <FilterX className="size-3" />
              Zrušit
            </Button>
          )}
        </div>
      </div>

      {/* Books and Copies List */}
      {filteredInventory.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookOpen />
            </EmptyMedia>
            <EmptyTitle>Žádné výtisky nenalezeny</EmptyTitle>
            <EmptyDescription>
              {inventory.length === 0
                ? 'V evidenci fyzické knihovny zatím nejsou žádné výtisky. Naskenuj nebo přidej první knihu výše.'
                : 'Zadaným filtrům neodpovídá žádný výtisk.'}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-4">
          {filteredInventory.map((item) => {
            const isExpanded = expandedBookIds.has(item.book.id);
            const isAdding = addingCopyBookId === item.book.id;

            return (
              <div
                key={item.book.id}
                className="rounded-xl border bg-card shadow-xs transition-colors overflow-hidden"
              >
                {/* Book Header Card */}
                <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-muted/20">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => toggleExpand(item.book.id)}
                      className="mt-1 text-muted-foreground hover:text-foreground transition-transform"
                      title={isExpanded ? 'Sbalit výtisky' : 'Rozbalit výtisky'}
                    >
                      {isExpanded ? (
                        <ChevronDown className="size-4" />
                      ) : (
                        <ChevronRight className="size-4" />
                      )}
                    </button>

                    <div className="size-10 shrink-0 bg-muted rounded overflow-hidden flex items-center justify-center">
                      {item.book.google_books_cover_url ? (
                        <StorageImage
                          storageKey={item.book.google_books_cover_url}
                          alt={item.book.title_cs}
                          className="w-full h-full object-cover"
                          width={40}
                          height={56}
                        />
                      ) : (
                        <BookOpen className="size-4 text-muted-foreground" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/cteni/knihy/${item.book.id}`}
                          className="font-semibold text-sm hover:underline"
                        >
                          {item.book.title_cs}
                        </Link>
                        {item.book.isbn_13 && (
                          <span className="text-[11px] text-muted-foreground">
                            ISBN {item.book.isbn_13}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{item.book.author}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-xs font-medium',
                        item.availableCopies > 0
                          ? 'border-success/30 bg-success/10 text-success-strong dark:bg-success/15'
                          : 'border-chart-2/40 bg-chart-2/10 text-chart-2-strong dark:bg-chart-2/15',
                      )}
                    >
                      {formatCopyAvailability(item.availableCopies, item.totalCopies)}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      disabled={isAdding}
                      onClick={() => void handleAddCopy(item.book.id)}
                      title="Přidat další fyzický výtisk této knihy"
                    >
                      {isAdding ? <Spinner className="size-3" /> : <Plus className="size-3" />}
                      <span>+ Výtisk</span>
                    </Button>
                  </div>
                </div>

                {/* Copies Sub-List */}
                {isExpanded && (
                  <div className="border-t divide-y">
                    {item.copies.map((copy, index) => {
                      const isBorrowed = copy.loan != null;
                      const isOverdue = copy.loan?.is_overdue ?? false;

                      return (
                        <div
                          key={copy.id}
                          className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs hover:bg-muted/10 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-muted-foreground font-mono w-6 text-center shrink-0">
                              #{index + 1}
                            </span>

                            {/* Label Code Info */}
                            {copy.label_code != null ? (
                              <Badge variant="outline" className="gap-1 font-mono text-xs bg-muted/40">
                                <QrCode className="size-3" />
                                <span>Štítek #{copy.label_code}</span>
                              </Badge>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <Badge variant="outline" className="text-muted-foreground">
                                  Bez štítku
                                </Badge>
                                <Link
                                  href={`/knihovna/stitky?book=${item.book.id}`}
                                  className="text-primary hover:underline text-[11px]"
                                >
                                  Přiřadit štítek
                                </Link>
                              </div>
                            )}

                            {/* Loan Status */}
                            {isBorrowed ? (
                              <div className="flex items-center gap-1.5 text-xs">
                                <Badge
                                  variant={isOverdue ? 'destructive' : 'outline'}
                                  className={cn(
                                    'gap-1',
                                    !isOverdue &&
                                      'border-chart-2/40 bg-chart-2/10 text-chart-2-strong dark:bg-chart-2/15',
                                  )}
                                >
                                  {isOverdue && <AlertCircle className="size-3" />}
                                  <span>{isOverdue ? 'Po termínu' : 'Vypůjčeno'}</span>
                                </Badge>
                                {copy.loan?.borrower && (
                                  <div className="flex items-center gap-1.5 text-muted-foreground">
                                    <ProfileAvatar
                                      name={copy.loan.borrower.name ?? 'Čtenář:ka'}
                                      picture={copy.loan.borrower.picture}
                                      size={16}
                                    />
                                    <span className="font-medium text-foreground">
                                      {copy.loan.borrower.name}
                                    </span>
                                  </div>
                                )}
                                {copy.loan?.due_at && (
                                  <span className="text-muted-foreground">
                                    (do {new Date(copy.loan.due_at).toLocaleDateString('cs-CZ')})
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-success-strong">
                                <CheckCircle2 className="size-3.5" />
                                <span>K dispozici na poličce</span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-end gap-2 shrink-0">
                            <span className="text-[11px] text-muted-foreground">
                              Přidáno {new Date(copy.created_at).toLocaleDateString('cs-CZ')}
                            </span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-7 text-muted-foreground hover:text-destructive"
                              disabled={isBorrowed}
                              title={
                                isBorrowed
                                  ? 'Nelze smazat vypůjčený výtisk'
                                  : 'Smazat tento výtisk z evidence'
                              }
                              onClick={() =>
                                setDeletingCopy({
                                  copy,
                                  bookTitle: item.book.title_cs,
                                  bookId: item.book.id,
                                })
                              }
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Copy Confirmation Dialog */}
      {deletingCopy && (
        <AlertDialog
          open={!!deletingCopy}
          onOpenChange={(open) => {
            if (!open) setDeletingCopy(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Smazat výtisk z knihovny?</AlertDialogTitle>
              <AlertDialogDescription>
                Opravdu chceš odebrat tento výtisk knihy <strong>{deletingCopy.bookTitle}</strong>
                {deletingCopy.copy.label_code != null && (
                  <> (Štítek #{deletingCopy.copy.label_code})</>
                )}{' '}
                z evidence fyzické knihovny? Tato akce je nevratná.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Zrušit</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  void handleDeleteCopy();
                }}
                disabled={isDeleting}
                className="bg-destructive hover:bg-destructive/90"
              >
                {isDeleting ? <Spinner className="size-4 mr-2" /> : <Trash2 className="size-4 mr-2" />}
                Smazat výtisk
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
