import type { ButtonHTMLAttributes } from "react";

// admin 専用の最小 UI ヘルパ。ボタンは DaisyUI の btn をベースにした
// 薄いラッパ。variant を DaisyUI のクラスへマップするだけで、サイズ・
// focus・disabled の挙動は DaisyUI に委ねる。

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "outline" | "ghost" | "danger";

const VARIANT: Record<Variant, string> = {
  primary: "btn-primary",
  outline: "btn-outline",
  ghost: "btn-ghost",
  danger: "btn-error btn-outline",
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
