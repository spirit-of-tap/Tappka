"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRightLeft, ExternalLink, MoreVertical, Pencil, Trash2 } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { BookEditDialog } from "@/components/books/book-edit-dialog";
import { DeleteBookDialog } from "@/components/books/delete-book-dialog";
import type { BookWithProfiles } from "@/lib/books/types";

interface BookAdminActionsProps {
  book: BookWithProfiles;
  goodreadsUrl: string;
  isCoachOrAdmin: boolean;
  createdByName?: string | null;
}

export function BookAdminActions({
  book,
  goodreadsUrl,
  isCoachOrAdmin,
  createdByName,
}: BookAdminActionsProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'delete' | 'duplicate'>('delete');

  const handleDeleted = () => {
    router.push("/cteni/hledat");
    router.refresh();
  };

  const handleSaved = () => {
    router.refresh();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8">
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isCoachOrAdmin && (createdByName ?? book.created_by?.name) && (
            <>
              <DropdownMenuLabel className="font-normal text-muted-foreground">
                Přidal:a {createdByName ?? book.created_by?.name}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem asChild>
            <a href={goodreadsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
              <ExternalLink className="size-4" />
              Goodreads
            </a>
          </DropdownMenuItem>
          {isCoachOrAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => setEditOpen(true)}
                className="gap-2"
              >
                <Pencil className="size-4" />
                Upravit knihu
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  setDeleteMode('duplicate');
                  setDeleteOpen(true);
                }}
                className="gap-2"
              >
                <ArrowRightLeft className="size-4" />
                Označit jako duplikát…
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => {
                  setDeleteMode('delete');
                  setDeleteOpen(true);
                }}
                className="gap-2"
              >
                <Trash2 className="size-4" />
                Smazat knihu
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {editOpen && (
        <BookEditDialog
          book={book}
          open={editOpen}
          onOpenChange={setEditOpen}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}

      {deleteOpen && (
        <DeleteBookDialog
          book={book}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          mode={deleteMode}
          onDeleted={handleDeleted}
        />
      )}
    </>
  );
}

