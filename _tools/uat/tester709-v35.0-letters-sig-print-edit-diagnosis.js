#!/usr/bin/env node
'use strict';
/* tester709 — «بررسی تشخیصی» (نه تست پین) برای دو گزارش کارفرما در ماژول مکاتبات:
   ① «امضا و مهر در پروفایل ذخیره شده است اما روی نامه نمی‌افتد»
   ② «باید امکان اصلاح متن نامه بعد از ثبت هم وجود داشته باشد»

   این فایل عمداً FAIL خودکار نمی‌سازد (خروجی همیشه 0) چون یک ابزار «بررسی» است،
   نه قرارداد نسخه. برای هر سنجه یکی از این برچسب‌ها چاپ می‌شود:
     PASS  = رفتار درست/مطابق طراحی
     GAP   = شکاف تأییدشده (ریشهٔ شکایت)
     INFO  = واقعیت کد که برای تصمیم‌گیری لازم است (خوب یا بد نیست)

   روش: خودِ crm/letters.js با هارنس vm (هم‌الگوی tester658/tester502) بارگذاری
   می‌شود و توابع واقعی letPrintObj / letPrint / letSign / letSubmit / letSaveDraft /
   renderLetters اجرا می‌شوند. هیچ mock از منطق امضا/چاپ در مسیر سنجش نیست؛ فقط
   DOM/ذخیره‌سازی/چاپ‌گر جایگزین شده‌اند.
*/
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var letters = fs.readFileSync(path.join(ROOT, 'crm/letters.js'), 'utf8');

var P = 0, G = 0, I = 0;
function ok(n, extra) { P++; console.log('PASS  ' + n + (extra ? '\n        ↳ ' + extra : '')); }
function gap(n, extra) { G++; console.log('GAP   ' + n + (extra ? '\n        ↳ ' + extra : '')); }
function info(n, extra) { I++; console.log('INFO  ' + n + (extra ? '\n        ↳ ' + extra : '')); }
function head(t) { console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 74 - t.length))); }

/* ---------------- sandbox ---------------- */
function makeCtx(store, session) {
  session = session || { user: 'boss', name: 'مدیر عامل' };
  var previews = [], alerts = [], confirms = [], audits = [];
  var els = {};
  function el(id) { return els[id] || null; }
  var ctx = {
    console: console, JSON: JSON, Math: Math, Date: Date, Number: Number, String: String,
    Object: Object, Array: Array, RegExp: RegExp, Error: Error, isNaN: isNaN,
    parseInt: parseInt, parseFloat: parseFloat, encodeURIComponent: encodeURIComponent,
    setTimeout: function () { return 0; }, clearTimeout: function () {},
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
      getElementById: el,
      querySelectorAll: function () { return []; },
      createElement: function () { return { style: {}, setAttribute: function () {}, appendChild: function () {} }; },
      body: { appendChild: function () {} }
    },
    getData: function (k) { return store[k] === undefined ? [] : store[k]; },
    setData: function (k, v) { store[k] = JSON.parse(JSON.stringify(v)); return true; },
    curSession: function () { return session; },
    curRole: function () { return 'admin'; }, roleDef: function () { return { panels: '*' }; },
    isSenior: function () { return true; },
    genCode: function () { return 'L-' + (++ctx._seq); }, _seq: 0,
    faDate: function () { return '1405/08/02'; }, faDateTime: function () { return '1405/08/02 11:00'; },
    faYear: function () { return '1405'; },
    escP: function (v) { return String(v == null ? '' : v); },
    ptfOnClickArg: function (v) { return String(v == null ? '' : v); },
    hideModal: function () {}, goPanel: function () {},
    audit: function (a, b, c) { audits.push([a, b, c]); },
    notify: function () {},
    alert: function (m) { alerts.push(String(m)); },
    confirm: function (m) { confirms.push(String(m)); return false; },
    ptfPreviewPrintableDoc: function () { previews.push([].slice.call(arguments)); },
    ptfLetterSignerMode: function () {}, ptfLtImgRender: function () {},
    letEditorWirePasteAndDrop: function () {}, letSyncDocFont: function () {}
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx._previews = previews; ctx._alerts = alerts; ctx._confirms = confirms; ctx._audits = audits;
  ctx._els = els;
  ctx._storeRef = store;
  vm.createContext(ctx);
  vm.runInContext(letters, ctx, { filename: 'letters-runtime.js' });
  /* sanitize واقعی به DOM متکی است؛ در این هارنس identity است تا رفتار
     انتخاب منبع امضا/چاپ جدا از sanitize سنجیده شود. */
  ctx.letSafeBodyHtml = function (h) { return String(h == null ? '' : h); };
  return ctx;
}
function printed(ctx, letter, includeSig) {
  var keep = ctx.getData;
  ctx.getData = function (k) {
    if (k === 'ptf_crm_letters') return [letter];
    return ctx._storeRef[k] === undefined ? [] : ctx._storeRef[k];
  };
  ctx.letPrint(letter.cd, false, includeSig);
  ctx.getData = keep;
  var pv = ctx._previews[ctx._previews.length - 1];
  return (pv && pv[1]) || '';
}
/* v34.39.60: تصاویر آزمایشی باید «data URL معتبر» باشند (PNG واقعی ۲×۲)؛ رشته‌های
   ساختگی مثل «base64,SIG» طبق قرارداد جدید (فقط تصویر سالم چاپ می‌شود) رد می‌شوند. */
var PNG_SIG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR42mPgEpH7D8IMMAYAJowE7d8n2J0AAAAASUVORK5CYII=';
var PNG_STAMP = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR42mM4ISf3H4QZYAwARzQIDRsnkbcAAAAASUVORK5CYII=';
var PNG_SIG2 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR42mNgZGL+D8IMMAYAHtAEFedeeTQAAAAASUVORK5CYII=';
var PNG_STAMP2 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR42mNgYWX7D8IMMAYAICYEOWzbY/kAAAAASUVORK5CYII=';
function hasSig(html) { return html.indexOf(PNG_SIG) > -1; }
function hasStamp(html) { return html.indexOf(PNG_STAMP) > -1; }
function hasSig2(html) { return html.indexOf(PNG_SIG2) > -1; }
function hasStamp2(html) { return html.indexOf(PNG_STAMP2) > -1; }

