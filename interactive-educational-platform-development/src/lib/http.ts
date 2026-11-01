const ALLOWED_HEADERS = [
  "Content-Type",
  "Authorization",
  "x-teacher-passcode",
  "If-None-Match",
  "Accept",
  "X-Requested-With",
].join(", ");

const EXPOSED_HEADERS = ["ETag", "Content-Length", "Content-Disposition", "X-Sound-Key"].join(", ");

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS, HEAD",
  "Access-Control-Allow-Headers": ALLOWED_HEADERS,
  "Access-Control-Expose-Headers": EXPOSED_HEADERS,
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
};

export function withCors(headers: Record<string, string> = {}): Record<string, string> {
  return { ...CORS_HEADERS, ...headers };
}

export function jsonResponse(
  data: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status: init.status ?? 200,
    headers: withCors({
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...(init.headers ?? {}),
    }),
  });
}

export function errorResponse(message: string, status = 400, extra: Record<string, unknown> = {}): Response {
  return jsonResponse({ ok: false, error: message, ...extra }, { status });
}

export function preflight(): Response {
  return new Response(null, { status: 204, headers: withCors() });
}

/**
 * رمز دخول لوحة المعلم.
 * الرمز الأساسي مضمّن في الكود (139613) ليعمل دائمًا حتى لو فُقد متغير البيئة،
 * وأي قيمة في TEACHER_PASSCODE تُقبل إضافةً إليه.
 */
export const DEFAULT_TEACHER_PASSCODE = "139613";

export function teacherPasscodes(): string[] {
  const fromEnv = normalizePasscode(process.env.TEACHER_PASSCODE);
  const codes = new Set<string>([DEFAULT_TEACHER_PASSCODE]);
  if (fromEnv) codes.add(fromEnv);
  return Array.from(codes);
}

export function teacherPasscode(): string {
  return teacherPasscodes()[0];
}

/** توحيد الأرقام العربية والإنجليزية وإزالة المسافات من رمز الدخول */
export function normalizePasscode(raw: unknown): string {
  return String(raw ?? "")
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[^\d]/g, "")
    .trim();
}

export function isTeacherRequest(request: Request): boolean {
  const url = new URL(request.url);
  const fromHeader = normalizePasscode(request.headers.get("x-teacher-passcode"));
  const fromQuery = normalizePasscode(url.searchParams.get("passcode"));
  const accepted = teacherPasscodes();
  return accepted.some((code) => (Boolean(code) && fromHeader === code) || (Boolean(code) && fromQuery === code));
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (body && typeof body === "object" && !Array.isArray(body)) {
      return body as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

export function asInt(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}
