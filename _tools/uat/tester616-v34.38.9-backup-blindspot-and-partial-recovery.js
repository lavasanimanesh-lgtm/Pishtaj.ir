#!/usr/bin/env node
'use strict';
/* =============================================================================
   tester616-v34.38.9-backup-blindspot-and-partial-recovery.js

   گزارش کارفرما: «در قسمت مشتریان دکمهٔ بازیابی تماس‌ها کار نمی‌کند. بررسی کن
   ببین مشکل چیست. همچنین ببین ریشهٔ باگ بسته شده که دیگر هیچ تماس مشتری جدیدی
   حذف و گم نشود یا نه.»

   ریشهٔ کشف‌شده (BACKUP-BLIND-SPOT):
     از فاز B (client-server.js v34.8.9 STORAGE-INDEPENDENCE) هر کلید کسب‌وکاریِ
     بزرگ‌تر از ۸KB به IndexedDB منتقل و «از localStorage حذف» می‌شود
     (localStorage.removeItem داخل window.ptfBMirror). ولی crm/backup.js همچنان
     مستقیماً localStorage.getItem می‌خواند. نتیجه:
       ① collectBackup: `if (v === null) return;` → کلید ptf_crm_customers اصلاً
          وارد payload نمی‌شد → همهٔ بک‌آپ‌های چرخشی سرور «صفر مشتری» داشتند →
          ptfContactRecoverScan همیشه plan خالی می‌داد = «دکمه کار نمی‌کند».
       ② ptfBackupDeltaCollect: `delta[k] = null` ارسال می‌شد و سرور
          `$ex['data'][$k] = null` می‌کرد → آخرین بک‌آپ کاملِ پایه هم مسموم.
     هر دو در سکوت (پاسخ ok=true).

   این تستر قرارداد اصلاح v34.38.16 را قفل می‌کند:
     ۱. backup.js از آینهٔ فاز B می‌خواند (بوت واقعی vm با آینهٔ شبیه‌سازی‌شده)
     ۲. دلتا هرگز مقدار null نمی‌فرستد + امضا کل داده را می‌بیند
     ۳. سپر پوشش کلیدهای حیاتی و تعویق تا آب‌رسانی آینه
     ۴. restore-contacts.js: بازیابی فیلد-به-فیلد (شستشوی جزئی) با حفظ S1/S2/S3
     ۵. تشخیص «چرا این بک‌آپ بی‌فایده بود» + منابع دستی/محلی
     ۶. نسخه و ثبت در گیت
   ============================================================================= */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function head(s) { console.log('\n── ' + s + ' ──'); }

var bkSrc = read('crm/backup.js');
var rcSrc = read('crm/restore-contacts.js');
var gate = read('_tools/uat/run-ci-gate.js');

/* ═════════ هارنس backup.js: دستگاه فاز B با کلیدهای offloadشده ═════════ */
function bootBackup(opts) {
  opts = opts || {};
  var store = opts.store || {};
  var idbMem = opts.idbMem || {};
  var alerts = [], audits = [], sent = [];
  var win = {
    console: { log: function () {}, warn: function () {}, error: function () {} },
    localStorage: {
      getItem: function (k) { return k in store ? store[k] : null; },
      setItem: function (k, v) { store[k] = String(v); },
      removeItem: function (k) { delete store[k]; },
      key: function () { return null; }, length: 0
    },
    curRole: function () { return 'admin'; },
    curSession: function () { return { user: 'admin', name: 'ادمین' }; },
    faDateTime: function () { return '۱۴۰۵/۰۶/۱۷'; },
    ptfAuthToken: function () { return 'T'; },
    getData: function (k) { try { return JSON.parse((k in idbMem ? idbMem[k] : store[k]) || '[]'); } catch (e) { return []; } },
    ptfBRead: function (k) { return (opts.mirrorActive !== false && Object.prototype.hasOwnProperty.call(idbMem, k)) ? idbMem[k] : null; },
    ptfBMirrorActive: function () { return opts.mirrorActive !== false; },
    ptfBIdbHydrated: opts.hydrated !== false,
    audit: function (a, b) { audits.push(a + ' | ' + b); },
    alert: function (m) { alerts.push(String(m)); },
    fetch: function (url, o) {
      sent.push({ url: url, body: (function () { try { return JSON.parse(o.body); } catch (e) { return null; } })() });
      return Promise.resolve({ status: 200, text: function () { return Promise.resolve('{"ok":true,"mode":"local"}'); } });
    },
    document: {
      addEventListener: function () {}, getElementById: function () { return null; },
      createElement: function () { return { style: {}, setAttribute: function () {}, innerHTML: '', firstChild: null }; },
      querySelectorAll: function () { return []; }, body: { appendChild: function () {} }
    },
    setInterval: function () { return 0; }, clearInterval: function () {},
    setTimeout: function (fn) { try { fn(); } catch (e) {} return 0; }, clearTimeout: function () {},
    addEventListener: function () {}, AbortController: null, Promise: Promise, JSON: JSON, Date: Date, String: String, Object: Object, Array: Array, Math: Math
  };
  win.window = win; win.self = win; win.globalThis = win;
  vm.createContext(win);
  vm.runInContext(bkSrc, win, { filename: 'backup.js' });
  win._store = store; win._idb = idbMem; win._alerts = alerts; win._audits = audits; win._sent = sent;
  return win;
}

