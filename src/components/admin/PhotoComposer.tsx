import { actions } from "astro:actions";
import { useEffect, useRef, useState, useTransition } from "react";

import {
  ModelRadio,
  type PassageModelChoice,
} from "@/components/admin/ModelRadio";
import { PassageDialog } from "@/components/admin/PassageDialog";
import { Button, Card, ErrorAlert } from "@/components/admin/ui";
import { readPhotoExif, type PhotoExif } from "@/lib/exif";
import { resizeImageForUpload } from "@/lib/image-resize";

// 写真投稿タブの本体。formosa-chiaroscuro の days エンドポイントへ写真を
// POST する。camera / lens の選択肢は写真タブ初回表示時に microCMS の
// スキーマ API から取得する。一覧表示は持たない。
//
// 投稿は 2 段階。「アップロードして生成」で画像をアップロードし Claude が
// 文章を生成するところまで進み (preparePhoto)、PassageDialog で確認・再生成
// してから「投稿」で初めて days に作成する (publishPhoto)。既存写真の再生成
// と同じ体験に揃えてある。

type LocationOption = { id: string; nameJa: string; cityJa: string };
type Schema = {
  camera: string[];
  lens: string[];
  locations: LocationOption[];
};
type SchemaState = "loading" | "ready" | "error";

// 撮影地を市ごとの optgroup にまとめる (件数が多いので探しやすくする)。
// 市が空のものは末尾の「その他」へ。並びは microCMS の返す順を保つ。
function groupByCity(
  locations: LocationOption[],
): [string, LocationOption[]][] {
  const groups = new Map<string, LocationOption[]>();
  for (const loc of locations) {
    const city = loc.cityJa || "その他";
    const arr = groups.get(city);
    if (arr) arr.push(loc);
    else groups.set(city, [loc]);
  }
  return [...groups.entries()];
}
// アップロード済み画像 + 生成された文章・代替テキスト (まだ投稿していない)。
type Prepared = {
  imageUrl: string;
  passageJa: string;
  passageZh: string;
  altJa: string;
  altZh: string;
};

const ACCEPT_MIME = "image/jpeg,image/png,image/webp";

