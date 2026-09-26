/* =====================================================================
   PTF CRM — contact-sync-diag.js — v34.39.40 (CONTACT-SYNC-DIAG-2 — SERVER-VERIFIED WRITE)
   «شماره را ثبت روی سرور زدم ولی تشخیص دوباره گفت روی سرور نیست»
   ---------------------------------------------------------------------
   گزارش کارفرما (۱۴۰۵/۰۷/۰۴): در ابزار تشخیص سینک تماس، مشتری انتخاب و شماره
   وارد و «ثبت روی سرور» زده شد؛ پیام موفقیت آمد، اما «اجرای تشخیص» دوباره
   همان «روی سرور وجود ندارد» را نشان داد. RCA کامل (REPORT-CONTACT-SYNC-
   ROOT-CAUSE-2-2026-09-25.md) سه ریشهٔ هم‌زدد داشت:

     R1) مسیرهای جایگزینِ نوشتن با موفقیتِ کاذب — شاخهٔ ptfEntitySaveCollection
         با reason='contact-sync-diag' از فهرست CONTACT_TOUCH_REASONS نبود ⇒
         روترِ COLLECTION کلیدهای people/coTels/phones/ph را پیش از upsert از
         payload «حذف» می‌کرد (سپر ضدپاک‌شدن) یعنی همان شماره‌ای که قرار بود
         ثبت شود حذف می‌شد؛ شاخهٔ setData فقط محلی می‌نوشت — و هر دو «✅ ثبت شد»
         می‌گفتند. دقیقاً در سناریویی که ابزار برایش ساخته شده (صف گیرکرده /
         نشست منقضی / استقرار ناهمگن) شماره هرگز به سرور نمی‌رسید.
     R2) خواندن تازه از سرور قابل اتکا نبود — URL دلتا بین دو اجرا بایت‌به‌بایت
         یکسان بود، بدون cache:'no-store' و بدون buster؛ سرور هم هیچ Cache-Control
         نمی‌فرستاد ⇒ هر واسطی (مرورگر/LiteSpeed/CDN) می‌توانست پاسخ اجرای اول
         را دوباره بدهد («همان پیام»).
     R3) تطبیق شماره فقط دقیق/پسوندی بود — ۰۹۱۲… محلی در برابر ۹۸۹۱۲… ذخیره‌شده
         «روی سرور نیست» می‌شد در حالی که بود.

   قرارداد تازهٔ v34.39.40 — «ثبت روی سرور = فرمان + بازخوانی تأیید»:
     W1) فقط و فقط مسیر فرمان اتمیک ptfEntityUpsert (entity_upsert با رسید).
         هیچ fallback محلی‌تنهایی وجود ندارد؛ اگر مسیر فرمان در دسترس نباشد،
         صادقانه خطا می‌دهد و هیچ چیزی نمی‌نویسد (به‌جای دروغِ «ثبت شد»).
     W2) بعد از ACK، همان لحظه رکورد از سرور بازخوانی (cache-bust) می‌شود و
         فقط اگر شماره واقعاً در پاسخ سرور دیده شد «✅ ثبت و تأیید شد» نشان
         می‌دهد؛ جدول‌های مقایسه خودکار تازه می‌شوند. اگر ACK آمد ولی بازخوانی
         شماره را نداشت ⇒ «⛔ تأیید نشد» + شناسهٔ رسید (operationId) برای
         پشتیبانی. موفقیت بدون تأییدِ سرور دیگر قابل گزارش نیست.
     W3) خواندن: krevs از لایهٔ سینک (window.ptfSyncKrevs — A10)، پارامتر
         buster یکتا در هر اجرا، cache:'no-store'، و تفکیک صریح «سرور خالی /
         کلید در پاسخ نبود / خطا» به‌جای جمع‌بندیِ «روی سرور نیست».
     W4) تطبیق شماره با فرم کانونی ایرانی (۰/۹۸/+۹۸/۰۰۹۸ هم‌ارز) + ارقام
         فارسی/عربی + حفظ تطبیق پسوندی قدیمی.
   قواعد امنیت قدیف (حفظ شده):
     D1) تشخیص فقط خواندنی است؛
     D2) ثبت فقط برای admin/chairman؛
     D3) مبنای ثبت، آخرین نسخهٔ سرور است (_ccBaseAt) — merge سرور آن را
         «ویرایش تازه» می‌شمارد و هیچ رکورد دیگری دست نمی‌زند؛
     D4) شمارهٔ تکراری رد می‌شود.
   ===================================================================== */
