#!/usr/bin/env node
'use strict';
/* tester649 — v34.38.20 (KC-STRUCTURE-HYGIENE): قفلِ پاک‌سازیِ ساختار مرکز دانش.
   ممیزیِ ۴۶۳ مقالهٔ مرکز دانش نشان داد ۵۹ مقالهٔ ایندکس‌پذیر «الگویی» بودند (مقدمهٔ قالبی +
   بخش‌های بایت‌به‌بایت تکراری: انواع و دسته‌بندی / نکات فنی و استانداردها / نتیجه‌گیری /
   راهنمای انتخاب تامین‌کننده / اهمیت مستندات فنی / اهمیت دانش فنی). اصلاح در سه دسته:
   ۱) ۶ صفحهٔ ترکیبی (الگو + محتوای واقعی) → حذفِ بخش‌های الگویی، حفظِ محتوای واقعی
   ۲) ۲۵ صفحهٔ کاملاً الگوییِ بدونِ خواهرِ غنی → بازنویسی با محتوای تخصصیِ یکتا
   ۳) ۲۸ صفحهٔ دیگر (که خواهرِ غنی داشتند) → بازنویسی با محتوای مستقلِ متمایز (نه تجمیع)
   این تستر قفل می‌کند: (الف) هیچ مقالهٔ ایندکس‌پذیرِ KC بخشِ الگویی نداشته باشد،
   (ب) هر ۵۹ صفحهٔ بازنویسی/پاکسازی‌شده ایندکس‌پذیر، canonical خود، بدونِ بخشِ الگویی،
   ≥۵۰۰ واژه و در سایت‌مپ باشند. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var KC = path.join(ROOT, 'knowledge-center');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function norm(s) { return String(s).replace(/\u200c/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }

/* ── ۸ امضای بخشِ الگویی (بدون نیم‌فاصله) ── */
var TPL = [
  'مقدمه',
  'اهمیت موضوع در صنایع نفت، گاز و پتروشیمی',
  'انواع و دسته‌بندی',
  'نکات فنی و استانداردها',
  'نتیجه‌گیری',
  'اهمیت دانش فنی در تامین',
  'راهنمای انتخاب تامین‌کننده معتبر',
  'اهمیت مستندات فنی در تامین'
];
function hasTemplateH2(html) {
  var body = html.replace(/<head[\s\S]*?<\/head>/i, '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  body = body.replace(/<(footer|header|nav)[\s\S]*?<\/\1>/gi, '');
  var m, re = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  while ((m = re.exec(body))) {
    var t = norm(m[1]);
    for (var i = 0; i < TPL.length; i++) { if (t.indexOf(TPL[i]) === 0) return t; }
  }
  return null;
}
function isNoindex(html) { return /<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(html); }
function canonicalTarget(html) {
  var m = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
  return m ? m[1] : null;
}
function visibleWords(rel) {
  var text = read(rel)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ');
  return (text.match(/[\u0600-\u06FF\uFB8A\u067E\u0686\u06AF\u06A9\u06BE\u200c]+|[A-Za-z][A-Za-z\-]{1,}/g) || []).length;
}

/* ── (الف) سراسری: هیچ مقالهٔ ایندکس‌پذیرِ KC بخشِ الگویی نداشته باشد ── */
(function () {
  var bad = [];
  fs.readdirSync(KC).forEach(function (name) {
    if (!/\.html$/.test(name)) return;
    var html = fs.readFileSync(path.join(KC, name), 'utf8');
    if (isNoindex(html)) return;
    var t = hasTemplateH2(html);
    if (t) bad.push(name + ' (' + t + ')');
  });
  T('KC-GLOBAL: هیچ مقالهٔ ایندکس‌پذیر بخشِ الگویی ندارد', bad.length === 0, bad.join('؛ '));
})();

/* ── (ب) ۵۹ صفحهٔ بازنویسی/پاکسازی‌شده (۲۵ بازنویسی + ۶ پاکسازی + ۲۸ محتوای مستقل) ── */
var REWRITTEN = [
  /* ۲۵ صفحهٔ بازنویسی‌شده (بدونِ خواهرِ غنی) */
  'api-602-small-gate-valve.html', 'astm-a105-vs-a234.html', 'astm-piping-standards-guide.html',
  'atex-iecex-hazardous-area-guide.html', 'control-valve-complete-guide.html',
  'corrosion-resistant-equipment-guide.html', 'diaphragm-seal-guide.html',
  'electrical-brands-comparison.html', 'epc-supply-chain-management-guide.html',
  'hart-calibration-training.html', 'high-pressure-equipment-guide.html',
  'instrument-calibration-standards.html', 'ip-rating-industrial-equipment-guide.html',
  'nioc-npc-vendor-list-guide.html', 'pinch-valve-guide.html',
  'pressure-transmitter-calibration-guide.html', 'quality-assurance-supply-guide.html',
  'radar-level-transmitter-guide.html', 'rosemount-vs-yokogawa-comparison.html',
  'rtd-vs-thermocouple-comparison.html', 'scada-rtu-system-guide.html',
  'shutdown-turnaround-industrial-guide.html', 'soft-starter-guide.html',
  'thermowell-guide.html', 'valve-body-material-selection.html',
  /* ۶ صفحهٔ ترکیبیِ پاکسازی‌شده */
  'a53-pipe-specifications.html', 'flange-bolting-guide.html', 'flange-types-complete-guide.html',
  'hydrostatic-test-pipe-guide.html', 'nde-inspection-pipe-flange.html', 'stainless-steel-pipe-guide.html',
  /* ۲۸ صفحهٔ دارایِ خواهرِ غنی — حالا با محتوای مستقل */
  'asme-b31-3-process-piping-guide.html', 'cement-industry-supply-guide.html', 'contactor-bimetal-guide.html',
  'dpt.html', 'gas-analyzer-industry-guide.html', 'hydrostatic-level-transmitter.html',
  'incoterms-industrial-trade-guide.html', 'industrial-cable-selection-guide.html',
  'international-supply-contract-guide.html', 'petrochemical-industry-supply-guide.html',
  'plc-types-industrial-guide.html', 'plug-valve-guide.html', 'pmi-testing-guide.html',
  'power-distribution-transformer-guide.html', 'power-plant-industry-supply-guide.html',
  'pressure-gauge-complete-guide.html', 'protective-relay-guide.html', 'safety-relief-valve-guide.html',
  'sil-certification-instrument-guide.html', 'sour-service-equipment-guide.html',
  'steam-system-equipment-guide.html', 'steel-industry-supply-guide.html',
  'valve-actuator-types-guide.html', 'valve-brands-comparison-guide.html', 'valve-sealing-guide.html',
  'valve-seat-material-guide.html', 'valve-testing-guide.html', 'vfd-variable-frequency-drive-guide.html'
];
var sitemap = read('sitemap-knowledge-center.xml');
REWRITTEN.forEach(function (rel) {
  var html = read('knowledge-center/' + rel);
  var w = visibleWords('knowledge-center/' + rel);
  var can = canonicalTarget(html) || '';
  T('KC-REWRITE: ' + rel + ' — ایندکس‌پذیر است', !isNoindex(html));
  T('KC-REWRITE: ' + rel + ' — canonical خود است',
    can.indexOf('/knowledge-center/' + rel) > -1, can);
  T('KC-REWRITE: ' + rel + ' — بدونِ بخشِ الگویی', hasTemplateH2(html) === null, hasTemplateH2(html));
  T('KC-REWRITE: ' + rel + ' — محتوای ≥۵۰۰ واژه', w >= 500, 'words=' + w);
  T('KC-REWRITE: ' + rel + ' — در سایت‌مپ', sitemap.indexOf('/knowledge-center/' + rel + '</loc>') > -1);
});

console.log('=== tester649: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
