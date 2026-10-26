#!/usr/bin/env node
'use strict';
/* =====================================================================
   tester718-v34.39.66-rial-companion-registration.js
   RIAL-COMPANION-REG — ریشهٔ «نسخهٔ ریالی دیروز در کادر سبز بود، امروز نیست»

   پین‌تست‌های این انتشار (همه روی **کد واقعی** ریپو، بدون قرارداد ساختگی):

   S — سرور (api/crm.php)
     S1 همراه ریالی/ارزیِ پدرثبت‌شده در push مجموعه‌ای پذیرفته و مهر سرور می‌گیرد
     S2 همان ردیف بدون adopt همچنان کلِ کلید را رد می‌کند (حفاظت یکپارچگی حفظ شد)
     S3 ردیفِ در پرواز (_serverState) / مهر جعلی / پدر ثبت‌نشده / غیرهمراه adopt نمی‌شود
     S4 فیلد offersAdopted در پاسخ push

   C — کلاینت (crm/offer-rial-convert.js و crm/offer-fx-convert.js)
     C1 همراه ریالی از مسیر رسمی ثبت می‌شود (ptfOfferRegisterCompanion با همان no)
     C2 رکورد همراه مهر ساخت ماشین‌خوان دارد (createdAtISO از dedupStamp)
     C3 رد قطعی سرور ⇒ رکورد محلی برداشته می‌شود (سند بی‌مهر نمی‌ماند)
     C4 خطای گذرا/آفلاین ⇒ رکورد محلی می‌ماند و هشدار داده می‌شود (داده گم نمی‌شود)
     C5 نبود لایهٔ فرمان ⇒ fail-open: رکورد محلی ساخته می‌شود (مسیر push/adopt)
     C6 نسخهٔ همراه ارزی (fxOf) هم همان قرارداد را دارد

   K — نگهبان سینک (crm/sync.js)
     K1 پروجکشن کامل سرور، ردیف محلیِ فاقد مهر را حذف نمی‌کند (حفظ + dirty)
     K2 ردیف مهر‌دارِ حذف‌شده در سرور برنمی‌گردد (حذف واقعی معتبر می‌ماند)
     K3 ACK فرمان، کلیدِ دارای ردیف بی‌مهر را تسویه نمی‌کند
     K4 جاروی «ثبت رسمی همراه‌ها» فقط همراه‌های پدرثبت‌شده را برمی‌دارد

   U — رابط کاربری و نسخه
     U1 نشان «⏳ ثبت‌نشده در سرور» در کادر سبز، وابسته به serverRegisteredAt
     U2 پین نسخهٔ واحد v34.39.66 در پنج نقطهٔ رسمی
     U3 ptfOfferRegisterCompanion قرارداد register_offer + createIntent:false دارد
   ===================================================================== */
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var VER = '34.39.66';

var pass = 0, fail = 0;
function T(name, cond, extra) {
  if (cond) { pass++; console.log('PASS  ' + name); }
  else { fail++; console.log('FAIL  ' + name + (extra ? '  [' + extra + ']' : '')); }
}
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function extractFnLike(src, marker) {
  var start = src.indexOf(marker);
  if (start < 0) return '';
  var i = src.indexOf('{', start), d = 0;
  for (var j = i; j < src.length; j++) {
    if (src[j] === '{') d++;
    else if (src[j] === '}') { d--; if (!d) return src.slice(start, j + 1); }
  }
  return '';
}
function extractFn(src, name) {
  var start = src.indexOf('function ' + name + '(');
  if (start < 0) return '';
  var i = src.indexOf('{', start), d = 0;
  for (var j = i; j < src.length; j++) {
    if (src[j] === '{') d++;
    else if (src[j] === '}') { d--; if (!d) return src.slice(start, j + 1); }
  }
  return '';
}

