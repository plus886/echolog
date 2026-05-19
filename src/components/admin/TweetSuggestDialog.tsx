import { actions } from "astro:actions";
import { useEffect, useState } from "react";

// 過去ツイートをサンプルに新しいツイートを提案するモーダル (DaisyUI modal)。
// 「今の気分」を任意で入力 → 生成 → ダイアログ内に下書きを表示。
// 生成後は気分欄を書き換えてから再生成すると、前回下書きへのフィードバック
// として扱われる。採用すると下書きを投稿フォームへ流し込む (投稿はしない)。
// モデルは Sonnet 固定。

type Props = {
  onClose: () => void;
  onAdopt: (text: string) => void;
};

export function TweetSuggestDialog({ onClose, onAdopt }: Props) {
  const [mood, setMood] = useState("");
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 処理中以外は Esc で閉じる。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const generate = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await actions.suggestTweet({
      mood: mood.trim() || undefined,
      // draft があれば再生成。気分欄は前回下書きへの調整指示として渡る。
      previousDraft: draft ?? undefined,
    });
    setBusy(false);
    if (res.error || !res.data) {
      setError(res.error?.message ?? "生成に失敗しました");
      return;
    }
    setDraft(res.data.text);
  };

  const hasDraft = draft !== null;

  return (
    <dialog className="modal modal-open">
      <div className="modal-box flex flex-col gap-3">
        <h3 className="m-0 text-base font-semibold">AI でツイートを提案</h3>
        <p className="m-0 text-[13px] text-base-content/60">
          過去のツイートを参考に下書きを 1 件生成します。採用するまで投稿は
          されません。
        </p>

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {hasDraft ? "調整の指示・フィードバック（任意）" : "今の気分（任意）"}
          <textarea
            className="textarea textarea-bordered w-full"
            rows={3}
            value={mood}
            onChange={(e) => setMood(e.target.value)}
            placeholder={
              hasDraft
                ? "例: もう少し短く / 仕事の話は外して / 朝の感じで"
                : "例: 今日は肌寒い。台北の冬の入り口の話を書きたい。"
            }
            disabled={busy}
          />
          {hasDraft && (
            <span className="text-[12px] font-normal text-base-content/50">
              書き換えてから再生成すると、上の下書きへのフィードバックとして
              反映されます。
            </span>
          )}
        </label>

        {error && <p className="m-0 text-sm text-error">{error}</p>}

        {draft && (
          <div className="flex flex-col gap-1 rounded-md bg-base-200 p-3">
            <p className="m-0 text-[12px] font-medium text-base-content/50">
              生成された下書き
            </p>
            <p className="m-0 text-sm whitespace-pre-wrap text-base-content/80">
              {draft}
            </p>
          </div>
        )}

        <div className="modal-action">
          <button
            type="button"
            className="btn"
            onClick={onClose}
            disabled={busy}
          >
            閉じる
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => void generate()}
            disabled={busy}
          >
            {busy ? "生成中…" : hasDraft ? "再生成" : "生成"}
          </button>
          {draft && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                onAdopt(draft);
                onClose();
              }}
              disabled={busy}
            >
              採用
            </button>
          )}
        </div>
      </div>
      <button
        type="button"
        className="modal-backdrop"
        aria-label="閉じる"
        onClick={() => {
          if (!busy) onClose();
        }}
      />
    </dialog>
  );
}

export default TweetSuggestDialog;
