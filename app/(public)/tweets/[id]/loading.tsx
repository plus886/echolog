export default function Loading() {
  return (
    <main className="mx-auto max-w-2xl w-full px-4 py-8 flex flex-col gap-4">
      <div className="h-4 w-24 animate-pulse rounded bg-foreground/[0.06]" />
      <div
        aria-busy="true"
        aria-live="polite"
        className="h-40 animate-pulse rounded-lg border border-border bg-foreground/[0.03]"
      />
    </main>
  );
}
