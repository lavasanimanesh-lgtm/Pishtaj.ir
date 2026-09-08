#!/usr/bin/env node
'use strict';
/* =============================================================================
   tester615-v34.38.8-contact-recovery-oneclick.js
   درخواست کارفرما: «اطلاعات مگر روی سرور نیست؟ خودکار برنگردد؟ ابزاری بساز با
   یک کلیک برگردد، چون نمی‌دانم از کی پاک شده — بعضی قدیمی‌تر بعضی جدیدتر».

   این تستر قرارداد ماژول crm/restore-contacts.js را قفل می‌کند:
     ① منطق خالص buildPlan (بوت واقعی vm در ماژول واقعی):
        - فقط فیلدهای تماس و فقط جا‌های خالی از بک‌آپ برمی‌گردند (S1/S2)
        - چندمنبعی: هر فیلد از جدیدترین بک‌آپ که «آن فیلد را» دارد (S4: فقط cd)
        - رکورد تماس‌دارِ فعلی دست‌نخورده؛ رکورد جدید (نه در هیچ بک‌آپ) در لیست
          «غیرقابل بازیابی» گزارش می‌شود
     ② applyPlan فقط فیلد restore را روی کپیِ رکورد می‌گذارد و با reason=offer-cust
        از روتر استاندارد upsert می‌کند (S3: بدون حذف/ایجاد — تعداد رکورد ثابت)
     ③ scanAll با mock fetch: فهرست→get_backup ترتیبی (Spy) + گارد نقش (S5)
     ④ مارکرهای UI/سیم‌کشی: دکمه در پنل مشتریان، script tag، سپر S5، ساختار مودال
     ⑤ نسخه‌ها/گیت ثبت هستند + تسترهای رگرسیون تماس در گیت مانده‌اند
   ============================================================================= */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function head(s) { console.log('\n── ' + s + ' ──'); }

var rc = read('crm/restore-contacts.js');
var idx = read('crm/index.html');
var gate = read('_tools/uat/run-ci-gate.js');

/* ─────────────── هارنس: بوت واقعی ماژول در vm ─────────────── */
function boot(opts) {
  opts = opts || {};
  var store = {};
  var win = {
    console: console, localStorage: { getItem: function (k) { return k in store ? store[k] : null; }, setItem: function (k, v) { store[k] = String(v); }, removeItem: function (k) { delete store[k]; } },
    fetch: opts.fetch || function () { return Promise.reject(new Error('no-fetch-in-test')); },
    curRole: function () { return opts.role || 'admin'; },
    ptfAuthToken: function () { return 'T'; },
    getData: function (k) { try { return JSON.parse(store[k] || '[]'); } catch (e) { return []; } },
    audit: opts.audit || function () {},
    renderCustomers: opts.renderCustomers || function () {},
    alert: opts.alert || function () {},
    ptfEntitySaveCollection: opts.saveSpy || function () {},
    document: {
      _ids: {}, _mounted: 0,
      getElementById: function (id) { return this._ids[id] || null; },
      createElement: function () {
        return { style: {}, _html: '', set innerHTML(v) { this._html = v; }, get innerHTML() { return this._html; }, get firstChild() { this.mounted = true; return null; } };
      },
      querySelectorAll: function () { return []; },
      body: { appendChild: function (n) { this.children = (this.children || []).concat([n]); } }
    },
    setInterval: function () { return 0; }, clearInterval: function () {}, setTimeout: function () { return 0; }, clearTimeout: function () {}
  };
  win.window = win; win.self = win; win.globalThis = win;
  win.store = store;
  vm.createContext(win);
  vm.runInContext(rc, win, { filename: 'restore-contacts.js' });
  return win;
}

/* ───────────────────── ۱. منطق خالص buildPlan/applyPlan ───────────────────── */
head('۱. buildPlan — فقط تماس، فقط خالی، چندمنبعی جدید→قدیم، فقط با cd');
var W = boot({ role: 'admin' });
T('۱.۰ توابع هستهٔ قابل‌تست اکسپورت شدند', typeof W.ptfContactRecoverBuildPlan === 'function' && typeof W.ptfContactRecoverParse === 'function' && typeof W.ptfContactRecoverApply === 'function' && typeof W.ptfContactRecoverHasContacts === 'function');

