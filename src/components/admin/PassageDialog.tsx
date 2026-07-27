import { actions } from "astro:actions";
import { useState } from "react";

import { Modal } from "@/components/admin/Modal";
import type { PassageModelChoice } from "@/components/admin/ModelRadio";
import { Button } from "@/components/admin/ui";

// 写真の文章 (passageJa / passageZh) を生成 → 確認 → 採用するモーダル。
// 新規の写真投稿と既存写真の再生成で共用する。ツイート提案
// (TweetSuggestDialog) と同じ体験で、生成はプレビューのみ・「採用」を
// 押したときだけ保存や投稿が走る。留意事項を書き換えて再生成すると次の
// 生成に反映される。処理中は閉じられない (Modal の closeDisabled)。
//
// 保存/投稿の中身は用途ごとに違う (既存写真は更新、新規は days 作成) ので、
// onAdopt に委ねる。エラーメッセージを返せばダイアログ内に表示する。

export type Passages = { passageJa: string; passageZh: string };

type Props = {
  title: string;
  imageUrl: string;
  model: PassageModelChoice;
  // アップロード時に生成済みの文章があれば初期表示する。既存写真の再生成は
  // 未指定 (空の状態から「再生成」で 1 案目を作る)。
  initialPassages?: Passages;
  initialNotes?: string;
  adoptLabel: string;
  closeLabel?: string;
  // 採用時の保存処理。成功なら null、失敗ならメッセージを返す。
  onAdopt: (passages: Passages) => Promise<string | null>;
  onClose: () => void;
};

export function PassageDialog({
  title,
  imageUrl,
  model,
  initialPassages,
  initialNotes = "",
  adoptLabel,
  closeLabel = "閉じる",
  onAdopt,
  onClose,
}: Props) {
  const [notes, setNotes] = useState(initialNotes);
  const [result, setResult] = useState<Passages | null>(
    initialPassages ?? null,
  );
  const [busy, setBusy] = useState(false); // 生成中
  const [adopting, setAdopting] = useState(false); // 採用 (保存/投稿) 中
  const [error, setError] = useState<string | null>(null);

  const working = busy || adopting;

  const generate = async () => {
    if (working) return;
    setBusy(true);
    setError(null);
    const res = await actions.generateDayPassage({
      imageUrl,
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
    const message = await onAdopt(result);
    setAdopting(false);
    if (message) {
      setError(message);
      return;
    }
    onClose();
  };

  return (
    <Modal onClose={onClose} closeDisabled={working}>
      <h3 className="m-0 text-base font-semibold">{title}</h3>

      <img
        src={`${imageUrl}?w=240&fm=webp`}
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
          {closeLabel}
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
            {adopting ? "処理中…" : adoptLabel}
          </Button>
        )}
      </div>
    </Modal>
  );
}

export default PassageDialog;
