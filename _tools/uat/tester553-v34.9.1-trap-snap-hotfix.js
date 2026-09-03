#!/usr/bin/env node
'use strict';
/* tester553 — v34.35.0 (HOTFIX): بستن پمپ snapshot + تلهٔ «سبزِ ناتمام» + شفافیت dirty + پیام خطای دقیق
   RCA پروداکشن ۲۰۲۶-۰۸-۳۰/۳۱: (۱) snapshotهای پیش-pull بی‌سقف/بی‌انقضا و bypass آینه ⇒ پرشدن
   بازگشتی LS روی دستگاه فعال؛ (۲) enabled && !synced هر سه در نجات UI را کور می‌کرد؛
   (۳) کاربر موبایل بدون کنسول هیچ دیدی به کلید dirty گیرکرده نداشت؛ (۴) پیام خطای
   ذخیره علت واقعی (Quota/Security) را نمی‌گفت. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
var ih = read('crm/index.html');
var sy = read('crm/sync.js');
var bak = read('crm/backup.js');

function fnSrc(src, header) {
  var i = src.indexOf(header);
  if (i < 0) throw new Error('anchor-missing: ' + header);
  var depth = 0, seen = false;
  for (var j = i; j < Math.min(i + 20000, src.length); j++) {
    var c = src[j];
    if (c === '{') { depth++; seen = true; }
    else if (c === '}') { depth--;
      if (seen && depth === 0) return src.slice(i, j + 1);
    }
  }
  throw new Error('fn-end-missing: ' + header);
}

/* ═══ ۱) SNAP-PUMP — بستن حلقهٔ پرشدن ═══ */
T('پمپ: جاروی انقضای ۲۴ ساعتهٔ snapshotها تعریف شد', sy.indexOf('function sweepStalePrePullSnaps()') > -1 && sy.indexOf('24 * 3600 * 1000') > -1);
T('پمپ: هر pull قبل از snapshot، جارو را صدا می‌زند', sy.indexOf('try { sweepStalePrePullSnaps(); } catch (eSweep) {}') > -1);
T('پمپ: سقف بایت snapshot (۲۵۶KB) روی مسیر LS', sy.indexOf('SNAP_MAX_BYTES = 262144') > -1 && sy.indexOf('snapBytes + v.length * 2 > SNAP_MAX_BYTES') > -1);
T('پمپ: آینهٔ فعال ⇒ snapshot سبک با کلید ثابت در IDB (نه LS)', sy.indexOf("ptfStorageIdbSet('ptf_snap:prepull:last'") > -1 && sy.indexOf('_mirror') < 0);
T('پمپ: سقف تعداد ۳ نسخه حفظ شد', /while \(allSnaps\.length > 3\) \{ localStorage\.removeItem\(allSnaps\.shift\(\)\); \}/.test(sy));
T('پمپ: نوشتن LS فقط وقتی آینه خاموش است (شرط !mirrorOn دور جمع‌آوری)', sy.indexOf('if (!mirrorOn) {') > -1 && sy.indexOf("localStorage.setItem('ptf_pre_pull_snap_' + Date.now(), JSON.stringify(snap));") > -1);

/* رفتاری — vm: جاروی انقضا */
(function () {
  /* Date.now = 90,000,000 ⇒ cutoff = 3,600,000؛ کلید 1,000,000 قدیمی، کلید 89,000,000 تازه */
  var store = { 'ptf_pre_pull_snap_1000000': 'x', 'ptf_pre_pull_snap_89000000': 'y' };
  var removed = [];
  /* شبیه‌سازی Storage واقعی: کلیدهای داده enumerable، متدها non-enumerable —
     چون sweep با Object.keys(localStorage) پیمایش می‌کند (در مرورگر Storage همین‌رفتار را دارد). */
  var ls = Object.create(null);
  Object.keys(store).forEach(function (k) { ls[k] = store[k]; });
  ['getItem','setItem','removeItem','key'].forEach(function (m) {
    Object.defineProperty(ls, m, { enumerable: false, value: function (k, v) {
      if (m === 'getItem') return store[k] || null;
      if (m === 'setItem') { store[k] = v; return; }
      if (m === 'removeItem') { delete store[k]; removed.push(k); return; }
      return Object.keys(store)[k];
    } });
  });
  Object.defineProperty(ls, 'length', { enumerable: false, get: function () { return Object.keys(store).length; } });
  var sandbox = {
    localStorage: ls,
    Date: { now: function () { return 90000000; } },
    parseInt: parseInt, isNaN: isNaN, Object: Object
  };
  try {
    var out = vm.runInNewContext(fnSrc(sy, 'function sweepStalePrePullSnaps()') + '; sweepStalePrePullSnaps();', sandbox);
    T('پمپ/رفتاری: snapshot قدیمی‌تر از ۲۴ ساعت حذف و تازه نگه داشته می‌شود', removed.indexOf('ptf_pre_pull_snap_1000000') > -1 && removed.indexOf('ptf_pre_pull_snap_89000000') === -1 && out === 1);
  } catch (e) { T('پمپ/رفتاری: جاروی انقضا اجرا شد', false, String(e)); }
})();