var PROFILE_BOTH = { nm: 'مدیر عامل', role: 'مدیرعامل', sig: PNG_SIG, stamp: PNG_STAMP, updatedAtISO: '2026-10-20T08:00:00Z' };

var BASE = {
  cd: 'L1', kind: 'OUT', st: 'signed', lang: 'fa', no: '1405/پ/ص/0007',
  to: 'جناب آقای محمدی', toRole: 'مدیر بازرگانی', subject: 'موضوع نامه',
  body: 'متن نامه', bodyHtml: '<p>متن نامه</p>', style: {}, t: '1405/08/01',
  signer: 'boss', signerNm: 'مدیر عامل', signerRole: 'مدیرعامل', author: 'boss', authorNm: 'مدیر عامل',
  signatureSnapshot: { sig: PNG_SIG, stamp: PNG_STAMP, nm: 'مدیر عامل', role: 'مدیرعامل', at: '1405/08/01 09:00' }
};
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function storeWith(profiles, lettersArr) {
  return { ptf_crm_letters: lettersArr || [], ptf_crm_sigprofiles: profiles || {}, ptf_crm_users: [], ptf_crm_projects: [] };
}

/* ══════════════════════════════════════════════════════════════════
   بخش A — «امضا و مهر ذخیره شده اما روی نامه نمی‌افتد»
   ══════════════════════════════════════════════════════════════════ */
head('A) مسیر چاپ نامه — چه زمانی تصویر مهر/امضا درج می‌شود؟');

/* A1 — حالت استاندارد: نامهٔ امضاشده + snapshot کامل + دکمهٔ «با امضای دیجیتال» */
(function () {
  var c = makeCtx(storeWith({ boss: clone(PROFILE_BOTH) }, [clone(BASE)]));
  var h = printed(c, clone(BASE), true);
  if (hasSig(h) && hasStamp(h)) ok('A1 | نامهٔ «امضا شد» + snapshot کامل + خروجی «با امضای دیجیتال» ⇒ هر دو تصویر درج می‌شوند', 'img.s و img.st در HTML چاپ موجودند');
  else gap('A1 | حتی حالت استاندارد هم تصویر ندارد (باید فوراً بررسی شود)', 'sig=' + hasSig(h) + ' stamp=' + hasStamp(h));
})();

/* A2 — همان نامه با خروجی «بدون امضا / چاپ فیزیکی» */
(function () {
  var c = makeCtx(storeWith({ boss: clone(PROFILE_BOTH) }, [clone(BASE)]));
  var h = printed(c, clone(BASE), false);
  var phys = h.indexOf('محل مهر و امضای فیزیکی') > -1;
  if (!hasSig(h) && !hasStamp(h) && phys) info('A2 | خروجی «بدون امضا / چاپ فیزیکی» عمداً تصاویر را حذف و خط «محل مهر و امضای فیزیکی» می‌گذارد', 'این کار «طبق طراحی» است؛ اگر کاربر این دکمه را بزند، تصویر ذخیره‌شده روی نامه نمی‌آید');
  else gap('A2 | رفتار خروجی فیزیکی با طراحی نمی‌خواند', 'sig=' + hasSig(h) + ' physicalLine=' + phys);
})();

/* A3 — نامهٔ ثبت‌شده برای امضای فیزیکی (signer = سایر) */
(function () {
  var l = clone(BASE);
  l.st = 'registered'; l.signerMode = 'other'; l.manualSignature = true; l.no = '1405/پ/ص/0008';
  delete l.signatureSnapshot;
  var c = makeCtx(storeWith({ boss: clone(PROFILE_BOTH) }, [l]));
  var h = printed(c, l, false); /* همان آرگومانی که UI برای registered می‌فرستد */
  if (!hasSig(h) && !hasStamp(h)) info('A3 | نامهٔ «ثبت شد / امضای فیزیکی» هیچ تصویری درج نمی‌کند', 'حتی اگر پروفایل کاربر مهر و امضا داشته باشد — ریشهٔ ممکن شکایت اگر گردش کار کارفرما «سایر/فیزیکی» باشد');
  else gap('A3 | نامهٔ registered نباید تصویر دیجیتال بگذارد', 'sig=' + hasSig(h));
})();

/* A4 — نامهٔ در انتظار امضا */
(function () {
  var l = clone(BASE); l.st = 'pending'; delete l.signatureSnapshot;
  var c = makeCtx(storeWith({ boss: clone(PROFILE_BOTH) }, [l]));
  var h = printed(c, l, false);
  if (!hasSig(h) && !hasStamp(h)) info('A4 | نامهٔ «در انتظار امضا» تصویر ندارد (تا امضا نشود)', 'طبق طراحی');
})();

