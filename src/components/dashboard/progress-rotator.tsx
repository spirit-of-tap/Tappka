'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Pause, Play } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ProgressRing, progressPercent } from '@/components/ui/progress-ring';
import type { ProgressSlide, ProgressTone } from '@/lib/dashboard/progress-slides';
import { cn } from '@/lib/utils';

const ROTATE_MS = 7000;

const TONES: Record<ProgressTone, { text: string; stroke: string; bar: string; dot: string }> = {
  violet: { text: 'text-chart-5', stroke: 'stroke-chart-5', bar: 'bg-chart-5', dot: 'bg-chart-5' },
  primary: { text: 'text-primary', stroke: 'stroke-primary', bar: 'bg-primary', dot: 'bg-primary' },
};

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Personal progress card that turns between book points and customer meetings.
 * Auto-rotation pauses on hover/focus, can be stopped with the pause button and
 * is off with reduced motion.
 */
export function ProgressRotator({ slides }: { slides: ProgressSlide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [stopped, setStopped] = useState(false);
  const rotating = slides.length > 1;

  useEffect(() => {
    if (!rotating || paused || stopped || prefersReducedMotion()) return;
    const timer = window.setTimeout(() => setIndex((i) => (i + 1) % slides.length), ROTATE_MS);
    return () => window.clearTimeout(timer);
  }, [index, paused, stopped, rotating, slides.length]);

  const slide = slides[index] ?? slides[0];
  if (!slide) return null;
  const tone = TONES[slide.tone];

  return (
    <section
      aria-roledescription={rotating ? 'karusel' : undefined}
      aria-label="Tvůj postup"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="flex h-full flex-col gap-4 overflow-hidden rounded-2xl border bg-card p-5 text-card-foreground shadow-sm md:p-6"
    >
      <div className="flex items-center gap-2">
        <h2 className={cn('text-sm font-bold', tone.text)}>{slide.title}</h2>
        <Link
          href={slide.href}
          className={cn('focus-ring ml-auto inline-flex items-center gap-1 rounded-sm text-sm font-medium hover:underline underline-offset-4', tone.text)}
        >
          {slide.linkLabel}
          <ArrowRight className="size-3.5" />
        </Link>
      </div>

      <div key={slide.id} className="flex flex-1 flex-col gap-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-6 motion-safe:duration-500">
        <div className="flex items-center gap-4">
          <ProgressRing
            percent={progressPercent(slide.value, slide.goal)}
            strokeClassName={tone.stroke}
            role="img"
            aria-label={slide.ringLabel}
          >
            <text x="48" y="47" textAnchor="middle" className="fill-foreground font-heading text-[22px] font-extrabold">
              {slide.value}
            </text>
            <text x="48" y="64" textAnchor="middle" className="fill-muted-foreground text-[11px]">
              z {slide.goal} {slide.unit}
            </text>
          </ProgressRing>
          <div className="min-w-0 space-y-1">
            <p className="font-heading text-lg font-bold">{slide.headline}</p>
            <p className="text-sm text-muted-foreground">{slide.detail}</p>
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex text-xs text-muted-foreground">
            <span>Za celé studium</span>
            <span className="ml-auto tabular-nums">
              <b className="text-foreground">{slide.value}</b> / {slide.studyTotal}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn('h-2 origin-left rounded-full motion-safe:animate-in motion-safe:slide-in-from-left-full motion-safe:duration-700', tone.bar)}
              style={{ width: `${progressPercent(slide.value, slide.studyTotal)}%` }}
            />
          </div>
        </div>
      </div>

      {rotating && (
        <div className="flex items-center justify-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setStopped((value) => !value)}
            aria-label={stopped ? 'Spustit rotaci' : 'Pozastavit rotaci'}
            className="size-6 rounded-full p-0 text-muted-foreground"
          >
            {stopped ? <Play className="size-3" aria-hidden /> : <Pause className="size-3" aria-hidden />}
          </Button>
          {slides.map((s, i) => (
            <Button
              key={s.id}
              type="button"
              variant="ghost"
              onClick={() => setIndex(i)}
              aria-label={s.title}
              aria-current={i === index}
              className="group/dot size-6 min-w-0 rounded-full p-0"
            >
              <span
                aria-hidden
                className={cn(
                  'h-1.5 rounded-full motion-safe:transition-[width,background-color] motion-safe:duration-300',
                  i === index ? cn('w-6', TONES[s.tone].dot) : 'w-1.5 bg-muted-foreground/30 group-hover/dot:bg-muted-foreground/50',
                )}
              />
            </Button>
          ))}
        </div>
      )}
    </section>
  );
}
