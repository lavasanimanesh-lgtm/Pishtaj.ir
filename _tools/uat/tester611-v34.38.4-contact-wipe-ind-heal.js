#!/usr/bin/env node
'use strict';
/* =============================================================================
   tester611-v34.38.4-contact-wipe-ind-heal.js
   گزارش کارفرما (پس از tester604): «حوزهٔ کاری مشتری هم پاک می‌شود.»

   ریشه (همان زنجیرهٔ CONTACT-WIPE، حلقهٔ ① — heal):
     یک cd غایب از خواندنِ کهنه در نویسندهٔ کل‌دفتر entity_delete واقعی می‌شد؛
     سپس ptfHealMissingCustomersFromRfqs مشتری را به‌صورت stub بازسازی می‌کرد ولی
     بدون ind (حوزهٔ کاری) — چون stub فقط co/con/ph داشت. نتیجه: «حوزهٔ کاری پاک شد».

   قرارداد قفل‌شده در v34.38.12:
     ① فهرست AUTO_NO_DELETE_REASONS با reasonهای کل‌دفترِ بدون قصد حذف تکمیل شد
        (lead-convert/ai-bizcard/ai-letterhead/ai-buyer/coen-fill + site-approve/
        site-merge/cheque-origin/supspec/supspec-migrate/supspec-learn) — cd غایب
        delete نمی‌شود، mergedKeep برمی‌گرداند.
     ② heal از درخواست، ind را از ca/category درخواست بازسازی می‌کند.
     ③ custmerge حذف عمدی است: در AUTO نیست و allowDeletes:true صریح شده.

   ضد رگرسیون: tester604 (زنجیرهٔ اصلی) باید سبز بماند و در گیت ثبت باشد.
   ============================================================================= */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function head(s) { console.log('\n── ' + s + ' ──'); }

var sd = read('crm/sales-domain-v2.js');
var off = read('crm/offers.js');
var cm = read('crm/custmerge.js');
var idx = read('crm/index.html');
var gate = read('_tools/uat/run-ci-gate.js');

/* ───────────────────── ۱) روتر: فهرست AUTO_NO_DELETE کامل ───────────────────── */
head('۱. روتر — reasonهای کل‌دفتر در AUTO_NO_DELETE');
var aR = sd.indexOf('window.ptfEntitySaveCollection = function');
var bR = sd.indexOf('window.ptfSalesCommandErrorIsAmbiguous', aR);
T('۱.۰ برش روتر پیدا شد', aR > -1 && bR > aR);
var routerSrc = sd.slice(aR, bR);

var NEW_REASONS = [
  'lead-convert', 'ai-bizcard', 'ai-letterhead', 'ai-buyer', 'coen-fill',
  'site-approve', 'site-merge', 'cheque-origin',
  'supspec', 'supspec-migrate', 'supspec-learn'
];
var OLD_REASONS = ['phonefmt', 'phonefmt-mig', 'rfq-cust-heal', 'offer-cust', 'offer-sup',
  'excel-import', 'excel-std', 'vendorlist', 'site-rfq', 'saveCust', 'saveSup'];
T('۱.۱ reasonهای جدید کل‌دفتر در فهرست AUTO هستند',
  NEW_REASONS.every(function (k) { return routerSrc.indexOf("'" + k + "'") > -1; }));
T('۱.۲ reasonهای قدیمی دست‌نخورده‌اند (ضد رگرسیون tester604)',
  OLD_REASONS.every(function (k) { return routerSrc.indexOf("'" + k + "'") > -1; }));

/* custmerge عمداً خارج از فهرست AUTO است */
(function () {
  var a0 = routerSrc.indexOf('var AUTO_NO_DELETE_REASONS');
  var a1 = routerSrc.indexOf('\n    };', a0);
  var listBlock = a0 > -1 && a1 > a0 ? routerSrc.slice(a0, a1) : '';
  T('۱.۳ custmerge در فهرست AUTO نیست (حذف ادغام عمدی است)',
    listBlock.indexOf("'custmerge'") === -1);
})();

function bootRouter() {
  var calls = { ups: [], dels: [], silent: [] };
  var ctx = {
    console: { warn: function () {}, error: function () {} },
    JSON: JSON, Array: Array, Object: Object, String: String, Date: Date, Number: Number,
    window: {
      PTF_ENTITY_CMD_ENABLED: { ptf_crm_customers: true },
      ptfEntityUpsert: function (c, r, o) { calls.ups.push(r && r.cd); if (o && o.cb) o.cb({ state: 'acked' }); },
      ptfEntityDelete: function (c, id, o) { calls.dels.push(id); if (o && o.cb) o.cb({ state: 'acked' }); },
      ptfSilentWrite: function (k, str) { calls.silent.push({ k: k, n: JSON.parse(str).length }); },
      ptfSyncAcknowledgeKeys: function () {}
    },
    setData: function () {}, getData: function () { return []; },
    audit: function () {}, ptfToast: function () {}
  };
  vm.createContext(ctx);
  vm.runInContext(routerSrc, ctx, { filename: 'router611.js' });
  return { save: ctx.window.ptfEntitySaveCollection, calls: calls, w: ctx.window };
}
function mk(n, pfx) {
  pfx = pfx || 'CUST-';
  var a = [];
  for (var i = 0; i < n; i++) a.push({ cd: pfx + (1000 + i), co: 'ش' + i, ind: 'نفت و گاز', people: [{ nm: 'رابط', mobs: [{ n: '0912' + i }] }] });
  return a;
}