/* A5 — snapshot ناقص: امضا هست، مهر نه (نامه قبل از ثبت مهر امضا شده) و پروفایل الان هر دو را دارد */
(function () {
  var l = clone(BASE);
  l.signatureSnapshot = { sig: PNG_SIG, stamp: '', nm: 'مدیر عامل', role: 'مدیرعامل', at: '1405/08/01 09:00' };
  var prof = { nm: 'مدیر عامل', role: 'مدیرعامل', sig: PNG_SIG, stamp: PNG_STAMP, updatedAtISO: '2026-10-20T08:00:00Z' };
  var c = makeCtx(storeWith({ boss: prof }, [l]));
  var h = printed(c, l, true);
  if (hasSig(h) && !hasStamp(h)) {
    gap('A5 | مهر «ذخیره‌شده» روی نامه نمی‌آید: snapshot بدون مهر بر پروفایلِ دارای مهر اولویت دارد',
      'کد: letPrintObj → var sigP = (l.st===… ) ? (l.signatureSnapshot || letResolveSignerProfile(l) || signerProfile) : {}؛ چون snapshot شیءِ truthy است، تصویر تازه‌ثبت‌شدهٔ مهر هرگز از پروفایل خوانده نمی‌شود. (snapshot.sig=' + (l.signatureSnapshot.sig ? 'دارد' : 'خالی') + '، snapshot.stamp=خالی، profile.stamp=دارد)');
  } else if (hasStamp(h)) ok('A5 | snapshot ناقص، تصویر مهر پروفایل را می‌گیرد');
  else gap('A5 | هیچ تصویری درج نشد', 'sig=' + hasSig(h) + ' stamp=' + hasStamp(h));
})();

/* A6 — snapshot کاملاً بی‌تصویر (مثلاً بعد از sync/بازیابی ناقص) و پروفایل پر */
(function () {
  var l = clone(BASE);
  l.signatureSnapshot = { nm: 'مدیر عامل', role: 'مدیرعامل' };
  var c = makeCtx(storeWith({ boss: clone(PROFILE_BOTH) }, [l]));
  var h = printed(c, l, true);
  if (!hasSig(h) && !hasStamp(h)) {
    gap('A6 | snapshot موجود ولی بی‌تصویر ⇒ فالبک پروفایل اجرا نمی‌شود (هر دو تصویر گم می‌شوند)',
      'همان ریشهٔ A5: انتخاب منبع با truthiness انجام می‌شود نه با «آیا تصویر دارد؟». این حالت بعد از snapshotهای ناقص/قدیمی یا sync نیمه‌کاره واقع می‌شود.');
  } else ok('A6 | snapshot بی‌تصویر، تصاویر پروفایل را می‌گیرد');
})();

/* A7 — نامهٔ قدیمی بدون snapshot، کاربر تغییرنام داده (پروفایل با نام نمایشی) */
(function () {
  var l = clone(BASE);
  delete l.signatureSnapshot;
  l.signer = 'old_user';            /* کاربر حذف/تغییرنام‌یافته */
  l.signerNm = 'مدیر عامل';
  var profMap = { boss: clone(PROFILE_BOTH) }; /* پروفایل با نام نمایشی مطابق نامه */
  var c = makeCtx(storeWith(profMap, [l]));
  var h = printed(c, l, true);
  if (hasSig(h) && hasStamp(h)) ok('A7 | فالبک v34.9.2 (تطبیق نام نمایشی پروفایل) کار می‌کند');
  else gap('A7 | فالبک نام نمایشی کار نکرد', 'sig=' + hasSig(h));
})();

/* A8 — نامهٔ قدیمی بدون snapshot و نام نمایشی متفاوت از نام پروفایل */
(function () {
  var l = clone(BASE);
  delete l.signatureSnapshot;
  l.signer = 'ghost'; l.signerNm = 'نام قدیمی روی نامه';
  var prof = { nm: 'مدیر عامل', role: 'مدیرعامل', sig: PNG_SIG, stamp: PNG_STAMP };
  var c = makeCtx(storeWith({ boss: prof }, [l]));
  var h = printed(c, l, true);
  if (!hasSig(h)) info('A8 | نامهٔ قدیمی بدون snapshot + عدم تطبیق نام/کاربری ⇒ بی‌تصویر (بدون هیچ هشداری)', 'کاربر هیچ پیامی نمی‌بیند که «امضا پیدا نشد»');
})();

/* A9 — پیش‌نمایش نامهٔ پیش‌نویس (letPreviewDraft) هرگز امضا ندارد */
(function () {
  var c = makeCtx(storeWith({ boss: clone(PROFILE_BOTH) }, []));
  var l = clone(BASE); l.st = 'draft'; delete l.signatureSnapshot;
  var h = printed(c, l, false);
  if (!hasSig(h) && htmlHasPreviewMark(h)) info('A9 | پیش‌نمایش پیش‌نویس عمداً بدون تصویر است (واترمارک PREVIEW)', 'طبق طراحی');
})();
function htmlHasPreviewMark(h) { return h.indexOf('پیش‌نویس / PREVIEW') > -1; }

/* A10 — مسیر «متن آماده روی سربرگ»: منبع تصویر فقط sigProfileFor(me) است */
(function () {
  var c = makeCtx(storeWith({ boss: clone(PROFILE_BOTH) }, []));
  var lh = letters.slice(letters.indexOf('window.ptfLetterheadPastePrint'), letters.indexOf('/* ---------- روتینگ'));
  var usesOnlySessionProfile = /sigProfileFor\(me\)/.test(lh) && lh.indexOf('letResolveSignerProfile') === -1 && lh.indexOf('signatureSnapshot') === -1;
  if (usesOnlySessionProfile) info('A10 | مسیر «متن آماده روی سربرگ» فقط پروفایل کاربر جاری را می‌خواند (بدون snapshot/فالبک نام)', 'اگر پروفایل با نام کاربری دیگری ذخیره شده باشد، این مسیر هم بی‌تصویر چاپ می‌کند');
})();

/* A11 — CSS: مهر/امضا در بلوک اتمیک و بدون شکست صفحه */
(function () {
  var c = makeCtx(storeWith({ boss: clone(PROFILE_BOTH) }, [clone(BASE)]));
  var h = printed(c, clone(BASE), true);
  var atomic = h.indexOf('.sig{margin-top:12mm;display:flex;justify-content:flex-end;direction:rtl;break-inside:avoid;page-break-inside:avoid}') > -1;
  var stampAbs = h.indexOf('.sigbox img.st{position:absolute') > -1;
  if (atomic) ok('A11 | بلوک امضا اتمیک است (اصلاح v34.38.23 سرجایش است)');
  if (stampAbs) info('A11b | مهر absolute داخل .sigbox قرار دارد (top:14mm) — در چاپ چندصفحه‌ای وابسته به اتمیک‌بودن والد است', 'این وابستگی در v34.38.23 با break-inside:avoid پوشش داده شده، ولی اگر مرورگر چاپ کلاسیک باشد (IE/برخی چاپگرهای صنعتی) ریسک جابه‌جایی هست');
})();

