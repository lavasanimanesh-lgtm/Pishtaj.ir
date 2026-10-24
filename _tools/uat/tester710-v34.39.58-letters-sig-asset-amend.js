#!/usr/bin/env node
'use strict';
/* tester710 — v34.39.60 (LETTER-SIG-ASSET + LETTER-AMEND-REV)
   قرارداد اجرایی دو رفعِ تاییدشدهٔ کارفرما (RCA 2026-10-24):

   ① «مهر و امضا در پروفایل ذخیره است ولی روی نامه نمی‌افتد»
      ریشه: پاک‌ساز سرور هر رشتهٔ داخل map تو در تو را به ۳۰۰ کاراکتر می‌برد
      (api/sales-domain.php، مسیر entity_upsert). اکنون تصویر یک‌بار به‌صورت
      «دارایی» (کلید محتوایی در ptf_crm_sigprofiles که map است و از مسیر
      data_push می‌رود) ذخیره می‌شود و سند فقط شناسهٔ کوتاه دارد.
      سیاست بازچاپ (تایید کارفرما): اگر تصویر سند موجود نبود، از «مهر و امضای
      فعلی پروفایل» استفاده شود و همان لحظه در سند ترمیم/ثبت شود.

   ② «باید متن نامه بعد از ثبت قابل اصلاح باشد»
      سیاست تاییدشده: شمارهٔ اندیکاتور ثابت + «Rev.N»؛ مجوز: نویسنده یا نقش
      ارشد؛ دلیل الزامی؛ ۵ نسخهٔ آخر؛ تغییر ماهوی ⇒ امضای قبلی باطل و نامه به
      چرخهٔ امضا برمی‌گردد؛ نسخهٔ قبلی همیشه قابل چاپ است.

   این فایل «تست پین» است: هر FAIL شکست واقعی است و خروجی غیرصفر می‌دهد.
*/
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var letters = fs.readFileSync(path.join(ROOT, 'crm/letters.js'), 'utf8');

var P = 0, F = 0;
function T(name, cond, detail) {
  if (cond) { P++; console.log('PASS  ' + name); }
  else { F++; console.error('FAIL  ' + name + (detail ? '\n        ↳ ' + detail : '')); }
}
function head(t) { console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 74 - t.length))); }

/* تصاویر آزمایشی معتبر (PNG واقعی) */
var PNG_SIG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR42mPgEpH7D8IMMAYAJowE7d8n2J0AAAAASUVORK5CYII=';
var PNG_STAMP = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR42mM4ISf3H4QZYAwARzQIDRsnkbcAAAAASUVORK5CYII=';
var PNG_SIG2 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR42mNgZGL+D8IMMAYAHtAEFedeeTQAAAAASUVORK5CYII=';
/* امضای بزرگ‌حجم (≈۶۴KB) برای سنجش همان سناریوی واقعی */
function bigPng(chars) {
  /* data URL معتبر و بزرگ: سر PNG + بدنهٔ چرخه‌ای (چند ۴) + دنبالهٔ اصلی که IEND را
     نگه می‌دارد؛ بنابراین همان بررسی عمیق چاپ (امضای فایل) را هم پاس می‌کند. */
  var payload = PNG_SIG.split(',')[1];
  var head = payload.slice(0, 16), tail = payload.slice(-24);
  var n = Math.max(0, Math.floor((chars - head.length - tail.length) / 4) * 4), body = '';
  for (var i = 0; i < n; i++) body += 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'[(i * 7 + 11) % 64];
  return 'data:image/png;base64,' + head + body + tail;
}
function clone(o) { return JSON.parse(JSON.stringify(o)); }

/* ───────────────── sandbox ───────────────── */
function makeCtx(store, opts) {
  opts = opts || {};
  var session = opts.session || { user: 'boss', name: 'مدیر عامل' };
  var previews = [], alerts = [], audits = [], notifies = [], toasts = [];
  var els = {};
  var ctx = {
    console: console, JSON: JSON, Math: Math, Date: Date, Number: Number, String: String,
    Object: Object, Array: Array, RegExp: RegExp, Error: Error, isNaN: isNaN, isFinite: isFinite,
    parseInt: parseInt, parseFloat: parseFloat, encodeURIComponent: encodeURIComponent,
    atob: function (b) { return Buffer.from(String(b), 'base64').toString('binary'); },
    btoa: function (b) { return Buffer.from(String(b), 'binary').toString('base64'); },
    setTimeout: function (fn) { try { if (typeof fn === 'function') fn(); } catch (e) {} return 0; },
    clearTimeout: function () {},
    setInterval: function () { return 0; }, clearInterval: function () {},
    addEventListener: function () {}, FileReader: function () {}, Image: function () {},
    URL: { createObjectURL: function () { return 'blob:x'; }, revokeObjectURL: function () {} },
    localStorage: {
      _d: {},
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; },
      setItem: function (k, v) { this._d[k] = String(v); },
      removeItem: function (k) { delete this._d[k]; }
    },
    document: {
      getElementById: function (id) { return els[id] || null; },
      querySelectorAll: function () { return []; },
      createElement: function () { return { style: {}, setAttribute: function () {}, appendChild: function () {} }; },
      body: { appendChild: function () {} }
    },
    /* v34.39.60: getData در لایهٔ دادهٔ واقعی همیشه JSON تازه برمی‌گرداند (storage.js).
       بدون این کلون، _collectLetter سند ذخیره‌شده را درجا تغییر می‌داد و مقایسهٔ
       «قبل/بعد» اصلاحیه در هارنس بی‌معنی می‌شد. */
    getData: function (k) {
      var v = store[k] === undefined ? [] : store[k];
      try { return JSON.parse(JSON.stringify(v)); } catch (eG) { return v; }
    },
    setData: function (k, v) { store[k] = JSON.parse(JSON.stringify(v)); return true; },
    curSession: function () { return session; },
    curRole: function () { return opts.role || 'admin'; }, roleDef: function () { return { panels: '*' }; },
    isSenior: function () { return (opts.role || 'admin') !== 'sales'; },
    genCode: function () { return 'L-NEW'; },
    faDate: function () { return '1405/08/02'; }, faDateTime: function () { return '1405/08/02 11:00'; },
    faYear: function () { return '1405'; },
    escP: function (v) { return String(v == null ? '' : v); },
    ptfOnClickArg: function (v) { return String(v == null ? '' : v); },
    hideModal: function () {}, renderLetters: function () {}, goPanel: function () {},
    audit: function (a, b, c) { audits.push([a, b, c]); },
    notify: function (n) { notifies.push(n); },
    alert: function (m) { alerts.push(String(m)); },
    confirm: function (m) { alerts.push('CONFIRM ' + m); return opts.confirm !== false; },
    prompt: function (m, d) { alerts.push('PROMPT ' + m); return opts.promptValue === undefined ? 'دلیل آزمایشی' : opts.promptValue; },
    ptfToast: function (m, k) { toasts.push([m, k]); },
    ptfPreviewPrintableDoc: function () { previews.push([].slice.call(arguments)); },
    ptfLetterSignerMode: function () {}, ptfLtImgRender: function () {},
    letEditorWirePasteAndDrop: function () {}, letSyncDocFont: function () {}
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx._previews = previews; ctx._alerts = alerts; ctx._audits = audits; ctx._notifies = notifies;
  ctx._toasts = toasts; ctx._els = els; ctx._store = store; ctx._setSession = function (s) { session = s; };
  vm.createContext(ctx);
  vm.runInContext(letters, ctx, { filename: 'letters-runtime.js' });
  ctx.letSafeBodyHtml = function (h) { return String(h == null ? '' : h); };
  return ctx;
}
var PROFILE = { nm: 'مدیر عامل', role: 'مدیرعامل', sig: PNG_SIG, stamp: PNG_STAMP, updatedAtISO: '2026-10-20T08:00:00Z' };
var BASE = {
  cd: 'L1', kind: 'OUT', st: 'signed', lang: 'fa', no: '1405/پ/ص/0007',
  to: 'جناب آقای محمدی', toRole: 'مدیر بازرگانی', subject: 'موضوع نامه',
  body: 'متن نامه', bodyHtml: '<p>متن نامه</p>', style: {}, t: '1405/08/01',
  signer: 'boss', signerNm: 'مدیر عامل', signerRole: 'مدیرعامل',
  author: 'boss', authorNm: 'مدیر عامل', signedT: '1405/08/01 09:00',
  att: 'ندارد', bsm: true, prjNo: '', images: []
};
function storeWith(profiles, lettersArr) {
  return { ptf_crm_letters: lettersArr || [], ptf_crm_sigprofiles: profiles || {}, ptf_crm_users: [], ptf_crm_projects: [] };
}
function printed(ctx, letter, includeSig) {
  ctx.getData = function (k) {
    if (k === 'ptf_crm_letters') return [letter];
    return ctx._store[k] === undefined ? [] : ctx._store[k];
  };
  ctx.letPrint(letter.cd, false, includeSig === undefined ? true : includeSig);
  var pv = ctx._previews[ctx._previews.length - 1];
  return (pv && pv[1]) || '';
}
function printedRev(ctx, cd, rev, includeSig) {
  ctx.letPrint(cd, false, includeSig === undefined ? true : includeSig, { rev: rev });
  var pv = ctx._previews[ctx._previews.length - 1];
  return (pv && pv[1]) || '';
}

