import { useState } from "react";

import { AdminDashboard } from "@/components/admin/AdminDashboard";
import type { ComposeMode } from "@/components/admin/ComposeForm";
import { PhotoComposer } from "@/components/admin/PhotoComposer";
import { cx } from "@/components/admin/ui";
import type { ThreadNode } from "@/lib/thread";

// /admin の最上位 island。ツイート / 写真の 2 タブを束ねる。
//  - ツイートタブ = 従来の AdminDashboard (SSR 済みの一覧データを受け渡す)。
//  - 写真タブ = PhotoComposer (formosa/days への写真投稿)。
// 最後に開いたタブは LocalStorage で記憶する。client:only="react" 前提
// なので useState の初期化子で LocalStorage を読んでも hydration mismatch
// は起きない。
//
// 写真タブは初回に開いた時だけマウントする (それまではスキーマ取得等の
// 副作用を走らせない)。一度マウントしたら以後は hidden トグルで状態を保つ。

type TabKey = "tweet" | "photo";
const TAB_STORAGE_KEY = "echolog-admin-tab";

type Props = {
  initialThreads: ThreadNode[];
  initialRetweetedTargetIds?: string[];
  initialMode?: ComposeMode;
  initialFilter?: "posts" | "drafts";
};

const TABS: readonly [TabKey, string][] = [
  ["tweet", "ツイート"],
  ["photo", "写真"],
];

export function AdminTabs(props: Props) {
  const [tab, setTab] = useState<TabKey>(() => {
    try {
      return localStorage.getItem(TAB_STORAGE_KEY) === "photo"
        ? "photo"
        : "tweet";
    } catch {
      return "tweet";
    }
  });
  // 写真タブを一度でも開いたか。開くまで PhotoComposer はマウントしない。
  const [photoMounted, setPhotoMounted] = useState(tab === "photo");

  const selectTab = (next: TabKey) => {
    setTab(next);
    if (next === "photo") setPhotoMounted(true);
    try {
      localStorage.setItem(TAB_STORAGE_KEY, next);
    } catch {
      // LocalStorage 不可 (プライベートモード等) は無視
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" className="flex gap-1">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => selectTab(key)}
            className={cx(
              "rounded-md px-4 py-2 text-sm font-medium transition-colors",
              tab === key
                ? "bg-(--ink) text-(--paper)"
                : "text-(--ink-50) hover:bg-(--paper-2)",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 両タブを mount したまま hidden トグル: 入力中の状態をタブ切替で
          失わない。写真タブは初回表示まで遅延マウント。 */}
      <div hidden={tab !== "tweet"}>
        <AdminDashboard {...props} />
      </div>
      {photoMounted && (
        <div hidden={tab !== "photo"}>
          <PhotoComposer />
        </div>
      )}
    </div>
  );
}

export default AdminTabs;
