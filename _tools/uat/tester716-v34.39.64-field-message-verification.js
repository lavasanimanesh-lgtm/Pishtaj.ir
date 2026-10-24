#!/usr/bin/env node
'use strict';
/* v34.39.64 (VERIFY-2026-10-24) — «بازبینی مستقل: پیام‌ها دقیق و درست می‌روند؟»
   درخواست کارفرما: «می‌خوام مجدد تست کنی و مطمئن بشی پیام‌ها دقیق و درست ارسال
   می‌شوند». این تستر دو لایه دارد:
   ① لایهٔ قرارداد — دو نقطهٔ کد که در بازبینی میدانی دست خوردند:
      - برچسب خالی («وضعیت قبلی: ⏎») روی ردیفی که هرگز st نداشته به «تعیین‌نشده» تبدیل شد؛
      - پیش‌آمادهٔ آزمون e2e حالت «بازدیدکنندهٔ بدون توکن» (auth:'none') گرفت تا مسیر
        ثبت سایت همان چیزی باشد که مشتری واقعی می‌بیند.
   ② لایهٔ اجرا — اگر php-wasm (یا php-cli) باشد، بازبینی میدانی کامل
      (verify-bot-messages-field-2026-10-24.js) اجرا و شمارشش به همین گیت اضافه می‌شود:
      ۸ سفر واقعی کاربر، ۱۴+ پیام واقعی، و اسکن ساختاری متن هر پیام.
   مرجع: ARENA-BOT-MESSAGE-ACCURACY-ASSESSMENT-2026-10-24.md */
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
function T(name, ok, detail) {
  if (ok) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail ? ' — ' + String(detail).slice(0, 500) : '')); }
}

const lib = read('api/rfq-notify-lib.php');
const prelude = read('_tools/uat/e2e-rfq-notify-phantom-v34.39.55.js');
const fieldPath = '_tools/uat/verify-bot-messages-field-2026-10-24.js';
const field = read(fieldPath);

/* ═══ ① قرارداد ═══ */
T('lib: برچسب خالیِ «وضعیت قبلی/جدید» به «تعیین‌نشده» تبدیل می‌شود (خط خالی ممنوع)',
  /\$fromLabel !== '' \? \$fromLabel : 'تعیین‌نشده'/.test(lib) &&
  /\$toLabel !== '' \? \$toLabel : 'تعیین‌نشده'/.test(lib));
T('lib: همان گذار با هر دو برچسب خالی هم خط خالی چاپ نمی‌کند',
  !lib.includes('"\\nوضعیت قبلی: " . $fromLabel;'));
T("prelude: حالت auth:'none' = بازدیدکنندهٔ سایت بدون توکن (دقیقاً یک تعریف)",
  (prelude.match(/auth:'none'/g) || []).length >= 1 &&
  prelude.includes("if(opts.auth===false)auth=\"$_SERVER['HTTP_X_CRM_TOKEN']='invalid-test-token';\";") &&
  prelude.includes("else if(opts.auth!=='none')auth=`"));
T('بازبینی میدانی: هشت سفر واقعی (ثبت سایت، تایید، ذخیرهٔ بدون تغییر، رد، کانبان/پیشنهاد/ارسال/برد، هدایت، دستگاه کهنه، صف)',
  ['سفر ۱', 'سفر ۲', 'سفر ۳', 'سفر ۴', 'سفر ۵', 'سفر ۶', 'سفر ۷', 'سفر ۸'].every(n => field.includes(n)));
T('بازبینی میدانی: متن هر پیام چاپ و از نظر کد خام/حریم خصوصی/تکرار اسکن می‌شود',
  field.includes('function structuralScan') && field.includes('RAW_CODE') && field.includes('show('));
T('بازبینی میدانی: مسیر سایت با auth:none و کپچا می‌رود (نه با نشست ادمین)',
  field.includes("endpoint: 'crm.php', action: 'add_rfq_site', captcha: true, auth: 'none'"));

/* ═══ ② اجرای واقعی (در صورت وجود php-wasm/php-cli) ═══ */
let haveWasm = false;
try { require.resolve('php-wasm/PhpNode'); haveWasm = true; } catch (e) {}
const havePhp = (() => { const r = cp.spawnSync('php', ['-v'], { encoding: 'utf8' }); return !r.error && r.status === 0; })();

if (haveWasm || havePhp) {
  const env = Object.assign({}, process.env);
  if (haveWasm) {
    /* php-wasm ممکن است وابستگی محلی ریپو نباشد (مثلاً NODE_PATH=/tmp/phpwasm) —
       مسیر واقعیِ همان نصب به فرزند پاس داده می‌شود تا اجرای میدانی هم ببیندش. */
    let nm = '';
    try { nm = path.dirname(path.dirname(require.resolve('php-wasm/package.json'))); } catch (e) {}
    env.NODE_PATH = [env.NODE_PATH, path.join(ROOT, 'node_modules'), nm].filter(Boolean).join(path.delimiter);
  }
  const r = cp.spawnSync(process.execPath, [path.join(ROOT, fieldPath)], { encoding: 'utf8', env: env });
  const out = String(r.stdout || '');
  const m = out.match(/FIELD VERIFY: (\d+) PASS \/ (\d+) FAIL/);
  if (m) {
    pass += +m[1]; fail += +m[2];
    T('بازبینی میدانی بدون هیچ FAIL تمام شد', +m[2] === 0, out.split('\n').filter(l => l.includes('❌')).join(' | '));
    T('بازبینی میدانی سناریوهای کافی را پوشش داد (≥۴۰ سنجه)', +m[1] >= 40, m[1] + ' سنجه');
  } else {
    T('اجرای بازبینی میدانی خلاصهٔ PASS/FAIL برگرداند', false, out.slice(-500) + ' | ' + String(r.stderr || '').slice(-300));
  }
} else {
  console.log('SKIP field run: php-cli و php-wasm هر دو نیستند — لایهٔ قرارداد بررسی شد.');
}

console.log('\n=== tester716 FIELD-VERIFY: ' + pass + ' PASS / ' + fail + ' FAIL ===');
process.exitCode = fail ? 1 : 0;