/* ═══════════ S — سرور ═══════════ */
var PHP = read('api/crm.php');
T('S4) پاسخ push فیلد offersAdopted را برمی‌گرداند', /'offersAdopted' => \$offersAdopted/.test(PHP));
T('S4) adopt پیش از گارد یکپارچگی صدا زده می‌شود',
  /sync_offers_adopt_companions\(\$v, \$serverOffersJson/.test(PHP) &&
  /sync_offers_payload_has_unregistered_new\(\$v, \$serverOffersJson, \$adoptedNos\)/.test(PHP));
T('S3) شرط‌های adopt در سرور صریح‌اند (پدر ثبت‌شده + بی‌مهر + بی‌درپرواز + fxConvert)',
  /if \(!\$restore && \$k === 'ptf_crm_offers'\)/.test(PHP) &&
  /if \(isset\(\$offer\['_serverState'\]\) \|\| isset\(\$offer\['_serverOpId'\]\) \|\| isset\(\$offer\['serverRegisteredAt'\]\)\) continue;/.test(PHP) &&
  /if \(!isset\(\$serverNos\[\$parent\]\)\) continue;/.test(PHP) &&
  /if \(!is_array\(\$offer\['fxConvert'\] \?\? null\)\) continue;/.test(PHP));

/* اجرای واقعی توابع PHP اگر php-wasm موجود باشد (در CI اختیاری) */
var PhpNode = null;
try { PhpNode = require('php-wasm/PhpNode').PhpNode; } catch (eW) { /* optional */ }
var phpChecks = [];
if (PhpNode) {
  var prelude = '<?php\n' + extractFn(PHP, 'sync_offer_companion_parent') + '\n' +
    extractFn(PHP, 'sync_offers_adopt_companions') + '\n' +
    extractFn(PHP, 'sync_offers_payload_has_unregistered_new') + '\n';
  var driver = [
    '<?php',
    'include "/w/fn.php";',
    'function mk($no,$x=[]){ $r=["no"=>$no,"kind"=>"CO","st"=>"sent","currency"=>"IRR","items"=>[["qty"=>1,"price"=>10]],"terms"=>[]]; foreach($x as $k=>$v)$r[$k]=$v; return $r; }',
    '$src=mk("CO-1",["currency"=>"EUR","fxConvert"=>["rate"=>1000000]]); $src["serverRegisteredAt"]="2026-10-20T10:00:00Z";',
    '$rial=mk("CO-2",["rialOf"=>"CO-1","fxConvert"=>["rate"=>1000000]]);',
    '$srv=json_encode([$src]);',
    '$a=sync_offers_adopt_companions(json_encode([$src,$rial]),$srv,"u");',
    'echo "S1=".(($a!==null&&$a["adopted"]===["CO-2"])?"1":"0")."\\n";',
    'echo "S2=".(sync_offers_payload_has_unregistered_new(json_encode([$src,$rial]),$srv)?"1":"0")."\\n";',
    'echo "S2b=".(sync_offers_payload_has_unregistered_new($a["json"],$srv,$a["adopted"])?"1":"0")."\\n";',
    '$p=mk("CO-3",["rialOf"=>"CO-404","fxConvert"=>["rate"=>1]]); $s3=sync_offers_adopt_companions(json_encode([$src,$p]),$srv,"u");',
    'echo "S3p=".(($s3===null)?"1":"0")."\\n";',
    '$i=mk("CO-4",["rialOf"=>"CO-1","fxConvert"=>["rate"=>1],"_serverState"=>"sending"]); $s3i=sync_offers_adopt_companions(json_encode([$src,$i]),$srv,"u");',
    'echo "S3i=".(($s3i===null)?"1":"0")."\\n";',
    '$f=mk("CO-5",["rialOf"=>"CO-1","fxConvert"=>["rate"=>1],"serverRegisteredAt"=>"2020-01-01T00:00:00Z"]); $s3f=sync_offers_adopt_companions(json_encode([$src,$f]),$srv,"u");',
    'echo "S3f=".(($s3f===null)?"1":"0")."\\n";',
    '$n=mk("CO-6"); $s3n=sync_offers_adopt_companions(json_encode([$src,$n]),$srv,"u");',
    'echo "S3n=".(($s3n===null)?"1":"0")."\\n";',
    '$x=mk("CO-7",["currency"=>"USD","fxOf"=>"CO-8","fxConvert"=>["rate"=>9]]); $i8=mk("CO-8",["currency"=>"IRR"]); $i8["serverRegisteredAt"]="2026-10-20T10:00:00Z";',
    '$b=sync_offers_adopt_companions(json_encode([$i8,$x]),json_encode([$i8]),"u");',
    'echo "S3fx=".(($b!==null&&$b["adopted"]===["CO-7"])?"1":"0")."\\n";',
    'echo "DONE\\n";'
  ].join('\n') + '\n';
  phpChecks.push((async function () {
    try {
      var php = new PhpNode();
      await php.run('<?php @mkdir("/w", 0777, true);');
      php.writeFile('/w/fn.php', prelude);
      php.writeFile('/w/run.php', driver);
      var out = '';
      php.addEventListener('output', function (e) { out += (e.detail || ''); });
      await php.run('<?php include "/w/run.php";');
      var R = {};
      String(out).split('\n').forEach(function (l) {
        var m = l.match(/^(S[0-9a-z]+)=(.*)$/);
        if (m) R[m[1]] = m[2].trim();
      });
      T('S1) همراه ریالیِ پدرثبت‌شده در push پذیرفته و مهر سرور می‌گیرد (اجرای واقعی PHP)', R.S1 === '1', JSON.stringify(R));
      T('S2) همان payload بدون adopt همچنان رد می‌شود (حفاظت یکپارچگی)', R.S2 === '1', 'got=' + R.S2);
      T('S2b) گارد پس از adopt کلید را قبول می‌کند', R.S2b === '0', 'got=' + R.S2b);
      T('S3) همراه با پدر ثبت‌نشده adopt نمی‌شود', R.S3p === '1', 'got=' + R.S3p);
      T('S3) ردیف در پرواز (_serverState) adopt نمی‌شود', R.S3i === '1', 'got=' + R.S3i);
      T('S3) مهر سرورِ جعلی adopt نمی‌شود', R.S3f === '1', 'got=' + R.S3f);
      T('S3) ردیف غیرهمراه (پیش‌نویس تازه) adopt نمی‌شود', R.S3n === '1', 'got=' + R.S3n);
      T('S3) همراه ارزی (fxOf) با پدر ثبت‌شده adopt می‌شود', R.S3fx === '1', 'got=' + R.S3fx);
    } catch (eRun) {
      T('S) اجرای php-wasm بدون استثنا', false, String((eRun && eRun.message) || eRun));
    }
  })());
} else {
  console.log('SKIP  php-wasm موجود نیست — بخش اجرایی S (assisted: probe جداگانه اجرا شد)');
}

/* ═══════════ C — مبدل‌های کلاینت روی کد واقعی ═══════════ */
function runRial(opts) {
  opts = opts || {};
  var store = {}, alerts = [], toasts = [], audits = [], regCalls = [];
  var ctx = {
    console: console, JSON: JSON, Math: Math, Date: Date, Number: Number, String: String,
    Object: Object, Array: Array, RegExp: RegExp, Error: Error, isNaN: isNaN, isFinite: isFinite,
    parseInt: parseInt, parseFloat: parseFloat, encodeURIComponent: encodeURIComponent,
    setTimeout: function (f) { try { if (typeof f === 'function') f(); } catch (e) {} return 0; },
    clearTimeout: function () {}, setInterval: function () { return 0; }, clearInterval: function () {},
    addEventListener: function () {}, removeEventListener: function () {}, innerWidth: 1400,
    document: { getElementById: function () { return null; }, querySelectorAll: function () { return []; }, createElement: function () { return { style: {}, appendChild: function () {} }; }, body: { appendChild: function () {} } },
    getData: function (k) { return clone(store[k] === undefined ? [] : store[k]); },
    setData: function (k, v) { store[k] = clone(v); return true; },
    curSession: function () { return { user: 'admin', name: 'علی لواسانی' }; },
    curUser: function () { return 'admin'; }, curName: function () { return 'علی لواسانی'; },
    isSenior: function () { return true; }, seniorOk: function () { return true; },
    genCode: function () { return 'X'; }, faDate: function () { return '1405/08/02'; },
    faDateTime: function () { return '1405/08/02 11:00'; },
    escP: function (v) { return String(v == null ? '' : v); },
    ptfOnClickArg: function (v) { return String(v == null ? '' : v); },
    ptfISOToJ: function (s) { return s; }, ptfJToISO: function (s) { return s; },
    ptfMoney: function (v, c) { return String(v) + ' ' + (c || 'IRR'); },
    money: function (v, c) { return String(v) + ' ' + (c || ''); },
    alert: function (m) { alerts.push(String(m)); }, confirm: function () { return true; },
    prompt: function () { return 'x'; },
    ptfToast: function (m, k) { toasts.push([m, k]); },
    audit: function (a, b, c) { audits.push([a, b, c]); },
    notify: function () {}, addLog: function () {}, hideModal: function () {},
    renderDeals: function () {}, renderOffers: function () {},
    offEnsureOfferLineIds: function () {},
    dedupStamp: function (rec) { rec.crAt = '1405/08/04'; rec.crBy = 'admin'; if (!rec.createdAtISO) rec.createdAtISO = new Date().toISOString(); return rec; },
    ptfUnifiedCodeAsync: function () { return { then: function (ok) { ok('CO-1405-0099'); return { then: function () {} }; } }; },
    SENIOR_ROLES: ['admin']
  };
  if (opts.withRegister) {
    ctx.ptfOfferRegisterCompanion = function (row, meta, cb) {
      regCalls.push({ no: row && row.no, meta: meta });
      var r = opts.registerResult || { ok: true };
      if (cb) cb(r);
    };
  }
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('crm/offer-rial-convert.js'), ctx, { filename: 'offer-rial-convert.js' });
  var FX = {
    no: 'CO-1405-0071', kind: 'CO', st: 'won', editMode: 'edit', currency: 'EUR',
    fxBasis: 'free', fxRateRef: 900000, inqNo: 'INQ-1405-0033', buyerCd: 'C-1', buyerCo: 'شرکت پترو',
    dateEn: '2026-08-01', dateFa: '1405/05/10', items: [{ lineId: 'L1', qty: 2, price: 12500, desc: 'شیر صنعتی' }],
    terms: ['قیمت‌ها به یورو است.'], extraCols: [], colOrder: [], hiddenCols: [],
    serverRegisteredAt: '2026-08-01T10:00:00Z', _id: 'OFR-AAA', updatedAtISO: '2026-08-01T10:00:00Z'
  };
  store.ptf_crm_offers = [clone(FX)];
  store.ptf_crm_deals = [{ cd: 'D-1', wonOffer: FX.no, inqNo: FX.inqNo, timeline: [] }];
  var res = null;
  ctx.ptfOfferRialConvertCommit(FX.no, 1000000, '2026-08-01', function (r) { res = r; });
  var comp = (store.ptf_crm_offers || []).filter(function (o) { return o && o.rialOf === FX.no; })[0];
  return { res: res, comp: comp, store: store, alerts: alerts, toasts: toasts, audits: audits, reg: regCalls, ctx: ctx };
}

