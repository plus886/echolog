import { actions } from "astro:actions";
import { useEffect, useState } from "react";

import type { PassageModelChoice } from "@/components/admin/ModelRadio";
import { PassageDialog } from "@/components/admin/PassageDialog";
import { formatTaipei } from "@/lib/taipei-time";
import {
  CHANNEL_LABEL,
  isThreadsChannel,
  THREADS_CHANNELS,
} from "@/lib/threads-channels";
import type { Day } from "@/types/microcms";

// days 一覧の 1 行 (DaisyUI card)。サムネイル + passageJa/Zh +
// お気に入りトグル + 文章の手編集 + 再生成 + Threads 予約。

// この day の Threads 予約状況 (チャンネルごと 1 件。DaysList がページ
// 単位でまとめて取得)。
export type ThreadsDayInfo = {
  channel: string;
  status: string;
  scheduledAt: string;
  publishedAt: string | null;
};

type Props = {
  day: Day;
  model: PassageModelChoice;
  // 再生成ダイアログでモデルを変えたらタブ上部の選択にも反映する。
  onModelChange: (model: PassageModelChoice) => void;
  threads: ThreadsDayInfo[];
  onThreadsEnqueued: (dayId: string, infos: ThreadsDayInfo[]) => void;
};

function channelLabel(channel: string): string {
  return isThreadsChannel(channel) ? CHANNEL_LABEL[channel] : channel;
}

