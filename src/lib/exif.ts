import exifr from "exifr";

// 写真 File から EXIF を読み取る client 専用ヘルパ。
// PhotoComposer (client component) から使う。env.ts / *-management.ts を
// 一切 import しないこと (秘匿キーが client bundle に乗らないように)。

export type PhotoExif = {
  // EXIF の Make + Model を結合した文字列 (例 "RICOH IMAGING COMPANY, LTD. RICOH GR III")
  cameraExif?: string;
  // EXIF の LensModel (無い写真も多い)
  lensExif?: string;
  // EXIF の DateTimeOriginal (撮影日時) を ISO 文字列化したもの
  dateOriginal?: string;
};

// 失敗 (メタデータ無し / 破損 / 未対応形式) は握りつぶして {} を返す。
export async function readPhotoExif(file: File): Promise<PhotoExif> {
  let tags: Record<string, unknown> | null = null;
  try {
    tags = await exifr.parse(file, {
      pick: ["Make", "Model", "LensModel", "DateTimeOriginal"],
    });
  } catch {
    tags = null;
  }
  if (!tags) return {};

  const result: PhotoExif = {};

  const make = typeof tags.Make === "string" ? tags.Make.trim() : "";
  const model = typeof tags.Model === "string" ? tags.Model.trim() : "";
  const camera = [make, model].filter(Boolean).join(" ");
  if (camera) result.cameraExif = camera;

  if (typeof tags.LensModel === "string" && tags.LensModel.trim()) {
    result.lensExif = tags.LensModel.trim();
  }

  // exifr は日付タグを Date に変換して返す。
  const date = tags.DateTimeOriginal;
  if (date instanceof Date && !Number.isNaN(date.getTime())) {
    result.dateOriginal = date.toISOString();
  }

  return result;
}
