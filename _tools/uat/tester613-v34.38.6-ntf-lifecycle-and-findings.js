#!/usr/bin/env node
'use strict';
/* =============================================================================
   tester613-v34.38.6-ntf-lifecycle-and-findings.js
   اعمال همهٔ یافته‌های RCAهای قبلی (دستور کارفرما: «تمام اصلاحات را روی یافته‌ها انجام بده»):

   ① نوتیفیکیشن (ARENA-NOTIFICATIONS-RESURRECTION-RCA):
     - P1 پروندهٔ تسویه‌شده هشدار تحویل نمی‌گیرد: گارد sfStageOf>=11 در ptfSfDueState
       + ntfResolveByRef(r.cd) در sfArchive.
     - P2 کارت‌های بدون remCd (rfq-due/deal-due) هنگام بسته‌شدن منبع resolve می‌شوند
       (ntfResolveByDkey)؛ تعویق یادآور کارت قدیم را می‌بندد؛ حذف انبوه اعلان از مسیر
       فرمان تک‌رکوردی (رفع union-key MAX_OPS — حذف >۴۰ هم واقعاً حذف می‌کند).
   ② تماس (ARENA-CONTACT-WIPE-RCA R2/R3/R4):
     - migrateContacts با گارد truncation + reason contact-mig (در AUTO_NO_DELETE).
     - تبدیل حقوقی→حقیقی تماس‌های قبلی (coTels/people) را به phones منتقل می‌کند.
     - fallback هوک phonefmt از روتر با reason='phonefmt' می‌گذرد (نه setData خام).
   ③ هزینه (ARENA-OPEX-DOUBLE-COUNT گام ۰/۱/۲):
     - آشکارساز read-only ptfOpexSuspectedDuplicates + نمایش در کیفیت داده.
     - هشدار نرم ثبت دستی (گام ۱) و قالب تکراری (گام ۲).
   ============================================================================= */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function head(s) { console.log('\n── ' + s + ' ──'); }
function extract(src, anchor, opener, closer) {
  var i = src.indexOf(anchor);
  if (i < 0) return '';
  var j = src.indexOf(opener, i);
  if (j < 0) return '';
  var depth = 0;
  for (var k = j; k < src.length; k++) {
    if (src[k] === '{') depth++;
    else if (src[k] === '}') { depth--; if (depth === 0) { return src.slice(i, k + 1) + (closer || ''); } }
  }
  return '';
}
function run(expr, ctx) {
  vm.createContext(ctx);
  try { return vm.runInContext(expr, ctx, { filename: 't613.js' }); } catch (e) { return { __err: String(e && e.stack || e) }; }
}

var salesfiles = read('crm/salesfiles.js');
var bridge = read('crm/bridge.js');
var leads = read('crm/leads.js');
var rbac = read('crm/rbac.js');
var offers = read('crm/offers.js');
var sv2 = read('crm/sales-domain-v2.js');
var phonefmt = read('crm/phonefmt.js');
var opex = read('crm/opex.js');
var dq = read('crm/data-quality.js');
var idx = read('crm/index.html');
var gate = read('_tools/uat/run-ci-gate.js');

/* ───────────────────── ۱) پروندهٔ تسویه‌شده — هشدار تحویل خاموش ───────────────────── */
head('۱. پروندهٔ تسویه‌شده — هشدار تحویل تعهدی خاموش');
T('۱.۰ گارد sfStageOf>=11 در ptfSfDueState', salesfiles.indexOf('if (typeof sfStageOf === \'function\' && sfStageOf(r) >= 11) return null;') > -1);
T('۱.۱ sfArchive کارت‌های پرونده را resolve می‌کند (ntfResolveByRef(r.cd))', salesfiles.indexOf('window.ntfResolveByRef(r.cd)') > -1);

(function () {
  var fn = extract(salesfiles, 'window.ptfSfDueState = function', '= function', ';');
  var ctx = { window: {}, sfStageOf: function (r) { return r && r.stage; } };
  ctx.ptfSfDueState = null;
  run(fn + '\nwindow.ptfSfDueState = window.ptfSfDueState;', ctx);
  var due = ctx.window.ptfSfDueState;
  T('۱.۲ رفتاری: تسویه‌شده (مرحله ۱۱) با dueISO گذشته → null', due && due({ dueISO: '2020-01-01', st: 'open', stage: 11 }) === null);
  T('۱.۳ رفتاری: پروندهٔ باز (مرحله ۷) با dueISO گذشته → red', due && due({ dueISO: '2020-01-01', st: 'open', stage: 7 }) === 'red');
  T('۱.۴ رفتاری: بدون dueISO → null', due && due({ st: 'open', stage: 7 }) === null);
})();

