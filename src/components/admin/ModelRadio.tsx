import { useId } from "react";

// 文章生成モデル (Opus / Sonnet / Fable) 選択ラジオ。写真投稿タブ・文章管理
// タブで共用する。DaisyUI の radio を使う。実 model ID の対応は
// lib/photo-passage.ts の MODEL_IDS 側に集約。
//
// PassageModelChoice 型もここに置く (旧 PhotoComposer から移動)。

export type PassageModelChoice = "opus" | "sonnet" | "fable";

const MODELS: readonly [PassageModelChoice, string][] = [
  ["opus", "Opus"],
  ["sonnet", "Sonnet"],
  ["fable", "Fable"],
];

export function ModelRadio({
  value,
  onChange,
  disabled = false,
}: {
  value: PassageModelChoice;
  onChange: (model: PassageModelChoice) => void;
  // 生成中は切り替えさせない (走っているモデルと表示が食い違うため)。
  disabled?: boolean;
}) {
  // インスタンスごとに一意な name。複数の ModelRadio が同時マウントされても
  // ラジオグループが混線しないようにする。
  const groupName = useId();
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <span className="text-sm font-medium">文章生成モデル</span>
      {MODELS.map(([key, label]) => (
        <label key={key} className="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name={groupName}
            className="radio radio-sm"
            value={key}
            checked={value === key}
            onChange={() => onChange(key)}
            disabled={disabled}
          />
          <span className="text-sm">{label}</span>
        </label>
      ))}
    </div>
  );
}

export default ModelRadio;
