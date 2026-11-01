import { asc, eq } from "drizzle-orm";
import { db, describeDbError } from "@/db";
import { lessonSounds } from "@/db/schema";
import { errorResponse, isTeacherRequest, jsonResponse, preflight } from "@/lib/http";
import { SOUND_SLOTS } from "@/lib/lesson";
import type { SoundMeta } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const MAX_SOUND_BYTES = 4 * 1024 * 1024; // 4MB — حد Vercel لطلبات الدوال
const KEY_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

const slotMap = new Map(SOUND_SLOTS.map((slot) => [slot.key, slot]));

export async function OPTIONS() {
  return preflight();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const key = (url.searchParams.get("key") ?? "").trim();
  const metaOnly = url.searchParams.get("meta") === "true";
  const download = url.searchParams.get("download") === "true";

  try {
    if (!key) {
      const rows = await db
        .select({
          soundKey: lessonSounds.soundKey,
          label: lessonSounds.label,
          mimeType: lessonSounds.mimeType,
          fileSize: lessonSounds.fileSize,
          updatedAt: lessonSounds.updatedAt,
        })
        .from(lessonSounds)
        .orderBy(asc(lessonSounds.soundKey));

      const sounds: SoundMeta[] = rows.map((row) => ({
        soundKey: row.soundKey,
        label: row.label,
        mimeType: row.mimeType,
        fileSize: row.fileSize,
        updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
        url: `/api/sounds?key=${encodeURIComponent(row.soundKey)}`,
      }));

      return jsonResponse({
        ok: true,
        count: sounds.length,
        maxBytes: MAX_SOUND_BYTES,
        storage: "bytea (PostgreSQL)",
        slots: SOUND_SLOTS,
        sounds,
      });
    }

    if (!KEY_PATTERN.test(key)) return errorResponse("مفتاح الصوت غير صحيح (a-z, 0-9, - فقط)", 422);

    const row = (await db.select().from(lessonSounds).where(eq(lessonSounds.soundKey, key)).limit(1))[0];
    if (!row) {
      return errorResponse("لا يوجد صوت محفوظ بهذا المفتاح", 404, {
        key,
        suggestedLabel: slotMap.get(key)?.label ?? null,
      });
    }

    if (metaOnly) {
      return jsonResponse({
        ok: true,
        sound: {
          soundKey: row.soundKey,
          label: row.label,
          mimeType: row.mimeType,
          fileSize: row.fileSize,
          updatedAt: new Date(row.updatedAt).toISOString(),
          url: `/api/sounds?key=${encodeURIComponent(row.soundKey)}`,
        },
      });
    }

    const bytes = Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data as unknown as ArrayBuffer);
    const etag = `W/"${row.soundKey}-${bytes.byteLength}-${new Date(row.updatedAt).getTime()}"`;
    const ifNoneMatch = request.headers.get("if-none-match");
    const cacheHeaders = {
      ETag: etag,
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400, immutable",
      "Last-Modified": new Date(row.updatedAt).toUTCString(),
      "X-Sound-Key": row.soundKey,
    };

    if (ifNoneMatch && ifNoneMatch.split(",").map((part) => part.trim()).includes(etag)) {
      return new Response(null, { status: 304, headers: cacheHeaders });
    }

    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        ...cacheHeaders,
        "Content-Type": row.mimeType || "audio/mpeg",
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${row.soundKey}.${(row.mimeType.split("/")[1] || "mp3").replace("mpeg", "mp3")}"`,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Expose-Headers": "ETag, Content-Length, X-Sound-Key, Content-Disposition",
        "Accept-Ranges": "none",
      },
    });
  } catch (error) {
    const info = describeDbError(error);
    return errorResponse(`${info.message} ${info.hint}`, 500, { code: info.code });
  }
}

