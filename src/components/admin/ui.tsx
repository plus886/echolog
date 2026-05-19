import type { ButtonHTMLAttributes, ReactNode } from "react";

// admin 専用の最小 UI ヘルパ。ボタンは DaisyUI の btn をベースにした
// 薄いラッパ。variant を DaisyUI のクラスへマップするだけで、サイズ・
// focus・disabled の挙動は DaisyUI に委ねる。Card / ErrorAlert は
// admin で繰り返し使うラッパの共通化。

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "outline" | "ghost" | "danger" | "neutral";

const VARIANT: Record<Variant, string> = {
  primary: "btn-primary",
  outline: "btn-outline",
  ghost: "btn-ghost",
  danger: "btn-error btn-outline",
  // 色なしの素の btn (DaisyUI 既定)。閉じる・ページ送りなど。
  neutral: "",
};

// DaisyUI btn の薄いラッパ。呼び出し側は従来どおり variant を渡すだけ。
export function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type={type}
      className={cx("btn", VARIANT[variant], className)}
      {...props}
    />
  );
}

// admin のセクション/カードの共通ラッパ。paper 地・境界線・角丸。
// tight は ModelRadio など行の低い内容向けの控えめパディング。
// padding は Tailwind の p-4 / px-4 py-3 競合を避けるため prop で分岐し、
// className には渡さない (レイアウト系クラスのみ className で足す)。
export function Card({
  children,
  className,
  tight = false,
}: {
  children: ReactNode;
  className?: string;
  tight?: boolean;
}) {
  return (
    <div
      className={cx(
        "rounded-lg border border-base-300 bg-base-100",
        tight ? "px-4 py-3 sm:px-5" : "p-4 sm:p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

// 単一メッセージのエラー表示 (DaisyUI alert)。再試行ボタン等を内包する
// 複合的なエラー UI には使わず、その場合は各所でインライン実装する。
export function ErrorAlert({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("alert alert-error text-sm", className)}>
      <span>{children}</span>
    </div>
  );
}
