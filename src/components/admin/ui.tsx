import type { ButtonHTMLAttributes } from "react";

// admin 専用の最小 UI ヘルパ。shadcn は使わず Tailwind v4 直書きで実用本位。
// 配色は既存の --ink / --paper トークンを流用する。

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "outline" | "ghost" | "danger";

const VARIANT: Record<Variant, string> = {
  primary: "bg-(--ink) text-(--paper) hover:opacity-85",
  outline: "border border-(--ink-30) text-(--ink-70) hover:bg-(--paper-2)",
  ghost: "text-(--ink-70) hover:bg-(--paper-2)",
  danger: "border border-red-300 text-red-700 hover:bg-red-50",
};

// 実用本位のボタン。タップ領域確保のため min-h-10 (40px)。
export function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type={type}
      className={cx(
        "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md px-4 text-sm font-medium transition-colors",
        "focus-visible:ring-2 focus-visible:ring-(--ink-30) focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-40",
        VARIANT[variant],
        className,
      )}
      {...props}
    />
  );
}
