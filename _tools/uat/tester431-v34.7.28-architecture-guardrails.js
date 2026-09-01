#!/usr/bin/env node
'use strict';
/* v34.7.28 — پیشگیری معماری:
     G1 قرارداد هویت رکورد (PTF.id / PTF.aliases / PTF.sameEntity / PTF.findById)
     G2 نگهبان معماری (_tools/arch/arch-guard.js) با مبنای ثبت‌شده و اتصال به گیت CI
     G3 اعمال قرارداد در نقاطی که ترتیب شناسه ناسازگار بود
   مرجع: ARCHITECTURE-GUARDRAILS.md */
var fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

/* ---------- G1: رفتار قرارداد هویت ---------- */
(function identityContract() {
  var sb = { console: console, JSON: JSON, Math: Math, Date: Date, window: null, getData: function () { return []; } };
  sb.window = sb; sb.globalThis = sb;
  vm.createContext(sb);
  vm.runInContext(read('crm/finance-helpers.js'), sb, { filename: 'crm/finance-helpers.js' });
  var PTF = sb.PTF;
  T('G1 چهار تابع قرارداد هویت در دسترس‌اند',
    PTF && ['id', 'aliases', 'sameEntity', 'findById'].every(function (k) { return typeof PTF[k] === 'function'; }));

  var rec = { _id: 'X-UUID', cd: 'X-CD' };
  T('G1 شناسهٔ متعارف = _id || cd', PTF.id(rec) === 'X-UUID' && PTF.id({ cd: 'ONLY-CD' }) === 'ONLY-CD' && PTF.id(null) === '');
  T('G1 نام‌های مستعار هر دو شناسه را می‌دهد', PTF.aliases(rec).join(',') === 'X-UUID,X-CD');
  T('G1 sameEntity با هر دو شناسه صادق است', PTF.sameEntity(rec, 'X-CD') && PTF.sameEntity(rec, 'X-UUID') && PTF.sameEntity(rec, rec));
  T('G1 sameEntity با شناسهٔ تهی هرگز صادق نیست',
    !PTF.sameEntity(rec, '') && !PTF.sameEntity({}, {}) && !PTF.sameEntity(null, null) && !PTF.sameEntity({ cd: '' }, { _id: '' }));
  T('G1 sameEntity رکوردهای متفاوت را یکی نمی‌کند', !PTF.sameEntity(rec, { _id: 'Y', cd: 'Z' }));

  var list = [{ _id: 'A1', cd: 'AC' }, { _id: 'B1', cd: 'BC' }];
  T('G1 findById با _id و با cd هر دو کار می‌کند',
    PTF.findById(list, 'B1') === list[1] && PTF.findById(list, 'AC') === list[0]);
  T('G1 findById با شناسهٔ تهی/ناموجود null می‌دهد',
    PTF.findById(list, '') === null && PTF.findById(list, null) === null && PTF.findById(list, 'NOPE') === null);
  T('G1 در دادهٔ دوگانه، _id اولویت دارد',
    PTF.findById([{ cd: 'K' }, { _id: 'K', cd: 'other' }], 'K').cd === 'other');
})();

