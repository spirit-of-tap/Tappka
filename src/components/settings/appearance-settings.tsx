'use client';

import { useSyncExternalStore } from 'react';
import { Check, Laptop, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { usePalette, useShade } from '@/components/theme/use-palette';
import { PALETTES, SHADES } from '@/lib/theme/palettes';
import { cn } from '@/lib/utils';

const MODES = [
  { value: 'light', label: 'Světlý', icon: Sun },
  { value: 'dark', label: 'Tmavý', icon: Moon },
  { value: 'system', label: 'Podle systému', icon: Laptop },
] as const;

const CARD_ITEM =
  'h-auto flex-col items-stretch gap-3 rounded-xl border-border p-3 text-left font-normal whitespace-normal data-[state=on]:border-primary data-[state=on]:bg-transparent data-[state=on]:ring-2 data-[state=on]:ring-primary/30';

const emptySubscribe = () => () => {};

/** Mini dashboard drawn with the palette's own tokens via a nested data-palette. */
function PalettePreview() {
  return (
    <span aria-hidden className="flex h-24 overflow-hidden rounded-lg border bg-background">
      <span className="flex w-1/4 flex-col gap-1.5 border-r bg-sidebar p-2">
        <span className="h-2 w-full rounded-sm bg-primary" />
        <span className="h-1.5 w-3/4 rounded-sm bg-sidebar-accent" />
        <span className="h-1.5 w-2/3 rounded-sm bg-sidebar-accent" />
      </span>
      <span className="flex flex-1 flex-col gap-1.5 p-2">
        <span className="h-7 rounded-md bg-hero" />
        <span className="flex flex-1 gap-1.5">
          <span className="flex-1 rounded-md bg-spotlight" />
          <span className="flex-1 rounded-md border bg-card" />
        </span>
      </span>
    </span>
  );
}

export function AppearanceSettings() {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [palette, setPalette] = usePalette();
  const [shade, setShade] = useShade();

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="font-heading text-lg font-bold">Režim</h2>
        <ToggleGroup
          type="single"
          variant="outline"
          spacing={2}
          aria-label="Režim"
          value={mounted ? (theme ?? '') : ''}
          onValueChange={(value) => value && setTheme(value)}
          className="flex-wrap"
        >
          {MODES.map((mode) => (
            <ToggleGroupItem
              key={mode.value}
              value={mode.value}
              className="h-9 px-4 data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              <mode.icon className="size-4" aria-hidden />
              {mode.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-heading text-lg font-bold">Tmavý režim</h2>
          <p className="text-sm text-muted-foreground">Jak tmavé má být tmavé zobrazení.</p>
        </div>
        <ToggleGroup
          type="single"
          variant="outline"
          spacing={3}
          aria-label="Tmavý režim"
          value={mounted ? shade : ''}
          onValueChange={(value) => {
            const next = SHADES.find((s) => s.id === value);
            if (!next) return;
            setShade(next.id);
            if (resolvedTheme === 'light') setTheme('dark');
          }}
          className="grid w-full max-w-xl sm:grid-cols-2"
        >
          {SHADES.map((s) => (
            <ToggleGroupItem key={s.id} value={s.id} className={cn(CARD_ITEM, 'w-full')}>
              <span className="dark block" data-shade={s.id}>
                <span data-palette={palette} className="block text-foreground">
                  <PalettePreview />
                </span>
              </span>
              <span className="flex items-center gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{s.label}</span>
                  <span className="block text-xs text-muted-foreground">{s.description}</span>
                </span>
                {mounted && shade === s.id && <Check className="size-4 text-primary" aria-hidden />}
              </span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-bold">Barevný motiv</h2>
        <ToggleGroup
          type="single"
          variant="outline"
          spacing={3}
          aria-label="Barevný motiv"
          value={mounted ? palette : ''}
          onValueChange={(value) => {
            const next = PALETTES.find((p) => p.id === value);
            if (next) setPalette(next.id);
          }}
          className="grid w-full sm:grid-cols-2 lg:grid-cols-3"
        >
          {PALETTES.map((p) => (
            <ToggleGroupItem key={p.id} value={p.id} className={cn(CARD_ITEM, 'w-full')}>
              <span data-palette={p.id} className="block text-foreground">
                <PalettePreview />
              </span>
              <span className="flex items-center gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{p.label}</span>
                  <span className="block text-xs text-muted-foreground">{p.description}</span>
                </span>
                {mounted && palette === p.id && <Check className="size-4 text-primary" aria-hidden />}
              </span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </section>
    </div>
  );
}
