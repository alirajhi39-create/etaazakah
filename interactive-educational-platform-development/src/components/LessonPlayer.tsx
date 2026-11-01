"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BrainstormActivity,
  ChoiceActivity,
  EvaluationActivity,
  EvidenceActivity,
  QuizActivity,
  ReflectionActivity,
  SavingActivity,
  SincerityActivity,
  VirtueActivity,
  WarningActivity,
  toArabicDigits,
  type BrainstormValue,
  type ChoiceValue,
  type EvaluationValue,
  type EvidenceValue,
  type QuizValue,
  type ReflectionValue,
  type SavingValue,
  type SincerityValue,
  type VirtueValue,
  type WarningValue,
} from "@/components/activities";
import { EVIDENCE, LESSON_META, MEANING, SLIDES, TOTAL_SLIDES, getSlide, type SlideKind } from "@/lib/lesson";
import { playSfx, sfxKindFor } from "@/lib/sfx";
import LessonImage from "@/components/LessonImage";
import { evaluateCertificate } from "@/lib/certificate";
import { NARRATION_PROFILE, isSpeechSupported, prepareForSpeech, rankArabicVoices, splitForSpeech } from "@/lib/tts";
import type { SoundMeta, StudentRecord } from "@/lib/types";

type SaveState = "idle" | "saving" | "saved" | "error";

type Props = {
  student: StudentRecord;
  sounds: SoundMeta[];
  saveState: SaveState;
  onChange: (patch: Partial<StudentRecord>, immediate?: boolean) => void;
  onExit: () => void;
};

type Theme = {
  head: string;
  emoji: string;
  soft: string;
  border: string;
  ink: string;
  label: string;
  dot: string;
  sparkles: string[];
};

const THEMES: Record<SlideKind, Theme> = {
  welcome: { head: "from-gold-400 via-gold-300 to-brand-300", emoji: "🎈", soft: "bg-gold-50", border: "border-gold-200", ink: "text-gold-800", label: "هيا نبدأ المغامرة", dot: "bg-gold-400", sparkles: ["⭐", "🎈", "✨"] },
  concept: { head: "from-sky-500 via-sky-400 to-brand-300", emoji: "💡", soft: "bg-sky-50", border: "border-sky-200", ink: "text-sky-700", label: "نتعلّم المعنى", dot: "bg-sky-400", sparkles: ["💡", "🔎", "✨"] },
  verse: { head: "from-brand-600 via-brand-400 to-gold-300", emoji: "📖", soft: "bg-brand-50", border: "border-brand-200", ink: "text-brand-700", label: "نتدبّر الآية", dot: "bg-brand-400", sparkles: ["📖", "🌿", "⭐"] },
  virtue: { head: "from-brand-500 via-brand-300 to-gold-200", emoji: "🌻", soft: "bg-brand-50", border: "border-brand-200", ink: "text-brand-700", label: "نكتشف الفضل", dot: "bg-brand-300", sparkles: ["🌻", "🌱", "✨"] },
  sincerity: { head: "from-coral-400 via-coral-300 to-gold-300", emoji: "💚", soft: "bg-coral-50", border: "border-coral-200", ink: "text-coral-700", label: "نُصنّف ونلعب", dot: "bg-coral-300", sparkles: ["💚", "🎯", "✨"] },
  warning: { head: "from-gold-500 via-gold-400 to-coral-300", emoji: "⚠️", soft: "bg-gold-50", border: "border-gold-200", ink: "text-gold-800", label: "إضاءة مهمة", dot: "bg-gold-400", sparkles: ["⚠️", "🌧️", "🌵"] },
  saving: { head: "from-sky-600 via-sky-400 to-brand-300", emoji: "🏦", soft: "bg-sky-50", border: "border-sky-200", ink: "text-sky-700", label: "نعمل معًا", dot: "bg-sky-400", sparkles: ["🪙", "💰", "🤝"] },
  evaluation: { head: "from-grape-500 via-grape-400 to-sky-300", emoji: "✍️", soft: "bg-grape-50", border: "border-grape-200", ink: "text-grape-700", label: "نُقوّم أنفسنا", dot: "bg-grape-400", sparkles: ["✍️", "📝", "⭐"] },
  quiz: { head: "from-grape-600 via-coral-400 to-gold-300", emoji: "🏆", soft: "bg-grape-50", border: "border-grape-200", ink: "text-grape-700", label: "نختبر أنفسنا", dot: "bg-grape-400", sparkles: ["🏆", "🎯", "⭐"] },
  closing: { head: "from-brand-700 via-brand-500 to-gold-400", emoji: "🎓", soft: "bg-brand-50", border: "border-brand-200", ink: "text-brand-700", label: "نُنهي الدرس", dot: "bg-brand-500", sparkles: ["🎓", "🎉", "🏅"] },
};