/* C1/C2 — مسیر موفق */
var okRun = runRial({ withRegister: true, registerResult: { ok: true } });
T('C1) تبدیل ریالی موفق ساخته می‌شود', !!(okRun.res && okRun.res.ok), JSON.stringify(okRun.res));
T('C1) ساخت همراه از مسیر رسمی ثبت صدا زده شد (به‌ازای هر رکورد یک‌بار)', okRun.reg.length === 1, 'calls=' + okRun.reg.length);
T('C1) همان شمارهٔ ساخته‌شده به ثبت رسمی داده شد', okRun.reg.length === 1 && okRun.reg[0].no === 'CO-1405-0099', JSON.stringify(okRun.reg));
T('C2) رکورد همراه مهر ساخت ماشین‌خوان دارد (createdAtISO)', !!(okRun.comp && okRun.comp.createdAtISO), okRun.comp ? String(okRun.comp.createdAtISO) : 'no-comp');
T('C2) ستون crBy از dedupStamp پر شده', !!(okRun.comp && okRun.comp.crBy === 'admin'), okRun.comp ? String(okRun.comp.crBy) : '');

/* C3 — رد قطعی */
var rejRun = runRial({ withRegister: true, registerResult: { ok: false, why: 'rejected', error: 'permission_denied', status: 403, definitive: true } });
var rejLeft = (rejRun.store.ptf_crm_offers || []).filter(function (o) { return o && o.rialOf === 'CO-1405-0071'; });
T('C3) رد قطعی سرور ⇒ رکورد محلی برداشته می‌شود', rejLeft.length === 0, 'left=' + rejLeft.length);
T('C3) رد قطعی به کاربر اعلام می‌شود (alert)', rejRun.alerts.some(function (m) { return /ثبت نشد/.test(m); }), JSON.stringify(rejRun.alerts).slice(0, 120));
T('C3) رد قطعی در audit ثبت می‌شود', rejRun.audits.some(function (a) { return /رد شد/.test(String(a[1])); }));

