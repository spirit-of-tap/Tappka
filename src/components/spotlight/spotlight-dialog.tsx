"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSpotlight } from "./spotlight-context";
import {
  getSpotlightItems,
  scoreSpotlightSearch,
  type SpotlightItem,
} from "@/lib/spotlight";

function SearchDogIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-20 select-none", className)}
      aria-hidden="true"
    >
      <style>{`
        @keyframes dogTailWag {
          0%, 100% { transform: rotate(-10deg); }
          50% { transform: rotate(15deg); }
        }
        @keyframes dogHeadSniff {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(1.5px) rotate(-2deg); }
        }
        @keyframes dogMagnifier {
          0%, 100% { transform: rotate(0deg) translate(0px, 0px); }
          50% { transform: rotate(-6deg) translate(-1px, 2px); }
        }
        @keyframes dogSniffDot {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.3); }
        }
        @keyframes dogCuriosity {
          0%, 100% { transform: translateY(0px); opacity: 0.6; }
          50% { transform: translateY(-3px); opacity: 1; }
        }
        .anim-tail {
          transform-origin: 84px 56px;
          animation: dogTailWag 0.5s ease-in-out infinite;
        }
        .anim-head {
          transform-origin: 34px 40px;
          animation: dogHeadSniff 1.6s ease-in-out infinite;
        }
        .anim-magnifier {
          transform-origin: 23px 69px;
          animation: dogMagnifier 2s ease-in-out infinite;
        }
        .anim-dot-1 {
          transform-origin: 8px 42px;
          animation: dogSniffDot 1.2s ease-in-out infinite;
        }
        .anim-dot-2 {
          transform-origin: 5px 46px;
          animation: dogSniffDot 1.2s ease-in-out 0.35s infinite;
        }
        .anim-dot-3 {
          transform-origin: 10px 48px;
          animation: dogSniffDot 1.2s ease-in-out 0.7s infinite;
        }
        .anim-sparkle {
          transform-origin: 36px 20px;
          animation: dogCuriosity 1.6s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .anim-tail,
          .anim-head,
          .anim-magnifier,
          .anim-dot-1,
          .anim-dot-2,
          .anim-dot-3,
          .anim-sparkle {
            animation: none !important;
          }
        }
      `}</style>

      {/* Ground shadow */}
      <ellipse cx="58" cy="88" rx="40" ry="4.5" className="fill-muted-foreground/15" />

      {/* Dog body */}
      <path
        d="M38 60 C38 48 50 44 64 44 C76 44 86 52 86 64 C86 74 78 82 66 82 C52 82 38 76 38 60 Z"
        className="fill-foreground/80 dark:fill-foreground/70"
      />

      {/* Dog chest patch */}
      <path
        d="M52 50 C58 50 64 54 64 62 C64 70 58 76 52 76 C46 76 46 64 52 50 Z"
        className="fill-background"
      />

      {/* Back leg */}
      <path
        d="M74 62 C74 58 84 62 86 70 C88 78 84 84 78 84 C74 84 72 78 74 62 Z"
        className="fill-foreground/90 dark:fill-foreground/80"
      />
      {/* Front legs */}
      <rect x="44" y="66" width="7" height="18" rx="3.5" className="fill-foreground/90 dark:fill-foreground/80" />
      <rect x="55" y="68" width="7" height="16" rx="3.5" className="fill-foreground/80 dark:fill-foreground/70" />

      {/* Tail (animated wagging in TAP Red) */}
      <g className="anim-tail">
        <path
          d="M84 56 C92 50 98 42 96 36 C94 32 89 34 88 38 C86 44 82 50 84 56 Z"
          className="fill-primary"
        />
      </g>

      {/* Animated Dog Head & Snout */}
      <g className="anim-head">
        {/* Head base */}
        <circle cx="34" cy="40" r="16" className="fill-foreground/85 dark:fill-foreground/75" />

        {/* Collar in TAP Red */}
        <path
          d="M36 50 C36 46 44 44 48 44 C52 44 54 48 52 52 C50 54 40 54 36 50 Z"
          className="fill-primary"
        />
        {/* Collar tag */}
        <circle cx="44" cy="54" r="2.5" className="fill-warning" />

        {/* Floppy ear in TAP Red */}
        <path
          d="M38 30 C44 26 50 32 48 42 C46 50 38 52 36 44 C34 38 34 32 38 30 Z"
          className="fill-primary"
        />

        {/* Snout */}
        <ellipse cx="22" cy="44" rx="10" ry="7" className="fill-foreground/90 dark:fill-foreground/80" />
        {/* Nose */}
        <ellipse cx="14" cy="43" rx="3.5" ry="2.5" className="fill-foreground" />
        <ellipse cx="14" cy="42.5" rx="1.5" ry="0.8" className="fill-background/60" />

        {/* Eye */}
        <ellipse cx="28" cy="36" rx="2.5" ry="3.5" className="fill-background" />
        <circle cx="27.5" cy="36" r="1.5" className="fill-foreground" />
        <circle cx="28.2" cy="35.2" r="0.6" className="fill-background" />

        {/* Eyebrow */}
        <path d="M25 31 C27 30 30 31 31 32" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="text-background" />
      </g>

      {/* Magnifying Glass (animated scanning motion) */}
      <g className="anim-magnifier text-primary">
        <circle cx="16" cy="62" r="10" stroke="currentColor" strokeWidth="2.5" className="fill-background/50" />
        <line x1="23" y1="69" x2="32" y2="78" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M12 56 C14 54 18 54 20 56" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
      </g>

      {/* Sniff dots (animated pulsing in TAP Red) */}
      <circle cx="8" cy="42" r="1.2" className="anim-dot-1 fill-primary" />
      <circle cx="5" cy="46" r="1" className="anim-dot-2 fill-primary/70" />
      <circle cx="10" cy="48" r="0.8" className="anim-dot-3 fill-primary/50" />

      {/* Curiosity mark (animated floating in TAP brand red) */}
      <g className="anim-sparkle text-primary">
        <path
          d="M32 18 C32 14 36 12 39 13 C42 14 43 17 41 19 C39 21 38 22 38 24 M38 27.5 L38 28"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