export default function LessonPlayer({ student, sounds, saveState, onChange, onExit }: Props) {
  const slide = getSlide(student.currentSlide);
  const theme = THEMES[slide.kind];
  const activities = student.activities ?? {};
  const [audioStatus, setAudioStatus] = useState<"idle" | "playing">("idle");
  const chunkIndexRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const topRef = useRef<HTMLDivElement | null>(null);

  const soundKeys = useMemo(() => new Set(sounds.map((sound) => sound.soundKey)), [sounds]);
  const hasCustomSlideSound = soundKeys.has(slide.soundKey);

  const stopAllAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setAudioStatus("idle");
  }, []);

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    return () => stopAllAudio();
  }, [student.currentSlide, stopAllAudio]);

  const speakFallback = useCallback((text: string) => {
    if (!isSpeechSupported()) return;
    // اختيار أفضل صوت عربي متاح تلقائيًا (يُفضّل الصوت الطفولي/الطبيعي) بدون أي إعدادات من الطالب
    const bestVoice = rankArabicVoices(window.speechSynthesis.getVoices(), "child")[0]?.voice ?? null;
    const chunks = splitForSpeech(prepareForSpeech(text));
    window.speechSynthesis.cancel();
    setAudioStatus("playing");
    chunkIndexRef.current = 0;

    const speakNext = () => {
      const chunk = chunks[chunkIndexRef.current];
      if (!chunk) {
        setAudioStatus("idle");
        return;
      }
      chunkIndexRef.current += 1;
      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.lang = bestVoice?.lang ?? "ar-SA";
      if (bestVoice) utterance.voice = bestVoice;
      utterance.rate = NARRATION_PROFILE.rate;
      utterance.pitch = NARRATION_PROFILE.pitch;
      utterance.volume = 1;
      utterance.onend = () => {
        // وقفة قصيرة بين الجُمل تجعل الإيقاع أقرب للطبيعي وتُبرز الحركات
        window.setTimeout(speakNext, 220);
      };
      utterance.onerror = () => setAudioStatus("idle");
      window.speechSynthesis.speak(utterance);
    };

    speakNext();
  }, []);

  const playSound = useCallback(
    (key: string) => {
      // صوت مرفوع من المعلم له الأولوية، وإلا يُشغَّل مؤثر مركّب مناسب فورًا
      if (soundKeys.has(key)) {
        stopAllAudio();
        const audio = new Audio(`/api/sounds?key=${encodeURIComponent(key)}`);
        audioRef.current = audio;
        audio.onended = () => setAudioStatus("idle");
        void audio.play().then(() => setAudioStatus("playing")).catch(() => {
          playSfx(sfxKindFor(key));
        });
        return;
      }
      playSfx(sfxKindFor(key));
    },
    [soundKeys, stopAllAudio],
  );

  const narrate = useCallback(() => {
    if (audioStatus === "playing") {
      stopAllAudio();
      return;
    }
    if (hasCustomSlideSound) {
      playSound(slide.soundKey);
      return;
    }
    speakFallback(`${slide.title}. ${slide.narration}`);
  }, [audioStatus, hasCustomSlideSound, playSound, slide, speakFallback, stopAllAudio]);

  const goToSlide = (index: number) => {
    const target = Math.min(Math.max(index, 1), TOTAL_SLIDES);
    if (target > student.maxSlide) return;
    stopAllAudio();
    playSfx(target > student.currentSlide ? "next" : target < student.currentSlide ? "back" : "tap");
    onChange({ currentSlide: target, maxSlide: Math.max(student.maxSlide, target) });
  };

  const update = (key: string, value: unknown) => onChange({ activities: { ...activities, [key]: value } });

  const handleNext = () => {
    if (student.currentSlide >= TOTAL_SLIDES) return;
    const next = student.currentSlide + 1;
    stopAllAudio();
    playSfx(next === TOTAL_SLIDES ? "celebrate" : "next");
    onChange({ currentSlide: next, maxSlide: Math.max(student.maxSlide, next) }, true);
  };

  const progressPercent = Math.round((student.maxSlide / TOTAL_SLIDES) * 100);
  const scorePercent = student.quizTotal > 0 ? Math.round((student.quizScore / student.quizTotal) * 100) : 0;
  const certificate = evaluateCertificate({
    quizScore: student.quizScore,
    quizTotal: student.quizTotal || 7,
    activities,
  });
  const hasCertificate = Boolean(student.completed) && certificate.eligible;
  const quizSlideIndex = SLIDES.find((item) => item.kind === "quiz")?.index ?? 9;
  const stars = Math.max(1, Math.round(progressPercent / 20));

  return (
    <div className="min-h-screen" ref={topRef}>
      {/* ===== الشريط العلوي ===== */}
      <header className="screen-only sticky top-0 z-30 border-b-4 border-sand-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-3 py-2 sm:px-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-300 text-xl shadow-sticker">🕌</span>
            <span className="hidden sm:block">
              <span className="block font-display text-base leading-6 text-brand-900">{LESSON_META.title}</span>
              <span className="block text-xs font-bold text-brand-500">{LESSON_META.lessonNumber}</span>
            </span>
          </Link>

          <div className="mr-auto flex flex-wrap items-center gap-2">
            <span className="rounded-full border-2 border-brand-200 bg-brand-50 px-3 py-1 text-sm font-extrabold text-brand-800">👦 {student.studentName}</span>
            <span className="rounded-full border-2 border-gold-300 bg-gold-50 px-3 py-1 text-sm font-extrabold text-gold-800">🏫 فصل {student.className.split("/")[1]}</span>
            <span className="rounded-full bg-gradient-to-l from-grape-500 to-coral-400 px-3 py-1 text-sm font-extrabold text-white shadow">
              ⭐ {toArabicDigits(student.quizScore)}/{toArabicDigits(student.quizTotal || 7)}
            </span>
            <span className="hidden text-xs font-extrabold text-brand-500 md:inline">
              {saveState === "saving" ? "⏳ حفظ…" : saveState === "error" ? "⚠️ خطأ" : "💾 محفوظ"}
            </span>
            <button type="button" onClick={stopAllAudio} className="rounded-full border-2 border-sand-300 bg-white px-3 py-1 text-sm font-extrabold text-brand-700">🔇</button>
            <button type="button" onClick={onExit} className="rounded-full border-2 border-sand-300 bg-white px-3 py-1 text-sm font-extrabold text-brand-700">خروج</button>
          </div>
        </div>

        {/* مسار الشرائح */}
        <div className="mx-auto max-w-7xl overflow-x-auto px-3 pb-2 sm:px-4">
          <div className="flex min-w-max items-center gap-1.5">
            {SLIDES.map((item, index) => {
              const unlocked = item.index <= student.maxSlide;
              const current = item.index === student.currentSlide;
              const itemTheme = THEMES[item.kind];
              return (
                <div key={item.id} className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={!unlocked}
                    onClick={() => goToSlide(item.index)}
                    title={item.title}
                    aria-label={`الشريحة ${item.index}: ${item.title}`}
                    className={`path-dot ${current ? "scale-110 bg-gradient-to-br from-gold-400 to-gold-300 text-gold-900 ring-4 ring-gold-200" : unlocked ? `${itemTheme.dot} text-white` : "bg-sand-200 text-brand-300"}`}
                  >
                    {unlocked ? itemTheme.emoji : "🔒"}
                  </button>
                  {index < SLIDES.length - 1 ? (
                    <span className={`h-1.5 w-3 rounded-full sm:w-6 ${item.index < student.maxSlide ? "bg-brand-300" : "bg-sand-200"}`} />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="h-3 w-full bg-sand-200">
          <div
            className="relative h-full rounded-l-full bg-gradient-to-l from-gold-400 via-coral-300 to-grape-400 transition-all duration-700"
            style={{ width: `${progressPercent}%` }}
          >
            <span className="absolute -top-2 left-0 text-lg">{progressPercent >= 99 ? "🏁" : "🚀"}</span>
          </div>
        </div>
      </header>


      {/* ===== نسخة الطباعة: الشهادة فقط ===== */}
      {hasCertificate ? (
        <div className="print-only report-sheet certificate-sheet">
          <div className="certificate-frame">
            <div className="certificate-ribbon">🏅 شهادة إنجاز</div>
            <p className="certificate-school">المملكة العربية السعودية · وزارة التعليم</p>
            <p className="certificate-school-strong">مدرسة {LESSON_META.school}</p>
            <div className="certificate-divider">❖ ❖ ❖</div>
            <h1 className="certificate-title">شهادة إتمام {LESSON_META.lessonNumber}</h1>
            <p className="certificate-subtitle">{LESSON_META.title} — {LESSON_META.subject}</p>
            <p className="certificate-lead">تُمنح هذه الشهادة للطالب المتميز</p>
            <p className="certificate-name">{student.studentName}</p>
            <p className="certificate-class">الصف {LESSON_META.grade} · فصل {student.className.split("/")[1]}</p>
            <div className="certificate-stats">
              <div>
                <p className="certificate-stat-label">نسبة التقدم</p>
                <p className="certificate-stat-value">{toArabicDigits(progressPercent)}٪</p>
              </div>
              <div>
                <p className="certificate-stat-label">درجة الاختبار</p>
                <p className="certificate-stat-value">{toArabicDigits(student.quizScore)} / {toArabicDigits(student.quizTotal || 7)}</p>
              </div>
              <div>
                <p className="certificate-stat-label">نسبة الإتقان</p>
                <p className="certificate-stat-value">{toArabicDigits(scorePercent)}٪</p>
              </div>
            </div>
            <p className="certificate-note">أتمّ الطالب رحلة تعلّم درس إيتاء الزكاة بنجاح، نسأل الله له التوفيق والبركة.</p>
            <p className="certificate-date">📅 {new Date().toLocaleDateString("ar-SA")}</p>
          </div>
        </div>
      ) : null}

      <main className="screen-only mx-auto grid max-w-7xl gap-4 px-3 py-4 sm:px-4 lg:grid-cols-[280px_1fr]">
        {/* ===== صندوق المهمة الجانبي ===== */}
        <aside className="screen-only order-2 lg:order-1">
          <div className="sticky top-40 space-y-3">
            <div className="rounded-[1.75rem] border-4 border-white bg-gradient-to-b from-grape-500 to-grape-400 p-4 text-white shadow-sticker">
              <p className="text-xs font-extrabold text-grape-100">مهمّتي اليوم</p>
              <p className="font-display mt-1 text-xl leading-8">{LESSON_META.title}</p>
              <div className="mt-2 flex items-center gap-1 text-lg">
                {Array.from({ length: 5 }).map((_, index) => (
                  <span key={`star-${index}`} className={index < stars ? "" : "opacity-30"}>⭐</span>
                ))}
              </div>
              <p className="mt-1 text-sm font-bold text-grape-100">{toArabicDigits(progressPercent)}٪ من الرحلة</p>
            </div>

            <div className="rounded-[1.75rem] border-4 border-sand-200 bg-white p-3 shadow-sticker">
              <p className="mb-2 px-1 font-display text-base text-brand-900">🎯 محطات الرحلة</p>
              <ol className="space-y-1">
                {SLIDES.map((item) => {
                  const unlocked = item.index <= student.maxSlide;
                  const current = item.index === student.currentSlide;
                  const itemTheme = THEMES[item.kind];
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        disabled={!unlocked}
                        onClick={() => goToSlide(item.index)}
                        className={`flex w-full items-center gap-2 rounded-2xl border-b-2 px-2 py-2 text-right text-sm font-extrabold transition ${
                          current
                            ? `${itemTheme.soft} ${itemTheme.ink} border-current`
                            : unlocked
                              ? "border-transparent text-brand-700 hover:bg-sand-50"
                              : "border-transparent text-brand-300"
                        }`}
                      >
                        <span className="text-lg">{unlocked ? itemTheme.emoji : "🔒"}</span>
                        <span className="line-clamp-2 leading-6">{item.title}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>

            <div className="rounded-[1.75rem] border-4 border-gold-200 bg-gold-50 p-3 text-sm font-extrabold leading-7 text-gold-900">
              👨‍🏫 المعلم: {LESSON_META.teacher}
              <br />
              🏫 {LESSON_META.school}
            </div>
          </div>
        </aside>

        {/* ===== الشريحة ===== */}
        <section className="order-1 min-w-0 lg:order-2">
          <article key={slide.id} className="stage animate-fade-up">
            {/* رأس الشريحة */}
            <div className={`relative overflow-hidden bg-gradient-to-bl ${theme.head} px-4 py-5 sm:px-7 sm:py-6`}>
              <span className="sparkle right-4 top-3">{theme.sparkles[0]}</span>
              <span className="sparkle left-10 top-10">{theme.sparkles[1]}</span>
              <span className="sparkle left-1/3 bottom-2">{theme.sparkles[2]}</span>
              <div className="relative flex flex-wrap items-center gap-3">
                <div className="grid h-20 w-20 shrink-0 animate-wiggle place-items-center rounded-[1.6rem] border-4 border-white bg-white/30 text-4xl shadow-lg sm:h-24 sm:w-24 sm:text-5xl">
                  {theme.emoji}
                </div>
                <div className="min-w-0 grow">
                  <p className="inline-block rounded-full bg-white/85 px-3 py-1 text-sm font-extrabold text-brand-900">
                    المحطة {toArabicDigits(slide.index)} من {toArabicDigits(TOTAL_SLIDES)} · {theme.label}
                  </p>
                  <h1 className="font-display mt-2 text-2xl leading-[1.5] text-white drop-shadow-sm sm:text-4xl">{slide.title}</h1>
                  {slide.page ? <p className="mt-1 text-sm font-extrabold text-white/90">📚 {slide.page}</p> : null}
                </div>
              </div>
              <div className="relative mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border-2 border-white/70 bg-white/20 px-3 py-1.5 text-sm font-extrabold text-white">🎯 {slide.kicker}</span>
                <span className="rounded-full bg-white px-3 py-1.5 text-sm font-extrabold text-brand-800">{slide.strategy}</span>
                <button type="button" onClick={narrate} className="kid-btn kid-btn-sun animate-shine !px-4 !py-2 !text-sm">
                  {audioStatus === "playing" ? "⏹ إيقاف" : hasCustomSlideSound ? "🎙️ صوت المعلم" : "🔊 اسمع الشرح"}
                </button>
              </div>
            </div>

            <div className="space-y-4 px-3.5 py-5 sm:px-6">
              {/* فقاعة كلام المعلم */}
              <div className={`relative rounded-[2rem] border-4 ${theme.border} ${theme.soft} p-4`}>
                <div className="absolute -top-5 right-6 grid h-12 w-12 place-items-center rounded-full border-4 border-white bg-gradient-to-br from-brand-500 to-brand-300 text-2xl shadow-sticker">
                  👨‍🏫
                </div>
                <p className={`mt-3 text-sm font-extrabold ${theme.ink}`}>المعلم علي يقول:</p>
                <p className="mt-1 text-lg font-bold leading-9 text-brand-950 sm:text-xl">{slide.narration}</p>
              </div>

              {slide.kind === "welcome" && (
                <div className="grid gap-4 md:grid-cols-[1.1fr_1fr]">
                  <div className="space-y-3">
                    <p className="text-lg font-bold leading-9 text-brand-900">
                      أهلًا <span className="rounded-xl bg-gold-100 px-2 font-display text-brand-800">{student.studentName}</span> 👋
                      سنتعلم اليوم درس <strong>{LESSON_META.title}</strong> باللعب والقصص والصور. اجمع النجوم ⭐ واحصل على الشهادة 🏅.
                    </p>
                    <div className="rounded-[1.75rem] border-4 border-gold-300 bg-gold-50 p-4 text-center shadow-sticker">
                      <p className="text-xs font-extrabold text-gold-700">الدليل على وجوب الزكاة</p>
                      <p className="font-display mt-1 text-xl leading-10 text-brand-900">{EVIDENCE.text}</p>
                      <p className="text-sm font-extrabold text-gold-700">{EVIDENCE.reference}</p>
                    </div>
                    <div className="rounded-[1.75rem] border-4 border-brand-200 bg-white p-4">
                      <p className="mb-2 font-display text-lg text-brand-900">🎯 ماذا سنتعلم؟</p>
                      <ul className="space-y-2">
                        {LESSON_META.objectives.map((goal) => (
                          <li key={goal} className="flex items-start gap-2 text-base font-bold leading-8 text-brand-800">
                            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-100 text-sm text-brand-700">✓</span>
                            <span>{goal}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <LessonImage name="zakat-hero" alt="أطفال يضعون الصدقة في صندوق الزكاة" width={1600} height={1067} className="w-full rounded-[1.75rem] border-4 border-gold-200 shadow-sticker" />
                    <BrainstormActivity value={activities.brainstorm as BrainstormValue | undefined} onChange={(next) => update("brainstorm", next)} />
                  </div>
                </div>
              )}

              {slide.kind === "concept" && (
                <div className="space-y-4">
                  <div className="relative rounded-[1.75rem] border-4 border-sky-300 bg-gradient-to-bl from-sky-50 to-gold-50 p-5 text-center shadow-sticker">
                    <span className="absolute -top-3 right-6 rounded-full bg-sky-500 px-3 py-1 text-sm font-extrabold text-white">المعنى</span>
                    <p className="font-display mt-2 text-xl leading-10 text-brand-950 sm:text-2xl">{MEANING.definition}</p>
                  </div>
                  <ul className="grid gap-3 sm:grid-cols-3">
                    {slide.points?.map((point, index) => (
                      <li key={point} className="sticker sticker-lift border-brand-200 p-4 text-center">
                        <span className="mb-1 block text-4xl">{["💵", "🤲", "🕌"][index]}</span>
                        <span className="text-base font-extrabold leading-7 text-brand-800">{point}</span>
                      </li>
                    ))}
                  </ul>
                  <ChoiceActivity
                    id="meaning"
                    title="جرب بنفسك"
                    question="أيُّ العبارات التالية تُعبّر عن معنى إيتاء الزكاة؟"
                    options={MEANING.choices}
                    correctIndex={MEANING.correctIndex}
                    feedback={MEANING.feedback}
                    value={activities.meaningCheck as ChoiceValue | undefined}
                    onChange={(next) => update("meaningCheck", next)}
                    playSound={playSound}
                  />
                </div>
              )}

              {slide.kind === "verse" && (
                <EvidenceActivity value={activities.evidence as EvidenceValue | undefined} onChange={(next) => update("evidence", next)} playSound={playSound} />
              )}
              {slide.kind === "virtue" && (
                <VirtueActivity value={activities.virtue as VirtueValue | undefined} onChange={(next) => update("virtue", next)} playSound={playSound} />
              )}
              {slide.kind === "sincerity" && (
                <SincerityActivity value={activities.sincerity as SincerityValue | undefined} onChange={(next) => update("sincerity", next)} playSound={playSound} />
              )}
              {slide.kind === "warning" && (
                <WarningActivity value={activities.warning as WarningValue | undefined} onChange={(next) => update("warning", next)} playSound={playSound} />
              )}
              {slide.kind === "saving" && (
                <SavingActivity value={activities.saving as SavingValue | undefined} onChange={(next) => update("saving", next)} playSound={playSound} />
              )}
              {slide.kind === "evaluation" && (
                <EvaluationActivity value={activities.evaluation as EvaluationValue | undefined} onChange={(next) => update("evaluation", next)} playSound={playSound} />
              )}
              {slide.kind === "quiz" && (
                <QuizActivity
                  value={activities.quiz as QuizValue | undefined}
                  onChange={(next) => update("quiz", next)}
                  playSound={playSound}
                  onScore={(score, total) => onChange({ quizScore: score, quizTotal: total }, true)}
                />
              )}

              {slide.kind === "closing" && (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-[1.5rem] border-4 border-brand-200 bg-brand-50 p-3 text-center">
                      <p className="text-sm font-extrabold text-brand-600">رحلتي</p>
                      <p className="font-display text-2xl text-brand-900">{toArabicDigits(progressPercent)}٪</p>
                    </div>
                    <div className="rounded-[1.5rem] border-4 border-gold-200 bg-gold-50 p-3 text-center">
                      <p className="text-sm font-extrabold text-gold-700">درجتي</p>
                      <p className="font-display text-2xl text-brand-900">
                        {toArabicDigits(student.quizScore)} / {toArabicDigits(student.quizTotal || 7)}
                      </p>
                    </div>
                    <div className="rounded-[1.5rem] border-4 border-grape-200 bg-grape-50 p-3 text-center">
                      <p className="text-sm font-extrabold text-grape-700">زياراتي</p>
                      <p className="font-display text-2xl text-brand-900">{toArabicDigits(student.visits)}</p>
                    </div>
                  </div>

                  <div className="rounded-[1.75rem] border-4 border-brand-200 bg-white p-4">
                    <p className="mb-2 font-display text-lg text-brand-900">📌 أتذكّر معك</p>
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {[
                        "الزكاة الركن الثالث من أركان الإسلام.",
                        "معناها: إخراج جزء من المال للمستحقين.",
                        "دليلها: ﴿وَآتُوا الزَّكَاةَ﴾ — النور: ٥٦.",
                        "فضلها: تُطهّر النفس وتُزكّي المال.",
                        "فيها الإخلاص لله والمتابعة للنبي ﷺ.",
                        "منعها سبب لنزع البركات وانقطاع الأمطار.",
                        "ادّخار المال: جمعه وحفظه للمستقبل.",
                        "نُخرج الزكاة عند حولان الحول.",
                      ].map((line) => (
                        <li key={line} className="flex items-start gap-2 rounded-2xl bg-sand-50 px-3 py-2 text-base font-bold leading-8 text-brand-800">
                          <span className="text-gold-500">◆</span>
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <ReflectionActivity value={activities.reflection as ReflectionValue | undefined} onChange={(next) => update("reflection", next)} />

                  <div className="rounded-[2rem] border-4 border-gold-300 bg-gradient-to-bl from-gold-50 via-white to-brand-50 p-4 sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-display text-xl text-brand-900">🏅 شهادة إنجاز</p>
                        <p className="text-base font-bold text-brand-600">
                          {hasCertificate ? "أكملت الدرس بنجاح، هذه شهادتك." : "الشهادة تحتاج إنجاز الشرطين معًا: درجة اختبار ٥ فأعلى، وأكثر من ٧٥٪ من الأنشطة."}
                        </p>
                      </div>
                      {hasCertificate ? (
                        <button type="button" className="kid-btn" onClick={() => window.print()}>🖨️ اطبع الشهادة / احفظها PDF</button>
                      ) : certificate.eligible ? (
                        <button
                          type="button"
                          className="kid-btn kid-btn-sun"
                          onClick={() => {
                            playSound("celebrate");
                            onChange({ completed: true, quizTotal: student.quizTotal || 7 }, true);
                          }}
                        >
                          ✅ أتممت الدرس — استلم شهادتي
                        </button>
                      ) : (
                        <button type="button" className="kid-btn kid-btn-coral" onClick={() => goToSlide(quizSlideIndex)}>
                          🔁 أعد الاختبار
                        </button>
                      )}
                    </div>

                    {/* لوحة شروط الاستحقاق */}
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div className={`rounded-2xl border-4 p-3 ${certificate.quizPassed ? "border-[#37d67a] bg-[#eafff4]" : "border-coral-300 bg-coral-50"}`}>
                        <div className="flex items-center justify-between text-sm font-extrabold text-brand-800">
                          <span>🎯 درجة الاختبار</span>
                          <span>{toArabicDigits(certificate.quizScore)} / {toArabicDigits(certificate.quizTotal)}</span>
                        </div>
                        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white">
                          <div
                            className={`h-full rounded-full ${certificate.quizPassed ? "bg-[#12b76a]" : "bg-coral-400"}`}
                            style={{ width: `${Math.round((certificate.quizScore / Math.max(1, certificate.quizTotal)) * 100)}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs font-bold text-brand-600">
                          {certificate.quizPassed ? "✓ الشرط الأول متحقق (٥ فأعلى)" : "الشرط الأول: ٥ فأعلى من ٧"}
                        </p>
                      </div>

                      <div className={`rounded-2xl border-4 p-3 ${certificate.activitiesPassed ? "border-[#37d67a] bg-[#eafff4]" : "border-gold-300 bg-gold-50"}`}>
                        <div className="flex items-center justify-between text-sm font-extrabold text-brand-800">
                          <span>🧩 الأنشطة المنجزة</span>
                          <span>{toArabicDigits(certificate.activitiesPercent)}٪</span>
                        </div>
                        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white">
                          <div
                            className={`h-full rounded-full ${certificate.activitiesPassed ? "bg-[#12b76a]" : "bg-gold-400"}`}
                            style={{ width: `${certificate.activitiesPercent}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs font-bold text-brand-600">
                          {toArabicDigits(certificate.activitiesDone)} من {toArabicDigits(certificate.activitiesTotal)} نشاط · الشرط الثاني: أكثر من ٧٥٪
                        </p>
                      </div>
                    </div>

                    {!certificate.eligible ? (
                      <div className="mt-2 space-y-2 rounded-2xl border-4 border-coral-300 bg-[#fff5f2] p-3">
                        <p className="text-base font-extrabold text-coral-700">✋ لم تحصل على الشهادة بعد — تحتاج الشرطين معًا</p>
                        <p className="text-sm font-bold leading-7 text-coral-700">{certificate.message}</p>
                        {certificate.missing.length > 0 ? (
                          <div>
                            <p className="mb-1 text-xs font-extrabold text-brand-700">أنشطة لم تُنجزها بعد:</p>
                            <div className="flex flex-wrap gap-1.5">
                              {certificate.missing.map((item) => (
                                <span key={item.key} className="rounded-full border-2 border-coral-200 bg-white px-2.5 py-1 text-xs font-extrabold text-coral-700">
                                  {item.icon} {item.label}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className="kid-btn kid-btn-coral !px-4 !py-2 !text-sm" onClick={() => goToSlide(quizSlideIndex)}>
                            🔁 أعد الاختبار حتى تحصل على الشهادة
                          </button>
                          <button type="button" className="kid-btn kid-btn-sun !px-4 !py-2 !text-sm" onClick={() => goToSlide(SLIDES[0].index)}>
                            🧩 أكمل الأنشطة الناقصة
                          </button>
                          <button type="button" className="kid-btn kid-btn-plain !px-4 !py-2 !text-sm" onClick={() => goToSlide(SLIDES[0].index)}>
                            📚 راجع الدرس من البداية
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 rounded-2xl border-2 border-[#37d67a] bg-[#eafff4] px-3 py-2 text-sm font-extrabold text-[#05603a]">
                        ✓ أنت مستحق للشهادة: {certificate.message}
                      </p>
                    )}

                    {hasCertificate ? (
                      <div className="mt-4 rounded-[1.75rem] border-4 border-gold-400 bg-white p-5 text-center animate-bounce-in">
                        <p className="text-sm font-extrabold tracking-widest text-gold-600">مدرسة {LESSON_META.school}</p>
                        <h3 className="font-display mt-1 text-2xl text-brand-900">شهادة إتمام {LESSON_META.lessonNumber}</h3>
                        <p className="text-lg font-bold text-brand-700">{LESSON_META.title}</p>
                        <div className="ornament-divider my-2 text-sm">❖</div>
                        <p className="text-base font-bold text-brand-700">تُمنح للطالب المتميز</p>
                        <p className="font-display my-1 text-3xl text-brand-800">{student.studentName}</p>
                        <p className="text-base font-bold text-brand-700">
                          فصل {student.className.split("/")[1]} — تقدم {toArabicDigits(progressPercent)}٪ ودرجة {toArabicDigits(scorePercent)}٪
                        </p>
                        <p className="mt-3 text-xs font-bold text-brand-500">📅 {new Date().toLocaleDateString("ar-SA")}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              {slide.hint ? (
                <details className="rounded-[1.5rem] border-4 border-gold-200 bg-gold-50 px-4 py-3">
                  <summary className="cursor-pointer text-base font-extrabold text-gold-900">💡 تلميح المعلم</summary>
                  <p className="mt-2 text-base font-bold leading-8 text-gold-900">{slide.hint}</p>
                </details>
              ) : null}
            </div>

            {/* أزرار التنقل */}
            <div className="screen-only flex flex-wrap items-center justify-between gap-3 border-t-4 border-sand-200 bg-sand-50 px-3.5 py-4 sm:px-6">
              <button
                type="button"
                className="kid-btn kid-btn-plain !px-5 !py-3"
                disabled={student.currentSlide <= 1}
                onClick={() => goToSlide(student.currentSlide - 1)}
              >
                ← السابق
              </button>
              <p className="font-display text-sm text-brand-600">
                {toArabicDigits(student.currentSlide)} / {toArabicDigits(TOTAL_SLIDES)}
              </p>
              <button
                type="button"
                className="kid-btn !px-6 !py-3"
                disabled={student.currentSlide >= TOTAL_SLIDES}
                onClick={handleNext}
              >
                {student.currentSlide === TOTAL_SLIDES - 1 ? "🎓 الختام" : "التالي →"}
              </button>
            </div>
          </article>

          <div className="screen-only mt-3 flex flex-wrap items-center justify-between gap-2 rounded-full bg-white px-4 py-2 shadow-sm">
            <p className="text-sm font-extrabold text-brand-700">🌟 أحسنت {student.studentName}! وصلت المحطة {toArabicDigits(student.maxSlide)}</p>
            <p className="text-xs font-bold text-brand-500">{LESSON_META.subject} · {LESSON_META.school}</p>
          </div>
        </section>
      </main>
    </div>
  );
}