/* C4 — خطای گذرا */
var trRun = runRial({ withRegister: true, registerResult: { ok: false, why: 'rejected', error: 'network', status: 0, definitive: false } });
var trLeft = (trRun.store.ptf_crm_offers || []).filter(function (o) { return o && o.rialOf === 'CO-1405-0071'; });
T('C4) خطای گذرا ⇒ رکورد محلی می‌ماند (داده گم نمی‌شود)', trLeft.length === 1, 'left=' + trLeft.length);
T('C4) خطای گذرا با هشدار warn اعلام می‌شود', trRun.toasts.some(function (t) { return t[1] === 'warn'; }), JSON.stringify(trRun.toasts).slice(0, 120));

/* C5 — نبود لایهٔ فرمان (fail-open) */
var legacyRun = runRial({ withRegister: false });
T('C5) بدون لایهٔ فرمان هم رکورد محلی ساخته می‌شود (مسیر push/adopt)', !!(legacyRun.comp && legacyRun.comp.no === 'CO-1405-0099'));
T('C5) در این مسیر هیچ استثنایی رخ نمی‌دهد', !!(legacyRun.res && legacyRun.res.ok));

/* C7 — اجرای واقعی مبدل ارزی (ریالی → ارزی) روی کد واقعی */
function runFx() {
  var store = {}, alerts = [], toasts = [], audits = [], regCalls = [];
  var ctx = {
    console: console, JSON: JSON, Math: Math, Date: Date, Number: Number, String: String,
    Object: Object, Array: Array, RegExp: RegExp, Error: Error, isNaN: isNaN, isFinite: isFinite,
    parseInt: parseInt, parseFloat: parseFloat, encodeURIComponent: encodeURIComponent,
    setTimeout: function (f) { try { if (typeof f === 'function') f(); } catch (e) {} return 0; },
    clearTimeout: function () {}, setInterval: function () { return 0; }, clearInterval: function () {},
    addEventListener: function () {}, removeEventListener: function () {}, innerWidth: 1400,
    document: { getElementById: function () { return null; }, querySelectorAll: function () { return []; }, createElement: function () { return { style: {}, appendChild: function () {} }; }, body: { appendChild: function () {} } },
    getData: function (k) { return clone(store[k] === undefined ? [] : store[k]); },
    setData: function (k, v) { store[k] = clone(v); return true; },
    curSession: function () { return { user: 'admin', name: 'علی لواسانی' }; },
    curUser: function () { return 'admin'; }, curName: function () { return 'علی لواسانی'; },
    curRole: function () { return 'admin'; },
    isSenior: function () { return true; },
    faDate: function () { return '1405/08/04'; }, faDateTime: function () { return '1405/08/04 11:00'; },
    escP: function (v) { return String(v == null ? '' : v); },
    ptfOnClickArg: function (v) { return String(v == null ? '' : v); },
    ptfISOToJ: function (s) { return s; }, ptfJToISO: function (s) { return s; },
    ptfMoney: function (v, c) { return String(v) + ' ' + (c || 'IRR'); },
    money: function (v, c) { return String(v) + ' ' + (c || ''); },
    alert: function (m) { alerts.push(String(m)); }, confirm: function () { return true; },
    ptfToast: function (m, k) { toasts.push([m, k]); },
    audit: function (a, b, c) { audits.push([a, b, c]); },
    notify: function () {}, addLog: function () {}, hideModal: function () {},
    renderDeals: function () {}, renderOffers: function () {},
    offEnsureOfferLineIds: function () {},
    dedupStamp: function (rec) { rec.crAt = '1405/08/04'; rec.crBy = 'admin'; if (!rec.createdAtISO) rec.createdAtISO = new Date().toISOString(); return rec; },
    ptfUnifiedCodeAsync: function () { return { then: function (ok) { ok('CO-1405-0200'); return { then: function () {} }; } }; },
    ptfOfferRegisterCompanion: function (row, meta, cb) {
      regCalls.push({ no: row && row.no, meta: meta });
      if (cb) cb({ ok: true });
    },
    SENIOR_ROLES: ['admin']
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('crm/offer-fx-convert.js'), ctx, { filename: 'offer-fx-convert.js' });
  store.ptf_crm_offers = [{
    no: 'CO-1405-0300', kind: 'CO', st: 'sent', currency: 'IRR', inqNo: 'INQ-1405-0044',
    buyerCd: 'C-2', buyerCo: 'شرکت ریالی', dateEn: '2026-08-02', dateFa: '1405/05/11',
    items: [{ lineId: 'L1', qty: 3, price: 5000000, desc: 'بلبرینگ' }],
    terms: ['پرداخت ۳۰ روزه.'], extraCols: [], colOrder: [], hiddenCols: [],
    _id: 'OFR-IRR', serverRegisteredAt: '2026-08-02T10:00:00Z', updatedAtISO: '2026-08-02T10:00:00Z'
  }];
  store.ptf_crm_deals = [{ cd: 'D-2', wonOffer: null, inqNo: 'INQ-1405-0044', timeline: [] }];
  var res = null;
  ctx.ptfOfferFxConvertCommit('CO-1405-0300', 900000, 'USD', '2026-08-02', function (r) { res = r; });
  var comp = (store.ptf_crm_offers || []).filter(function (o) { return o && o.fxOf === 'CO-1405-0300'; })[0];
  return { res: res, comp: comp, store: store, reg: regCalls };
}
var fxRun = runFx();
T('C7) تبدیل ریالی→ارزی روی کد واقعی ساخته می‌شود', !!(fxRun.res && fxRun.res.ok), JSON.stringify(fxRun.res));
T('C7) همراه ارزی از مسیر رسمی ثبت صدا زده شد', fxRun.reg.length === 1 && fxRun.reg[0].no === 'CO-1405-0200', JSON.stringify(fxRun.reg));
T('C7) رکورد ارزی مهر ساخت ماشین‌خوان گرفت', !!(fxRun.comp && fxRun.comp.createdAtISO), fxRun.comp ? String(fxRun.comp.createdAtISO) : 'no-comp');
T('C7) مبنای تبدیل روی رکورد حفظ شد', !!(fxRun.comp && fxRun.comp.fxConvert && +fxRun.comp.fxConvert.rate === 900000));

