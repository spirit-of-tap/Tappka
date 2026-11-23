export default function Loading() {
  return (
    <div role="status" className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
      <span
        aria-hidden
        className="flex size-12 items-center justify-center rounded-2xl bg-primary font-heading text-xl font-extrabold text-primary-foreground shadow-lg shadow-primary/25 motion-safe:animate-breathe"
      >
        T
      </span>
      <span aria-hidden className="relative h-1 w-24 overflow-hidden rounded-full bg-muted">
        <span className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-primary motion-safe:animate-sweep" />
      </span>
      <span className="sr-only">Načítám…</span>
    </div>
  );
}
