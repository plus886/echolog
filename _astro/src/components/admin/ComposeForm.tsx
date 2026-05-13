import { actions } from "astro:actions";
import {
  type FormEvent,
  useMemo,
  useState,
  useTransition,
} from "react";

import { CharCounter } from "@/components/admin/CharCounter";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { LinkPreview } from "@/components/admin/LinkPreview";
import { evaluateTweetText } from "@/lib/tweet-text";
import { extractFirstUrl } from "@/lib/url-detect";
import type { TweetReference } from "@/types/microcms";

// 旧 components/admin/ComposeForm.tsx の Astro 移植。
//
// 旧版は React 19 の useActionState + Next.js Server Actions だった。
// Astro Actions には useActionState 等価がないため、本実装は
// useTransition + 自前 state で同等の UX を組む。actions.publishTweet
// (form input 受け) を呼び、{ data, error } を受け取って分岐。

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
  const [error, setError] = useState<string | null>(null);
  const [isPublishing, startPublish] = useTransition();
  const [isDraftPending, startDraft] = useTransition();

  const status = evaluateTweetText(body);
  const previewUrl = useMemo(() => extractFirstUrl(body), [body]);
  const submitDisabled =
    !status.isValid || isPublishing || isDraftPending;
  const noContent = !body.trim() && images.length === 0;

  const collectFormData = () => {
    const fd = new FormData();
    fd.set("body", body);
    if (mode.kind === "reply") fd.set("parent", mode.target.id);
    if (mode.kind === "quote") fd.set("retweetOf", mode.target.id);
    fd.set("images", JSON.stringify(images));
    return fd;
  };

  const reset = () => {
    setBody("");
    setImages([]);
    setError(null);
  };

  const handlePublish = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = collectFormData();
    startPublish(async () => {
      const result = await actions.publishTweet(formData);
      if (result.error) {
        setError(result.error.message);
      } else {
        reset();
      }
    });
  };

  const handleSaveDraft = () => {
    if (noContent || status.isOver) return;
    setError(null);
    const formData = collectFormData();
    startDraft(async () => {
      const result = await actions.saveDraft(formData);
      if (result.error) {
        setError(result.error.message);
      } else {
        reset();
      }
    });
  };

  return (
    <form onSubmit={handlePublish} className="flex flex-col gap-5">
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
        // FontPlus が hydration 前に inline font-family を注入するため、
        // controlled textarea で attribute mismatch 警告が出る。最終 font は
        // 意図通りなのでこの要素のみ警告を抑止。
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
            disabled={submitDisabled || noContent}
            className="border border-(--ink-30) px-5 py-2 text-[11px] uppercase tracking-[0.16em] text-(--ink-70) transition-opacity hover:opacity-60 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isDraftPending ? "saving…" : "save draft"}
          </button>
          <button
            type="submit"
            disabled={submitDisabled || noContent}
            className="bg-(--ink) px-5 py-2 text-[11px] uppercase tracking-[0.16em] text-(--paper) transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPublishing
              ? "posting…"
              : mode.kind === "reply"
                ? "reply"
                : mode.kind === "quote"
                  ? "quote"
                  : "publish"}
          </button>
        </div>
      </div>

      {error && (
        <p className="font-serif text-[14px] italic text-(--ink-70)">{error}</p>
      )}
    </form>
  );
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
        <p className="m-0 k-label-mini">{label}</p>
        <a
          href="/admin"
          className="text-[11px] lowercase text-(--ink-50) transition-opacity hover:opacity-60"
        >
          cancel
        </a>
      </div>
      <p className="mt-2 line-clamp-3 whitespace-pre-wrap font-serif text-[15px] leading-[1.8] text-(--ink-70)">
        {mode.target.body || "(本文なし)"}
      </p>
    </div>
  );
}
