"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import LessonImage from "@/components/LessonImage";
import LessonPlayer from "@/components/LessonPlayer";

import { CLASS_OPTIONS } from "@/lib/classes";
import { EVIDENCE, LESSON_META, SLIDES, SOUND_SLOTS, TOTAL_SLIDES, VIRTUE } from "@/lib/lesson";
import type { SoundMeta, StudentRecord } from "@/lib/types";

type SaveState = "idle" | "saving" | "saved" | "error";
type StoredSession = { studentId: string; studentName: string; className: string };

const STORAGE_KEY = "zakat_session_v1";

const STRATEGIES = [
  { icon: "🧠", title: "التهيئة والعصف الذهني", text: "استدعاء خبرات الطالب عن الزكاة قبل بناء المفهوم." },
  { icon: "📖", title: "تدبّر الآيات وحفظها", text: "ترتيب كلمات آية النور (٥٦) وربطها بوجوب الزكاة." },
  { icon: "🔍", title: "التعلّم بالاكتشاف", text: "استنتاج فضل الزكاة من آية التوبة (١٠٣)." },
  { icon: "🧩", title: "التصنيف والتعاون", text: "سحب البطاقات وتصنيفها بين الإخلاص لله والمتابعة للنبي ﷺ." },
  { icon: "🖼️", title: "التعلّم بالصور", text: "تحليل صور إضاءة: البركة ونزعها وانقطاع الأمطار." },
  { icon: "🤝", title: "التعلّم التعاوني", text: "كتابة ثلاث طرق لادّخار المال مع المجموعة." },
  { icon: "🧮", title: "التعلّم بالعمل", text: "تطبيق حسابي مبسط لزكاة المال المدّخر ٢٫٥٪." },
  { icon: "📊", title: "التقويم والتأمل", text: "أسئلة التقويم الكتابية واختبار محاسَب ثم تأمّل ختامي." },
];

