import { sql } from "drizzle-orm";
import { db, describeDatabaseTarget, describeDbError, isDbConfigured, pingDatabase } from "@/db";
import { errorResponse, isTeacherRequest, jsonResponse, preflight } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** إنشاء الجداول والفهارس المطلوبة (آمن للتكرار: IF NOT EXISTS) */
const DDL = [
  `create table if not exists lesson_progress (
    id serial primary key,
    student_id varchar(80) not null unique,
    student_name text not null,
    class_name varchar(24) not null,
    current_slide integer not null default 1,
    max_slide integer not null default 1,
    quiz_score integer not null default 0,
    quiz_total integer not null default 0,
    activities jsonb not null default '{}'::jsonb,
    completed boolean not null default false,
    visits integer not null default 1,
    last_seen_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`,
  `create table if not exists teacher_names (
    id serial primary key,
    student_id varchar(80) not null unique,
    student_name text not null,
    class_name varchar(24) not null,
    locked boolean not null default true,
    note text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`,
  `create table if not exists lesson_sounds (
    id serial primary key,
    sound_key varchar(64) not null unique,
    label text not null,
    mime_type varchar(120) not null,
    file_size integer not null,
    data bytea not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`,
  `create index if not exists lesson_progress_class_idx on lesson_progress (class_name)`,
  `create index if not exists lesson_progress_updated_idx on lesson_progress (updated_at desc)`,
];

async function status() {
  const configured = isDbConfigured();
  const target = describeDatabaseTarget();
  const ping = configured ? await pingDatabase() : { ok: false, latencyMs: 0 };
  const tables: Record<string, boolean> = {};
  if (ping.ok) {
    for (const table of ["lesson_progress", "teacher_names", "lesson_sounds"]) {
      try {
        const result = await db.execute(sql`select to_regclass(${table}) is not null as present`);
        const rows = (result as unknown as { rows: Array<{ present: boolean }> }).rows ?? [];
        tables[table] = Boolean(rows[0]?.present);
      } catch {
        tables[table] = false;
      }
    }
  }
  return { configured, target, ping, tables };
}

export async function OPTIONS() {
  return preflight();
}

export async function GET() {
  const current = await status();
  return jsonResponse({
    ok: current.configured && current.ping.ok,
    database: {
      configured: current.configured,
      connected: current.ping.ok,
      envKey: current.target.key,
      host: current.target.host,
      ssl: current.target.ssl,
      error: "error" in current.ping ? current.ping.error : null,
    },
    tables: current.tables,
    action: "أرسل POST مع ترويسة x-teacher-passcode لإنشاء الجداول تلقائيًا",
  });
}

export async function POST(request: Request) {
  if (!isTeacherRequest(request)) {
    return errorResponse("غير مصرّح: رمز المعلم مطلوب لتهيئة قاعدة البيانات", 401);
  }
  if (!isDbConfigured()) {
    const info = describeDbError(null);
    return jsonResponse({ ok: false, code: info.code, error: info.message, hint: info.hint }, { status: 503 });
  }

  const executed: string[] = [];
  try {
    for (const statement of DDL) {
      await db.execute(sql.raw(statement));
      executed.push(statement.split("\n")[0].trim());
    }
  } catch (error) {
    const info = describeDbError(error);
    return jsonResponse({ ok: false, code: info.code, error: info.message, hint: info.hint, executed }, { status: 500 });
  }

  const current = await status();
  return jsonResponse({
    ok: true,
    initialized: true,
    executed: executed.length,
    tables: current.tables,
    database: { host: current.target.host, ssl: current.target.ssl, connected: current.ping.ok },
  });
}
