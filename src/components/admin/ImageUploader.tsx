import { useRef, useState } from "react";

import { MAX_IMAGES } from "@/lib/constants";

// ComposeForm 内で使う image アップロード UI。Island 境界の内側なので
// 親 (ComposeForm) と一緒に hydrate される。
//
// Astro 移植版。差分:
//  - next/image → 素の <img> (R2 配信なら img src で十分。Astro の
//    astro:assets は build-time 変換のため動的 microCMS URL では使えない)
//  - "use client" 削除 (Astro 規約)
//  - その他、fetch("/api/uploads") 経由の挙動は同一

type Props = {
  value: { url: string }[];
  onChange: (next: { url: string }[]) => void;
};

export function ImageUploader({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setDragOver] = useState(false);
  const [isUploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = MAX_IMAGES - value.length;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const incoming = Array.from(files).slice(0, remaining);
    if (incoming.length === 0) return;

    setError(null);
    setUploading(true);
    const uploaded: { url: string }[] = [];
    try {
      for (const file of incoming) {
        const formData = new FormData();
        formData.set("file", file);
        const res = await fetch("/api/uploads", {
          method: "POST",
          body: formData,
        });
        const data = (await res.json()) as
          | { url: string }
          | { error: string; message?: string };
        if (!res.ok || !("url" in data)) {
          throw new Error(
            "error" in data
              ? `${data.error}${data.message ? `: ${data.message}` : ""}`
              : "アップロードに失敗しました",
          );
        }
        uploaded.push({ url: data.url });
      }
      onChange([...value, ...uploaded]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "アップロードに失敗しました");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col gap-3">
      {value.length > 0 && (
        <ul
          className={`m-0 grid list-none gap-2 p-0 ${
            value.length === 1 ? "grid-cols-1" : "grid-cols-2"
          }`}
        >
          {value.map((image, index) => (
            <li
              key={image.url}
              className="relative aspect-video overflow-hidden bg-(--paper-2)"
            >
              <img
                src={image.url}
                alt=""
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => handleRemove(index)}
                aria-label="画像を削除"
                className="absolute right-2 top-2 bg-(--ink)/80 px-2 py-0.5 text-[11px] uppercase tracking-[0.1em] text-(--paper) transition-opacity hover:opacity-80"
              >
                remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {remaining > 0 && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void handleFiles(e.dataTransfer.files);
          }}
          className={`border border-dashed px-4 py-4 text-center text-[12px] ${
            isDragOver
              ? "border-(--ink-50) bg-(--paper-2)"
              : "border-(--ink-15) text-(--ink-50)"
          }`}
        >
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
            className="lowercase tracking-[0.04em] text-(--ink-70) transition-opacity hover:opacity-60 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isUploading
              ? "uploading…"
              : `add image (${remaining} of ${MAX_IMAGES} remaining)`}
          </button>
          <span className="ml-3 italic text-(--ink-50)">
            or drop a file here
          </span>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            multiple
            hidden
            onChange={(e) => void handleFiles(e.target.files)}
          />
        </div>
      )}

      {error && <p className="k-form-error">{error}</p>}
    </div>
  );
}
