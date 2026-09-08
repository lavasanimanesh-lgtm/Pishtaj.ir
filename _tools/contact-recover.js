#!/usr/bin/env node
'use strict';
/* =============================================================================
   contact-recover.js — بازیابی هدفمند «فقط اطلاعات تماس مشتریان» از فایل بک‌آپ
   (CONTACT-GHOST / v34.38.7 پس از شکست یکی‌بیند-یکی‌نه)
   -----------------------------------------------------------------------
   این ابزار *فقط* فیلدهای تماس را از یک فایل بک‌آپ سالم به رکوردهای فعلیِ
   «تماس‌خالی» برمی‌گرداند؛ هیچ فیلد دیگری دست نمی‌خورد و هیچ رکوردی حذف نمی‌شود.

   فیلدهای تماس: people, coTels, con, ph, coMail, coWeb, coAddr

   ورودی‌ها (هریک می‌تواند: فایل بک‌آپ کامل سرور/آروان {app:'PTF-CRM',data:{…}}
   یا JSON خام آرایهٔ مشتریان یا رشتهٔ localStorage باشد):
     --backup  <file>   سندی که هنوز تماس‌های سالم را دارد (اجباری)
     --current <file>   وضعیت فعلی مشتریان (اختیاری — اگر نباشد، فقط گزارش بک‌آپ)
     --out     <file>   خروجی ادغام‌شده (پیش‌فرض contact-recover-out.json)

   خروجی: گزارش فارسی + فایل JSON آمادهٔ بازگشت (دستورالعمل پایان گزارش).
   قانون امنیت: هرگز فیلد غیرتماس نوشته نمی‌شود؛ هرگز مقدار غیرخالیِ فعلی
   بازنویسی نمی‌شود؛ تطبیق فقط بر اساس cd (کد مشتری) انجام می‌شود.
   ============================================================================= */
var fs = require('fs');

/* ---------- پارس انعطاف‌پذیر ورودی ---------- */
function parseCustomersFile(path) {
  var raw = fs.readFileSync(path, 'utf8');
  raw = raw.replace(/^﻿/, ''); // BOM
  var j;
  try { j = JSON.parse(raw); }
  catch (e) { throw new Error('فایل JSON معتبر نیست: ' + path + ' — ' + e.message); }
  /* اگر رشتهٔ دوتایی‌است (localStorage copy) */
  if (typeof j === 'string') { try { j = JSON.parse(j); } catch (e2) {} }
  /* حالت ۱: خود آرایهٔ مشتریان */
  if (Array.isArray(j)) return { arr: j, kind: 'raw-array' };
  /* حالت ۲: بک‌آپ کامل */
  if (j && typeof j === 'object') {
    if (j.data && j.data.ptf_crm_customers != null) {
      var c = j.data.ptf_crm_customers;
      if (typeof c === 'string') c = JSON.parse(c);
      if (Array.isArray(c)) return { arr: c, kind: 'full-backup', meta: { t: j.t, tFa: j.tFa, by: j.by } };
    }
    /* حالت ۳: wrapper سرور {ok:true, backup/record/...} */
    var keys = ['backup', 'file', 'content', 'payload'];
    for (var i = 0; i < keys.length; i++) {
      var v = j[keys[i]];
      if (!v) continue;
      if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e3) {} }
      if (v && v.data && typeof v.data.ptf_crm_customers === 'string') {
        return { arr: JSON.parse(v.data.ptf_crm_customers), kind: 'server-backup' };
      }
    }
  }
  throw new Error('ساختار ناشناخته — نه بک‌آپ کامل CRM است نه آرایهٔ مشتریان: ' + path);
}

/* ---------- کمک‌کارها ---------- */
var CONTACT_FIELDS = ['people', 'coTels', 'con', 'ph', 'coMail', 'coWeb', 'coAddr'];

