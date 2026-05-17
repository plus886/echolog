import { useRef, useState } from "react";

import { MAX_IMAGES } from "@/lib/constants";

// ComposeForm 内で使う image アップロード UI。/api/uploads に POST する。

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
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-4">
          {value.map((image, index) => (
            <li
              key={image.url}
              className="relative aspect-square overflow-hidden rounded-md bg-(--paper-2)"
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
                className="absolute top-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-(--ink)/85 text-base leading-none text-(--paper) transition-opacity hover:opacity-80"
              >
                ×
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
          className={`flex flex-col items-center gap-1 rounded-md border border-dashed px-4 py-5 text-center text-[13px] transition-colors ${
            isDragOver
              ? "border-(--ink-50) bg-(--paper-2)"
              : "border-(--ink-30)"
          }`}
        >
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
            className="font-medium text-(--ink-70) transition-opacity hover:opacity-60 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isUploading
              ? "アップロード中…"
              : `画像を追加（残り ${remaining}/${MAX_IMAGES}）`}
          </button>
          <span className="text-(--ink-50)">またはここにドロップ</span>
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

      {error && <p className="m-0 text-[13px] text-red-700">{error}</p>}
    </div>
  );
}
