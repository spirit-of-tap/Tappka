"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { ProfileAvatar } from "@/components/profile-avatar";
import { normalizeBirthGivingSearchQuery } from "@/lib/birth-giving/search";
import type { BirthGivingProfileSummary } from "@/lib/birth-giving/types";

interface BirthGivingProfilePickerProps {
  profiles: BirthGivingProfileSummary[];
  selected: string[];
  onChange: (selected: string[]) => void;
  label?: string;
  placeholder?: string;
  max?: number;
  excludeIds?: string[];
  disabled?: boolean;
}

export function BirthGivingProfilePicker({
  profiles,
  selected,
  onChange,
  label = "Vybrat profily",
  placeholder = "Vyberte osoby",
  max,
  excludeIds = [],
  disabled = false,
}: BirthGivingProfilePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedProfiles = profiles.filter((profile) => selected.includes(profile.id));
  const visible = profiles.filter(
    (profile) => !excludeIds.includes(profile.id),
  );
  const needle = normalizeBirthGivingSearchQuery(query);

  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((selectedId) => selectedId !== id));
      return;
    }
    if (max !== undefined && selected.length >= max) return;
    onChange([...selected, id]);
  }

  function remove(id: string) {
    onChange(selected.filter((selectedId) => selectedId !== id));
  }

  function commandFilter(value: string, search: string): number {
    const normalizedSearch = normalizeBirthGivingSearchQuery(search);
    if (!normalizedSearch) return 1;
    const normalizedValue = normalizeBirthGivingSearchQuery(value);
    if (normalizedValue.startsWith(normalizedSearch)) return 1;
    if (normalizedValue.includes(normalizedSearch)) return 0.5;
    return 0;
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {selectedProfiles.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedProfiles.map((profile) => (
            <span
              key={profile.id}
              className="flex items-center gap-1 rounded-full border bg-muted/60 py-0.5 pl-0.5 pr-0.5 text-xs"
            >
              <ProfileAvatar picture={profile.picture} name={profile.name} size={18} />
              <span className="max-w-40 truncate">{profile.name}</span>
              {!disabled && (
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  className="rounded-full text-muted-foreground hover:text-foreground"
                  aria-label={`Odebrat ${profile.name}`}
                  onClick={() => remove(profile.id)}
                >
                  <X className="size-3" />
                </Button>
              )}
            </span>
          ))}
        </div>
      )}
      <Popover open={open} onOpenChange={(next) => { setOpen(next); setQuery(""); }}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            aria-label={label}
            className="h-auto min-h-9 w-full justify-start gap-1.5 py-1.5"
          >
            {selectedProfiles.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              <span className="text-muted-foreground">Upravit výběr</span>
            )}
            <ChevronsUpDown className="ml-auto size-4 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-0">
          <Command className="border-0 shadow-none" filter={commandFilter}>
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="Hledat profil"
              aria-label="Hledat profil"
            />
            <CommandList>
              <CommandEmpty>Žádný odpovídající profil</CommandEmpty>
              <CommandGroup>
                {visible
                .filter((profile) =>
                  normalizeBirthGivingSearchQuery(profile.name ?? "").includes(needle),
                )
                .map((profile) => {
                  const isSelected = selected.includes(profile.id);
                  const atLimit = max !== undefined && selected.length >= max;
                  const disabledItem = atLimit && !isSelected;
                  return (
                    <CommandItem
                      key={profile.id}
                      value={`${profile.name} ${profile.id}`}
                      onSelect={() => toggle(profile.id)}
                      disabled={disabledItem}
                      data-disabled={disabledItem}
                    >
                      <ProfileAvatar picture={profile.picture} name={profile.name} size={24} />
                      <span className="flex-1 truncate">{profile.name}</span>
                      {isSelected && <Check className="size-4 text-primary" />}
                    </CommandItem>
                  );
                })}
            </CommandGroup>
          </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