function normName(s) {
  return String(s == null ? '' : s)
    .replace(/[‌\s]+/g, '')
    .replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/‌/g, '')
    .replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); })
    .replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); })
    .toLowerCase();
}
function personHasContact(pp) {
  if (!pp || typeof pp !== 'object') return false;
  return (pp.tels && pp.tels.length) || (pp.mobs && pp.mobs.length) || (pp.mails && pp.mails.length);
}
function fieldEmpty(v) {
  if (v == null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  return false;
}
function hasContacts(x) {
  if (!x) return false;
  if (Array.isArray(x.people) && x.people.some(personHasContact)) return true;
  if (Array.isArray(x.coTels) && x.coTels.length) return true;
  if (!fieldEmpty(x.ph) || !fieldEmpty(x.con)) return true;
  return false;
}

/* ---------- آرگومان‌ها ---------- */
function arg(name) { var i = process.argv.indexOf('--' + name); return i > -1 ? process.argv[i + 1] : null; }
if (process.argv.indexOf('--help') > -1 || process.argv.length < 3) {
  console.log('استفاده: node contact-recover.js --backup backup.json [--current current.json] [--out out.json]');
  process.exit(process.argv.length < 3 ? 1 : 0);
}
var backupPath = arg('backup'), currentPath = arg('current');
var outPath = arg('out') || 'contact-recover-out.json';
if (!backupPath) { console.error('⛔ فایل --backup الزامی است (node contact-recover.js --help)'); process.exit(1); }

/* ---------- خواندن ---------- */
var bak, cur = null;
try { bak = parseCustomersFile(backupPath); }
catch (e) { console.error('⛔ بک‌آپ:', e.message); process.exit(1); }
console.log('📦 بک‌آپ خوانده شد (' + bak.kind + (bak.meta && bak.meta.tFa ? ' · ' + bak.meta.tFa : '') + (bak.meta && bak.meta.by ? ' · ثبت‌کننده: ' + bak.meta.by : '') + ') — ' + bak.arr.length + ' مشتری');
var bakContacts = bak.arr.filter(hasContacts);
console.log('   · تماس‌دار در بک‌آپ: ' + bakContacts.length + ' | بدون تماس: ' + (bak.arr.length - bakContacts.length));

if (!currentPath) {
  console.log('\nℹ️  بدون --current فقط گزارش بک‌آپ چاپ شد. برای ساخت خروجی ادغام، وضعیت فعلی را بدهید.');
  var peek = bakContacts.slice(0, 10).map(function (x) { return (x.cd || '?') + ' — ' + (x.co || x.nm || ''); });
  if (peek.length) console.log('   نمونه‌های تماس‌دار:\n     ' + peek.join('\n     '));
  process.exit(0);
}

try { cur = parseCustomersFile(currentPath); }
catch (e) { console.error('⛔ وضعیت فعلی:', e.message); process.exit(1); }
console.log('🖥  وضعیت فعلی (' + cur.kind + ') — ' + cur.arr.length + ' مشتری');

/* ---------- نگاشت بک‌آپ بر cd ---------- */
var byCd = {};
bak.arr.forEach(function (x) { if (x && x.cd) byCd[x.cd] = x; });

/* ---------- بازیابی فیلدبه‌فیلد (فقط جاهای خالیِ فعلی) ---------- */
var restored = [], fieldCounts = {}, alreadyOk = 0, noMatch = 0, noBackupContact = 0;
var out = cur.arr.map(function (x) {
  if (!x || !x.cd) return x;
  if (hasContacts(x)) { alreadyOk++; return x; }           /* فعلی تماس دارد — دست نمی‌زنیم */
  var b = byCd[x.cd];
  if (!b) { noMatch++; return x; }
  if (!hasContacts(b)) { noBackupContact++; return x; }    /* بک‌آپ هم چیزی ندارد */
  var x2 = JSON.parse(JSON.stringify(x)), got = [];
  CONTACT_FIELDS.forEach(function (f) {
    if (fieldEmpty(x2[f]) && !fieldEmpty(b[f])) {
      x2[f] = JSON.parse(JSON.stringify(b[f]));
      got.push(f); fieldCounts[f] = (fieldCounts[f] || 0) + 1;
    }
  });
  restored.push({ cd: x.cd, co: x2.co || x2.nm || '', got: got });
  return x2;
});

/* ---------- گزارش ردیف‌های روح (تکراریِ هم‌نام) ---------- */
var groups = {};
cur.arr.forEach(function (x) { if (!x || !x.cd) return; var g = normName(x.co || x.nm || ''); if (!g) return; (groups[g] = groups[g] || []).push(x); });
var ghosts = Object.keys(groups).filter(function (g) { return groups[g].length > 1; }).map(function (g) {
  return groups[g].map(function (x) { return { cd: x.cd, co: x.co || '', contacts: hasContacts(x), people: (x.people || []).length, crAt: x.crAt || x.createdAtISO || '' }; });
});

/* ---------- خروجی ---------- */
fs.writeFileSync(outPath, JSON.stringify(out, null, 1), 'utf8');
console.log('\n══ گزارش بازیابی ══');
console.log('✅ بازیابی‌شد: ' + restored.length + ' مشتری (فقط فیلدهای تماس خالی پر شدند)');
if (restored.length) restored.forEach(function (r) { console.log('   • ' + r.cd + ' — ' + r.co + ' → ' + r.got.join('، ')); });
console.log('⏭  از قبل تماس داشتند: ' + alreadyOk);
console.log('❔ در بک‌آپ پیدا نشدند (cd متفاوت): ' + noMatch);
console.log('🚫 در بک‌آپ هم تماس نداشتند (قابل بازیابی از این فایل نیستند): ' + noBackupContact);
if (Object.keys(fieldCounts).length) console.log('📊 تعداد فیلدهای بازگردانده: ' + JSON.stringify(fieldCounts));

if (ghosts.length) {
  console.log('\n👻 ' + ghosts.length + ' گروه مشتریِ تکراریِ هم‌نام («روح» — دامنهٔ کد متفاوت):');
  ghosts.forEach(function (g) {
    g.forEach(function (x) { console.log('   ' + (x.contacts ? '✓تماس‌دار' : '✗ خالی') + '  ' + x.cd + '  people=' + x.people + '  ' + x.crAt); });
  });
  console.log('   راهنما: رکورد ✗ خالی محصول باگ v34.38.7 است؛ با حذف آن در UI، رکورد ✓ بعد از پول دیده می‌شود.');
}
console.log('\n💾 خروجی نوشته شد: ' + outPath);
console.log('\n── روش برگرداندن به سیستم (روی هر ماشینِ واردشده به CRM) ──');
console.log('۱) در تب مرورگرِ CRM، کنسول (F12) را باز کنید و محتوای ' + outPath + ' را در متغیر زیر قرار دهید.');
console.log('   سپس اجرا کنید:');
console.log('   localStorage.setItem(\'ptf_crm_customers\', JSON.stringify(RESTORED));');
console.log('   ptfEntitySaveCollection(\'ptf_crm_customers\', RESTORED, { reason: \'offer-cust\' });');
console.log('۲) بعد از پایان سینک (آیکن سبز)، یک‌بار صفحه را رفرش کنید و در ماشین دیگر هم بررسی کنید.');