var CURRENT = [
  { cd: 'CUST-1', co: 'شسته‌شدهٔ کامل', people: [], coTels: [], con: '', ph: '', ind: 'نفت' },
  { cd: 'CUST-2', co: 'شسته‌شدهٔ نیمه‌منبعی', people: [], coTels: [], con: '', ph: '', coWeb: '' },
  { cd: 'CUST-3', co: 'سالمِ فعلی', people: [{ nm: 'علی', tels: [{ n: '۰۲۱۱۱۱' }], mobs: [] }], con: 'علی' },
  { cd: 'CUST-4', co: 'تازهٔ سرور', people: [] },
  { cd: 'CUST-5', co: 'فقط ph دارد', ph: '۰۲۱۵۵۵' }
];
var B_NEW = { name: 'hourly-latest.json.gz', t: '2026-09-08 10:00', customers: [
  { cd: 'CUST-1', co: 'شسته‌شدهٔ کامل', people: [{ nm: 'رضا', tels: [{ n: '۰۲۱۲۲۲' }], mobs: [{ n: '۰۹۱۲۹۹۹' }] }], con: 'رضا', coTels: [] }, /* coTels اینجا خالی است */
  { cd: 'CUST-2', co: 'شسته‌شدهٔ نیمه‌منبعی', con: 'کریم' }, /* فقط con */
  { cd: 'CUST-3', co: 'سالمِ فعلی', people: [{ nm: 'نسخهٔ قدیمی', tels: [{ n: 'x' }] }] }
] };
var B_OLD = { name: 'daily-2026-09-01.json.gz', t: '2026-09-01 10:00', customers: [
  { cd: 'CUST-1', co: 'شسته‌شدهٔ کامل', coTels: [{ n: '۰۲۱۳۳۳', lb: 'تلفنخانه' }], ph: '۰۲۱۳۳۳' },
  { cd: 'CUST-2', co: 'شسته‌شدهٔ نیمه‌منبعی', people: [{ nm: 'کریم', mobs: [{ n: '۰۹۱۲۰۰۰' }] }], ph: '۰۲۱۰۰۰' }
] };

var plan1 = W.ptfContactRecoverBuildPlan(CURRENT, [B_NEW, B_OLD]);
var m1 = {};
plan1.plan.forEach(function (p) { m1[p.cd] = p; });
T('۱.۱ CUST-1: people/con از جدیدتر (hourly) و coTels/ph از قدیمی‌تر (daily) — چندمنبعی فیلد-به-فیلد',
  m1['CUST-1'] && m1['CUST-1'].src.people === 'hourly-latest.json.gz' && m1['CUST-1'].src.con === 'hourly-latest.json.gz' &&
  m1['CUST-1'].src.coTels === 'daily-2026-09-01.json.gz' && m1['CUST-1'].src.ph === 'daily-2026-09-01.json.gz' &&
  m1['CUST-1'].restore.people[0].nm === 'رضا' && m1['CUST-1'].restore.coTels[0].n === '۰۲۱۳۳۳',
  JSON.stringify(m1['CUST-1'] && m1['CUST-1'].src));
T('۱.۲ CUST-2: con از جدیدتر؛ people/ph از قدیمی‌تر پر شدند (توقف زودهنگام وجود ندارد)',
  m1['CUST-2'] && m1['CUST-2'].src.con === 'hourly-latest.json.gz' && m1['CUST-2'].src.people === 'daily-2026-09-01.json.gz' &&
  m1['CUST-2'].restore.people[0].mobs[0].n === '۰۹۱۲۰۰۰' && m1['CUST-2'].restore.ph === '۰۲۱۰۰۰',
  JSON.stringify(m1['CUST-2'] && m1['CUST-2'].src));
T('۱.۳ CUST-3 (تماس‌دارِ فعلی) هیچ‌وقت در plan نیست — S2', !m1['CUST-3']);
T('۱.۴ CUST-4 (در هیچ بک‌آپی نیست) در غیرقابل‌بازیابی است', plan1.unrecovered.some(function (u) { return u.cd === 'CUST-4'; }));
T('۱.۵ CUST-5 (ph دارد) با وجود ph خالی در backups هم «تماس‌دار» محسوب و از دایره خارج است', !m1['CUST-5']);
T('۱.۶ فیلد غیرتماس (ind) هرگز در restore نیامد', Object.keys(m1['CUST-1'].restore).every(function (f) { return ['people', 'coTels', 'con', 'ph', 'coMail', 'coWeb', 'coAddr'].indexOf(f) > -1; }));
T('۱.۷ خروجی-restore دیپ‌کپی است (پیوند مرجع با منبع ندارد)', (function () { var v = m1['CUST-1'].restore.people; v[0].nm = 'تغییر'; return B_NEW.customers[0].people[0].nm === 'رضا'; })());

