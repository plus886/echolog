import { useState } from "react";

import { DaysList } from "@/components/admin/DaysList";
import {
  ModelRadio,
  type PassageModelChoice,
} from "@/components/admin/ModelRadio";
import { PhotoBackfillPanel } from "@/components/admin/PhotoBackfillPanel";
import { Card } from "@/components/admin/ui";

// admin「文章管理」タブの root。縦に:
//  ① モデル選択 (バックフィルと個別再生成が共用)
//  ② days 一覧 (お気に入り・個別再生成)
//  ③ 未生成生成パネル (バルク操作は一覧の下にまとめる)
//  ④ 全文章削除パネル — 破壊的操作なので末尾に置く

// refreshKey が変わると DaysList を remount し、既定ビュー (最新が先頭) で
// 再取得させる。写真投稿成功後に最新データを確認させるために使う。
export function PassageManager({ refreshKey = 0 }: { refreshKey?: number }) {
  const [model, setModel] = useState<PassageModelChoice>("opus");

  return (
    <div className="flex flex-col gap-6">
      {/* モデル選択の見た目は写真投稿タブ (PhotoComposer) に揃える */}
      <Card tight>
        <ModelRadio value={model} onChange={setModel} />
      </Card>
      <DaysList key={refreshKey} model={model} />
      <PhotoBackfillPanel only="missing" model={model} />
      {/* 全文章削除パネル — 今後使わないため一旦コメントアウト */}
      {/* <PhotoBackfillPanel only="clear" model={model} /> */}
    </div>
  );
}

export default PassageManager;