/* ══════════════════════════════════════════════════════════════════
   بخش A — دارایی تصویر (رفع P0: تصویر مهر/امضا)
   ══════════════════════════════════════════════════════════════════ */
head('A) تصویر «یک‌بار ذخیره، ارجاع در سند»');

(function () {
  var store = storeWith({ boss: clone(PROFILE) }, []);
  var c = makeCtx(store);
  var big = bigPng(48000);
  var snap = c.letMakeSigSnapshot({ sig: big, stamp: PNG_STAMP }, 'مدیر عامل', 'مدیرعامل');
  var strs = [];
  Object.keys(snap).forEach(function (k) { if (typeof snap[k] === 'string') strs.push(snap[k]); });
  var longest = strs.reduce(function (a, b) { return a.length > b.length ? a : b; }, '');
  var back = c.letAssetGet(snap.sigAsset);
  T('A1 | snapshot امضا هیچ رشتهٔ بلندی ندارد (بلندترین: ' + longest.length + ' < ۳۰۰ کاراکتر سقف سرور) و تصویر ۶۴KB در دارایی سالم است',
    longest.length < 300 && back === big && c.letImgDataUrlOk(back, true) && /^_asset_SIG-/.test(snap.sigAsset),
    'sigAsset=' + snap.sigAsset + ' len=' + longest.length + ' sameImage=' + (back === big));
})();

(function () {
  /* شبیه‌سازی همان پاک‌ساز سرور: هر رشتهٔ داخل map تو در تو → ۳۰۰ کاراکتر */
  var store = storeWith({ boss: clone(PROFILE) }, []);
  var c = makeCtx(store);
  var l = clone(BASE);
  l.signatureSnapshot = c.letMakeSigSnapshot({ sig: bigPng(48000), stamp: PNG_STAMP }, 'مدیر عامل', 'مدیرعامل');
  Object.keys(l.signatureSnapshot).forEach(function (k) {
    if (typeof l.signatureSnapshot[k] === 'string') l.signatureSnapshot[k] = l.signatureSnapshot[k].substr(0, 300);
  });
  store.ptf_crm_letters = [l];
  var c2 = makeCtx(store);
  var h = printed(c2, store.ptf_crm_letters[0], true);
  T('A2 | پس از عبور snapshot از پاک‌ساز سرور، نامه هنوز مهر و امضای معتبر دارد (پروجکشن سرور دیگر سند را خراب نمی‌کند)',
    h.indexOf(PNG_STAMP) > -1 && /<img class="s"/.test(h) && /<img class="st"/.test(h));
})();

(function () {
  /* نامهٔ قدیمی: snapshot بریده/ناقص + پروفایل سالم ⇒ بازچاپ با مهر و امضای فعلی + ترمیم ماندگار */
  var store = storeWith({ boss: clone(PROFILE) }, []);
  var c = makeCtx(store);
  var l = clone(BASE);
  l.signatureSnapshot = { sig: bigPng(48000).slice(0, 300), stamp: '', nm: 'مدیر عامل', role: 'مدیرعامل', at: '1405/08/01 09:00' };
  store.ptf_crm_letters = [l];
  var state = c.letSnapState(store.ptf_crm_letters[0]);
  var h = printed(c, store.ptf_crm_letters[0], true);
  var after = store.ptf_crm_letters[0];
  T('A3 | snapshot بریده/ناقص: وضعیت «broken» تشخیص داده می‌شود و چاپ از مهر و امضای فعلی پروفایل استفاده می‌کند',
    state === 'broken' && h.indexOf(PNG_SIG) > -1 && h.indexOf(PNG_STAMP) > -1,
    'state=' + state + ' sig=' + (h.indexOf(PNG_SIG) > -1) + ' stamp=' + (h.indexOf(PNG_STAMP) > -1));
  T('A3b | همان لحظهٔ چاپ، snapshot با ارجاع دارایی ترمیم و ماندگار می‌شود (هویت تاریخی nm/role/at دست‌نخورده)',
    after.signatureSnapshot && !!after.signatureSnapshot.sigAsset && !after.signatureSnapshot.sig &&
    after.signatureSnapshot.nm === 'مدیر عامل' && after.signatureSnapshot.at === '1405/08/01 09:00' &&
    after.signatureSnapshot.healedFrom === 'profile',
    JSON.stringify(after.signatureSnapshot).slice(0, 180));
})();

