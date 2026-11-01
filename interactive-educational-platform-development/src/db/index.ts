import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

/**
 * إعداد الاتصال بقاعدة البيانات — يعمل محليًا وعلى Neon / Vercel.
 * لا نرفع استثناءً عند الاستيراد حتى لا تتعطّل كل المسارات إذا لم يُضبط المتغيّر،
 * بل نُرجع تشخيصًا واضحًا (503) من كل واجهة برمجية.
 */

const CANDIDATE_KEYS = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "NEON_DATABASE_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL_NON_POOLING",
] as const;

export type DbEnvKey = (typeof CANDIDATE_KEYS)[number];

export function resolveDatabaseUrl(): { url: string | null; key: DbEnvKey | null } {
  for (const key of CANDIDATE_KEYS) {
    const value = process.env[key];
    if (value && value.trim().length > 0) return { url: value.trim(), key };
  }
  return { url: null, key: null };
}

export function isDbConfigured(): boolean {
  return resolveDatabaseUrl().url !== null;
}

/** مضيف قاعدة البيانات مُقنّعًا للعرض في التشخيص */
export function describeDatabaseTarget(): { host: string | null; database: string | null; ssl: boolean; key: DbEnvKey | null } {
  const { url, key } = resolveDatabaseUrl();
  if (!url) return { host: null, database: null, ssl: false, key: null };
  try {
    const parsed = new URL(url);
    const isLocal = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
    return {
      host: parsed.hostname,
      database: parsed.pathname.replace(/^\//, "") || null,
      ssl: !isLocal || parsed.searchParams.get("sslmode") === "require",
      key,
    };
  } catch {
    return { host: "invalid-url", database: null, ssl: false, key };
  }
}

function needsSsl(connectionString: string): boolean {
  try {
    const parsed = new URL(connectionString);
    if (parsed.searchParams.get("sslmode") === "disable") return false;
    if (parsed.searchParams.get("sslmode") === "require") return true;
    return !["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  } catch {
    return false;
  }
}

const globalForDb = globalThis as typeof globalThis & {
  __zakatPool?: Pool;
  __zakatPoolUrl?: string;
};

function createPool(connectionString: string): Pool {
  return new Pool({
    connectionString,
    // إعدادات مناسبة لدوال Vercel Serverless (اتصالات قليلة قصيرة العمر)
    max: Number(process.env.PGPOOL_MAX ?? 3),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 12_000,
    allowExitOnIdle: true,
    ...(needsSsl(connectionString) ? { ssl: { rejectUnauthorized: false } } : {}),
  });
}

const { url: rawUrl } = resolveDatabaseUrl();

// سلسلة بديلة غير متصلة عند غياب المتغيّر: تُبقي الاستيراد آمنًا وتفشل عند الاستعلام فقط
const connectionString = rawUrl ?? "postgresql://not-configured:not-configured@127.0.0.1:65535/not_configured";

export const pool: Pool =
  globalForDb.__zakatPool && globalForDb.__zakatPoolUrl === connectionString
    ? globalForDb.__zakatPool
    : createPool(connectionString);

globalForDb.__zakatPool = pool;
globalForDb.__zakatPoolUrl = connectionString;

export const db = drizzle(pool);

export type DbErrorInfo = { code: string; message: string; hint: string };

/** ترجمة أخطاء قاعدة البيانات إلى رسالة عربية وإرشاد عملي */
export function describeDbError(error: unknown): DbErrorInfo {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const lower = raw.toLowerCase();

  if (!isDbConfigured()) {
    return {
      code: "db_not_configured",
      message: "قاعدة البيانات غير مربوطة: لم يُعثر على متغيّر الاتصال.",
      hint: "أضف DATABASE_URL (أو POSTGRES_URL من تكامل Neon) في Vercel → Settings → Environment Variables لبيئات Production و Preview، ثم أعد النشر.",
    };
  }
  if (lower.includes("enotfound") || lower.includes("getaddrinfo")) {
    return {
      code: "db_host_not_found",
      message: "لم يُعثر على خادم قاعدة البيانات.",
      hint: "تحقق من صحة عنوان المضيف في DATABASE_URL، وأن مشروع Neon غير موقوف (Idle) وأن الرابط منشور كاملًا.",
    };
  }
  if (lower.includes("econnrefused") || lower.includes("timeout") || lower.includes("etimedout")) {
    return {
      code: "db_unreachable",
      message: "تعذّر الوصول إلى قاعدة البيانات.",
      hint: "استخدم رابط Neon المجمّع (Pooled connection) وتأكد من إضافة ?sslmode=require، أو فعّل الاتصال عبر IPv4.",
    };
  }
  if (lower.includes("password") || lower.includes("authentication") || lower.includes("role")) {
    return {
      code: "db_auth_failed",
      message: "بيانات الدخول إلى قاعدة البيانات غير صحيحة.",
      hint: "أعد نسخ Connection String من لوحة Neon (بما فيه كلمة المرور) وحدّث DATABASE_URL في Vercel.",
    };
  }
  if (lower.includes("ssl") || lower.includes("self signed")) {
    return {
      code: "db_ssl_required",
      message: "قاعدة البيانات تتطلب اتصالًا آمنًا (SSL).",
      hint: "أضف ?sslmode=require إلى نهاية DATABASE_URL.",
    };
  }
  if (lower.includes("does not exist") || lower.includes("undefined_table") || lower.includes("relation")) {
    return {
      code: "db_tables_missing",
      message: "جداول قاعدة البيانات غير منشأة.",
      hint: "افتح لوحة المعلم ← تبويب واجهة API ← اضغط «تهيئة جداول قاعدة البيانات»، أو نفّذ npx drizzle-kit push على رابط Neon.",
    };
  }
  return {
    code: "db_error",
    message: "تعذّر تنفيذ العملية على قاعدة البيانات.",
    hint: raw.slice(0, 220),
  };
}

export async function pingDatabase(): Promise<{ ok: boolean; latencyMs: number; error?: DbErrorInfo }> {
  const startedAt = Date.now();
  try {
    await pool.query("select 1");
    return { ok: true, latencyMs: Date.now() - startedAt };
  } catch (error) {
    return { ok: false, latencyMs: Date.now() - startedAt, error: describeDbError(error) };
  }
}
