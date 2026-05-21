// アップロード前にブラウザ側で画像を縮小・再圧縮するヘルパー。
// iPhone のライブラリ写真 (48MP / Live Photo 由来など) はそのまま送ると
// 数十 MB になり、サーバの上限 (PHOTO_MAX_BYTES) を超えて投稿が失敗する。
// microCMS は配信時に ?w=N で変換するため、原本を高解像度で持つ必要は
// なく、長辺 ~2048px / JPEG q85 で十分。
//
// client component (PhotoComposer) からのみ呼ぶ。サーバには持ち込まない
// (createImageBitmap / canvas は browser API)。

const DEFAULT_MAX_EDGE = 2048;
const JPEG_QUALITY = 0.85;

// 指定 File をデコードし、長辺が maxEdge 以下になるよう縮小、JPEG として
// 再エンコードして新しい File を返す。原本が既に十分小さい場合は原本を
// そのまま返す (再エンコードで画質を落とさない)。
export async function resizeImageForUpload(
  file: File,
  maxEdge: number = DEFAULT_MAX_EDGE,
): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const longest = Math.max(bitmap.width, bitmap.height);
  const scale = longest > maxEdge ? maxEdge / longest : 1;

  // 既に小さければ何もしない (元の MIME / 画質を保つ)。
  if (scale === 1) {
    bitmap.close?.();
    return file;
  }

  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close?.();
    throw new Error("canvas 2d context unavailable");
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  if (!blob) throw new Error("canvas toBlob failed");

  // 拡張子を .jpg に置き換えて File として返す。
  const stem = file.name.replace(/\.[^.]+$/, "") || "photo";
  return new File([blob], `${stem}.jpg`, { type: "image/jpeg" });
}
