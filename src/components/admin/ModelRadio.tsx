import { useId } from "react";

// 文章生成モデル (Opus / Sonnet) 選択ラジオ。写真投稿タブ・文章管理タブで
// 共用する。DaisyUI の radio を使う。
//
// PassageModelChoice 型もここに置く (旧 PhotoComposer から移動)。

export type PassageModelChoice = "opus" | "sonnet";

const MODELS: readonly [PassageModelChoice, string][] = [
  ["opus", "Opus"],
  ["sonnet", "Sonnet"],
];

export function ModelRadio({
  value,
  onChange,
}: {
  value: PassageModelChoice;
  onChange: (model: PassageModelChoice) => void;
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
          />
          <span className="text-sm">{label}</span>
        </label>
      ))}
    </div>
  );
}

export default ModelRadio;