/* ═══ ۲) TRANSPARENCY — سن dirty + رهایش امن ═══ */
T('شفافیت: ptfSyncDirtyInfo با سن هر کلید تعریف شد', sy.indexOf('window.ptfSyncDirtyInfo = function ()') > -1 && sy.indexOf('ageSec') > -1);
T('شفافیت: رهایش امن فقط whitelist لاگ/اعلان (audit/notifs/avatars)', sy.indexOf("window.ptfSyncDropDirtyKey = function (k)") > -1 && sy.indexOf("['ptf_crm_audit', 'ptf_crm_notifs', 'ptf_crm_avatars']") > -1);
T('شفافیت: چهار محل علامت‌گذاری dirty timestamp گرفتند (نه true)', (sy.match(/state\.dirty\[k\] = Date\.now\(\)/g) || []).length >= 4);
T('شفافیت: loadPersistedDirty سن عددی را حفظ می‌کند', sy.indexOf("(typeof raw[k] === 'number' && raw[k] > 0) ? raw[k] : true") > -1);

/* رفتاری — vm: DirtyInfo + DropDirtyKey */
(function () {
  var ctx = {
    window: {},
    state: { dirty: { ptf_crm_audit: 5000, ptf_crm_rfqs: 9000, ptf_crm_notifs: true } },
    Date: { now: function () { return 15000; } },
    Math: Math, Object: Object,
    _saved: null,
    saveDirty: function () { ctx._saved = JSON.stringify(ctx.state.dirty); },
    setSyncBadge: function () {},
    localStorage: { setItem: function () {}, getItem: function () { return null; }, removeItem: function () {} }
  };
  try {
    var info = vm.runInNewContext(fnSrc(sy, 'window.ptfSyncDirtyInfo = function ()') + '; window.ptfSyncDirtyInfo();', ctx);
    T('شفافیت/رفتاری: سن محاسبه و بر اساس کهنگی مرتب می‌شود', info.length === 3 && info[0].k === 'ptf_crm_audit' && info[0].ageSec === 10 && info[1].k === 'ptf_crm_rfqs' && info[1].ageSec === 6 && info[2].ageSec === -1);
    var drop = vm.runInNewContext(fnSrc(sy, 'window.ptfSyncDropDirtyKey = function (k)') + '; [window.ptfSyncDropDirtyKey("ptf_crm_rfqs"), window.ptfSyncDropDirtyKey("ptf_crm_audit"), Object.keys(state.dirty).join(",")];', ctx);
    T('شفافیت/رفتاری: کلید کسب‌وکار رد و کلید لاگ آزاد می‌شود', drop[0] === false && drop[1] === true && drop[2] === 'ptf_crm_rfqs,ptf_crm_notifs');
  } catch (e) { T('شفافیت/رفتاری: DirtyInfo/Drop اجرا شد', false, String(e)); }
})();

