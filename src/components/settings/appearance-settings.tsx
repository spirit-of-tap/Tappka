'use client';

import { useSyncExternalStore } from 'react';
import { Check, Laptop, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

import { Button } from '@/components/ui/button';
import { usePalette, useShade } from '@/components/theme/use-palette';
import { PALETTES, SHADES } from '@/lib/theme/palettes';
import { cn } from '@/lib/utils';

const MODES = [
  { value: 'light', label: 'Světlý', icon: Sun },
  { value: 'dark', label: 'Tmavý', icon: Moon },
  { value: 'system', label: 'Podle systému', icon: Laptop },
] as const;

const emptySubscribe = () => () => {};

/** Mini dashboard drawn with the palette's own tokens via a nested data-palette. */
function PalettePreview() {
  return (
    <div aria-hidden className="flex h-24 overflow-hidden rounded-lg border bg-background">
      <div className="flex w-1/4 flex-col gap-1.5 border-r bg-sidebar p-2">
        <span className="h-2 w-full rounded-sm bg-primary" />
        <span className="h-1.5 w-3/4 rounded-sm bg-sidebar-accent" />
        <span className="h-1.5 w-2/3 rounded-sm bg-sidebar-accent" />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-2">
        <span className="h-7 rounded-md bg-hero" />
        <div className="flex flex-1 gap-1.5">
          <span className="flex-1 rounded-md bg-spotlight" />
          <span className="flex-1 rounded-md border bg-card" />
        </div>
      </div>
    </div>
  );
}

export function AppearanceSettings() {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const { theme, setTheme } = useTheme();
  const [palette, setPalette] = usePalette();
  const [shade, setShade] = useShade();

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="font-heading text-lg font-bold">Režim</h2>
        <div role="radiogroup" aria-label="Režim" className="flex flex-wrap gap-2">
          {MODES.map((mode) => {
            const active = mounted && theme === mode.value;
            return (
              <Button
                key={mode.value}
                type="button"
                role="radio"
                aria-checked={active}
                variant={active ? 'default' : 'outline'}
                onClick={() => setTheme(mode.value)}
              >
                <mode.icon className="size-4" aria-hidden />
                {mode.label}
              </Button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-heading text-lg font-bold">Tmavý režim</h2>
          <p className="text-sm text-muted-foreground">Jak tmavé má být tmavé zobrazení.</p>
        </div>
        <div role="radiogroup" aria-label="Tmavý režim" className="grid max-w-xl gap-3 sm:grid-cols-2">
          {SHADES.map((s) => {
            const active = mounted && shade === s.id;
            return (
              <Button
                key={s.id}
                type="button"
                variant="outline"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  setShade(s.id);
                  if (theme === 'light') setTheme('dark');
                }}
                className={cn(
                  'h-auto flex-col items-stretch gap-3 rounded-xl p-3 text-left font-normal whitespace-normal',
                  active && 'border-primary ring-2 ring-primary/30',
                )}
              >
                <div className="dark" data-shade={s.id}>
                  <div data-palette={palette} className="text-foreground">
                    <PalettePreview />
                  </div>
                </div>
                <span className="flex items-center gap-2">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{s.label}</span>
                    <span className="block text-xs text-muted-foreground">{s.description}</span>
                  </span>
                  {active && <Check className="size-4 text-primary" aria-hidden />}
                </span>
              </Button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-bold">Barevný motiv</h2>
        <div role="radiogroup" aria-label="Barevný motiv" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PALETTES.map((p) => {
            const active = mounted && palette === p.id;
            return (
              <Button
                key={p.id}
                type="button"
                variant="outline"
                role="radio"
                aria-checked={active}
                onClick={() => setPalette(p.id)}
                className={cn(
                  'h-auto flex-col items-stretch gap-3 rounded-xl p-3 text-left font-normal whitespace-normal',
                  active && 'border-primary ring-2 ring-primary/30',
                )}
              >
                <div data-palette={p.id} className="text-foreground">
                  <PalettePreview />
                </div>
                <span className="flex items-center gap-2">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{p.label}</span>
                    <span className="block text-xs text-muted-foreground">{p.description}</span>
                  </span>
                  {active && <Check className="size-4 text-primary" aria-hidden />}
                </span>
              </Button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