/* ───────────────────── ۲) کارت‌های بدون remCd هنگام بسته‌شدن منبع resolve ───────────────────── */
head('۲. کارت‌های rfq-due / deal-due هنگام بسته‌شدن منبع بسته می‌شوند');
T('۲.۰ checkRfqDue در بسته‌شدن پنجره، ntfResolveByDkey(\'rfq-due-\'+cd) می‌زند', bridge.indexOf("window.ntfResolveByDkey('rfq-due-' + r.cd)") > -1);
T('۲.۱ checkDealDue در بسته‌شدن پنجره، ntfResolveByDkey(\'deal-due-\'+cd) می‌زند', bridge.indexOf("window.ntfResolveByDkey('deal-due-' + r.cd)") > -1);
T('۲.۲ remSnooze کارت قدیم یادآور را می‌بندد (ntfResolveByRef)', (function () {
  var i = leads.indexOf('function remSnooze');
  var j = leads.indexOf('function remDel', i);
  return leads.slice(i, j).indexOf('ntfResolveByRef') > -1;
})());

/* ───────────────────── ۳) حذف انبوه اعلان از مسیر فرمان تک‌رکوردی ───────────────────── */
head('۳. حذف اعلان‌ها — بدون fallback به union-key (MAX_OPS)');
T('۳.۰ ntfCommitRemoval helper هست و با ptfEntityDelete تک‌رکوردی حذف می‌کند',
  rbac.indexOf('function ntfCommitRemoval(notifs, kept)') > -1 &&
  rbac.indexOf("window.ptfEntityDelete('ptf_crm_notifs', cd, { reason: 'w2'") > -1);
T('۳.۱ ntfResolveByRef از ntfCommitRemoval استفاده می‌کند',
  (function () { var i = rbac.indexOf('window.ntfResolveByRef = function'); var j = rbac.indexOf('window.ntfResolveByDkey', i); return rbac.slice(i, j).indexOf('ntfCommitRemoval(notifs, kept)') > -1; })());
T('۳.۲ ntfResolveByDkey هست و با dkey حذف می‌کند', rbac.indexOf('window.ntfResolveByDkey = function (dkey)') > -1);
T('۳.۳ ptfPruneStaleNotifs هم از ntfCommitRemoval می‌گذرد', (function () { var i = rbac.indexOf('window.ptfPruneStaleNotifs'); var j = rbac.indexOf('function ntfCommitRemoval', i); return rbac.slice(i, j).indexOf('ntfCommitRemoval(notifs, kept)') > -1; })());

(function () {
  var fn = extract(rbac, 'window.ntfResolveByDkey = function', '= function', ';');
  var helper = extract(rbac, 'function ntfCommitRemoval(notifs, kept)', 'function ntfCommitRemoval', '');
  var deletes = [];
  var notifs = [];
  for (var i = 0; i < 60; i++) notifs.push({ cd: 'N' + i, dkey: i === 3 ? 'deal-due-X' : ('other-' + i) });
  var ctx = {
    window: {}, setData: function () {}, updateCartBadge: function () {}, updateInboxBadge: function () {},
    PTF_ENTITY_CMD_ENABLED: { 'ptf_crm_notifs': true },
    ptfEntityDelete: function (coll, cd) { deletes.push(cd); },
    ptfEntitySaveCollection: function () { throw new Error('must-not-use-collection-save'); },
    ptfSilentWrite: function () {},
    getData: function () { return notifs; }
  };
  ctx.window.PTF_ENTITY_CMD_ENABLED = ctx.PTF_ENTITY_CMD_ENABLED;
  ctx.window.ptfEntityDelete = ctx.ptfEntityDelete;
  ctx.window.ptfEntitySaveCollection = ctx.ptfEntitySaveCollection;
  ctx.window.ptfSilentWrite = ctx.ptfSilentWrite;
  run(helper + '\n' + fn + '\nwindow.ntfResolveByDkey = window.ntfResolveByDkey;', ctx);
  var r = ctx.window.ntfResolveByDkey('deal-due-X');
  T('۳.۴ رفتاری: resolve با dkey دقیقاً همان کارت را حذف می‌کند (۱ کارت)', r === 1 && deletes.length === 1 && deletes[0] === 'N3', JSON.stringify(deletes));
  /* حذف ۵۹ کارت با یک بار prune — نباید SaveCollection (union-key) صدا بخورد */
  var pruneFn = extract(rbac, 'window.ptfPruneStaleNotifs = function', '= function', ';');
  var ctx2 = {
    window: {}, setData: function () {}, updateCartBadge: function () {}, updateInboxBadge: function () {},
    PTF_ENTITY_CMD_ENABLED: { 'ptf_crm_notifs': true },
    ptfEntityDelete: function (coll, cd) { deletes.push(cd); },
    ptfEntitySaveCollection: function () { throw new Error('must-not-use-collection-save'); },
    ptfSilentWrite: function () {},
    getData: function () { return notifs.map(function (n) { return { cd: n.cd, kind: 'co_expiry' }; }); },
    ntfNeedsAction: function (n) { return false; }
  };
  ctx2.window.PTF_ENTITY_CMD_ENABLED = ctx2.PTF_ENTITY_CMD_ENABLED;
  ctx2.window.ptfEntityDelete = ctx2.ptfEntityDelete;
  ctx2.window.ptfEntitySaveCollection = ctx2.ptfEntitySaveCollection;
  ctx2.window.ptfSilentWrite = ctx2.ptfSilentWrite;
  run(helper + '\n' + pruneFn + '\nwindow.ptfPruneStaleNotifs = window.ptfPruneStaleNotifs;', ctx2);
  var before = deletes.length;
  var pruned = ctx2.window.ptfPruneStaleNotifs();
  T('۳.۵ رفتاری: prune حذف ۶۰ کارت را هم از مسیر فرمان تک‌رکوردی می‌برد (>۴۰ بدون legacyFallback)', pruned === 60 && (deletes.length - before) === 60, 'pruned=' + pruned + ' deletes=' + (deletes.length - before));
})();

