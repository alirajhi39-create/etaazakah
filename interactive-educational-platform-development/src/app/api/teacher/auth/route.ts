import { sql } from "drizzle-orm";
import { db, describeDbError, isDbConfigured } from "@/db";
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

  // الدخول لا يعتمد على قاعدة البيانات: يتم تفويض الرمز أولًا ثم تُقرأ الإحصاءات بأفضل جهد
  let pinnedNames = 0;
  let database: "connected" | "unavailable" | "not_configured" = "not_configured";
  let databaseHint: string | null = null;

  if (!isDbConfigured()) {
    databaseHint = describeDbError(null).hint;
  } else {
    try {
      const pins = await db.select().from(teacherNames);
      pinnedNames = pins.filter((pin) => pin.locked).length;
      await db.execute(sql`select 1`);
      database = "connected";
    } catch (error) {
      const info = describeDbError(error);
      database = "unavailable";
      databaseHint = `${info.message} — ${info.hint}`;
    }
  }

  return jsonResponse({
    ok: true,
    authorized: true,
    passcodeConfigured: true,
    acceptedCodes: teacherPasscodes().length,
    teacher: "علي عبدالله راجحي",
    school: "العروس الابتدائية",
    pinnedNames,
    database,
    databaseHint,
    capabilities: ["students:read", "students:write", "sounds:write", "reports:print"],
  });
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
