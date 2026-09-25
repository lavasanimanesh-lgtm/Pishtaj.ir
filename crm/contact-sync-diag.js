/* =====================================================================
   PTF CRM — contact-sync-diag.js — v34.39.29 (CONTACT-SYNC-DIAG)
   «شماره را روی دستگاه دیگر دوباره وارد کردم ولی برای من نمایش داده نمی‌شود»
   ---------------------------------------------------------------------
   گزارش کارفرما (۱۴۰۵/۰۷/۰۳): شماره تماسِ یکی از افراد پاک شده بود؛ یکی از
   کاربران آن را دوباره اضافه کرد، اما برای مدیر نمایش داده نمی‌شود.
   این ابزار مشخص می‌کند دقیقاً کدام یک از سه وضعیت رخ داده:
     ① تغییر به سرور رسیده ولی دستگاهِ مشاهده‌کننده کش کهنه نشان می‌دهد
        → با رفرش حل می‌شود (خطای «من نمی‌بینم» — در حالی که داده سالم است)
     ② تغییر روی همین دستگاه است اما هنوز در صف آفلاین مانده
        → تا ارسال، هیچ دستگاه دیگری نمی‌بیند
     ③ تغییر اصلاً به سرور نرسیده (صف گیرکردهٔ دستگاهِ واردکننده / نشست
        منقضی) → با «وضعیت دستگاه» آن دستگاه حل می‌شود؛ یا از همین‌جا
        (admin/chairman) شمارهٔ معلوم مستقیماً روی سرور ثبت می‌شود
   معماری: فاز B — سرور (MySQL) منبع حقیقت است؛ هر دستگاه کش ۳۰ ثانیه +
   آینهٔ IndexedDB دارد و نوشتن‌ها debounce + صف آفلاین دارند. «نمایش
   داده‌نشدن» تقریباً همیشه یکی از این سه است، نه «باگ نمایش».
   قواعد امنیت:
     D1) تشخیص فقط خواندنی است (data_pull / sync_read) — هیچ چیزی تغییر نمی‌کند؛
     D2) ثبت سریع فقط برای admin/chairman (هم‌پایهٔ بازیابی تماس‌ها)؛
     D3) مبنای ثبت، آخرین نسخهٔ سرور است (نه کش این دستگاه) و با مهر
         _ccBaseAt = updatedAt سرور → merge سرور آن را «ویرایش تازه» می‌شمارد
         و هیچ رکورد دیگری دست نمی‌زند (یک entity_upsert؛ حذف انبوه غیرممکن)؛
     D4) اگر شماره در هر کانالی از رکورد وجود داشته باشد، ثبت رد می‌شود
         (S2 — بازنویسی/تکرارِ بی‌دلیل).
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
    /* مستقل: ارقام فارسی و عربی را هم بدون وابستگی نرمال می‌کنیم
       (هم‌سنگ sd_contact_digits سرور) */
    s = s.replace(/[\u06F0-\u06F9\u0660-\u0669]/g, function (ch) {
      var c = ch.charCodeAt(0);
      return c >= 0x06F0 ? String(c - 0x06F0) : String(c - 0x0660);
    });
    return s.replace(/\D+/g, '');
  }  function authHeaders() {
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
  function hasNum(rec, q) {
    var d = digits(q);
    if (!d) return false;
    return channelNums(rec).some(function (c) {
      /* تطبیق دقیق + تطبیق پایان‌شماره (کاربر ممکن است بدون صفرِ اول یا
         پیش‌شمارهٔ کشور وارد کند — فقط برای تشخیص، نه برای ثبت) */
      return c.d === d || (d.length >= 8 && c.d.length > d.length && c.d.slice(-d.length) === d);
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
        body: 'سرور این شماره را ندارد و این دستگاه هم. تغییری که «کاربر دیگر» وارد کرد، از دستگاهِ خودش بیرون نرفته. از آن کاربر بخواهید روی دستگاهِ خودش: CRM ← تنظیمات ← بک‌آپ و بازگردانی ← وضعیت دستگاه — بررسی کند: ① آیا «تغییرات در انتظار ارسال» دارد؟ ② آیا نشست منقضی شده؟ اگر تغییری در انتظار است، با اینترنت پایدار صبر کند تا ارسال شود؛ اگر نشست مشکل دارد، دوباره وارد شود. تا آن لحظه هیچ دستگاه دیگری نمی‌بیند. (اگر شماره را می‌دانید، از فرم پایین مستقیم روی سرور ثبت می‌شود — فقط admin/رییس هیات.)' };
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
    if (!sAny && !lAny) return { code: 'never-synced', tone: 'amber',
      title: '🔎 نه سرور تماس دارد و نه این دستگاه',
      body: 'تغییری که روی دستگاه دیگری وارد شده به سرور نرسیده است. «وضعیت دستگاه» آن دستگاه را چک کنید (صف آفلاین / نشست منقضی). اگر شماره را می‌دانید، از فرم پایین روی سرور ثبت می‌شود.' };
    return { code: 'ok', tone: 'green',
      title: '✅ هر دو طرف تماس دارند',
      body: 'مجموعهٔ تماس‌ها در سرور و این دستگاه هر دو پُر است. دو جدول پایین را با هم مقایسه کنید تا ببینید همهٔ شماره‌های مورد انتظار در فهرست‌اند.' };
  }
  window.ptfCsdChannelNums = channelNums;
  window.ptfCsdHasNum = hasNum;
  window.ptfCsdVerdict = verdict;

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
      rec.phones.push({ n: String(phone).trim(), lb: 'ثبت دستی (تشخیص سینک)' });
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

  /* وضعیت این دستگاه برای نمایش در گزارش */
  function deviceInfo() {
    var out = { phaseB: false, pending: [], failures: [], lastError: '', krev: '' };
    try { out.phaseB = !!(typeof window.ptfBPhaseActive === 'function' && window.ptfBPhaseActive()); } catch (e) {}
    try { out.pending = (typeof window.ptfBPendingKeys === 'function' ? window.ptfBPendingKeys() : []) || []; } catch (e2) {}
    try { out.failures = (typeof window.ptfSyncWriteFailures === 'function' ? window.ptfSyncWriteFailures() : []) || []; } catch (e3) {}
    try { out.lastError = String((typeof window.ptfSyncLastError === 'function' ? window.ptfSyncLastError() : '') || ''); } catch (e4) {}
    try { var m = JSON.parse(localStorage.getItem('ptf_sync_krevs') || '{}'); out.krev = String(m[KEY] == null ? '' : m[KEY]); } catch (e5) {}
    return out;
  }
  window.ptfCsdDeviceInfo = deviceInfo;

  /* تازه‌ترین نسخهٔ کلید از سرور — با کپیِ همان دلتای سینک، فقط همین کلید
     را می‌خواهیم (krevs محلی منهای ptf_crm_customers → سرور فقط آن را می‌فرستد). */
  function fetchServerRec() {
    var krevs = {};
    try { krevs = JSON.parse(localStorage.getItem('ptf_sync_krevs') || '{}'); } catch (e) { krevs = {}; }
    delete krevs[KEY];
    var url = API + '?action=data_pull&since=0&krevs=' + encodeURIComponent(JSON.stringify(krevs));
    return fetch(url, { headers: authHeaders() }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (d) {
      if (!d || d.ok === false) throw new Error((d && d.error) || 'server_error');
      if (d.fresh && !(d.data && Object.prototype.hasOwnProperty.call(d.data, KEY))) return { rec: null, rev: 0, fresh: true, arr: [] };
      var raw = d.data ? d.data[KEY] : null;
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

  /* ---------- ثبت سریع (admin/chairman) ---------- */
  function commitFix(patched, serverRec, done) {
    var cb = function (res) {
      try { if (typeof audit === 'function') audit('تشخیص سینک تماس', '💾 ثبت سریع شماره روی سرور — مشتری ' + String(serverRec && serverRec.cd) + ' — نتیجه: ' + (res && res.state), 'CONTACT-SYNC'); } catch (eA) {}
      done(res);
    };
    try {
      if (typeof window.ptfEntityUpsert === 'function' && window.PTF_ENTITY_CMD_ENABLED && window.PTF_ENTITY_CMD_ENABLED[KEY]) {
        window.ptfEntityUpsert(KEY, patched, { cb: cb, operationId: 'csd' + Date.now() });
        return;
      }
    } catch (eCmd) {}
    /* fallback: روتر diff-محور با prevArr دقیقاً خود رکورد سرور → دقیقاً یک upsert */
    try {
      if (typeof window.ptfEntitySaveCollection === 'function') {
        window.ptfEntitySaveCollection(KEY, [patched], { prevArr: [JSON.parse(JSON.stringify(serverRec))], reason: 'contact-sync-diag' });
        cb({ state: 'legacy' });
        return;
      }
    } catch (e2) {}
    try {
      var all = (typeof getData === 'function' ? getData(KEY) : []) || [];
      var idx = -1;
      for (var i = 0; i < all.length; i++) if (all[i] && String(all[i].cd) === String(serverRec.cd)) { idx = i; break; }
      if (idx >= 0) all[idx] = patched; else all.unshift(patched);
      if (typeof setData === 'function') setData(KEY, all);
      cb({ state: 'legacy' });
    } catch (e3) { cb({ state: 'rejected', error: e3 && e3.message }); }
  }

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
    return '<div style="margin-top:12px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:10px">' +
      '<b style="font-size:12.5px">➕ ثبت سریع شمارهٔ معلوم روی سرور (فقط admin/رییس هیات)</b>' +
      '<div style="font-size:11.5px;color:#475569;margin-top:4px">روی <b>آخرین نسخهٔ سرور</b> اعمال می‌شود (نه کش این دستگاه) و با مسیر استاندارد دستور ثبت می‌شود؛ اگر شماره جایی دیگر از رکورد وجود داشته باشد، ثبت رد می‌شود.</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">' +
      '<div class="fld" style="flex:2;min-width:200px"><label>مقصد</label><select id="csdFixTarget">' + opts + '</select></div>' +
      '<div class="fld" style="flex:2;min-width:180px"><label>شماره تماس</label><input id="csdFixPhone" dir="ltr" placeholder="09121234567" autocomplete="off"></div>' +
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
    var devRows =
      '• حالت سرور-محور (فاز B): <b>' + (di.phaseB ? 'فعال' : 'غیرفعال — این دستگاه هنوز دادهٔ محلی را مرجع می‌داند') + '</b><br>' +
      '• کلیدهای در صف ارسالِ این دستگاه: <b>' + (di.pending.length ? esc(di.pending.join('، ')) : 'هیچ') + '</b>' +
      (pendingCust ? '<br><b style="color:#b45309">⚠️ رکوردهای مشتری در صف ارسالِ همین دستگاه است — تا ارسال، نسخهٔ سرور ممکن است با این دستگاه فرق داشته باشد و ممکن است این دستگاه بعداً روی سرور بنویسد.</b>' : '') +
      (di.failures.length ? '<br>• نوشتن‌های ناموفقِ اخیر: <b>' + esc(di.failures.join('، ')) + '</b>' : '') +
      (di.lastError ? '<br>• آخرین خطای سینک: <b>' + esc(di.lastError) + '</b>' : '') +
      '• نسخهٔ (rev) کلید مشتریان در این دستگاه: <b dir="ltr">' + esc(di.krev || '—') + '</b>';
    var html = '<div style="background:' + toneBg + ';border:1px solid ' + toneBd + ';border-radius:12px;padding:12px 14px">' +
      '<b style="font-size:14px;color:' + toneTx + '">' + esc(v.title) + '</b>' +
      '<div style="font-size:12.5px;color:#334155;line-height:1.9;margin-top:6px">' + esc(v.body) + '</div></div>';
    html += '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">' +
      contactsTable(ctx.localRec, '📱 نسخهٔ این دستگاه (کش/آینه)', 'rev محلی: ' + (di.krev || '—')) +
      contactsTable(ctx.serverRec, '🖥 نسخهٔ سرور (تازه‌ترین)', 'rev سرور: ' + (ctx.rev || '—')) +
      '</div>';
    html += '<div style="margin-top:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px;font-size:12px;color:#475569;line-height:1.9"><b>🖥 وضعیت این دستگاه:</b><br>' + devRows + '</div>';
    /* فرم ثبت سریع فقط وقتی: رکورد روی سرور هست اما شماره هنوز به سرور نرسیده.
       در «stale-local» داده روی سرور سالم است و کاری لازم نیست؛ در «record-missing»
       اصلاً رکوردی برای نوشتن نیست. */
    if (ctx.serverRec && v.code === 'never-synced') html += fixFormHtml();
    res.innerHTML = html;
    var fb = document.getElementById('csdFixBtn');
    if (fb) fb.onclick = onFixClick;
  }
  function onFixClick() {
    var st = document.getElementById('csdFixSt');
    var target = document.getElementById('csdFixTarget') ? document.getElementById('csdFixTarget').value : '';
    var phone = document.getElementById('csdFixPhone') ? document.getElementById('csdFixPhone').value : '';
    var kind = target.indexOf(':mob') > -1 ? 'mob' : 'tel';
    if (!lastServerRec) { if (st) st.innerHTML = 'اول «اجرای تشخیص» را بزنید.'; return; }
    var plan = planFix(lastServerRec, target, phone, kind);
    if (!plan.ok) { if (st) st.innerHTML = '<span style="color:#b45309">⚠️ ' + esc(plan.err) + '</span>'; return; }
    if (!confirm('این شماره روی سرور برای مشتری «' + lastServerRec.cd + '» ثبت می‌شود.\nادامه می‌دهید؟')) return;
    if (st) st.innerHTML = 'در حال ارسال…';
    commitFix(plan.rec, lastServerRec, function (res2) {
      if (st) {
        if (res2 && (res2.state === 'acked' || res2.state === 'legacy')) {
          st.innerHTML = '<span style="color:#047857">✅ ثبت شد — حالا «اجرای تشخیص» را دوباره بزنید تا از سرور تازه بخواند.</span>';
          try { if (typeof ptfToast === 'function') ptfToast('شماره روی سرور ثبت شد', 'ok'); } catch (eT) {}
        } else {
          st.innerHTML = '<span style="color:#b91c1c">⛔ ثبت انجام نشد: ' + esc((res2 && res2.error) || String(res2 && res2.state)) + ' — اینترنت/نشست را چک کنید.</span>';
        }
      }
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
      var serverRec = findRec(sr.arr, cd);
      lastServerRec = serverRec;
      if (st) st.innerHTML = '✅ خواندن از سرور انجام شد (rev: ' + (sr.rev || '—') + ').';
      renderResult({ cd: cd, q: q, localRec: localRec, serverRec: serverRec, rev: sr.rev, di: di });
      try { if (typeof audit === 'function') audit('تشخیص سینک تماس', '🩺 تشخیص مشتری ' + cd + (q ? ' — شماره ' + q : '') + ' → ' + verdict(serverRec, localRec, q).code, 'CONTACT-SYNC'); } catch (eA) {}
      try { console.log('[contact-sync-diag] cd=' + cd, 'verdict=' + verdict(serverRec, localRec, q).code, 'serverRev=' + sr.rev); } catch (eC) {}
    }).catch(function (e) {
      if (st) st.innerHTML = '⛔ خطا در خواندن از سرور: ' + esc((e && e.message) || e) + ' — اتصال اینترنت و نشست (ورود دوباره) را چک کنید. تا آن‌زمان فقط دادهٔ محلی قابل اعتماد است.';
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
      'برای موقعیت «شماره‌ای که پاک شده بود روی دستگاهِ کاربرِ دیگر دوباره وارد شد ولی برای من نمایش داده نمی‌شود»: این ابزار <b>تازه‌ترین رکورد را مستقیم از سرور</b> (منبع حقیقت، دور زدن کش ۳۰ ثانیه) می‌خواند، با <b>کشِ همین دستگاه</b> و <b>صف آفلاین</b> مقایسه می‌کند و دقیقاً می‌گوید مشکل از کدام‌یک است. تشخیص <b>فقط خواندنی</b> است و هیچ تغییری ایجاد نمی‌کند.' +
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