/* ---------- G2: نگهبان معماری ---------- */
(function archGuard() {
  var guard = path.join(ROOT, '_tools/arch/arch-guard.js');
  var baseline = path.join(ROOT, '_tools/arch/arch-baseline.json');
  T('G2 اسکریپت نگهبان و فایل مبنا موجودند', fs.existsSync(guard) && fs.existsSync(baseline));
  var base = JSON.parse(fs.readFileSync(baseline, 'utf8'));
  T('G2 مبنا هر هفت قاعده را پوشش می‌دهد',
    ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7'].every(function (k) { return Array.isArray(base.rules[k]); }), Object.keys(base.rules || {}).join(','));
  T('G2 قواعد بی‌تخلف (دکمهٔ مرده/انکدینگ/نسخه) در مبنا صفرند',
    base.rules.A4.length === 0 && base.rules.A5.length === 0 && base.rules.A6.length === 0);

  var run = cp.spawnSync(process.execPath, [guard, '--quiet'], { encoding: 'utf8' });
  T('G2 نگهبان روی وضعیت فعلی مخزن PASS می‌دهد', run.status === 0, (run.stdout || '').split('\n').slice(-4).join(' | '));

  /* شبیه‌سازی تخلف: یک بازگشت خاموش با ترتیب شناسهٔ اشتباه در فایل موقت خارج از crm
     قابل تست نیست (نگهبان کل پوشه را می‌خواند)، بنابراین صحت تشخیص از روی مبنا سنجیده می‌شود:
     همان امضایی که باگ v34.7.26 را ساخت نباید در مبنا باشد. */
  T('G2 امضای باگ ابطال (salesfiles با cd-اول) در مبنا نیست — یعنی بازگشتش گیت را می‌شکند',
    base.rules.A2.every(function (s) { return s.indexOf('salesfiles.js') < 0; }), base.rules.A2.join(','));
  T('G2 ptfInvoiceVoid دیگر تعریف هم‌نام ندارد (A1 پاک است از این نام)',
    base.rules.A1.every(function (s) { return s.indexOf('ptfInvoiceVoid') < 0; }), base.rules.A1.join(','));

  var gate = read('_tools/uat/run-ci-gate.js');
  T('G2 نگهبان داخل رانر گیت صدا زده می‌شود', gate.indexOf('arch-guard.js') > -1 && gate.indexOf("failed.push('arch-guard')") > -1);
  /* v34.29.0 (یافتهٔ F-1 ممیزی ۲۰۲۶-۰۸-۲۸): پاسِ بالا به‌تنهایی گمراه‌کننده بود — فقط
     بررسی می‌کرد run-ci-gate.js به arch-guard.js «ارجاع» دارد، در حالی که هیچ workflow
     گیت‌هابی این گیت را اجرا نمی‌کرد. از این پس «اجرا در CI» هم سنجیده می‌شود: یا
     workflowها واقعاً گیت را صدا می‌زنند، یا وصلهٔ معلقی در صف است که این کار را می‌کند
     (نوشتن روی .github/workflows نیازمند دسترسی workflow است که اپلیکیشن گیت‌هابِ نشست
     ندارد — رَویهٔ PENDING-*.patch در این مخزن). قرارداد کامل: tester536. */
  var wfStaging = read('.github/workflows/deploy-staging.yml');
  var wfProd = read('.github/workflows/deploy-production.yml');
  var wired =
    wfStaging.indexOf('node _tools/arch/arch-guard.js') > -1 &&
    wfProd.indexOf('node _tools/arch/arch-guard.js') > -1 &&
    wfStaging.indexOf('node _tools/uat/run-ci-gate.js') > -1 &&
    wfProd.indexOf('node _tools/uat/run-ci-gate.js') > -1;
  var pendingPatch = fs.readdirSync(path.join(ROOT, '_tools')).filter(function (n) {
    return /^PENDING-workflow-t0-gates-.*\.patch$/.test(n);
  }).sort().pop();
  var queued = !!pendingPatch &&
    read('_tools/' + pendingPatch).indexOf('arch-guard.js') > -1 &&
    read('_tools/' + pendingPatch).indexOf('run-ci-gate.js') > -1;
  T('G2 نگهبان در CI اجرا می‌شود (وصل در workflow، یا در وصلهٔ معلقِ در صف)',
    wired || queued, wired ? 'wired' : 'queued=' + (pendingPatch || 'none'));
})();

/* ---------- G3: اعمال قرارداد در کد ---------- */
(function adoption() {
  var un = read('crm/unofficial-invoice.js'), fh = read('crm/finance-helpers.js');
  T('G3 قرارداد هویت در finance-helpers مستند و expose شده',
    fh.indexOf('window.PTF.sameEntity') > -1 && fh.indexOf('قرارداد هویت رکورد') > -1);
  T('G3 ctx.dealCd با شناسهٔ متعارف ساخته می‌شود', /dealCd:[\s\S]{0,160}PTF\.id\(/.test(un));
  T('G3 تطبیق پرونده در مسیر غیررسمی با sameEntity انجام می‌شود',
    (un.match(/PTF\.sameEntity\(/g) || []).length >= 2, (un.match(/PTF\.sameEntity\(/g) || []).length);
  T('G3 سند راهنمای معماری موجود است', fs.existsSync(path.join(ROOT, 'ARCHITECTURE-GUARDRAILS.md')));
})();

console.log('\n— tester431 (پیشگیری معماری: قرارداد هویت + نگهبان) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