export async function POST(request: Request) {
  if (!isTeacherRequest(request)) {
    return errorResponse("غير مصرّح: رمز المعلم مطلوب لرفع الأصوات", 401);
  }

  try {
    const contentType = request.headers.get("content-type") ?? "";
    let key = "";
    let label = "";
    let mimeType = "audio/mpeg";
    let bytes: Buffer | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      key = String(form.get("key") ?? "").trim();
      label = String(form.get("label") ?? "").trim();
      const file = form.get("file");
      if (!(file instanceof File)) return errorResponse("لم يتم إرسال ملف صوتي", 422);
      if (file.size > MAX_SOUND_BYTES) {
        return errorResponse(`حجم الملف أكبر من الحد المسموح (${MAX_SOUND_BYTES / (1024 * 1024)} ميجابايت)`, 413);
      }
      mimeType = file.type || mimeType;
      bytes = Buffer.from(await file.arrayBuffer());
      if (!label) label = file.name.replace(/\.[a-z0-9]+$/i, "");
    } else {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      key = String(body.key ?? "").trim();
      label = String(body.label ?? "").trim();
      const base64 = String(body.data ?? "").replace(/^data:[^;]+;base64,/, "");
      mimeType = String(body.mimeType ?? mimeType);
      if (!base64) return errorResponse("الحقل data (base64) مطلوب", 422);
      const estimated = Math.ceil((base64.length * 3) / 4);
      if (estimated > MAX_SOUND_BYTES) {
        return errorResponse(`حجم الملف أكبر من الحد المسموح (${MAX_SOUND_BYTES / (1024 * 1024)} ميجابايت)`, 413);
      }
      bytes = Buffer.from(base64, "base64");
    }

    if (!KEY_PATTERN.test(key)) return errorResponse("مفتاح الصوت غير صحيح (a-z, 0-9, - فقط)", 422);
    if (!bytes || bytes.byteLength === 0) return errorResponse("الملف الصوتي فارغ", 422);
    if (bytes.byteLength > MAX_SOUND_BYTES) {
      return errorResponse(`حجم الملف أكبر من الحد المسموح (${MAX_SOUND_BYTES / (1024 * 1024)} ميجابايت)`, 413);
    }
    if (mimeType && !mimeType.startsWith("audio/")) {
      return errorResponse("نوع الملف غير مدعوم، يُرجى رفع ملف صوتي (mp3, wav, m4a, ogg)", 415);
    }

    const resolvedLabel = (label || slotMap.get(key)?.label || key).slice(0, 200);
    const now = new Date();

    const saved = (
      await db
        .insert(lessonSounds)
        .values({ soundKey: key, label: resolvedLabel, mimeType, fileSize: bytes.byteLength, data: bytes, updatedAt: now })
        .onConflictDoUpdate({
          target: lessonSounds.soundKey,
          set: { label: resolvedLabel, mimeType, fileSize: bytes.byteLength, data: bytes, updatedAt: now },
        })
        .returning({
          soundKey: lessonSounds.soundKey,
          label: lessonSounds.label,
          mimeType: lessonSounds.mimeType,
          fileSize: lessonSounds.fileSize,
          updatedAt: lessonSounds.updatedAt,
        })
    )[0];

    return jsonResponse(
      {
        ok: true,
        uploaded: true,
        sound: {
          ...saved,
          updatedAt: new Date(saved.updatedAt).toISOString(),
          url: `/api/sounds?key=${encodeURIComponent(saved.soundKey)}`,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    const info = describeDbError(error);
    return errorResponse(`${info.message} ${info.hint}`, 500, { code: info.code });
  }
}

export async function DELETE(request: Request) {
  if (!isTeacherRequest(request)) {
    return errorResponse("غير مصرّح: رمز المعلم مطلوب لحذف الأصوات", 401);
  }
  const url = new URL(request.url);
  const key = (url.searchParams.get("key") ?? "").trim();
  if (!key) return errorResponse("مفتاح الصوت (key) مطلوب", 422);

  try {
    const deleted = await db.delete(lessonSounds).where(eq(lessonSounds.soundKey, key)).returning({ soundKey: lessonSounds.soundKey });
    return jsonResponse({ ok: true, deleted: deleted.length > 0, key });
  } catch (error) {
    const info = describeDbError(error);
    return errorResponse(`${info.message} ${info.hint}`, 500, { code: info.code });
  }
}