/* lead-convert (مشتری) — همان امضای پاک‌شدن */
(function () {
  var h = bootRouter();
  var base = mk(3);
  var next = base.slice(0, 2);
  next[0].co = 'ویرایش‌شده';
  var r = h.save('ptf_crm_customers', next, { prevArr: base, reason: 'lead-convert' });
  T('۱.۴ reason=lead-convert و یک cd غایب → صفر حذف + بازگشت رکورد',
    r && r.deletes === 0 && h.calls.dels.length === 0 &&
    h.w._ptfEntityLastKnown.ptf_crm_customers.length === 3 &&
    h.w._ptfEntityLastKnown.ptf_crm_customers[2].cd === 'CUST-1002' &&
    h.w._ptfEntityLastKnown.ptf_crm_customers[2].ind === 'نفت و گاز',
    JSON.stringify(r) + ' dels=' + JSON.stringify(h.calls.dels));
})();

/* coen-fill — مسیر ناهمگام LLM (بیشترین فرصت کهنه‌شدن) */
(function () {
  var h = bootRouter();
  var base = mk(4);
  var r = h.save('ptf_crm_customers', base.slice(0, 1), { prevArr: base, reason: 'coen-fill' });
  T('۱.۵ reason=coen-fill ناقص → صفر حذف',
    r && r.deletes === 0 && h.calls.dels.length === 0 &&
    h.w._ptfEntityLastKnown.ptf_crm_customers.length === 4,
    JSON.stringify(r));
})();

/* supspec (تامین‌کننده) — همان سپر برای تامین‌کننده */
(function () {
  var h = bootRouter();
  var base = mk(3, 'SUP-');
  var r = h.save('ptf_crm_customers', base.slice(0, 2), { prevArr: base, reason: 'supspec' });
  T('۱.۶ reason=supspec ناقص → صفر حذف',
    r && r.deletes === 0 && h.calls.dels.length === 0,
    JSON.stringify(r));
})();

/* custmerge — حذف عمدی همچنان کار می‌کند (allowDeletes) */
(function () {
  var h = bootRouter();
  var base = mk(3);
  var r = h.save('ptf_crm_customers', base.slice(0, 2), { prevArr: base, reason: 'custmerge', allowDeletes: true });
  T('۱.۷ custmerge با allowDeletes:true همچنان ۱ حذف می‌کند',
    r && r.mode === 'commands' && r.deletes === 1 && h.calls.dels[0] === 'CUST-1002',
    JSON.stringify(r) + ' ' + JSON.stringify(h.calls.dels));
})();

/* ───────────────────── ۲) custmerge صریح‌سازی allowDeletes ───────────────────── */
head('۲. custmerge — نیت حذف صریح');
T('۲.۰ saveCollection مشتریان در custmerge با allowDeletes:true است',
  /ptfEntitySaveCollection\('ptf_crm_customers', custs, \{ reason: 'custmerge', allowDeletes: true \}\)/.test(cm) ||
  /reason: 'custmerge', allowDeletes: true/.test(cm));

/* ───────────────────── ۳) heal — بازسازی ind (حوزهٔ کاری) ───────────────────── */
head('۳. heal مشتری — ind از حوزهٔ درخواست بازسازی می‌شود');
var healA = off.indexOf('window.ptfHealMissingCustomersFromRfqs = function');
var healB = off.indexOf('// رندر جدید جدول');
T('۳.۰ برش heal پیدا شد', healA > -1 && healB > healA);
var healSrc = off.slice(healA, healB);

function runHeal(rfqs, custs, archive) {
  var saved = [];
  var ctx = {
    window: {
      ptfEntitySaveCollection: function (c, a, o) { saved.push({ c: c, n: (a || []).length, o: o, arr: a }); }
    },
    getData: function (k) {
      if (k === 'ptf_crm_customers') return custs;
      if (k === 'ptf_crm_rfqs') return rfqs;
      if (k === 'ptf_crm_deleted_archive') return archive || [];
      return [];
    },
    setData: function () {},
    dedupStamp: function (r) { return r; },
    audit: function () {}
  };
  vm.createContext(ctx);
  vm.runInContext(healSrc + '\nresult = window.ptfHealMissingCustomersFromRfqs();', ctx, { filename: 'heal611.js' });
  return { result: ctx.result, saved: saved, custs: custs };
}

