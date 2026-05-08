"use client";

import { useActionState, useState, useTransition } from "react";

import {
  publishTweetAction,
  saveDraftAction,
  type ActionResult,
} from "@/app/(admin)/admin/_actions";
import { CharCounter } from "@/components/admin/CharCounter";
import { evaluateTweetText } from "@/lib/tweet-text";

const initialState: ActionResult = { ok: true, id: "" };

type Mode = { kind: "new" } | { kind: "reply"; parentId: string };

type Props = {
  mode?: Mode;
  defaultBody?: string;
};

export function ComposeForm({ mode = { kind: "new" }, defaultBody = "" }: Props) {
  const [body, setBody] = useState(defaultBody);
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
    const formData = new FormData();
    formData.set("body", body);
    if (mode.kind === "reply") {
      formData.set("parent", mode.parentId);
    }
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
        <input type="hidden" name="parent" value={mode.parentId} />
      )}

      {mode.kind === "reply" && (
        <p className="text-xs text-muted">
          ↩ <a href={`/tweets/${mode.parentId}`} className="underline">親ツイート</a> へのセルフリプライ
        </p>
      )}

      <textarea
        name="body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="いまどうしてる？"
        rows={4}
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
            {isPublishPending ? "投稿中…" : "投稿"}
          </button>
        </div>
      </div>

      {errorMessage && (
        <p className="text-sm text-red-600">{errorMessage}</p>
      )}
    </form>
  );
}