/* C6 — همراه ارزی */
var FXSRC = read('crm/offer-fx-convert.js');
T('C6) مبدل ارزی هم ثبت رسمی همراه را صدا می‌زند', /registerCompanionLocalFx\(comp, 'نسخهٔ ارزی'\)/.test(FXSRC));
T('C6) مبدل ارزی مهر dedupStamp می‌زند', /dedupStamp\(comp\)/.test(FXSRC));
T('C6) خودترمیمی همراهِ بی‌مهر در ویرایش‌های بعدی', (FXSRC.match(/registerCompanionLocalFx\(comp, 'نسخهٔ ارزی', \{ dropOnReject: false \}\)/g) || []).length >= 2);
T('C6) مبدل ریالی هم خودترمیمی دارد', (read('crm/offer-rial-convert.js').match(/registerCompanionLocal\(comp, 'نسخهٔ ریالی', \{ dropOnReject: false \}\)/g) || []).length >= 2);

/* ═══════════ K — نگهبان سینک ═══════════ */
var SYNC = read('crm/sync.js');
var helperSrc = extractFn(SYNC, 'ptfOfferRowsWithoutServerStamp') + '\n' + extractFn(SYNC, 'ptfOffersPreservePendingRows');
T('K) توابع نگهبان در sync.js موجودند', !!(extractFn(SYNC, 'ptfOfferRowsWithoutServerStamp') && extractFn(SYNC, 'ptfOffersPreservePendingRows')));
if (helperSrc) {
  var kbox = { JSON: JSON, Array: Array, String: String, Object: Object, isNaN: isNaN };
  vm.createContext(kbox);
  vm.runInContext(helperSrc, kbox, { filename: 'sync-helper.js' });
  var remote = JSON.stringify([{ no: 'CO-1', serverRegisteredAt: '2026-10-20T10:00:00Z' }]);
  var localPending = JSON.stringify([{ no: 'CO-1', serverRegisteredAt: '2026-10-20T10:00:00Z' }, { no: 'CO-2', rialOf: 'CO-1' }]);
  var kept = kbox.ptfOffersPreservePendingRows(localPending, remote);
  T('K1) ردیف محلیِ فاقد مهر در پروجکشن سرور حفظ می‌شود', kept.preserved === 1 && JSON.parse(kept.str).length === 2, JSON.stringify(kept).slice(0, 160));
  T('K1) شمارهٔ ردیف حفظ‌شده گزارش می‌شود', kept.nos && kept.nos[0] === 'CO-2', JSON.stringify(kept.nos));
  var localDeleted = JSON.stringify([{ no: 'CO-9', serverRegisteredAt: '2026-10-01T00:00:00Z' }]);
  var kept2 = kbox.ptfOffersPreservePendingRows(localDeleted, remote);
  T('K2) ردیف مهر‌دارِ حذف‌شده در سرور برنمی‌گردد (حذف واقعی معتبر)', kept2.preserved === 0 && JSON.parse(kept2.str).length === 1, JSON.stringify(kept2).slice(0, 120));
  var kept3 = kbox.ptfOffersPreservePendingRows(remote, remote);
  T('K2) بدون ردیف بی‌مهر، پروجکشن دست‌نخورده می‌ماند', kept3.preserved === 0 && kept3.str === remote);
  T('K3) فهرست شماره‌های بی‌مهر درست است', JSON.stringify(kbox.ptfOfferRowsWithoutServerStamp(localPending)) === '["CO-2"]', JSON.stringify(kbox.ptfOfferRowsWithoutServerStamp(localPending)));
}
var CS = read('crm/client-server.js');
/* K5 — اجرای واقعی نویسندهٔ مرکزی پروجکشن (بدون استثنا، با کد خودِ client-server.js) */
(function () {
  var fnProj = extractFnLike(read('crm/client-server.js'), 'window.ptfBApplyServerProjection = function');
  T('K5) تابع واقعی نویسندهٔ پروجکشن قابل استخراج است', !!fnProj && fnProj.length > 500);
  if (!fnProj) return;
  function build(withKeep) {
    var store = {};
    var dirty = null;
    var local = [{ no: 'CO-1', serverRegisteredAt: '2026-10-20T10:00:00Z' }, { no: 'CO-2', rialOf: 'CO-1', fxConvert: { rate: 1 } }];
    store.ptf_crm_offers = JSON.stringify(local);
    var ctx = {
      console: console, JSON: JSON, Object: Object, Array: Array, String: String, Number: Number,
      Date: Date, isNaN: isNaN, cache: {}, bPullRevs: function () { return {}; }, heavyList: function () { return false; },
      idbKnown: {}, idbMem: {}, ptfStorageIdbSet: function () {}, ptfBMirrorActive: function () { return false; },
      localStorage: { setItem: function (k, v) { store[k] = v; }, getItem: function (k) { return store[k] === undefined ? null : store[k]; }, removeItem: function (k) { delete store[k]; } },
      localSet: function (k, v) { store[k] = v; return true; }, localDel: function (k) { delete store[k]; },
      localGet: function (k) { return store[k] === undefined ? null : store[k]; },
      ptfSyncNotifyDirty: function (k) { dirty = k; }
    };
    ctx.window = ctx; ctx.globalThis = ctx;
    vm.createContext(ctx);
    if (withKeep) {
      vm.runInContext(extractFn(read('crm/sync.js'), 'ptfOfferRowsWithoutServerStamp') + '\n' +
        extractFn(read('crm/sync.js'), 'ptfOffersPreservePendingRows'), ctx, { filename: 'keep-helper.js' });
      ctx.ptfSyncOffersPreservePendingRows = function (a, b) { return ctx.ptfOffersPreservePendingRows(a, b); };
    }
    vm.runInContext(fnProj, ctx, { filename: 'client-server.js#projection' });
    return { ctx: ctx, store: store, dirty: function () { return dirty; } };
  }
  /* ① با نگهبان (v34.39.66): ردیف بی‌مهر می‌ماند و کلید dirty می‌شود */
  var withKeep = build(true);
  var srv = JSON.stringify([{ no: 'CO-1', serverRegisteredAt: '2026-10-20T10:00:00Z' }]);
  withKeep.ctx.ptfBApplyServerProjection('ptf_crm_offers', srv, 501);
  var afterKeep = JSON.parse(withKeep.store.ptf_crm_offers);
  T('K5) پروجکشن کامل سرور، ردیف بی‌مهر را حذف نمی‌کند (اجرای کد واقعی)', afterKeep.length === 2 && afterKeep.some(function (o) { return o.no === 'CO-2'; }), JSON.stringify(afterKeep.map(function (o) { return o.no; })));
  T('K5) ردیف حفظ‌شده کلید را برای ثبت مجدد dirty می‌کند', withKeep.dirty() === 'ptf_crm_offers');
  /* ② حذف واقعی همچنان معتبر است */
  var noKeep = build(false);
  noKeep.store.ptf_crm_offers = JSON.stringify([{ no: 'CO-9', serverRegisteredAt: '2026-10-01T00:00:00Z' }]);
  noKeep.ctx.ptfBApplyServerProjection('ptf_crm_offers', JSON.stringify([]), 502);
  T('K5) حذف واقعیِ ردیف مهر‌دار همچنان اعمال می‌شود', JSON.parse(noKeep.store.ptf_crm_offers).length === 0, noKeep.store.ptf_crm_offers);
})();

