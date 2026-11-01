# دليل النشر على Vercel مع قاعدة بيانات Neon

هذا الدليل يحل ثلاث مشكلات شائعة بعد النشر:
1. عدم القدرة على الدخول إلى لوحة المعلم.
2. عدم ظهور الصور.
3. عدم ربط البيانات بقاعدة Neon.

---

## ١) ربط Neon (قاعدة البيانات)

1. أنشئ مشروعًا في [Neon](https://console.neon.tech) واختر أقرب منطقة (مثلاً Frankfurt).
2. من لوحة المشروع اضغط **Connect** واختر:
   - **Connection pooling: Pooled connection** (مهم لدوال Vercel Serverless).
   - **Connection string** كاملًا، وأضف في نهايته: `?sslmode=require`.
3. انسخ الرابط بالشكل:
   ```
   postgresql://USER:PASSWORD@ep-xxxx-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```

### أضف المتغيّر في Vercel
1. Vercel → مشروعك → **Settings → Environment Variables**.
2. أضف:

   | الاسم | القيمة | البيئات |
   | --- | --- | --- |
   | `DATABASE_URL` | رابط Neon المجمّع مع `?sslmode=require` | Production + Preview + Development |
   | `TEACHER_PASSCODE` | `139613` (اختياري — الرمز الأساسي مضمّن في الكود) | Production + Preview |

   > يدعم الكود أيضًا أسماء بديلة: `POSTGRES_URL` أو `NEON_DATABASE_URL` (وهي الأسماء التي ينشئها تكامل Neon تلقائيًا).

3. اضغط **Save** ثم **Redeploy** (إعادة النشر ضرورية لكي تُقرأ المتغيّرات).

### إنشاء الجداول (مرة واحدة)
اختر إحدى الطريقتين:

- **من المتصفح (الأسهل):** افتح `/teacher` ← أدخل رمز المعلم ← تبويب **«واجهة API والتشخيص»** ← زر **«🛠️ تهيئة جداول Neon»**. تُنشأ الجداول الثلاثة تلقائيًا (`lesson_progress`، `teacher_names`، `lesson_sounds`).
- **من الطرفية:**
  ```bash
  DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require" npx drizzle-kit push --config drizzle.config.json
  ```

### التحقق
افتح `https://<your-app>.vercel.app/api/health` وستحصل على:
```json
{
  "ok": true,
  "database": { "configured": true, "connected": true, "envKey": "DATABASE_URL", "host": "ep-xxxx-pooler...", "ssl": true, "latencyMs": 12 }
}
```
إذا ظهر `configured: false` فالمتغيّر غير مضاف أو لم تُعد النشر. وإذا ظهر `connected: false` فاقرأ `database.error.hint` وسيخبرك بالسبب والحل.

---

## ٢) الدخول إلى لوحة المعلم

- **الرمز الأساسي: `139613`** (مضمّن في الكود ويعمل دائمًا، ولا يُعرض في الواجهة).
- لتغييره أضف `TEACHER_PASSCODE` في Vercel.
- الدخول الآن **لا يعتمد على قاعدة البيانات**: إذا كانت قاعدة البيانات غير مربوطة ستظهر لوحة المعلم مع تنبيه واضح، ويمكنك تهيئة الجداول من الزر مباشرة.

### إن تعذّر الدخول
| العَرَض | السبب | الحل |
| --- | --- | --- |
| «رمز الدخول غير صحيح» | رمز مختلف عن `139613` والمتغيّر `TEACHER_PASSCODE` مضاف بقيمة أخرى | استخدم القيمة في المتغيّر أو احذفه |
| «تعذّر التحقق من الخادم» | فشل الشبكة/النشر | تحقق من Deployments في Vercel |
| صفحة 404 على `/teacher` | النشر لم يكتمل أو المسار خطأ | أعد النشر وتأكد من الرابط |

---

## ٣) الصور

الصور موجودة في `public/images`:
```
public/images/zakat-hero.webp
public/images/zakat-warning.webp
```
- تُخدم مباشرة كملفات ثابتة (`/images/zakat-hero.webp`) بدون معالج صور، وقد عُطّل تحسين الصور في `next.config.ts` لضمان العمل على كل الاستضافات.
- **تأكد أن مجلد `public/` مرفوع في المستودع** (ملف `.gitignore` في المشروع لا يستثنيه).
- لتفعيل التخزين المؤقت الطويل أُضيفت ترويسة `Cache-Control` للمجلد في `vercel.json`.

اختبار سريع بعد النشر:
```
https://<your-app>.vercel.app/images/zakat-hero.webp
```
إذا ظهرت الصورة فالربط سليم.

---

## ٤) متغيرات البيئة المطلوبة (ملخص)

| المتغيّر | إلزامي | الوصف |
| --- | --- | --- |
| `DATABASE_URL` (أو `POSTGRES_URL`) | نعم | رابط Neon المجمّع + `?sslmode=require` |
| `TEACHER_PASSCODE` | لا | إضافي إلى الرمز `139613` |
| `PGPOOL_MAX` | لا | أقصى اتصالات في الدالة (الافتراضي 3) |

انظر `.env.example` للنسخة المحلية.

---

## ٥) نقاط مهمة لدوال Vercel

- جميع مسارات `/api/*` تعمل على `runtime = "nodejs"` ومتوافقة مع Serverless.
- حجم أقصى للملف الصوتي المرفوع: **4MB** (قيود Vercel)، وهو مُطبَّق في `/api/sounds`.
- لا تستخدم `localhost` في `DATABASE_URL` على Vercel؛ استخدم مضيف Neon.
- إذا كان مشروع Neon في حالة Idle فسيستغرق أول استعلام ثانية إضافية (طبيعي).
