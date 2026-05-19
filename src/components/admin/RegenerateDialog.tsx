import { actions } from "astro:actions";
import { useState } from "react";

import { Modal } from "@/components/admin/Modal";
import type { PassageModelChoice } from "@/components/admin/ModelRadio";
import { Button } from "@/components/admin/ui";

// 1 件の写真の文章を再生成するモーダル。留意事項 (任意) を渡して再生成し、
// 生成文をダイアログ内にフィードバック。成功時は onRegenerated で一覧の
// 再取得を依頼する。処理中は閉じられない (Modal の closeDisabled)。

type Passages = { passageJa: string; passageZh: string };

type Props = {
  day: { id: string; imageUrl: string };
  model: PassageModelChoice;
  onClose: () => void;
  onRegenerated: () => void;
};

export function RegenerateDialog({
  day,
  model,
  onClose,
  onRegenerated,
}: Props) {
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Passages | null>(null);

  const handleRegenerate = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await actions.regenerateDayPassage({
      id: day.id,
      imageUrl: day.imageUrl,
      notes: notes.trim() || undefined,
      model,
    });
    setBusy(false);
    if (res.error || !res.data) {
      setError(res.error?.message ?? "再生成に失敗しました");
      return;
    }
    setResult(res.data);
    onRegenerated();
  };

  return (
    <Modal onClose={onClose} closeDisabled={busy}>
      <h3 className="m-0 text-base font-semibold">文章を再生成</h3>

      <img
        src={`${day.imageUrl}?w=240&fm=webp`}
        alt=""
        className="max-h-40 w-full rounded-md object-contain"
      />

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        留意事項（任意）
        <textarea
          className="textarea textarea-bordered w-full"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="例: 写っているのは私の妻と義母。それを前提に書いてほしい。"
          disabled={busy}
        />
      </label>

      {error && <p className="m-0 text-sm text-error">{error}</p>}

      {result && (
        <div className="flex flex-col gap-1 rounded-md bg-base-200 p-3 text-sm">
          <p className="m-0 font-medium">生成しました（一覧も更新済み）</p>
          <p className="m-0 whitespace-pre-wrap">
            <span className="opacity-60">JA</span> {result.passageJa}
          </p>
          <p className="m-0 whitespace-pre-wrap">
            <span className="opacity-60">ZH</span> {result.passageZh}
          </p>
        </div>
      )}

      <div className="modal-action">
        <Button variant="neutral" onClick={onClose} disabled={busy}>
          閉じる
        </Button>
        <Button onClick={() => void handleRegenerate()} disabled={busy}>
          {busy ? "生成中…" : result ? "再度生成" : "再生成"}
        </Button>
      </div>
    </Modal>
  );
}

export default RegenerateDialog;
