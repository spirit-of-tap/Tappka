"use client";

import { useState, useRef, useEffect } from "react";
import { X, Check, ChevronsUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface User {
  id: string;
  name: string;
}

interface UserTagPickerProps {
  users: User[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
}

/**
 * A tag/badge picker component for selecting users
 * - Search through users
 * - Selected users appear as removable badges
 * - Click badge X to remove
 */
export function UserTagPicker({
  users,
  selectedIds,
  onChange,
  placeholder = "Vyhledat uzivatele...",
  emptyMessage = "Zadny uzivatel nenalezen.",
  className,
}: UserTagPickerProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const selectedUsers = users.filter((user) => selectedIds.includes(user.id));
  const availableUsers = users.filter((user) => !selectedIds.includes(user.id));

  const handleSelect = (userId: string) => {
    onChange([...selectedIds, userId]);
    setInputValue("");
  };

  const handleRemove = (userId: string) => {
    onChange(selectedIds.filter((id) => id !== userId));
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Selected badges */}
      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedUsers.map((user) => (
            <Badge
              key={user.id}
              variant="secondary"
              className="gap-1 pr-1 text-sm"
            >
              {user.name}
              <button
                type="button"
                onClick={() => handleRemove(user.id)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10 transition-colors"
                aria-label={`Odebrat ${user.name}`}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Search popover */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm",
              "ring-offset-background placeholder:text-muted-foreground",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
              "disabled:cursor-not-allowed disabled:opacity-50",
              !selectedIds.length && "text-muted-foreground"
            )}
          >
            <span>
              {selectedIds.length > 0
                ? `${selectedIds.length} vybrano`
                : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput
              placeholder={placeholder}
              value={inputValue}
              onValueChange={setInputValue}
            />
            <CommandList>
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              <CommandGroup>
                {availableUsers.map((user) => (
                  <CommandItem
                    key={user.id}
                    value={user.name}
                    onSelect={() => handleSelect(user.id)}
                    className="cursor-pointer"
                  >
                    {user.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
