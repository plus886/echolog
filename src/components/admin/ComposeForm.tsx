import { actions } from "astro:actions";
import { type FormEvent, useMemo, useState, useTransition } from "react";

import { CharCounter } from "@/components/admin/CharCounter";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { LinkPreview } from "@/components/admin/LinkPreview";
import { Button } from "@/components/admin/ui";
import { evaluateTweetText } from "@/lib/tweet-text";
import { extractFirstUrl } from "@/lib/url-detect";

// 投稿フォーム。AdminDashboard 内に置かれ、投稿成功を onPosted で親へ
// 通知する (親が一覧を再フェッチする)。reply / quote モードは親 (一覧の
// 行クリック) が mode prop で制御し、onCancelMode で解除する。

export type ComposeTarget = { id: string; body?: string };

export type ComposeMode =
  | { kind: "new" }
  | { kind: "reply"; target: ComposeTarget }
  | { kind: "quote"; target: ComposeTarget };

type Props = {
  mode?: ComposeMode;
  onPosted?: (kind: "publish" | "draft") => void;
  onCancelMode?: () => void;
};

export function ComposeForm({
  mode = { kind: "new" },
  onPosted,
  onCancelMode,
}: Props) {
  const [body, setBody] = useState("");
  const [images, setImages] = useState<{ url: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPublishing, startPublish] = useTransition();
  const [isDraftPending, startDraft] = useTransition();

  const status = evaluateTweetText(body);
  const previewUrl = useMemo(() => extractFirstUrl(body), [body]);
  const submitDisabled = !status.isValid || isPublishing || isDraftPending;
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
    if (submitDisabled || noContent) return;
    setError(null);
    const formData = collectFormData();
    startPublish(async () => {
      const result = await actions.publishTweet(formData);
      if (result.error) {
        setError(result.error.message);
      } else {
        reset();
        onPosted?.("publish");
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
        onPosted?.("draft");
      }
    });
  };

  const submitLabel = isPublishing
    ? "送信中…"
    : mode.kind === "reply"
      ? "返信"
      : mode.kind === "quote"
        ? "引用"
        : "投稿";

  return (
    <form onSubmit={handlePublish} className="flex flex-col gap-3">
      {mode.kind !== "new" && (
        <ModeBanner mode={mode} onCancel={onCancelMode} />
      )}

      <textarea
        name="body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={
          mode.kind === "reply"
            ? "返信を書く"
            : mode.kind === "quote"
              ? "引用にコメントを添える"
              : "いまどうしてる？"
        }
        rows={5}
        autoFocus={mode.kind !== "new"}
        className="w-full resize-y rounded-md border border-(--ink-15) bg-(--paper) p-3 text-base leading-relaxed text-(--ink) placeholder:text-(--ink-50) focus-visible:border-(--ink-30) focus-visible:ring-2 focus-visible:ring-(--ink-15) focus-visible:outline-none"
        // FontPlus が hydration 前に inline font-family を注入するため、
        // controlled textarea の attribute mismatch 警告をこの要素のみ抑止。
        suppressHydrationWarning
      />

      <ImageUploader value={images} onChange={setImages} />

      <LinkPreview url={previewUrl} />

      {error && (
        <p className="m-0 rounded-md bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <CharCounter status={status} />
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleSaveDraft}
            disabled={submitDisabled || noContent}
          >
            {isDraftPending ? "保存中…" : "下書き保存"}
          </Button>
          <Button type="submit" disabled={submitDisabled || noContent}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}

function ModeBanner({
  mode,
  onCancel,
}: {
  mode: Extract<ComposeMode, { kind: "reply" | "quote" }>;
  onCancel?: () => void;
}) {
  const label = mode.kind === "reply" ? "返信先" : "引用元";
  return (
    <div className="rounded-md border border-(--ink-15) bg-(--paper-2) p-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[11px] font-medium tracking-wide text-(--ink-50) uppercase">
          {label}
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="text-[13px] text-(--ink-50) transition-opacity hover:opacity-60"
        >
          解除
        </button>
      </div>
      <p className="m-0 mt-1.5 line-clamp-3 text-[13px] leading-relaxed whitespace-pre-wrap text-(--ink-70)">
        {mode.target.body || "(本文なし)"}
      </p>
    </div>
  );
}

export default ComposeForm;
