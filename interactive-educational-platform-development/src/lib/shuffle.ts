/**
 * خلط الإجابات بشكل ثابت لكل سؤال/طالب حتى لا يكون الخيار الصحيح دائمًا في الموضع الأول.
 * الخلط ثابت (deterministic) حسب مفتاح ثابت، فلا تتغيّر الخيارات عند كل إعادة رسم.
 */

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** ترتيب عشوائي ثابت للمؤشرات 0..length-1 */
export function shuffledIndexes(length: number, seed: string): number[] {
  const random = mulberry32(hashSeed(seed));
  const indexes = Array.from({ length }, (_, index) => index);
  for (let index = indexes.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [indexes[index], indexes[swap]] = [indexes[swap], indexes[index]];
  }
  return indexes;
}

export type ShuffledOptions = {
  /** الخيارات بعد الخلط */
  options: string[];
  /** موضع الإجابة الصحيحة بعد الخلط */
  correctIndex: number;
};

/**
 * يخلط قائمة خيارات مع الحفاظ على معرفة موضع الإجابة الصحيحة.
 * `seed` ثابت لكل سؤال + معرف الطالب لإعطاء ترتيب مختلف بين الطلاب.
 */
export function shuffleOptions(options: string[], correctIndex: number, seed: string): ShuffledOptions {
  const order = shuffledIndexes(options.length, seed);
  const shuffled = order.map((index) => options[index]);
  const newCorrect = order.indexOf(correctIndex);
  return { options: shuffled, correctIndex: newCorrect < 0 ? 0 : newCorrect };
}

/** خلط عناصر أي مصفوفة (يُستخدم لبطاقات التصنيف) */
export function shuffleItems<T>(items: readonly T[], seed: string): T[] {
  const order = shuffledIndexes(items.length, seed);
  return order.map((index) => items[index]);
}