head('۲. applyPlan — upsert استاندارد، بدون حذف/ایجاد، مقدار سالم دست‌نخورده');
var savedCalls = [];
var W2 = boot({ role: 'admin', saveSpy: function (coll, arr, o) { savedCalls.push({ coll: coll, arr: arr, o: o }); } });
W2.store['ptf_crm_customers'] = JSON.stringify(CURRENT);
var outArr = W2.ptfContactRecoverApply(CURRENT, plan1.plan, ['CUST-1', 'CUST-2']);
T('۲.۰ دقیقاً یک ذخیره با reason=offer-cust روی همان کالکشن رفت', savedCalls.length === 1 && savedCalls[0].o && savedCalls[0].o.reason === 'offer-cust' && savedCalls[0].coll === 'ptf_crm_customers',
  JSON.stringify(savedCalls.map(function (c) { return c.o; })));
T('۲.۱ تعداد رکوردها ثابت ماند (S3: نه ایجاد، نه حذف)', savedCalls.length === 1 && savedCalls[0].arr.length === CURRENT.length, savedCalls.length ? savedCalls[0].arr.length : -1);
var o1 = (savedCalls.length ? savedCalls[0].arr : outArr).filter(function (x) { return x.cd === 'CUST-1'; })[0];
T('۲.۲ CUST-1 با merge فیلدهای بازیابی‌یافته ذخیره شد (people+coTels+con+ph، ind حفظ شد)',
  o1 && o1.people && o1.people.length === 1 && o1.coTels.length === 1 && o1.con === 'رضا' && o1.ph === '۰۲۱۳۳۳' && o1.ind === 'نفت');
T('۲.۳ CUST-3 دست‌نخورده رأی دوباره عبور S2 بود', savedCalls.length === 1 && JSON.stringify(savedCalls[0].arr.filter(function (x) { return x.cd === 'CUST-3'; })[0]) === JSON.stringify(CURRENT[2]));
T('۲.۴ CUST-4 (بدون منبع) بدون تغییر بیرون رفت', JSON.stringify(savedCalls[0].arr.filter(function (x) { return x.cd === 'CUST-4'; })[0]) === JSON.stringify(CURRENT[3]));
/* انتخاب‌بندی: اگر CUST-2 از چک‌باکس بیرون شود نباید نوشته شود */
savedCalls = [];
W2.ptfContactRecoverApply(CURRENT, plan1.plan, ['CUST-1']);
T('۲.۵ فقط تیک‌خورده‌ها ذخیره می‌شوند (CUST-2 بدون تیک دست‌نخورده)',
  JSON.stringify(savedCalls[0].arr.filter(function (x) { return x.cd === 'CUST-2'; })[0]) === JSON.stringify(CURRENT[1]));

head('۳. پارس پاسخ سرور + اسکن شبکه + گارد نقش');
T('۳.۰ parse: بدنهٔ خام بک‌آپ (data.ptf_crm_customers رشته)', W.ptfContactRecoverParse(JSON.stringify({ app: 'PTF-CRM', data: { ptf_crm_customers: JSON.stringify([{ cd: 'A' }]) } })).length === 1);
T('۳.۱ parse: آرایهٔ خام', W.ptfContactRecoverParse('[{"cd":"B"}]').length === 1);
T('۳.۲ parse: ورودی خراب → null (نه exception)', W.ptfContactRecoverParse('not-json') === null && W.ptfContactRecoverParse('{}') === null);

var fetchLog = [];
var fakeServer = {
  backups: [
    { name: 'hourly-latest.json.gz', t: '2026-09-08' },
    { name: 'daily-2026-09-01.json.gz', t: '2026-09-01' }
  ],
  files: { 'hourly-latest.json.gz': JSON.stringify({ data: { ptf_crm_customers: JSON.stringify(B_NEW.customers) } }), 'daily-2026-09-01.json.gz': JSON.stringify({ data: { ptf_crm_customers: JSON.stringify(B_OLD.customers) } }) }
};
var W3 = boot({
  role: 'admin',
  fetch: function (url) {
    fetchLog.push(url);
    if (url.indexOf('list_backups') > -1) return Promise.resolve({ json: function () { return Promise.resolve({ ok: true, backups: fakeServer.backups }); } });
    var m = /name=([^&]+)/.exec(url); var nm = m ? decodeURIComponent(m[1]) : '';
    return Promise.resolve({ text: function () { return Promise.resolve(fakeServer.files[nm] || '{"ok":false}'); } });
  }
});
W3.store['ptf_crm_customers'] = JSON.stringify(CURRENT);
var scanDone = W3.ptfContactRecoverScan(function () {}).then(function (res) {
  T('۳.۳ اسکن هر دو فایل را ترتیباً خواند (رفتار بدون توقف زودهنگام)', fetchLog.some(function (u) { return u.indexOf('list_backups') > -1; }) && fetchLog.filter(function (u) { return u.indexOf('get_backup') > -1; }).length === 2, JSON.stringify(fetchLog));
  T('۳.۴ نتیجهٔ اسکن شبکه = همان منطق خالص (CUST-1 چندمنبعی)', res.result.plan.some(function (x) { return x.cd === 'CUST-1' && x.src.coTels.indexOf('daily-') === 0; }), JSON.stringify(res.result.plan.map(function (x) { return x.cd; })));
  T('۳.۵ بک‌آپ‌های خوانده‌شده به ترتیب جدید→قدیم تجمیع شدند', res.backupsOrd.length === 2 && res.backupsOrd[0].name.indexOf('hourly') === 0);
});

