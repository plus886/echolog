import { actions } from "astro:actions";
import { useState } from "react";

import { Modal } from "@/components/admin/Modal";
import type { PassageModelChoice } from "@/components/admin/ModelRadio";
import { Button } from "@/components/admin/ui";

// 1 件の写真の文章を再生成するモーダル。ツイート提案 (TweetSuggestDialog) と
// 同じ体験: 再生成はプレビューのみで microCMS には保存せず、再生成し直すか
// 採用するかを選べる。「採用」を押したときだけ保存 (POST) する。
// 留意事項 (任意) を書き換えてから再生成すると次の生成に反映される。
// 処理中は閉じられない (Modal の closeDisabled)。

type Passages = { passageJa: string; passageZh: string };

type Props = {
  day: { id: string; imageUrl: string };
  model: PassageModelChoice;
  onClose: () => void;
  // 採用 (保存) 成功時に、保存された文章を呼び出し側へ渡す
  // (呼び出し側はその行だけを書き換える。一覧の再取得はしない)。
  onAdopted: (passages: Passages) => void;
};

export function RegenerateDialog({ day, model, onClose, onAdopted }: Props) {
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<Passages | null>(null);
  const [busy, setBusy] = useState(false); // 生成中
  const [adopting, setAdopting] = useState(false); // 採用 (保存) 中
  const [error, setError] = useState<string | null>(null);

  const working = busy || adopting;

  const generate = async () => {
    if (working) return;
    setBusy(true);
    setError(null);
    const res = await actions.generateDayPassage({
      imageUrl: day.imageUrl,
      notes: notes.trim() || undefined,
      model,
    });
    setBusy(false);
    if (res.error || !res.data) {
      setError(res.error?.message ?? "生成に失敗しました");
      return;
    }
    setResult(res.data);
  };

  const adopt = async () => {
    if (working || !result) return;
    setAdopting(true);
    setError(null);
    const res = await actions.updateDayPassages({
      id: day.id,
      passageJa: result.passageJa,
      passageZh: result.passageZh,
    });
    setAdopting(false);
    if (res.error || !res.data) {
      setError(res.error?.message ?? "採用に失敗しました");
      return;
    }
    onAdopted(res.data);
    onClose();
  };

  return (
    <Modal onClose={onClose} closeDisabled={working}>
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
          disabled={working}
        />
        {result && (
          <span className="text-[12px] font-normal text-base-content/50">
            書き換えてから再生成すると次の生成に反映されます。採用するまで
            保存されません。
          </span>
        )}
      </label>

      {error && <p className="m-0 text-sm text-error">{error}</p>}

      {result && (
        <div className="flex flex-col gap-1 rounded-md bg-base-200 p-3 text-sm">
          <p className="m-0 text-[12px] font-medium text-base-content/50">
            生成された文章（採用するまで未保存）
          </p>
          <p className="m-0 whitespace-pre-wrap">
            <span className="opacity-60">JA</span> {result.passageJa}
          </p>
          <p className="m-0 whitespace-pre-wrap">
            <span className="opacity-60">ZH</span> {result.passageZh}
          </p>
        </div>
      )}

      <div className="modal-action">
        <Button variant="neutral" onClick={onClose} disabled={working}>
          閉じる
        </Button>
        <Button
          variant="outline"
          onClick={() => void generate()}
          disabled={working}
        >
          {busy ? "生成中…" : "再生成"}
        </Button>
        {result && (
          <Button onClick={() => void adopt()} disabled={working}>
            {adopting ? "採用中…" : "採用"}
          </Button>
        )}
      </div>
    </Modal>
  );
}

export default RegenerateDialog;