var CUSTOMERS = [{ cd: 'CUST-1', co: 'شرکت الف', people: [{ nm: 'رضا', tels: [{ n: '۰۲۱۱' }], mobs: [{ n: '۰۹۱۲۱' }] }], con: 'رضا', ph: '۰۹۱۲۱' }];

head('۱. backup.js — آینهٔ فاز B (ریشهٔ «بک‌آپ بدون مشتری»)');
var W1 = bootBackup({
  store: { ptf_crm_settings: JSON.stringify({ a: 1 }) },
  idbMem: { ptf_crm_customers: JSON.stringify(CUSTOMERS), ptf_crm_offers: JSON.stringify([{ cd: 'OFF-1' }]) }
});
T('۱.۰ خوانندهٔ آینه‌آگاه export شده است', typeof W1.ptfBackupReadKey === 'function');
T('۱.۱ کلید offloadشده (فقط در IndexedDB) خوانده می‌شود',
  JSON.parse(W1.ptfBackupReadKey('ptf_crm_customers')).length === 1, String(W1.ptfBackupReadKey('ptf_crm_customers')));
T('۱.۲ کلید سبک localStorage همچنان خوانده می‌شود', W1.ptfBackupReadKey('ptf_crm_settings') === JSON.stringify({ a: 1 }));
T('۱.۳ کلید ناموجود → null (کلیدِ هرگز-نساخته وارد بک‌آپ نمی‌شود)', W1.ptfBackupReadKey('ptf_crm_petty') === null);

var full1 = null;
var full1Done = new Promise(function (resolve) {
  W1.ptfBackupPushFull(false, function () { full1 = W1._sent[W1._sent.length - 1]; resolve(); });
}).then(function () {
  T('۱.۴ بک‌آپ کامل شامل ptf_crm_customers است (قبل از اصلاح: غایب)',
    !!full1 && full1.url.indexOf('save_backup') > -1 && full1.body && full1.body.data && full1.body.data.ptf_crm_customers != null,
    full1 && full1.body ? Object.keys(full1.body.data).join(',') : 'no-send');
  T('۱.۵ محتوای بک‌آپ همان دادهٔ واقعی دستگاه است',
    !!full1 && JSON.parse(full1.body.data.ptf_crm_customers)[0].people[0].mobs[0].n === '۰۹۱۲۱');
  T('۱.۶ کلید سبک هم در همان تصویر هست (رگرسیون نداشتیم)',
    !!full1 && full1.body.data.ptf_crm_settings === JSON.stringify({ a: 1 }));
});

head('۲. دلتا هرگز کلید null نمی‌فرستد + امضا کل داده را می‌بیند');
var W2 = bootBackup({
  store: { ptf_crm_settings: '{"a":1}' },
  idbMem: { ptf_crm_customers: JSON.stringify(CUSTOMERS) }
});
var d2 = W2.ptfBackupDeltaCollect();
T('۲.۰ ptf_crm_customers در دلتا با مقدار واقعی است (نه null)',
  d2.changed.indexOf('ptf_crm_customers') > -1 && typeof d2.delta['ptf_crm_customers'] === 'string' && d2.delta['ptf_crm_customers'].indexOf('CUST-1') > -1,
  JSON.stringify(d2.delta['ptf_crm_customers']));
