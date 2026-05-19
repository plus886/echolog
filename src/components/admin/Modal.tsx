import { useEffect, type ReactNode } from "react";

import { cx } from "@/components/admin/ui";

// admin のダイアログ共通シェル (DaisyUI modal)。
// modal-open / modal-box / modal-backdrop の定型と Esc キーで閉じる
// 挙動をまとめる。modal-action (ボタン行) は各ダイアログ固有なので
// children 側に置く。closeDisabled が true の間は Esc・バックドロップを
// 無効化する (処理中は閉じさせない)。

type Props = {
  children: ReactNode;
  onClose: () => void;
  closeDisabled?: boolean;
  className?: string;
};

export function Modal({
  children,
  onClose,
  closeDisabled = false,
  className,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !closeDisabled) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [closeDisabled, onClose]);

  return (
    <dialog className="modal modal-open">
      <div className={cx("modal-box flex flex-col gap-3", className)}>
        {children}
      </div>
      <button
        type="button"
        className="modal-backdrop"
        aria-label="閉じる"
        onClick={() => {
          if (!closeDisabled) onClose();
        }}
      />
    </dialog>
  );
}

export default Modal;
