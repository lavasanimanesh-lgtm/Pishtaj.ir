#!/usr/bin/env node
'use strict';
/* tester524 — v34.8.41 (NOTIFS-UNION): پایان نوار زرد پایدار [notifs].
   ریشه: merge سرور (append + md5-dedupe) با merge کلاینت (dedupe cd + اتحاد
   readBy/done + مرتب‌سازی iso نزولی) هرگز فرم برابر تولید نمی‌کرد ⇒ sameSyncJson
   پاس نمی‌شد ⇒ dirty دائمی. فیکس: notifs = کلید union مشترک با merge کانونیکال
   سروری عین قرارداد ptfSmartMerge.

   آزمون کلیدی: خروجی merge سرور (مدل PHP) و خروجی ptfSmartMerge واقعی کلاینت باید
   روی هر ورودی، بایت‌به‌بایت یکی باشند (همگرایی + نقطهٔ ثابت). */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

/* ---------- قراردادهای سورس ---------- */
var php = read('api/crm.php');
T('notifs در sync_shared_union_key', /'ptf_crm_audit','ptf_crm_avatars','ptf_crm_notifs'/.test(php));
T('شاخهٔ merge کانونیکال notifs در سرور', php.indexOf("if ($key === 'ptf_crm_notifs')") > -1 && /\$byCd\[\$row\['cd'\]\] = \$row;/.test(php));
T('ترتیب کلاینت‌مانند: dedupe قبل از sort', /\$byTask = \[\]; \$nDedup = \[\];[\s\S]{0,2200}usort\(\$nDedup,/.test(php));
T('اتحاد readBy در سرور', /ex\['readBy'\] = array_values\(array_keys\(\$rb\)\)/.test(php));
T('مرتب‌سازی iso نزولی در سرور (روی خروجی نهایی)', /usort\(\$nDedup, function \(\$a, \$b\) \{ return strcmp\(\(string\)\(isset\(\$b\['iso'\]\)/.test(php));

/* ---------- مدل PHP از شاخهٔ notifs (دقیقاً مطابق کد سرور) ---------- */
function phpNotifsUnion(serverRows, incomingRows) {
  var byCd = {};
  serverRows.forEach(function (row) { if (row && row.cd !== undefined && row.cd !== null) byCd[row.cd] = row; });
  incomingRows.forEach(function (row) {
    if (!row || row.cd === undefined || row.cd === null) return;
    var cd = row.cd;
    if (!(cd in byCd)) { byCd[cd] = row; return; }
    var ex = byCd[cd];
    var rb = {};
    (ex.readBy || []).forEach(function (u) { if (u) rb[u] = 1; });
    (row.readBy || []).forEach(function (u) { if (u) rb[u] = 1; });
    ex.readBy = Object.keys(rb);
    ex.done = !!ex.done || !!row.done;
    var ir = row.repeat === undefined ? 1 : row.repeat;
    var xr = ex.repeat === undefined ? 1 : ex.repeat;
    if (ir > xr) {
      ex.repeat = ir;
      ex.lastT = row.lastT !== undefined ? row.lastT : (ex.lastT !== undefined ? ex.lastT : '');
      ex.lastISO = row.lastISO !== undefined ? row.lastISO : (ex.lastISO !== undefined ? ex.lastISO : '');
    }
    byCd[cd] = ex;
  });
  var nOut = Object.keys(byCd).map(function (k) { return byCd[k]; });
  var byTask = {}, nDedup = [];
  nOut.forEach(function (item) {
    var dk = String((item && item.dkey) || '');
    var isRef = item && item.kind === 'referral' && /^referral\|/.test(dk);
    if (!isRef || !byTask[dk]) { if (isRef) byTask[dk] = item; nDedup.push(item); return; }
    var keep = byTask[dk], rb2 = {};
    (keep.readBy || []).concat(item.readBy || []).forEach(function (u) { if (u) rb2[u] = 1; });
    keep.readBy = Object.keys(rb2); keep.done = !!(keep.done || item.done);
    var iIso = String(item.iso || ''), kIso = String(keep.iso || '');
    if (iIso !== '' && (kIso === '' || iIso < kIso)) { keep.t = item.t; keep.iso = item.iso; }
  });
  nDedup.sort(function (a, b) { return String(b.iso || '').localeCompare(String(a.iso || '')); });
  if (nDedup.length > 4000) nDedup = nDedup.slice(0, 4000);
  return nDedup;
}

/* ---------- استخراج ptfSmartMerge واقعی کلاینت ---------- */
var syncSrc = read('crm/sync.js');
var mFn = syncSrc.match(/window\.ptfSmartMerge = function \(key, localStr, remoteStr, mergeOptions\) \{[\s\S]*?\n  \};/);
T('ptfSmartMerge از sync.js استخراج شد', !!mFn);
var sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(mFn[0], sandbox);
var clientMerge = sandbox.window.ptfSmartMerge;
T('ptfSmartMerge در سندباکس اجرا شد', typeof clientMerge === 'function');

/* ---------- سناریوها: برابری بایت‌به‌بایت سرور و کلاینت ---------- */
function card(cd, iso, extra) {
  return Object.assign({ cd: cd, kind: 'reminder', title: 'کارت ' + cd, t: iso, iso: iso, done: false, readBy: [] }, extra || {});
}
function eqJson(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

/* سناریو ۱ — دو دستگاه، کارت‌های متفاوت */
(function () {
  var server = [card('N1', '2026-08-27T08:00:00Z'), card('N2', '2026-08-27T07:00:00Z')];
  var client = [card('N3', '2026-08-27T09:00:00Z'), card('N1', '2026-08-27T08:00:00Z', { readBy: ['ali'] })];
  var serverMerged = phpNotifsUnion(server, client);
  var clientMerged = JSON.parse(clientMerge('ptf_crm_notifs', JSON.stringify(client), JSON.stringify(server)));
  T('سناریو ۱: خروجی سرور == خروجی کلاینت (بایت‌به‌بایت)', eqJson(serverMerged, clientMerged), JSON.stringify(serverMerged.map(function (x) { return x.cd; })) + ' vs ' + JSON.stringify(clientMerged.map(function (x) { return x.cd; })));
  T('سناریو ۱: هر سه کارت حفظ شد', serverMerged.length === 3, serverMerged.length);
  T('سناریو ۱: مرتب‌سازی iso نزولی', serverMerged[0].cd === 'N3' && serverMerged[2].cd === 'N2', JSON.stringify(serverMerged.map(function (x) { return x.cd; })));
  T('سناریو ۱: readBy متحد شد', eqJson(serverMerged[1].readBy, ['ali']), JSON.stringify(serverMerged[1].readBy));
  /* نقطهٔ ثابت: merge دوباره هیچ چیز تغییر نمی‌دهد */
  var again = phpNotifsUnion(serverMerged, clientMerged);
  T('سناریو ۱: نقطهٔ ثابت (merge دوم بی‌اثر)', eqJson(again, serverMerged));
})();

/* سناریو ۲ — readBy از هر دو طرف + done */
(function () {
  var server = [card('N5', '2026-08-27T06:00:00Z', { readBy: ['ali'], done: false })];
  var client = [card('N5', '2026-08-27T06:00:00Z', { readBy: ['ghadimi'], done: true })];
  var sm = phpNotifsUnion(server, client);
  var cm = JSON.parse(clientMerge('ptf_crm_notifs', JSON.stringify(client), JSON.stringify(server)));
  T('سناریو ۲: برابری سرور/کلاینت', eqJson(sm, cm));
  T('سناریو ۲: readBy اتحاد + done اتحاد', eqJson(sm[0].readBy, ['ali', 'ghadimi']) && sm[0].done === true, JSON.stringify(sm[0]));
})();

/* سناریو ۳ — دوبلهٔ ارجاع با dkey (referral|) */
(function () {
  var server = [card('N6', '2026-08-27T05:00:00Z', { kind: 'referral', dkey: 'referral|CO-100', iso: '2026-08-27T05:00:00Z' })];
  var client = [card('N7', '2026-08-27T05:30:00Z', { kind: 'referral', dkey: 'referral|CO-100' })];
  var sm = phpNotifsUnion(server, client);
  var cm = JSON.parse(clientMerge('ptf_crm_notifs', JSON.stringify(client), JSON.stringify(server)));
  T('سناریو ۳: برابری سرور/کلاینت', eqJson(sm, cm));
  var refs = sm.filter(function (x) { return x.dkey === 'referral|CO-100'; });
  T('سناریو ۳: دوبلهٔ referral با dkey یکی شد (بازمانده = رکورد سرور N6)', refs.length === 1 && refs[0].cd === 'N6', refs.length && refs[0].cd);
})();

/* سناریو ۴ — نقشهٔ پیش از فیکس (قدیمی): append + md5 بدون کانونیکال → نابرابری دائمی
   اثبات تفاوت رفتار: با مدل قدیمی، sameSyncJson نمی‌توانست پاس شود */
(function () {
  function legacyUnion(serverRows, incomingRows) {
    var seen = {}, out = [];
    serverRows.concat(incomingRows).forEach(function (row) {
      var sig = JSON.stringify(row);
      if (seen[sig]) return;
      seen[sig] = 1; out.push(row);
    });
    return out;
  }
  var server = [card('N1', '2026-08-27T08:00:00Z'), card('N2', '2026-08-27T07:00:00Z')];
  var client = [card('N3', '2026-08-27T09:00:00Z'), card('N1', '2026-08-27T08:00:00Z', { readBy: ['ali'] })];
  var legacyServer = legacyUnion(server, client);
  var clientCanonical = JSON.parse(clientMerge('ptf_crm_notifs', JSON.stringify(client), JSON.stringify(server)));
  T('سناریو ۴ (اثبات ریشه): مدل قدیمی با فرم کانونیکال کلاینت برابر نبود', !eqJson(legacyServer, clientCanonical));
})();

/* ---------- نسخه ---------- */
var ver = JSON.parse(read('VERSION.json'));
T('VERSION.json = v34.8.41', ver.crm_version === 'v34.8.41', ver.crm_version);
T('قرارداد نسخهٔ UI/sw = 34.8.41', /window\.PTF_CRM_RELEASE = 'v34\.8.41'/.test(read('crm/index.html')) && /CACHE = 'ptf-crm-v34\.8.41'/.test(read('crm/sw.js')));

console.log('\n— tester524 (v34.8.41: NOTIFS-UNION convergence) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