T('۲.۱ هیچ مقدار null/undefined در payload دلتا نیست (سم‌زدایی بک‌آپ پایهٔ سرور)',
  Object.keys(d2.delta).every(function (k) { return d2.delta[k] !== null && d2.delta[k] !== undefined; }),
  JSON.stringify(Object.keys(d2.delta).filter(function (k) { return d2.delta[k] == null; })));
T('۲.۲ کلیدهای بدون داده در فهرست missing گزارش می‌شوند (نه در delta)',
  Array.isArray(d2.missing) && d2.missing.indexOf('ptf_crm_petty') > -1 && !('ptf_crm_petty' in d2.delta));
T('۲.۳ فقط دو کلیدِ دارای داده تغییرکرده اعلام شدند (نه ۶۵ کلید خالی)',
  d2.changed.length === 2 && d2.changed.indexOf('ptf_crm_settings') > -1, d2.changed.join(','));
/* امضا: تغییر محتوای آینه (نه localStorage) باید امضا را عوض کند */
var sigA = W2.ptfBackupSignature();
W2._idb['ptf_crm_customers'] = JSON.stringify([{ cd: 'CUST-1', co: 'شرکت الف', people: [], con: '', ph: '' }]);
var sigB = W2.ptfBackupSignature();
T('۲.۴ امضای بک‌آپ به تغییر دادهٔ آینه حساس است (بک‌آپ خودکار دیگر «تغییری نبود» نمی‌گوید)', sigA !== sigB, sigA + ' vs ' + sigB);

head('۳. سپرهای جدید: پوشش کلیدهای حیاتی و تعویق تا آب‌رسانی آینه');
var W3 = bootBackup({ store: {}, idbMem: { ptf_crm_customers: JSON.stringify(CUSTOMERS) }, mirrorActive: true, hydrated: false });
var r3 = null;
W3.ptfBackupPushFull(true, function (d) { r3 = d; });
T('۳.۰ آینهٔ آب‌رسانی‌نشده → بک‌آپ به تعویق می‌افتد (تصویر کور ثبت نمی‌شود)',
  r3 && r3.ok === false && r3.error === 'mirror_not_hydrated' && W3._sent.length === 0, JSON.stringify(r3));
var r3b = null;
W3.ptfBackupPushDelta(true, function (d) { r3b = d; });
T('۳.۱ همان تعویق برای مسیر دلتا', r3b && r3b.error === 'mirror_not_hydrated' && W3._sent.length === 0);

/* سپر پوشش: آینه فعال و آب‌رسانی‌شده اما کلید حیاتی به هر دلیل در تصویر نیست */
var W4 = bootBackup({ store: {}, idbMem: {} });
W4.getData = function (k) { return k === 'ptf_crm_customers' ? CUSTOMERS : []; };
var gap = W4.ptfBackupCoverageGap({ ptf_crm_settings: '{}' });
T('۳.۲ سپر پوشش کلید حیاتیِ غایب را تشخیص می‌دهد', gap.indexOf('ptf_crm_customers') > -1, JSON.stringify(gap));
T('۳.۳ تصویر کامل → هیچ شکاف پوششی', W4.ptfBackupCoverageGap({ ptf_crm_customers: JSON.stringify(CUSTOMERS) }).length === 0);
T('۳.۴ golive نیز از خوانندهٔ آینه‌آگاه استفاده می‌کند (بک‌آپ pre-golive کور نشود)',
  read('crm/golive.js').indexOf('ptfBackupReadKey') > -1);

