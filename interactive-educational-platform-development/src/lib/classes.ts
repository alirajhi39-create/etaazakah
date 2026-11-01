export const CLASS_OPTIONS = ["3/أ", "3/ب"] as const;
/** فصل قديم يبقى مدعومًا في التطبيع للسجلات السابقة */
export const LEGACY_CLASSES = ["3/ج"] as const;
export type ClassName = (typeof CLASS_OPTIONS)[number];

const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
const EASTERN_ARABIC_INDIC = "۰۱۲۳۴۵۶۷۸۹";

function normalizeDigits(value: string): string {
  return value.replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC.indexOf(d))).replace(/[۰-۹]/g, (d) => String(EASTERN_ARABIC_INDIC.indexOf(d)));
}

function stripDiacritics(value: string): string {
  return value.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, "");
}

/**
 * توحيد صيغ الفصول المختلفة إلى الصيغة القياسية «3/أ» أو «3/ب» أو «3/ج».
 * أمثلة: "3أ" / "٣ / أ" / "3-A" / "الصف الثالث أ" / "ثالث ب" => 3/أ ... إلخ
 */
export function normalizeClassName(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  let value = normalizeDigits(String(raw).trim());
  value = stripDiacritics(value);
  if (!value) return "";

  const lower = value.toLowerCase();
  const hasThird =
    lower.includes("3") ||
    lower.includes("ثالث") ||
    lower.includes("الثالث") ||
    lower.includes("third") ||
    lower.includes("iii");

  // إزالة كلمات الصف حتى لا تُحتسب حروفها (مثل «ثالث») على أنها رمز الفصل
  const letterScope = lower.replace(/(الابتدائي|ابتدائي|الفصل|الصف|الثالث|ثالث|شعبة|فصل|صف|third|grade|iii|primary)/g, " ");

  let letter: string | null = null;
  if (/[أاإآa]/.test(letterScope)) letter = "أ";
  else if (/[بb]/.test(letterScope)) letter = "ب";
  else if (/[جjc]/.test(letterScope)) letter = "ج";

  if (!hasThird && !letter) return value.replace(/\s+/g, " ").trim();
  if (!letter) return "3/أ";
  return `3/${letter}`;
}

export function isClassOption(value: string): boolean {
  return [...CLASS_OPTIONS, ...LEGACY_CLASSES].includes(value as ClassName | (typeof LEGACY_CLASSES)[number]);
}

/** اسم نظيف للمقارنة والبحث */
export function normalizeName(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  return stripDiacritics(String(raw))
    .replace(/[إآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanStudentName(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  return String(raw)
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}