/* ───────────────────── ۴) تماس — R2/R3/R4 ───────────────────── */
head('۴. تماس — R2 مهاجرت دفترچه / R3 تبدیل حقوقی→حقیقی / R4 هوک phonefmt');
T('۴.۰ migrateContacts گارد truncation دارد (_ptfEntityLastKnown)', (function () { var i = offers.indexOf('function migrateContacts'); var j = offers.indexOf('function primaryPerson', i); var s = offers.slice(i, j); return s.indexOf('_ptfEntityLastKnown') > -1 && s.indexOf('known.length > items.length') > -1; })());
T('۴.۱ migrateContacts با reason contact-mig از روتر می‌گذرد', offers.indexOf("{ reason: 'contact-mig' }") > -1);
T('۴.۲ contact-mig در AUTO_NO_DELETE_REASONS است', sv2.indexOf("'contact-mig': 1") > -1);
T('۴.۳ R4 (fallback هوک phonefmt) طبق قرارداد قفل tester604 دست‌نخورده می‌ماند (تک‌رکوردی ptfEntityUpsert)', (function () { var h0 = phonefmt.indexOf('function hookCust()'); var h1 = phonefmt.indexOf('function hookSup()'); var body = phonefmt.slice(h0, h1); return body.indexOf('ptfEntityUpsert') > -1 && body.indexOf('ptfEntitySaveCollection') === -1; })());

(function () {
  var fn = extract(offers, 'function ptfPreserveLegalContactsAsPhones', 'function ptfPreserveLegalContactsAsPhones', '');
  var ctx = { window: {} };
  run(fn + '\nwindow.ptfPreserveLegalContactsAsPhones = ptfPreserveLegalContactsAsPhones;', ctx);
  var merge = ctx.window.ptfPreserveLegalContactsAsPhones;
  T('۴.۴ رفتاری: تبدیل حقوقی→حقیقی، coTels/اشخاص قبلی به phones منتقل می‌شوند', merge && (function () {
    var oldRec = { coTels: [{ n: '02111111111', ext: '', lb: 'تلفنخانه' }, { n: '02122222222', ext: '', lb: 'فکس' }], people: [{ nm: 'رابط', tels: [{ n: '02133333333' }], mobs: [{ n: '09122222222' }] }] };
    var phones = merge(oldRec, [{ k: 'mob', n: '09122222222', lb: '' }]);
    return phones.length === 4; /* mob داپلیک 0912 یک‌بار + ۳ تلن جدید */
  })(), 'merge output');
  T('۴.۵ رفتاری: بدون رکورد قدیم، phones دست‌نخورده می‌ماند', merge && (function () {
    var phones = merge(null, [{ k: 'mob', n: '09120000000', lb: '' }]);
    return phones.length === 1 && phones[0].n === '09120000000';
  })());
})();

