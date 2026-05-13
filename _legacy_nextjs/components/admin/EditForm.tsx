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
    <div className="flex flex-col gap-5">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={7}
        className="w-full resize-none border-0 bg-(--paper-2) p-5 font-serif text-[18px] leading-[1.85] text-(--ink) placeholder:text-(--ink-50) placeholder:italic focus:outline-none focus:ring-1 focus:ring-(--ink-30)"
        // FontPlus が hydration 前に inline font-family を注入するため、
        // controlled textarea で attribute mismatch 警告が出る。
        // 最終 font は意図通りなのでこの要素のみ警告を抑止。
        suppressHydrationWarning
      />

      <div className="flex items-center justify-between gap-4">
        <CharCounter status={status} />
        <div className="flex items-center gap-4">
          <Link
            href="/admin"
            className="k-label-mini transition-opacity hover:opacity-60"
          >
            cancel
          </Link>
          <button
            type="button"
            onClick={() => handleSubmit(false)}
            disabled={submitDisabled}
            className="border border-(--ink-30) px-5 py-2 text-[11px] uppercase tracking-[0.16em] text-(--ink-70) transition-opacity hover:opacity-60 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPending ? "saving…" : "save"}
          </button>
          {isDraft && (
            <button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={submitDisabled}
              className="bg-(--ink) px-5 py-2 text-[11px] uppercase tracking-[0.16em] text-(--paper) transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isPending ? "publishing…" : "publish"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="font-serif text-[14px] italic text-(--ink-70)">{error}</p>
      )}
    </div>
  );
}
