import { sql } from "drizzle-orm";
import { db } from "@/db";
import { CORS_HEADERS, preflight } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return preflight();
}

export async function GET() {
  try {
    const startedAt = Date.now();
    await db.execute(sql`select 1`);
    return Response.json(
      {
        ok: true,
        service: "zakat-lesson-platform",
        database: "connected",
        latencyMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      },
      { headers: { ...CORS_HEADERS, "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ ok: false, database: "unavailable" }, { status: 500, headers: CORS_HEADERS });
  }
}
