"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { evaluateCertificate } from "@/lib/certificate";
import { CLASS_OPTIONS } from "@/lib/classes";
import { LESSON_META, SOUND_SLOTS, TOTAL_SLIDES } from "@/lib/lesson";
import type { SoundMeta, StudentRecord, TeacherReport } from "@/lib/types";

const PASSCODE_KEY = "zakat_teacher_passcode";
const MAX_SOUND_BYTES = 4 * 1024 * 1024;

type Tab = "students" | "sounds" | "api";

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("ar-SA", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
  } catch {
    return new Date(value).toLocaleString("ar");
  }
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} بايت`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} كيلوبايت`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} ميجابايت`;
}

const STAT_TONES = [
  "border-brand-200 bg-gradient-to-bl from-brand-50 to-white text-brand-800",
  "border-gold-300 bg-gradient-to-bl from-gold-50 to-white text-gold-800",
  "border-sky-200 bg-gradient-to-bl from-sky-50 to-white text-sky-700",
  "border-grape-200 bg-gradient-to-bl from-grape-50 to-white text-grape-700",
  "border-coral-200 bg-gradient-to-bl from-coral-50 to-white text-coral-700",
  "border-brand-200 bg-gradient-to-bl from-brand-50 to-white text-brand-800",
];

function StatCard({ icon, label, value, hint, index = 0 }: { icon: string; label: string; value: string; hint?: string; index?: number }) {
  return (
    <div className={`rounded-[1.5rem] border-4 p-3 shadow-sm ${STAT_TONES[index % STAT_TONES.length]}`}>
      <div className="flex items-center justify-between">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/80 text-lg shadow-sm">{icon}</span>
        <span className="font-display text-2xl">{value}</span>
      </div>
      <p className="mt-1 text-sm font-extrabold">{label}</p>
      {hint ? <p className="text-[10px] font-bold opacity-70">{hint}</p> : null}
    </div>
  );
}

export default function TeacherDashboard() {
  const [passcode, setPasscode] = useState("");
  const [passcodeInput, setPasscodeInput] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  const [report, setReport] = useState<TeacherReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("students");

  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [printScope, setPrintScope] = useState("all");
  const [printDialog, setPrintDialog] = useState(false);
  const [sortKey, setSortKey] = useState<"name" | "score" | "progress" | "recent">("name");

  const [editing, setEditing] = useState<StudentRecord | null>(null);
  const [editName, setEditName] = useState("");
  const [editClass, setEditClass] = useState<string>(CLASS_OPTIONS[0]);
  const [editLock, setEditLock] = useState(true);
  const [editReset, setEditReset] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newClass, setNewClass] = useState<string>(CLASS_OPTIONS[0]);
  const [addBusy, setAddBusy] = useState(false);

  const [uploading, setUploading] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<unknown>(null);
  const [diagBusy, setDiagBusy] = useState(false);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/progress?all=true", { cache: "no-store" });
      const data = (await response.json()) as TeacherReport;
      if (data.ok) setReport(data);
      else setError("تعذّر تحميل التقرير");
    } catch {
      setError("تعذّر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }, []);

  const verifyAndStore = useCallback(async (rawCode: string) => {
    const code = rawCode
      .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
      .replace(/\s+/g, "")
      .trim();
    if (!code) return false;
    try {
      const response = await fetch("/api/teacher/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-teacher-passcode": code },
        body: JSON.stringify({ passcode: code }),
      });
      if (!response.ok) return false;
      window.sessionStorage.setItem(PASSCODE_KEY, code);
      window.localStorage.setItem(PASSCODE_KEY, code);
      setPasscode(code);
      setPasscodeInput("");
      setAuthed(true);
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get("passcode");
    const stored = url.searchParams.get("p") ?? window.localStorage.getItem(PASSCODE_KEY) ?? window.sessionStorage.getItem(PASSCODE_KEY);
    const candidate = fromUrl ?? stored;
    if (!candidate) return;
    void verifyAndStore(candidate).then((ok) => {
      if (!ok) {
        window.localStorage.removeItem(PASSCODE_KEY);
        setAuthError("انتهت صلاحية الجلسة، يرجى إدخال رمز الدخول من جديد.");
      } else if (fromUrl) {
        url.searchParams.delete("passcode");
        url.searchParams.delete("p");
        window.history.replaceState({}, "", url.toString());
      }
    });
  }, [verifyAndStore]);

  useEffect(() => {
    if (authed) void loadReport();
  }, [authed, loadReport]);

  const login = async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      const ok = await verifyAndStore(passcodeInput);
      if (!ok) setAuthError("رمز الدخول غير صحيح، حاول مرة أخرى.");
      else notify("مرحبًا بك في لوحة تحكم المعلم");
    } finally {
      setAuthBusy(false);
    }
  };

  const logout = () => {
    window.sessionStorage.removeItem(PASSCODE_KEY);
    window.localStorage.removeItem(PASSCODE_KEY);
    setAuthed(false);
    setPasscode("");
    setReport(null);
  };

  const students = useMemo<StudentRecord[]>(() => report?.students ?? [], [report]);
  const sounds = useMemo<SoundMeta[]>(() => report?.sounds ?? [], [report]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = students.filter((student) => {
      const matchesClass = classFilter === "all" || student.className === classFilter;
      const matchesTerm =
        !term ||
        student.studentName.toLowerCase().includes(term) ||
        student.className.toLowerCase().includes(term) ||
        student.studentId.toLowerCase().includes(term);
      return matchesClass && matchesTerm;
    });
    return list.sort((a, b) => {
      if (sortKey === "score") return b.quizScore - a.quizScore;
      if (sortKey === "progress") return b.maxSlide - a.maxSlide;
      if (sortKey === "recent") {
        const aTime = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
        const bTime = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
        return bTime - aTime;
      }
      return a.studentName.localeCompare(b.studentName, "ar");
    });
  }, [students, classFilter, search, sortKey]);

  const groups = useMemo(() => {
    const map = new Map<string, StudentRecord[]>();
    for (const student of filtered) {
      const list = map.get(student.className) ?? [];
      list.push(student);
      map.set(student.className, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], "ar"));
  }, [filtered]);

  /** مجموعة الطباعة/PDF حسب الاختيار: كل الفصول أو فصل أ أو فصل ب */
  const printGroups = useMemo(() => {
    const scoped = students.filter((student) => printScope === "all" || student.className === printScope);
    const map = new Map<string, StudentRecord[]>();
    for (const student of scoped) {
      const list = map.get(student.className) ?? [];
      list.push(student);
      map.set(student.className, list);
    }
    const sorted = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], "ar"));
    return sorted.map(([groupClass, list]) => [
      groupClass,
      [...list].sort((a, b) => a.studentName.localeCompare(b.studentName, "ar")),
    ]) as [string, StudentRecord[]][];
  }, [students, printScope]);

  const printStudentsCount = useMemo(() => printGroups.reduce((sum, [, list]) => sum + list.length, 0), [printGroups]);

  const runPrint = (scope: string) => {
    setPrintScope(scope);
    setTab("students");
    setPrintDialog(false);
    notify("في نافذة الطباعة اختر «حفظ كـ PDF» وفعّل «رسومات الخلفية» للألوان");
    window.setTimeout(() => window.print(), 400);
  };

  const openEdit = (student: StudentRecord) => {
    setEditing(student);
    setEditName(student.studentName);
    setEditClass(student.className);
    setEditLock(student.locked !== false);
    setEditReset(false);
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (editName.trim().length < 3) {
      setError("اسم الطالب يجب أن يكون ٣ أحرف على الأقل");
      return;
    }
    setEditBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/progress", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-teacher-passcode": passcode },
        body: JSON.stringify({
          studentId: editing.studentId,
          studentName: editName.trim(),
          className: editClass,
          locked: editLock,
          resetProgress: editReset,
        }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "تعذّر التحديث");
      setEditing(null);
      notify(editLock ? "تم حفظ الاسم والفصل وتثبيتهما للطالب ✓" : "تم تحديث البيانات وإلغاء التثبيت ✓");
      await loadReport();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذّر التحديث");
    } finally {
      setEditBusy(false);
    }
  };

  const removeStudent = async (student: StudentRecord) => {
    if (!window.confirm(`هل تريد حذف سجل الطالب «${student.studentName}»؟ سيُحذف التقدم نهائيًا.`)) return;
    try {
      const response = await fetch(`/api/progress?studentId=${encodeURIComponent(student.studentId)}&passcode=${encodeURIComponent(passcode)}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "تعذّر الحذف");
      notify("تم حذف السجل بنجاح");
      await loadReport();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذّر الحذف");
    }
  };

  const addStudent = async () => {
    const cleanName = newName.replace(/\s+/g, " ").trim();
    if (cleanName.length < 3) {
      setError("اسم الطالب يجب أن يكون ٣ أحرف على الأقل");
      return;
    }
    setAddBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/progress", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-teacher-passcode": passcode },
        body: JSON.stringify({
          studentId: crypto.randomUUID(),
          studentName: cleanName,
          className: newClass,
          locked: true,
          create: true,
        }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "تعذّر إضافة الطالب");
      setAdding(false);
      setNewName("");
      notify("تمت إضافة الطالب وتثبيت اسمه وفصله ✓");
      await loadReport();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذّر إضافة الطالب");
    } finally {
      setAddBusy(false);
    }
  };

  const uploadSound = async (key: string, file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_SOUND_BYTES) {
      setError("حجم الملف أكبر من 4 ميجابايت (حد Vercel). اختر ملفًا أصغر.");
      return;
    }
    if (!file.type.startsWith("audio/")) {
      setError("الملف يجب أن يكون صوتيًا (mp3, wav, m4a, ogg).");
      return;
    }
    setUploading(key);
    setError(null);
    try {
      const form = new FormData();
      form.append("key", key);
      form.append("file", file);
      form.append("label", SOUND_SLOTS.find((slot) => slot.key === key)?.label ?? key);
      const response = await fetch("/api/sounds", {
        method: "POST",
        headers: { "x-teacher-passcode": passcode },
        body: form,
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "تعذّر رفع الملف");
      notify("تم رفع الملف الصوتي وتخزينه داخل قاعدة البيانات ✓");
      await loadReport();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذّر رفع الملف");
    } finally {
      setUploading(null);
    }
  };

  const deleteSound = async (key: string) => {
    if (!window.confirm("هل تريد حذف هذا الصوت المخصص؟")) return;
    try {
      const response = await fetch(`/api/sounds?key=${encodeURIComponent(key)}&passcode=${encodeURIComponent(passcode)}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "تعذّر الحذف");
      notify("تم حذف الصوت");
      await loadReport();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذّر الحذف");
    }
  };

  const playPreview = (key: string) => {
    const audio = new Audio(`/api/sounds?key=${encodeURIComponent(key)}`);
    void audio.play().catch(() => setError("تعذّر تشغيل الملف الصوتي"));
  };

  const runDiagnostics = async () => {
    setDiagBusy(true);
    try {
      const response = await fetch("/api/progress?diagnose=true", { cache: "no-store" });
      setDiagnostics(await response.json());
    } catch {
      setError("تعذّر تشغيل الفحص التشخيصي");
    } finally {
      setDiagBusy(false);
    }
  };

  if (!authed) {
    return (
      <div className="grid min-h-screen place-items-center px-4 py-8">
        <div className="w-full max-w-lg">
          <div className="overflow-hidden rounded-[2rem] border-4 border-white bg-white shadow-[0_28px_70px_-30px_rgba(4,36,31,0.55)]">
            <div className="relative bg-gradient-to-bl from-brand-800 via-brand-700 to-brand-500 px-6 py-7 text-center text-white">
              <div className="pointer-events-none absolute -left-4 -top-4 text-6xl opacity-20">🔐</div>
              <div className="mx-auto mb-2 grid h-16 w-16 place-items-center rounded-3xl bg-white/15 text-3xl shadow-inner">👨‍🏫</div>
              <h1 className="font-display text-2xl">لوحة تحكم المعلم</h1>
              <p className="mt-1 text-sm font-bold text-brand-100">
                {LESSON_META.teacher} · {LESSON_META.school}
              </p>
            </div>

            <div className="space-y-4 p-5 sm:p-6">
              <div className="rounded-2xl border-2 border-brand-100 bg-brand-50 px-4 py-3 text-center">
                <p className="text-base font-extrabold text-brand-900">🔐 الدخول خاص بالمعلم</p>
                <p className="text-xs font-bold text-brand-500">أدخل رمز الدخول للمتابعة</p>
              </div>

              <input
                id="passcode"
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                dir="ltr"
                aria-label="رمز الدخول"
                className="field !py-4 text-center !text-3xl tracking-[0.5em]"
                placeholder="••••••"
                value={passcodeInput}
                onChange={(event) => setPasscodeInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void login();
                }}
              />

              <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => setPasscodeInput((current) => `${current}${digit}`.slice(0, 8))}
                    className="rounded-2xl border-2 border-sand-200 bg-white py-3 font-display text-xl font-extrabold text-brand-900 transition active:scale-95 hover:border-brand-300 hover:bg-brand-50"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPasscodeInput("")}
                  className="rounded-2xl border-2 border-sand-200 bg-sand-100 py-3 text-base font-extrabold text-brand-700 transition active:scale-95 hover:bg-sand-200"
                >
                  مسح
                </button>
                <button
                  type="button"
                  onClick={() => setPasscodeInput((current) => `${current}0`.slice(0, 8))}
                  className="rounded-2xl border-2 border-sand-200 bg-white py-3 font-display text-xl font-extrabold text-brand-900 transition active:scale-95 hover:border-brand-300 hover:bg-brand-50"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => setPasscodeInput((current) => current.slice(0, -1))}
                  className="rounded-2xl border-2 border-sand-200 bg-sand-100 py-3 text-base font-extrabold text-brand-700 transition active:scale-95 hover:bg-sand-200"
                >
                  ⌫
                </button>
              </div>

              {authError ? (
                <p className="rounded-2xl border border-[#fecdca] bg-[#fff5f5] px-3 py-2 text-center text-sm font-bold text-[#b42318]">{authError}</p>
              ) : null}

              <button
                type="button"
                className="btn btn-primary w-full !py-4 !text-lg"
                onClick={login}
                disabled={authBusy || !passcodeInput.trim()}
              >
                {authBusy ? "جارٍ التحقق…" : "🔓 دخول لوحة التحكم"}
              </button>

              <Link className="btn btn-ghost w-full !text-sm" href="/">← العودة إلى درس الطالب</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="screen-only min-h-screen">
        <header className="sticky top-0 z-30 border-b border-sand-200 bg-sand-50/90 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-700 text-lg text-gold-200 shadow">🕌</span>
              <div>
                <p className="font-display text-sm leading-5 text-brand-900">لوحة تحكم المعلم</p>
                <p className="text-[11px] font-bold text-brand-600">{LESSON_META.teacher} · {LESSON_META.school}</p>
              </div>
            </div>
            <div className="mr-auto flex flex-wrap items-center gap-2">
              <button type="button" className="btn btn-ghost !px-3 !py-1.5 text-xs" onClick={() => void loadReport()} disabled={loading}>
                {loading ? "تحديث…" : "🔄 تحديث البيانات"}
              </button>
              <button
                type="button"
                className="btn btn-gold !px-3 !py-1.5 text-xs"
                title="اختر الفصل ثم اطبع أو احفظ PDF ملوّنًا"
                onClick={() => setPrintDialog(true)}
              >
                🖨️ طباعة / حفظ PDF
              </button>
              <Link className="btn btn-ghost !px-3 !py-1.5 text-xs" href="/">الدرس</Link>
              <button type="button" className="btn btn-danger !px-3 !py-1.5 text-xs" onClick={logout}>خروج</button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl space-y-5 px-4 py-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <StatCard index={0} icon="👨‍🎓" label="عدد الطلاب" value={String(report?.stats.totalStudents ?? 0)} hint="سجلات محفوظة" />
            <StatCard index={1} icon="✅" label="أكملوا الدرس" value={String(report?.stats.completed ?? 0)} hint="حصلوا على الشهادة" />
            <StatCard index={2} icon="📊" label="متوسط الدرجات" value={`${report?.stats.averageScore ?? 0}٪`} hint="في التقويم الختامي" />
            <StatCard index={3} icon="📈" label="متوسط التقدم" value={`${report?.stats.averageProgress ?? 0}٪`} hint={`${TOTAL_SLIDES} شرائح`} />
            <StatCard index={4} icon="⚡" label="نشطون اليوم" value={String(report?.stats.activeToday ?? 0)} hint="آخر ٢٤ ساعة" />
            <StatCard index={5} icon="🔒" label="أسماء مثبتة" value={String(report?.stats.pinnedNames ?? 0)} hint="من جدول المعلم" />
          </div>

          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: "students", label: "📋 تقارير الطلاب" },
                { id: "sounds", label: `🎙️ مكتبة الأصوات (${sounds.length})` },
                { id: "api", label: "🔌 واجهة API والتشخيص" },
              ] as { id: Tab; label: string }[]
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`rounded-full border-4 px-4 py-2 text-sm font-extrabold transition ${
                  tab === item.id
                    ? "border-transparent bg-gradient-to-l from-brand-600 to-brand-400 text-white shadow-sticker"
                    : "border-sand-200 bg-white text-brand-700 hover:border-brand-300"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {toast ? <div className="rounded-2xl border border-[#a6f4c5] bg-[#ecfdf3] px-4 py-3 text-sm font-bold text-[#067647]">{toast}</div> : null}
          {error ? (
            <div className="flex items-start justify-between gap-2 rounded-2xl border border-[#fecdca] bg-[#fff5f5] px-4 py-3 text-sm font-bold text-[#b42318]">
              <span>{error}</span>
              <button type="button" className="text-xs" onClick={() => setError(null)}>إغلاق</button>
            </div>
          ) : null}

          {tab === "students" && (
            <section className="space-y-4">
              {/* اختيار الفصل */}
              <div className="rounded-[1.75rem] border-4 border-white bg-gradient-to-bl from-brand-50 via-white to-gold-50 p-4 shadow-sticker">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-display text-xl text-brand-900">🏫 اختر الفصل لعرض تقريره</h2>
                    <p className="text-sm font-bold text-brand-600">اضغط على بطاقة الفصل لتصفية التقارير، أو اختر «كل الفصول».</p>
                  </div>
                  <button type="button" className="btn btn-primary !px-4 !py-2 text-sm" onClick={() => setAdding(true)}>
                    ➕ إضافة طالب وتثبيت اسمه
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => setClassFilter("all")}
                    className={`rounded-3xl border-4 p-4 text-right transition ${
                      classFilter === "all" ? "border-grape-400 bg-white shadow-lg" : "border-sand-200 bg-white/80 hover:border-grape-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-grape-500 to-grape-300 text-2xl text-white">🏫</span>
                      <span className="font-display text-2xl text-brand-900">{students.length}</span>
                    </div>
                    <p className="mt-2 font-display text-lg text-brand-900">كل الفصول</p>
                    <p className="text-xs font-bold text-brand-500">متوسط التقدم {report?.stats.averageProgress ?? 0}٪</p>
                  </button>

                  {(report?.classes ?? CLASS_OPTIONS).map((option, index) => {
                    const list = students.filter((student) => student.className === option);
                    const avgProgress = list.length
                      ? Math.round(list.reduce((sum, student) => sum + (student.maxSlide / TOTAL_SLIDES) * 100, 0) / list.length)
                      : 0;
                    const letter = option.split("/")[1];
                    const active = classFilter === option;
                    const tone =
                      index % 3 === 0
                        ? { wrap: active ? "border-brand-400 bg-brand-50 shadow-lg" : "border-brand-200 bg-white hover:border-brand-400", badge: "from-brand-500 to-brand-300", bar: "from-brand-500 to-brand-300" }
                        : index % 3 === 1
                          ? { wrap: active ? "border-gold-400 bg-gold-50 shadow-lg" : "border-gold-200 bg-white hover:border-gold-400", badge: "from-gold-500 to-gold-300", bar: "from-gold-500 to-gold-300" }
                          : { wrap: active ? "border-sky-400 bg-sky-50 shadow-lg" : "border-sky-200 bg-white hover:border-sky-400", badge: "from-sky-500 to-sky-300", bar: "from-sky-500 to-sky-300" };
                    return (
                      <button key={option} type="button" onClick={() => setClassFilter(option)} className={`rounded-3xl border-4 p-4 text-right transition ${tone.wrap}`}>
                        <div className="flex items-center justify-between">
                          <span className={`grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ${tone.badge} font-display text-xl text-white`}>
                            {letter}
                          </span>
                          <span className="font-display text-2xl text-brand-900">{list.length}</span>
                        </div>
                        <p className="mt-2 font-display text-lg text-brand-900">الفصل {letter}</p>
                        <p className="text-xs font-bold text-brand-500">{list.length ? `${list.length} طالب · ${option}` : "لا يوجد طلاب بعد"}</p>
                        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-sand-200">
                          <div className={`h-full rounded-full bg-gradient-to-l ${tone.bar}`} style={{ width: `${avgProgress}%` }} />
                        </div>
                        <p className="mt-1 text-xs font-extrabold text-brand-600">متوسط التقدم {avgProgress}٪</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* أدوات التصفية */}
              <div className="card space-y-3 !rounded-[1.75rem] p-4">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-48 grow">
                    <label className="label" htmlFor="search">🔍 بحث بالاسم</label>
                    <input id="search" className="field" placeholder="ابحث عن طالب…" value={search} onChange={(event) => setSearch(event.target.value)} />
                  </div>
                  <div>
                    <label className="label" htmlFor="sort">↕️ ترتيب حسب</label>
                    <select id="sort" className="field" value={sortKey} onChange={(event) => setSortKey(event.target.value as typeof sortKey)}>
                      <option value="name">الاسم</option>
                      <option value="score">درجة الاختبار</option>
                      <option value="progress">التقدم في الشرائح</option>
                      <option value="recent">آخر زيارة</option>
                    </select>
                  </div>
                </div>
                <p className="rounded-2xl bg-sand-100 px-3 py-2 text-xs font-bold leading-6 text-brand-600">
                  المعروض الآن: <strong className="text-brand-900">{classFilter === "all" ? "كل الفصول" : `الفصل ${classFilter.split("/")[1]}`}</strong> · {filtered.length} طالب
                  — الأسماء والفصول تُطبَّع تلقائيًا ({CLASS_OPTIONS.join(" · ")})، وعند التثبيت لا يستطيع الطالب تغييرهما.
                </p>
              </div>

              {groups.length === 0 ? (
                <div className="card !rounded-[1.75rem] p-10 text-center">
                  <p className="text-4xl">📭</p>
                  <p className="mt-2 text-lg font-extrabold text-brand-800">لا توجد سجلات مطابقة</p>
                  <p className="text-sm font-bold text-brand-500">عند بدء الطلاب للدرس ستظهر بياناتهم هنا تلقائيًا.</p>
                </div>
              ) : (
                groups.map(([groupClass, groupStudents], groupIndex) => {
                  const letter = groupClass.split("/")[1];
                  const avgProgress = Math.round(groupStudents.reduce((sum, student) => sum + (student.maxSlide / TOTAL_SLIDES) * 100, 0) / groupStudents.length);
                  const avgScore = Math.round(
                    groupStudents.reduce((sum, student) => sum + (student.quizTotal ? (student.quizScore / student.quizTotal) * 100 : 0), 0) / groupStudents.length,
                  );
                  const completed = groupStudents.filter((student) => student.completed).length;
                  const headGrad = groupIndex % 3 === 1 ? "from-gold-500 via-gold-400 to-brand-300" : "from-brand-600 via-brand-400 to-sky-300";
                  return (
                    <div key={groupClass} className="overflow-hidden rounded-[1.75rem] border-4 border-white bg-white shadow-sticker">
                      <div className={`bg-gradient-to-bl ${headGrad} px-4 py-4 text-white`}>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className="grid h-14 w-14 place-items-center rounded-2xl border-4 border-white bg-white/25 font-display text-2xl">{letter}</span>
                            <div>
                              <h2 className="font-display text-xl leading-7">تقرير الفصل {letter}</h2>
                              <p className="text-xs font-bold text-white/90">{groupClass} · {groupStudents.length} طالب · {completed} أكملوا الدرس</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-2xl bg-white/90 px-3 py-1.5 text-sm font-extrabold text-brand-800">📈 التقدم {avgProgress}٪</span>
                            <span className="rounded-2xl bg-white/90 px-3 py-1.5 text-sm font-extrabold text-gold-700">🎯 الدرجات {avgScore}٪</span>
                            <span className="rounded-2xl bg-white/90 px-3 py-1.5 text-sm font-extrabold text-brand-800">🏅 {completed}/{groupStudents.length}</span>
                          </div>
                        </div>
                        <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/30">
                          <div className="h-full rounded-full bg-gradient-to-l from-gold-300 to-white" style={{ width: `${avgProgress}%` }} />
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[820px] text-right text-sm">
                          <thead>
                            <tr className="bg-sand-100 text-xs text-brand-700">
                              <th className="px-3 py-3 font-extrabold">#</th>
                              <th className="px-3 py-3 font-extrabold">الطالب</th>
                              <th className="px-3 py-3 font-extrabold">الفصل</th>
                              <th className="px-3 py-3 font-extrabold">التقدم</th>
                              <th className="px-3 py-3 font-extrabold">الشرائح</th>
                              <th className="px-3 py-3 font-extrabold">درجة الاختبار</th>
                              <th className="px-3 py-3 font-extrabold">آخر زيارة</th>
                              <th className="px-3 py-3 font-extrabold">الحالة</th>
                              <th className="px-3 py-3 font-extrabold">إجراءات</th>
                            </tr>
                          </thead>
                          <tbody>
                            {groupStudents.map((student, index) => {
                              const percent = Math.round((student.maxSlide / TOTAL_SLIDES) * 100);
                              const scorePct = student.quizTotal ? Math.round((student.quizScore / student.quizTotal) * 100) : 0;
                              const scoreTone =
                                scorePct >= 80 ? "bg-[#eafff4] text-[#05603a] border-[#37d67a]" : scorePct >= 50 ? "bg-gold-50 text-gold-800 border-gold-300" : "bg-coral-50 text-coral-700 border-coral-200";
                              const barTone = percent >= 80 ? "from-brand-500 to-brand-300" : percent >= 40 ? "from-gold-500 to-gold-300" : "from-coral-400 to-coral-300";
                              return (
                                <tr key={student.studentId} className={index % 2 ? "bg-sand-50/60" : "bg-white"}>
                                  <td className="px-3 py-3 font-extrabold text-brand-400">{index + 1}</td>
                                  <td className="px-3 py-3">
                                    <div className="flex items-center gap-2">
                                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-sky-300 text-sm font-extrabold text-white">
                                        {student.studentName.trim().charAt(0)}
                                      </span>
                                      <div>
                                        <div className="font-extrabold text-brand-900">{student.studentName}</div>
                                        <div className="text-[10px] font-bold text-brand-400">{student.visits} زيارة</div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-3 py-3">
                                    <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-extrabold text-brand-700">{student.className}</span>
                                  </td>
                                  <td className="px-3 py-3">
                                    <div className="flex items-center gap-2">
                                      <div className="h-2.5 w-24 overflow-hidden rounded-full bg-sand-200">
                                        <div className={`h-full rounded-full bg-gradient-to-l ${barTone}`} style={{ width: `${percent}%` }} />
                                      </div>
                                      <span className="font-extrabold text-brand-800">{percent}٪</span>
                                    </div>
                                  </td>
                                  <td className="px-3 py-3 font-bold text-brand-700">{student.currentSlide} / {student.maxSlide}</td>
                                  <td className="px-3 py-3">
                                    <span className={`rounded-full border-2 px-2.5 py-1 text-xs font-extrabold ${scoreTone}`}>
                                      {student.quizScore} / {student.quizTotal || "—"}
                                    </span>
                                  </td>
                                  <td className="px-3 py-3 text-[11px] font-bold text-brand-500">{formatDate(student.lastSeenAt)}</td>
                                  <td className="px-3 py-3">
                                    <div className="flex flex-wrap gap-1">
                                      {student.completed ? (
                                        <span className="rounded-full border-2 border-gold-300 bg-gold-50 px-2 py-0.5 text-[11px] font-extrabold text-gold-800">🏅 مكتمل</span>
                                      ) : (
                                        <span className="rounded-full border-2 border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-extrabold text-sky-700">⏳ قيد التقدم</span>
                                      )}
                                      {student.locked ? (
                                        <span className="rounded-full border-2 border-brand-200 bg-brand-50 px-2 py-0.5 text-[11px] font-extrabold text-brand-700">🔒 مثبت</span>
                                      ) : (
                                        <span className="rounded-full border-2 border-sand-300 bg-sand-50 px-2 py-0.5 text-[11px] font-extrabold text-brand-500">مفتوح</span>
                                      )}
                                      {(() => {
                                        const cert = evaluateCertificate({ quizScore: student.quizScore, quizTotal: student.quizTotal, activities: student.activities });
                                        return cert.eligible ? (
                                          <span className="rounded-full border-2 border-[#37d67a] bg-[#eafff4] px-2 py-0.5 text-[11px] font-extrabold text-[#05603a]">🎖️ مستحق</span>
                                        ) : (
                                          <span className="rounded-full border-2 border-coral-300 bg-coral-50 px-2 py-0.5 text-[11px] font-extrabold text-coral-700" title={cert.message}>
                                            🔁 يحتاج إعادة ({cert.activitiesPercent}٪ · {cert.quizScore}/{cert.quizTotal || 7})
                                          </span>
                                        );
                                      })()}
                                    </div>
                                  </td>
                                  <td className="px-3 py-3">
                                    <div className="flex flex-wrap gap-1">
                                      <button type="button" className="btn btn-ghost !px-2.5 !py-1 text-[11px]" onClick={() => openEdit(student)}>✏️ تعديل</button>
                                      <button type="button" className="btn btn-danger !px-2.5 !py-1 text-[11px]" onClick={() => void removeStudent(student)}>🗑️ حذف</button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="bg-sand-100 text-xs font-extrabold text-brand-700">
                              <td className="px-3 py-2" colSpan={3}>المجموع</td>
                              <td className="px-3 py-2">{avgProgress}٪</td>
                              <td className="px-3 py-2">—</td>
                              <td className="px-3 py-2">{avgScore}٪</td>
                              <td className="px-3 py-2" colSpan={3}>{groupStudents.length} طالب · {completed} مكتمل</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  );
                })
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border-4 border-brand-200 bg-gradient-to-l from-brand-50 via-white to-gold-50 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-extrabold text-brand-800">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-600 text-lg text-white">👨‍🏫</span>
                  <span>
                    إعداد ومتابعة المعلم: <strong className="text-brand-900">{LESSON_META.teacher}</strong>
                    <span className="block text-xs font-bold text-brand-500">مدير المدرسة: {LESSON_META.principal} · {LESSON_META.school}</span>
                  </span>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-extrabold text-brand-600">
                  📚 {LESSON_META.subject} · {LESSON_META.grade}
                </span>
              </div>
            </section>
          )}

          {tab === "sounds" && (
            <section className="space-y-4">
              <div className="card space-y-2 p-4">
                <h2 className="font-display text-base text-brand-900">🎙️ مكتبة الأصوات المخصصة</h2>
                <p className="text-xs font-bold leading-6 text-brand-600">
                  تُخزَّن الملفات كبيانات ثنائية <code className="rounded bg-sand-100 px-1">BYTEA</code> داخل جدول{" "}
                  <code className="rounded bg-sand-100 px-1">lesson_sounds</code>، بحد أقصى <strong>4 ميجابايت</strong> لكل ملف
                  (قيود Vercel). تُخدَّم عبر <code className="rounded bg-sand-100 px-1">/api/sounds?key=…</code> مع{" "}
                  <code className="rounded bg-sand-100 px-1">ETag</code> و{" "}
                  <code className="rounded bg-sand-100 px-1">Cache-Control</code>. الملفات الصوتية المرفوعة تحل محل الشرح الصوتي الآلي.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {SOUND_SLOTS.map((slot) => {
                  const uploaded = sounds.find((sound) => sound.soundKey === slot.key) as SoundMeta | undefined;
                  return (
                    <div key={slot.key} className="card p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-extrabold text-brand-900">{slot.label}</p>
                          <p className="text-[10px] font-bold text-brand-500">{slot.hint} · المفتاح: {slot.key}</p>
                        </div>
                        <span className={`chip ${uploaded ? "bg-[#ecfdf3] border-[#a6f4c5] text-[#067647]" : "bg-sand-100 text-brand-500"}`}>
                          {uploaded ? "مرفوع ✓" : "غير مرفوع"}
                        </span>
                      </div>
                      {uploaded ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-sand-50 px-3 py-2 text-[10px] font-bold text-brand-600">
                          <span>{formatBytes(uploaded.fileSize)}</span>
                          <span>· {uploaded.mimeType}</span>
                          <span>· {formatDate(uploaded.updatedAt)}</span>
                        </div>
                      ) : null}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <label className="btn btn-primary !px-3 !py-1.5 text-[11px] cursor-pointer">
                          {uploading === slot.key ? "جارٍ الرفع…" : uploaded ? "استبدال الملف" : "رفع ملف صوتي"}
                          <input
                            type="file"
                            accept="audio/*"
                            className="hidden"
                            disabled={uploading === slot.key}
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              event.target.value = "";
                              void uploadSound(slot.key, file);
                            }}
                          />
                        </label>
                        {uploaded ? (
                          <>
                            <button type="button" className="btn btn-ghost !px-3 !py-1.5 text-[11px]" onClick={() => playPreview(slot.key)}>▶ تشغيل</button>
                            <button type="button" className="btn btn-danger !px-3 !py-1.5 text-[11px]" onClick={() => void deleteSound(slot.key)}>حذف</button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {tab === "api" && (
            <section className="space-y-4">
              <div className="space-y-3 rounded-[1.75rem] border-4 border-white bg-gradient-to-bl from-grape-50 via-white to-sky-50 p-4 shadow-sticker">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-grape-500 to-sky-300 text-2xl text-white">🔌</span>
                  <div>
                    <h2 className="font-display text-xl text-brand-900">واجهة البرمجة والتشخيص</h2>
                    <p className="text-xs font-bold text-brand-600">هذه الصفحة متاحة داخل لوحة المعلم فقط، بعد تسجيل الدخول.</p>
                  </div>
                  <button type="button" className="btn btn-primary mr-auto !px-4 !py-2 text-sm" onClick={() => void runDiagnostics()} disabled={diagBusy}>
                    {diagBusy ? "جارٍ الفحص…" : "🧪 تشغيل الفحص التشخيصي"}
                  </button>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    { title: "lesson_progress", icon: "📋", color: "border-brand-200 bg-brand-50 text-brand-800", lines: ["student_id (unique)", "student_name · class_name", "current_slide · max_slide", "quiz_score · quiz_total", "activities (JSONB)", "completed · visits"] },
                    { title: "teacher_names", icon: "🔒", color: "border-gold-300 bg-gold-50 text-gold-800", lines: ["student_id (unique)", "student_name", "class_name", "locked", "note"] },
                    { title: "lesson_sounds", icon: "🎙️", color: "border-grape-200 bg-grape-50 text-grape-700", lines: ["sound_key (unique)", "label · mime_type", "file_size", "data (BYTEA)", "حد أقصى 4MB"] },
                  ].map((table) => (
                    <div key={table.title} className={`rounded-2xl border-4 p-3 ${table.color}`}>
                      <p className="font-display text-sm">{table.icon} <span dir="ltr">{table.title}</span></p>
                      <ul className="mt-2 space-y-1">
                        {table.lines.map((line) => (
                          <li key={line} className="text-[11px] font-bold opacity-90" dir="auto">• {line}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border-2 border-brand-200 bg-white px-3 py-2 text-xs font-bold leading-6 text-brand-700">
                  <strong className="text-brand-900">تطبيع أسماء الفصول تلقائيًا:</strong> «3أ» · «٣ / أ» · «3-A» · «الصف الثالث أ» ← <code className="rounded bg-sand-100 px-1">3/أ</code> — وكذلك «ثالث ب» ← <code className="rounded bg-sand-100 px-1">3/ب</code>.
                </div>
              </div>

              <div className="card !rounded-[1.75rem] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-base text-brand-900">📚 مسارات الواجهة المتاحة</h2>
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[640px] text-right text-[11px]">
                    <thead className="bg-sand-50 text-brand-600">
                      <tr>
                        <th className="px-3 py-2">الطريقة</th>
                        <th className="px-3 py-2">المسار</th>
                        <th className="px-3 py-2">الوظيفة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["POST", "/api/progress", "حفظ/تحديث تقدم الطالب (مع تثبيت الاسم والفصل تلقائيًا)"],
                        ["GET", "/api/progress?studentId=…", "استئناف التقدم عند دخول الطالب"],
                        ["GET", "/api/progress?name=…&className=…", "استئناف بالاسم والفصل المطبعين"],
                        ["GET", "/api/progress?all=true", "تقرير شامل لكل الطلاب والفصول والإحصاءات"],
                        ["GET", "/api/progress?diagnose=true", "وضع تشخيصي: الجداول، العدّادات، تطبيع الفصول"],
                        ["PATCH", "/api/progress", "تعديل المعلم لاسم الطالب/فصله وتثبيتهما (رمز المعلم)"],
                        ["DELETE", "/api/progress?studentId=…", "حذف سجل الطالب (رمز المعلم)"],
                        ["GET", "/api/sounds", "قائمة الأصوات المرفوعة وخاناتها"],
                        ["GET", "/api/sounds?key=…", "استرجاع الملف الصوتي (ETag + Cache-Control)"],
                        ["POST", "/api/sounds", "رفع ملف صوتي (multipart أو base64) بحد 4MB"],
                        ["DELETE", "/api/sounds?key=…", "حذف ملف صوتي (رمز المعلم)"],
                        ["GET", "/api/teacher/auth", "التحقق من رمز المعلم وصلاحياته"],
                        ["GET", "/api/health", "فحص اتصال قاعدة البيانات"],
                      ].map(([method, path, description]) => (
                        <tr key={`${method}-${path}`} className="border-t border-sand-100">
                          <td className="px-3 py-2">
                            <span className={`rounded-md px-1.5 py-0.5 font-extrabold ${method === "GET" ? "bg-brand-50 text-brand-700" : method === "POST" ? "bg-[#ecfdf3] text-[#067647]" : method === "DELETE" ? "bg-[#fff5f5] text-[#b42318]" : "bg-gold-50 text-gold-700"}`}>
                              {method}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono text-[10px] font-bold text-brand-800" dir="ltr">{path}</td>
                          <td className="px-3 py-2 font-bold text-brand-600">{description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 rounded-xl bg-sand-100 px-3 py-2 text-[11px] font-bold text-brand-600">
                  جميع المسارات تدعم CORS (<code>Access-Control-Allow-Origin: *</code>) وتستجيب لطلبات <code>OPTIONS</code> التمهيدية،
                  وهي متوافقة مع Vercel Serverless وقاعدة بيانات Neon PostgreSQL.
                </p>
              </div>
              {diagnostics ? (
                <div className="card p-4">
                  <h3 className="font-display mb-2 text-sm text-brand-900">نتيجة الفحص التشخيصي</h3>
                  <pre className="max-h-96 overflow-auto rounded-xl bg-brand-950 p-4 text-[10px] leading-5 text-brand-100" dir="ltr">
{JSON.stringify(diagnostics, null, 2)}
                  </pre>
                </div>
              ) : null}
            </section>
          )}
        </main>
      </div>


      {/* خيارات الطباعة: فصل أ أو فصل ب أو الكل */}
      {printDialog ? (
        <div className="screen-only fixed inset-0 z-50 grid place-items-center bg-brand-950/60 px-4 py-6">
          <div className="w-full max-w-lg rounded-[1.75rem] border-4 border-white bg-white p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-xl text-brand-900">🖨️ خيارات الطباعة / PDF</h3>
                <p className="text-xs font-bold text-brand-600">اختر الفصل المطلوب طباعته، سيُطبع كل فصل في صفحة مستقلة بالألوان.</p>
              </div>
              <button type="button" onClick={() => setPrintDialog(false)} className="rounded-full bg-sand-100 px-3 py-1 text-sm font-extrabold text-brand-600">إغلاق</button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { scope: "all", label: "كل الفصول", letter: "🏫", grad: "from-grape-500 to-grape-300", count: students.length },
                ...(report?.classes ?? CLASS_OPTIONS).map((option, index) => ({
                  scope: option,
                  label: `الفصل ${option.split("/")[1]}`,
                  letter: option.split("/")[1],
                  grad: index % 2 === 0 ? "from-brand-500 to-brand-300" : "from-gold-500 to-gold-300",
                  count: students.filter((student) => student.className === option).length,
                })),
              ].map((option) => (
                <button
                  key={option.scope}
                  type="button"
                  onClick={() => runPrint(option.scope)}
                  className="rounded-2xl border-4 border-sand-200 bg-white p-3 text-center transition hover:-translate-y-1 hover:border-brand-300"
                >
                  <span className={`mx-auto mb-2 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br ${option.grad} font-display text-2xl text-white`}>
                    {option.letter}
                  </span>
                  <span className="block font-display text-base text-brand-900">{option.label}</span>
                  <span className="block text-xs font-bold text-brand-500">{option.count} طالب</span>
                  <span className="mt-2 block rounded-full bg-brand-600 px-2 py-1 text-xs font-extrabold text-white">🖨️ طباعة / PDF</span>
                </button>
              ))}
            </div>

            <p className="mt-3 rounded-2xl bg-sand-100 px-3 py-2 text-xs font-bold leading-6 text-brand-600">
              💡 عند ظهور نافذة الطباعة: اختر الوجهة <strong>«حفظ كـ PDF»</strong> وفعّل خيار <strong>«رسومات الخلفية / Background graphics»</strong> لتظهر الألوان والجداول المنسّقة.
            </p>
          </div>
        </div>
      ) : null}

      {/* ===== تقرير PDF ملوّن: كل فصل في صفحة مستقلة ===== */}
      <div className="print-only report-sheet">
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-[#9be7c2] bg-[#eafaf1] px-4 py-2 text-[11px] font-extrabold text-[#0a533b]">
          <span>👨‍🏫 المعلم: {LESSON_META.teacher}</span>
          <span>🏫 مدير المدرسة: {LESSON_META.principal}</span>
          <span>🏫 {LESSON_META.school}</span>
          <span>📅 {formatDate(new Date().toISOString())}</span>
        </div>

        <div className="report-head mb-3 text-center">
          <p className="text-[10px] font-bold text-white/90">المملكة العربية السعودية · وزارة التعليم</p>
          <p className="text-xl font-extrabold">مدرسة {LESSON_META.school}</p>
          <p className="text-sm font-bold">تقرير متابعة {LESSON_META.lessonNumber}: {LESSON_META.title}</p>
          <p className="text-[11px] font-bold text-white/90">{LESSON_META.subject} · {LESSON_META.grade}</p>
          <p className="text-[11px] font-bold text-white/90">المعلم: {LESSON_META.teacher} · مدير المدرسة: {LESSON_META.principal}</p>
        </div>

        {/* ملخص عام */}
        <div className="mb-3 grid grid-cols-3 gap-2">
          {[
            { label: "عدد الطلاب", value: String(report?.stats.totalStudents ?? 0), tone: "border-[#0a6849] bg-[#eafaf1] text-[#0a533b]" },
            { label: "أكملوا الدرس", value: String(report?.stats.completed ?? 0), tone: "border-[#cc7a00] bg-[#fff9e6] text-[#7a4b00]" },
            { label: "متوسط الدرجات", value: `${report?.stats.averageScore ?? 0}٪`, tone: "border-[#6431c8] bg-[#f4eeff] text-[#4c1d95]" },
            { label: "متوسط التقدم", value: `${report?.stats.averageProgress ?? 0}٪`, tone: "border-[#14a06d] bg-[#eafaf1] text-[#05603a]" },
            { label: "نشطون اليوم", value: String(report?.stats.activeToday ?? 0), tone: "border-[#1f7fe0] bg-[#eaf6ff] text-[#145297]" },
            { label: "أسماء مثبتة", value: String(report?.stats.pinnedNames ?? 0), tone: "border-[#f4431f] bg-[#fff1ee] text-[#9a230f]" },
          ].map((stat) => (
            <div key={stat.label} className={`rounded-xl border-2 px-3 py-2 text-center ${stat.tone}`}>
              <p className="text-[10px] font-extrabold opacity-80">{stat.label}</p>
              <p className="text-lg font-extrabold">{stat.value}</p>
            </div>
          ))}
        </div>

        <p className="mb-2 rounded-lg border border-[#9be7c2] bg-white px-3 py-1 text-center text-[10px] font-extrabold text-[#0a533b]">
          نطاق التقرير: {printScope === "all" ? "كل الفصول" : `الفصل ${printScope.split("/")[1]} فقط`} · عدد الطلاب: {printStudentsCount}
        </p>

        {printGroups.length === 0 ? <p className="text-center text-sm font-bold">لا توجد بيانات.</p> : null}

        {printGroups.map(([groupClass, groupStudents], groupIndex) => {
          const avgProgress = Math.round(groupStudents.reduce((sum, student) => sum + (student.maxSlide / TOTAL_SLIDES) * 100, 0) / groupStudents.length);
          const avgScore = Math.round(
            groupStudents.reduce((sum, student) => sum + (student.quizTotal ? (student.quizScore / student.quizTotal) * 100 : 0), 0) / groupStudents.length,
          );
          const completed = groupStudents.filter((student) => student.completed).length;
          return (
            <div key={`print-${groupClass}`} className="print-page">
              <div className={`report-class-head mb-2 flex items-center justify-between ${groupIndex % 2 === 1 ? "alt" : ""}`}>
                <p className="text-base font-extrabold">🏫 تقرير الفصل {groupClass.split("/")[1]} — {groupClass}</p>
                <p className="text-[11px] font-bold">الطلاب: {groupStudents.length} · المكتملون: {completed} · متوسط التقدم: {avgProgress}٪ · متوسط الدرجات: {avgScore}٪</p>
              </div>

              <table className="report-table">
                <thead>
                  <tr>
                    <th style={{ width: "26px" }}>م</th>
                    <th>اسم الطالب</th>
                    <th>الفصل</th>
                    <th>التقدم</th>
                    <th>الشريحة</th>
                    <th>الدرجة</th>
                    <th>الحالة</th>
                    <th>ملاحظات المعلم</th>
                  </tr>
                </thead>
                <tbody>
                  {groupStudents.map((student, index) => {
                    const percent = Math.round((student.maxSlide / TOTAL_SLIDES) * 100);
                    const scorePct = student.quizTotal ? Math.round((student.quizScore / student.quizTotal) * 100) : 0;
                    const barColor = percent >= 80 ? "#14a06d" : percent >= 40 ? "#ffb81c" : "#f4431f";
                    const scoreClass = scorePct >= 80 ? "green" : scorePct >= 50 ? "gold" : "coral";
                    return (
                      <tr key={`print-${student.studentId}`}>
                        <td className="text-center font-extrabold">{index + 1}</td>
                        <td className="font-extrabold">{student.studentName}</td>
                        <td className="text-center">{student.className}</td>
                        <td>
                          <span className="report-bar"><span style={{ width: `${percent}%`, background: barColor }} /></span>
                          <span className="mr-1 font-extrabold">{percent}٪</span>
                        </td>
                        <td className="text-center">{student.currentSlide} / {student.maxSlide}</td>
                        <td className="text-center">
                          <span className={`report-badge ${scoreClass}`}>{student.quizScore} / {student.quizTotal || "—"}</span>
                        </td>
                        <td className="text-center">
                          <span className={`report-badge ${student.completed ? "gold" : "purple"}`}>
                            {student.completed ? "🏅 مكتمل" : "⏳ قيد التقدم"}
                          </span>
                          {(() => {
                            const cert = evaluateCertificate({ quizScore: student.quizScore, quizTotal: student.quizTotal, activities: student.activities });
                            return (
                              <span className={`report-badge mr-1 ${cert.eligible ? "green" : "coral"}`}>
                                {cert.eligible ? "🎖️ مستحق" : "🔁 إعادة"}
                              </span>
                            );
                          })()}
                          {student.locked ? <span className="report-badge green mr-1">🔒 مثبت</span> : null}
                        </td>
                        <td></td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={8} style={{ background: "#eafaf1", padding: "6px", fontSize: "10px", fontWeight: 800, color: "#0a533b" }}>
                      المجموع: {groupStudents.length} طالبًا · أكملوا: {completed} · متوسط التقدم {avgProgress}٪ · متوسط الدرجات {avgScore}٪
                    </td>
                  </tr>
                </tfoot>
              </table>

              <div className="report-signatures mt-6">
                <div className="report-signature-box">
                  <p className="report-signature-name">اسم المعلم: {LESSON_META.teacher}</p>
                  <p className="report-signature-label">التوقيع</p>
                  <div className="report-signature-line" />
                </div>
                <div className="report-signature-box">
                  <p className="report-signature-name">مدير المدرسة: {LESSON_META.principal}</p>
                  <p className="report-signature-label">التوقيع</p>
                  <div className="report-signature-line" />
                </div>
              </div>
              <p className="report-date">📅 تاريخ التقرير: {new Date().toLocaleDateString("ar-SA")}</p>
            </div>
          );
        })}
      </div>

      {editing ? (
        <div className="screen-only fixed inset-0 z-50 grid place-items-center bg-brand-950/50 px-4 py-6">
          <div className="card animate-pop w-full max-w-md p-5">
            <h3 className="font-display text-lg text-brand-900">تعديل بيانات الطالب</h3>
            <p className="mb-3 text-[11px] font-bold text-brand-500">المعرّف: {editing.studentId.slice(0, 12)}…</p>
            <div className="space-y-3">
              <div>
                <label className="label" htmlFor="edit-name">اسم الطالب</label>
                <input id="edit-name" className="field" value={editName} onChange={(event) => setEditName(event.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="edit-class">الفصل</label>
                <select id="edit-class" className="field" value={editClass} onChange={(event) => setEditClass(event.target.value)}>
                  {CLASS_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-start gap-2 rounded-xl border border-sand-200 bg-sand-50 px-3 py-2 text-xs font-bold text-brand-700">
                <input type="checkbox" className="mt-0.5" checked={editLock} onChange={(event) => setEditLock(event.target.checked)} />
                <span>تثبيت الاسم والفصل في جدول المعلم (لا يستطيع الطالب تغييرهما بعد ذلك)</span>
              </label>
              <label className="flex items-start gap-2 rounded-xl border border-sand-200 bg-sand-50 px-3 py-2 text-xs font-bold text-brand-700">
                <input type="checkbox" className="mt-0.5" checked={editReset} onChange={(event) => setEditReset(event.target.checked)} />
                <span>تصفير تقدم الطالب ودرجته للبدء من جديد</span>
              </label>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)} disabled={editBusy}>إلغاء</button>
              <button type="button" className="btn btn-primary" onClick={() => void saveEdit()} disabled={editBusy}>
                {editBusy ? "جارٍ الحفظ…" : "حفظ التعديلات"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