export function DayRow({
  day,
  model,
  onModelChange,
  threads,
  onThreadsEnqueued,
}: Props) {
  const [featured, setFeatured] = useState(Boolean(day.featured));
  const [favBusy, setFavBusy] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [threadsBusy, setThreadsBusy] = useState(false);
  const [threadsError, setThreadsError] = useState<string | null>(null);
  // スキップされたチャンネルの理由 (エラーではなく注記)。
  const [threadsNote, setThreadsNote] = useState<string | null>(null);

  // 表示中の文章。再生成 (onChanged → 親が再取得) で day prop が
  // 更新されたら同期する。
  const [passages, setPassages] = useState({
    ja: day.passageJa ?? "",
    zh: day.passageZh ?? "",
  });
  useEffect(() => {
    setPassages({ ja: day.passageJa ?? "", zh: day.passageZh ?? "" });
  }, [day.passageJa, day.passageZh]);

  // 手編集モード。draft* は編集中のバッファ。
  const [editing, setEditing] = useState(false);
  const [draftJa, setDraftJa] = useState("");
  const [draftZh, setDraftZh] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const toggleFavorite = async () => {
    if (favBusy) return;
    const next = !featured;
    setFeatured(next); // 楽観更新
    setFavBusy(true);
    const res = await actions.setDayFeatured({ id: day.id, featured: next });
    setFavBusy(false);
    if (res.error) {
      setFeatured(!next); // 失敗 → 元に戻す
    }
  };

  const startEdit = () => {
    setDraftJa(passages.ja);
    setDraftZh(passages.zh);
    setSaveError(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    if (saveBusy) return;
    setEditing(false);
    setSaveError(null);
  };

  // Threads 予約 (1 操作で中文 + 日本語の 2 チャンネルに積む)。投稿済み
  // チャンネルの再予約だけ確認を挟む (意図的な再投稿かもしれないので禁止
  // まではしない)。未生成・未接続・予約済みのチャンネルはサーバ側で
  // スキップされ、理由が返る (threadsNote に表示)。
  const enqueueThreads = async () => {
    if (threadsBusy) return;
    const published = threads.filter((t) => t.status === "published");
    if (
      published.length > 0 &&
      !window.confirm(
        `この写真は Threads 投稿済み（${published
          .map((t) => channelLabel(t.channel))
          .join("・")}）です。もう一度予約しますか？`,
      )
    ) {
      return;
    }
    setThreadsBusy(true);
    setThreadsError(null);
    setThreadsNote(null);
    const res = await actions.threadsEnqueue({ dayId: day.id });
    setThreadsBusy(false);
    if (res.error || !res.data) {
      setThreadsError(res.error?.message ?? "予約に失敗しました");
      return;
    }
    onThreadsEnqueued(
      day.id,
      res.data.posts.map((p) => ({
        channel: p.channel,
        status: "scheduled",
        scheduledAt: p.scheduledAt,
        publishedAt: null,
      })),
    );
    if (res.data.skipped.length > 0) {
      setThreadsNote(
        res.data.skipped.map((s) => `${s.label}: ${s.reason}`).join(" / "),
      );
    }
  };

  // 全チャンネルがアクティブ (予約中/実行中) なら予約ボタンは出さない。
  const activeThreads = threads.filter(
    (t) => t.status === "scheduled" || t.status === "publishing",
  );
  const allChannelsActive = activeThreads.length >= THREADS_CHANNELS.length;

  const save = async () => {
    if (saveBusy) return;
    setSaveBusy(true);
    setSaveError(null);
    const res = await actions.updateDayPassages({
      id: day.id,
      passageJa: draftJa,
      passageZh: draftZh,
    });
    setSaveBusy(false);
    if (res.error || !res.data) {
      setSaveError(res.error?.message ?? "文章の保存に失敗しました");
      return;
    }
    setPassages({ ja: res.data.passageJa, zh: res.data.passageZh });
    setEditing(false);
  };

  return (
    <div className="card card-border bg-base-100">
      {/* 縦積み: 上段にサムネイル + 操作ボタン、下段に passage を全幅で。
          card-body は既定で flex-col。横並びにすると狭幅で本文が
          1 文字幅に潰れるため縦積みにする。 */}
      <div className="card-body gap-2 p-3 sm:p-4">
        <div className="flex items-center gap-3">
          {/* サムネイルは本番ギャラリーの該当ページへのリンク */}
          <a
            href={`https://photo.kokaiji.tw/days/${day.id}`}
            target="_blank"
            rel="noreferrer"
            className="flex-none"
          >
            <img
              src={`${day.image.url}?w=160&fm=webp`}
              alt=""
              className="h-14 w-14 rounded-md object-cover"
            />
          </a>
          <div className="flex-1" />
          {/* Threads 予約状況 (チャンネルごとのバッジ)。アクティブな予約の
              取消・日時変更は Threads タブから。 */}
          {threads.map((t) => {
            const label = channelLabel(t.channel);
            if (t.status === "scheduled" || t.status === "publishing") {
              return (
                <span
                  key={t.channel}
                  className="badge badge-info badge-sm whitespace-nowrap"
                >
                  {label} {formatTaipei(t.scheduledAt)}
                </span>
              );
            }
            if (t.status === "published") {
              return (
                <span
                  key={t.channel}
                  className="badge badge-success badge-sm whitespace-nowrap"
                >
                  {label}済
                </span>
              );
            }
            if (t.status === "failed") {
              return (
                <span
                  key={t.channel}
                  className="badge badge-error badge-sm whitespace-nowrap"
                >
                  {label}失敗
                </span>
              );
            }
            return null; // deleted はバッジを出さない (再予約可)
          })}
          {!allChannelsActive && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => void enqueueThreads()}
              disabled={
                threadsBusy || editing || (!passages.zh && !passages.ja)
              }
              title={
                passages.zh || passages.ja
                  ? undefined
                  : "文章が未生成のため予約できません"
              }
            >
              {threadsBusy ? "予約中…" : "Threads予約"}
            </button>
          )}
          <button
            type="button"
            onClick={() => void toggleFavorite()}
            disabled={favBusy}
            aria-pressed={featured}
            aria-label="お気に入り"
            className={`btn btn-ghost btn-sm btn-circle text-lg ${
              featured ? "text-amber-500" : "text-base-content/40"
            }`}
          >
            {featured ? "★" : "☆"}
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={startEdit}
            disabled={editing}
          >
            編集
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setDialogOpen(true)}
            disabled={editing}
          >
            再生成
          </button>
        </div>

        {threadsError && (
          <p className="m-0 text-xs text-error">{threadsError}</p>
        )}
        {threadsNote && (
          <p className="m-0 text-xs text-warning">{threadsNote}</p>
        )}

        {editing ? (
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1 text-xs font-medium opacity-60">
              JA
              <textarea
                className="textarea textarea-bordered w-full text-sm"
                rows={2}
                value={draftJa}
                onChange={(e) => setDraftJa(e.target.value)}
                disabled={saveBusy}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium opacity-60">
              ZH
              <textarea
                className="textarea textarea-bordered w-full text-sm"
                rows={4}
                value={draftZh}
                onChange={(e) => setDraftZh(e.target.value)}
                disabled={saveBusy}
              />
            </label>
            {saveError && <p className="m-0 text-sm text-error">{saveError}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={cancelEdit}
                disabled={saveBusy}
              >
                キャンセル
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => void save()}
                disabled={saveBusy}
              >
                {saveBusy ? "保存中…" : "保存"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="m-0 text-sm whitespace-pre-wrap">
              <span className="opacity-50">JA</span>{" "}
              {passages.ja || <span className="opacity-50">（未生成）</span>}
            </p>
            <p className="m-0 text-sm whitespace-pre-wrap">
              <span className="opacity-50">ZH</span>{" "}
              {passages.zh || <span className="opacity-50">（未生成）</span>}
            </p>
          </>
        )}
      </div>

      {dialogOpen && (
        <PassageDialog
          title="文章を再生成"
          imageUrl={day.image.url}
          model={model}
          onModelChange={onModelChange}
          adoptLabel="採用"
          onAdopt={async (p) => {
            const res = await actions.updateDayPassages({
              id: day.id,
              passageJa: p.passageJa,
              passageZh: p.passageZh,
            });
            if (res.error || !res.data) {
              return res.error?.message ?? "採用に失敗しました";
            }
            // 保存された内容でこの行だけ書き換える (一覧の再取得はしない)。
            setPassages({ ja: res.data.passageJa, zh: res.data.passageZh });
            return null;
          }}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </div>
  );
}

export default DayRow;