export function SpotlightDialog() {
  const { isOpen, setOpen, close, user } = useSpotlight();
  const [search, setSearch] = React.useState("");
  const router = useRouter();

  const items = React.useMemo(() => {
    return getSpotlightItems({ user });
  }, [user]);

  const itemsMap = React.useMemo(() => {
    return new Map(items.map((item) => [item.id, item]));
  }, [items]);

  const filterCommandItem = React.useCallback(
    (value: string, currentSearch: string) => {
      const item = itemsMap.get(value);
      if (!item) return 0;
      return scoreSpotlightSearch(item, currentSearch);
    },
    [itemsMap],
  );

  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      setOpen(open);
      if (!open) {
        setSearch("");
      }
    },
    [setOpen],
  );

  const handleSelect = React.useCallback(
    (item: SpotlightItem) => {
      close();
      setSearch("");
      router.push(item.url);
    },
    [close, router],
  );

  // Vim keyboard navigation support: Ctrl+J / Ctrl+N (Down), Ctrl+K / Ctrl+P (Up)
  const handleInputKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.ctrlKey && !e.metaKey) {
        if (e.key === "j" || e.key === "n") {
          e.preventDefault();
          const event = new KeyboardEvent("keydown", {
            key: "ArrowDown",
            code: "ArrowDown",
            keyCode: 40,
            which: 40,
            bubbles: true,
            cancelable: true,
          });
          e.currentTarget.dispatchEvent(event);
        } else if (e.key === "k" || e.key === "p") {
          e.preventDefault();
          const event = new KeyboardEvent("keydown", {
            key: "ArrowUp",
            code: "ArrowUp",
            keyCode: 38,
            which: 38,
            bubbles: true,
            cancelable: true,
          });
          e.currentTarget.dispatchEvent(event);
        }
      }
    },
    [],
  );

  const isSearchEmpty = search.trim().length === 0;

  return (
    <CommandDialog
      open={isOpen}
      onOpenChange={handleOpenChange}
      showCloseButton={false}
      filter={filterCommandItem}
      className="sm:max-w-xl rounded-2xl border border-border/60 bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/10 dark:shadow-black/50 overflow-hidden p-0 gap-0"
      title="Rychlé vyhledávání"
      description="Rychlý přechod na stránky a moduly v Tappce"
    >
      <CommandInput
        value={search}
        onValueChange={setSearch}
        onKeyDown={handleInputKeyDown}
        placeholder="Hledat v modulech a stránkách..."
        className="text-base sm:text-sm"
      />

      <CommandList className="max-h-[360px] p-2 scroll-py-2">
        {isSearchEmpty ? (
          <div className="py-7 px-4 text-center">
            <p className="font-heading text-sm font-semibold text-foreground">
              Rychlé vyhledávání v Tappce
            </p>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
              Můžeš hledat názvy stránek nebo napsat, co chceš udělat:
            </p>
            <div className="mt-3 flex flex-col items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => setSearch("chci napsat novou esej")}
                className="h-7 px-3 text-xs text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-md transition-colors font-normal"
              >
                <span className="text-muted-foreground/40 mr-1">“</span>
                <span>chci napsat novou esej</span>
                <span className="text-muted-foreground/40 ml-1">”</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => setSearch("zákaznické schůzky")}
                className="h-7 px-3 text-xs text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-md transition-colors font-normal"
              >
                <span className="text-muted-foreground/40 mr-1">“</span>
                <span>zákaznické schůzky</span>
                <span className="text-muted-foreground/40 ml-1">”</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => setSearch("chci zarezervovat místnost")}
                className="h-7 px-3 text-xs text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-md transition-colors font-normal"
              >
                <span className="text-muted-foreground/40 mr-1">“</span>
                <span>chci zarezervovat místnost</span>
                <span className="text-muted-foreground/40 ml-1">”</span>
              </Button>
            </div>
          </div>
        ) : (
          <>
            <CommandEmpty className="py-8 px-4 text-center">
              <div className="mx-auto mb-2.5 flex justify-center">
                <SearchDogIllustration />
              </div>
              <p className="font-heading text-sm font-semibold text-foreground">
                Haf! Tady jsme nic nenačichali...
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Zkus se zeptat přirozeně, například:
              </p>
              <div className="mt-3 flex flex-col items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => setSearch("chci napsat novou esej")}
                  className="h-7 px-3 text-xs text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-md transition-colors font-normal"
                >
                  <span className="text-muted-foreground/40 mr-1">“</span>
                  <span>chci napsat novou esej</span>
                  <span className="text-muted-foreground/40 ml-1">”</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => setSearch("zákaznické schůzky")}
                  className="h-7 px-3 text-xs text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-md transition-colors font-normal"
                >
                  <span className="text-muted-foreground/40 mr-1">“</span>
                  <span>zákaznické schůzky</span>
                  <span className="text-muted-foreground/40 ml-1">”</span>
                </Button>
              </div>
            </CommandEmpty>

            <CommandGroup className="p-0">
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.id}
                  onSelect={() => handleSelect(item)}
                  className={cn(
                    "group relative flex cursor-pointer items-center justify-between gap-3 rounded-xl px-2.5 py-2 text-sm transition-colors",
                    "data-[selected=true]:bg-accent/80 data-[selected=true]:text-accent-foreground",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/50 text-muted-foreground transition-colors group-data-[selected=true]:border-primary/20 group-data-[selected=true]:bg-primary/10 group-data-[selected=true]:text-primary">
                  <item.icon className="size-4" />
                </div>
                <div className="flex flex-col min-w-0 gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground truncate">
                      {item.title}
                    </span>
                    {item.betaOnly && (
                      <Badge
                        variant="secondary"
                        className="h-4 px-1 text-[9px] font-medium leading-none"
                      >
                        Beta
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground truncate leading-tight">
                    {item.description}
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5 pl-2">
                <span className="hidden items-center gap-1 text-[11px] text-muted-foreground group-data-[selected=true]:inline-flex">
                  <span className="text-[10px]">Přejít</span>
                  <CornerDownLeft className="size-3" />
                </span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </>
    )}
  </CommandList>

      <div className="flex items-center justify-between border-t border-border/40 bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-3.5">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
            <kbd className="inline-flex h-4.5 min-w-4.5 items-center justify-center rounded bg-muted px-1.5 font-mono text-[10px] font-medium text-foreground/70 shadow-2xs">
              ↑↓
            </kbd>
            <span className="hidden md:inline text-muted-foreground/50 font-mono text-[10px]">
              (^J ^K)
            </span>
            <span>Pohyb</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
            <kbd className="inline-flex h-4.5 min-w-4.5 items-center justify-center rounded bg-muted px-1.5 font-mono text-[10px] font-medium text-foreground/70 shadow-2xs">
              ↵
            </kbd>
            <span>Přejít</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
            <kbd className="inline-flex h-4.5 min-w-4.5 items-center justify-center rounded bg-muted px-1.5 font-mono text-[10px] font-medium text-foreground/70 shadow-2xs">
              esc
            </kbd>
            <span>Zavřít</span>
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground/50">
          <span className="size-1.5 rounded-full bg-primary/70" />
          <span>Tappka</span>
        </div>
      </div>
    </CommandDialog>
  );
}
