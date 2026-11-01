"use client";

import Image from "next/image";
import { useState } from "react";
import {
  EVIDENCE,
  EVALUATION,
  MEANING,
  QUIZ,
  SAVING,
  SINCERITY,
  VIRTUE,
  WARNING,
} from "@/lib/lesson";

/* ------------------------------- utilities ------------------------------- */

export const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
export function toLatinDigits(input: string): string {
  return input.replace(/[٠-٩]/g, (digit) => String(AR_DIGITS.indexOf(digit)));
}
export function toArabicDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (digit) => AR_DIGITS[Number(digit)]);
}
export function parseNumberInput(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const cleaned = toLatinDigits(String(raw ?? ""))
    .replace(/[,\u066C\s]/g, "")
    .trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned.replace(/[٫.]/g, "."));
  return Number.isFinite(parsed) ? parsed : null;
}
export function formatArabicNumber(value: number): string {
  return new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 2 }).format(value);
}

type Tone = "success" | "error" | "info";
function Feedback({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const styles =
    tone === "success"
      ? "bg-[#eafff4] border-[#37d67a] text-[#05603a]"
      : tone === "error"
        ? "bg-[#fff1ee] border-coral-300 text-coral-700"
        : "bg-sky-50 border-sky-200 text-sky-700";
  const icon = tone === "success" ? "🎉" : tone === "error" ? "💪" : "💡";
  return (
    <div className={`animate-bounce-in flex items-start gap-2 rounded-[1.5rem] border-4 px-4 py-3 text-base font-bold leading-8 shadow-sm ${styles}`}>
      <span className="text-xl">{icon}</span>
      <div>{children}</div>
    </div>
  );
}

function Reference({ text, source }: { text: string; source: string }) {
  return (
    <div className="relative rounded-[1.75rem] border-4 border-gold-300 bg-gradient-to-bl from-gold-50 via-white to-brand-50 p-5 text-center shadow-sticker">
      <span className="absolute -top-3 right-6 rounded-full bg-brand-500 px-3 py-1 text-sm font-extrabold text-white">الآية الكريمة</span>
      <p className="font-display mt-2 text-2xl leading-[2.4rem] text-brand-900 sm:text-3xl sm:leading-[3rem]">{text}</p>
      <p className="mt-1 text-sm font-extrabold text-gold-700">({source})</p>
    </div>
  );
}

/* --------------------------- ١) العصف الذهني --------------------------- */

export type BrainstormValue = { text: string };
export function BrainstormActivity({
  value,
  onChange,
}: {
  value: BrainstormValue | undefined;
  onChange: (next: BrainstormValue) => void;
}) {
  const ideas = ["الزكاة ركن من أركان الإسلام", "حق الفقير في مال الغني", "تُطهّر المال والنفس"];
  return (
    <div className="space-y-3">
      <span className="act-title">🧠 عصف ذهني</span>
      <p className="text-base font-extrabold text-brand-900">ماذا تعرف عن إيتاء الزكاة؟ اكتب فكرتك 👇</p>
      <textarea
        className="field min-h-28 resize-y"
        placeholder="اكتب ما تعرفه عن الزكاة…"
        maxLength={280}
        value={value?.text ?? ""}
        onChange={(event) => onChange({ text: event.target.value })}
      />
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-brand-600">أفكار مساعدة:</span>
        {ideas.map((idea) => (
          <button
            key={idea}
            type="button"
            className="rounded-full border-2 border-brand-200 bg-brand-50 px-3 py-1 text-sm font-extrabold text-brand-700"
            onClick={() => onChange({ text: `${value?.text ? `${value.text} — ` : ""}${idea}`.slice(0, 280) })}
          >
            + {idea}
          </button>
        ))}
      </div>
      {value?.text ? <Feedback tone="info">جميل! إجابتك محفوظة، وسنتحقق منها معًا في الشرائح التالية.</Feedback> : null}
    </div>
  );
}

/* ------------------------------ ٢) اختيار ------------------------------ */

export type ChoiceValue = { selected: number | null; checked: boolean };
export function ChoiceActivity({
  id,
  question,
  options,
  correctIndex,
  feedback,
  value,
  onChange,
  playSound,
  title = "اختبر فهمك",
}: {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  feedback: string;
  value: ChoiceValue | undefined;
  onChange: (next: ChoiceValue) => void;
  playSound: (key: string) => void;
  title?: string;
}) {
  const selected = value?.selected ?? null;
  const checked = Boolean(value?.checked);
  return (
    <div className="act-card space-y-3">
      <span className="act-title">✍️ {title}</span>
      <p className="text-base font-extrabold leading-8 text-brand-900">{question}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option, index) => {
          const isSelected = selected === index;
          const cls = checked
            ? index === correctIndex
              ? "tile-correct"
              : isSelected
                ? "tile-wrong"
                : "opacity-60"
            : isSelected
              ? "tile-active"
              : "";
          return (
            <button
              key={`${id}-${index}`}
              type="button"
              disabled={checked}
              onClick={() => {
                playSound("select");
                onChange({ selected: index, checked: false });
              }}
              className={`opt-tile ${cls}`}
            >
              {option}
            </button>
          );
        })}
      </div>
      {!checked ? (
        <button
          type="button"
          className="kid-btn !px-5 !py-2 !text-sm"
          disabled={selected === null}
          onClick={() => {
            onChange({ selected, checked: true });
            playSound(selected === correctIndex ? "correct" : "wrong");
          }}
        >
          تحقّق من الإجابة
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="kid-btn kid-btn-plain !px-4 !py-2 !text-sm" onClick={() => onChange({ selected: null, checked: false })}>
            ↺ إعادة المحاولة
          </button>
          <div className="grow">
            <Feedback tone={selected === correctIndex ? "success" : "error"}>
              {selected === correctIndex ? feedback : "ليست الإجابة الصحيحة، راجع الشريحة ثم أعد المحاولة."}
            </Feedback>
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------- ٣) الدليل: ترتيب الآية + اختيار --------------------- */

export type EvidenceValue = {
  order: string[];
  checked: boolean;
  selected: number | null;
  choiceChecked: boolean;
};
export function EvidenceActivity({
  value,
  onChange,
  playSound,
}: {
  value: EvidenceValue | undefined;
  onChange: (next: EvidenceValue) => void;
  playSound: (key: string) => void;
}) {
  const order = value?.order ?? [];
  const checked = Boolean(value?.checked);
  const pool = EVIDENCE.shuffled.filter((word) => !order.includes(word));
  const score = order.filter((word, index) => EVIDENCE.words[index] === word).length;

  return (
    <div className="space-y-4">
      <Reference text={EVIDENCE.text} source={EVIDENCE.reference} />
      <p className="rounded-2xl border border-brand-100 bg-brand-50/60 px-4 py-3 text-base font-bold leading-7 text-brand-800">
        📖 المعنى: {EVIDENCE.meaning}
      </p>

      <div className="act-card">
        <span className="act-title">🧩 رتّب كلمات الآية</span>
        <p className="mb-2 mt-2 text-base font-extrabold text-brand-900">اضغط على الكلمات بالترتيب الصحيح:</p>
        <div className="flex flex-wrap gap-2 rounded-[1.75rem] border-4 border-dashed border-brand-200 bg-brand-50/40 p-3">
          {order.length === 0 ? <span className="text-base font-bold text-brand-500">اضغط على الكلمات بالترتيب…</span> : null}
          {order.map((word, index) => {
            const isRight = checked && EVIDENCE.words[index] === word;
            return (
              <button
                key={`picked-${word}`}
                type="button"
                disabled={checked}
                onClick={() => {
                  playSound("tap");
                  onChange({ ...(value ?? { selected: null, choiceChecked: false }), order: order.filter((item) => item !== word), checked: false });
                }}
                className={`rounded-2xl border bg-white px-3 py-1.5 font-display text-lg font-bold ${
                  checked ? (isRight ? "border-[#12b76a] text-[#067647]" : "border-[#f04438] text-[#b42318]") : "border-brand-200 text-brand-800"
                }`}
              >
                {word}
                {checked ? (isRight ? " ✓" : " ✗") : ""}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {pool.length === 0 ? <span className="text-base font-bold text-brand-500">أكملت كل الكلمات ✓</span> : null}
          {pool.map((word) => (
            <button
              key={`pool-${word}`}
              type="button"
              disabled={checked}
              onClick={() => {
                playSound("select");
                onChange({
                  ...(value ?? { selected: null, choiceChecked: false }),
                  order: [...order, word],
                  checked: false,
                });
              }}
              className="tile-option rounded-2xl border border-sand-200 bg-sand-50 px-3 py-1.5 font-display text-lg font-bold text-brand-700"
            >
              {word}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="kid-btn !px-5 !py-2 !text-sm"
            disabled={order.length < EVIDENCE.words.length}
            onClick={() => {
              onChange({ ...(value ?? { selected: null, choiceChecked: false }), order, checked: true });
              playSound(score === EVIDENCE.words.length ? "correct" : "wrong");
            }}
          >
            تحقّق من الترتيب
          </button>
          <button
            type="button"
            className="kid-btn kid-btn-plain !px-4 !py-2 !text-sm"
            onClick={() => onChange({ ...(value ?? { selected: null, choiceChecked: false }), order: [], checked: false })}
          >
            ↺ إعادة
          </button>
          {checked ? (
            <span className="rounded-full border-2 border-brand-200 bg-brand-50 px-3 py-1 text-sm font-extrabold text-brand-700">ترتيبك صحيح في {toArabicDigits(score)} من {toArabicDigits(EVIDENCE.words.length)} كلمات</span>
          ) : null}
        </div>
      </div>

      <ChoiceActivity
        id="evidence-choice"
        title="سؤال التقويم"
        question="ما الدليل على وجوب الزكاة؟"
        options={EVIDENCE.options}
        correctIndex={EVIDENCE.correctIndex}
        feedback={EVIDENCE.feedback}
        value={value ? { selected: value.selected, checked: value.choiceChecked } : undefined}
        onChange={(next) => onChange({ ...(value ?? { order, checked: false }), selected: next.selected, choiceChecked: next.checked })}
        playSound={playSound}
      />
    </div>
  );
}

/* --------------------------- ٤) فضل الزكاة --------------------------- */

export type VirtueValue = ChoiceValue;
export function VirtueActivity({
  value,
  onChange,
  playSound,
}: {
  value: VirtueValue | undefined;
  onChange: (next: VirtueValue) => void;
  playSound: (key: string) => void;
}) {
  return (
    <div className="space-y-4">
      <Reference text={VIRTUE.text} source={VIRTUE.reference} />
      <div className="grid gap-2 sm:grid-cols-3">
        {VIRTUE.points.map((point, index) => (
          <div key={point} className="rounded-2xl border border-brand-100 bg-white p-3 text-center">
            <div className="text-2xl">{["✨", "🌱", "🤝"][index]}</div>
            <p className="mt-1 text-base font-bold leading-6 text-brand-800">{point}</p>
          </div>
        ))}
      </div>
      <ChoiceActivity
        id="virtue"
        question={VIRTUE.question}
        options={VIRTUE.options}
        correctIndex={VIRTUE.correctIndex}
        feedback={VIRTUE.feedback}
        value={value}
        onChange={onChange}
        playSound={playSound}
      />
    </div>
  );
}

/* ------------------- ٥) الإخلاص والمتابعة (تصنيف) ------------------- */

export type SincerityValue = {
  answers: Record<string, string>;
  checked: boolean;
  selected: number | null;
  choiceChecked: boolean;
};
export function SincerityActivity({
  value,
  onChange,
  playSound,
}: {
  value: SincerityValue | undefined;
  onChange: (next: SincerityValue) => void;
  playSound: (key: string) => void;
}) {
  const answers = value?.answers ?? {};
  const checked = Boolean(value?.checked);
  const [picked, setPicked] = useState<string | null>(null);
  const unassigned = SINCERITY.items.filter((item) => !answers[item.id]);
  const score = SINCERITY.items.filter((item) => answers[item.id] === item.bin).length;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border-2 border-gold-300 bg-gold-50 p-4 text-center">
        <p className="font-display text-lg leading-8 text-brand-900">{SINCERITY.statement}</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {SINCERITY.bins.map((bin) => {
          const items = SINCERITY.items.filter((item) => answers[item.id] === bin.id);
          return (
            <button
              key={bin.id}
              type="button"
              onClick={() => {
                if (!picked || checked) return;
                playSound("select");
                onChange({ ...(value ?? { selected: null, choiceChecked: false }), answers: { ...answers, [picked]: bin.id }, checked: false });
                setPicked(null);
              }}
              className={`min-h-32 rounded-[1.75rem] border-4 border-dashed p-3 text-right transition ${
                bin.id === "ikhlas" ? "border-brand-200 bg-brand-50/60" : "border-gold-300 bg-gold-50/60"
              } ${picked && !checked ? "ring-2 ring-brand-300 ring-offset-2" : ""}`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-base font-extrabold text-brand-900">{bin.icon} {bin.label}</span>
                <span className="rounded-full bg-white px-2.5 py-0.5 text-sm font-extrabold text-brand-700 shadow-sm">{toArabicDigits(items.length)}</span>
              </div>
              <p className="mb-2 text-sm font-bold text-brand-500">{bin.hint}</p>
              <div className="flex flex-col gap-2">
                {items.map((item) => {
                  const isRight = answers[item.id] === item.bin;
                  return (
                    <span
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (!checked) onChange({ ...(value ?? { selected: null, choiceChecked: false }), answers: { ...answers, [item.id]: "" }, checked: false });
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !checked) {
                          onChange({ ...(value ?? { selected: null, choiceChecked: false }), answers: { ...answers, [item.id]: "" }, checked: false });
                        }
                      }}
                      className={`rounded-2xl border bg-white px-2 py-1 text-sm font-bold ${
                        checked ? (isRight ? "border-[#12b76a] text-[#067647]" : "border-[#f04438] text-[#b42318]") : "border-sand-300 text-brand-800"
                      }`}
                    >
                      {item.icon} {item.label} {checked ? (isRight ? "✓" : "✗") : "×"}
                    </span>
                  );
                })}
              </div>
            </button>
          );
        })}
      </div>

      <div className="act-card !p-3">
        <p className="mb-2 text-sm font-extrabold text-brand-700">
          {unassigned.length ? "اضغط على العبارة ثم على مكانها المناسب:" : "تم تصنيف كل العبارات 🎉"}
        </p>
        <div className="flex flex-wrap gap-2">
          {unassigned.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={checked}
              onClick={() => setPicked(item.id)}
              className={`tile-option rounded-2xl border-2 px-2.5 py-1.5 text-sm font-extrabold ${
                picked === item.id ? "tile-active" : "border-sand-200 bg-sand-50 text-brand-800"
              }`}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="kid-btn !px-5 !py-2 !text-sm"
            disabled={unassigned.length > 0}
            onClick={() => {
              onChange({ ...(value ?? { selected: null, choiceChecked: false }), answers, checked: true });
              playSound(score === SINCERITY.items.length ? "correct" : "wrong");
            }}
          >
            تحقّق من التصنيف
          </button>
          <button
            type="button"
            className="kid-btn kid-btn-plain !px-4 !py-2 !text-sm"
            onClick={() => {
              setPicked(null);
              onChange({ ...(value ?? { selected: null, choiceChecked: false }), answers: {}, checked: false });
            }}
          >
            ↺ إعادة
          </button>
          {checked ? <span className="rounded-full border-2 border-brand-200 bg-brand-50 px-3 py-1 text-sm font-extrabold text-brand-700">{toArabicDigits(score)} / {toArabicDigits(SINCERITY.items.length)}</span> : null}
        </div>
      </div>

      <ChoiceActivity
        id="sincerity"
        question={SINCERITY.question}
        options={SINCERITY.options}
        correctIndex={SINCERITY.correctIndex}
        feedback={SINCERITY.feedback}
        value={value ? { selected: value.selected, checked: value.choiceChecked } : undefined}
        onChange={(next) => onChange({ ...(value ?? { answers, checked: false }), selected: next.selected, choiceChecked: next.checked })}
        playSound={playSound}
      />
    </div>
  );
}

/* ----------------------------- ٦) إضاءة ----------------------------- */

export type WarningValue = { selected: number | null; checked: boolean; revealed: string[] };
export function WarningActivity({
  value,
  onChange,
  playSound,
}: {
  value: WarningValue | undefined;
  onChange: (next: WarningValue) => void;
  playSound: (key: string) => void;
}) {
  const revealed = value?.revealed ?? [];
  const [active, setActive] = useState<string | null>(revealed[0] ?? null);
  const activeCard = WARNING.images.find((image) => image.id === active) ?? null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gold-300 bg-gradient-to-l from-gold-50 to-sand-50 p-4">
        <p className="mb-1 text-base font-extrabold text-gold-700">💡 إضاءة</p>
        <p className="font-display text-lg leading-8 text-brand-900">{WARNING.headline}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {WARNING.effects.map((effect) => (
            <span key={effect} className="chip bg-white border-gold-200 text-gold-800">⚠️ {effect}</span>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-sand-200 bg-white">
        <Image
          src="/images/zakat-warning.webp"
          alt="ثلاث صور: أرض خضراء، وأرض قاحلة، ومطر ينزل"
          width={1920}
          height={1280}
          className="h-auto w-full object-cover"
        />
        <div className="grid gap-2 p-3 sm:grid-cols-3">
          {WARNING.images.map((image) => (
            <button
              key={image.id}
              type="button"
              onClick={() => {
                playSound("tap");
                setActive(image.id);
                if (!revealed.includes(image.id)) onChange({ ...(value ?? { selected: null, checked: false }), revealed: [...revealed, image.id] });
              }}
              className={`tile-option rounded-2xl border px-2 py-2 text-sm font-bold ${
                active === image.id ? "tile-active" : revealed.includes(image.id) ? "border-brand-200 bg-white" : "border-sand-200 bg-sand-50"
              }`}
            >
              <span className="ml-1 text-base">{image.icon}</span>
              {image.caption}
            </button>
          ))}
        </div>
      </div>

      {activeCard ? (
        <Feedback tone="info">
          <strong>{activeCard.icon} {activeCard.caption}</strong> —{" "}
          {activeCard.id === "green"
            ? "هذه نعمة الله على عباده حين يُخرجون الزكاة فتزيد البركة."
            : activeCard.id === "dry"
              ? "هذه صورة الأرض عند نزع البركة، ويُخشى ذلك عند منع الزكاة."
              : "المطر رحمة من الله، ومنع الزكاة من أسباب انقطاعه."}
        </Feedback>
      ) : null}

      <ChoiceActivity
        id="warning"
        question={WARNING.question}
        options={WARNING.options}
        correctIndex={WARNING.correctIndex}
        feedback={WARNING.feedback}
        value={value ? { selected: value.selected, checked: value.checked } : undefined}
        onChange={(next) => onChange({ ...(value ?? { revealed }), selected: next.selected, checked: next.checked })}
        playSound={playSound}
      />
    </div>
  );
}

/* -------------------------- ٧) ادّخار المال -------------------------- */

export type SavingValue = { methods: string[] };
export function SavingActivity({
  value,
  onChange,
  playSound,
}: {
  value: SavingValue | undefined;
  onChange: (next: SavingValue) => void;
  playSound: (key: string) => void;
}) {
  const rawMethods = Array.isArray(value?.methods) ? value!.methods : [];
  const methods = [rawMethods[0] ?? "", rawMethods[1] ?? "", rawMethods[2] ?? ""];
  const filled = methods.filter((method) => method.trim().length > 3).length;

  const setMethod = (index: number, text: string) => {
    const next = [...methods];
    next[index] = text;
    onChange({ methods: next });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[1.5rem] border-2 border-brand-200 bg-brand-50 p-4">
        <p className="text-lg font-extrabold text-brand-900">📘 {SAVING.definition}</p>
      </div>

      <div className="act-card">
        <span className="act-title">🤝 نعمل مع مجموعتي</span>
        <p className="mb-3 mt-2 text-base font-extrabold leading-8 text-brand-900">{SAVING.prompt}</p>
        <div className="space-y-2">
          {[0, 1, 2].map((index) => (
            <div key={`method-${index}`} className="flex items-center gap-2">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-100 text-base font-extrabold text-brand-700">
                {toArabicDigits(index + 1)}
              </span>
              <input
                className="field"
                placeholder={`الطريقة ${toArabicDigits(index + 1)}…`}
                maxLength={120}
                value={methods[index]}
                onChange={(event) => setMethod(index, event.target.value)}
              />
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-brand-600">أفكار تساعدك:</span>
          {SAVING.suggestions.slice(0, 3).map((idea) => (
            <button
              key={idea}
              type="button"
              className="rounded-full border-2 border-brand-200 bg-brand-50 px-3 py-1 text-sm font-extrabold text-brand-700"
              onClick={() => {
                const emptyIndex = methods.findIndex((method) => method.trim().length === 0);
                if (emptyIndex >= 0) setMethod(emptyIndex, idea);
              }}
            >
              + {idea}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" className="kid-btn !px-5 !py-2 !text-sm" onClick={() => { onChange({ methods }); playSound("correct"); }}>
            💾 حفظ إجابتي
          </button>
          {filled >= 3 ? <Feedback tone="success">أحسنت! كتبت ثلاث طرق للادّخار، وستبقى محفوظة في سجلك.</Feedback> : null}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- ٨) التقويم ---------------------------- */

export type EvaluationValue = { answers: Record<string, string>; revealed: string[]; rating: string };
export function EvaluationActivity({
  value,
  onChange,
  playSound,
}: {
  value: EvaluationValue | undefined;
  onChange: (next: EvaluationValue) => void;
  playSound: (key: string) => void;
}) {
  const answers = value?.answers ?? {};
  const revealed = value?.revealed ?? [];
  const ratings = ["أحتاج مراجعة", "جيد", "جيد جدًا", "ممتاز"];

  return (
    <div className="space-y-4">
      <Feedback tone="info">
        ✍️ أجب عن أسئلة التقويم من صفحة ٢٢، ثم اضغط «الإجابة النموذجية» لتقارن إجابتك وتقيّم نفسك.
      </Feedback>
      {EVALUATION.map((question, index) => {
        const isRevealed = revealed.includes(question.id);
        const answer = answers[question.id] ?? "";
        return (
          <div key={question.id} className="act-card">
            <p className="mb-2 text-lg font-extrabold leading-7 text-brand-900">
              <span className="ml-1 inline-grid h-6 w-6 place-items-center rounded-full bg-gold-100 text-base text-gold-800">
                {toArabicDigits(index + 1)}
              </span>
              {question.question}
            </p>
            <textarea
              className="field min-h-24"
              placeholder="اكتب إجابتك هنا…"
              maxLength={400}
              value={answer}
              onChange={(event) => onChange({ answers: { ...answers, [question.id]: event.target.value }, revealed, rating: value?.rating ?? "" })}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="kid-btn kid-btn-plain !px-4 !py-2 !text-sm"
                onClick={() => {
                  playSound(isRevealed ? "tap" : "correct");
                  onChange({
                    answers,
                    revealed: isRevealed ? revealed.filter((id) => id !== question.id) : [...revealed, question.id],
                    rating: value?.rating ?? "",
                  });
                }}
              >
                {isRevealed ? "إخفاء الإجابة النموذجية" : "👁️ الإجابة النموذجية"}
              </button>
              {answer.trim().length > 5 ? <span className="rounded-full border-2 border-brand-200 bg-brand-50 px-3 py-1 text-sm font-extrabold text-brand-700">تمت الإجابة ✓</span> : <span className="rounded-full bg-sand-100 px-3 py-1 text-sm font-extrabold text-brand-500">لم تُجب بعد</span>}
            </div>
            {isRevealed ? (
              <div className="mt-2">
                <Feedback tone="success">
                  <strong>الإجابة النموذجية: </strong>
                  {question.modelAnswer}
                </Feedback>
              </div>
            ) : null}
          </div>
        );
      })}

      <div className="rounded-2xl border border-brand-100 bg-brand-50/60 p-4">
        <p className="mb-2 text-base font-extrabold text-brand-800">قيّم إجابتك بنفسك:</p>
        <div className="flex flex-wrap gap-2">
          {ratings.map((rating) => (
            <button
              key={rating}
              type="button"
              onClick={() => {
                playSound("tap");
                onChange({ answers, revealed, rating });
              }}
              className={`rounded-2xl border px-3 py-1.5 text-sm font-extrabold transition ${
                value?.rating === rating ? "border-brand-500 bg-brand-700 text-white" : "border-sand-300 bg-white text-brand-700"
              }`}
            >
              {rating}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* --------------------------- ٩) الاختبار --------------------------- */

export type QuizValue = { answers: Record<string, number>; submitted: boolean };
export function QuizActivity({
  value,
  onChange,
  playSound,
  onScore,
}: {
  value: QuizValue | undefined;
  onChange: (next: QuizValue) => void;
  playSound: (key: string) => void;
  onScore: (score: number, total: number) => void;
}) {
  const answers = value?.answers ?? {};
  const submitted = Boolean(value?.submitted);
  const score = QUIZ.filter((question) => answers[question.id] === question.answer).length;
  const answeredCount = QUIZ.filter((question) => typeof answers[question.id] === "number").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-brand-100 bg-brand-50/60 px-4 py-3">
        <p className="text-base font-extrabold text-grape-700">📝 سبعة أسئلة — اختر الإجابة الصحيحة</p>
        <span className="rounded-full border-2 border-brand-200 bg-brand-50 px-3 py-1 text-sm font-extrabold text-brand-700">{toArabicDigits(answeredCount)} / {toArabicDigits(QUIZ.length)}</span>
      </div>
      {QUIZ.map((question, index) => (
        <div key={question.id} className="act-card">
          <p className="mb-3 text-lg font-extrabold leading-7 text-brand-900">
            {toArabicDigits(index + 1)}. {question.question}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {question.options.map((option, optionIndex) => {
              const isActive = answers[question.id] === optionIndex;
              const cls = submitted
                ? optionIndex === question.answer
                  ? "tile-correct"
                  : isActive
                    ? "tile-wrong"
                    : "opacity-70"
                : isActive
                  ? "tile-active"
                  : "";
              return (
                <button
                  key={option}
                  type="button"
                  disabled={submitted}
                  onClick={() => {
                    playSound("select");
                    onChange({ answers: { ...answers, [question.id]: optionIndex }, submitted: false });
                  }}
                  className={`opt-tile ${cls}`}
                >
                  {option}
                </button>
              );
            })}
          </div>
          {submitted ? (
            <p className={`mt-2 text-base font-bold ${answers[question.id] === question.answer ? "text-[#067647]" : "text-[#b42318]"}`}>
              {answers[question.id] === question.answer ? "✓ إجابة صحيحة. " : `✗ الإجابة الصحيحة: ${question.options[question.answer]} — `}
              {question.explain}
            </p>
          ) : null}
        </div>
      ))}

      {!submitted ? (
        <button
          type="button"
          className="kid-btn kid-btn-grape w-full !py-4 !text-lg"
          disabled={answeredCount < QUIZ.length}
          onClick={() => {
            onChange({ answers, submitted: true });
            onScore(score, QUIZ.length);
            playSound(score >= Math.ceil(QUIZ.length / 2) ? "celebrate" : "wrong");
          }}
        >
          🎯 إظهار النتيجة وحفظها للمعلم
        </button>
      ) : (
        <div className="rounded-[1.75rem] border border-gold-200 bg-gold-50 p-5 text-center">
          <p className="text-lg font-extrabold text-gold-800">درجتك في الاختبار التفاعلي</p>
          <p className="font-display my-1 text-4xl text-brand-900">
            {toArabicDigits(score)} / {toArabicDigits(QUIZ.length)}
          </p>
          <p className="text-base font-bold text-brand-700">
            {score === QUIZ.length
              ? "مبدع! أجبت عن كل الأسئلة بشكل صحيح 🏆"
              : score >= 5
                ? "نتيجة جيدة جدًا، راجع الأخطاء لتتقن أكثر 💪"
                : "لا بأس، أعد قراءة الشرائح ثم حاول مرة أخرى 🌱"}
          </p>
          <button
            type="button"
            className="kid-btn kid-btn-plain mt-3 !px-4 !py-2 !text-sm"
            onClick={() => {
              onChange({ answers: {}, submitted: false });
              onScore(0, QUIZ.length);
            }}
          >
            ↺ إعادة الاختبار
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------ ١٠) التأمل والختام ------------------------ */

export type ReflectionValue = { learned: string; action: string; rating: string };
export function ReflectionActivity({
  value,
  onChange,
}: {
  value: ReflectionValue | undefined;
  onChange: (next: ReflectionValue) => void;
}) {
  const ratings = ["🌟", "🌟🌟", "🌟🌟🌟", "🌟🌟🌟🌟"];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border border-brand-100 bg-brand-50/60 p-4">
        <label className="label" htmlFor="learned">ماذا تعلمت في هذا الدرس؟</label>
        <textarea
          id="learned"
          className="field min-h-24"
          placeholder="تعلمت أن الزكاة…"
          maxLength={300}
          value={value?.learned ?? ""}
          onChange={(event) => onChange({ ...(value ?? { action: "", rating: "" }), learned: event.target.value })}
        />
      </div>
      <div className="rounded-2xl border border-gold-200 bg-gold-50/60 p-4">
        <label className="label" htmlFor="action">ماذا سأفعل لأُخرج زكاة مالي في المستقبل؟</label>
        <textarea
          id="action"
          className="field min-h-24"
          placeholder="سأدّخر من مصروفي، وعند حولان الحول سأُخرج الزكاة…"
          maxLength={300}
          value={value?.action ?? ""}
          onChange={(event) => onChange({ ...(value ?? { learned: "", rating: "" }), action: event.target.value })}
        />
        <p className="label mt-3">قيّم فهمك للدرس:</p>
        <div className="flex flex-wrap gap-1">
          {ratings.map((stars) => (
            <button
              key={stars}
              type="button"
              onClick={() => onChange({ ...(value ?? { learned: "", action: "" }), rating: stars })}
              className={`rounded-2xl border px-2 py-1 text-lg transition ${
                value?.rating === stars ? "border-gold-400 bg-white shadow" : "border-transparent hover:bg-white/60"
              }`}
            >
              {stars}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