(function () {
  /* سیاست «بازچاپ با مهر و امضای فعلی» برای نامهٔ بدون هیچ تصویر در سند */
  var store = storeWith({ boss: clone(PROFILE) }, []);
  var c = makeCtx(store);
  var l = clone(BASE);
  l.signatureSnapshot = { nm: 'مدیر عامل', role: 'مدیرعامل' };
  store.ptf_crm_letters = [l];
  var c2 = makeCtx(store);
  var h = printed(c2, store.ptf_crm_letters[0], true);
  T('A4 | سند بی‌تصویر با تصویر پروفایل چاپ می‌شود و پرچم «بدون تصویر» برداشته می‌شود',
    h.indexOf(PNG_SIG) > -1 && h.indexOf(PNG_STAMP) > -1 && !store.ptf_crm_letters[0].sigMissing);
})();

(function () {
  /* ترمیم گروهی: فقط نامه‌های سالم نمی‌مانند؛ بی‌تصویرها پرچم می‌گیرند */
  var store = storeWith({ boss: clone(PROFILE) }, []);
  var c = makeCtx(store);
  var a = clone(BASE); a.cd = 'L1'; a.signatureSnapshot = { sig: bigPng(48000).slice(0, 300), nm: 'مدیر عامل' };
  var b = clone(BASE); b.cd = 'L2'; b.signer = 'ghost'; b.signerNm = 'نام ناشناس'; b.signatureSnapshot = { sig: '..', nm: 'نام ناشناس' };
  var d = clone(BASE); d.cd = 'L3'; d.signatureSnapshot = null;
  store.ptf_crm_letters = [a, b, d];
  var c2 = makeCtx(store);
  var r = c2.letRepairSigSnapshots({ force: true });
  var byCd = {};
  store.ptf_crm_letters.forEach(function (x) { byCd[x.cd] = x; });
  T('A5 | ترمیم گروهی: نامهٔ قابل‌ترمیم دارایی می‌گیرد، نامهٔ بی‌منبع «sigMissing» می‌شود و دلیل در حسابرسی ثبت می‌شود',
    !!byCd.L1.signatureSnapshot.sigAsset && byCd.L2.sigMissing === 1 && r.fixed.length === 2 &&
    c2._audits.some(function (x) { return /ترمیم/.test(x[1] || ''); }),
    JSON.stringify(r));
})();

(function () {
  /* پیرایش دارایی: بی‌ارجاع حذف، ارجاع‌دار حفظ */
  var store = storeWith({ boss: clone(PROFILE) }, []);
  var c = makeCtx(store);
  var l = clone(BASE);
  l.signatureSnapshot = c.letMakeSigSnapshot({ sig: PNG_SIG, stamp: PNG_STAMP }, 'مدیر عامل', 'مدیرعامل');
  store.ptf_crm_letters = [l];
  var map = c.letAssetMap();
  var keepId = l.signatureSnapshot.sigAsset;
  map['_asset_IMG-deadbeef0000'] = { src: PNG_SIG2, kind: 'IMG', at: '2020-01-01T00:00:00Z' };
  c.LET_ASSET_MAX = 2; /* سقف پایین تا رفتار پیرایش قابل‌سنجش شود */
  c.letAssetPrune(map, {});
  T('A6 | پیرایش فقط دارایی بی‌ارجاع را حذف می‌کند و تصویر ارجاع‌دار سند دست‌نخورده می‌ماند',
    !map['_asset_IMG-deadbeef0000'] && !!map[keepId] && !!l.signatureSnapshot.stampAsset && !!map[l.signatureSnapshot.stampAsset]);
})();

(function () {
  /* تصویر داخل متن: data URL → ptfasset → برگشت، و حذف تصویر بی‌دارایی */
  var store = storeWith({ boss: clone(PROFILE) }, []);
  var c = makeCtx(store);
  var src = '<p>متن</p><img src="' + PNG_SIG + '" alt="">';
  var stored = c.letHtmlAssetify(src);
  var expanded = c.letHtmlExpand(stored);
  var missing = c.letHtmlExpand('<p>x</p><img src="ptfasset:_asset_IMG-000000000000" alt="">');
  T('A7 | تصویر داخل متن به ارجاع کوتاه تبدیل و در چاپ به تصویر اصلی برمی‌گردد (без آیکون شکسته)',
    stored.indexOf(PNG_SIG) === -1 && /ptfasset:_asset_IMG-/.test(stored) && expanded.indexOf(PNG_SIG) > -1 &&
    missing.indexOf('<img') === -1,
    'stored=' + stored.slice(0, 80) + ' | missing=' + missing);
})();

(function () {
  /* Sanitizer متن، ارجاع ptfasset را نگه می‌دارد */
  var ok = /n === 'src'[\s\S]{0,200}ptfasset:/.test(letters);
  T('A8 | پاک‌ساز متن نامه (letSafeBodyHtml) ارجاع ptfasset را حذف نمی‌کند', ok);
})();

/* ══════════════════════════════════════════════════════════════════
   بخش B — اصلاحیهٔ نسخه‌دار (رفع P1)
   ══════════════════════════════════════════════════════════════════ */
head('B) اصلاح متن نامه پس از ثبت — Rev');

function mkSigned() {
  var store = storeWith({ boss: clone(PROFILE) }, []);
  var c = makeCtx(store);
  var l = clone(BASE);
  l.signatureSnapshot = c.letMakeSigSnapshot({ sig: PNG_SIG, stamp: PNG_STAMP }, 'مدیر عامل', 'مدیرعامل');
  store.ptf_crm_letters = [l];
  return { store: store, c: makeCtx(store) };
}
var PATCH = {
  subject: 'موضوع اصلاح‌شده', to: 'جناب آقای محمدی', toRole: 'مدیر بازرگانی',
  body: 'متن اصلاح‌شده', bodyHtml: '<p>متن اصلاح‌شده</p>', lang: 'fa', att: 'ندارد',
  bsm: true, prjNo: '', style: {}, images: [],
  signer: 'boss', signerNm: 'مدیر عامل', signerRole: 'مدیرعامل'
};

