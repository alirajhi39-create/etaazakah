/**
 * محرّك الشرح الصوتي: يحسّن نطق العربية ويحافظ على الحركات (التشكيل)،
 * ويكتشف أفضل الأصوات المتاحة في المتصفح (أصوات عصبية طبيعية، صوت طفل، صوت نسائي).
 */

export type VoicePreset = "child" | "teacher" | "natural";

export type VoiceSettings = {
  preset: VoicePreset;
  voiceURI: string | null;
  rate: number;
  pitch: number;
};

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  preset: "child",
  voiceURI: null,
  rate: 0.9,
  pitch: 1.32,
};

/** إعدادات نطق ثابتة داخل الشرائح (بدون أي لوحة إعدادات للطالب) */
export const NARRATION_PROFILE = { rate: 0.9, pitch: 1.32 } as const;

export const PRESET_VALUES: Record<VoicePreset, { rate: number; pitch: number; label: string; hint: string; emoji: string }> = {
  child: { rate: 0.9, pitch: 1.4, label: "صوت طفل", hint: "نبرة عالية ومرحة مناسبة للصف الثالث", emoji: "🧒" },
  teacher: { rate: 0.82, pitch: 1.0, label: "صوت المعلم", hint: "نبرة هادئة واضحة مع نطق متأنٍّ", emoji: "👨‍🏫" },
  natural: { rate: 0.95, pitch: 1.12, label: "طبيعي وسريع", hint: "أقرب للكلام العادي", emoji: "🎧" },
};

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const SMALL_NUMBERS = [
  "صفر",
  "واحد",
  "اثنان",
  "ثلاثة",
  "أربعة",
  "خمسة",
  "ستة",
  "سبعة",
  "ثمانية",
  "تسعة",
  "عشرة",
  "أحد عشر",
  "اثنا عشر",
  "ثلاثة عشر",
  "أربعة عشر",
  "خمسة عشر",
  "ستة عشر",
  "سبعة عشر",
  "ثمانية عشر",
  "تسعة عشر",
  "عشرون",
];

function numberToArabicWord(value: number): string {
  if (Number.isInteger(value) && value >= 0 && value < SMALL_NUMBERS.length) return SMALL_NUMBERS[value];
  if (Number.isInteger(value) && value > 20 && value < 100) {
    const tens = Math.floor(value / 10) * 10;
    const ones = value % 10;
    const tensWord: Record<number, string> = { 20: "عشرون", 30: "ثلاثون", 40: "أربعون", 50: "خمسون", 60: "ستون", 70: "سبعون", 80: "ثمانون", 90: "تسعون" };
    return ones === 0 ? tensWord[tens] ?? String(value) : `${SMALL_NUMBERS[ones]} و${tensWord[tens] ?? ""}`;
  }
  return String(value);
}

/**
 * تجهيز النص للنطق: إزالة الرموز التي تربك المحرّك، وفتح المختصرات،
 * والحفاظ على التشكيل (الحركات) لأن الأصوات العربية الجيدة تنطقها بدقة.
 */
