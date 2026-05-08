import Link from "next/link";
import { headers } from "next/headers";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const h = await headers();
  const email = h.get("x-echolog-user-email") ?? "";
  const bypassed = h.get("x-echolog-bypassed") === "true";

  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-border px-4 py-3 flex items-center justify-between text-sm">
        <nav className="flex items-center gap-4">
          <Link href="/admin" className="font-semibold">
            echolog admin
          </Link>
          <Link href="/admin/drafts" className="text-muted hover:underline">
            下書き
          </Link>
          <Link href="/feed" className="text-muted hover:underline">
            公開フィードを見る
          </Link>
        </nav>
        <div className="text-muted">
          {email}
          {bypassed && (
            <span className="ml-2 rounded bg-yellow-200 px-1.5 py-0.5 text-yellow-900 text-xs">
              BYPASS
            </span>
          )}
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