export function PhotoComposer({
  onPublished,
}: {
  // 投稿成功時に親へ通知する (文章管理タブへ自動遷移させる)。
  onPublished?: () => void;
}) {
  const [schema, setSchema] = useState<Schema | null>(null);
  const [schemaState, setSchemaState] = useState<SchemaState>("loading");

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // null = EXIF 未読 / オブジェクト = 読み取り完了 ({} はメタデータ無し)
  const [exif, setExif] = useState<PhotoExif | null>(null);

  const [camera, setCamera] = useState("");
  const [lens, setLens] = useState("");
  // 撮影地 (locations のコンテンツ ID)。任意。空文字 = 未選択。
  const [location, setLocation] = useState("");
  // 文章生成時に Claude へ渡す留意事項 (任意・単発投稿のみ)。
  const [notes, setNotes] = useState("");

  // 文章生成モデル。写真タブ全体で共通。既定 Fable。
  const [model, setModel] = useState<PassageModelChoice>("fable");

  // 投稿後に Threads の予約キューへ積むか。既定 off (明示的に選ばせる)。
  // 選択はフォームリセット後も引き継ぐ (連続投稿で毎回入れ直さずに済む)。
  const [enqueueThreads, setEnqueueThreads] = useState(false);
  // 予約が一部/全部通らなかったときの注記 (投稿自体は成功している)。
  const [queueNotice, setQueueNotice] = useState<string | null>(null);

  const [isDetecting, startDetect] = useTransition();
  const [detectNotice, setDetectNotice] = useState<string | null>(null);

  const [isPreparing, startPrepare] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<Prepared | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // スキーマ取得 (写真タブ初回表示時 = このコンポーネントの mount 時)。
  const loadSchema = () => {
    setSchemaState("loading");
    void (async () => {
      const res = await actions.fetchPhotoFormOptions();
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

  // 画像をアップロードして文章を 1 案生成するところまで。まだ投稿しない。
  const handlePrepare = () => {
    if (!file || !camera || isPreparing) return;
    setError(null);
    setQueueNotice(null); // 前回の投稿の注記を残さない
    startPrepare(async () => {
      // iPhone のライブラリ写真は数十 MB ある場合がありサーバ上限を超える。
      // microCMS は配信時に ?w=N で変換するので、長辺 2048px に縮小して送る。
      // EXIF は handleFile 時点で原本から取得済みなので影響なし。
      let uploadFile: File;
      try {
        uploadFile = await resizeImageForUpload(file);
      } catch (e) {
        console.error("[photo] resize failed", e);
        setError("画像の前処理に失敗しました");
        return;
      }
      const fd = new FormData();
      fd.set("image", uploadFile);
      fd.set("model", model);
      if (notes.trim()) fd.set("notes", notes.trim());
      // 撮影地は alt 生成で確定情報として使う (未選択なら地名は書かれない)。
      if (location) fd.set("location", location);
      const res = await actions.preparePhoto(fd);
      if (res.error || !res.data) {
        setError(res.error?.message ?? "アップロードに失敗しました");
        return;
      }
      // 生成結果を PassageDialog で確認・再生成してもらう。
      setPrepared(res.data);
    });
  };

  // 投稿完了後にフォームを初期化する。
  const resetForm = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setExif(null);
    setCamera("");
    setLens("");
    setLocation("");
    setNotes("");
    setDetectNotice(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const selectsDisabled = schemaState !== "ready";
  const detectDisabled =
    !file || exif === null || selectsDisabled || isDetecting;
  const prepareDisabled = !file || !camera || isPreparing;

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

            {/* 撮影地 — locations の既存コンテンツから選ぶ (追加は microCMS 側で)。
                選択肢は mount 時に一度取るだけなので、microCMS に撮影地を
                足した直後でも拾えるよう再読込ボタンを添える。 */}
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <div className="flex items-center gap-2">
                <label
                  htmlFor="photo-location"
                  className="text-[13px] font-medium text-base-content/70"
                >
                  撮影地（任意）
                </label>
                <button
                  type="button"
                  onClick={loadSchema}
                  disabled={selectsDisabled}
                  className="btn btn-ghost btn-xs font-normal text-base-content/50"
                >
                  {schemaState === "loading" ? "更新中…" : "選択肢を再読込"}
                </button>
              </div>
              <select
                id="photo-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                disabled={selectsDisabled}
                className="select select-bordered w-full"
              >
                <option value="">なし</option>
                {groupByCity(schema?.locations ?? []).map(([city, items]) => (
                  <optgroup key={city} label={city}>
                    {items.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.nameJa || loc.cityJa || loc.id}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
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

        {/* 投稿後に Threads の予約キューへ積むか。投稿自体とは分けて扱い、
            予約に失敗しても写真の投稿は成立させる (下の注記で知らせる)。 */}
        <label className="flex items-start gap-2 text-[13px] font-medium text-base-content/70">
          <input
            type="checkbox"
            checked={enqueueThreads}
            onChange={(e) => setEnqueueThreads(e.target.checked)}
            className="checkbox checkbox-sm mt-0.5"
          />
          <span className="flex flex-col gap-0.5">
            投稿後に Threads の予約キューへ追加する
            <span className="text-[12px] font-normal text-base-content/50">
              中文・日本語の 2 チャンネルへ、空き枠（台湾時間 20–22時 /
              1日1件）で予約されます。
            </span>
          </span>
        </label>

        {queueNotice && (
          <div className="alert alert-warning text-sm">
            <span className="flex-1">{queueNotice}</span>
            <button
              type="button"
              aria-label="閉じる"
              className="btn btn-ghost btn-xs"
              onClick={() => setQueueNotice(null)}
            >
              ✕
            </button>
          </div>
        )}

        {error && <ErrorAlert>{error}</ErrorAlert>}

        <div className="flex flex-col items-end gap-1.5">
          <Button onClick={handlePrepare} disabled={prepareDisabled}>
            {isPreparing ? "アップロード中…" : "アップロードして生成"}
          </Button>
          <span className="text-[12px] text-base-content/50">
            生成した文章を確認してから投稿します。
          </span>
        </div>
      </Card>

      {/* 生成された文章の確認・再生成。「投稿」で初めて days に作成する。 */}
      {prepared && (
        <PassageDialog
          title="写真を投稿"
          imageUrl={prepared.imageUrl}
          model={model}
          onModelChange={setModel}
          initialPassages={{
            passageJa: prepared.passageJa,
            passageZh: prepared.passageZh,
          }}
          initialNotes={notes}
          adoptLabel="投稿"
          closeLabel="破棄"
          onAdopt={async (p) => {
            const res = await actions.publishPhoto({
              imageUrl: prepared.imageUrl,
              camera,
              lens: lens || undefined,
              location: location || undefined,
              date: exif?.dateOriginal,
              passageJa: p.passageJa,
              passageZh: p.passageZh,
              // alt はアップロード時に Opus 5 固定で生成済み (確認対象外)。
              altJa: prepared.altJa,
              altZh: prepared.altZh,
            });
            if (res.error) return res.error.message ?? "投稿に失敗しました";

            // 投稿は成立済み。予約はここから先の付随処理なので、失敗しても
            // 投稿を巻き戻さず注記だけ残す (Threads タブから手動で予約可能)。
            let queueNote: string | null = null;
            if (enqueueThreads) {
              const q = await actions.threadsEnqueue({ dayId: res.data.id });
              if (q.error) {
                queueNote = `写真 ${res.data.id} は投稿しましたが、Threads の予約に失敗しました: ${q.error.message}`;
              } else if (q.data.skipped.length > 0) {
                queueNote = `写真 ${res.data.id} を投稿・予約しました。${q.data.skipped
                  .map((s) => `${s.label} はスキップ (${s.reason})`)
                  .join(" / ")}`;
              }
            }

            resetForm();
            setQueueNotice(queueNote);
            // 問題なく終わったときだけ文章管理タブへ移す。注記があるときは
            // このタブに留めて読ませる (切り替えると hidden になって見えない)。
            if (!queueNote) onPublished?.();
            return null;
          }}
          onClose={() => setPrepared(null)}
        />
      )}
    </div>
  );
}

export default PhotoComposer;
