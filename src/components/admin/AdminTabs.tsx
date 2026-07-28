import { useState } from "react";

import { AdminDashboard } from "@/components/admin/AdminDashboard";
import type { ComposeMode } from "@/components/admin/ComposeForm";
import { PassageManager } from "@/components/admin/PassageManager";
import { PhotoComposer } from "@/components/admin/PhotoComposer";
import { ThreadsManager } from "@/components/admin/ThreadsManager";
import type { ThreadNode } from "@/lib/thread";

// /admin の最上位 island。4 タブ (ツイート / 写真投稿 / 文章管理 / Threads)
// を束ねる。
//  - ツイート  = 従来の AdminDashboard (SSR 済みの一覧データを受け渡す)。
//  - 写真投稿  = PhotoComposer (formosa/days への単発写真投稿)。
//  - 文章管理  = PassageManager (バルク文章操作 + days 一覧管理)。
//  - Threads   = ThreadsManager (Threads 接続 + 予約投稿ダッシュボード)。
// 最後に開いたタブは LocalStorage で記憶。client:only="react" 前提なので
// useState 初期化子で LocalStorage を読んでも hydration mismatch は無い。
//
// ツイート以外のタブは初回に開いた時だけマウントする (それまで
// スキーマ取得や一覧 fetch を走らせない)。一度開いたら hidden トグルで保持。

type TabKey = "tweet" | "photo" | "passages" | "threads";
const TAB_STORAGE_KEY = "echolog-admin-tab";

type Props = {
  initialThreads: ThreadNode[];
  initialRetweetedTargetIds?: string[];
  initialMode?: ComposeMode;
  initialFilter?: "posts" | "drafts";
};

const TABS: readonly [TabKey, string][] = [
  ["tweet", "ツイート"],
  ["photo", "写真投稿"],
  ["passages", "文章管理"],
  ["threads", "Threads"],
];

export function AdminTabs(props: Props) {
  const [tab, setTab] = useState<TabKey>(() => {
    try {
      const v = localStorage.getItem(TAB_STORAGE_KEY);
      return v === "photo" || v === "passages" || v === "threads" ? v : "tweet";
    } catch {
      return "tweet";
    }
  });
  const [photoMounted, setPhotoMounted] = useState(tab === "photo");
  const [passagesMounted, setPassagesMounted] = useState(tab === "passages");
  const [threadsMounted, setThreadsMounted] = useState(tab === "threads");
  // インクリメントで DaysList を remount させ、最新データで再取得させる。
  const [daysRefreshKey, setDaysRefreshKey] = useState(0);
  // タブを開き直すたびに増えるキー。マウント済みタブに「表示された」ことを
  // 伝え、Threads の予約状況だけ再取得させる (remount はしない)。
  const [passagesVisitKey, setPassagesVisitKey] = useState(0);
  const [threadsVisitKey, setThreadsVisitKey] = useState(0);

  const selectTab = (next: TabKey) => {
    setTab(next);
    if (next === "photo") setPhotoMounted(true);
    if (next === "passages") {
      if (passagesMounted) setPassagesVisitKey((k) => k + 1);
      setPassagesMounted(true);
    }
    if (next === "threads") {
      if (threadsMounted) setThreadsVisitKey((k) => k + 1);
      setThreadsMounted(true);
    }
    try {
      localStorage.setItem(TAB_STORAGE_KEY, next);
    } catch {
      // LocalStorage 不可 (プライベートモード等) は無視
    }
  };

  // 写真投稿の成功時: 文章管理タブへ移り、一覧を最新化 (DaysList を remount)
  // して投稿済みデータ (最新が先頭) を確認できるようにする。
  const handlePhotoPublished = () => {
    setDaysRefreshKey((k) => k + 1);
    selectTab("passages");
  };

  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" className="tabs tabs-box">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => selectTab(key)}
            className={`tab ${tab === key ? "tab-active" : ""}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 各タブを mount したまま hidden トグル: 入力中の状態をタブ切替で
          失わない。写真投稿・文章管理は初回表示まで遅延マウント。 */}
      <div hidden={tab !== "tweet"}>
        <AdminDashboard {...props} />
      </div>
      {photoMounted && (
        <div hidden={tab !== "photo"}>
          <PhotoComposer onPublished={handlePhotoPublished} />
        </div>
      )}
      {passagesMounted && (
        <div hidden={tab !== "passages"}>
          <PassageManager
            refreshKey={daysRefreshKey}
            threadsRefreshKey={passagesVisitKey}
          />
        </div>
      )}
      {threadsMounted && (
        <div hidden={tab !== "threads"}>
          <ThreadsManager refreshKey={threadsVisitKey} />
        </div>
      )}
    </div>
  );
}

export default AdminTabs;
