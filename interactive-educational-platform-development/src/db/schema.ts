import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Data stored directly inside PostgreSQL (required for the custom sound library).
 * Works both on a local PostgreSQL instance and on Neon serverless Postgres.
 */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

/** تقدّم الطلاب في الدرس التفاعلي */
export const lessonProgress = pgTable("lesson_progress", {
  id: serial("id").primaryKey(),
  studentId: varchar("student_id", { length: 80 }).notNull().unique(),
  studentName: text("student_name").notNull(),
  className: varchar("class_name", { length: 24 }).notNull(),
  currentSlide: integer("current_slide").notNull().default(1),
  maxSlide: integer("max_slide").notNull().default(1),
  quizScore: integer("quiz_score").notNull().default(0),
  quizTotal: integer("quiz_total").notNull().default(0),
  activities: jsonb("activities")
    .$type<Record<string, unknown>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  completed: boolean("completed").notNull().default(false),
  visits: integer("visits").notNull().default(1),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * الأسماء والفصول المثبتة من قِبل المعلم.
 * عند وجود سجل هنا يتم تجاوز أي اسم/فصل يرسله الطالب (لا يستطيع الطالب تغييرهما).
 */
export const teacherNames = pgTable("teacher_names", {
  id: serial("id").primaryKey(),
  studentId: varchar("student_id", { length: 80 }).notNull().unique(),
  studentName: text("student_name").notNull(),
  className: varchar("class_name", { length: 24 }).notNull(),
  locked: boolean("locked").notNull().default(true),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** مكتبة الأصوات المخصصة للمعلم — الملفات محفوظة كـ BYTEA داخل قاعدة البيانات */
export const lessonSounds = pgTable("lesson_sounds", {
  id: serial("id").primaryKey(),
  soundKey: varchar("sound_key", { length: 64 }).notNull().unique(),
  label: text("label").notNull(),
  mimeType: varchar("mime_type", { length: 120 }).notNull(),
  fileSize: integer("file_size").notNull(),
  data: bytea("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LessonProgressRow = typeof lessonProgress.$inferSelect;
export type TeacherNameRow = typeof teacherNames.$inferSelect;
export type LessonSoundRow = typeof lessonSounds.$inferSelect;