(function () {
  'use strict';
  if (window.__ptfCsdLoaded) return;
  window.__ptfCsdLoaded = true;

  var API = '../api/crm.php';
  var KEY = 'ptf_crm_customers';
  var ROLES_FIX = ['admin', 'chairman'];

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function digits(v) {
    var s = String(v == null ? '' : v);
    try { if (typeof window.ptfToEnDigits === 'function') s = window.ptfToEnDigits(s); } catch (e) {}
    /* مستقل: ارقام فارسی و عربی را هم بدون وابستگی نرمال می‌کنیم */
    s = s.replace(/[\u06F0-\u06F9\u0660-\u0669]/g, function (ch) {
      var c = ch.charCodeAt(0);
      return c >= 0x06F0 ? String(c - 0x06F0) : String(c - 0x0660);
    });
    return s.replace(/\D+/g, '');
  }
  /* R3 — فرم کانونی شمارهٔ ایرانی: ۰۹۱۲… / ۹۸۹۱۲… / +۹۸۹۱۲… / ۰۰۹۸۹۱۲… هم‌ارز.
     برای رشته‌های کوتاه/نامشخص دست نمی‌زنیم. */
  function canonNum(v) {
    var d = digits(v);
    if (!d) return '';
    if (d.length >= 12 && d.indexOf('0098') === 0) d = d.slice(4);
    else if (d.length >= 12 && d.indexOf('98') === 0) d = d.slice(2);
    if (d.length >= 10 && d.charAt(0) === '0') d = d.slice(1);
    return d;
  }
  function authHeaders() {
    var hd = {};
    try {
      hd['X-CRM-Role'] = curRole();
      var t = (typeof ptfAuthToken === 'function' ? ptfAuthToken() : '');
      if (t) hd['X-CRM-Token'] = t;
    } catch (e) {}
    return hd;
  }
  function canFix() { try { return ROLES_FIX.indexOf(String(curRole() || '').toLowerCase()) > -1; } catch (e) { return false; } }
  function faNum(n) { try { return (+n).toLocaleString('fa-IR'); } catch (e) { return String(n); } }

  /* ---------- منطق خالص (بدون DOM — قابل تست در vm) ---------- */

  /* همهٔ کانال‌های تماس رکورد: [{d, where, label}] */
  function channelNums(rec) {
    var out = [];
    if (!rec || typeof rec !== 'object') return out;
    (rec.people || []).forEach(function (p, i) {
      if (!p || typeof p !== 'object') return;
      var nm = String(p.nm || '').trim() || ('رابط ' + (i + 1));
      (p.tels || []).forEach(function (t) { var n = t && t.n ? digits(t.n) : ''; if (n) out.push({ d: n, where: 'people-tel', label: nm + ' — تلفن' }); });
      (p.mobs || []).forEach(function (t) { var n = t && t.n ? digits(t.n) : ''; if (n) out.push({ d: n, where: 'people-mob', label: nm + ' — موبایل' }); });
    });
    (rec.coTels || []).forEach(function (t) { var n = (t && t.n) ? digits(t.n) : (typeof t === 'string' ? digits(t) : ''); if (n) out.push({ d: n, where: 'coTels', label: 'تلفن شرکت' }); });
    (rec.phones || []).forEach(function (t) { var n = (t && t.n) ? digits(t.n) : (typeof t === 'string' ? digits(t) : ''); if (n) out.push({ d: n, where: 'phones', label: 'تلفن فردی' }); });
    if (rec.ph) { var n2 = digits(rec.ph); if (n2) out.push({ d: n2, where: 'ph', label: 'فیلد تماس (legacy)' }); }
    return out;
  }
  /* R3 — تطبیق کانونی + تطبیق پایان‌شماره (پشتیبانِ قدمی) */
  function hasNum(rec, q) {
    var dq = canonNum(q);
    if (!dq) return false;
    var raw = digits(q);
    return channelNums(rec).some(function (c) {
      if (canonNum(c.d) === dq) return true;
      if (c.d === raw) return true;
      return raw.length >= 8 && c.d.length > raw.length && c.d.slice(-raw.length) === raw;
    });
  }
  function hasAny(rec) { return channelNums(rec).length > 0; }
  function updatedAtOf(rec) { return rec ? String(rec.updatedAt || rec.updatedAtISO || '') : ''; }
  function updatedByOf(rec) { return rec ? String(rec.updatedBy || '') : ''; }

  /* حکم: serverRec/localRec ممکن است null باشند (رکورد غایب) */
  function verdict(serverRec, localRec, query) {
    var q = digits(query);
    if (!serverRec) {
      return { code: 'record-missing', tone: 'red',
        title: '⛔ رکورد اصلاً روی سرور نیست',
        body: 'این مشتری یا روی سرور حذف شده و یا سنگ‌قبر (آرشیو حذف) فعال دارد. اول «سطل بازیافت» را چک کنید؛ ممکن است دستگاهی رکورد را حذف کرده باشد. تا رکورد زنده نباشد، هیچ شماره‌ای نمایش داده نمی‌شود.' };
    }
    var sHas = q ? hasNum(serverRec, q) : hasAny(serverRec);
    var lHas = localRec ? (q ? hasNum(localRec, q) : hasAny(localRec)) : false;
    if (q) {
      if (sHas && !lHas) return { code: 'stale-local', tone: 'green',
        title: '✅ شماره روی سرور هست — دستگاهِ شما کش کهنه نشان می‌دهد',
        body: 'شماره‌ای که دنبالش بودید روی سرور (منبع حقیقت) ثبت شده است؛ کشِ این دستگاه از آن تغییر قدیمی‌تر است. صفحه را یک‌بار رفرش کنید (یا ۳۰ ثانیه صبر کنید) — شماره نمایش داده می‌شود. اگر بعد از رفرش هم نبود، ممکن است کد مشتری‌ای که می‌بینید با کد رکوردِ تازه فرق داشته باشد (مشتری دوقلو/ادغام‌شده) — کد مشتری را با هم مقایسه کنید.' };
      if (!sHas && lHas) return { code: 'local-pending', tone: 'amber',
        title: '⏳ این دستگاه شماره را دارد اما هنوز به سرور نرسیده',
        body: 'تغییر هنوز در صف آفلاینِ این دستگاه است. تا ارسال، دستگاه‌های دیگر آن را نمی‌بینند. اینترنت را پایدار نگه دارید تا صف خالی شود (تنظیمات ← بک‌آپ و بازگردانی ← وضعیت دستگاه). اگر صف گیر کرده، نشست را دوباره باز کنید.' };
      if (!sHas && !lHas) return { code: 'never-synced', tone: 'amber',
        title: '🔎 شماره هرگز به سرور نرسیده است',
        body: 'سرور این شماره را ندارد و این دستگاه هم. تغییری که «کاربر دیگر» وارد کرد، از دستگاهِ خودش بیرون نرفته. از آن کاربر بخواهید روی دستگاهِ خودش: CRM ← تنظیمات ← بک‌آپ و بازگردانی ← وضعیت دستگاه — بررسی کند: ① آیا «تغییرات در انتظار ارسال» دارد؟ ② آیا نشست منقضی شده؟ اگر تغییری در انتظار است، با اینترنت پایدار صبر کند تا ارسال شود؛ اگر نشست مشکل دارد، دوباره وارد شود. تا آن لحظه هیچ دستگاه دیگری نمی‌بیند. (اگر شماره را می‌دانید، از فرم پایین مستقیم روی سرور ثبت می‌شود — فقط admin/رییس هیات؛ پس از ثبت، همین پنجره به‌طور خودکار از سرور بازخوانی و تأیید می‌کند.)' };
      return { code: 'ok', tone: 'green',
        title: '✅ شماره هم روی سرور هست و هم روی این دستگاه',
        body: 'شماره کامل هم‌گام است. اگر در جایی از لیست نمی‌بینیدید، احتمالاً در کانال دیگری ذخیره شده (تلفن شرکت در مقابل تلفنِ شخص رابط) — دو جدول پایین را مقایسه کنید.' };
    }
    var sAny = hasAny(serverRec), lAny = localRec ? hasAny(localRec) : false;
    if (sAny && !lAny) return { code: 'stale-local', tone: 'green',
      title: '✅ سرور تماس دارد ولی کشِ این دستگاه خالی است',
      body: 'دستگاه شما از نسخهٔ کهنه‌تر (پیش از پاک‌شدن یا پیش از ثبتِ شمارهٔ جدید) نمایش می‌دهد. صفحه را رفرش کنید.' };
    if (lAny && !sAny) return { code: 'local-pending', tone: 'amber',
      title: '⏳ تماس‌های این دستگاه هنوز به سرور نرسیده',
      body: 'تغییر در صف آفلاینِ همین دستگاه است — تا ارسال کامل، برای بقیه دیده نمی‌شود.' };
    if (!sAny && !sAny && !lAny) return { code: 'never-synced', tone: 'amber',
      title: '🔎 نه سرور تماس دارد و نه این دستگاه',
      body: 'تغییری که روی دستگاه دیگری وارد شده به سرور نرسیده است. «وضعیت دستگاه» آن دستگاه را چک کنید (صف آفلاین / نشست منقضی). اگر شماره را می‌دانید، از فرم پایین روی سرور ثبت می‌شود.' };
    return { code: 'ok', tone: 'green',
      title: '✅ هر دو طرف تماس دارند',
      body: 'مجموعهٔ تماس‌ها در سرور و این دستگاه هر دو پُر است. دو جدول پایین را با هم مقایسه کنید تا ببینید همهٔ شماره‌های مورد انتظار در فهرست‌اند.' };
  }
  window.ptfCsdChannelNums = channelNums;
  window.ptfCsdHasNum = hasNum;
  window.ptfCsdVerdict = verdict;
  window.ptfCsdCanonNum = canonNum;

  /* برنامهٔ ثبت سریع: روی کپیِ رکورد سرور کار می‌کند — {ok, rec, err} */
  function planFix(serverRec, target, phone, kind) {
    var d = digits(phone);
    if (!d || d.length < 8) return { ok: false, err: 'شمارهٔ واردشده ناقص است (حداقل ۸ رقم).' };
    if (!serverRec) return { ok: false, err: 'رکورد سرور در دسترس نیست — اول تشخیص را اجرا کنید.' };
    if (hasNum(serverRec, d)) return { ok: false, err: 'این شماره همین حالا در یکی از بخش‌های رکورد پیدا شد؛ ثبت مجدد لازم نیست (بازخوانی کش/رفرش را چک کنید).' };
    var rec = JSON.parse(JSON.stringify(serverRec));
    rec.people = Array.isArray(rec.people) ? rec.people : [];
    if (target === 'coTels') {
      rec.coTels = Array.isArray(rec.coTels) ? rec.coTels : [];
      rec.coTels.push({ n: String(phone).trim(), ext: '', lb: 'ثبت دستی (تشخیص سینک)' });
    } else if (target === 'phones') {
      rec.phones = Array.isArray(rec.phones) ? rec.phones : [];
      rec.phones.push({ n: String(phone).trim(), ext: '', lb: 'ثبت دستی (تشخیص سینک)' });
    } else if (target.indexOf('people:') === 0) {
      var bits = target.split(':');
      var idx = +bits[1];
      var chKind = bits[2] === 'mob' ? 'mobs' : 'tels';
      var p = rec.people[idx];
      if (!p || typeof p !== 'object') return { ok: false, err: 'شخص رابط انتخابی در رکورد سرور پیدا نشد.' };
      p[chKind] = Array.isArray(p[chKind]) ? p[chKind] : [];
      p[chKind].push({ n: String(phone).trim(), ext: '', lb: 'ثبت دستی (تشخیص سینک)' });
    } else {
      return { ok: false, err: 'مقصد انتخابی قابل شناسایی نیست.' };
    }
    /* مهرهای سرور: ویرایش تازه (merge به LWW) + timestamp استاندارد */
    rec._ccEdit = 1;
    var base = String(serverRec.updatedAt || serverRec.updatedAtISO || '');
    if (base) rec._ccBaseAt = base;
    rec.updatedAtISO = new Date().toISOString();
    try { if (typeof window.ptfNormalizeEntityPhones === 'function') window.ptfNormalizeEntityPhones(rec, 'fa'); } catch (e) {}
    return { ok: true, rec: rec };
  }
  window.ptfCsdPlanFix = planFix;

  /* ---------- R2/W3: خواندن مطمئن از سرور ---------- */

  /* krevs فقط از لایهٔ سینک (A10 — UI هرگز LS را مستقیم نمی‌خواند). نبودِ accessor
     یعنی نقشهٔ خالی ⇒ سرور کل مجموعه‌ها را تازه می‌فرستد — برای تشخیص، درست و کافی است. */
  function readKrevs() {
    try {
      if (typeof window.ptfSyncKrevs === 'function') {
        var m = window.ptfSyncKrevs();
        if (m && typeof m === 'object') return m;
      }
    } catch (e) {}
    return {};
  }
  window.ptfCsdReadKrevs = readKrevs;

  /* تازه‌ترین نسخهٔ کلید از سرور — همان دلتای سینک با یک تفاوت‌های حیاتی:
     ① پارامتر buster یکتا در هر فراخوانی (URL هرگز بین دو اجرا یکسان نیست)؛
     ② cache:'no-store' (هیچ لایه‌ای پاسخ کهنه ندهد)؛
     ③ پاسخ «سرور خالی» و «کلید در پاسخ نبود» از هم تفکیک می‌شوند. */
  function fetchServerRec() {
    var krevs = readKrevs();
    delete krevs[KEY];
    var url = API + '?action=data_pull&since=0&krevs=' + encodeURIComponent(JSON.stringify(krevs)) + '&_csd=' + Date.now();
    return fetch(url, { headers: authHeaders(), cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (d) {
      if (!d || d.ok === false) throw new Error((d && d.error) || 'server_error');
      /* since=0 ⇒ fresh یعنی سرور هیچ rev سراسری ندارد = سرور خالی است (نه «رکورد نیست») */
      if (d.fresh) return { rec: null, rev: (d && d.rev) || 0, fresh: true, arr: [] };
      if (!d.data || !Object.prototype.hasOwnProperty.call(d.data, KEY)) {
        var err = new Error('key_not_in_response');
        err.keyMissing = true;
        err.rev = (d && d.rev) || 0;
        throw err;
      }
      var raw = d.data[KEY];
      var arr = [];
      if (raw != null) {
        arr = (typeof raw === 'string') ? JSON.parse(raw) : raw;
        if (!Array.isArray(arr)) arr = [];
      }
      var rev = 0;
      try { rev = (d.meta && d.meta[KEY] && d.meta[KEY].rev) || d.rev || 0; } catch (eR) {}
      return { rec: arr, rev: rev, fresh: false, arr: arr };
    });
  }
  window.ptfCsdFetchServerRec = fetchServerRec;

  /* وضعیت این دستگاه برای نمایش در گزارش — v34.39.41: [object Object] ⇒ JSON + dirty */
  function deviceInfo() {
    var out = { phaseB: false, pending: [], failures: [], lastError: '', lastErrorDetail: '', krev: '', dirty: [] };
    try { out.phaseB = !!(typeof window.ptfBPhaseActive === 'function' && window.ptfBPhaseActive()); } catch (e) {}
    try { out.pending = (typeof window.ptfBPendingKeys === 'function' ? window.ptfBPendingKeys() : []) || []; } catch (e2) {}
    try { out.failures = (typeof window.ptfSyncWriteFailures === 'function' ? window.ptfSyncWriteFailures() : []) || []; } catch (e3) {}
    try {
      var le = (typeof window.ptfSyncLastError === 'function' ? window.ptfSyncLastError() : null);
      if (le && typeof le === 'object') {
        try { out.lastError = JSON.stringify(le); } catch (eJ) { out.lastError = String(le.detail || le.reason || le.error || ''); }
        out.lastErrorDetail = String(le.detail || le.reason || le.error || le.status || '');
      } else out.lastError = String(le || '');
    } catch (e4) {}
    try { var m = readKrevs(); out.krev = String(m[KEY] == null ? '' : m[KEY]); } catch (e5) {}
    try { out.dirty = (typeof window.ptfSyncPendingKeys === 'function' ? window.ptfSyncPendingKeys() : []) || []; } catch (e6) {}
    return out;
  }
  window.ptfCsdDeviceInfo = deviceInfo;

  /* ---------- W1/W2: ثبت سریع (admin/chairman) — فقط فرمان + تأیید ---------- */

  /* بازخوانی تأیید: رکورد تازه از سرور + جست‌وجوی کانونی همان شماره */
  function verifyOnServer(cd, phoneDigitsQ) {
    return fetchServerRec().then(function (sr) {
      var rec = null;
      for (var i = 0; i < (sr.arr || []).length; i++) if (sr.arr[i] && String(sr.arr[i].cd) === String(cd)) { rec = sr.arr[i]; break; }
      var ch = null;
      if (rec && phoneDigitsQ) {
        var dq = canonNum(phoneDigitsQ);
        var chans = channelNums(rec);
        for (var j = 0; j < chans.length; j++) if (canonNum(chans[j].d) === dq) { ch = chans[j]; break; }
      }
      var found = !!(rec && (phoneDigitsQ ? ch : hasAny(rec)));
      return { found: found, rec: rec, rev: sr.rev, channel: ch ? ch.label : '' };
    });
  }
  window.ptfCsdVerifyOnServer = verifyOnServer;

  /* ثبت: یک مسیر، بدون fallback محلی.
     خروجی‌های ممکن برای done:
       {state:'unavailable'}            مسیر فرمان در دسترس نیست — هیچ چیزی نوشته نشد
       {state:'verified', operationId, rev, serverRec, channel}   ثبت شد و از سرور تأیید شد
       {state:'unverified', operationId, rev}  سرور ACK داد ولی بازخوانی شماره را نداشت
       {state:'verify-error', operationId, error} ACK شد ولی بازخوانی خطا داد
       {state:'rejected'|'uncertain'|'legacy', error?, operationId}  فرمان نرسید/نامشخص بود
  */
  function commitFix(patched, serverRec, phoneQ, done) {
    var opId = 'csd' + Date.now();
    if (typeof window.ptfEntityUpsert !== 'function' || !(window.PTF_ENTITY_CMD_ENABLED && window.PTF_ENTITY_CMD_ENABLED[KEY])) {
      done({ state: 'unavailable', operationId: opId });
      return;
    }
    var cb = function (res) {
      try { if (typeof audit === 'function') audit('تشخیص سینک تماس', '💾 فرمان ثبت شماره روی سرور — مشتری ' + String(serverRec && serverRec.cd) + ' — نتیجه: ' + (res && res.state), 'CONTACT-SYNC'); } catch (eA) {}
      if (!res || res.state !== 'acked') {
        done({ state: (res && res.state) || 'rejected', error: res && res.error, operationId: opId });
        return;
      }
      /* ACK گرفتیم — تا بازخوانیِ همان شماره از سرور نیاید، «ثبت شد» نمی‌گوییم */
      verifyOnServer(serverRec && serverRec.cd, phoneQ).then(function (v) {
        done({ state: v.found ? 'verified' : 'unverified', operationId: opId, rev: v.rev, serverRec: v.rec, channel: v.channel });
      }, function (eV) {
        done({ state: 'verify-error', operationId: opId, error: (eV && eV.message) || String(eV) });
      });
    };
    try {
      window.ptfEntityUpsert(KEY, patched, { cb: cb, operationId: opId });
    } catch (eCmd) {
      done({ state: 'error', error: (eCmd && eCmd.message) || String(eCmd), operationId: opId });
    }
  }
  window.ptfCsdCommitFix = commitFix;

  /* ---------- UI ---------- */
  var lastServerRec = null;
  var lastDiag = null;

  function findRec(arr, cd) {
    for (var i = 0; i < (arr || []).length; i++) if (arr[i] && String(arr[i].cd) === cd) return arr[i];
    return null;
  }
  function contactsTable(rec, title, sub) {
    if (!rec) return '<div style="flex:1;min-width:280px;border:1px solid #e2e8f0;border-radius:10px;padding:10px"><b style="font-size:12.5px">' + title + '</b><div style="font-size:11px;color:#94a3b8;margin-top:4px">' + esc(sub) + '</div><div style="margin-top:8px;font-size:12px;color:#b45309">— رکورد در این‌جا نیست —</div></div>';
    var nums = channelNums(rec);
    var rows = nums.map(function (c) {
      return '<tr><td style="padding:4px 8px;direction:ltr;text-align:left;font-family:monospace;font-size:12px">' + esc(c.d) + '</td><td style="padding:4px 8px;font-size:11.5px">' + esc(c.label) + '</td></tr>';
    }).join('');
    if (!nums.length) rows = '<tr><td colspan="2" style="padding:8px;font-size:12px;color:#b45309">— هیچ شماره‌ای در این نسخه نیست —</td></tr>';
    return '<div style="flex:1;min-width:280px;border:1px solid #e2e8f0;border-radius:10px;padding:10px;background:#fff">' +
      '<b style="font-size:12.5px">' + title + '</b>' +
      '<div style="font-size:11px;color:#94a3b8;margin-top:3px">' + esc(sub) +
      (updatedByOf(rec) ? ' | آخرین ویرایش: <b>' + esc(updatedByOf(rec)) + '</b>' : '') +
      (updatedAtOf(rec) ? ' | <span dir="ltr">' + esc(updatedAtOf(rec)) + '</span>' : '') + '</div>' +
      '<table style="width:100%;border-collapse:collapse;margin-top:8px">' + rows + '</table></div>';
  }
  function fixFormHtml() {
    if (!canFix()) {
      return '<div style="margin-top:12px;font-size:12px;color:#64748b;background:#f8fafc;border:1px dashed var(--brd,#cbd5e1);border-radius:10px;padding:10px">✍️ ثبت سریع روی سرور فقط برای <b>admin / رییس هیات مدیره</b> در دسترس است. نقش فعلی شما: ' + esc(String(curRole() || '')) + ' — می‌توانید از فرم ویرایشِ خودِ مشتری، شماره را اضافه کنید.</div>';
    }
    var r = lastServerRec;
    var opts = '<option value="coTels">🏢 تلفن شرکت (coTels)</option><option value="phones">📞 تلفن فردی (phones)</option>';
    (r.people || []).forEach(function (p, i) {
      var nm = String((p && p.nm) || ('رابط ' + (i + 1)));
      opts += '<option value="people:' + i + ':tel">👤 ' + esc(nm) + ' — تلفن</option>';
      opts += '<option value="people:' + i + ':mob">📱 ' + esc(nm) + ' — موبایل</option>';
    });
    var prefill = (lastDiag && lastDiag.q) ? esc(lastDiag.q) : '';
    return '<div style="margin-top:12px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:10px">' +
      '<b style="font-size:12.5px">➕ ثبت سریع شمارهٔ معلوم روی سرور (فقط admin/رییس هیات)</b>' +
      '<div style="font-size:11.5px;color:#475569;margin-top:4px">روی <b>آخرین نسخهٔ سرور</b> اعمال و با <b>فرمان اتمیک سروری</b> ثبت می‌شود؛ بعد از ثبت، همین پنجره <b>بلافاصله از سرور بازخوانی و تأیید می‌کند</b> — پیام موفقیت فقط بعد از دیدنِ شماره در پاسخ تازهٔ سرور نشان داده می‌شود (v34.39.40). اگر شماره جایی دیگر از رکورد وجود داشته باشد، ثبت رد می‌شود.</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">' +
      '<div class="fld" style="flex:2;min-width:200px"><label>مقصد</label><select id="csdFixTarget">' + opts + '</select></div>' +
      '<div class="fld" style="flex:2;min-width:180px"><label>شماره تماس</label><input id="csdFixPhone" dir="ltr" placeholder="09121234567" autocomplete="off" value="' + prefill + '"></div>' +
      '</div>' +
      '<div style="margin-top:8px"><button class="bt" id="csdFixBtn" style="background:#0369a1">💾 ثبت روی سرور</button> <span id="csdFixSt" style="font-size:12px;margin-right:8px"></span></div>' +
      '</div>';
  }
  function renderResult(ctx) {
    lastDiag = ctx;
    var res = document.getElementById('csdResult');
    if (!res) return;
    var v = verdict(ctx.serverRec, ctx.localRec, ctx.q);
    var toneBg = { green: '#ecfdf5', amber: '#fffbeb', red: '#fef2f2' }[v.tone] || '#f8fafc';
    var toneBd = { green: '#a7f3d0', amber: '#fde68a', red: '#fecaca' }[v.tone] || '#e2e8f0';
    var toneTx = { green: '#065f46', amber: '#92400e', red: '#991b1b' }[v.tone] || '#334155';
    var di = ctx.di;
    var pendingCust = di.pending.indexOf(KEY) > -1;
    var dirtyCust = (di.dirty || []).indexOf(KEY) > -1;
    var lastErrShort = '';
    try {
      if (di.lastError) {
        var leObj = JSON.parse(di.lastError);
        lastErrShort = (leObj.detail || leObj.reason || leObj.status || '') + (leObj.t ? ' — ' + leObj.t : '') + (leObj.keys ? ' — کلیدها: ' + esc(leObj.keys.join('، ')) : '');
        if (!lastErrShort) lastErrShort = di.lastError;
      }
    } catch (eP) { lastErrShort = di.lastError; }
    var devRows =
      '• حالت سرور-محور (فاز B): <b>' + (di.phaseB ? 'فعال' : 'غیرفعال — این دستگاه هنوز دادهٔ محلی را مرجع می‌دارد') + '</b><br>' +
      '• تغییرات محلیِ همگام‌نشده (ptf_sync_dirty): <b>' + ((di.dirty && di.dirty.length) ? esc(di.dirty.join('، ')) : 'هیچ') + '</b>' +
      (dirtyCust && !pendingCust ? '<br><b style="color:#b45309">⚠️ تغییرات مشتری محلی‌ست ولی در صف IDB دیده نمی‌شود — گیرِ صف/مرورگر/سینک (نشست/فازB/IDB)؛ «در صف: هیچ» با وجود dirty یعنی همگام‌سازی صف را تخلیه کرده ولی محلی هنوز مانده.</b>' : '') +
      '<br>• صفِ آفلاینِ آمادهٔ ارسال (IDB/B-queue): <b>' + (di.pending.length ? esc(di.pending.join('، ')) : 'هیچ') + '</b>' +
      (pendingCust ? '<br><b style="color:#b45309">⚠️ رکوردهای مشتری در صف ارسالِ همین دستگاه است — تا ارسال، نسخهٔ سرور ممکن است با این دستگاه فرق داشته باشد و ممکن است این دستگاه بعداً روی سرور بنویسد.</b>' : '') +
      (di.failures.length ? '<br>• نوشتن‌های ناموفقِ اخیر: <b>' + esc(di.failures.join('، ')) + '</b>' : '') +
      (di.lastError ? '<br>• آخرین خطای سینک: <b>' + esc(lastErrShort) + '</b>' + (di.lastError.length > 220 ? '<br><span style="font-size:11px;direction:ltr;word-break:break-all;color:#64748b">' + esc(di.lastError.slice(0,1200)) + '</span>' : '') : '') +
      '<br>• نسخهٔ (rev) کلید مشتریان در این دستگاه: <b dir="ltr">' + esc(di.krev || '—') + '</b>';
    var html = '<div style="background:' + toneBg + ';border:1px solid ' + toneBd + ';border-radius:12px;padding:12px 14px">' +
      '<b style="font-size:14px;color:' + toneTx + '">' + esc(v.title) + '</b>' +
      '<div style="font-size:12.5px;color:#334155;line-height:1.9;margin-top:6px">' + esc(v.body) + '</div></div>';
    html += '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">' +
      contactsTable(ctx.localRec, '📱 نسخهٔ این دستگاه (کش/آینه)', 'rev محلی: ' + (di.krev || '—')) +
      contactsTable(ctx.serverRec, '🖥 نسخهٔ سرور (تازه‌ترین)', 'rev سرور: ' + (ctx.rev || '—')) +
      '</div>';
    html += '<div style="margin-top:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px;font-size:12px;color:#475569;line-height:1.9"><b>🖥 وضعیت این دستگاه:</b><br>' + devRows + '</div>';
    /* فرم ثبت سریع فقط وقتی: رکورد روی سرور هست اما شماره هنوز به سرور نرسیده. */
    if (ctx.serverRec && v.code === 'never-synced') html += fixFormHtml();
    res.innerHTML = html;
    var fb = document.getElementById('csdFixBtn');
    if (fb) fb.onclick = onFixClick;
  }
  function cmdErrMsg(res, opId) {
    try {
      if (typeof window.ptfEntityCommandMessage === 'function') {
        var m = window.ptfEntityCommandMessage({ state: res && res.state, error: res && res.error }, 'ثبت شماره روی سرور');
        if (m) return m;
      }
    } catch (e) {}
    return 'روی سرور انجام نشد — ' + esc((res && res.error && (res.error.message || res.error)) || String((res && res.state) || 'خطای نامشخص'));
  }
  function onFixClick() {
    var st = document.getElementById('csdFixSt');
    var target = document.getElementById('csdFixTarget') ? document.getElementById('csdFixTarget').value : '';
    var phone = document.getElementById('csdFixPhone') ? document.getElementById('csdFixPhone').value : '';
    var kind = target.indexOf(':mob') > -1 ? 'mob' : 'tel';
    var cd = lastServerRec ? String(lastServerRec.cd) : '';
    if (!lastServerRec) { if (st) st.innerHTML = 'اول «اجرای تشخیص» را بزنید.'; return; }
    var plan = planFix(lastServerRec, target, phone, kind);
    if (!plan.ok) { if (st) st.innerHTML = '<span style="color:#b45309">⚠️ ' + esc(plan.err) + '</span>'; return; }
    if (!confirm('این شماره با فرمان اتمیک سروری برای مشتری «' + cd + '» ثبت می‌شود و بلافاصله از سرور بازخوانی/تأیید می‌گردد.\nادامه می‌دهید؟')) return;
    if (st) st.innerHTML = '📡 در حال ارسال فرمان به سرور…';
    var fb = document.getElementById('csdFixBtn');
    if (fb) fb.disabled = true;
    commitFix(plan.rec, lastServerRec, phone, function (res2) {
      if (fb) fb.disabled = false;
      if (!st) return;
      if (res2 && res2.state === 'verified') {
        try { if (typeof ptfToast === 'function') ptfToast('شماره روی سرور ثبت و بازخوانی تأیید شد', 'ok'); } catch (eT) {}
        /* جدول‌ها را با نسخهٔ تأییدشدهٔ سرور خودکار تازه کن — دیگر لازم نیست کاربر خودش تشخیص را دوباره بزند */
        refreshAfterFix(cd, phone, '✅ <b>ثبت و تأیید شد</b> — شماره همین حالا از سرور بازخوانی شد (rev ' + esc(res2.rev || '—') + (res2.channel ? ' — ' + esc(res2.channel) : '') + '). دو جدول بالا با نسخهٔ تازهٔ سرور به‌روز شدند؛ برای دستگاه‌های دیگر، تا سینک بعدی (حداکثر ~۳۰ ثانیه یا رفرش) صبر کنید.');
      } else if (res2 && res2.state === 'unverified') {
        st.innerHTML = '<span style="color:#b91c1c">⛔ سرور فرمان را پذیرفت اما در بازخوانیِ تازه، شماره در رکورد پیدا نشد — رسید: <b dir="ltr">' + esc(res2.operationId || '') + '</b>. محتمل‌ترین علت ناهمگنی نسخهٔ فایل‌های مستقر (مخلوط‌شدن فایل قدیمی/جدید) است: کل مجموعهٔ v34.39.40 را روی هاست بارگذاری کنید و صفحه را با Ctrl+F5 تازه کنید؛ اگر تکرار شد همین رسید را برای پشتیبانی بفرستید.</span>';
      } else if (res2 && res2.state === 'verify-error') {
        st.innerHTML = '<span style="color:#b45309">⚠️ ثبت روی سرور انجام شد اما بازخوانی تأیید ناموفق بود (' + esc(res2.error || '') + ') — رسید: <b dir="ltr">' + esc(res2.operationId || '') + '</b>. چند ثانیه بعد «اجرای تشخیص» را دوباره بزنید.</span>';
      } else if (res2 && res2.state === 'unavailable') {
        st.innerHTML = '<span style="color:#b91c1c">⛔ مسیر فرمان سروری (sales-domain-v2.js / entity_upsert) در این صفحه در دسترس نیست — <b>هیچ چیزی ثبت نشد و عمداً هیچ نوشتنِ محلی انجام نشد</b>. صفحه را با Ctrl+F5 کامل تازه کنید و دوباره امتحان کنید؛ اگر تکرار شد، نسخهٔ مستعر قدیمی/ناهمگن است — کل مجموعهٔ v34.39.40 را روی هاست بارگذاری کنید. (راه جایگزین: فرم ویرایش خودِ مشتری.)</span>';
      } else if (res2 && res2.state === 'legacy') {
        st.innerHTML = '<span style="color:#b91c1c">⛔ مسیر فرمان در لحظهٔ ارسال غیرفعال بود — ثبت نشد. دوباره تلاش کنید؛ اگر تکرار شد صفحه را Ctrl+F5 کنید.</span>';
      } else {
        st.innerHTML = '<span style="color:#b91c1c">⛔ ' + cmdErrMsg(res2) + '</span>';
      }
    });
  }
  /* تازه‌سازی خودکار جدول‌ها پس از ثبتِ تأییدشده */
  function refreshAfterFix(cd, q, note) {
    var st = document.getElementById('csdStatus');
    var localAll = [];
    try { localAll = (typeof getData === 'function' ? getData(KEY) : []) || []; } catch (e) {}
    var localRec = findRec(localAll, cd);
    var di = deviceInfo();
    fetchServerRec().then(function (sr) {
      lastServerRec = findRec(sr.arr, cd);
      renderResult({ cd: cd, q: q, localRec: localRec, serverRec: lastServerRec, rev: sr.rev, di: di });
      if (st) st.innerHTML = note || ('✅ خواندن از سرور انجام شد (rev: ' + (sr.rev || '—') + ').');
    }).catch(function (e) {
      if (st) st.innerHTML = note || '';
    });
  }

  function runDiag() {
    var cdEl = document.getElementById('csdCdMan');
    var selEl = document.getElementById('csdCd');
    var cd = (cdEl && cdEl.value ? cdEl.value : (selEl && selEl.value ? selEl.value : '')).trim();
    if (!cd) { alert('کد مشتری را وارد کنید (مثلاً CUST-123).'); return; }
    var q = document.getElementById('csdQ') ? document.getElementById('csdQ').value.trim() : '';
    var st = document.getElementById('csdStatus');
    var res = document.getElementById('csdResult');
    lastServerRec = null;
    if (res) res.innerHTML = '';
    var localAll = [];
    try { localAll = (typeof getData === 'function' ? getData(KEY) : []) || []; } catch (e) {}
    var localRec = findRec(localAll, cd);
    var di = deviceInfo();
    if (st) st.innerHTML = '📡 در حال خواندن تازه‌ترین نسخه از سرور…';
    fetchServerRec().then(function (sr) {
      if (sr.fresh) {
        /* R2 — «سرور خالی» با «رکورد نیست» فرق دارد */
        if (st) st.innerHTML = '⚠️ سرور گزارش کرد هیچ دادهٔ همگام‌شده‌ای برای ارسال ندارد (rev سراسری ۰) — اگر انتظار داده دارید، نشست/نقش یا آدرس سرور را بررسی کنید و از تنظیمات ← وضعیت دستگاه، اتصال را چک کنید.';
        try { if (typeof addLog === 'function') addLog('🩺 تشخیص سینک تماس — سرور خالی گزارش کرد (fresh)'); } catch (eL) {}
        return;
      }
      var serverRec = findRec(sr.arr, cd);
      lastServerRec = serverRec;
      if (st) st.innerHTML = '✅ خواندن از سرور انجام شد (rev: ' + (sr.rev || '—') + ').';
      renderResult({ cd: cd, q: q, localRec: localRec, serverRec: serverRec, rev: sr.rev, di: di });
      try { if (typeof audit === 'function') audit('تشخیص سینک تماس', '🩺 تشخیص مشتری ' + cd + (q ? ' — شماره ' + q : '') + ' → ' + verdict(serverRec, localRec, q).code, 'CONTACT-SYNC'); } catch (eA) {}
      try { console.log('[contact-sync-diag] cd=' + cd, 'verdict=' + verdict(serverRec, localRec, q).code, 'serverRev=' + sr.rev); } catch (eC) {}
    }).catch(function (e) {
      if (e && e.keyMissing) {
        if (st) st.innerHTML = '⛔ سرور پاسخ داد اما کلید «مشتریان» را در پاسخ نیاورد (rev: ' + (e.rev || '—') + ') — این وضعیت نقش/نشست یا ناهمگنی نسخهٔ فایل‌های سرور را نشان می‌دهد. یک‌بار خارج و دوباره وارد شوید؛ اگر تکرار شد کل مجموعهٔ v34.39.40 را روی هاست بارگذاری کنید.';
      } else {
        if (st) st.innerHTML = '⛔ خطا در خواندن از سرور: ' + esc((e && e.message) || e) + ' — اتصال اینترنت و نشست (ورود دوباره) را چک کنید. تا آن‌زمان فقط دادهٔ محلی قابل اعتماد است.';
      }
      try { if (typeof addLog === 'function') addLog('🩺 تشخیص سینک تماس — خطا: ' + ((e && e.message) || e)); } catch (eL) {}
    });
  }
  window.ptfCsdRun = runDiag;

  function open() {
    try { console.log('[contact-sync-diag] open() called, role=', (typeof curRole === 'function' ? curRole() : 'unknown')); } catch (e0) {}
    try { var prev = document.getElementById('__ptfCsdDlg'); if (prev) prev.remove(); } catch (eP) {}
    var all = [];
    try { all = (typeof getData === 'function' ? getData(KEY) : []) || []; } catch (e) {}
    var opts = all.slice(0, 800).map(function (c) {
      return '<option value="' + esc(c.cd) + '">' + esc(c.cd) + ' — ' + esc(c.co || c.nm || '') + '</option>';
    }).join('');
    var host = null;
    try { host = document.body || document.getElementById('panels') || document.documentElement; } catch (eH) { host = null; }
    if (!host) { alert('نمی‌توان پنجرهٔ تشخیص را باز کرد: body پیدا نشد. صفحه را رفرش کنید.'); return; }
    var html = '<div class="md-b" id="__ptfCsdDlg" style="display:grid;z-index:9999" onclick="if(event.target===this)this.remove()">' +
      '<div class="md" style="max-width:920px;max-height:92vh;overflow:auto">' +
      '<h3 style="margin:0 0 8px">🩺 تشخیص سینک تماس مشتری</h3>' +
      '<div style="font-size:12px;color:#475569;line-height:1.9;background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:8px 10px;margin-bottom:10px">' +
      'برای موقعیت «شماره‌ای که پاک شده بود روی دستگاهِ کاربرِ دیگر دوباره وارد شد ولی برای من نمایش داده نمی‌شود»: این ابزار <b>تازه‌ترین رکورد را مستقیم از سرور</b> (منبع حقیقت، دور زدن کش ۳۰ ثانیه) می‌خواند، با <b>کشِ همین دستگاه</b> و <b>صف آفلاین</b> مقایسه می‌کند و دقیقاً می‌گوید مشکل از کدام‌یک است. تشخیص <b>فقط خواندنی</b> است و هیچ تغییری ایجاد نمی‌کند. (v34.39.40 — ثبتِ سریع فقط با فرمان اتمیک سروری + بازخوانی تأیید.)' +
      '</div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px">' +
      '<div class="fld" style="flex:3;min-width:240px"><label>مشتری</label><select id="csdCd">' + opts + '</select></div>' +
      '<div class="fld" style="flex:2;min-width:160px"><label>کد مشتری (دستی)</label><input id="csdCdMan" placeholder="CUST-123" dir="ltr"></div>' +
      '<div class="fld" style="flex:2;min-width:160px"><label>شماره‌ای که دنبالش هستید (اختیاری)</label><input id="csdQ" placeholder="0912..." dir="ltr" autocomplete="off"></div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;margin-bottom:10px"><button class="bt" id="csdRun" style="background:#0369a1">🔎 اجرای تشخیص</button></div>' +
      '<div id="csdStatus" style="font-size:12.5px;color:#334155"></div>' +
      '<div id="csdResult"></div>' +
      '<div style="display:flex;justify-content:flex-end;margin-top:12px"><button class="bt bt-o" onclick="document.getElementById(\'__ptfCsdDlg\').remove()">✕ بستن</button></div>' +
      '</div></div>';
    try {
      host.insertAdjacentHTML('beforeend', html);
      var sel = document.getElementById('csdCd');
      var man = document.getElementById('csdCdMan');
      if (sel) sel.onchange = function () { if (man) man.value = sel.value || ''; };
      if (man) man.oninput = function () { if (man.value && sel) sel.value = ''; };
      var run = document.getElementById('csdRun');
      if (run) run.onclick = runDiag;
      console.log('[contact-sync-diag] modal mounted');
    } catch (eOpen) {
      console.error('[contact-sync-diag] open failed', eOpen);
      var msg = 'خطا در باز کردن پنجرهٔ تشخیص: ' + ((eOpen && eOpen.message) || eOpen);
      try { if (typeof ptfToast === 'function') ptfToast(msg, 'err'); } catch (eT2) {}
      alert(msg);
    }
  }
  window.ptfOpenContactSyncDiag = open;
  window.ptfCsdLoaded = true;
})();
