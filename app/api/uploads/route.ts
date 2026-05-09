import { NextResponse } from "next/server";

import { uploadMedia } from "@/lib/microcms-management";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB / Twitter 相当
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "invalid-form-data" },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing-file" }, { status: 400 });
  }

  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: "unsupported-mime", mime: file.type },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "file-too-large", limitBytes: MAX_FILE_BYTES },
      { status: 400 },
    );
  }

  try {
    const { url } = await uploadMedia(file);
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json(
      {
        error: "upload-failed",
        message: e instanceof Error ? e.message : "",
      },
      { status: 500 },
    );
  }
}
