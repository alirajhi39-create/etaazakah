import { CORS_HEADERS, preflight } from "@/lib/http";
import { describeDatabaseTarget, isDbConfigured, pingDatabase } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return preflight();
}

export async function GET() {
  const target = describeDatabaseTarget();
  const configured = isDbConfigured();
  const ping = configured ? await pingDatabase() : { ok: false, latencyMs: 0 };

  return Response.json(
    {
      ok: configured && ping.ok,
      service: "zakat-lesson-platform",
      database: {
        configured,
        connected: Boolean(ping.ok),
        envKey: target.key,
        host: target.host,
        database: target.database,
        ssl: target.ssl,
        latencyMs: ping.latencyMs,
        error: "error" in ping ? ping.error : null,
      },
      env: {
        DATABASE_URL: Boolean(process.env.DATABASE_URL),
        POSTGRES_URL: Boolean(process.env.POSTGRES_URL),
        NEON_DATABASE_URL: Boolean(process.env.NEON_DATABASE_URL),
        TEACHER_PASSCODE: Boolean(process.env.TEACHER_PASSCODE),
      },
      assets: {
        heroImage: "/images/zakat-hero.webp",
        warningImage: "/images/zakat-warning.webp",
      },
      timestamp: new Date().toISOString(),
    },
    { status: 200, headers: { ...CORS_HEADERS, "Cache-Control": "no-store" } },
  );
}
