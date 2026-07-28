#!/usr/bin/env node
// 既存の formosa /days エントリへ代替テキスト (altJa / altZh) を一括生成して
// 書き込む初回移行スクリプト。以後の新規投稿はアプリ側 (preparePhoto) が
// 投稿時に生成するので、このスクリプトは原則一度だけ実行する。
//
// src/lib は cloudflare:workers に依存していて Node から import できないため、
// このスクリプトは自己完結にしてある (プロンプトだけ photo-alt-prompt.mjs を
// アプリと共有する)。モデルはアプリ側と同じく Opus 5 固定。
//
// 前提:
//   - microCMS の days スキーマに altJa / altZh (テキストフィールド) が
//     追加済みであること
//   - .dev.vars (または環境変数) に FORMOSA_MICROCMS_SERVICE_DOMAIN /
//     FORMOSA_MICROCMS_API_KEY / FORMOSA_MICROCMS_MANAGEMENT_API_KEY /
//     ANTHROPIC_API_KEY があること
//
// 使い方 (リポジトリルートで):
//   node scripts/backfill-alt.mjs --dry-run --limit 3   # まず数件で内容確認
//   node scripts/backfill-alt.mjs                       # 全件 (数十分〜・課金)
//
// altJa が未設定のエントリだけを対象にするので、中断・失敗しても再実行で
// 続きから進む (成功分はフィルタから抜け、失敗分は残って拾い直される)。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ALT_SYSTEM_PROMPT,
  ALT_USER_INSTRUCTION,
} from "../src/lib/photo-alt-prompt.mjs";

const MODEL = "claude-opus-5";
const MAX_TOKENS = 4096; // thinking 込み (lib/photo-alt.ts と同じ)
const ANTHROPIC_TIMEOUT_MS = 60_000;
const CHUNK = 3; // Claude vision の並列数 (admin のバックフィルと同じ)
const RETRYABLE = new Set([429, 500, 502, 503, 529]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- 引数 ----
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limitIdx = args.indexOf("--limit");
const limit =
  limitIdx >= 0 ? Number.parseInt(args[limitIdx + 1], 10) : Infinity;
if (Number.isNaN(limit) || limit <= 0) {
  console.error("--limit には正の整数を指定してください");
  process.exit(1);
}

// ---- env (.dev.vars フォールバック付き) ----
function loadEnv() {
  const root = path.resolve(fileURLToPath(import.meta.url), "../..");
  const devVarsPath = path.join(root, ".dev.vars");
  const fromFile = {};
  if (fs.existsSync(devVarsPath)) {
    for (const line of fs.readFileSync(devVarsPath, "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) fromFile[m[1]] = m[2].trim();
    }
  }
  const get = (name) => {
    const v = process.env[name] ?? fromFile[name];
    if (!v) {
      console.error(`${name} が環境変数にも .dev.vars にもありません`);
      process.exit(1);
    }
    return v;
  };
  return {
    domain: get("FORMOSA_MICROCMS_SERVICE_DOMAIN"),
    readKey: get("FORMOSA_MICROCMS_API_KEY"),
    writeKey: get("FORMOSA_MICROCMS_MANAGEMENT_API_KEY"),
    anthropicKey: get("ANTHROPIC_API_KEY"),
  };
}
const env = loadEnv();

// ---- microCMS ----
async function listMissing(offset, count) {
  const url =
    `https://${env.domain}.microcms.io/api/v1/days` +
    `?filters=${encodeURIComponent("altJa[not_exists]")}` +
    `&fields=id,image&orders=date&limit=${count}&offset=${offset}`;
  const res = await fetch(url, {
    headers: { "X-MICROCMS-API-KEY": env.readKey },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    if (res.status === 400) {
      console.error(
        "一覧の取得が 400 で失敗しました。days スキーマに altJa / altZh の" +
          "テキストフィールドが追加済みか確認してください。\n" +
          detail,
      );
      process.exit(1);
    }
    throw new Error(`list failed: ${res.status} ${detail}`);
  }
  return res.json();
}

async function patchDay(id, alt) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(
      `https://${env.domain}.microcms.io/api/v1/days/${id}`,
      {
        method: "PATCH",
        headers: {
          "X-MICROCMS-API-KEY": env.writeKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(alt),
      },
    );
    if (res.ok) return;
    const detail = await res.text().catch(() => "");
    if (res.status === 429 && attempt < 5) {
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    throw new Error(`patch failed: ${res.status} ${detail}`);
  }
}

// ---- Claude (Opus 5 固定) ----
async function generateAlt(imageUrl) {
  const body = JSON.stringify({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: [
      {
        type: "text",
        text: ALT_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "url", url: `${imageUrl}?w=1024&fm=webp` },
          },
          { type: "text", text: ALT_USER_INSTRUCTION },
        ],
      },
    ],
  });

  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ANTHROPIC_TIMEOUT_MS);
    let res;
    try {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": env.anthropicKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      if (RETRYABLE.has(res.status) && attempt < 3) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      throw new Error(`anthropic failed: ${res.status} ${detail}`);
    }

    const data = await res.json();
    const text = data.content?.find((b) => b.type === "text")?.text?.trim();
    if (!text) throw new Error("anthropic failed: empty response");
    const parsed = JSON.parse(text);
    const altJa = typeof parsed.altJa === "string" ? parsed.altJa.trim() : "";
    const altZh = typeof parsed.altZh === "string" ? parsed.altZh.trim() : "";
    if (!altJa || !altZh) throw new Error("incomplete alt texts");
    return { altJa, altZh };
  }
}

// ---- main ----
let processed = 0;
let failed = 0;
// 成功分は altJa[not_exists] フィルタから抜けるので、offset は失敗数だけ
// 進めれば全件を一度ずつ通れる。dry-run は何も抜けないので件数分進める。
let offset = 0;

console.log(
  `backfill-alt: model=${MODEL} dryRun=${dryRun}` +
    (Number.isFinite(limit) ? ` limit=${limit}` : ""),
);

while (processed + failed < limit) {
  const want = Math.min(CHUNK, limit - processed - failed);
  const page = await listMissing(offset, want);
  const total = page.totalCount;
  if (page.contents.length === 0) break;

  const results = await Promise.allSettled(
    page.contents.map(async (day) => {
      const alt = await generateAlt(day.image.url);
      if (!dryRun) await patchDay(day.id, alt);
      return { id: day.id, ...alt };
    }),
  );

  for (const r of results) {
    if (r.status === "fulfilled") {
      processed += 1;
      const { id, altJa, altZh } = r.value;
      console.log(
        `[${processed + failed}/${total}] ${id}${dryRun ? " (dry)" : ""}\n` +
          `  JA(${altJa.length}) ${altJa}\n  ZH(${altZh.length}) ${altZh}`,
      );
    } else {
      failed += 1;
      console.error(`[failed] ${r.reason?.message ?? r.reason}`);
    }
  }

  offset = dryRun ? offset + page.contents.length : failed;
  await sleep(300); // microCMS 書き込みレートに余裕を持たせる
}

console.log(
  `done: processed=${processed} failed=${failed}` +
    (dryRun ? " (dry-run: 書き込みなし)" : ""),
);
if (failed > 0) {
  console.log("失敗分はフィルタに残っているので、再実行すると拾い直します。");
  process.exitCode = 1;
}
