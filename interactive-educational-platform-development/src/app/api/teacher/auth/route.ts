import { sql } from "drizzle-orm";
import { db } from "@/db";
import { teacherNames } from "@/db/schema";
import {
  errorResponse,
  isTeacherRequest,
  jsonResponse,
  normalizePasscode,
  preflight,
  readJson,
  teacherPasscodes,
} from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleAuth(request: Request): Promise<Response> {
  let authorized = isTeacherRequest(request);

  // دعم إضافي: إرسال الرمز في جسم الطلب (يتجاوز أي مشكلة في ترميز الترويسات)
  if (!authorized) {
    const body = await readJson(request);
    const provided = normalizePasscode(body.passcode ?? body.code ?? "");
    authorized = Boolean(provided) && teacherPasscodes().includes(provided);
  }

  if (!authorized) return errorResponse("رمز المعلم غير صحيح", 401);

  try {
    const pins = await db.select().from(teacherNames);
    await db.execute(sql`select 1`);
    return jsonResponse({
      ok: true,
      authorized: true,
      passcodeConfigured: true,
      acceptedCodes: teacherPasscodes().length,
      teacher: "علي عبدالله راجحي",
      school: "العروس الابتدائية",
      pinnedNames: pins.filter((pin) => pin.locked).length,
      capabilities: ["students:read", "students:write", "sounds:write", "reports:print"],
    });
  } catch (error) {
    return errorResponse("تعذّر التحقق من الجلسة", 500, { detail: String(error) });
  }
}

export async function OPTIONS() {
  return preflight();
}

export async function GET(request: Request) {
  return handleAuth(request);
}

export async function POST(request: Request) {
  return handleAuth(request);
}