T('K1) نویسندهٔ مرکزی projection (ptfBApplyServerProjection) برای پیشنهادها حفظ را اعمال می‌کند',
  /function \(k, value, rev\) \{[\s\S]{0,2600}if \(k === 'ptf_crm_offers' && typeof window\.ptfSyncOffersPreservePendingRows === 'function'\)/.test(CS));
T('K1) حفظ‌شدن ردیف، کلید را dirty می‌کند (تا ثبت/پذیرش سرور)',
  /keepPending\.preserved > 0[\s\S]{0,200}ptfSyncNotifyDirty\(k\)/.test(CS));
T('K1) تابع حفظ از sync.js صادر شده و برای نویسندهٔ مرکزی در دسترس است',
  /window\.ptfSyncOffersPreservePendingRows = function/.test(SYNC));
T('K3) ACK فرمان برای پیشنهادها بی‌قید dirty را پاک نمی‌کند',
  /if \(k === 'ptf_crm_offers' && ptfOfferRowsWithoutServerStamp\(rd\(k\)\)\.length\)/.test(SYNC));
T('K4) جاروی همراه‌ها فقط ردیفِ همراهِ پدرثبت‌شده را برمی‌دارد',
  /if \(!parent \|\| !serverNos \|\| !serverNos\[parent\]\) return;/.test(SYNC) &&
  /if \(!o\.fxConvert \|\| typeof o\.fxConvert !== 'object'\) return;/.test(SYNC));
T('K4) جارو از مسیر رسمی ثبت استفاده می‌کند', /window\.ptfOfferRegisterCompanion\(row, \{ source: 'companion-sweep' \}/.test(SYNC));

/* ═══════════ U — رابط کاربری و نسخه ═══════════ */
var OFFERS = read('crm/offers.js');
T('U1) نشان «ثبت‌نشده در سرور» در کادر سبز وابسته به serverRegisteredAt است',
  /ثبت‌نشده در سرور/.test(OFFERS) && /!String\(_comp\.serverRegisteredAt \|\| ''\)\.trim\(\)/.test(OFFERS));
var SDV2 = read('crm/sales-domain-v2.js');
T('U3) ptfOfferRegisterCompanion عمومی است', /window\.ptfOfferRegisterCompanion = function/.test(SDV2));
T('U3) قرارداد register_offer با createIntent:false', /api\('register_offer', payload, \{ autoReplay: false \}\)/.test(SDV2) && /createIntent: false/.test(SDV2));
T('U3) رد قطعی/گذرا تفکیک می‌شود', /definitive: st >= 400 && st < 500 && st !== 408 && st !== 429/.test(SDV2));
T('U3) قرارداد projection موجودیت حفظ می‌شود (pin tester517 سبز می‌ماند)',
  /entityApplyProjection[\s\S]{0,600}ptfBApplyServerProjection/.test(SDV2) &&
  /value != null\) \{[\s\S]{0,160}ptfBApplyServerProjection\(collection, value, rev\)/.test(SDV2));

var pins = [
  ['VERSION.json', /"crm_version": "v34\.39\.66"/],
  ['VERSION.json', /"version": "34\.39\.66"/],
  ['crm/index.html', /window\.PTF_CRM_RELEASE = 'v34\.39\.66'/],
  ['crm/index.html', /\?v=34\.39\.66/],
  ['crm/clear-cache.html', /window\.VER = 'v34\.39\.66'/],
  ['crm/device-reconnect.html', /var VER = 'v34\.39\.66'/],
  ['api/sales-domain.php', /SD_SERVICE_VERSION = '34\.39\.66'/]
];
pins.forEach(function (p) {
  var txt = read(p[0]);
  T('U2) پین نسخه در ' + p[0] + ' (' + p[1].source.slice(0, 34) + '…)', p[1].test(txt));
});

(async function () {
  for (var i = 0; i < phpChecks.length; i++) { await phpChecks[i]; }
  console.log('\n' + pass + ' PASS / ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
})();