(function () {
  var s = mkSigned();
  var before = clone(s.store.ptf_crm_letters[0]);
  var r = s.c.letApplyAmendment('L1', 'غلط تایپی در متن', PATCH);
  var after = s.store.ptf_crm_letters[0];
  T('B1 | اصلاحیه ثبت می‌شود، شمارهٔ اندیکاتور دست‌نخورده می‌ماند و rev یک واحد بالا می‌رود',
    r.ok && after.no === before.no && after.rev === 1 && after.body === 'متن اصلاح‌شده',
    JSON.stringify(r) + ' no=' + after.no);
  T('B1b | نسخهٔ قبلی کامل بایگانی می‌شود (متن، وضعیت، شماره، امضای تاریخی و دلیل)',
    Array.isArray(after.revs) && after.revs.length === 1 && after.revs[0].body === before.body &&
    after.revs[0].n === 0 && after.revs[0].st === 'signed' && after.revs[0].reason === 'غلط تایپی در متن' &&
    !!(after.revs[0].signatureSnapshot && after.revs[0].signatureSnapshot.at),
    JSON.stringify(after.revs[0] && { n: after.revs[0].n, st: after.revs[0].st, reason: after.revs[0].reason }));
  T('B1c | تغییر ماهوی: امضای قبلی باطل و نامه به «در انتظار امضا» برمی‌گردد + اعلان برای امضای مجدد',
    after.st === 'pending' && !after.signatureSnapshot && !!after.sigInvalidated &&
    s.c._notifies.some(function (n) { return /امضای مجدد/.test(n.title || ''); }),
    'st=' + after.st + ' invalidated=' + JSON.stringify(after.sigInvalidated || null));
  T('B1d | دلیل، کاربر و فهرست فیلدهای تغییر‌یافته در سابقهٔ نامه ثبت می‌شود (amendments + statusHistory + audit)',
    after.amendments.length === 1 && after.amendments[0].reason === 'غلط تایپی در متن' &&
    after.amendments[0].changed.indexOf('body') > -1 && after.amendments[0].by === 'boss' &&
    after.statusHistory.length >= 1 && s.c._audits.some(function (x) { return /Rev\.1/.test(x[1] || ''); }));
})();

(function () {
  /* اصلاح غیرماهوی (فقط قالب): وضعیت و امضا حفظ می‌شود */
  var s = mkSigned();
  var patch = clone(PATCH);
  patch.body = BASE.body; patch.bodyHtml = BASE.bodyHtml; patch.subject = BASE.subject;
  patch.style = { fs: 13 };
  var r = s.c.letApplyAmendment('L1', 'تنظیم فاصلهٔ خطوط', patch);
  var after = s.store.ptf_crm_letters[0];
  T('B2 | تغییر غیرماهوی (فقط قالب) وضعیت و امضای نامه را باطل نمی‌کند',
    r.ok && r.substantive === false && after.st === 'signed' && !!after.signatureSnapshot && after.rev === 1,
    JSON.stringify(r));
})();

(function () {
  var s = mkSigned();
  var r1 = s.c.letApplyAmendment('L1', '   ', PATCH);
  var revAfterReject = s.store.ptf_crm_letters[0].rev;
  var r2 = s.c.letApplyAmendment('L1', 'دلیل', PATCH); /* بعد از رد شدن دلیل، اولین نسخه ثبت می‌شود */
  T('B3 | اصلاح بدون دلیل رد می‌شود و هیچ نسخه‌ای ساخته نمی‌شود', r1.ok === false && /دلیل/.test(r1.error) && revAfterReject === undefined && r2.ok === true);
  var r3 = s.c.letApplyAmendment('L1', 'دلیل', PATCH); /* بدون تغییر */
  T('B3b | اصلاح بدون تغییر واقعی ثبت نمی‌شود (جلوگیری از نسخه‌های توخالی)', r3.ok === false && /تغییر/.test(r3.error));
})();

(function () {
  /* مجوز: نویسنده یا نقش ارشد */
  var s = mkSigned();
  s.store.ptf_crm_letters[0].author = 'someone_else';
  var salesCtx = makeCtx(s.store, { role: 'sales', session: { user: 'sales1', name: 'کارشناس' } });
  var denied = salesCtx.letApplyAmendment('L1', 'دلیل', PATCH);
  var seniorCtx = makeCtx(s.store, { role: 'admin', session: { user: 'boss', name: 'مدیر عامل' } });
  var bySenior = seniorCtx.letApplyAmendment('L1', 'دلیل', PATCH);
  /* نویسندهٔ نامه هم مجاز است */
  s.store.ptf_crm_letters[0].author = 'writer1';
  var writerCtx = makeCtx(s.store, { role: 'sales', session: { user: 'writer1', name: 'نویسنده' } });
  var patch2 = clone(PATCH); patch2.subject = 'موضوع از سوی نویسنده';
  var byAuthor = writerCtx.letApplyAmendment('L1', 'اصلاح نویسنده', patch2);
  T('B4 | کاربر غیرمجاز نمی‌تواند اصلاح کند؛ نقش ارشد و نویسندهٔ نامه می‌توانند (سیاست: نویسنده یا ارشد)',
    denied.ok === false && /مجاز/.test(denied.error) && bySenior.ok === true && byAuthor.ok === true,
    JSON.stringify([denied, bySenior, byAuthor]));
})();

(function () {
  var s = mkSigned();
  var patch = clone(PATCH);
  for (var i = 1; i <= 7; i++) {
    patch.subject = 'موضوع ' + i;
    var r = s.c.letApplyAmendment('L1', 'اصلاح شمارهٔ ' + i, clone(patch));
    if (!r.ok) { T('B5 | سقف نسخه‌ها', false, JSON.stringify(r)); return; }
  }
  var after = s.store.ptf_crm_letters[0];
  T('B5 | سقف ۵ نسخهٔ آخر رعایت می‌شود و شمارهٔ نامه در همهٔ اصلاحیه‌ها ثابت می‌ماند',
    after.rev === 7 && after.revs.length === 5 && after.no === BASE.no && after.revs[4].n === 6,
    'rev=' + after.rev + ' revs=' + after.revs.map(function (x) { return x.n; }).join(','));
})();

(function () {
  /* گاردهای letSubmit / letSaveDraft روی نامهٔ ثبت‌شده */
  var s = mkSigned();
  var shown = [];
  s.c.document.getElementById = function (id) {
    if (id === 'panels') return { insertAdjacentHTML: function (pos, html) { shown.push(html); } };
    return null;
  };
  s.c._els.ltBodyEditor = null;
  var before = clone(s.store.ptf_crm_letters[0]);
  s.c.letSubmit('L1');
  var v = s.store.ptf_crm_letters[0];
  var submitGuarded = v.no === before.no && v.st === before.st && s.c._alerts.some(function (a) { return /CONFIRM/.test(a); }) &&
    s.c._alerts.some(function (a) { return /اصلاح/.test(a); });
  s.store.ptf_crm_letters[0].st = 'signed';
  s.c.letSaveDraft('L1');
  var w = s.store.ptf_crm_letters[0];
  T('B6 | «تایید و ثبت» و «ثبت پیش‌نویس» روی نامهٔ ثبت‌شده مسدود و به مسیر اصلاحیه هدایت می‌شوند (شماره/وضعیت/امضا دست‌نخورده)',
    submitGuarded && w.st === 'signed' && w.no === before.no,
    'submitGuarded=' + submitGuarded + ' st=' + w.st);
})();

