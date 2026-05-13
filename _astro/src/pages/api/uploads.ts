import type { APIRoute } from "astro";

import { uploadMedia } from "@/lib/microcms-management";

// 旧 app/api/uploads/route.ts の Astro 移植。
// 認証は middleware が /api/uploads を Cloudflare Access JWT で gate。

export const prerender = false;

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB / Twitter 相当
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

const json = (data: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });

export const POST: APIRoute = async ({ request }) => {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return json({ error: "invalid-form-data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return json({ error: "missing-file" }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return json({ error: "unsupported-mime", mime: file.type }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return json(
      { error: "file-too-large", limitBytes: MAX_FILE_BYTES },
      { status: 400 },
    );
  }

  try {
    const { url } = await uploadMedia(file);
    return json({ url });
  } catch (e) {
    return json(
      { error: "upload-failed", message: e instanceof Error ? e.message : "" },
      { status: 500 },
    );
  }
};
