'use client';

import { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  ArrowDownRight,
  Ellipsis,
  FilterX,
  Pencil,
  Search,
  Trash2,
  Scale,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Spinner } from '@/components/ui/spinner';
import { PointsDialog } from './points-dialog';
import { BookEditDialog } from './book-edit-dialog';
import { DeleteBookDialog } from './delete-book-dialog';
import { BookRowHeader } from './book-row-header';
import { HighlightBadge } from './book-status-badges';
import { formatPoints } from '@/lib/books/points';
import type { BookWithProfiles, HighlightCategory } from '@/lib/books/types';

export type ListKind = 'shortlist' | 'longlist';

interface CoachListTableProps {
  kind: ListKind;
  books: BookWithProfiles[];
  categories: HighlightCategory[];
  /** Primary action — move to the other list (promote from longlist, demote from shortlist). */
  onMove: (book: BookWithProfiles, targetStatus: ListKind) => Promise<boolean>;
  onPointsSaved: (book: BookWithProfiles) => void;
  onEdited: (book: BookWithProfiles) => void;
  onDeleted: (bookId: string) => void;
}

const POINT_OPTIONS = ['1', '2', '3'] as const;
const ESSAY_OPTIONS = [
  { value: 'any', label: 'Všechny' },
  { value: 'has', label: 'Má eseje' },
  { value: 'none', label: 'Bez esejí' },
] as const;

export function CoachListTable({
  kind,
  books,
  categories,
  onMove,
  onPointsSaved,
  onEdited,
  onDeleted,
}: CoachListTableProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pointsBook, setPointsBook] = useState<BookWithProfiles | null>(null);
  const [editBook, setEditBook] = useState<BookWithProfiles | null>(null);
  const [deleteBook, setDeleteBook] = useState<BookWithProfiles | null>(null);

  const [query, setQuery] = useState('');
  const [pointFilter, setPointFilter] = useState<string>('any');
  const [categoryFilter, setCategoryFilter] = useState<string>('any');
  const [essayFilter, setEssayFilter] = useState<string>('any');

  const targetStatus: ListKind = kind === 'shortlist' ? 'longlist' : 'shortlist';
  const moveLabel = kind === 'longlist' ? 'Do shortlistu' : 'Do longlistu';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return books.filter((book) => {
      if (q) {
        const haystack = `${book.title_cs} ${book.author}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (pointFilter !== 'any' && Number(book.book_points) !== Number(pointFilter)) return false;
      if (categoryFilter !== 'any' && book.highlight_category?.id !== categoryFilter) return false;
      if (essayFilter === 'has' && book.essay_count === 0) return false;
      if (essayFilter === 'none' && book.essay_count > 0) return false;
      return true;
    });
  }, [books, query, pointFilter, categoryFilter, essayFilter]);

  const hasActiveFilters = query.trim() !== '' || pointFilter !== 'any' || categoryFilter !== 'any' || essayFilter !== 'any';
  const resetFilters = () => {
    setQuery('');
    setPointFilter('any');
    setCategoryFilter('any');
    setEssayFilter('any');
  };

  const handleMove = async (book: BookWithProfiles) => {
    setBusyId(book.id);
    try {
      await onMove(book, targetStatus);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Hledat podle názvu nebo autora…"
            className="pl-8"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={pointFilter} onValueChange={setPointFilter}>
            <SelectTrigger size="sm" className="w-32">
              <SelectValue placeholder="Body" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Body: všechny</SelectItem>
              {POINT_OPTIONS.map((p) => (
                <SelectItem key={p} value={p}>Body: {p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger size="sm" className="w-40">
              <SelectValue placeholder="Výběr" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Výběr: všechny</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={essayFilter} onValueChange={setEssayFilter}>
            <SelectTrigger size="sm" className="w-32">
              <SelectValue placeholder="Eseje" />
            </SelectTrigger>
            <SelectContent>
              {ESSAY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button size="sm" variant="ghost" onClick={resetFilters} className="gap-1">
              <FilterX className="size-3" />
              Zrušit filtry
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kniha</TableHead>
              <TableHead className="hidden md:table-cell">Autor</TableHead>
              <TableHead className="w-16">Body</TableHead>
              <TableHead className="w-16 text-right">Eseje</TableHead>
              <TableHead className="w-14"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
                  {books.length === 0
                    ? (kind === 'shortlist' ? 'Žádné knihy ve shortlistu' : 'Žádné knihy v longlistu')
                    : 'Žádné knihy neodpovídají filtrům'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((book) => (
                <TableRow key={book.id}>
                  <TableCell>
                    <div className="flex items-center gap-3 min-w-0">
                      <BookRowHeader
                        book={book}
                        coverSize="sm"
                        showAuthor={false}
                        titleClassName="max-w-[40vw] block truncate md:max-w-[320px]"
                      >
                        {book.highlight_category && (
                          <HighlightBadge category={book.highlight_category} variant="full" className="mt-1" />
                        )}
                      </BookRowHeader>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className="block max-w-[160px] truncate text-sm text-muted-foreground">{book.author}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{formatPoints(book.book_points)} b.</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-sm text-muted-foreground">{book.essay_count}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant={kind === 'longlist' ? 'default' : 'outline'}
                        onClick={() => void handleMove(book)}
                        disabled={busyId === book.id}
                        className="gap-1"
                        title={kind === 'longlist' ? 'Posunout do shortlistu' : 'Posunout zpět do longlistu'}
                      >
                        {busyId === book.id ? <Spinner className="size-3" /> : kind === 'longlist' ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                        {moveLabel}
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="size-8">
                            <Ellipsis className="size-4" />
                            <span className="sr-only">Akce</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setPointsBook(book)} className="gap-2">
                            <Scale className="size-4" />
                            Změnit body
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setEditBook(book)} className="gap-2">
                            <Pencil className="size-4" />
                            Upravit knihu
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeleteBook(book)}
                            className="gap-2 text-destructive focus:text-destructive"
                          >
                            <Trash2 className="size-4" />
                            Smazat
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {pointsBook && (
        <PointsDialog
          book={pointsBook}
          open={!!pointsBook}
          onOpenChange={(open) => { if (!open) setPointsBook(null); }}
          onSaved={onPointsSaved}
        />
      )}
      {editBook && (
        <BookEditDialog
          book={editBook}
          open={!!editBook}
          onOpenChange={(open) => { if (!open) setEditBook(null); }}
          onSaved={onEdited}
        />
      )}
      {deleteBook && (
        <DeleteBookDialog
          book={deleteBook}
          open={!!deleteBook}
          onOpenChange={(open) => { if (!open) setDeleteBook(null); }}
          onDeleted={onDeleted}
        />
      )}
    </>
  );
}