(function () {
  /* چاپ نسخهٔ بایگانی + نشان Rev در سربرگ */
  var s = mkSigned();
  s.c.letApplyAmendment('L1', 'اصلاح متن', clone(PATCH));
  s.c.letApplyAmendment('L1', 'اصلاح دوم', (function () { var p = clone(PATCH); p.subject = 'موضوع سوم'; return p; })());
  var cur = printed(s.c, s.store.ptf_crm_letters[0], true);
  var old = printedRev(s.c, 'L1', 0, true);
  T('B7 | چاپ نسخهٔ جاری نشان «Rev.2» در سربرگ دارد', cur.indexOf('Rev.2') > -1, cur.match(/Rev\.[0-9]/));
  T('B8 | چاپ نسخهٔ بایگانی: متن/موضوع/شمارهٔ همان نسخه + واترمارک «نسخهٔ منسوخ» و بدون درج نسخهٔ جاری',
    old.indexOf('نسخهٔ منسوخ') > -1 && old.indexOf(BASE.subject) > -1 && old.indexOf('موضوع سوم') === -1 && old.indexOf(BASE.no) > -1,
    'superseded=' + (old.indexOf('نسخهٔ منسوخ') > -1) + ' subject=' + (old.indexOf(BASE.subject) > -1) + ' no=' + (old.indexOf(BASE.no) > -1));
})();

(function () {
  /* نامهٔ ثبت‌شده با امضای فیزیکی: اصلاح ماهوی، وضعیت را عوض نمی‌کند ولی بازچاپ را الزامی می‌کند */
  var store = storeWith({ boss: clone(PROFILE) }, []);
  var c = makeCtx(store);
  var l = clone(BASE);
  l.st = 'registered'; l.manualSignature = true; l.signerMode = 'other';
  delete l.signatureSnapshot;
  store.ptf_crm_letters = [l];
  var c2 = makeCtx(store);
  var r = c2.letApplyAmendment('L1', 'اصلاح نشانی گیرنده', clone(PATCH));
  var after = store.ptf_crm_letters[0];
  T('B9 | اصلاح نامهٔ «ثبت فیزیکی»: وضعیت حفظ، شماره ثابت و «بازچاپ لازم است» علامت می‌خورد',
    r.ok && after.st === 'registered' && after.no === BASE.no && after.reprintRequired === 1,
    JSON.stringify({ st: after.st, reprint: after.reprintRequired }));
})();

(function () {
  /* کپی به پیش‌نویس، تاریخچهٔ اصلاحیه را منتقل نمی‌کند */
  var s = mkSigned();
  s.c.document.getElementById = function (id) {
    if (id === 'panels') return { insertAdjacentHTML: function () {} };
    return null;
  };
  s.c.letApplyAmendment('L1', 'اصلاح', clone(PATCH));
  s.c.letCopyAsDraft('L1');
  var copy = s.store.ptf_crm_letters.filter(function (x) { return x.cd !== 'L1'; })[0] || {};
  T('B10 | «کپی به پیش‌نویس» سند تازه می‌سازد: rev/revs/amendments منتقل نمی‌شود و copiedFrom ثبت می‌شود',
    copy.st === 'draft' && copy.rev === undefined && copy.revs === undefined && copy.copiedFrom === 'L1');
})();

/* ══════════════════════════════════════════════════════════════════
   بخش C — رگرسیون قرارداد چاپ (نباید با این تغییرات عوض شود)
   ══════════════════════════════════════════════════════════════════ */
head('C) رگرسیون چاپ');

(function () {
  var store = storeWith({ boss: clone(PROFILE) }, []);
  var c = makeCtx(store);
  var l = clone(BASE);
  l.signatureSnapshot = c.letMakeSigSnapshot({ sig: PNG_SIG, stamp: PNG_STAMP }, 'مدیر عامل', 'مدیرعامل');
  store.ptf_crm_letters = [l];
  var c2 = makeCtx(store);
  var phys = printed(c2, store.ptf_crm_letters[0], false);
  T('C1 | خروجی «بدون امضا / چاپ فیزیکی» همچنان بدون تصویر و با خط محل امضای دستی است',
    phys.indexOf(PNG_SIG) === -1 && phys.indexOf(PNG_STAMP) === -1 && phys.indexOf('محل مهر و امضای فیزیکی') > -1);
  var pend = clone(BASE); pend.st = 'pending'; delete pend.signatureSnapshot;
  var h2 = printed(c2, pend, false);
  T('C2 | نامهٔ «در انتظار امضا» تصویر مهر/امضا ندارد', h2.indexOf(PNG_SIG) === -1);
})();

