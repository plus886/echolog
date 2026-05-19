import { useState } from "react";

import { DaysList } from "@/components/admin/DaysList";
import {
  ModelRadio,
  type PassageModelChoice,
} from "@/components/admin/ModelRadio";
import { PhotoBackfillPanel } from "@/components/admin/PhotoBackfillPanel";

// admin「文章管理」タブの root。縦に:
//  ① モデル選択 (バックフィルと個別再生成が共用)
//  ② days 一覧 (お気に入り・個別再生成)
//  ③ 未生成生成パネル (バルク操作は一覧の下にまとめる)
//  ④ 全文章削除パネル — 破壊的操作なので末尾に置く

export function PassageManager() {
  const [model, setModel] = useState<PassageModelChoice>("opus");

  return (
    <div className="flex flex-col gap-6">
      <ModelRadio value={model} onChange={setModel} />
      <DaysList model={model} />
      <PhotoBackfillPanel only="missing" model={model} />
      <PhotoBackfillPanel only="clear" model={model} />
    </div>
  );
}

export default PassageManager;