/* ═══ ۳) TRAP-FIX — جعبهٔ وضعیت دستگاه: سه حالت ═══ */
T('تله: جعبه حالت سبزِ ناتمام (enabled && !synced) را تشخیص می‌دهد', bak.indexOf('var on = !!st.enabled, synced = !!st.synced') > -1 && bak.indexOf('var green = on && synced;') > -1);
T('تله: دکمهٔ «تکمیل انتقال یک‌باره» برای سبزِ ناتمام (همان مسیر رسمی ptfBConfirmFlush)', bak.indexOf('(on ? \'تکمیل انتقال یک‌باره\' : \'انتقال یک‌بارهٔ داده‌های این دستگاه\')') > -1 && bak.indexOf("onclick=\"ptfBConfirmFlush()\"") > -1);
T('تله: عنوان حالت میانی متمایز است («فعال — در انتظار تکمیل انتقال»)', bak.indexOf('فعال — در انتظار تکمیل انتقال') > -1);
T('تله: سبز کامل همچنان فقط پاک‌سازی کش (بدون دکمهٔ انتقال)', /green\s*\?\s*'<button class="bt bt-o" style="color:#b45309" onclick="if\(window\.ptfBClearLocalCache\)ptfBClearLocalCache\(\)">🗑 پاک‌سازی کش محلی<\/button>'/.test(bak));
T('تله: متن هشدار سبزِ ناتمام علت پرشدن حافظه را می‌گوید', bak.indexOf('تا تکمیل آن، دادهٔ سنگین در همین حافظهٔ کوچک می‌ماند و مرورگر پر می‌شود') > -1);
T('تله: لیست کلیدهای در انتظار با سن در جعبه رندر می‌شود', bak.indexOf('ptfSyncDirtyInfo') > -1 && bak.indexOf('در انتظار ارسال به سرور:') > -1 && bak.indexOf('رها کردن امن') > -1);
T('تله: توضیح مسیر «تلاش مجدد ارسال» برای کلیدهای کسب‌وکار', bak.indexOf('برای سایر کلیدها «⬆ تلاش مجدد ارسال» را در «تشخیص همگام‌سازی»') > -1);

/* ═══ ۴) بنر مهاجرت — پوشش سبزِ ناتمام ═══ */
T('بنر: شرط کامل شد — فقط enabled && synced بنر را برمی‌دارد', ih.indexOf('if ((st.enabled && st.synced) || !st.localPayload) { if (bar) bar.remove(); return; }') > -1);
T('بنر: متن «تکمیل انتقال» برای حالت ناتمام', ih.indexOf('تکمیل انتقال یک‌باره') > -1 && ih.indexOf('var ptfMigFin = !!st.enabled;') > -1);
T('بنر: مسیر اصلاح‌شده با نام ردیف درست («بک‌آپ و بازگردانی»)', ih.indexOf('تنظیمات ← بک‌آپ و بازگردانی ← وضعیت دستگاه') > -1);
T('بنر: متن کهربایی قبلی حفظ شد (دستگاه منتقل‌نشده)', ih.indexOf('این دستگاه هنوز به معماری جدید منتقل نشده') > -1);

/* ═══ ۵) ERR-WHY — پیام خطای ذخیره با علت دقیق ═══ */
T('خطا: نگاشت Quota → راهنمای پاک‌سازی کش + تکمیل انتقال', sy.indexOf("en0.indexOf('Quota') > -1") > -1 && sy.indexOf('حافظهٔ مرورگر پر است؛ از تنظیمات «پاک‌سازی کش محلی» را اجرا کنید') > -1 && sy.indexOf('و «انتقال یک‌باره» را تکمیل کنید') > -1);
T('خطا: نگاشت Security/InvalidState/Denied → راهنمای مرورگر اصلی', sy.indexOf("en0.indexOf('Security') > -1") > -1 && sy.indexOf('از Chrome/Safari اصلی باز کنید (نه داخل اپ دیگر)') > -1);
T('خطا: منبع علت = دفتر failedWrites (نه حدس)', sy.indexOf('ptfStorageFailedWrites()[0]') > -1);
T('خطا: متن عمومی قبلی حفظ شد (تب را نبندید)', sy.indexOf('تب را نبندید؛ فضا/دسترسی را بررسی و ثبت را دوباره انجام دهید.') > -1);

/* ═══ ۶) سازگاری — هیچ بخش دیگری از قرارداد نشکسته ═══ */
T('سازگاری: ptfSyncPendingKeys قبلی دست‌نخورده', sy.indexOf('window.ptfSyncPendingKeys = function () { return Object.keys(state.dirty); };') > -1);
T('سازگاری: گاردهای پاک‌سازی کش (synced/deviceSynced) تغییر نکردند', read('crm/client-server.js').indexOf('ptf_b_synced_') > -1);
T('سازگاری: سقف ۱۰۰۰ ردیف audit کلاینت تغییر نکرد (بررسی سرور در 9.2)', (read('crm/rbac.js').match(/logs\.slice\(0, 1000\)/g) || []).length >= 1);

console.log('=== tester553: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
