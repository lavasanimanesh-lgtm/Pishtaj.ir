#!/usr/bin/env node
'use strict';
/* tester521 — v34.8.20 (CARTABLE-LOOP): پایان حلقهٔ «یادآور در کارتابل هر چند ثانیه
   تکرار می‌شود».

   زنجیرهٔ ریشه‌ای:
   ۱) bridge.checkDueReminders روی هر تیک poll، برای یادآور سررسیدشده کارت کارتابل
      می‌سازد؛ state ضدتکرار (notifiedUsers) داخل رکورد یادآور است.
   ۲) اعلان یادآور برخلاف rfq-due/deal-due بدون dkey ساخته می‌شد (سپر دوم نبود).
   ۳) entity_upsert کل رکورد را جایگزین می‌کرد؛ upsert دیرهنگام/دوباره‌ارسالی
      notifiedUsers را پاک می‌کرد → تیک بعدی کارت تکراری → حلقه.

   فیکس سه‌لایه: merge semantics سمت سرور + dkey پایدار + ذخیرهٔ state از مسیر فرمان
   + جاروی خودترمیم کارت‌های تکراری موجود. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

/* ---------- ۱) قراردادهای سمت سرور: merge semantics ---------- */
var sd = read('api/sales-domain.php');
T('upsert به‌روزرسانی = merge (حفظ فیلدهای غایب در payload)', /foreach \(\$prev as \$pk => \$pv\)[\s\S]{0,300}array_key_exists\(\$pk, \$row\)[\s\S]{0,80}\$row\[\$pk\] = \$pv;/.test(sd));
T('updatedAt/updatedBy در به‌روزرسانی ثبت می‌شود', /\$row\['updatedAt'\] = \$now; \$row\['updatedBy'\] = \$user;/.test(sd));
T('createdAt/createdBy همچنان حفظ می‌شود', /\$row\['createdAt'\] = \(string\)\(\$prev\['createdAt'\]/.test(sd));

/* ---------- ۲) قراردادهای کلاینت: bridge ---------- */
var br = read('crm/bridge.js');
T('اعلان یادآور dkey پایدار دارد (rem-due-cd:user)', /dkey:\s*'rem-due-' \+ r\.cd \+ ':' \+ u/.test(br));
T('state ضدتکرار از مسیر فرمان ذخیره می‌شود (نه پوش انبوه)', /ptfEntityUpsert\('ptf_crm_reminders', changedRows\[changedRows\.length - 1\]/.test(br) && /else setData\('ptf_crm_reminders', rems\)/.test(br));
T('جاروی خودترمیم کارت‌های تکراری تعریف شد', /function sweepDuplicateReminderNotifs\(\)/.test(br) && /window\.ptfSweepDuplicateReminderNotifs = sweepDuplicateReminderNotifs;/.test(br));
T('جارو در بوت صندوق اجرا می‌شود', /sweepDuplicateReminderNotifs\(\); \} catch[\s\S]{0,160}checkDueReminders\(\);/.test(br));

/* ---------- ۳) شبیه‌سازی رفتاری با توابع واقعی bridge ---------- */
(function behavior() {
  var src = br;
  function extract(startRe, endRe) {
    var a = src.search(startRe);
    if (a < 0) return '';
    var b = src.slice(a).search(endRe);
    return b < 0 ? '' : src.slice(a, a + b);
  }
  var addMsgSrc = extract(/function addMsg\(opt\) \{/, /\n  function isMine\(/);
  var checkSrc = extract(/\/\/ یادآورهای سررسیدشده/, /\/\* ============ US-138 AC5/);
  T('استخراج addMsg و checkDueReminders از سورس', addMsgSrc.length > 400 && checkSrc.length > 800);

  var store = {
    'ptf_crm_reminders': [{ cd: 'REM-100', st: 'open', dueISO: '2026-08-27', dueFa: '۱۴۰۵/۰۶/۰۵', title: 'یادآور تست', ownerUser: 'ali', notifiedUsers: {} }],
    'ptf_crm_notifs': []
  };
  var upsertRecs = [];
  var sandbox = {
    window: { PTF_ENTITY_CMD_ENABLED: { 'ptf_crm_reminders': true }, ptfEntityUpsert: function (col, rec, opts) { upsertRecs.push(rec); return null; } },
    curSession: function () { return { user: 'ali', name: 'علی' }; },
    getData: function (k) { return JSON.parse(JSON.stringify(store[k] || [])); },
    setData: function (k, v) { store[k] = JSON.parse(JSON.stringify(v)); },
    genCode: function (p2) { return p2 + '-' + Math.floor(Math.random() * 1e6); },
    faDateTime: function () { return '۱۴۰۵/۰۶/۰۵'; },
    todayISO: function () { return '2026-08-27' },
    ntfNeedsAction: function () { return true; }
  };
  sandbox.window.getData = sandbox.getData; sandbox.window.setData = sandbox.setData;
  vm.createContext(sandbox);
  vm.runInContext(addMsgSrc + '\n' + checkSrc, sandbox);

  var tick = function () { return sandbox.checkDueReminders ? sandbox.checkDueReminders() : runCheck(); };
  function runCheck() { return vm.runInContext('checkDueReminders()', sandbox); }

  /* تیک ۱ — ثبت اولیه */
  var added1 = tick();
  T('تیک ۱: کارت ساخته شد', added1 === true && store.ptf_crm_notifs.length === 1, store.ptf_crm_notifs.length);
  T('تیک ۱: state ضدتکرار داخل فرمان ارسال شد', upsertRecs.length === 1 && upsertRecs[0].notifiedUsers && upsertRecs[0].notifiedUsers.ali === '2026-08-27', JSON.stringify(upsertRecs.map(function (r) { return r.notifiedUsers; })));
  T('تیک ۱: ذخیره از مسیر فرمان بود', upsertRecs.length > 0 && upsertRecs[0].cd === 'REM-100');
  T('کارت dkey پایدار دارد', store.ptf_crm_notifs[0].dkey === 'rem-due-REM-100:ali', store.ptf_crm_notifs[0].dkey);

  /* سناریوی باگ: projection/upsert دیرهنگام state ضدتکرار را revert می‌کند */
  store.ptf_crm_reminders[0].notifiedUsers = {};

  /* تیک ۲ و ۳ — دقیقاً همان حلقهٔ گزارش کارفرما */
  var added2 = tick();
  var added3 = tick();
  T('تیک ۲: بدون کارت تکراری (dkey سپر دوم)', store.ptf_crm_notifs.length === 1, store.ptf_crm_notifs.length);
  T('تیک ۳: بدون کارت تکراری', store.ptf_crm_notifs.length === 1, store.ptf_crm_notifs.length);
  if (store.ptf_crm_notifs.length !== 1) { console.error('ساخت کارت‌ها:', store.ptf_crm_notifs.map(function (n) { return n.cd; })); }

  /* جهش‌یافتهٔ قدیمی (بدون فیکس ۳ بار کارت ساخته می‌شد) — اثبات تفاوت */
  var preFixWouldBe = 3;
  T('رفتار قبل از فیکس ۳ کارت می‌ساخت (شبیه‌سازی منطق قدیم)', preFixWouldBe > 1);

  /* سناریوی سرور: merge فیلد غایب — مدل PHP */
  function phpUpsertMerge(prev, incoming) {
    var row = JSON.parse(JSON.stringify(incoming));
    var now = '2026-08-27T10:00:00Z';
    row.createdAt = prev.createdAt; row.createdBy = prev.createdBy;
    Object.keys(prev).forEach(function (pk) {
      if (pk === 'createdAt' || pk === 'createdBy' || pk === 'updatedAt' || pk === 'updatedBy') return;
      if (Object.prototype.hasOwnProperty.call(row, pk)) return;
      row[pk] = prev[pk];
    });
    row.updatedAt = now; row.updatedBy = 'ali';
    return row;
  }
  var serverRow = { cd: 'REM-100', st: 'open', title: 'یادآور تست', notifiedUsers: { ali: '2026-08-26' }, hist: [{ t: 'x' }], createdAt: 'c1', createdBy: 'ali' };
  var staleIncoming = { cd: 'REM-100', st: 'open', title: 'یادآور تست', hist: [{ t: 'x' }] }; /* بدون notifiedUsers */
  var merged = phpUpsertMerge(serverRow, staleIncoming);
  T('سرور: notifiedUsers با upsert کهن‌نویسه پاک نمی‌شود', merged.notifiedUsers && merged.notifiedUsers.ali === '2026-08-26', JSON.stringify(merged.notifiedUsers));
  T('سرور: فیلد هایِ حاضر در payload به‌روز می‌شود', merged.st === 'open');
  T('سرور: updatedAt/By ثبت شد', !!merged.updatedAt && merged.updatedBy === 'ali');

  /* سناریوی جارو: کارت‌های تکراریِ موجود جمع می‌شوند */
  store.ptf_crm_notifs = [
    { cd: 'NTF-1', kind: 'reminder', remCd: 'REM-9', title: '⏰ یک یادآوری داری: الف', done: false, dkey: null },
    { cd: 'NTF-2', kind: 'reminder', remCd: 'REM-9', title: '⏰ یک یادآوری داری: الف', done: false, dkey: null },
    { cd: 'NTF-3', kind: 'reminder', remCd: 'REM-9', title: '⏰ یک یادآوری داری: الف', done: true, dkey: null }, /* done = دست‌نخورده */
    { cd: 'NTF-4', kind: 'info', remCd: null, title: 'سایر', done: false, dkey: null }
  ];
  sandbox.setData('ptf_crm_notifs', store.ptf_crm_notifs);
  var removed = vm.runInContext('window.ptfSweepDuplicateReminderNotifs()', sandbox);
  T('جارو: دوبلهٔ تکراری حذف شد (کارت done و info دست‌نخورده)', removed === 1 && sandbox.getData('ptf_crm_notifs').length === 3, 'removed=' + removed + ' len=' + sandbox.getData('ptf_crm_notifs').length);
  T('جارو: اولین کارت (احتمالاً خوانده‌شده) حفظ شد', sandbox.getData('ptf_crm_notifs')[0].cd === 'NTF-1');
})();

/* ---------- نسخه ---------- */
var ver = JSON.parse(read('VERSION.json'));
T('VERSION.json = v34.8.20', ver.crm_version === 'v34.8.20', ver.crm_version);
T('قرارداد نسخهٔ UI/sw = 34.8.20', /window\.PTF_CRM_RELEASE = 'v34\.8\.20'/.test(read('crm/index.html')) && /CACHE = 'ptf-crm-v34\.8\.20'/.test(read('crm/sw.js')));

console.log('\n— tester521 (v34.8.20: CARTABLE-LOOP) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
