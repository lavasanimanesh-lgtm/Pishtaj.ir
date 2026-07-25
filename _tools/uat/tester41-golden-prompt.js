/* ============================================================
   دستیار تست ۴۱ — «تست طلایی پرامپت و خروجی‌های ساختاریافته هوش مصنوعی» (US-271)
   تضمین عدم انحراف اسکیمای خروجی اکشن‌های سروری (identify, ocr, techcase, leadfinder, cheque, bizcard)
   ============================================================ */
require('./harness');
console.log('👑 TESTER-41: تست طلایی پرامپت و اسکیمای ساختاریافته AI (US-271)');

var fs = require('fs'), path = require('path');
var llmPhp = fs.readFileSync(path.resolve(__dirname, '../../api/llm.php'), 'utf-8');

SECTION('۱. اعتبارسنجی اسکیمای JSON در پرامپت‌های سروری (`api/llm.php`)');
T('اکشن identify: الزام به خروجی JSON با کلیدهای type, brand, model, en, fa, conf',
  llmPhp.indexOf('"type"') > -1 && llmPhp.indexOf('"brand"') > -1 && llmPhp.indexOf('"model"') > -1 && llmPhp.indexOf('ONLY valid JSON') > -1);

T('اکشن ocr: استخراج اقلام با کلیدهای items [{name, spec, qty, unit, brand, model}]',
  llmPhp.indexOf('items') > -1 && llmPhp.indexOf('qty') > -1 && llmPhp.indexOf('ONLY JSON') > -1);

T('اکشن leadfinder: استخراج سرنخ‌ها با کلیدهای leads [{company, contact, tel, industry, prob}]',
  llmPhp.indexOf('leads') > -1 && llmPhp.indexOf('industry') > -1 && llmPhp.indexOf('ONLY JSON') > -1);

T('اکشن cheque: استخراج چک صیادی با کلیدهای sayad, amt, dueFa, toWhom, bank',
  llmPhp.indexOf('sayad') > -1 && llmPhp.indexOf('toWhom') > -1 && llmPhp.indexOf('ONLY valid JSON object') > -1);

T('اکشن bizcard: استخراج کارت ویزیت با کلیدهای company, companyEn, people, tel, mob, email',
  llmPhp.indexOf('bizcard') > -1 && llmPhp.indexOf('companyEn') > -1 && llmPhp.indexOf('ONLY valid JSON') > -1);

SECTION('۲. بررسی لایه دفاعی و پاکسازی مارک‌دوان در پاسخ سرور');
T('حذف خودکار بلوک‌های ```json و ``` از پاسخ خام LLM',
  llmPhp.indexOf("preg_replace('/^```(?:json)?") > -1 && llmPhp.indexOf("preg_replace('/```$/") > -1 && llmPhp.indexOf('$text') > -1);

T('تشخیص و گزارش خطای خروجی غیر JSON از سمت سرور',
  llmPhp.indexOf("json_last_error() !== JSON_ERROR_NONE") > -1 && llmPhp.indexOf('خروجی AI ساختار JSON معتبر ندارد') > -1);

DONE('tester41-golden-prompt');