var alerted4 = null;
var W4 = boot({ role: 'viewer', alert: function (m) { alerted4 = m; } });
W4.ptfOpenContactRecovery();
T('۳.۶ S5: نقش غیرمجاز → هشدار و بدون مونت مودال', !!alerted4 && /admin|ادمین|رییس/.test(alerted4), String(alerted4));

/* ───────────────────── ۴. مارکرهای UI/سیم‌کشی ثابت ───────────────────── */
head('۴. سیم‌کشی UI و مارکرهای امنیتی');
T('۴.۰ دکمهٔ بازیابی در پنل مشتریان (ستون ثبت/اکسل) نصب است',
  idx.indexOf('onclick="ptfOpenContactRecovery()"') > -1 && idx.indexOf('بازیابی تماس‌ها') > -1);
T('۴.۱ ماژول با ?v=34.38.11 در پوسته لینک شد', /restore-contacts\.js\?v=34\.38\.11/.test(idx));
T('۴.۲ سپر نقش S5 در ماژول است (admin/chairman فقط)', /ROLES_OK = \['admin', 'chairman'\]/.test(rc) && rc.indexOf("indexOf(curRole()) > -1") > -1);
T('۴.۳ لیست فیلدهای قفل‌شده فقط تماس است (S1)', /CONTACT_FIELDS = \['people', 'coTels', 'con', 'ph', 'coMail', 'coWeb', 'coAddr'\]/.test(rc));
T('۴.۴ مسیر ذخیره استاندارد با reason=offer-cust است', rc.indexOf("ptfEntitySaveCollection('ptf_crm_customers', out, { reason: SAVE_REASON") > -1 && /SAVE_REASON = 'offer-cust'/.test(rc));
T('۴.۵ audit بازیابی ثبت می‌شود (ردپای عملیات)', rc.indexOf("audit('بازیابی داده', '🛟 بازیابی خودکار تماس:") > -1);
T('۴.۶ get_backup/list_backups از crm.php استفاده می‌شوند (سپر gzip شفاف سرور)', rc.indexOf("action=list_backups") > -1 && rc.indexOf("action=get_backup&name=") > -1);
T('۴.۷ sw.js پیش‌کش ماژول را دارد (آفلاین‌محوری)', read('crm/sw.js').indexOf("./restore-contacts.js' + ASSET_QUERY") > -1);

/* ───────────────────── ۵. نسخه/گیت ───────────────────── */
head('۵. نسخه و گیت');
var ver = JSON.parse(read('VERSION.json'));
T('۵.۰ VERSION.json = v34.38.11', ver.crm_version === 'v34.38.11', ver.crm_version);
T('۵.۱ tester615 در run-ci-gate.js ثبت است', gate.indexOf('tester615-v34.38.8-contact-recovery-oneclick.js') > -1);
T('۵.۲ تسترهای رگرسیون تماس در گیت هستند',
  gate.indexOf('tester613-v34.38.6-ntf-lifecycle-and-findings.js') > -1 && gate.indexOf('tester614-v34.38.7-contact-ghost-cohorts.js') > -1);
T('۵.۳ قرارداد نسخه 34.38.11 (UI/sw/SD)',
  /window\.PTF_CRM_RELEASE = 'v34\.38\.11'/.test(idx) && /CACHE = 'ptf-crm-v34\.38\.11'/.test(read('crm/sw.js')) && /SD_SERVICE_VERSION = '34\.38\.11'/.test(read('api/sales-domain.php')));
T('۵.۴ ابزار CLI بازیابی در ریپو حاضر است (_tools/contact-recover.js)', fs.existsSync(path.join(ROOT, '_tools/contact-recover.js')));

scanDone.then(function () {
  console.log('\n— tester615 (CONTACT-RECOVERY-ONECLICK: بازیابی یک‌کلیکی چندمنبعی از بک‌آپ‌های سرور) —');
  console.log('PASS: ' + p + ' | FAIL: ' + f);
  process.exit(f ? 1 : 0);
}).catch(function (e) { console.error('FATAL', e); process.exit(2); });