/* ═════════ هارنس restore-contacts.js ═════════ */
function bootRc(opts) {
  opts = opts || {};
  var store = {};
  var win = {
    console: console,
    localStorage: { getItem: function (k) { return k in store ? store[k] : null; }, setItem: function (k, v) { store[k] = String(v); }, removeItem: function (k) { delete store[k]; } },
    fetch: opts.fetch || function () { return Promise.reject(new Error('no-fetch')); },
    curRole: function () { return opts.role || 'admin'; },
    ptfAuthToken: function () { return 'T'; },
    getData: function (k) { try { return JSON.parse(store[k] || '[]'); } catch (e) { return []; } },
    audit: function () {}, alert: function () {}, renderCustomers: function () {},
    ptfEntitySaveCollection: opts.saveSpy || function () {},
    ptfStorageIdbGet: opts.idbGet,
    document: {
      _ids: {}, getElementById: function (id) { return this._ids[id] || null; },
      createElement: function () { return { style: {}, _html: '', set innerHTML(v) { this._html = v; }, get innerHTML() { return this._html; }, get firstChild() { return null; } }; },
      querySelectorAll: function () { return []; }, body: { appendChild: function () {} }
    },
    setTimeout: function () { return 0; }, clearTimeout: function () {}, Promise: Promise
  };
  win.window = win; win.self = win; win.globalThis = win; win.store = store;
  vm.createContext(win);
  vm.runInContext(rcSrc, win, { filename: 'restore-contacts.js' });
  return win;
}

head('۴. بازیابی فیلد-به-فیلد (شستشوی جزئی) — قرارداد v34.38.16');
var R = bootRc({});
/* CUST-P1: ph سالم مانده ولی اشخاص رابط پاک شده‌اند (امضای واقعی گزارش‌های میدانی)
   CUST-P2: people هست ولی هیچ کانال تماسی ندارد (نام تنها) — عملاً خالی
   CUST-OK: کاملاً سالم */
var CUR = [
  { cd: 'CUST-P1', co: 'نیمه‌شسته', people: [], coTels: [], con: '', ph: '۰۲۱۹۹۹', ind: 'نفت' },
  { cd: 'CUST-P2', co: 'اشخاص بی‌کانال', people: [{ nm: 'علی', tels: [], mobs: [], mails: [] }], con: 'علی', ph: '۰۲۱۸۸۸' },
  { cd: 'CUST-OK', co: 'سالم', people: [{ nm: 'حسن', tels: [{ n: '۰۲۱۷۷۷' }] }], coTels: [{ n: '۰۲۱۶۶۶' }], con: 'حسن', ph: '۰۲۱۷۷۷', coMail: 'a@b.c', coWeb: 'x.ir', coAddr: 'تهران' }
];
var BK = [{ name: 'hourly-latest.json.gz', t: '2026-09-08 10:00', customers: [
  { cd: 'CUST-P1', people: [{ nm: 'رضا', mobs: [{ n: '۰۹۱۲۱۱۱' }] }], coTels: [{ n: '۰۲۱۴۴۴' }], con: 'رضا', ph: 'شمارهٔ‌قدیمی‌که‌نباید‌بنشیند' },
  { cd: 'CUST-P2', people: [{ nm: 'علی', mobs: [{ n: '۰۹۱۲۲۲۲' }] }], con: 'نامِ‌دیگر' },
  { cd: 'CUST-OK', people: [{ nm: 'نسخهٔ قدیمی', tels: [{ n: 'z' }] }], coTels: [{ n: 'z2' }], con: 'z3', ph: 'z4' }
] }];
var pl = R.ptfContactRecoverBuildPlan(CUR, BK);
var mp = {}; pl.plan.forEach(function (x) { mp[x.cd] = x; });

T('۴.۰ CUST-P1 (ph سالم، اشخاص رفته) حالا نامزد بازیابی است — قبلاً کلاً نادیده گرفته می‌شد',
  !!mp['CUST-P1'], JSON.stringify(Object.keys(mp)));
T('۴.۱ فقط جاهای خالی پر می‌شوند: people/coTels/con آمدند، ph سالم دست‌نخورد (S2 در سطح فیلد)',
  mp['CUST-P1'] && mp['CUST-P1'].restore.people && mp['CUST-P1'].restore.coTels && mp['CUST-P1'].restore.con === 'رضا' && mp['CUST-P1'].restore.ph === undefined,
  JSON.stringify(mp['CUST-P1'] && Object.keys(mp['CUST-P1'].restore)));
T('۴.۲ people با نام ولی بدون هیچ کانال تماس = خالی → نسخهٔ تماس‌دارِ بک‌آپ می‌نشیند',
  mp['CUST-P2'] && mp['CUST-P2'].restore.people && mp['CUST-P2'].restore.people[0].mobs[0].n === '۰۹۱۲۲۲۲');
