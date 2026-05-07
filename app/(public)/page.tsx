import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-2xl w-full px-4 py-12 flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold">echolog</h1>
        <p className="mt-2 text-muted">
          echo + log — 自分の発信が積み重なっていく場所
        </p>
      </header>

      <p className="text-sm text-muted">
        ※ Phase 1 のプレースホルダ。Phase 4 以降でポートフォリオへ統合される予定。
      </p>

      <nav className="flex gap-4 text-sm">
        <Link
          href="/feed"
          prefetch={false}
          className="rounded-md border border-border px-4 py-2 hover:bg-foreground/[0.04]"
        >
          フィードを見る
        </Link>
      </nav>
    </main>
  );
}