/* A12 — فشرده‌سازی تصویر در پروفایل: پاک‌سازی خودکار پس‌زمینه روشن */
(function () {
  var m = letters.match(/function _imgToDataUrl\(file, maxW, cb\) \{[\s\S]*?\n\}/);
  var aggressive = m && /lum > 235 && sat < 40/.test(m[0]) && /d\[i \+ 3\] = 0/.test(m[0]);
  if (aggressive) info('A12 | تصویر پروفایل هنگام ذخیره، پیکسل‌های روشن را کاملاً شفاف می‌کند (lum>235 و sat<40 ⇒ alpha=0)', 'برای مهر/امضای کم‌رنگ یا عکسِ مهر روی کاغذ روشن، همین می‌تواند تصویر را «ذخیره‌شده ولی نادیدنی» کند؛ مودال پروفایل هیچ پیش‌نمایشی از نتیجه نشان نمی‌دهد');
})();

/* A13 — ماندگاری snapshot پس از رفت‌وبرگشت ذخیره‌سازی (JSON/IDB) */
(function () {
  var store1 = storeWith({ boss: clone(PROFILE_BOTH) }, [clone(BASE)]);
  var c1 = makeCtx(store1);
  var h1 = printed(c1, clone(BASE), true);
  var reloaded = JSON.parse(JSON.stringify(store1));
  var c2 = makeCtx(reloaded);
  var h2 = printed(c2, reloaded.ptf_crm_letters[0], true);
  if (hasSig(h1) && hasStamp(h1) && hasSig(h2) && hasStamp(h2)) ok('A13 | snapshot تصاویر پس از ذخیره/بارگذاری (JSON round-trip) سالم می‌ماند');
  else gap('A13 | تصاویر پس از بارگذاری گم می‌شوند', 'before=' + hasSig(h1) + '/' + hasStamp(h1) + ' after=' + hasSig(h2) + '/' + hasStamp(h2));
})();