export default function StudentPortal() {
  const [student, setStudent] = useState<StudentRecord | null>(null);
  const [sounds, setSounds] = useState<SoundMeta[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedSession, setSavedSession] = useState<StoredSession | null>(null);
  const [savedRecord, setSavedRecord] = useState<StudentRecord | null>(null);
  const [name, setName] = useState("");
  const [className, setClassName] = useState<string>(CLASS_OPTIONS[0]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const studentRef = useRef<StudentRecord | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let stored: StoredSession | null = null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      stored = raw ? (JSON.parse(raw) as StoredSession) : null;
    } catch {
      stored = null;
    }
    if (stored?.studentId) {
      setSavedSession(stored);
      setName((current) => current || stored!.studentName);
      setClassName((current) => stored!.className || current);
      fetch(`/api/progress?studentId=${encodeURIComponent(stored.studentId)}`)
        .then((response) => response.json())
        .then((data: { found?: boolean; student?: StudentRecord }) => {
          if (data.found && data.student) setSavedRecord(data.student);
        })
        .catch(() => undefined);
    }

    fetch("/api/sounds")
      .then((response) => response.json())
      .then((data: { sounds?: SoundMeta[] }) => setSounds(Array.isArray(data.sounds) ? data.sounds : []))
      .catch(() => setSounds([]));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const persist = useCallback((record: StudentRecord, immediate = false) => {
    const send = () => {
      setSaveState("saving");
      fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: record.studentId,
          studentName: record.studentName,
          className: record.className,
          currentSlide: record.currentSlide,
          maxSlide: record.maxSlide,
          quizScore: record.quizScore,
          quizTotal: record.quizTotal,
          activities: record.activities,
          completed: record.completed,
        }),
      })
        .then(async (response) => {
          const data = (await response.json()) as { ok?: boolean; student?: StudentRecord; error?: string };
          if (!response.ok || !data.ok) throw new Error(data.error ?? "فشل الحفظ");
          setSaveState("saved");
        })
        .catch(() => setSaveState("error"));
    };

    if (timerRef.current) clearTimeout(timerRef.current);
    if (immediate) send();
    else timerRef.current = setTimeout(send, 700);
  }, []);

  const handleChange = useCallback(
    (patch: Partial<StudentRecord>, immediate = false) => {
      const current = studentRef.current;
      if (!current) return;
      const next: StudentRecord = { ...current, ...patch };
      studentRef.current = next;
      setStudent(next);
      persist(next, immediate);
    },
    [persist],
  );

  const enterLesson = useCallback((record: StudentRecord, session: StoredSession) => {
    const normalized: StudentRecord = {
      ...record,
      studentName: record.studentName || session.studentName,
      className: record.className || session.className,
      activities: record.activities ?? {},
    };
    studentRef.current = normalized;
    setStudent(normalized);
    setSaveState("saved");
    setNotice(null);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ studentId: normalized.studentId, studentName: normalized.studentName, className: normalized.className }));
  }, []);

  const startNewSession = async () => {
    const cleanName = name.replace(/\s+/g, " ").trim();
    if (cleanName.length < 3) {
      setError("يرجى كتابة الاسم الثلاثي أو الاسم الكامل (٣ أحرف على الأقل).");
      return;
    }
    setError(null);
    setBusy(true);
    setNotice(null);
    try {
      const existingResponse = await fetch(
        `/api/progress?name=${encodeURIComponent(cleanName)}&className=${encodeURIComponent(className)}`,
      );
      const existing = (await existingResponse.json()) as { found?: boolean; student?: StudentRecord };
      if (existing.found && existing.student) {
        const session = { studentId: existing.student.studentId, studentName: existing.student.studentName, className: existing.student.className };
        setSavedSession(session);
        enterLesson(existing.student, session);
        setNotice("وجدنا سجلًا سابقًا بهذا الاسم، تم استئناف تقدمك من حيث توقفت.");
        return;
      }

      const studentId = crypto.randomUUID();
      const response = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          studentName: cleanName,
          className,
          currentSlide: 1,
          maxSlide: 1,
          quizScore: 0,
          quizTotal: 0,
          activities: {},
          event: "session-start",
        }),
      });
      const data = (await response.json()) as { ok?: boolean; student?: StudentRecord; error?: string };
      if (!response.ok || !data.student) throw new Error(data.error ?? "تعذّر بدء الجلسة");
      const session = { studentId: data.student.studentId, studentName: data.student.studentName, className: data.student.className };
      setSavedSession(session);
      enterLesson(data.student, session);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "حدث خطأ غير متوقع، حاول مرة أخرى.");
    } finally {
      setBusy(false);
    }
  };

  const resumeSaved = async () => {
    if (!savedSession) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/progress?studentId=${encodeURIComponent(savedSession.studentId)}`);
      const data = (await response.json()) as { found?: boolean; student?: StudentRecord; pinned?: StoredSession | null };
      if (data.found && data.student) {
        enterLesson(data.student, savedSession);
        return;
      }
      // سجل محذوف من قِبل المعلم أو غير موجود: ابدأ من جديد بنفس الاسم
      const created = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...savedSession, event: "session-start" }),
      });
      const payload = (await created.json()) as { student?: StudentRecord; error?: string };
      if (payload.student) enterLesson(payload.student, savedSession);
      else setError(payload.error ?? "تعذّر استئناف الجلسة");
    } catch {
      setError("تعذّر الاتصال بالخادم، تحقق من الشبكة ثم أعد المحاولة.");
    } finally {
      setBusy(false);
    }
  };

  const exitLesson = () => {
    setStudent(null);
    setSavedRecord(null);
    studentRef.current = null;
  };

  const hasCustomSound = sounds.length > 0;
  const progressPercent = savedRecord ? Math.round((savedRecord.maxSlide / TOTAL_SLIDES) * 100) : 0;
  const soundSlots = useMemo(() => SOUND_SLOTS.length, []);

  if (student) {
    return <LessonPlayer student={student} sounds={sounds} saveState={saveState} onChange={handleChange} onExit={exitLesson} />;
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b-2 border-sand-200 bg-sand-50/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-700 text-2xl text-gold-200 shadow">🕌</span>
            <div>
              <p className="font-display text-base leading-6 text-brand-900">مدرسة العروس الابتدائية</p>
              <p className="text-xs font-bold text-brand-600">{LESSON_META.lessonNumber} · {LESSON_META.grade}</p>
            </div>
          </div>
          <nav className="mr-auto flex flex-wrap items-center gap-2">
            <Link className="btn btn-primary !px-4 !py-2 text-sm" href="/teacher">👨‍🏫 لوحة المعلم</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-16">
        <section className="stage relative mt-4">
          <div className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[1.15fr_1fr] lg:p-10">
            <div className="order-2 space-y-5 lg:order-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="chip bg-gold-50 border-gold-200 text-gold-700 !text-sm">✨ درس تفاعلي متكامل</span>
                <span className="chip">{LESSON_META.lessonNumber} · {LESSON_META.pages}</span>
                <span className="chip">{LESSON_META.grade}</span>
              </div>
              <div>
                <h1 className="font-display text-4xl leading-[1.35] text-brand-950 sm:text-5xl">
                  <span className="text-brand-600">إيتاء الزكاة</span>
                  <span className="mt-2 block text-lg font-bold text-gold-600 sm:text-xl">{LESSON_META.lessonNumber} · {LESSON_META.subject}</span>
                </h1>
                <p className="mt-3 text-base leading-9 text-brand-700">
                  رحلة تعليمية من {TOTAL_SLIDES} شرائح مبنية على محتوى الكتاب المقرر: معنى إيتاء الزكاة، والدليل على وجوبها،
                  وفضلها، والإخلاص والمتابعة فيها، وأثر منعها، وادّخار المال، ثم التقويم. يُحفظ تقدمك تلقائيًا ويستأنف من حيث توقفت.
                </p>
              </div>

              <div className="space-y-2">
                <div className="rounded-2xl border border-gold-200 bg-gold-50 px-4 py-3 text-center">
                  <p className="text-[10px] font-extrabold text-gold-700">الدليل على وجوب الزكاة</p>
                  <p className="font-display mt-1 text-base leading-8 text-brand-900">{EVIDENCE.text}</p>
                  <p className="text-[11px] font-bold text-gold-700">{EVIDENCE.reference}</p>
                </div>
                <div className="rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3 text-center">
                  <p className="text-[10px] font-extrabold text-brand-600">فضل الزكاة</p>
                  <p className="font-display mt-1 text-sm leading-8 text-brand-900">{VIRTUE.text}</p>
                  <p className="text-sm font-bold text-brand-600">{VIRTUE.reference}</p>
                </div>
              </div>

              {savedSession ? (
                <div className="animate-fade-up rounded-2xl border border-brand-200 bg-brand-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-extrabold text-brand-900">👋 مرحبًا مجددًا {savedSession.studentName}</p>
                      <p className="text-sm font-bold text-brand-600">
                        الفصل {savedSession.className}
                        {savedRecord
                          ? ` · تقدمك ${progressPercent}٪ · وصلت للشريحة ${savedRecord.maxSlide}`
                          : " · لا يوجد تقدم محفوظ بعد"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="btn btn-primary !px-4 !py-2 text-xs" onClick={resumeSaved} disabled={busy}>
                        {busy ? "جارٍ الاستئناف…" : "▶ متابعة الدرس"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost !px-3 !py-2 text-xs"
                        onClick={() => {
                          window.localStorage.removeItem(STORAGE_KEY);
                          setSavedSession(null);
                          setSavedRecord(null);
                          setNotice("يمكنك الآن الدخول باسم جديد.");
                        }}
                      >
                        دخول باسم آخر
                      </button>
                    </div>
                  </div>
                  {savedRecord ? (
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                      <div className="h-full rounded-full bg-gradient-to-l from-brand-500 to-gold-400" style={{ width: `${progressPercent}%` }} />
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="rounded-3xl border-4 border-sand-200 bg-gradient-to-bl from-white to-sand-50 p-4 sm:p-5">
                <h2 className="font-display text-xl text-brand-900">ابدأ رحلة التعلم 🚀</h2>
                <p className="mb-3 text-sm font-bold leading-7 text-brand-600">
                  اكتب اسمك، ثم اختر فصلك: <strong className="text-brand-900">أ</strong> أو <strong className="text-brand-900">ب</strong>.
                  الاسم والفصل يُثبّتان من قِبل المعلم عند الحاجة فلا يمكن تغييرهما بعد التثبيت.
                </p>

                <label className="label !text-base" htmlFor="student-name">١. اسم الطالب</label>
                <input
                  id="student-name"
                  className="field !py-3 !text-lg"
                  placeholder="اكتب اسمك الكامل"
                  value={name}
                  maxLength={80}
                  onChange={(event) => setName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void startNewSession();
                  }}
                />

                <p className="label mt-4 !text-base">٢. اختر الفصل الدراسي</p>
                <div className="grid grid-cols-2 gap-3">
                  {CLASS_OPTIONS.map((option, index) => {
                    const letter = option.split("/")[1];
                    const active = className === option;
                    const palette = index === 0
                      ? { ring: "border-brand-500 bg-brand-50", badge: "bg-brand-700", text: "text-brand-900", icon: "🟢" }
                      : { ring: "border-gold-400 bg-gold-50", badge: "bg-gold-500", text: "text-gold-900", icon: "🟡" };
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setClassName(option)}
                        aria-pressed={active}
                        className={`relative rounded-3xl border-4 p-4 text-center transition active:scale-[0.98] ${
                          active ? `${palette.ring} shadow-lg` : "border-sand-200 bg-white hover:border-brand-300"
                        }`}
                      >
                        {active ? (
                          <span className="absolute left-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-brand-600 text-sm text-white">✓</span>
                        ) : null}
                        <span className={`mx-auto mb-1 grid h-14 w-14 place-items-center rounded-2xl ${palette.badge} font-display text-2xl text-white shadow`}>
                          {letter}
                        </span>
                        <span className={`block font-display text-xl font-extrabold ${active ? palette.text : "text-brand-800"}`}>
                          الفصل {letter}
                        </span>
                        <span className="mt-0.5 block text-sm font-bold text-brand-500">{option}</span>
                        <span className="mt-1 block text-xs font-bold text-brand-400">{palette.icon} الصف الثالث</span>
                      </button>
                    );
                  })}
                </div>

                {error ? <p className="mt-3 rounded-2xl bg-[#fff5f5] px-3 py-2 text-sm font-bold text-[#b42318]">{error}</p> : null}
                {notice ? <p className="mt-3 rounded-2xl bg-[#ecfdf3] px-3 py-2 text-sm font-bold text-[#067647]">{notice}</p> : null}

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button type="button" className="btn btn-primary !px-6 !py-3 !text-lg" onClick={startNewSession} disabled={busy}>
                    {busy ? "جارٍ التحضير…" : "🚀 ابدأ الدرس"}
                  </button>
                  {sounds.some((sound) => sound.soundKey === "welcome") ? (
                    <button
                      type="button"
                      className="btn btn-gold !px-4 !py-3 text-base"
                      onClick={() => {
                        const audio = new Audio("/api/sounds?key=welcome");
                        void audio.play().catch(() => undefined);
                      }}
                    >
                      🎙️ ترحيب المعلم
                    </button>
                  ) : null}
                  <span className="text-sm font-bold text-brand-500">💾 الحفظ التلقائي مفعّل · لا حاجة لتسجيل دخول</span>
                </div>
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <div className="relative aspect-[3/2] overflow-hidden rounded-[1.75rem] border border-sand-200 bg-gradient-to-bl from-brand-100 via-sand-100 to-gold-100">
                <LessonImage name="zakat-hero" alt="أطفال يشاركون في إيتاء الزكاة" width={1600} height={1067} eager className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute bottom-3 right-3 left-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-white/95 px-3 py-1 text-[11px] font-extrabold text-brand-800 shadow">
                    ⭐ {TOTAL_SLIDES} شرائح تفاعلية
                  </span>
                  <span className="rounded-full bg-brand-800/95 px-3 py-1 text-[11px] font-extrabold text-white shadow">
                    🎙️ {hasCustomSound ? `${sounds.length} صوت مخصص` : `${soundSlots} خانة صوت`}
                  </span>
                  <span className="rounded-full bg-gold-400/95 px-3 py-1 text-[11px] font-extrabold text-gold-900 shadow">
                    🏅 شهادة إنجاز
                  </span>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[
                  { label: "المعلم", value: LESSON_META.teacher, icon: "👨‍🏫" },
                  { label: "المدرسة", value: LESSON_META.school, icon: "🏫" },
                  { label: "المادة", value: LESSON_META.subject, icon: "📘" },
                  { label: "الصف", value: LESSON_META.grade, icon: "🎒" },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-sand-200 bg-white px-3 py-2">
                    <p className="text-xs font-extrabold text-brand-500">{item.icon} {item.label}</p>
                    <p className="text-xs font-extrabold text-brand-900">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="font-display text-2xl text-brand-900">🎪 استراتيجيات التعلّم داخل الدرس</h2>
              <p className="text-xs font-bold text-brand-600">كل شريحة تعتمد استراتيجية مختلفة لتنمية مهارات الفهم والتطبيق.</p>
            </div>
            <Link className="btn btn-ghost !px-3 !py-1.5 text-xs" href="/teacher">متابعة أداء الطلاب ←</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STRATEGIES.map((strategy) => (
              <div key={strategy.title} className="sticker sticker-lift border-brand-200 p-4">
                <div className="mb-2 text-2xl">{strategy.icon}</div>
                <h3 className="font-display text-sm text-brand-900">{strategy.title}</h3>
                <p className="mt-1 text-sm font-bold leading-7 text-brand-600">{strategy.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-3 md:grid-cols-3">
          {[
            { icon: "📖", title: "محتوى الكتاب المقرر", text: "المعنى والدليل والفضل والإخلاص والمتابعة والإضاءة وادّخار المال وأسئلة التقويم (ص ٢٠–٢٢)." },
            { icon: "🔒", title: "تثبيت الاسم والفصل", text: "جدول مستقل يثبّت الأسماء والفصول من لوحة المعلم، فلا يستطيع الطالب تغييرها لاحقًا." },
            { icon: "🎙️", title: "أصوات مخصصة", text: "يمكن للمعلم رفع تسجيلات صوتية تُخزَّن داخل قاعدة البيانات (حتى 4MB) وتُخدَّم بتخزين مؤقت متقدم." },
          ].map((item) => (
            <div key={item.title} className="card border-brand-100 bg-gradient-to-bl from-white to-brand-50/50 p-4">
              <div className="mb-2 text-2xl">{item.icon}</div>
              <h3 className="font-display text-sm text-brand-900">{item.title}</h3>
              <p className="mt-1 text-sm font-bold leading-7 text-brand-600">{item.text}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 card overflow-hidden">
          <div className="bg-deep px-5 py-4 text-white">
            <h2 className="font-display text-xl">🗺️ محطات الرحلة ({SLIDES.length} محطات)</h2>
          </div>
          <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {SLIDES.map((item) => (
              <div key={item.id} className="rounded-2xl border-2 border-sand-200 bg-white px-3 py-2 transition hover:border-brand-300">
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-100 text-[11px] font-extrabold text-brand-700">
                    {item.index}
                  </span>
                  <p className="text-xs font-extrabold text-brand-900">{item.title}</p>
                </div>
                <p className="mt-1 text-[10px] font-bold text-brand-500">{item.strategy}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-sand-200 bg-white/70">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-[11px] font-bold text-brand-600">
          <span>© {new Date().getFullYear()} {LESSON_META.school} — {LESSON_META.subject} · {LESSON_META.grade}</span>
          <span>إعداد وإشراف المعلم: {LESSON_META.teacher}</span>
          <span className="flex gap-2">
            <Link className="hover:text-brand-900" href="/teacher">لوحة المعلم</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