/* ───────────────────── ۵) هزینه — گام ۰/۱/۲ دوباره‌شماری ───────────────────── */
head('۵. هزینه — آشکارساز read-only و هشدارهای نرم');
T('۵.۰ ptfOpexSuspectedDuplicates read-only تعریف شده', opex.indexOf('window.ptfOpexSuspectedDuplicates = function (month)') > -1);
T('۵.۱ کیفیت داده ردیف مشکوک به دوباره‌شماری را نشان می‌دهد', dq.indexOf("add(q, 'opex-suspected-duplicate'") > -1);
T('۵.۲ هشدار نرم ثبت دستی (گام ۱) با confirm', opex.indexOf('clashRec && !confirm') > -1);
T('۵.۳ هشدار نرم قالب تکراری (گام ۲) — ساخت و ویرایش', opex.indexOf('opexTplDuplicateActive(tpl, list)') > -1 && opex.indexOf('dupEdit && !confirm') > -1);

(function () {
  var det = extract(opex, 'window.ptfOpexSuspectedDuplicates = function', '= function', ';');
  var dupTpl = extract(opex, 'function opexTplDuplicateActive(tpl, list)', 'function opexTplDuplicateActive', '');
  var opexRows = [
    { cd: 'R1', cat: 'حقوق و دستمزد', amt: 30000000, month: '1405/05', recurringKey: 'opex-template:TPL-1:1405/05' },
    { cd: 'R2', cat: 'حقوق و دستمزد', amt: 30000000, month: '1405/05', desc: 'حقوق حسابدار' },
    { cd: 'R3', cat: 'اجاره', amt: 50000000, month: '1405/05', recurringKey: 'opex-template:TPL-2:1405/05' }
  ];
  var settings = { opexTpl: [
    { id: 'TPL-1', cat: 'حقوق و دستمزد', amt: 30000000, desc: 'حقوق حسابدار' },
    { id: 'TPL-9', cat: 'حقوق و دستمزد', amt: 30000000, desc: 'حقوق حسابدار' }
  ] };
  var petty = [{ cd: 'P1', amt: 30000000, month: '1405/05', st: 'open' }];
  var ctx = {
    window: {},
    oAll: function () { return opexRows; },
    tpls: function () { return settings.opexTpl; },
    fmtT: function (v) { return String(v); },
    opexRowActive: function (x) { return !(x && (x.st === 'void' || x.voided)); },
    getData: function (k) { return k === 'ptf_crm_petty' ? petty : []; }
  };
  run(det + '\nwindow.ptfOpexSuspectedDuplicates = window.ptfOpexSuspectedDuplicates;', ctx);
  var res = ctx.window.ptfOpexSuspectedDuplicates();
  var kinds = (res || []).map(function (x) { return x.kind; });
  T('۵.۴ رفتاری: ردیف دستی+تکرارشوندهٔ هم‌مبلغ شناسایی می‌شود', kinds.indexOf('manual-vs-recurring') > -1);
  T('۵.۵ رفتاری: قالب تکراری (هم cat+amt+desc) شناسایی می‌شود', kinds.indexOf('duplicate-template') > -1);
  T('۵.۶ رفتاری: هزینه و تنخواه هم‌مبلغِ هم‌دوره (سیگنال نرم) شناسایی می‌شود', kinds.indexOf('opex-petty-twin') > -1);
  var ctx2 = { window: {} };
  run(dupTpl + '\nwindow.opexTplDuplicateActive = opexTplDuplicateActive;', ctx2);
  var dup = ctx2.window.opexTplDuplicateActive({ id: 'TPL-1', cat: 'حقوق و دستمزد', amt: 30000000, desc: 'حقوق حسابدار' }, settings.opexTpl);
  T('۵.۷ رفتاری: قالب تکراریِ فعالِ دیگر را برمی‌گرداند (خودش مستثنا)', dup && dup.id === 'TPL-9', JSON.stringify(dup));
})();

/* ───────────────────── ۶) گیت / نسخه ───────────────────── */
head('۶. گیت و نسخه');
var ver = JSON.parse(read('VERSION.json'));
T('۶.۱ VERSION.json = v34.38.14', ver.crm_version === 'v34.38.14', ver.crm_version);
T('۶.۲ tester613 در run-ci-gate.js ثبت است', gate.indexOf('tester613-v34.38.6-ntf-lifecycle-and-findings.js') > -1);
T('۶.۳ قرارداد UI/sw = 34.38.14',
  /window\.PTF_CRM_RELEASE = 'v34\.38\.14'/.test(idx) &&
  /CACHE = 'ptf-crm-v34\.38\.14'/.test(read('crm/sw.js')));
T('۶.۴ SD_SERVICE_VERSION = 34.38.14', /SD_SERVICE_VERSION = '34\.38\.14'/.test(read('api/sales-domain.php')));

console.log('\n— tester613 (NTF-LIFECYCLE + CONTACT-WIPE R2-R4 + OPEX-DUP-GUARD) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