(function () {
  var rfqs = [{ cd: 'RFQ-1', custCd: 'CUST-1001', co: 'شرکت الف', con: 'علی', ph: '02188000000', ca: 'پایپینگ', category: 'پایپینگ' }];
  var custs = [];
  var r = runHeal(rfqs, custs, []);
  var stub = custs.filter(function (c) { return c.cd === 'CUST-1001'; })[0];
  T('۳.۱ مشتری غایب heal می‌شود و ind از ca/category بازسازی می‌شود',
    r.result === 1 && stub && stub.ind === 'نفت و گاز',
    JSON.stringify(stub && stub.ind));
  T('۳.۲ heal با reason=rfq-cust-heal و allowDelete:false است',
    r.saved.length === 1 && r.saved[0].o.reason === 'rfq-cust-heal' && r.saved[0].o.allowDelete === false,
    JSON.stringify(r.saved[0] && r.saved[0].o));
  T('۳.۳ رابط/شماره هم مثل قبل حفظ می‌شود',
    stub && stub.people && stub.people.length === 1 && stub.people[0].nm === 'علی' && stub.people[0].mobs[0].n === '02188000000',
    JSON.stringify(stub && stub.people));
})();

(function () {
  var rfqs = [{ cd: 'RFQ-2', custCd: 'CUST-2001', co: 'شرکت ب', ca: 'پمپ و کمپرسور' }];
  var custs = [];
  var r = runHeal(rfqs, custs, []);
  var stub = custs.filter(function (c) { return c.cd === 'CUST-2001'; })[0];
  T('۳.۴ حوزهٔ خارج از نگاشت → ind=سایر (نه خالی)',
    r.result === 1 && stub && stub.ind === 'سایر', JSON.stringify(stub && stub.ind));
})();

(function () {
  var rfqs = [{ cd: 'RFQ-3', custCd: 'CUST-3001', co: 'شرکت ج', ca: 'برق' }];
  var custs = [];
  var r = runHeal(rfqs, custs, []);
  var stub = custs.filter(function (c) { return c.cd === 'CUST-3001'; })[0];
  T('۳.۵ درخواست داخلی (فقط ca) → نگاشت ind',
    r.result === 1 && stub && stub.ind === 'نفت و گاز', JSON.stringify(stub && stub.ind));
})();

(function () {
  var existing = { cd: 'CUST-4001', co: 'شرکت موجود', ind: 'پتروشیمی' };
  var rfqs = [{ cd: 'RFQ-4', custCd: 'CUST-4001', co: 'شرکت موجود', ca: 'شیرآلات' }];
  var custs = [existing];
  var r = runHeal(rfqs, custs, []);
  T('۳.۶ مشتری موجود heal نمی‌شود و ind آن دست نمی‌خورد',
    r.result === 0 && custs[0].ind === 'پتروشیمی', JSON.stringify(custs[0].ind));
})();

(function () {
  var rfqs = [{ cd: 'RFQ-5', custCd: 'CUST-5001', co: 'شرکت بازیافتی', ca: 'ابزار دقیق' }];
  var custs = [];
  var archive = [{ _id: 'RC-1', kind: 'recycle', collection: 'ptf_crm_customers', id: 'CUST-5001', cd: 'CUST-5001' }];
  var r = runHeal(rfqs, custs, archive);
  T('۳.۷ مشتری در صندوق بازیافت heal نمی‌شود',
    r.result === 0 && custs.length === 0, JSON.stringify(custs));
})();

/* ───────────────────── ۴) گیت / نسخه ───────────────────── */
head('۴. گیت و نسخه');
var ver = JSON.parse(read('VERSION.json'));
T('۴.۱ VERSION.json = v34.38.12', ver.crm_version === 'v34.38.12', ver.crm_version);
T('۴.۲ tester611 در run-ci-gate.js ثبت است',
  gate.indexOf('tester611-v34.38.4-contact-wipe-ind-heal.js') > -1);
T('۴.۳ tester604 (ضد رگرسیون) هنوز در گیت است',
  gate.indexOf('tester604-v34.37.7-contact-wipe.js') > -1);
T('۴.۴ قرارداد UI/sw = 34.38.12',
  /window\.PTF_CRM_RELEASE = 'v34\.38\.12'/.test(idx) &&
  /CACHE = 'ptf-crm-v34\.38\.12'/.test(read('crm/sw.js')));

console.log('\n— tester611 (CONTACT-WIPE-EXT: حوزهٔ کاری مشتری در heal/حذف کهنه حفظ می‌شود) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