(function () {
  var page = fs.readFileSync(path.join(ROOT, 'crm/letters.js'), 'utf8');
  T('C3 | نقطهٔ ذخیرهٔ snapshot در letSubmit/letSign یکسان است (بدون بازگشت به data URL خام)',
    (page.match(/letMakeSigSnapshot\(/g) || []).length >= 3 && !/signatureSnapshot = \{ sig: p\.sig/.test(page) &&
    /l\.signatureSnapshot = letMakeSigSnapshot\(p, selfNm, selfRole\)/.test(page) &&
    /l\.signatureSnapshot = letMakeSigSnapshot\(p, signerNm, signerRole\)/.test(page));
  T('C4 | اصلاحیه بدون دلیل در UI هم گرفته می‌شود (letAmendOpen) و فقط با مجوز باز می‌شود',
    /if \(!letCanAmend\(l\)\)/.test(page) && /دلیل اصلاح الزامی است/.test(page));
})();

/* ══════════════════════════════════════════════════════════════════
   بخش D — «فضای دارایی» در UI: کلیدهای _asset_ نباید پروفایل حساب شوند،
   تصویر پروفایل باید واقعاً سنجیده شود، و مسیر «متن آماده روی سربرگ» هم
   همان زنجیرهٔ فالبک پروفایل را داشته باشد (پاک‌سازی نهایی ۳۹.۵۸).
   ══════════════════════════════════════════════════════════════════ */
head('D) دارایی در UI — فیلتر کلید، اعتبار تصویر پروفایل، سربرگ');

function panelsStub(ctx) {
  var sink = { html: '' };
  ctx._els.panels = { insertAdjacentHTML: function (pos, h) { sink.html += h; } };
  return sink;
}

(function () {
  /* D1: کلید دارایی حتی اگر nm داشته باشد پروفایل امضاکننده نیست */
  var store = storeWith({
    _asset_IMG_aaaaaaaaaaaa: { nm: 'مدیر عامل', role: 'مدیرعامل', sig: PNG_SIG2, src: PNG_SIG2, at: '2026-10-20T09:00:00Z' }
  }, []);
  var c = makeCtx(store);
  var got = c.letResolveSignerProfile({ signer: 'ghost', signerNm: 'مدیر عامل' });
  T('D1 | کلید دارایی (_asset_) هرگز به‌عنوان پروفایل امضاکننده بازنمی‌گردد',
    !got || got.src === undefined, JSON.stringify(got));
  T('D1b | کلیدهای _asset_ از فهرست پروفایل‌های واقعی حذف می‌شوند', c.letAssetIsId('_asset_IMG_aaaaaaaaaaaa') === true &&
    Object.keys(c.sigProfiles()).filter(function (k) { return !c.letAssetIsId(k); }).length === 0);
})();

(function () {
  var c = makeCtx(storeWith({ boss: clone(PROFILE) }, []));
  T('D2 | اعتبار تصویر پروفایل واقعی سنجیده می‌شود (ok / broken / empty)',
    c.letProfileImgState(PNG_SIG) === 'ok' &&
    c.letProfileImgState(PNG_SIG.slice(0, 90)) === 'broken' &&
    c.letProfileImgState('') === 'empty');
  T('D2b | نشان «ثبت شده» فقط برای تصویر سالم و «ناقص» برای تصویر بریده',
    c.letProfileImgNote(PNG_SIG).indexOf('✔') > -1 && c.letProfileImgNote(PNG_SIG.slice(0, 90)).indexOf('⚠️') > -1 &&
    c.letProfileImgNote('').indexOf('⚠️') === -1);
})();

(function () {
  /* D3: پنجرهٔ پروفایل — تصویر ناقص باید هشدار بدهد و پیش‌نمایش سالم نمایش داده شود */
  var store = storeWith({ boss: { nm: 'مدیر عامل', role: 'مدیرعامل', sig: PNG_SIG.slice(0, 120), stamp: PNG_STAMP, updatedAtISO: '2026-10-20T08:00:00Z' } }, []);
  var c = makeCtx(store);
  var sink = panelsStub(c);
  c.showSigProfile();
  T('D3 | تصویر ناقص پروفایل در پنجرهٔ امضا هشدار می‌دهد (ptfToast)',
    c._toasts.some(function (t) { return String(t[0]).indexOf('ناقص') > -1; }), JSON.stringify(c._toasts));
  T('D3b | پیش‌نمایش تصویر سالم (مهر) در پنجره هست و تصویر ناقص پیش‌نمایش نمی‌گیرد',
    sink.html.indexOf(PNG_STAMP) > -1 && sink.html.indexOf(PNG_SIG.slice(0, 120)) === -1);

  var store2 = storeWith({ boss: clone(PROFILE) }, []);
  var c2 = makeCtx(store2);
  var sink2 = panelsStub(c2);
  c2.showSigProfile();
  T('D3c | پروفایل سالم: هر دو پیش‌نمایش + بدون هشدار',
    sink2.html.indexOf(PNG_SIG) > -1 && sink2.html.indexOf(PNG_STAMP) > -1 && c2._toasts.length === 0);
})();

(function () {
  /* D4: فهرست امضاکننده — کاربر بدون تصویر امضا علامت می‌خورد */
  var store = storeWith({ boss: clone(PROFILE), sam: { nm: 'سارا محمدی', role: 'کارشناس', sig: '', updatedAtISO: '2026-10-20T08:00:00Z' } }, []);
  store.ptf_crm_users = [{ username: 'boss', name: 'مدیر عامل' }, { username: 'sam', name: 'سارا محمدی' }];
  var c = makeCtx(store);
  var sink = panelsStub(c);
  c.showLetterModal();
  T('D4 | در فهرست امضاکننده، کاربر بدون تصویر امضا هشدار «بدون تصویر امضا» دارد',
    sink.html.indexOf('بدون تصویر امضا') > -1 && sink.html.indexOf('سارا محمدی') > -1);
  T('D4b | امضاکنندهٔ دارای تصویر سالم هشدار نمی‌گیرد',
    sink.html.indexOf('مدیر عامل ⚠️') === -1);
})();

(function () {
  /* D5: مسیر «متن آماده روی سربرگ» — فالبک نام نمایشی + اعتبار تصویر */
  function lhCtx(profileMap, session) {
    var store = storeWith(profileMap, []);
    var c = makeCtx(store, { session: session });
    c._els.lhpEditor = { innerHTML: '<p>متن آماده</p>', textContent: 'متن آماده' };
    c._els.lhpLang = { value: 'fa' };
    c._els.lhpSigMode = { value: 'last' };
    c._els.lhpDate = { checked: false };
    c._els.lhpNo = { value: '' };
    c._els.lhpAtt = { value: '' };
    return c;
  }
  /* پروفایل با کلید شناسهٔ قدیمی ذخیره شده؛ resolve با نام نمایشی باید پیدایش کند */
  var c = lhCtx({ old_boss: { nm: 'مدیر عامل', role: 'مدیرعامل', sig: PNG_SIG, stamp: PNG_STAMP, updatedAtISO: '2026-10-20T08:00:00Z' } },
                { user: 'boss', name: 'مدیر عامل' });
  c.ptfLetterheadPastePrint();
  var html = (c._previews[c._previews.length - 1] || [])[1] || '';
  T('D5 | سربرگ: تصویر مهر/امضا با فالبک نام نمایشی پیدا و درج می‌شود',
    html.indexOf(PNG_SIG) > -1 && html.indexOf(PNG_STAMP) > -1, html.length + ' chars');

  var c2 = lhCtx({ boss: { nm: 'مدیر عامل', role: 'مدیرعامل', sig: PNG_SIG.slice(0, 100), stamp: PNG_STAMP, updatedAtISO: '2026-10-20T08:00:00Z' } },
                 { user: 'boss', name: 'مدیر عامل' });
  c2.confirm = function () { return true; };
  c2.ptfLetterheadPastePrint();
  var html2 = (c2._previews[c2._previews.length - 1] || [])[1] || '';
  T('D5b | سربرگ: تصویر ناقص امضا در سند درج نمی‌شود و هشدار داده می‌شود',
    html2.indexOf(PNG_SIG.slice(0, 100)) === -1 && c2._toasts.some(function (t) { return String(t[0]).indexOf('ناقص') > -1; }) &&
    html2.indexOf(PNG_STAMP) > -1, JSON.stringify(c2._toasts));
})();

/* G — نرمال‌سازی امضاکننده در اصلاحیه (همان قواعد مسیر ثبت اولیه) */
head('G) نرمال‌سازی امضاکننده در اصلاحیه');

(function () {
  /* G1: انتخاب «خودم» در فرم، شناسهٔ واقعی کاربر را ذخیره می‌کند */
  var store = storeWith({ boss: clone(PROFILE) }, [clone(BASE)]);
  var c = makeCtx(store, { promptValue: 'تغییر امضاکننده' });
  formDom(c, { ltSigner: '__me__', ltSub: 'موضوع تازه' });
  c.letAmendOpen('L1');
  c.letAmendSave();
  var l = store.ptf_crm_letters[0];
  T('G1 | «خودم» در اصلاحیه به شناسهٔ کاربر واقعی تبدیل می‌شود (نه __me__)',
    l.signer === 'boss' && l.rev === 1, 'signer=' + l.signer);

  /* G2: تغییر از «نام دلخواه (فیزیکی)» به کاربر واقعی، برچسب signerMode را پاک می‌کند */
  var L = clone(BASE);
  L.st = 'registered'; L.signer = '__other__'; L.signerMode = 'other';
  L.signerNm = 'جناب آقای خارجی'; L.signerRole = 'مدیر'; L.manualSignature = true;
  var store2 = storeWith({ boss: clone(PROFILE) }, [L]);
  var c2 = makeCtx(store2, { promptValue: 'امضاکننده عوض شد' });
  formDom(c2, { ltSigner: 'boss', ltSub: 'موضوع تازه' });
  c2.letAmendOpen('L1');
  c2.letAmendSave();
  var l2 = store2.ptf_crm_letters[0];
  T('G2 | تغییر از «نام دلخواه/فیزیکی» به کاربر واقعی، signerMode قدیمی را پاک می‌کند',
    l2.signer === 'boss' && l2.signerMode === undefined && l2.st === 'registered' && !!l2.reprintRequired,
    'signer=' + l2.signer + ' mode=' + l2.signerMode + ' st=' + l2.st);
})();

/* ══════════════════════════════════════════════════════════════════
   بخش E — قرارداد سرور و سینک (بدون PHP در محیط: پین متنی روی منبع)
   ══════════════════════════════════════════════════════════════════ */
head('E) قرارداد پاک‌ساز سرور و ادغام سینک');

(function () {
  var php = fs.readFileSync(path.join(ROOT, 'api/sales-domain.php'), 'utf8');
  var sync = fs.readFileSync(path.join(ROOT, 'crm/sync.js'), 'utf8');
  var reg = php.slice(php.indexOf("'ptf_crm_letters' => ["), php.indexOf("'ptf_crm_letters' => [") + 1400);
  T('E1 | رجیستری نامه سقف فیلدهای سنگین دارد (bodyHtml/images/revs/signatureSnapshot)',
    reg.indexOf('bigFields') > -1 && reg.indexOf("'bodyHtml' => 200000") > -1 &&
    reg.indexOf("'revs' => 900000") > -1 && reg.indexOf("'signatureSnapshot' => 600000") > -1,
    reg.slice(0, 200));
  T('E2 | لیست‌ساز سرور سقف قلم/کلید را پارامتریک می‌گیرد (پیش‌فرض همان ۲۰۰۰/۲۰)',
    /function sd_entity_sanitize_list\(array \$v, array &\$stats = null, int \$depth = 2, int \$itemLimit = 2000, int \$maxKeys = 20\): array/.test(php));
  T('E3 | ردیف‌ساز: رشتهٔ سطح‌ردیفِ bigField سقف بلندتر می‌گیرد، بقیه همان ۸۰۰۰',
    /\(isset\(\$bigFields\[\$k\]\) && \$bigBudget > 0\) \? \(int\)\$bigFields\[\$k\] : 8000/.test(php));
  T('E3b | بودجهٔ ردیف محدود است (۲MB) تا پاسخ فرمان از کنترل خارج نشود',
    /\$bigBudget = 2 \* 1048576;/.test(php) && /\$bigBudget -= strlen/.test(php));
  T('E4 | ادغام سینک پروفایل‌ها کلیدمحور است و کلید یک‌طرفه (دارایی) را حذف نمی‌کند',
    sync.indexOf('Object.keys(usersS).forEach(function (u)') > -1 &&
    sync.indexOf('if (lv === undefined) outS[u] = rv;') > -1 &&
    sync.indexOf('else if (rv === undefined) outS[u] = lv;') > -1);
  T('E4b | در تعارض پروفایل، نسخهٔ بی‌تاریخ (دارایی) هم حفظ می‌شود (local برنده، محتوا یکسان)',
    /outS\[u\] = lt >= rt \? lv : rv;/.test(sync));
})();

/* ══════════════════════════════════════════════════════════════════
   بخش F — مسیر واقعی UI اصلاحیه: letAmendOpen → فرم → letAmendSave → چاپ
   (همان مسیری که کاربر با دکمهٔ «📝 اصلاح» طی می‌کند)
   ══════════════════════════════════════════════════════════════════ */
head('F) مسیر UI اصلاحیه (فرم، مجوز، ثبت، تاریخچه)');

function formDom(c, over) {
  var v = {
    ltLang: 'fa', ltTo: 'جناب آقای محمدی', ltToRole: 'مدیر بازرگانی', ltSub: 'موضوع نامه',
    ltAtt: 'ندارد', ltPrj: '', ltSigner: 'boss', ltSignerOtherName: '', ltSignerOtherRole: '',
    ltFs: '', ltLh: '', ltFont: '', ltAlign: 'justify', ltSignFs: '', ltMt: '', ltMr: '', ltMb: '', ltMl: ''
  };
  Object.keys(over || {}).forEach(function (k) { v[k] = over[k]; });
  var e = c._els;
  Object.keys(v).forEach(function (id) { e[id] = { value: v[id], checked: false, innerHTML: '', innerText: '' }; });
  e.ltBsm = { checked: true, value: '' }; e.ltB = { checked: false }; e.ltI = { checked: false };
  e.ltBodyEditor = { innerHTML: '<p>متن نامه</p>', innerText: 'متن نامه', dataset: {}, addEventListener: function () {}, classList: { add: function () {}, remove: function () {} }, style: {} };
  e.panels = { html: '', insertAdjacentHTML: function (pos, h) { this.html += h; } };
  return e;
}

(function () {
  /* F1 — نویسندهٔ نامه با دلیل، فرم اصلاحیه را باز می‌کند */
  var store = storeWith({ boss: clone(PROFILE) }, [clone(BASE)]);
  var c = makeCtx(store, { promptValue: 'اشتباه تایپی در مبلغ' });
  formDom(c);
  c.letAmendOpen('L1');
  var h = c._els.panels.html || '';
  T('F1 | دکمهٔ «📝 اصلاح» فرم را با دلیل گرفته‌شده در حالت اصلاحیه باز می‌کند',
    h.indexOf('ثبت اصلاحیه') > -1 && h.indexOf('Rev.1') > -1 && (c.window._letAmend || {}).cd === 'L1' &&
    String((c.window._letAmend || {}).reason).indexOf('اشتباه') > -1, h.slice(0, 160));
  T('F1b | فرم اصلاحیه شمارهٔ ثابت نامه را نشان می‌دهد و دکمهٔ «ثبت پیش‌نویس» را حذف می‌کند',
    h.indexOf('1405/پ/ص/0007') > -1 && h.indexOf('ثبت پیش‌نویس') === -1);
})();

(function () {
  /* F2 — دلیل خالی: هیچ مودالی باز نمی‌شود */
  var store = storeWith({ boss: clone(PROFILE) }, [clone(BASE)]);
  var c = makeCtx(store, { promptValue: '   ' });
  formDom(c);
  c.letAmendOpen('L1');
  T('F2 | دلیل خالی، اصلاحیه را ثبت نمی‌کند و پنجره باز نمی‌شود',
    (c._els.panels.html || '') === '' && c._alerts.join('|').indexOf('دلیل اصلاح الزامی است') > -1);
})();

(function () {
  /* F3 — کاربر غیرمجاز (نه نویسنده، نه ارشد) */
  var L = clone(BASE); L.author = 'other'; L.authorNm = 'دیگری';
  var store = storeWith({ boss: clone(PROFILE) }, [L]);
  var c = makeCtx(store, { role: 'sales' });
  formDom(c);
  c.letAmendOpen('L1');
  T('F3 | کاربر بدون مجوز (نه نویسنده نه ارشد) اجازهٔ اصلاح نمی‌گیرد',
    (c._els.panels.html || '') === '' && c._alerts.join('|').indexOf('مجاز است') > -1, c._alerts.join(' | '));
})();

(function () {
  /* F4 — ثبت واقعی از فرم: متن عوض می‌شود، شماره ثابت، امضا باطل */
  var store = storeWith({ boss: clone(PROFILE) }, [clone(BASE)]);
  var c = makeCtx(store, { promptValue: 'اصلاح مبلغ' });
  formDom(c);
  c.letAmendOpen('L1');
  c._els.ltBodyEditor.innerHTML = '<p>متن اصلاح‌شدهٔ نامه</p>';
  c._els.ltBodyEditor.innerText = 'متن اصلاح‌شدهٔ نامه';
  c._els.ltSub.value = 'موضوع اصلاح‌شده';
  c.letAmendSave();
  var l = store.ptf_crm_letters[0];
  T('F4 | ثبت اصلاحیه از فرم: Rev.1، همان شماره، متن جدید، نسخهٔ قبلی بایگانی',
    l.rev === 1 && l.no === '1405/پ/ص/0007' && l.subject === 'موضوع اصلاح‌شده' &&
    (l.body || '').indexOf('اصلاح‌شده') > -1 && (l.revs || []).length === 1 &&
    l.revs[0].subject === 'موضوع نامه' && l.revs[0].reason === 'اصلاح مبلغ');
  T('F4b | تغییر ماهوی: امضا باطل، نامه در انتظار امضا، امضاکننده مطلع',
    l.st === 'pending' && !l.signatureSnapshot && !!l.sigInvalidated &&
    c._notifies.some(function (n) { return (n.toUsers || []).indexOf('boss') > -1 && n.kind === 'sign_req'; }));
  T('F4c | دلیل و اقلام تغییر در سابقهٔ نامه ثبت می‌شود',
    (l.amendments || []).length === 1 && l.amendments[0].rev === 1 && l.amendments[0].reason === 'اصلاح مبلغ' &&
    l.amendments[0].changed.indexOf('bodyHtml') > -1 && l.amendments[0].changed.indexOf('subject') > -1 && c._audits.some(function (a) { return String(a[1]).indexOf('اصلاح نامه') > -1 && String(a[1]).indexOf('Rev.1') > -1; }));
  T('F4d | چاپ جاری Rev.1 را نشان می‌دهد (بدون امضا چون باطل شده)', printed(c, l, true).indexOf('Rev.1') > -1);
})();

(function () {
  /* F5 — تاریخچهٔ نسخه‌ها + دکمهٔ چاپ نسخهٔ قبلی */
  var store = storeWith({ boss: clone(PROFILE) }, [clone(BASE)]);
  var c = makeCtx(store, { promptValue: 'اصلاح متن' });
  formDom(c);
  c.letAmendOpen('L1');
  c._els.ltBodyEditor.innerHTML = '<p>نسخهٔ دوم</p>';
  c._els.ltBodyEditor.innerText = 'نسخهٔ دوم';
  c.letAmendSave();
  c._els.panels.html = '';
  c.letAmendHistory('L1');
  var h = c._els.panels.html || '';
  T('F5 | «📚 نسخه‌ها» نسخهٔ جاری و نسخهٔ بایگانی را با دکمهٔ چاپ نشان می‌دهد',
    h.indexOf('(جاری)') > -1 && h.indexOf('{rev:0}') > -1 && h.indexOf('اصلاح متن') > -1, h.slice(0, 200));
})();

(function () {
  /* F6 — _collectLetter تصویر داخل متن و پیوست تصویری را به دارایی تبدیل می‌کند */
  var store = storeWith({ boss: clone(PROFILE) }, []);
  var c = makeCtx(store);
  formDom(c);
  c._els.ltBodyEditor.innerHTML = '<p>متن</p><img src="' + PNG_SIG + '">';
  c.window._ltImgs = [{ src: PNG_STAMP, cap: 'پیوست' }];
  var l = c._collectLetter(null);
  T('F6 | تصویر داخل متن و تصاویر پیوست به دارایی تبدیل می‌شوند (رشته‌های کوتاه)',
    /ptfasset:_asset_IMG-[A-Za-z0-9]+/.test(l.bodyHtml) && l.bodyHtml.indexOf(PNG_SIG) === -1 &&
    l.images.length === 1 && /^_asset_IMG-/.test(l.images[0].asset || '') && !l.images[0].src);
  T('F6b | دارایی‌ها در همان کلید map ذخیره می‌شوند و تصویر اصلی بازیابی‌پذیر است',
    Object.keys(store.ptf_crm_sigprofiles).filter(function (k) { return k.indexOf('_asset_') === 0; }).length === 2 &&
    c.letHtmlExpand(l.bodyHtml).indexOf(PNG_SIG) > -1);
})();

console.log('\n══════════════════════════════════════════════════════════════');
console.log('tester710 v34.39.60 — ' + P + ' PASS / ' + F + ' FAIL');
console.log('══════════════════════════════════════════════════════════════');
process.exit(F ? 1 : 0);