T('۴.۳ con سالمِ CUST-P2 بازنویسی نمی‌شود', mp['CUST-P2'] && mp['CUST-P2'].restore.con === undefined);
T('۴.۴ رکورد کاملاً سالم اصلاً وارد plan نمی‌شود', !mp['CUST-OK']);
T('۴.۵ هشدار «بازیابی‌نشده» فقط برای رکورد واقعاً تماس‌خالی است (نه رکورد سالمِ بدون coWeb)',
  pl.unrecovered.every(function (u) { return u.cd !== 'CUST-OK'; }), JSON.stringify(pl.unrecovered));

head('۵. اعمال: merge فیلدی، بدون حذف/ایجاد، با سقف عملیات کافی');
var saves = [];
var R2 = bootRc({ saveSpy: function (coll, arr, o) { saves.push({ coll: coll, arr: arr, o: o }); } });
R2.ptfContactRecoverApply(CUR, pl.plan, ['CUST-P1', 'CUST-P2']);
T('۵.۰ یک ذخیره با reason=offer-cust', saves.length === 1 && saves[0].o.reason === 'offer-cust');
T('۵.۱ maxOps پاس داده شد (بازیابی انبوه دیگر به مسیر legacy تنزل نمی‌کند)',
  saves.length === 1 && typeof saves[0].o.maxOps === 'number' && saves[0].o.maxOps >= 40, JSON.stringify(saves[0] && saves[0].o));
var o1 = saves[0].arr.filter(function (x) { return x.cd === 'CUST-P1'; })[0];
T('۵.۲ CUST-P1: اشخاص/تلفن شرکت/رابط برگشتند و ph سالمِ فعلی دست‌نخورد',
  o1.people[0].mobs[0].n === '۰۹۱۲۱۱۱' && o1.coTels[0].n === '۰۲۱۴۴۴' && o1.con === 'رضا' && o1.ph === '۰۲۱۹۹۹' && o1.ind === 'نفت',
  JSON.stringify(o1));
T('۵.۳ تعداد رکوردها ثابت (S3)', saves[0].arr.length === CUR.length);
T('۵.۴ رکورد سالم بیت‌به‌بیت دست‌نخورده', JSON.stringify(saves[0].arr.filter(function (x) { return x.cd === 'CUST-OK'; })[0]) === JSON.stringify(CUR[2]));
T('۵.۵ هیچ فیلد غیرتماسی نوشته نشد (S1)',
  Object.keys(o1).every(function (k) { return JSON.stringify(o1[k]) === JSON.stringify(CUR[0][k]) || ['people', 'coTels', 'con', 'ph', 'coMail', 'coWeb', 'coAddr'].indexOf(k) > -1; }));

head('۶. تشخیص «چرا بک‌آپ بی‌فایده بود» + منابع اضافی');
var R3 = bootRc({});
T('۶.۰ بک‌آپِ بدون کلید مشتریان (دقیقاً امضای این حادثه) تشخیص داده می‌شود',
  R3.ptfContactRecoverDiagnose(JSON.stringify({ data: { ptf_crm_settings: '{}' } })) === 'no_customers_key');
T('۶.۱ خطای سرور تشخیص داده می‌شود', R3.ptfContactRecoverDiagnose('{"ok":false,"error":"یافت نشد"}').indexOf('server_error:') === 0);
T('۶.۲ فایل خراب تشخیص داده می‌شود', R3.ptfContactRecoverDiagnose('نه-جیسون') === 'unparsable');
T('۶.۳ بک‌آپ سالم → ok', R3.ptfContactRecoverDiagnose(JSON.stringify({ data: { ptf_crm_customers: '[{"cd":"A"}]' } })) === 'ok');
var addOk = R3.ptfContactRecoverAddSource('backup-1404.json', JSON.stringify({ t: '2026-01-01 00:00', data: { ptf_crm_customers: JSON.stringify([{ cd: 'CUST-P1', con: 'از فایل دستی' }]) } }));
T('۶.۴ افزودن فایل بک‌آپ دستی به منابع کار می‌کند', addOk.ok === true && addOk.count === 1, JSON.stringify(addOk));
T('۶.۵ فایل بی‌ربط رد می‌شود با دلیل', R3.ptfContactRecoverAddSource('x.json', '{"data":{}}').ok === false);