/* A14 — خط لولهٔ پیش‌نمایش چاپ (offers-pro/ui-kit) داده‌های data: را دست نمی‌زند */
(function () {
  var op = fs.readFileSync(path.join(ROOT, 'crm/offers-pro.js'), 'utf8');
  var uk = fs.readFileSync(path.join(ROOT, 'crm/ui-kit.js'), 'utf8');
  var clean = (op.match(/var _cleanHtml = String\(html \|\| ''\)\.replace\(([\s\S]{0,220}?);/) || [])[1] || '';
  var title = (uk.match(/window\.ptfPdfHtmlWithTitle = function \(html, fileName\) \{([\s\S]{0,420}?)\n\};/) || [])[1] || '';
  var stripsImages = /src\s*=|data:image|img/i.test(clean) || /src\s*=|data:image/i.test(title);
  if (!stripsImages) ok('A14 | پیش‌نمایش چاپ (srcdoc + ptfPdfHtmlWithTitle) هیچ src/data: را حذف نمی‌کند');
  else gap('A14 | خط لولهٔ پیش‌نمایش روی تصاویر دست می‌گذارد', clean.slice(0, 160));
})();

/* ── A15..A17: مسیر سرور (entity_upsert) و برش دادهٔ تصویر ──────────────
   این سه سنجه «ریشهٔ اصلی» را از خودِ کد سرور/کلاینت استخراج می‌کند، نه از حدس. */
head('A15) مسیر ذخیرهٔ نامه روی سرور — پاک‌ساز per-record');

function phpNestedStringLimit() {
  var php = fs.readFileSync(path.join(ROOT, 'api/sales-domain.php'), 'utf8');
  var fn = php.slice(php.indexOf('function sd_entity_sanitize_row'), php.indexOf('function sd_require_role'));
  /* v34.39.60: سقف‌ها دیگر عددِ ثابت داخل فراخوانی sd_text نیستند؛ «فیلدهای سنگین»
     نامه (bigFields رجیستری) تا پایان بودجهٔ ردیف سقف بلندتر می‌گیرند و بقیه همان
     پیش‌فرض‌های قبلی را دارند. این هارنس «سقف پیش‌فرض» را می‌خواند — همان مقداری
     که یک snapshot/رشتهٔ معمولی می‌بیند. */
  var m = fn.match(/\$subLimit = .*?:\s*(\d+)\s*;/);      /* رشتهٔ داخل map تو در تو */
  var m2 = fn.match(/\(\$bigFields\[\$k\] && \$bigBudget > 0\) \? \(int\)\$bigFields\[\$k\] : (\d+)/); /* رشتهٔ سطح ردیف */
  var listFn = php.slice(php.indexOf('function sd_entity_sanitize_list'), php.indexOf('function sd_entity_sanitize_row'));
  var m3 = listFn.match(/int \$itemLimit = (\d+)/);      /* رشتهٔ داخل map داخل لیست */
  return {
    nested: m ? +m[1] : null,
    topLevel: m2 ? +m2[1] : null,
    listItem: m3 ? +m3[1] : null,
    code: fn
  };
}
function base64Png(bytes) { /* یک data URL واقعی‌شکل با حجم قابل‌مقایسه با امضای فشرده */
  var raw = '';
  for (var i = 0; i < bytes; i++) raw += 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'[(i * 7 + 11) % 64];
  return 'data:image/png;base64,' + raw;
}
function base64PayloadValid(url) {
  var m = String(url || '').match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return false;
  var p = m[2];
  if (p.length % 4 !== 0) return false;
  try { return Buffer.from(p, 'base64').length > 8; } catch (e) { return false; }
}
(function () {
  var lim = phpNestedStringLimit();
  var sv = fs.readFileSync(path.join(ROOT, 'crm/sales-domain-v2.js'), 'utf8');
  var lettersEnabled = /'ptf_crm_letters':\s*true/.test(sv);
  var appliesProjection = /entityApplyProjection\(collection, data\[collection\], resp\.rev\)/.test(sv);
  var registry = /'ptf_crm_letters' => \[[\s\S]{0,200}?'maxFields' => 150/.test(fs.readFileSync(path.join(ROOT, 'api/sales-domain.php'), 'utf8'));
  if (lettersEnabled && registry && lim.nested) {
    info('A15a | نامه‌ها از مسیر فرمان entity_upsert ذخیره می‌شوند و ردیف از sd_entity_sanitize_row عبور می‌کند',
      'کلید فعال در PTF_ENTITY_CMD_ENABLED: ' + lettersEnabled + ' | رجیستری سرور (maxFields=150): ' + registry + ' | سقف رشتهٔ سطح ردیف: ' + lim.topLevel + ' | سقف رشتهٔ داخل map تو در تو: ' + lim.nested + ' | سقف رشتهٔ داخل map در لیست: ' + lim.listItem);
  } else {
    gap('A15a | استخراج قرارداد پاک‌سازی سرور ناقص بود', 'nested=' + lim.nested + ' top=' + lim.topLevel);
  }
  /* شبیه‌سازی همان برش روی یک امضای واقعی‌الحجم */
  var freshSig = base64Png(48000);   /* ≈ ۶۴KB data URL — اندازهٔ معمول امضای فشردهٔ 400px */
  var sentSnapshot = JSON.parse(JSON.stringify({ sig: freshSig, stamp: base64Png(36000), nm: 'مدیرعامل', role: 'مدیرعامل', at: '1405/08/01 09:00' }));
  /* همان کاری که PHP با map تو در تو می‌کند: sd_text($v2, 300) */
  Object.keys(sentSnapshot).forEach(function (k) {
    if (typeof sentSnapshot[k] === 'string') sentSnapshot[k] = sentSnapshot[k].substr(0, lim.nested); /* substr ≈ mb_substr برای ASCII */
  });
  var l = clone(BASE);
  l.signatureSnapshot = sentSnapshot;
  var c = makeCtx(storeWith({ boss: clone(PROFILE_BOTH) }, [l]));
  /* پروفایل هم خالی می‌شود تا «فالبک» تصویر را نجات ندهد (پروفایل روی سرور برش نمی‌خورد) */
  var h = printed(c, l, true);
  var imgTag = (h.match(/<img class="s" src="([^"]*)"/) || [])[1] || '';
  if (!base64PayloadValid(imgTag)) {
    gap('A15b | ریشهٔ اصلی: تصویر امضا/مهر در ردیف نامه روی سرور به ' + lim.nested + ' کاراکتر بریده می‌شود ⇒ data URL نامعتبر ⇒ تصویر روی نامه ظاهر نمی‌شود',
      'حجم امضای ارسالی: ' + Math.round(freshSig.length / 1024) + 'KB → ذخیره‌شده روی سرور: ' + sentSnapshot.sig.length + ' کاراکتر | صحت base64 پس از برش: ' + base64PayloadValid(imgTag) + ' | کلید معیوب: signatureSnapshot.sig (map تو در تو). nm/role کوتاه‌اند و سالم می‌مانند، پس نام و سمت روی نامه هست ولی مهر/امضا نیست.');
  } else {
    ok('A15b | برش سرور تصویر را خراب نمی‌کند');
  }
  /* v34.39.60: اکنون snapshot ساخته‌شده با letMakeSigSnapshot هیچ رشتهٔ بلندی ندارد؛
     همین snapshot را از همان پاک‌ساز (۳۰۰/۲۰۰۰/۸۰۰۰) عبور می‌دهیم و می‌سنجیم که
     پس از پروجکشن سرور، تصویر هنوز از دارایی خوانده و معتبر چاپ می‌شود. */
  (function () {
    var c = makeCtx(storeWith({ boss: clone(PROFILE_BOTH) }, [clone(BASE)]));
    var snap = c.letMakeSigSnapshot({ sig: PNG_SIG, stamp: PNG_STAMP }, 'مدیر عامل', 'مدیرعامل');
    var strings = [];
    (function walk(o) { Object.keys(o || {}).forEach(function (k) { if (typeof o[k] === 'string') strings.push(o[k]); }); })(snap);
    var longest = strings.reduce(function (a, b) { return a.length > b.length ? a : b; }, '');
    var fits = longest.length <= lim.nested;
    var projected = JSON.parse(JSON.stringify(snap));
    (function walkCut(o) { Object.keys(projected || {}).forEach(function (k) { if (typeof projected[k] === 'string') projected[k] = projected[k].substr(0, lim.nested); }); })(projected);
    var l2 = clone(BASE);
    l2.signatureSnapshot = projected;
    var c2 = makeCtx(storeWith({ boss: clone(PROFILE_BOTH) }, [l2]));
    var h2 = printed(c2, l2, true);
    if (fits && appliesProjection && hasSig(h2) && hasStamp(h2)) {
      ok('A15c | snapshot جدید از پاک‌ساز سرور سالم عبور می‌کند و پروجکشن سرور تصویر را خراب نمی‌کند',
        'بلندترین رشتهٔ snapshot: ' + longest.length + ' کاراکتر (سقف سرور: ' + lim.nested + ') | نمونه: ' + longest.slice(0, 40) + '… | چاپ پس از پروجکشن: مهر/امضا موجود');
    } else {
      gap('A15c | snapshot پس از پروجکشن سرور همچنان تصویر را از دست می‌دهد',
        'longestSnapshotString=' + longest.length + ' / cap=' + lim.nested + ' | sig=' + hasSig(h2) + ' stamp=' + hasStamp(h2));
    }
  })();
  /* مسیر دوم (v34.39.60): تصاویر متن نامه به ارجاع دارایی تبدیل می‌شوند؛ رشته‌های
     ذخیره‌شده در images[] باید کوتاه‌تر از سقف ۲۰۰۰ کاراکتری سرور باشند. */
  (function () {
    var c = makeCtx(storeWith({ boss: clone(PROFILE_BOTH) }, [clone(BASE)]));
    c.letAssetBegin();
    var arr = c.letImagesAssetify([{ src: PNG_SIG, cap: 'تصویر ۱' }]);
    var body = c.letHtmlAssetify('<p>متن</p><img src="' + PNG_SIG + '">');
    c.letAssetEnd();
    var maxLen = 0;
    JSON.stringify(arr).replace(/"([^"]*)"/g, function (m, v) { if (v.length > maxLen) maxLen = v.length; return m; });
    var bodyMax = (body.match(/"([^"]*)"/g) || [''])[0].length;
    var refsOnly = arr.length === 1 && arr[0].asset && !arr[0].src && /ptfasset:/.test(body) && body.indexOf(PNG_SIG) === -1;
    if (refsOnly && maxLen < (lim.listItem || 2000) && body.length < (lim.topLevel || 8000)) {
      ok('A16 | تصاویر متن نامه با ارجاع دارایی ذخیره می‌شوند (کوتاه‌تر از سقف‌های ۲۰۰۰/۸۰۰۰ سرور) و دیگر بریده نمی‌شوند',
        'images=[{asset:' + arr[0].asset + ', cap}] | بلندترین رشته: ' + maxLen + ' | طول bodyHtml پس از جای‌گذاری: ' + body.length);
    } else {
      gap('A16 | تصاویر متن نامه همچنان به‌صورت data URL در ردیف ذخیره می‌شوند', 'refsOnly=' + refsOnly + ' maxLen=' + maxLen + ' body=' + body.slice(0, 120));
    }
  })();
  /* مسیر سوم: بدنهٔ HTML سطح ردیف */
  var longBody = '<p>' + new Array(700).join('متن ') + '</p>';
  if (longBody.length > (lim.topLevel || 8000)) {
    info('A17 | bodyHtml سطح ردیف سقف ' + (lim.topLevel || 8000) + ' کاراکتری دارد؛ نامهٔ بلند/جدول‌دار می‌تواند ناقص ذخیره شود',
      'طول یک بدنهٔ نمونه: ' + longBody.length + ' کاراکتر — برش در sd_text($v, ' + (lim.topLevel || 8000) + ') بدون هیچ هشدار به کاربر');
  }
})();

/* ── A18: چرا پروفایل امضا سالم می‌ماند ولی نامه نه؟ (اثبات مکانیزم) ─────
   فرضیه: پروفایل «map» است ⇒ روتر فرمان، آرایه نبودن را می‌بیند و به مسیر
   legacy (setData → data_push) تنزل می‌دهد؛ آن مسیر پاک‌ساز per-record ندارد.
   نامه «آرایه» است ⇒ از entity_upsert می‌رود و برش ۳۰۰ کاراکتری می‌خورد. */
head('A18) مکانیزم «پروفایل سالم / نامه بریده» (تنزل روتر فرمان)');

(function () {
  var bigSig = base64Png(48000);
  var profMap = { boss: { nm: 'مدیر عامل', role: 'مدیرعامل', sig: bigSig, stamp: base64Png(36000), updatedAtISO: '2026-10-20T08:00:00Z' } };
  var c = makeCtx(storeWith(profMap, [clone(BASE)]));
  var seen = null;
  try { seen = c.sigProfileMap(); } catch (eA18) { seen = null; }
  var svSrc = fs.readFileSync(path.join(ROOT, 'crm/sales-domain-v2.js'), 'utf8');
  var guard = /if \(!Array\.isArray\(nextArr\)\) return legacyFallback\('not-array'\)/.test(svSrc);
  var legacyToSetData = /function legacyFallback\(reason\) \{\s*try \{ if \(typeof setData === 'function'\) setData\(collection, nextArr\); \}/.test(svSrc);
  if (seen && !Array.isArray(seen) && Array.isArray(c.getData('ptf_crm_letters')) === false) {
    /* getData در این هارنس برای کلید نامه آرایهٔ تست را برمی‌گرداند؛ برای سنجش نوع، مستقیم store را می‌خوانیم */
  }
  if (seen && typeof seen === 'object' && !Array.isArray(seen) && guard && legacyToSetData) {
    ok('A18a | پروفایل امضا از مسیر فرمان per-record عبور نمی‌کند (map است ⇒ legacyFallback(not-array) ⇒ setData/data_push)؛ پس تصویر ۴۸KB آن سالم می‌ماند',
      'sigProfileMap() نوع ' + (Array.isArray(seen) ? 'array' : 'object') + ' | گارد sales-domain-v2.js:703 present: ' + guard + ' | legacyFallback → setData: ' + legacyToSetData +
      ' | حجم sig در پروفایل پس از ذخیره: ' + Math.round(String((seen.boss || {}).sig || '').length / 1024) + 'KB (بدون برش)');
  } else {
    gap('A18a | مسیر پروفایل امضا با فرض «data_push بدون پاک‌ساز» هم‌خوان نبود', 'type=' + typeof seen + ' guard=' + guard + ' legacy=' + legacyToSetData);
  }

  var lettersArr = fs.readFileSync(path.join(ROOT, 'crm/letters.js'), 'utf8');
  var letterCmdCalls = (lettersArr.match(/ptfEntitySaveCollection\('ptf_crm_letters',\s*[A-Za-z_$][\w$]*/g) || []).length;
  var profCmdCall = /ptfEntitySaveCollection\('ptf_crm_sigprofiles',\s*profiles/.test(lettersArr);
  if (letterCmdCalls > 0 && profCmdCall) {
    ok('A18b | نامه‌ها همیشه «آرایه» به روتر می‌دهند (entity_upsert) و پروفایل «map» (تنزل به setData) — همین تفاوت، تفاوت رفتار دو مسیر را توضیح می‌دهد',
      'فراخوانی فرمانی نامه با آرایه: ' + letterCmdCalls + ' مورد | فراخوانی پروفایل با map: ' + profCmdCall);
  } else {
    gap('A18b | تفکیک مسیر آرایه/map در کد تأیید نشد', 'letters=' + letterCmdCalls + ' profileMap=' + profCmdCall);
  }

  var crmPhp = fs.readFileSync(path.join(ROOT, 'api/crm.php'), 'utf8');
  var allKeys = (crmPhp.match(/function sync_all_keys\(\)[\s\S]*?\];/) || [''])[0];
  var inAll = allKeys.indexOf("'ptf_crm_sigassets'") > -1;
  var inCrm = /\$crm = \[[^\]]*'ptf_crm_sigprofiles'/.test(crmPhp);
  info('A18c | نکتهٔ اجرایی راهکار: کلید asset جدید (اگر map باشد) هم از همان مسیر data_push می‌رود، ولی برای نقش‌های غیرارشد باید به فهرست‌های مجاز api/crm.php اضافه شود؛ گزینهٔ «asset داخل خودِ ptf_crm_sigprofiles» هیچ تغییری در فهرست کلیدها لازم ندارد',
    "'ptf_crm_sigassets' در sync_all_keys: " + inAll + ' (باید افزوده شود) | ptf_crm_sigprofiles در فهرست نقش‌های عادی: ' + inCrm + ' ⇒ جای‌گذاری asset داخل sigprofiles با کلید پیشوندی، بدون تغییر RBAC کار می‌کند.');
})();

/* ══════════════════════════════════════════════════════════════════
   بخش B — «اصلاح متن نامه بعد از ثبت»
   ══════════════════════════════════════════════════════════════════ */
head('B) امکان اصلاح متن نامه بعد از ثبت (draft/rejected در برابر signed/registered)');

function domWith(vals) {
  var defaults = {
    ltLang: 'fa', ltTo: 'جناب آقای محمدی', ltToRole: 'مدیر بازرگانی', ltSub: 'موضوع نامه',
    ltAtt: 'ندارد', ltPrj: '', ltSigner: '__me__', ltSignerOtherName: '', ltSignerOtherRole: '',
    ltFs: '', ltLh: '', ltFont: '', ltAlign: 'justify', ltSignFs: '',
    ltMt: '', ltMr: '', ltMb: '', ltMl: ''
  };
  Object.keys(vals || {}).forEach(function (k) { defaults[k] = vals[k]; });
  var els = {};
  Object.keys(defaults).forEach(function (id) {
    els[id] = { value: defaults[id], checked: false, innerHTML: '', innerText: '' };
  });
  els.ltBodyEditor = { value: '', checked: false, innerHTML: '<p>متن اصلاح‌شدهٔ نامه</p>', innerText: 'متن اصلاح‌شدهٔ نامه' };
  els.ltBsm = { value: '', checked: true, innerHTML: '', innerText: '' };
  els.ltB = { value: '', checked: false, innerHTML: '', innerText: '' };
  els.ltI = { value: '', checked: false, innerHTML: '', innerText: '' };
  return els;
}

/* B1 — دکمهٔ «✏️» در فهرست مکاتبات برای نامهٔ ثبت‌شده وجود ندارد */
(function () {
  var c = makeCtx(storeWith({ boss: clone(PROFILE_BOTH) }, [clone(BASE)]));
  var wrap = { innerHTML: '' };
  c.document.getElementById = function (id) { return id === 'ltWrap' ? wrap : null; };
  c.renderLetters();
  var h = wrap.innerHTML;
  var hasAmend = h.indexOf('letAmendOpen(') > -1;
  var hasPrint = h.indexOf('با امضای دیجیتال') > -1;
  if (hasAmend && hasPrint) ok('B1 | نامهٔ ثبت‌شده در فهرست دکمهٔ «📝 اصلاح» دارد (نویسنده یا نقش ارشد) — بدون از دست دادن شمارهٔ نامه', 'دکمهٔ اصلاح در سطر نامهٔ «امضا شد» رندر می‌شود');
  else gap('B1 | نامهٔ ثبت‌شده هیچ مسیر اصلاحی در فهرست ندارد', 'hasAmend=' + hasAmend + ' hasPrint=' + hasPrint);
  info('B1b | سطر نامهٔ امضاشده در فهرست چه دارد؟', 'چاپ با امضا + بدون امضا + کپی به پیش‌نویس + 📝 اصلاح + حذف');
})();

/* B2 — مودال ویرایش خودش گارد وضعیت ندارد (فقط دکمه پنهان است) */
(function () {
  var guarded = /function showLetterModal\(cd\) \{[\s\S]{0,400}?st === 'signed'/.test(letters);
  if (!guarded) info('B2 | showLetterModal هیچ گاردی روی وضعیت نامه ندارد؛ فقط دکمهٔ ورودی مخفی است', 'یعنی داده و فرم آمادهٔ ویرایش‌اند؛ مشکل «نداشتن مسیر» است نه «غیرممکن بودن»');
})();

/* B3 — اگر نامهٔ ثبت‌شده از فرم ارسال شود: شمارهٔ قطعی عوض می‌شود */
(function () {
  var store = storeWith({ boss: clone(PROFILE_BOTH) }, [clone(BASE)]);
  var c = makeCtx(store);
  c.document.getElementById = function (id) { return domWith({})[id] || null; };
  var before = clone(store.ptf_crm_letters[0]);
  c.letSubmit('L1');
  var after = store.ptf_crm_letters[0];
  if (after.no !== before.no) {
    gap('B3 | «تایید و ثبت» روی نامهٔ ثبت‌شده، شمارهٔ اندیکاتور جدید صادر می‌کند (سند قبلی از بین می‌رود)',
      'قبل: ' + before.no + ' → بعد: ' + after.no + ' | کد: letSubmit → l.no = letSerial(\'OUT\', l.lang) بدون بررسی st و بدون نگه‌داشتن شمارهٔ قبلی');
  } else ok('B3 | شمارهٔ نامه پس از ارسال مجدد حفظ می‌شود');
  info('B3b | وضعیت/تاریخ/امضا پس از این «ویرایش»', 'st=' + after.st + ' | t: ' + before.t + ' → ' + after.t + ' | signedT=' + after.signedT + ' | snapshot.at=' + ((after.signatureSnapshot || {}).at));
  if (after.signatureSnapshot && before.signatureSnapshot && after.signatureSnapshot.at !== before.signatureSnapshot.at) {
    info('B3c | امضای تاریخی نامه با امضای جدید بازنویسی می‌شود', 'snapshot.at: ' + before.signatureSnapshot.at + ' → ' + after.signatureSnapshot.at);
  }
})();

/* B4 — «ثبت پیش‌نویس» روی نامهٔ ثبت‌شده: امضا و وضعیت پاک، شماره می‌ماند */
(function () {
  var store = storeWith({ boss: clone(PROFILE_BOTH) }, [clone(BASE)]);
  var c = makeCtx(store);
  c.document.getElementById = function (id) { return domWith({})[id] || null; };
  c.letSaveDraft('L1');
  var after = store.ptf_crm_letters[0];
  if (after.st === 'draft' && !after.signatureSnapshot && after.no === '1405/پ/ص/0007') {
    gap('B4 | «ثبت پیش‌نویس» روی نامهٔ ثبت‌شده آن را به پیش‌نویس برمی‌گرداند، امضا را پاک می‌کند و شمارهٔ قطعی را نگه می‌دارد',
      'نتیجه: پیش‌نویس با شمارهٔ رسمی + از دست رفتن امضای تاریخی (کد: letSaveDraft → l.st=\'draft\' + delete l.signatureSnapshot)');
  } else ok('B4 | ثبت پیش‌نویس روی نامهٔ ثبت‌شده رفتار امن دارد');
})();

/* B5 — هیچ تاریخچه/نسخه‌ای از اصلاح ثبت نمی‌شود */
(function () {
  var store = storeWith({ boss: clone(PROFILE_BOTH) }, [clone(BASE)]);
  var c = makeCtx(store);
  c.document.getElementById = function (id) { return domWith({})[id] || null; };
  c.letSubmit('L1');
  var after = store.ptf_crm_letters[0];
  var modelOk = /function letApplyAmendment\(cd, reason, patch\)/.test(letters) &&
    /l\.revs = revs/.test(letters) && /l\.amendments\.push/.test(letters) &&
    /function letArchivedRevision\(l\)/.test(letters) && /LET_REV_MAX = 5/.test(letters);
  if (modelOk) ok('B5 | مدل نسخه‌دار موجود است: rev / revs (سقف ۵ نسخه) / amendments / statusHistory + بایگانی نسخهٔ قبلی');
  else gap('B5 | مدل نسخه/اصلاح ناقص است', 'letApplyAmendment/revs/amendments/letArchivedRevision/LET_REV_MAX');
})();

/* B6 — تنها راه امروز: «کپی به پیش‌نویس» */
(function () {
  var store = storeWith({ boss: clone(PROFILE_BOTH) }, [clone(BASE)]);
  var c = makeCtx(store);
  store.ptf_crm_letters = [clone(BASE)];
  c.document.getElementById = function (id) {
    if (id === 'panels') return { insertAdjacentHTML: function () {} };
    return null;
  };
  c.letCopyAsDraft('L1');
  var copy = store.ptf_crm_letters.filter(function (x) { return x.cd !== 'L1'; })[0] || {};
  if (copy.cd && copy.st === 'draft' && !copy.signatureSnapshot && /\(کپی\)$/.test(copy.subject || '')) {
    info('B6 | تنها مسیر موجود «📋 کپی به پیش‌نویس» است', 'کد جدید=' + copy.cd + ' | شماره خالی | موضوع «' + copy.subject + '» | متن/تنظیمات حفظ، امضا پاک — اما سند اصلی با همان متنِ نادرست باقی می‌ماند و ارجاع‌ها (پرونده/نامه‌های مرتبط) به سند قدیمی می‌مانند');
  }
})();

/* B7 — چاپ/ارجاع به متن، منبع واحد دارد؟ (برای اصلاح، باید هر دو body و bodyHtml به‌روز شوند) */
(function () {
  var collectsBoth = /l\.bodyHtml = letHtmlAssetify\(letSafeBodyHtml\(editor \? editor\.innerHTML : ''\)\);[\s\S]{0,160}?l\.body = editor \? \(editor\.innerText \|\| ''\)\.trim\(\) : '';/.test(letters);
  if (collectsBoth) ok('B7 | فرم ویرایش هر دو فیلد bodyHtml و body را می‌نویسد (چاپ و جستجو هم‌زمان به‌روز می‌شوند)');
  else gap('B7 | ناهمگامی body/bodyHtml در فرم ویرایش', 'چاپ bodyHtml را می‌خواند و جستجو/خلاصه body را');
})();

/* ══════════════════════════════════════════════════════════════════ */
console.log('\n══════════════════════════════════════════════════════════════');
console.log('خلاصهٔ بررسی: ' + P + ' PASS / ' + G + ' GAP / ' + I + ' INFO');
console.log('این فایل «ابزار تشخیص» است و عمداً exit code صفر می‌دهد؛');
console.log('پس از اصلاح، هر GAP باید به PASS تبدیل و در گیت CI پین شود.');
console.log('══════════════════════════════════════════════════════════════');
process.exit(0);
