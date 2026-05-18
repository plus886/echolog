import { actions } from "astro:actions";
import { useEffect, useRef, useState } from "react";

import type { PassageModelChoice } from "@/components/admin/PhotoComposer";
import { Button } from "@/components/admin/ui";

// 写真タブの文章管理パネル。2 つの操作を持つ:
//  - 未生成を生成: passageJa が空の days だけに文章を後付け生成する。
//    失敗写真は passageJa[not_exists] フィルタに残るので、累積失敗数だけ
//    offset を進めて 1 回の実行中はスキップ (再クリックで拾い直す)。
//  - 全文章を削除: 全 days の passage を空にする (Claude 呼び出し無し。
//    フィルタ無しなので単純な offset ページングで全件を 1 度ずつ処理)。
// どちらも client がチャンク単位でアクションを呼び続ける。

type Phase = "loading" | "idle" | "running" | "error";
type Mode = "missing" | "clear";
type Progress = { done: number; total: number; failed: number };

export function PhotoBackfillPanel({ model }: { model: PassageModelChoice }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [remaining, setRemaining] = useState(0);
  const [total, setTotal] = useState(0);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [runningMode, setRunningMode] = useState<Mode | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef(false);

  const refreshStatus = async () => {
    const res = await actions.photoBackfillStatus();
    if (res.error || !res.data) {
      setError(res.error?.message ?? "件数の取得に失敗しました");
      setPhase("error");
      return;
    }
    setRemaining(res.data.remaining);
    setTotal(res.data.total);
    setPhase("idle");
  };

  useEffect(() => {
    void refreshStatus();
  }, []);

  const run = async (mode: Mode) => {
    stopRef.current = false;
    setError(null);
    setNotice(null);
    setRunningMode(mode);
    setProgress({
      done: 0,
      total: mode === "missing" ? remaining : total,
      failed: 0,
    });
    setPhase("running");

    let offset = 0;
    let knownTotal = -1;
    let failedCum = 0;

    while (!stopRef.current) {
      if (mode === "missing") {
        const res = await actions.backfillPhotoPassages({ offset, model });
        if (res.error || !res.data) {
          setError(res.error?.message ?? "処理に失敗しました");
          setPhase("error");
          return;
        }
        const d = res.data;
        if (knownTotal < 0) knownTotal = d.totalRemaining;
        failedCum += d.failed;
        // 失敗写真はフィルタに残るので offset を進めてスキップする。
        offset += d.failed;
        setProgress({
          done: knownTotal - d.totalRemaining + d.processed,
          total: knownTotal,
          failed: failedCum,
        });
        if (d.done) break;
      } else {
        // 全文章削除。フィルタ無しの単純な offset ページング。
        const res = await actions.clearPhotoPassages({ offset });
        if (res.error || !res.data) {
          setError(res.error?.message ?? "処理に失敗しました");
          setPhase("error");
          return;
        }
        const d = res.data;
        knownTotal = d.total;
        failedCum += d.failed;
        // チャンク長ぶん offset を進めて全件を 1 度ずつ通る。
        offset += d.processed + d.failed;
        setProgress({ done: offset, total: knownTotal, failed: failedCum });
        if (d.done) break;
      }
    }

    setRunningMode(null);
    setNotice(
      stopRef.current
        ? `停止しました（失敗 ${failedCum} 件）`
        : `完了しました（失敗 ${failedCum} 件）`,
    );
    setProgress(null);
    await refreshStatus();
  };

  const confirmClear = () => {
    const ok = window.confirm(
      `全 ${total} 件の写真から文章 (passageJa / passageZh) を削除します。\n` +
        `この操作は取り消せません。続けますか?`,
    );
    if (ok) void run("clear");
  };

  if (phase === "loading") {
    return (
      <section className="rounded-lg border border-(--ink-15) bg-(--paper) p-4 text-sm text-(--ink-50) sm:p-5">
        件数を確認中…
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-(--ink-15) bg-(--paper) p-4 sm:p-5">
      <h2 className="m-0 text-sm font-semibold text-(--ink)">写真の文章管理</h2>

      {phase === "error" && (
        <>
          <p className="m-0 rounded-md bg-red-50 px-3 py-2 text-[13px] text-red-700">
            {error}
          </p>
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setPhase("loading");
                void refreshStatus();
              }}
            >
              再試行
            </Button>
          </div>
        </>
      )}

      {phase === "running" && progress && (
        <>
          <p className="m-0 text-[13px] text-(--ink-70)">
            {runningMode === "clear" ? "文章を削除中…" : "文章を生成中…"} 完了{" "}
            {progress.done} / {progress.total}
            {progress.failed > 0 && `（失敗 ${progress.failed}）`}
          </p>
          <p className="m-0 text-[12px] text-(--ink-50)">
            このタブを閉じると中断します。
          </p>
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => {
                stopRef.current = true;
              }}
            >
              停止
            </Button>
          </div>
        </>
      )}

      {phase === "idle" && (
        <>
          {notice && (
            <p className="m-0 text-[13px] text-(--ink-70)">{notice}</p>
          )}

          {/* 未生成のみ生成 */}
          <div className="flex flex-col gap-1.5">
            <p className="m-0 text-[13px] text-(--ink-70)">
              {remaining === 0
                ? "未生成の写真はありません。"
                : `文章が未生成の写真: ${remaining} 件`}
            </p>
            {remaining > 0 && (
              <div className="flex justify-end">
                <Button onClick={() => void run("missing")}>
                  未生成を生成
                </Button>
              </div>
            )}
          </div>

          {/* 全文章を削除 */}
          <div className="flex flex-col gap-1.5 border-t border-(--ink-15) pt-3">
            <p className="m-0 text-[13px] text-(--ink-70)">
              全 {total} 件の文章を削除する。
            </p>
            <p className="m-0 text-[12px] text-(--ink-50)">
              passageJa / passageZh を空にします。取り消せません。
            </p>
            <div className="flex justify-end">
              <Button variant="danger" onClick={confirmClear}>
                全文章を削除
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export default PhotoBackfillPanel;
