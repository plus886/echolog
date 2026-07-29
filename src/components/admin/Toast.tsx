import { useEffect, useRef, useState } from "react";

// admin 共通のトースト通知。従来は本文の途中に alert を差し込んでいたが、
// レイアウトが押し下げられて周囲が動くうえ、スクロール位置によっては
// 気づけなかった。画面右下 (モバイルは下部中央) に浮かせて自動で消す。
//
// 使い方:
//   const toast = useToast();
//   toast.success("投稿しました");
//   ...
//   <Toaster toast={toast} />
//
// エラーは自動で消さない (対処が必要なので読み落とすと困る)。閉じるボタン
// と次の操作でのみ消える。

const AUTO_DISMISS_MS = 4000;

export type ToastKind = "success" | "error";
export type ToastItem = { id: number; kind: ToastKind; message: string };

export type ToastController = {
  items: ToastItem[];
  success: (message: string) => void;
  error: (message: string) => void;
  dismiss: (id: number) => void;
  clear: () => void;
};

export function useToast(): ToastController {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  // 自動で消す予約。unmount 時に残らないようまとめて破棄する。
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => window.clearTimeout(t));
  }, []);

  const dismiss = (id: number) =>
    setItems((list) => list.filter((t) => t.id !== id));

  const push = (kind: ToastKind, message: string) => {
    const id = nextId.current++;
    setItems((list) => [...list, { id, kind, message }]);
    if (kind === "success") {
      timers.current.push(
        window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS),
      );
    }
  };

  return {
    items,
    success: (message: string) => push("success", message),
    error: (message: string) => push("error", message),
    dismiss,
    clear: () => setItems([]),
  };
}

// トーストの描画先。position: fixed なので配置場所はどこでもよいが、
// 各タブの root 直下に置いて「そのタブが表示中のときだけ出る」ようにする。
export function Toaster({ toast }: { toast: ToastController }) {
  if (toast.items.length === 0) return null;
  return (
    <div
      // aria-live: 操作の結果を読み上げる。fixed + 高 z-index で
      // ダイアログ (Modal) より前面に出す。
      aria-live="polite"
      className="fixed inset-x-4 bottom-4 z-[100] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end"
    >
      {toast.items.map((item) => (
        <div
          key={item.id}
          role={item.kind === "error" ? "alert" : undefined}
          className={`alert w-full max-w-sm shadow-lg ${
            item.kind === "error" ? "alert-error" : "alert-success"
          } text-sm`}
        >
          <span className="flex-1">{item.message}</span>
          <button
            type="button"
            aria-label="閉じる"
            className="btn btn-ghost btn-xs"
            onClick={() => toast.dismiss(item.id)}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
