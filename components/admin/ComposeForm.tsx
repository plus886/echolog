"use client";

import Link from "next/link";
import { useActionState, useMemo, useState, useTransition } from "react";

import {
  publishTweetAction,
  saveDraftAction,
  type ActionResult,
} from "@/app/(admin)/admin/_actions";
import { CharCounter } from "@/components/admin/CharCounter";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { LinkPreview } from "@/components/admin/LinkPreview";
import { evaluateTweetText } from "@/lib/tweet-text";
import { extractFirstUrl } from "@/lib/url-detect";
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
  const [images, setImages] = useState<{ url: string }[]>([]);
  const [isDraftPending, startDraftTransition] = useTransition();

  const [publishState, publishFormAction, isPublishPending] = useActionState(
    async (_prev: ActionResult, formData: FormData): Promise<ActionResult> => {
      const result = await publishTweetAction(formData);
      if (result.ok) {
        setBody("");
        setImages([]);
      }
      return result;
    },
    initialState,
  );

  const [draftState, setDraftState] = useState<ActionResult>(initialState);

  const status = evaluateTweetText(body);
  const previewUrl = useMemo(() => extractFirstUrl(body), [body]);
  const submitDisabled =
    !status.isValid || isPublishPending || isDraftPending;

  const handleSaveDraft = () => {
    if (!body.trim() || status.isOver) return;
    const formData = buildFormData(body, mode, images);
    startDraftTransition(async () => {
      const result = await saveDraftAction(formData);
      setDraftState(result);
      if (result.ok) {
        setBody("");
        setImages([]);
      }
    });
  };

  const errorMessage =
    !publishState.ok ? publishState.error :
    !draftState.ok ? draftState.error :
    null;

  return (
    <form action={publishFormAction} className="flex flex-col gap-5">
      {mode.kind === "reply" && (
        <input type="hidden" name="parent" value={mode.target.id} />
      )}
      {mode.kind === "quote" && (
        <input type="hidden" name="retweetOf" value={mode.target.id} />
      )}
      <input type="hidden" name="images" value={JSON.stringify(images)} />

      {mode.kind !== "new" && <ModeBanner mode={mode} />}

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
        rows={6}
        autoFocus={mode.kind !== "new"}
        className="w-full resize-none border-0 bg-(--paper-2) p-5 font-serif text-[18px] leading-[1.85] text-(--ink) placeholder:text-(--ink-50) placeholder:italic focus:outline-none focus:ring-1 focus:ring-(--ink-30)"
        // FontPlus が hydration 前に inline style="font-family: fontplus-..."
        // を差し込むため、controlled textarea の attribute 比較で
        // mismatch 警告が出る。最終的な font-family は意図通りなので、
        // この要素についてのみ警告を抑止する。
        suppressHydrationWarning
      />

      <ImageUploader value={images} onChange={setImages} />

      <LinkPreview url={previewUrl} />

      <div className="flex items-center justify-between gap-4">
        <CharCounter status={status} />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={submitDisabled || (!body.trim() && images.length === 0)}
            className="border border-(--ink-30) px-5 py-2 text-[11px] uppercase tracking-[0.16em] text-(--ink-70) transition-opacity hover:opacity-60 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isDraftPending ? "saving…" : "save draft"}
          </button>
          <button
            type="submit"
            disabled={submitDisabled || (!body.trim() && images.length === 0)}
            className="bg-(--ink) px-5 py-2 text-[11px] uppercase tracking-[0.16em] text-(--paper) transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPublishPending
              ? "posting…"
              : mode.kind === "reply"
                ? "reply"
                : mode.kind === "quote"
                  ? "quote"
                  : "publish"}
          </button>
        </div>
      </div>

      {errorMessage && (
        <p className="font-serif text-[14px] italic text-(--ink-70)">
          {errorMessage}
        </p>
      )}
    </form>
  );
}

function buildFormData(
  body: string,
  mode: ComposeMode,
  images: { url: string }[],
): FormData {
  const formData = new FormData();
  formData.set("body", body);
  if (mode.kind === "reply") formData.set("parent", mode.target.id);
  if (mode.kind === "quote") formData.set("retweetOf", mode.target.id);
  formData.set("images", JSON.stringify(images));
  return formData;
}

function ModeBanner({
  mode,
}: {
  mode: Extract<ComposeMode, { kind: "reply" | "quote" }>;
}) {
  const label = mode.kind === "reply" ? "In reply to" : "Quoting";
  return (
    <div className="border-l border-(--ink-30) pl-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="m-0 k-label-mini">
          {label}
        </p>
        <Link
          href="/admin"
          className="text-[11px] lowercase text-(--ink-50) transition-opacity hover:opacity-60"
        >
          cancel
        </Link>
      </div>
      <p className="mt-2 line-clamp-3 whitespace-pre-wrap font-serif text-[15px] leading-[1.8] text-(--ink-70)">
        {mode.target.body || "(本文なし)"}
      </p>
    </div>
  );
}