/* اسکن کامل با سروری که بک‌آپ کور می‌دهد: باید skipped را گزارش کند و از فایل دستی نتیجه بگیرد */
var R4 = bootRc({
  fetch: function (url) {
    if (url.indexOf('list_backups') > -1) return Promise.resolve({ json: function () { return Promise.resolve({ ok: true, backups: [{ name: 'hourly-latest.json.gz', t: '2026-09-08' }] }); } });
    return Promise.resolve({ text: function () { return Promise.resolve(JSON.stringify({ data: { ptf_crm_settings: '{}' } })); } });
  }
});
R4.store['ptf_crm_customers'] = JSON.stringify([{ cd: 'CUST-P1', co: 'نیمه‌شسته', people: [], con: '', ph: '' }]);
R4.ptfContactRecoverAddSource('manual.json', JSON.stringify({ t: '2026-05-05 00:00', data: { ptf_crm_customers: JSON.stringify([{ cd: 'CUST-P1', people: [{ nm: 'رضا', mobs: [{ n: '۰۹۱۲۳' }] }], con: 'رضا' }]) } }));
var scanDone = R4.ptfContactRecoverScan(function () {}).then(function (res) {
  T('۶.۶ بک‌آپ کورِ سرور در skipped با دلیل no_customers_key گزارش شد',
    res.skipped.length === 1 && res.skipped[0].why === 'no_customers_key', JSON.stringify(res.skipped));
  T('۶.۷ با وجود کور بودن سرور، فایل دستی کاربر بازیابی را ممکن کرد',
    res.result.plan.length === 1 && res.result.plan[0].restore.con === 'رضا', JSON.stringify(res.result.plan));
});

head('۷. نسخه و گیت');
var ver = JSON.parse(read('VERSION.json'));
T('۷.۰ VERSION.json = v34.38.20', ver.crm_version === 'v34.38.20', ver.crm_version);
T('۷.۱ tester616 در run-ci-gate.js ثبت است', gate.indexOf('tester616-v34.38.9-backup-blindspot-and-partial-recovery.js') > -1);
T('۷.۲ قرارداد UI/sw/SD = 34.38.20',
  /window\.PTF_CRM_RELEASE = 'v34\.38\.20'/.test(read('crm/index.html')) &&
  /CACHE = 'ptf-crm-v34\.38\.20'/.test(read('crm/sw.js')) &&
  /SD_SERVICE_VERSION = '34\.38\.20'/.test(read('api/sales-domain.php')));
T('۷.۳ تسترهای رگرسیون تماس همچنان در گیت‌اند (زنجیرهٔ CONTACT-WIPE/GHOST)',
  gate.indexOf('tester604-v34.37.7-contact-wipe.js') > -1 &&
  gate.indexOf('tester611-v34.38.4-contact-wipe-ind-heal.js') > -1 &&
  gate.indexOf('tester614-v34.38.7-contact-ghost-cohorts.js') > -1 &&
  gate.indexOf('tester615-v34.38.8-contact-recovery-oneclick.js') > -1);
T('۷.۴ هیچ خوانندهٔ localStorage مستقیمی در جمع‌آوری بک‌آپ باقی نمانده',
  bkSrc.indexOf('var v = bkRead(k);') > -1 && bkSrc.indexOf('var v = localStorage.getItem(k);\n      if (v === null) return;') === -1);
T('۷.۵ سند RCA این حادثه در ریپو هست',
  fs.existsSync(path.join(ROOT, 'ARENA-BACKUP-BLINDSPOT-CONTACT-RECOVERY-RCA-2026-09-08.md')));

Promise.all([full1Done, scanDone]).then(function () {
  console.log('\n— tester616 (BACKUP-BLIND-SPOT: بک‌آپ‌های سرور بدون مشتری + بازیابی فیلد-به-فیلد) —');
  console.log('PASS: ' + p + ' | FAIL: ' + f);
  process.exit(f ? 1 : 0);
}).catch(function (e) { console.error('FATAL', e); process.exit(2); });
