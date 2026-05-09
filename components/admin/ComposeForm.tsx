"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";

import {
  publishTweetAction,
  saveDraftAction,
  type ActionResult,
} from "@/app/(admin)/admin/_actions";
import { CharCounter } from "@/components/admin/CharCounter";
import { evaluateTweetText } from "@/lib/tweet-text";
import type { TweetReference } from "@/types/microcms";

const initialState: ActionResult = { ok: true, id: "" };

export type ComposeMode =
  | { kind: "new" }
  | { kind: "reply"; target: TweetReference }
  | { kind: "quote"; target: TweetReference };

type Props = {
  mode?: ComposeMode;
};

export function ComposeForm({ mode = { kind: "new" } }: Props) {
  const [body, setBody] = useState("");
  const [isDraftPending, startDraftTransition] = useTransition();

  const [publishState, publishFormAction, isPublishPending] = useActionState(
    async (_prev: ActionResult, formData: FormData): Promise<ActionResult> => {
      const result = await publishTweetAction(formData);
      if (result.ok) setBody("");
      return result;
    },
    initialState,
  );

  const [draftState, setDraftState] = useState<ActionResult>(initialState);

  const status = evaluateTweetText(body);
  const submitDisabled =
    !status.isValid || isPublishPending || isDraftPending;

  const handleSaveDraft = () => {
    if (!body.trim() || status.isOver) return;
    const formData = buildFormData(body, mode);
    startDraftTransition(async () => {
      const result = await saveDraftAction(formData);
      setDraftState(result);
      if (result.ok) setBody("");
    });
  };

  const errorMessage =
    !publishState.ok ? publishState.error :
    !draftState.ok ? draftState.error :
    null;

  return (
    <form action={publishFormAction} className="flex flex-col gap-3">
      {mode.kind === "reply" && (
        <input type="hidden" name="parent" value={mode.target.id} />
      )}
      {mode.kind === "quote" && (
        <input type="hidden" name="retweetOf" value={mode.target.id} />
      )}

      {mode.kind !== "new" && (
        <ModeBanner mode={mode} />
      )}

      <textarea
        name="body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={
          mode.kind === "reply"
            ? "返信を書く"
            : mode.kind === "quote"
              ? "引用ツイートにコメント"
              : "いまどうしてる？"
        }
        rows={4}
        autoFocus={mode.kind !== "new"}
        className="w-full resize-none rounded-md border border-border bg-transparent p-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-foreground/20"
      />

      <div className="flex items-center justify-between">
        <CharCounter status={status} />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={submitDisabled || !body.trim()}
            className="rounded-md border border-border px-4 py-1.5 text-sm hover:bg-foreground/[0.04] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDraftPending ? "保存中…" : "下書き保存"}
          </button>
          <button
            type="submit"
            disabled={submitDisabled || !body.trim()}
            className="rounded-md bg-foreground px-4 py-1.5 text-sm text-background hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPublishPending
              ? "投稿中…"
              : mode.kind === "reply"
                ? "返信"
                : mode.kind === "quote"
                  ? "引用RT"
                  : "投稿"}
          </button>
        </div>
      </div>

      {errorMessage && (
        <p className="text-sm text-red-600">{errorMessage}</p>
      )}
    </form>
  );
}

function buildFormData(body: string, mode: ComposeMode): FormData {
  const formData = new FormData();
  formData.set("body", body);
  if (mode.kind === "reply") formData.set("parent", mode.target.id);
  if (mode.kind === "quote") formData.set("retweetOf", mode.target.id);
  return formData;
}

function ModeBanner({
  mode,
}: {
  mode: Extract<ComposeMode, { kind: "reply" | "quote" }>;
}) {
  const label =
    mode.kind === "reply" ? "↩ セルフリプライ中" : "💬 引用RT 中";
  return (
    <div className="rounded-md border border-border bg-foreground/[0.03] p-3 text-xs">
      <div className="flex items-center justify-between text-muted">
        <span>{label}</span>
        <Link href="/admin" className="hover:underline">
          ✕ キャンセル
        </Link>
      </div>
      <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-foreground/80">
        {mode.target.body || "(本文なし)"}
      </p>
    </div>
  );
}
