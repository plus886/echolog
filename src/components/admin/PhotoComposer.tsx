import { actions } from "astro:actions";
import { useEffect, useRef, useState, useTransition } from "react";

import {
  ModelRadio,
  type PassageModelChoice,
} from "@/components/admin/ModelRadio";
import { Button, Card, ErrorAlert } from "@/components/admin/ui";
import { readPhotoExif, type PhotoExif } from "@/lib/exif";

// 写真投稿タブの本体。formosa-chiaroscuro の days エンドポイントへ写真を
// POST する。camera / lens の選択肢は写真タブ初回表示時に microCMS の
// スキーマ API から取得する。アップロード時に Claude が文章 (passageJa /
// passageZh) を生成し、写真と一緒に投稿する。一覧表示は持たない。

type Schema = { camera: string[]; lens: string[] };
type SchemaState = "loading" | "ready" | "error";
type PublishResult = { id: string; passageJa: string; passageZh: string };

const ACCEPT_MIME = "image/jpeg,image/png,image/webp";

export function PhotoComposer() {
  const [schema, setSchema] = useState<Schema | null>(null);
  const [schemaState, setSchemaState] = useState<SchemaState>("loading");

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // null = EXIF 未読 / オブジェクト = 読み取り完了 ({} はメタデータ無し)
  const [exif, setExif] = useState<PhotoExif | null>(null);

  const [camera, setCamera] = useState("");
  const [lens, setLens] = useState("");
  // 文章生成時に Claude へ渡す留意事項 (任意・単発投稿のみ)。
  const [notes, setNotes] = useState("");

  // 文章生成モデル。写真タブ全体で共通。既定 Opus。
  const [model, setModel] = useState<PassageModelChoice>("opus");

  const [isDetecting, startDetect] = useTransition();
  const [detectNotice, setDetectNotice] = useState<string | null>(null);

  const [isPublishing, startPublish] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PublishResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // スキーマ取得 (写真タブ初回表示時 = このコンポーネントの mount 時)。
  const loadSchema = () => {
    setSchemaState("loading");
    void (async () => {
      const res = await actions.fetchDaysSchema();
      if (res.error || !res.data) {
        setSchemaState("error");
      } else {
        setSchema(res.data);
        setSchemaState("ready");
      }
    })();
  };
  useEffect(() => {
    loadSchema();
  }, []);

  // preview の objectURL を後始末する。
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFile = async (next: File | null) => {
    setError(null);
    setResult(null);
    setDetectNotice(null);
    setExif(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (!next) {
      setFile(null);
      setPreviewUrl(null);
      return;
    }
    setFile(next);
    setPreviewUrl(URL.createObjectURL(next));
    setExif(await readPhotoExif(next));
  };

  const handleDetect = () => {
    if (!file || !schema || isDetecting) return;
    setDetectNotice(null);
    setError(null);
    startDetect(async () => {
      const res = await actions.matchPhotoExif({
        cameraExif: exif?.cameraExif,
        lensExif: exif?.lensExif,
        cameraOptions: schema.camera,
        lensOptions: schema.lens,
      });
      if (res.error || !res.data) {
        setDetectNotice(res.error?.message ?? "EXIF からの判定に失敗しました");
        return;
      }
      if (res.data.camera) setCamera(res.data.camera);
      if (res.data.lens) setLens(res.data.lens);

      const notices: string[] = [];
      if (!res.data.camera) notices.push("カメラを判定できませんでした");
      if (!exif?.lensExif) notices.push("レンズ情報がありません");
      else if (!res.data.lens) notices.push("レンズを判定できませんでした");
      setDetectNotice(
        notices.length ? notices.join(" / ") : "EXIF から判定しました",
      );
    });
  };

  const handlePublish = () => {
    if (!file || !camera || isPublishing) return;
    setError(null);
    const fd = new FormData();
    fd.set("image", file);
    fd.set("camera", camera);
    if (lens) fd.set("lens", lens);
    if (exif?.dateOriginal) fd.set("date", exif.dateOriginal);
    fd.set("model", model);
    if (notes.trim()) fd.set("notes", notes.trim());
    startPublish(async () => {
      const res = await actions.publishPhoto(fd);
      if (res.error || !res.data) {
        setError(res.error?.message ?? "投稿に失敗しました");
        return;
      }
      setResult({
        id: res.data.id,
        passageJa: res.data.passageJa,
        passageZh: res.data.passageZh,
      });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setFile(null);
      setPreviewUrl(null);
      setExif(null);
      setCamera("");
      setLens("");
      setNotes("");
      setDetectNotice(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  };

  const selectsDisabled = schemaState !== "ready";
  const detectDisabled =
    !file || exif === null || selectsDisabled || isDetecting;
  const publishDisabled = !file || !camera || isPublishing;

  return (
    <div className="flex flex-col gap-6">
      {/* 文章生成モデル — この単発投稿で使うモデル */}
      <Card tight>
        <ModelRadio value={model} onChange={setModel} />
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="m-0 text-sm font-semibold">写真を投稿</h2>

        {/* 画像ピッカー */}
        <div className="flex flex-col gap-2">
          <label className="text-[13px] font-medium text-base-content/70">
            写真
          </label>
          {previewUrl && (
            <img
              src={previewUrl}
              alt=""
              className="max-h-72 w-full rounded-md border border-base-300 object-contain"
            />
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT_MIME}
            onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
            className="file-input file-input-bordered w-full"
          />
        </div>

        {/* EXIF 検出 */}
        <div className="flex flex-col gap-1.5">
          <Button
            variant="outline"
            onClick={handleDetect}
            disabled={detectDisabled}
          >
            {isDetecting ? "判定中…" : "EXIF 検出"}
          </Button>
          {detectNotice && (
            <p className="m-0 text-[13px] text-base-content/50">
              {detectNotice}
            </p>
          )}
        </div>

        {/* camera / lens */}
        {schemaState === "error" ? (
          <div className="alert alert-error text-[13px]">
            <span>フィールド情報の取得に失敗しました。</span>
            <button type="button" className="btn btn-sm" onClick={loadSchema}>
              再試行
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-[13px] font-medium text-base-content/70">
              カメラ
              <select
                value={camera}
                onChange={(e) => setCamera(e.target.value)}
                disabled={selectsDisabled}
                className="select select-bordered w-full"
              >
                <option value="">
                  {schemaState === "loading"
                    ? "読み込み中…"
                    : "選択してください"}
                </option>
                {schema?.camera.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-[13px] font-medium text-base-content/70">
              レンズ（任意）
              <select
                value={lens}
                onChange={(e) => setLens(e.target.value)}
                disabled={selectsDisabled}
                className="select select-bordered w-full"
              >
                <option value="">なし</option>
                {schema?.lens.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {/* 留意事項 — 文章生成時に Claude へ渡す補足 (任意) */}
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-base-content/70">
          留意事項（任意）
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="例: 写っているのは私の妻と義母。それを前提に書いてほしい。"
            className="textarea textarea-bordered w-full resize-y"
          />
          <span className="text-[12px] font-normal text-base-content/50">
            文章生成時に Claude へ渡されます。
          </span>
        </label>

        {error && <ErrorAlert>{error}</ErrorAlert>}

        <div className="flex justify-end">
          <Button onClick={handlePublish} disabled={publishDisabled}>
            {isPublishing ? "アップロード中…" : "アップロード"}
          </Button>
        </div>
      </Card>

      {result && (
        <Card className="flex flex-col gap-2 text-[13px]">
          <div className="alert alert-success text-sm">
            <span>写真を投稿しました。</span>
          </div>
          <p className="m-0 text-[12px] tracking-wide text-base-content/50">
            生成された文章（microCMS で確認・手直しできます）
          </p>
          <p className="m-0 whitespace-pre-wrap text-base-content/70">
            <span className="text-base-content/50">JA</span> {result.passageJa}
          </p>
          <p className="m-0 whitespace-pre-wrap text-base-content/70">
            <span className="text-base-content/50">ZH</span> {result.passageZh}
          </p>
        </Card>
      )}
    </div>
  );
}

export default PhotoComposer;
