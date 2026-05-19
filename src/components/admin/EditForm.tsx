import { actions } from "astro:actions";
import { useState, useTransition } from "react";

import { CharCounter } from "@/components/admin/CharCounter";
import { Button, ErrorAlert } from "@/components/admin/ui";
import { evaluateTweetText } from "@/lib/tweet-text";

// 編集フォーム。日本語本文のみ編集可能。台湾華語訳は編集時に再翻訳され
// ない仕様なので参考として読み取り専用で表示する。
// updateTweet は Astro Action に redirect が無いため成功後に /admin へ。

type Props = {
  id: string;
  defaultBody: string;
  defaultBodyZh: string;
  isDraft: boolean;
};

export function EditForm({ id, defaultBody, defaultBodyZh, isDraft }: Props) {
  const [body, setBody] = useState(defaultBody);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const status = evaluateTweetText(body);
  const submitDisabled = !status.isValid || isPending || !body.trim();

  const handleSubmit = (publish: boolean) => {
    setError(null);
    const formData = new FormData();
    formData.set("id", id);
    formData.set("body", body);
    formData.set("publish", publish ? "true" : "false");
    startTransition(async () => {
      const result = await actions.updateTweet(formData);
      if (result.error) {
        setError(result.error.message);
      } else {
        window.location.href = "/admin";
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium tracking-wide text-base-content/50 uppercase">
          日本語
        </span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          className="textarea textarea-bordered w-full resize-y p-3 text-base leading-relaxed"
          suppressHydrationWarning
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium tracking-wide text-base-content/50 uppercase">
          台湾華語訳（参考・編集時は再翻訳されません）
        </span>
        <p className="m-0 rounded-md border border-base-300 bg-base-200 p-3 text-sm leading-relaxed whitespace-pre-wrap text-base-content/70">
          {defaultBodyZh || "(未翻訳)"}
        </p>
      </div>

      {error && <ErrorAlert>{error}</ErrorAlert>}

      <div className="flex items-center justify-between gap-3">
        <CharCounter status={status} />
        <div className="flex items-center gap-2">
          <a href="/admin" className="btn btn-ghost btn-sm">
            キャンセル
          </a>
          <Button
            variant="outline"
            onClick={() => handleSubmit(false)}
            disabled={submitDisabled}
          >
            {isPending ? "保存中…" : "保存"}
          </Button>
          {isDraft && (
            <Button
              onClick={() => handleSubmit(true)}
              disabled={submitDisabled}
            >
              {isPending ? "公開中…" : "公開"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default EditForm;
