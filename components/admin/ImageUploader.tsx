"use client";

import Image from "next/image";
import { useRef, useState } from "react";

export const MAX_IMAGES = 4;

type Props = {
  /** 親フォームに反映する。順序は表示順 = 投稿時の順序。 */
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
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <ul
          className={`grid gap-2 ${
            value.length === 1 ? "grid-cols-1" : "grid-cols-2"
          }`}
        >
          {value.map((image, index) => (
            <li
              key={image.url}
              className="relative aspect-video overflow-hidden rounded-md border border-border"
            >
              <Image
                src={image.url}
                alt=""
                fill
                sizes="(max-width: 640px) 100vw, 320px"
                className="object-cover"
                unoptimized
              />
              <button
                type="button"
                onClick={() => handleRemove(index)}
                aria-label="画像を削除"
                className="absolute right-1 top-1 rounded-full bg-foreground/70 px-2 py-0.5 text-xs text-background hover:bg-foreground"
              >
                ✕
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
          className={`rounded-md border border-dashed px-3 py-3 text-center text-xs ${
            isDragOver
              ? "border-foreground/40 bg-foreground/[0.04]"
              : "border-border text-muted"
          }`}
        >
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
            className="hover:underline disabled:opacity-50"
          >
            {isUploading
              ? "アップロード中…"
              : `画像を追加（あと ${remaining} 枚 / 最大 ${MAX_IMAGES} 枚）`}
          </button>
          <span className="ml-2 text-muted">
            ドラッグ&ドロップも可
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

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
