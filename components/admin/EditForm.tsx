"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { updateTweetAction } from "@/app/(admin)/admin/_actions";
import { CharCounter } from "@/components/admin/CharCounter";
import { evaluateTweetText } from "@/lib/tweet-text";

type Props = {
  id: string;
  defaultBody: string;
  isDraft: boolean;
};

export function EditForm({ id, defaultBody, isDraft }: Props) {
  const [body, setBody] = useState(defaultBody);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const status = evaluateTweetText(body);
  const submitDisabled =
    !status.isValid || isPending || !body.trim();

  const handleSubmit = (publish: boolean) => {
    setError(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("id", id);
        formData.set("body", body);
        formData.set("publish", publish ? "true" : "false");
        await updateTweetAction(formData);
      } catch (e) {
        setError(e instanceof Error ? e.message : "更新に失敗しました");
      }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={5}
        className="w-full resize-none rounded-md border border-border bg-transparent p-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-foreground/20"
      />

      <div className="flex items-center justify-between">
        <CharCounter status={status} />
        <div className="flex items-center gap-2">
          <Link
            href="/admin"
            className="rounded-md px-3 py-1.5 text-sm text-muted hover:underline"
          >
            キャンセル
          </Link>
          <button
            type="button"
            onClick={() => handleSubmit(false)}
            disabled={submitDisabled}
            className="rounded-md border border-border px-4 py-1.5 text-sm hover:bg-foreground/[0.04] disabled:opacity-50"
          >
            {isPending ? "更新中…" : "保存"}
          </button>
          {isDraft && (
            <button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={submitDisabled}
              className="rounded-md bg-foreground px-4 py-1.5 text-sm text-background hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? "公開中…" : "公開する"}
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