export function prepareForSpeech(raw: string): string {
  let text = raw ?? "";

  // الحركات والعلامات التي يجب إبقاؤها مع تصحيح بعض الرموز الخاصة
  text = text
    .replace(/[\uFD3E\uFD3F\uFDFD]/g, " ") // أقواس قرآنية مزخرفة
    .replace(/ﷺ/g, "صلى الله عليه وسلم")
    .replace(/ﷻ/g, "جل جلاله")
    .replace(/رحِمهُ/g, "رحمه")
    .replace(/[«»"“”]/g, " ")
    .replace(/[()\[\]{}<>]/g, " ")
    .replace(/[﴿﴾]/g, " ")
    .replace(/[﷽]/g, "بسم الله الرحمن الرحيم")
    .replace(/[؛،]/g, "،")
    .replace(/[·•◆★✦—–_/\\|#*]/g, " ")
    .replace(/\s*=\s*/g, " يساوي ")
    .replace(/٪|%/g, " بالمئة ")
    .replace(/٫/g, " فاصلة ")
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)))
    .replace(/(\d)\s*\/\s*(\d)/g, "$1 من $2")
    .replace(/\s+/g, " ")
    .trim();

  // الأعداد الصغيرة تُقرأ بالكلمات ليكون النطق أفصح
  text = text.replace(/\b(\d{1,2})\b/g, (match) => numberToArabicWord(Number(match)));

  // الأعداد الكبيرة تُحوَّل إلى أرقام عربية ليدركها المحرّك العربي
  text = text.replace(/[0-9]/g, (digit) => ARABIC_DIGITS[Number(digit)]);

  // إضافة فواصل تنفّس خفيفة بعد علامات الترقيم لتحسين الإيقاع
  text = text
    .replace(/\s+([،؛:.!؟])/g, "$1")
    .replace(/([،:؛.!؟])\s*/g, "$1 ")
    .replace(/\s{2,}/g, " ")
    .trim();

  return text;
}

/** تقسيم النص إلى جُمل قصيرة لتفادي انقطاع النطق وتحسين الوضوح */
export function splitForSpeech(text: string, maxLength = 150): string[] {
  const sentences = text
    .split(/(?<=[.!؟،؛:])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  for (const sentence of sentences) {
    if (sentence.length <= maxLength) {
      chunks.push(sentence);
      continue;
    }
    const words = sentence.split(/\s+/);
    let current = "";
    for (const word of words) {
      if ((current + " " + word).trim().length > maxLength) {
        if (current) chunks.push(current.trim());
        current = word;
      } else {
        current = `${current} ${word}`.trim();
      }
    }
    if (current) chunks.push(current.trim());
  }
  return chunks.length ? chunks : [text];
}

export type ScoredVoice = { voice: SpeechSynthesisVoice; score: number; tag: string };

const FEMALE_HINTS = ["female", "woman", "hala", "salma", "laila", "amany", "zariyah", "sana", "hoda", "amina", "maryam", "noor", "sara"];
const CHILD_HINTS = ["child", "kid", "boy", "girl", "tala", "طفل", "صغير"];

/** ترتيب الأصوات العربية: الأفضل نطقًا وأقربها لصوت طفل */
export function rankArabicVoices(voices: SpeechSynthesisVoice[], preset: VoicePreset = "child"): ScoredVoice[] {
  return voices
    .filter((voice) => voice.lang?.toLowerCase().startsWith("ar"))
    .map((voice) => {
      const name = voice.name.toLowerCase();
      let score = 0;
      const tags: string[] = [];
      if (voice.lang.toLowerCase() === "ar-sa") {
        score += 50;
        tags.push("سعودي");
      } else if (voice.lang.toLowerCase().startsWith("ar")) {
        score += 25;
      }
      if (/natural|neural|online|wavenet|premium|enhanced/.test(name)) {
        score += 30;
        tags.push("طبيعي");
      }
      if (/google/.test(name)) {
        score += 14;
        tags.push("Google");
      }
      if (FEMALE_HINTS.some((hint) => name.includes(hint))) {
        score += preset === "teacher" ? 6 : 16;
        tags.push("أنثوي");
      }
      if (CHILD_HINTS.some((hint) => name.includes(hint))) {
        score += preset === "child" ? 28 : 10;
        tags.push("طفولي");
      }
      if (!voice.localService) score += 8;
      return { voice, score, tag: tags.join(" · ") };
    })
    .sort((a, b) => b.score - a.score);
}

export function pickBestVoice(voices: SpeechSynthesisVoice[], settings: VoiceSettings): SpeechSynthesisVoice | null {
  if (settings.voiceURI) {
    const exact = voices.find((voice) => voice.voiceURI === settings.voiceURI);
    if (exact) return exact;
  }
  const ranked = rankArabicVoices(voices, settings.preset);
  return ranked[0]?.voice ?? null;
}

export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}
