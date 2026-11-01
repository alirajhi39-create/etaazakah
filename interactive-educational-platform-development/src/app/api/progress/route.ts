import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { lessonProgress, lessonSounds, teacherNames } from "@/db/schema";
import { CLASS_OPTIONS, cleanStudentName, isClassOption, normalizeClassName, normalizeName } from "@/lib/classes";
import {
  asInt,
  errorResponse,
  isTeacherRequest,
  jsonResponse,
  preflight,
  readJson,
} from "@/lib/http";
import { QUIZ, SLIDES, TOTAL_SLIDES } from "@/lib/lesson";
import type { StudentRecord, TeacherReport } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const clampSlide = (value: number, fallback: number) => {
  const next = Number.isFinite(value) ? value : fallback;
  return Math.min(Math.max(next, 1), TOTAL_SLIDES);
};

type ProgressRow = typeof lessonProgress.$inferSelect;
type PinRow = typeof teacherNames.$inferSelect;

function toRecord(row: ProgressRow, pin?: PinRow): StudentRecord {
  return {
    studentId: row.studentId,
    studentName: pin?.locked ? pin.studentName : row.studentName,
    className: pin?.locked ? pin.className : row.className,
    currentSlide: row.currentSlide,
    maxSlide: row.maxSlide,
    quizScore: row.quizScore,
    quizTotal: row.quizTotal,
    activities: (row.activities ?? {}) as Record<string, unknown>,
    completed: row.completed,
    visits: row.visits,
    lastSeenAt: row.lastSeenAt ? new Date(row.lastSeenAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    locked: Boolean(pin?.locked),
    pinned: Boolean(pin?.locked),
  };
}

async function tableExists(table: string): Promise<boolean> {
  const result = await db.execute(sql`select to_regclass(${table}) is not null as present`);
  const rows = (result as unknown as { rows: Array<{ present: boolean }> }).rows ?? [];
  return Boolean(rows[0]?.present);
}

async function countRows(table: string): Promise<number> {
  const result = await db.execute(sql.raw(`select count(*)::int as total from ${table}`));
  const rows = (result as unknown as { rows: Array<{ total: number }> }).rows ?? [];
  return Number(rows[0]?.total ?? 0);
}

async function buildReport(): Promise<TeacherReport> {
  const rows = await db.select().from(lessonProgress).orderBy(asc(lessonProgress.className), asc(lessonProgress.studentName));
  const pins = await db.select().from(teacherNames);
  const pinMap = new Map(pins.map((pin) => [pin.studentId, pin]));
  const students = rows.map((row) => toRecord(row, pinMap.get(row.studentId)));

  const sounds = await db
    .select({
      soundKey: lessonSounds.soundKey,
      label: lessonSounds.label,
      mimeType: lessonSounds.mimeType,
      fileSize: lessonSounds.fileSize,
      updatedAt: lessonSounds.updatedAt,
    })
    .from(lessonSounds);

  const now = Date.now();
  const totals = students.reduce(
    (acc, student) => {
      const scorePercent = student.quizTotal > 0 ? (student.quizScore / student.quizTotal) * 100 : 0;
      acc.scoreSum += scorePercent;
      acc.progressSum += (student.maxSlide / TOTAL_SLIDES) * 100;
      if (student.completed) acc.completed += 1;
      if (student.lastSeenAt && now - new Date(student.lastSeenAt).getTime() < 24 * 60 * 60 * 1000) {
        acc.activeToday += 1;
      }
      return acc;
    },
    { scoreSum: 0, progressSum: 0, completed: 0, activeToday: 0 },
  );

  const classes = Array.from(
    new Set([
      ...CLASS_OPTIONS,
      ...students.map((student) => student.className).filter(Boolean),
    ]),
  ).sort();

  return {
    ok: true,
    students,
    classes,
    sounds: sounds.map((sound) => ({
      soundKey: sound.soundKey,
      label: sound.label,
      mimeType: sound.mimeType,
      fileSize: sound.fileSize,
      updatedAt: sound.updatedAt ? new Date(sound.updatedAt).toISOString() : null,
      url: `/api/sounds?key=${encodeURIComponent(sound.soundKey)}`,
    })),
    stats: {
      totalStudents: students.length,
      activeToday: totals.activeToday,
      completed: totals.completed,
      averageScore: students.length ? Math.round(totals.scoreSum / students.length) : 0,
      averageProgress: students.length ? Math.round(totals.progressSum / students.length) : 0,
      pinnedNames: pins.filter((pin) => pin.locked).length,
    },
  };
}

export async function OPTIONS() {
  return preflight();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const diagnose = url.searchParams.get("diagnose");
  const all = url.searchParams.get("all");

  try {
    if (diagnose === "true" || diagnose === "1") {
      const startedAt = Date.now();
      await db.execute(sql`select 1`);
      const latencyMs = Date.now() - startedAt;
      const sampleClass = url.searchParams.get("className") ?? "٣ / أ";
      const [progressExists, namesExists, soundsExists] = await Promise.all([
        tableExists("lesson_progress"),
        tableExists("teacher_names"),
        tableExists("lesson_sounds"),
      ]);

      return jsonResponse({
        ok: true,
        mode: "diagnose",
        lesson: { title: "إيتاء الزكاة", slides: SLIDES.length, quizQuestions: QUIZ.length },
        database: {
          connected: true,
          driver: "drizzle-orm/node-postgres",
          latencyMs,
          tables: {
            lesson_progress: { exists: progressExists, rows: progressExists ? await countRows("lesson_progress") : 0 },
            teacher_names: { exists: namesExists, rows: namesExists ? await countRows("teacher_names") : 0 },
            lesson_sounds: { exists: soundsExists, rows: soundsExists ? await countRows("lesson_sounds") : 0 },
          },
        },
        normalization: {
          input: sampleClass,
          output: normalizeClassName(sampleClass),
          allowedClasses: CLASS_OPTIONS,
          samples: ["3أ", "٣ / أ", "3-A", "الصف الثالث أ", "ثالث ب", "3/ج"].map((value) => ({
            input: value,
            output: normalizeClassName(value),
          })),
        },
        sounds: { maxBytes: 4 * 1024 * 1024, maxLabel: "4MB", storage: "bytea" },
        endpoints: [
          "POST /api/progress",
          "GET /api/progress?studentId=...",
          "GET /api/progress?all=true",
          "GET /api/progress?diagnose=true",
          "PATCH /api/progress (teacher passcode)",
          "DELETE /api/progress?studentId=... (teacher passcode)",
          "GET /api/sounds",
          "GET /api/sounds?key=...",
          "POST /api/sounds (teacher passcode)",
          "DELETE /api/sounds?key=... (teacher passcode)",
        ],
        cors: "enabled",
        timestamp: new Date().toISOString(),
      });
    }

    if (all === "true" || all === "1") {
      return jsonResponse(await buildReport());
    }

    const studentId = (url.searchParams.get("studentId") ?? "").trim();
    const name = url.searchParams.get("name");
    const rawClass = url.searchParams.get("className");
    let row: ProgressRow | undefined;

    if (studentId) {
      row = (await db.select().from(lessonProgress).where(eq(lessonProgress.studentId, studentId)).limit(1))[0];
    } else if (name) {
      const className = normalizeClassName(rawClass);
      const targetName = normalizeName(name);
      const candidates = await db.select().from(lessonProgress);
      const allPins = await db.select().from(teacherNames);
      const pinById = new Map(allPins.map((pin) => [pin.studentId, pin]));

      const exact = candidates.find(
        (candidate) =>
          (normalizeName(candidate.studentName) === targetName || normalizeName(pinById.get(candidate.studentId)?.studentName) === targetName) &&
          (!className ||
            candidate.className === className ||
            pinById.get(candidate.studentId)?.className === className),
      );
      // احتياط: مطابقة الاسم المثبت من المعلم فقط (الفصل المثبت هو المعتمد)
      const fallback = candidates.find((candidate) => {
        const pin = pinById.get(candidate.studentId);
        return Boolean(pin?.locked) && normalizeName(pin?.studentName) === targetName;
      });
      row = exact ?? fallback;
    }

    if (row) {
      const pin = (await db.select().from(teacherNames).where(eq(teacherNames.studentId, row.studentId)).limit(1))[0];
      return jsonResponse({ ok: true, found: true, student: toRecord(row, pin) });
    }

    if (studentId) {
      const pin = (await db.select().from(teacherNames).where(eq(teacherNames.studentId, studentId)).limit(1))[0];
      return jsonResponse({
        ok: true,
        found: false,
        student: null,
        pinned: pin ? { studentName: pin.studentName, className: pin.className, locked: pin.locked } : null,
      });
    }

    return jsonResponse({
      ok: true,
      found: false,
      student: null,
      usage: {
        resume: "/api/progress?studentId=ID",
        resumeByName: "/api/progress?name=اسم الطالب&className=3/أ",
        report: "/api/progress?all=true",
        diagnose: "/api/progress?diagnose=true",
      },
    });
  } catch (error) {
    return errorResponse("تعذّر قراءة بيانات التقدم", 500, { detail: String(error) });
  }
}

export async function POST(request: Request) {
  const body = await readJson(request);
  try {
    const incomingId = String(body.studentId ?? "").trim();
    const studentId = incomingId || crypto.randomUUID();
    const existing = (await db.select().from(lessonProgress).where(eq(lessonProgress.studentId, studentId)).limit(1))[0];
    const pin = (await db.select().from(teacherNames).where(eq(teacherNames.studentId, studentId)).limit(1))[0];

    const submittedName = cleanStudentName(body.studentName) || existing?.studentName || "طالب";
    const submittedClass = normalizeClassName(body.className) || existing?.className || CLASS_OPTIONS[0];
    const studentName = pin?.locked ? pin.studentName : submittedName;
    const className = pin?.locked ? pin.className : isClassOption(submittedClass) ? submittedClass : CLASS_OPTIONS[0];

    if (!studentName) return errorResponse("اسم الطالب مطلوب", 422);
    if (!isClassOption(className)) return errorResponse(`الفصل غير صحيح، الصيغ المتاحة: ${CLASS_OPTIONS.join("، ")}`, 422);

    const currentSlide = clampSlide(asInt(body.currentSlide, existing?.currentSlide ?? 1), existing?.currentSlide ?? 1);
    const requestedMax = clampSlide(asInt(body.maxSlide, currentSlide), currentSlide);
    const maxSlide = Math.max(existing?.maxSlide ?? 1, requestedMax, currentSlide);
    const requestedScore = asInt(body.quizScore, existing?.quizScore ?? 0);
    const requestedTotal = asInt(body.quizTotal, existing?.quizTotal ?? (body.quizScore !== undefined ? QUIZ.length : 0));
    const quizScore = Math.max(existing?.quizScore ?? 0, Math.max(0, Math.min(requestedScore, QUIZ.length)));
    const quizTotal = Math.max(existing?.quizTotal ?? 0, Math.min(Math.max(requestedTotal, 0), QUIZ.length));
    const incomingActivities =
      body.activities && typeof body.activities === "object" && !Array.isArray(body.activities)
        ? (body.activities as Record<string, unknown>)
        : undefined;
    const activities = {
      ...((existing?.activities ?? {}) as Record<string, unknown>),
      ...(incomingActivities ?? {}),
    };
    const completed = Boolean(existing?.completed) || Boolean(body.completed);
    const isSessionStart = body.event === "session-start";

    const values = {
      studentId,
      studentName,
      className,
      currentSlide,
      maxSlide,
      quizScore,
      quizTotal,
      activities,
      completed,
      visits: (existing?.visits ?? 0) + (isSessionStart || !existing ? 1 : 0),
      lastSeenAt: new Date(),
      updatedAt: new Date(),
    };

    let saved: ProgressRow;
    if (existing) {
      saved = (
        await db.update(lessonProgress).set(values).where(eq(lessonProgress.studentId, studentId)).returning()
      )[0];
    } else {
      saved = (await db.insert(lessonProgress).values(values).returning())[0];
    }

    return jsonResponse({ ok: true, saved: true, student: toRecord(saved, pin), pinned: Boolean(pin?.locked) });
  } catch (error) {
    return errorResponse("تعذّر حفظ بيانات التقدم", 500, { detail: String(error) });
  }
}

export async function PATCH(request: Request) {
  if (!isTeacherRequest(request)) {
    return errorResponse("غير مصرّح: رمز المعلم مطلوب لتعديل بيانات الطالب", 401);
  }
  const body = await readJson(request);
  const studentId = String(body.studentId ?? "").trim();
  if (!studentId) return errorResponse("معرّف الطالب (studentId) مطلوب", 422);

  try {
    const existing = (await db.select().from(lessonProgress).where(eq(lessonProgress.studentId, studentId)).limit(1))[0];
    const pin = (await db.select().from(teacherNames).where(eq(teacherNames.studentId, studentId)).limit(1))[0];
    if (!existing && !pin && body.create !== true) {
      return errorResponse("لا يوجد سجل بهذا المعرّف — أرسل create=true لإضافة طالب جديد وتثبيت اسمه", 404);
    }

    const nextName = cleanStudentName(body.studentName) || pin?.studentName || existing?.studentName || "";
    const nextClassRaw = normalizeClassName(body.className) || pin?.className || existing?.className || "";
    const nextClass = isClassOption(nextClassRaw) ? nextClassRaw : CLASS_OPTIONS[0];
    if (!nextName) return errorResponse("اسم الطالب مطلوب", 422);

    const unlock = body.locked === false || body.unlock === true;

    if (unlock) {
      await db.delete(teacherNames).where(eq(teacherNames.studentId, studentId));
    } else {
      const pinValues = {
        studentId,
        studentName: nextName,
        className: nextClass,
        locked: true,
        note: typeof body.note === "string" ? body.note.slice(0, 200) : pin?.note ?? null,
        updatedAt: new Date(),
      };
      if (pin) {
        await db.update(teacherNames).set(pinValues).where(eq(teacherNames.studentId, studentId));
      } else {
        await db.insert(teacherNames).values(pinValues);
      }
    }

    let saved = existing;
    if (existing) {
      const resetProgress = body.resetProgress === true;
      saved = (
        await db
          .update(lessonProgress)
          .set({
            studentName: nextName,
            className: nextClass,
            currentSlide: resetProgress ? 1 : existing.currentSlide,
            maxSlide: resetProgress ? 1 : existing.maxSlide,
            quizScore: resetProgress ? 0 : existing.quizScore,
            quizTotal: resetProgress ? QUIZ.length : existing.quizTotal,
            completed: resetProgress ? false : existing.completed,
            updatedAt: new Date(),
          })
          .where(eq(lessonProgress.studentId, studentId))
          .returning()
      )[0];
    } else {
      saved = (
        await db
          .insert(lessonProgress)
          .values({
            studentId,
            studentName: nextName,
            className: nextClass,
            quizTotal: QUIZ.length,
            lastSeenAt: new Date(),
          })
          .returning()
      )[0];
    }

    const finalPin = unlock
      ? undefined
      : (await db.select().from(teacherNames).where(eq(teacherNames.studentId, studentId)).limit(1))[0];

    return jsonResponse({ ok: true, updated: true, unlocked: unlock, student: toRecord(saved, finalPin) });
  } catch (error) {
    return errorResponse("تعذّر تحديث بيانات الطالب", 500, { detail: String(error) });
  }
}

export async function DELETE(request: Request) {
  if (!isTeacherRequest(request)) {
    return errorResponse("غير مصرّح: رمز المعلم مطلوب لحذف السجلات", 401);
  }
  const url = new URL(request.url);
  const studentId = (url.searchParams.get("studentId") ?? "").trim();
  if (!studentId) return errorResponse("معرّف الطالب (studentId) مطلوب", 422);

  try {
    const deleted = await db.delete(lessonProgress).where(eq(lessonProgress.studentId, studentId)).returning();
    const unpin = url.searchParams.get("unpin") !== "false";
    if (unpin) {
      await db.delete(teacherNames).where(and(eq(teacherNames.studentId, studentId)));
    }
    return jsonResponse({ ok: true, deleted: deleted.length > 0, studentId, unpinned: unpin });
  } catch (error) {
    return errorResponse("تعذّر حذف السجل", 500, { detail: String(error) });
  }
}
