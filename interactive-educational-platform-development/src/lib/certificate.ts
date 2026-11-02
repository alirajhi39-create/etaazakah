import type { ActivityMap } from "@/lib/types";

/** الحد الأدنى لدرجة الاختبار لاستحقاق الشهادة */
export const MIN_QUIZ_SCORE = 5;
/** النسبة المطلوبة من الأنشطة (أكثر من ٧٥٪) */
export const MIN_ACTIVITIES_PERCENT = 75;

export type ActivityRequirement = {
  key: string;
  label: string;
  icon: string;
  done: boolean;
};

const textLength = (value: unknown): number => (typeof value === "string" ? value.trim().length : 0);

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/**
 * قائمة أنشطة الدرس ومعيار إتمام كل نشاط.
 * الأنشطة التسعة مستثناة من الاختبار لأنه معيار مستقل للاستحقاق.
 */
export function activityRequirements(activities: ActivityMap | undefined): ActivityRequirement[] {
  const a = activities ?? {};

  const brainstorm = record(a.brainstorm);
  const meaning = record(a.meaningCheck);
  const evidence = record(a.evidence);
  const virtue = record(a.virtue);
  const sincerity = record(a.sincerity);
  const warning = record(a.warning);
  const saving = record(a.saving);
  const evaluation = record(a.evaluation);
  const reflection = record(a.reflection);

  const savingMethods = Array.isArray(saving.methods) ? (saving.methods as unknown[]) : [];
  const savingFilled = savingMethods.filter((method) => textLength(method) > 3).length;

  const evaluationAnswers = record(evaluation.answers);
  const evaluationFilled = Object.values(evaluationAnswers).filter((answer) => textLength(answer) > 3).length;

  const evidenceSolved =
    evidence.checked === true ||
    evidence.choiceChecked === true ||
    (Array.isArray(evidence.order) && (evidence.order as unknown[]).length >= 4);

  const sinceritySolved =
    sincerity.checked === true ||
    sincerity.choiceChecked === true ||
    Object.keys(record(sincerity.answers)).length >= 2;

  return [
    { key: "brainstorm", label: "العصف الذهني", icon: "🧠", done: textLength(brainstorm.text) > 3 },
    { key: "meaningCheck", label: "سؤال معنى الزكاة", icon: "💡", done: meaning.checked === true },
    { key: "evidence", label: "آية الدليل وترتيب كلماتها", icon: "📖", done: evidenceSolved },
    { key: "virtue", label: "سؤال فضل الزكاة", icon: "🌻", done: virtue.checked === true },
    { key: "sincerity", label: "تصنيف الإخلاص والمتابعة", icon: "🧩", done: sinceritySolved },
    { key: "warning", label: "نشاط الإضاءة", icon: "⚠️", done: warning.checked === true },
    { key: "saving", label: "طرق ادّخار المال", icon: "🏦", done: savingFilled >= 1 },
    { key: "evaluation", label: "أسئلة التقويم", icon: "✍️", done: evaluationFilled >= 2 },
    {
      key: "reflection",
      label: "التأمّل الختامي",
      icon: "🌱",
      done: textLength(reflection.learned) > 3 || textLength(reflection.action) > 3,
    },
  ];
}

export type CertificateStatus = {
  eligible: boolean;
  quizScore: number;
  quizTotal: number;
  quizPassed: boolean;
  activitiesDone: number;
  activitiesTotal: number;
  activitiesPercent: number;
  activitiesPassed: boolean;
  missing: ActivityRequirement[];
  message: string;
};

export function evaluateCertificate(input: {
  quizScore: number;
  quizTotal: number;
  activities: ActivityMap | undefined;
}): CertificateStatus {
  const requirements = activityRequirements(input.activities);
  const activitiesDone = requirements.filter((item) => item.done).length;
  const activitiesTotal = requirements.length;
  const activitiesPercent = Math.round((activitiesDone / activitiesTotal) * 100);
  const quizScore = Math.max(0, Number(input.quizScore) || 0);
  const quizTotal = Math.max(0, Number(input.quizTotal) || 0);

  const quizPassed = quizScore >= MIN_QUIZ_SCORE;
  const activitiesPassed = activitiesPercent > MIN_ACTIVITIES_PERCENT;
  // لاستحقاق الشهادة يجب إنجاز الشرطين معًا: درجة ٥ فأعلى + أكثر من ٧٥٪ من الأنشطة
  const eligible = quizPassed && activitiesPassed;

  const missingParts: string[] = [];
  if (!quizPassed) missingParts.push(`درجتك في الاختبار ${quizScore} من ${quizTotal || 7} (المطلوب ٥ فأعلى)`);
  if (!activitiesPassed) missingParts.push(`أتممت ${activitiesPercent}٪ من الأنشطة (المطلوب أكثر من ٧٥٪)`);

  const message = eligible
    ? "أحسنت! أنجزت شرطي الشهادة: درجة الاختبار ٥ فأعلى، وأكثر من ٧٥٪ من الأنشطة."
    : `لم تحصل على الشهادة بعد؛ لأن الشهادة تحتاج إلى الشرطين معًا: درجة الاختبار ٥ فأعلى، وأكثر من ٧٥٪ من الأنشطة. ${missingParts.join("، و")}. أعد الاختبار وأكمل الأنشطة حتى تحصل على الشهادة.`;

  return {
    eligible,
    quizScore,
    quizTotal,
    quizPassed,
    activitiesDone,
    activitiesTotal,
    activitiesPercent,
    activitiesPassed,
    missing: requirements.filter((item) => !item.done),
    message,
  };
}
