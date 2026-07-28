import { createClient, createManagementClient } from "microcms-js-sdk";

import { getEnv } from "@/lib/env";
import type { DayWriteFields } from "@/types/microcms";

// formosa-chiaroscuro ワークスペース (days API) への書き込み専用モジュール。
// echolog 側の microcms-management.ts と同型:
//  - "server-only" 相当が Astro に無いので、import は actions / SSR のみ。
//    client component からは絶対に import しない (秘匿キーが bundle に乗る)。
//  - client は関数内 lazy 生成。getEnv() は呼ばれた時に Cloudflare workers
//    env が読める前提のため、module top-level で env を読まない。

const DAYS_ENDPOINT = "days";
const noStoreInit: RequestInit = { cache: "no-store" };
const SCHEMA_TIMEOUT_MS = 10_000;

let cachedWriteClient: ReturnType<typeof createClient> | null = null;
let cachedManagementClient: ReturnType<typeof createManagementClient> | null =
  null;

function requireKey(): string {
  const key = getEnv().FORMOSA_MICROCMS_MANAGEMENT_API_KEY;
  if (!key) {
    throw new Error(
      "FORMOSA_MICROCMS_MANAGEMENT_API_KEY is not set. Required for photo posts.",
    );
  }
  return key;
}

function getFormosaWriteClient() {
  if (!cachedWriteClient) {
    cachedWriteClient = createClient({
      serviceDomain: getEnv().FORMOSA_MICROCMS_SERVICE_DOMAIN,
      apiKey: requireKey(),
    });
  }
  return cachedWriteClient;
}

function getFormosaManagementClient() {
  if (!cachedManagementClient) {
    cachedManagementClient = createManagementClient({
      serviceDomain: getEnv().FORMOSA_MICROCMS_SERVICE_DOMAIN,
      apiKey: requireKey(),
    });
  }
  return cachedManagementClient;
}

export async function uploadFormosaMedia(file: File): Promise<{ url: string }> {
  return getFormosaManagementClient().uploadMedia({ data: file });
}

// ---- スキーマ取得 ----

export type DaysSchema = {
  camera: string[];
  lens: string[];
};

type SchemaSelectItem = { id: string; value: string };
type SchemaField = {
  fieldId: string;
  kind: string;
  selectItems?: SchemaSelectItem[];
};
type DaysSchemaResponse = { apiFields?: SchemaField[] };

// microCMS の Management API でスキーマ (フィールド定義) を取得する。
// microcms-js-sdk はこの endpoint を持たないので raw fetch。
// GET https://{service}.microcms-management.io/api/v1/apis/days
export async function fetchDaysSchema(): Promise<DaysSchema> {
  const env = getEnv();
  const apiKey = requireKey();
  const url = `https://${env.FORMOSA_MICROCMS_SERVICE_DOMAIN}.microcms-management.io/api/v1/apis/${DAYS_ENDPOINT}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SCHEMA_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "X-MICROCMS-API-KEY": apiKey },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`days schema fetch failed: ${res.status} ${detail}`);
    }
    const data = (await res.json()) as DaysSchemaResponse;
    const selectValues = (fieldId: string): string[] => {
      const field = data.apiFields?.find((f) => f.fieldId === fieldId);
      return (field?.selectItems ?? []).map((item) => item.value);
    };
    return {
      camera: selectValues("camera"),
      lens: selectValues("lens"),
    };
  } finally {
    clearTimeout(timeout);
  }
}

// ---- days コンテンツ作成 ----

// microCMS の非対称仕様:
//  - media フィールド (image) は GET 時 { url, ... }、POST 時は URL の string。
//  - select フィールド (camera / lens) は単一選択でも値文字列の配列で書く。
function toDaysPayload(content: DayWriteFields): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    image: content.imageUrl,
    camera: [content.camera],
  };
  if (content.lens) payload.lens = [content.lens];
  // 参照フィールドはコンテンツ ID の文字列で書く。
  if (content.location) payload.location = content.location;
  if (content.featured != null) payload.featured = content.featured;
  if (content.passageJa) payload.passageJa = content.passageJa;
  if (content.passageZh) payload.passageZh = content.passageZh;
  if (content.altJa) payload.altJa = content.altJa;
  if (content.altZh) payload.altZh = content.altZh;
  if (content.date) payload.date = content.date;
  return payload;
}

export async function createDay(
  content: DayWriteFields,
): Promise<{ id: string }> {
  return getFormosaWriteClient().create({
    endpoint: DAYS_ENDPOINT,
    content: toDaysPayload(content),
    isDraft: false,
    customRequestInit: noStoreInit,
  });
}

// 既存 days エントリの部分更新 (PATCH)。microcms-js-sdk の update() は
// 部分更新なので、渡したフィールドだけ書き換わり他は不変。passage の
// 後付け・再生成、お気に入り (featured) トグルで使う。
export async function updateDay(
  contentId: string,
  content: { passageJa?: string; passageZh?: string; featured?: boolean },
): Promise<{ id: string }> {
  return getFormosaWriteClient().update({
    endpoint: DAYS_ENDPOINT,
    contentId,
    content,
    customRequestInit: noStoreInit,
  });
}
