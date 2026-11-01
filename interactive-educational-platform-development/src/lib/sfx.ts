/**
 * مؤثرات صوتية مركّبة داخل المتصفح (Web Audio) — تعمل بدون أي ملفات مرفوعة.
 * تُستخدم لأزرار التنقل، واختيار الإجابات، ونتائج الأسئلة والاختبارات.
 */

export type SfxKind = "tap" | "next" | "back" | "correct" | "wrong" | "celebrate" | "select";

let context: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!context) context = new Ctor();
  if (context.state === "suspended") void context.resume();
  return context;
}

type Note = { freq: number; start: number; duration: number; type?: OscillatorType; gain?: number };

const RECIPES: Record<SfxKind, Note[]> = {
  // نقرة خفيفة عند اختيار بطاقة أو بدء النشاط
  tap: [{ freq: 640, start: 0, duration: 0.07, type: "triangle", gain: 0.16 }],
  // انتقال للأمام
  next: [
    { freq: 523.25, start: 0, duration: 0.1, type: "sine", gain: 0.2 },
    { freq: 783.99, start: 0.09, duration: 0.12, type: "sine", gain: 0.18 },
  ],
  // رجوع للخلف
  back: [
    { freq: 659.25, start: 0, duration: 0.1, type: "sine", gain: 0.18 },
    { freq: 440, start: 0.09, duration: 0.12, type: "sine", gain: 0.16 },
  ],
  // اختيار خيار في سؤال
  select: [
    { freq: 587.33, start: 0, duration: 0.08, type: "triangle", gain: 0.16 },
    { freq: 880, start: 0.07, duration: 0.09, type: "triangle", gain: 0.13 },
  ],
  // إجابة صحيحة: ثلاث نغمات صاعدة
  correct: [
    { freq: 523.25, start: 0, duration: 0.12, type: "sine", gain: 0.2 },
    { freq: 659.25, start: 0.11, duration: 0.12, type: "sine", gain: 0.2 },
    { freq: 880, start: 0.22, duration: 0.2, type: "sine", gain: 0.22 },
  ],
  // إجابة خاطئة: نغمتان هابطتان لطيفتان
  wrong: [
    { freq: 392, start: 0, duration: 0.16, type: "triangle", gain: 0.18 },
    { freq: 294, start: 0.15, duration: 0.24, type: "triangle", gain: 0.16 },
  ],
  // إتمام الدرس: أربع نغمات احتفالية
  celebrate: [
    { freq: 523.25, start: 0, duration: 0.14, type: "sine", gain: 0.2 },
    { freq: 659.25, start: 0.13, duration: 0.14, type: "sine", gain: 0.2 },
    { freq: 783.99, start: 0.26, duration: 0.16, type: "sine", gain: 0.22 },
    { freq: 1046.5, start: 0.4, duration: 0.34, type: "sine", gain: 0.22 },
  ],
};

/** تشغيل مؤثر صوتي مركّب. يعيد true إذا نجح التشغيل. */
export function playSfx(kind: SfxKind): boolean {
  const ctx = getContext();
  if (!ctx) return false;
  const notes = RECIPES[kind] ?? RECIPES.tap;
  const now = ctx.currentTime;

  try {
    for (const note of notes) {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.type = note.type ?? "sine";
      oscillator.frequency.setValueAtTime(note.freq, now + note.start);
      gainNode.gain.setValueAtTime(0.0001, now + note.start);
      gainNode.gain.exponentialRampToValueAtTime(note.gain ?? 0.18, now + note.start + 0.015);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + note.start + note.duration);
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.start(now + note.start);
      oscillator.stop(now + note.start + note.duration + 0.02);
    }
    return true;
  } catch {
    return false;
  }
}

/** تحويل مفاتيح المؤثرات إلى النوع المقابل */
export function sfxKindFor(key: string): SfxKind {
  if (key === "correct" || key === "wrong" || key === "celebrate" || key === "tap" || key === "select") return key;
  return "tap";
}
