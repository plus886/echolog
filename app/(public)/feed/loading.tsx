export default function Loading() {
  return (
    <main className="mx-auto max-w-2xl w-full px-4 py-8">
      <ul
        aria-busy="true"
        aria-live="polite"
        className="flex flex-col gap-3"
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <li
            key={i}
            className="h-28 animate-pulse rounded-lg border border-border bg-foreground/[0.03]"
          />
        ))}
      </ul>
    </main>
  );
}
