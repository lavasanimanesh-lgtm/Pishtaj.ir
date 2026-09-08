/* =====================================================================
   PTF CRM — restore-contacts.js (v34.38.9 — CONTACT-RECOVERY-ONECLICK)
   بازیابی خودکار «فقط اطلاعات تماس مشتریان» از بک‌آپ‌های چرخشی سرور، با یک کلیک
   ---------------------------------------------------------------------
   انگیزه: auto-report «اطلاعات تماس مشتری پاک شده» (CONTACT-GHOST v34.38.7) —
   کاربر تاریخ پاک‌شدن را نمی‌داند؛ بعضی رکوردها قدیمی‌تر و بعضی جدیدتر شسته‌اند.
   این ابزار بک‌آپ‌های سرور (hourly/daily/weekly/monthly/suspect) را از جدید به
   قدیمی وارسی می‌کند و برای هر مشتریِ «تماس‌خالیِ فعلی»، جدیدترین منبعی که تماس
   همان فیلد را دارد پیدا می‌کند؛ خروجی پیشِ‌نمایش با تیک می‌دهد و با یک کلیک،
   فقط فیلدهای تماسِ خالی را از بک‌آپ پر می‌کند.

   قواعد امنیت (سخت):
     S1) هیچ فیلد دیگری به‌جز لیست CONTACT_FIELDS هرگز نوشته نمی‌شود؛
     S2) مقدارِ غیرخالیِ فعلی هرگز بازنویسی نمی‌شود (merge فقط روی خالی‌ها)؛
     S3) هیچ رکوردی حذف/ایجاد نمی‌شود؛ صرفاً upsert روی cdهای موجود؛
     S4) تطبیق فقط بر اساس cd (کد مشتری) — تطبیق اسمی به‌خاطر خطای «روح»ها انجام نمی‌شود؛
     S5) نقش مجاز: فقط admin/chairman (هم‌پایهٔ get_backup: users_write).
   ============================================================================= */
(function () {
  'use strict';
  var API = '../api/crm.php';

  /* v34.38.9 (LOCK): فقط تماس — هر فیلد دیگری تخلف از قرارداد است */
  var CONTACT_FIELDS = ['people', 'coTels', 'con', 'ph', 'coMail', 'coWeb', 'coAddr'];
  var SAVE_REASON = 'offer-cust'; /* مسیر معتبر merge-safe؛ از reasonهای مهاجرتی/بازسازی استفاده نمی‌شود */
  var ROLES_OK = ['admin', 'chairman'];

  function h(json) {
    var hd = json ? { 'Content-Type': 'application/json' } : {};
    try { hd['X-CRM-Role'] = curRole(); var t = (typeof ptfAuthToken === 'function' ? ptfAuthToken() : ''); if (t) hd['X-CRM-Token'] = t; } catch (e) {}
    return hd;
  }
  function canRun() { try { return ROLES_OK.indexOf(curRole()) > -1; } catch (e) { return false; } }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  /* ---------- منطق خالص (بدون DOM — قابل تست در vm) ---------- */
  function fieldEmpty(v) {
    if (v == null) return true;
    if (typeof v === 'string') return v.trim() === '';
    if (Array.isArray(v)) return v.length === 0;
    return false;
  }
  function personHasContact(pp) {
    if (!pp || typeof pp !== 'object') return false;
    return !!(pp.tels && pp.tels.length) || !!(pp.mobs && pp.mobs.length) || !!(pp.mails && pp.mails.length);
  }
  function hasContacts(x) {
    if (!x || typeof x !== 'object') return false;
    if (Array.isArray(x.people) && x.people.some(personHasContact)) return true;
    if (Array.isArray(x.coTels) && x.coTels.length) return true;
    if (!fieldEmpty(x.ph) || !fieldEmpty(x.con)) return true;
    return false;
  }
  /* v34.38.9 (CONTACT-RECOVERY-PARTIAL): «خالی» در سطح فیلد، نه در سطح رکورد.
     نسخهٔ v34.38.9 فقط رکوردهایی را نامزد بازیابی می‌کرد که هیچ تماسی نداشتند
     (hasContacts=false). امضای واقعیِ گزارش‌های میدانی اما «شستشوی جزئی» است:
     ph مانده ولی همهٔ اشخاص رابط و موبایل‌ها رفته‌اند، یا people هست ولی همهٔ
     tels/mobs/mails آن خالی شده. آن رکوردها هرگز در پیش‌نمایش نمی‌آمدند و کاربر
     می‌دید «ابزار چیزی پیدا نمی‌کند». حالا هر فیلدِ تماسِ خالی مستقلاً بازیابی
     می‌شود و S2 (عدم بازنویسی مقدار سالم) دقیقاً همان‌جا اعمال می‌گردد. */
  function restorableEmpty(field, v) {
    if (field === 'people') {
      if (!Array.isArray(v) || !v.length) return true;
      return !v.some(personHasContact); /* فقط نام بدون هیچ کانال تماس = عملاً خالی */
    }
    return fieldEmpty(v);
  }
  function betterPeople(candidate, current) {
    /* people موجودِ بی‌تماس نباید نسخهٔ تماس‌دارِ بک‌آپ را رد کند، ولی نسخهٔ بک‌آپ
       هم فقط وقتی می‌نشیند که واقعاً تماس داشته باشد. */
    if (!Array.isArray(candidate) || !candidate.some(personHasContact)) return false;
    return restorableEmpty('people', current);
  }
  window.ptfContactRecoverRestorableEmpty = restorableEmpty;
  /* backup → آرایهٔ مشتریان؛ get_backup بدنهٔ خام فایل بک‌آپ را برمی‌گرداند */
  function parseBackupCustomers(payload) {
    var j = payload;
    if (typeof j === 'string') { try { j = JSON.parse(j); } catch (e) { return null; } }
    if (Array.isArray(j)) return j;
    if (j && typeof j === 'object' && j.data && j.data.ptf_crm_customers != null) {
      var c = j.data.ptf_crm_customers;
      if (typeof c === 'string') { try { c = JSON.parse(c); } catch (e2) { return null; } }
      return Array.isArray(c) ? c : null;
    }
    return null;
  }
  /* v34.38.9: تشخیص «چرا این فایل کمکی نکرد» — بدون آن، اسکنِ بی‌نتیجه در سکوت
     تمام می‌شد و کاربر فقط می‌دید «دکمه کار نمی‌کند». */
  function diagnoseBackup(payload) {
    var j = payload;
    if (typeof j === 'string') { try { j = JSON.parse(j); } catch (e) { return 'unparsable'; } }
    if (Array.isArray(j)) return 'ok';
    if (!j || typeof j !== 'object') return 'unparsable';
    if (j.ok === false) return 'server_error:' + (j.error || '');
    if (!j.data || typeof j.data !== 'object') return 'no_data_section';
    if (j.data.ptf_crm_customers == null) return 'no_customers_key';
    return 'ok';
  }
  window.ptfContactRecoverDiagnose = diagnoseBackup;
  /* plan: current + backups(newest→oldest) → {plan, unrecovered}
     plan[i] = { cd, co, restore:{field:value}, src:{field:backupName} } */
  function buildPlan(current, backupsOrd) {
    var pools = {}, order = [], curByCd = {};
    (current || []).forEach(function (c) {
      if (!c || !c.cd) return;
      curByCd[c.cd] = c;
      /* v34.38.9: نامزدی در سطح فیلد — هر رکوردی که «حداقل یک فیلد تماسِ خالی»
         دارد نامزد است؛ رکورد کاملاً سالم خودبه‌خود هیچ فیلدی برای پر شدن ندارد. */
      var anyGap = CONTACT_FIELDS.some(function (f) { return restorableEmpty(f, c[f]); });
      if (!anyGap) return;
      pools[c.cd] = { cd: c.cd, co: c.co || c.nm || '', restore: {}, src: {}, wiped: !hasContacts(c) };
      order.push(c.cd);
    });
    (backupsOrd || []).forEach(function (bk) {
      var byCd = {};
      (bk.customers || []).forEach(function (x) { if (x && x.cd) byCd[x.cd] = x; });
      order.forEach(function (cd) {
        var p = pools[cd];
        var allFull = CONTACT_FIELDS.every(function (f) { return !fieldEmpty(p.restore[f]); });
        if (allFull) return; /* همهٔ فیلدهایش از منابع جدیدتر پر شده — عمیق‌تر نرو */
        var src = byCd[cd];
        if (!src) return;
        CONTACT_FIELDS.forEach(function (f) {
          if (!fieldEmpty(p.restore[f])) return;              /* از منبع جدیدتر پر شده */
          if (!restorableEmpty(f, curByCd[cd] ? curByCd[cd][f] : undefined)) return; /* S2: مقدار سالم فعلی */
          if (f === 'people') { if (!betterPeople(src[f], curByCd[cd] ? curByCd[cd][f] : undefined)) return; }
          else if (fieldEmpty(src[f])) return;
          /* S1/S2: فقط فیلدی که در فعلیِ سرور خالی مانده و در این بک‌آپ پر است —
             چندمنبعی: پاک‌شدن‌ها تاریخ‌های متفاوت دارند؛ هر فیلد از جدیدترین
             بک‌آپی که «آن فیلد را» دارد می‌آید (ممکن است ترکیبی از دو نسخه شود) */
          p.restore[f] = JSON.parse(JSON.stringify(src[f]));
          p.src[f] = bk.name;
        });
      });
    });
    var plan = [], unrecovered = [];
    order.forEach(function (cd) {
      if (Object.keys(pools[cd].restore).length) plan.push(pools[cd]);
      /* فقط رکوردهای واقعاً تماس‌خالی به‌عنوان «بازیابی‌نشده» هشدار می‌گیرند؛
         رکورد سالمی که صرفاً یک فیلد اختیاری (مثلاً coWeb) ندارد هشدار نیست. */
      else if (pools[cd].wiped) unrecovered.push({ cd: cd, co: pools[cd].co });
    });
    return { plan: plan, unrecovered: unrecovered };
  }
  /* apply: فقط رساندنِ plan به مسیر ذخیرهٔ استاندارد (با S1/S2/S3) */
  function applyPlan(current, plan, pickedCds) {
    var byCd = {};
    (plan || []).forEach(function (p) { byCd[p.cd] = p; });
    var touched = 0;
    var out = (current || []).map(function (c) {
      if (!c || !c.cd) return c;
      var p = byCd[c.cd];
      if (!p || (pickedCds && pickedCds.indexOf(c.cd) === -1)) return c;
      var c2 = JSON.parse(JSON.stringify(c));
      var did = false;
      CONTACT_FIELDS.forEach(function (f) {
        if (fieldEmpty(p.restore[f])) return;
        /* S2 دوباره در لحظهٔ اعمال — در سطح فیلد (v34.38.9) */
        if (!restorableEmpty(f, c2[f])) return;
        if (f === 'people' && !betterPeople(p.restore[f], c2[f])) return;
        c2[f] = JSON.parse(JSON.stringify(p.restore[f]));
        did = true;
      });
      if (did) touched++;
      return did ? c2 : c;
    });
    if (window.ptfEntitySaveCollection) {
      /* v34.38.9: سقف پیش‌فرض روتر ۴۰ عملیات است؛ بازیابی انبوه (امضای اصلی این
         حادثه) بی‌صدا به مسیر legacy تنزل می‌کرد. سقف را به اندازهٔ واقعی کار
         بالا می‌بریم تا همان مسیر merge-safe فرمانی طی شود. */
      window.ptfEntitySaveCollection('ptf_crm_customers', out, { reason: SAVE_REASON, maxOps: Math.max(40, touched + 5) });
    }
    return out;
  }
  window.ptfContactRecoverHasContacts = hasContacts;
  window.ptfContactRecoverParse = parseBackupCustomers;
  window.ptfContactRecoverBuildPlan = buildPlan;
  window.ptfContactRecoverApply = applyPlan;

  /* ---------- اسکن شبکه: فهرست → دانلود ترتیبی ---------- */
  function listBackups() {
    return fetch(API + '?action=list_backups', { headers: h(false) })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (!d || !d.ok || !Array.isArray(d.backups)) throw new Error((d && d.error) || 'list_failed'); return d.backups; });
  }
  function fetchBackupCustomers(name) {
    return fetch(API + '?action=get_backup&name=' + encodeURIComponent(name), { headers: h(false) })
      .then(function (r) { return r.text(); })
      .then(function (t) {
        /* سرور gz را شفاف باز می‌کند؛ اگر پاسخ خطای JSONِ {ok:false} بود، به‌عنوان ناموجود شمرده می‌شود */
        return { customers: parseBackupCustomers(t), why: diagnoseBackup(t) };
      });
  }
  /* v34.38.9: منابع محلی — بک‌آپ اضطراری دستگاه (IndexedDB) هم یک تصویر کامل است
     و در حادثهٔ «بک‌آپ سرور بدون مشتری» تنها منبع در دسترس بود. */
  function localIdbBackup() {
    return new Promise(function (resolve) {
      try {
        if (typeof window.ptfStorageIdbGet !== 'function') { resolve(null); return; }
        var done = false;
        var to = setTimeout(function () { if (!done) { done = true; resolve(null); } }, 6000);
        window.ptfStorageIdbGet('ptf_backup_local', function (val) {
          if (done) return;
          done = true; clearTimeout(to);
          var arr = null;
          try { arr = parseBackupCustomers(val); } catch (e) { arr = null; }
          resolve(arr && arr.length ? { name: 'بک‌آپ اضطراری این دستگاه (IndexedDB)', t: '', customers: arr } : null);
        });
      } catch (e) { resolve(null); }
    });
  }
  /* فایل‌های بک‌آپی که کاربر دستی اضافه می‌کند (دانلودهای قدیمی روی کامپیوتر خودش) */
  var extraSources = [];
  window.ptfContactRecoverAddSource = function (name, rawText, t) {
    var arr = parseBackupCustomers(rawText);
    if (!arr || !arr.length) return { ok: false, why: diagnoseBackup(rawText) };
    var stamp = t || '';
    if (!stamp) { try { var j = JSON.parse(rawText); stamp = j && (j.t || j.tFa) ? String(j.t || j.tFa) : ''; } catch (e) {} }
    extraSources.push({ name: '📄 ' + name, t: stamp, customers: arr });
    return { ok: true, count: arr.length, t: stamp };
  };
  window.ptfContactRecoverClearSources = function () { extraSources = []; };
  /* اسکن کامل؛ onProgress(label) اختیاری */
  function scanAll(onProgress) {
    var backupsOrd = [], skipped = [];
    return listBackups().then(function (list) {
      /* ترتیب server-side: تازه‌ترین بالا؛ suspectها را هم آخرِ صف اضافه می‌کنیم اگر ابتدای لیست نیامده باشند — همان ترتیب t desc کافی است */
      var cur = (typeof getData === 'function' ? getData('ptf_crm_customers') : []) || [];
      var seq = Promise.resolve();
      list.forEach(function (b) {
        seq = seq.then(function () {
          /* همهٔ فایل‌ها حتماً وارسی می‌شوند (سیاست توقف زودهنگام حذف شد):
             چندمنبعی بودن یعنی بک‌آپ قدیمی‌تر هنوز می‌تواند فیلدهای تازه‌ای را که
             بک‌آپ جدیدتر نداشت تأمین کند (v34.38.9) */
          if (onProgress) onProgress('… در حال وارسی ' + b.name + ' (' + b.t + ')');
          return fetchBackupCustomers(b.name).then(function (r) {
            if (r && r.customers) backupsOrd.push({ name: b.name, t: b.t, customers: r.customers });
            /* v34.38.9: فایلِ بی‌فایده دیگر در سکوت رد نمی‌شود — دلیلش گزارش می‌شود */
            else skipped.push({ name: b.name, t: b.t, why: (r && r.why) || 'unknown' });
          }).catch(function (e) {
            skipped.push({ name: b.name, t: b.t, why: 'fetch_error:' + (e && e.message ? e.message : 'خطا') });
            if (onProgress) onProgress('⚠️ ' + b.name + ': ' + (e && e.message ? e.message : 'خطا'));
          });
        });
      });
      return seq.then(function () {
        if (onProgress) onProgress('… وارسی بک‌آپ اضطراری این دستگاه');
        return localIdbBackup();
      }).then(function (loc) {
        if (loc) backupsOrd.push(loc);
        extraSources.forEach(function (s) { backupsOrd.push(s); });
        /* جدید→قدیم؛ منابعِ بدون مهر زمان انتهای صف (کم‌اولویت‌ترین) */
        backupsOrd.sort(function (a, b) { return String(b.t || '') < String(a.t || '') ? -1 : (String(b.t || '') > String(a.t || '') ? 1 : 0); });
        return { current: cur, backupsOrd: backupsOrd, skipped: skipped, result: buildPlan(cur, backupsOrd) };
      });
    });
  }
  window.ptfContactRecoverScan = scanAll;

  /* ---------- UI (مودال) ---------- */
  var lastScan = null;
  function mount(html) {
    var host = document.body || document.getElementById('panels');
    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    while (wrap.firstChild) host.appendChild(wrap.firstChild);
  }
  function status(t) { var el = document.getElementById('rcStatus'); if (el) el.innerHTML = esc(t); }
  /* v34.38.9: چرا هیچ بک‌آپی کمک نکرد؟ متن انسانی برای هر علت. */
  var WHY_FA = {
    'no_customers_key': 'این فایل اصلاً کلید مشتریان را ندارد (تصویرِ کورِ ناشی از باگ بک‌آپ فاز B — رفع‌شده در v34.38.9)',
    'no_data_section': 'ساختار فایل بک‌آپ ناشناخته است',
    'unparsable': 'فایل قابل خواندن نبود (خراب یا فشرده‌نشده)',
    'unknown': 'نامشخص'
  };
  function whyFa(w) {
    w = String(w || 'unknown');
    if (WHY_FA[w]) return WHY_FA[w];
    if (w.indexOf('server_error:') === 0) return 'سرور رد کرد: ' + w.slice(13);
    if (w.indexOf('fetch_error:') === 0) return 'خطای شبکه: ' + w.slice(12);
    return w;
  }
  function renderSkipped() {
    if (!lastScan || !lastScan.skipped || !lastScan.skipped.length) return '';
    var byWhy = {};
    lastScan.skipped.forEach(function (s) { (byWhy[s.why] = byWhy[s.why] || []).push(s.name); });
    var rows = Object.keys(byWhy).map(function (w) {
      return '<div style="margin-top:4px">• <b>' + esc(byWhy[w].length) + ' فایل</b> — ' + esc(whyFa(w)) + '<br><span style="color:#94a3b8">' + esc(byWhy[w].join('، ')) + '</span></div>';
    }).join('');
    return '<div style="margin-top:10px;font-size:11.5px;color:#7c2d12;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:8px 10px">' +
      '<b>🔎 تشخیص — بک‌آپ‌هایی که قابل استفاده نبودند:</b>' + rows +
      '<div style="margin-top:6px;color:#9a3412">اگر همهٔ فایل‌ها «کلید مشتریان را ندارند»، بک‌آپ‌های سرور در دورهٔ باگ گرفته شده‌اند. از بخش پایین، یک فایل بک‌آپ قدیمیِ دانلودشده روی رایانه‌تان را اضافه کنید.</div></div>';
  }
  function renderPlanUI() {
    var listEl = document.getElementById('rcList');
    if (!listEl || !lastScan) return;
    var rs = lastScan.result;
    if (!rs.plan.length) {
      listEl.innerHTML = '<div style="padding:10px;border:1px dashed var(--brd,#cbd5e1);border-radius:10px;font-size:12px;color:#64748b">' +
        (rs.unrecovered.length ? 'برای ' + rs.unrecovered.length + ' مشتریِ تماس‌خالی، در هیچ منبعی تماسی پیدا نشد.' : 'هیچ فیلد تماسِ خالیِ قابل‌بازیابی پیدا نشد — یا همه‌چیز سالم است یا منبعی برای پرکردن نبود.') + '</div>' + renderSkipped();
      return;
    }
    var rows = rs.plan.map(function (p) {
      var srcs = [];
      Object.keys(p.src).forEach(function (f) { if (srcs.indexOf(p.src[f]) === -1) srcs.push(p.src[f]); });
      return '<label style="display:block;padding:6px 8px;border-bottom:1px solid #f1f5f9;font-size:12px;cursor:pointer">' +
        '<input type="checkbox" class="rcPick" data-cd="' + esc(p.cd) + '" checked> ' +
        (p.wiped ? '' : '<span title="این مشتری بخشی از تماس‌هایش را دارد؛ فقط جاهای خالی پر می‌شود">🧩 </span>') +
        '<b>' + esc(p.cd) + '</b> — ' + esc(p.co) +
        ' <span style="color:#059669">→ ' + esc(Object.keys(p.restore).join('، ')) + '</span>' +
        ' <span style="color:#94a3b8;font-size:11px">(منبع: ' + esc(srcs.join('، ')) + ')</span></label>';
    }).join('');
    var un = rs.unrecovered.length ? '<div style="margin-top:8px;font-size:11.5px;color:#b45309">⚠️ ' + rs.unrecovered.length + ' مشتری در هیچ منبعی تماس نداشتند: ' + esc(rs.unrecovered.map(function (u) { return u.cd; }).join('، ')) + '</div>' : '';
    listEl.innerHTML = '<div style="margin:8px 0;font-size:12px;font-weight:800;color:#065f46">' + rs.plan.length + ' مشتری قابل‌بازیابی یافت شد:</div>' +
      '<div style="max-height:38vh;overflow:auto;border:1px solid var(--brd,#cbd5e1);border-radius:10px">' + rows + '</div>' + un + renderSkipped();
    var btnApply = document.getElementById('rcApply');
    if (btnApply) btnApply.disabled = false;
  }
  function startScan() {
    var btn = document.getElementById('rcStart');
    if (btn) btn.disabled = true;
    status('در حال دریافت فهرست بک‌آپ‌های سرور…');
    lastScan = null;
    scanAll(function (t) { status(t); }).then(function (res) {
      lastScan = res;
      status('اسکن کامل شد — ' + res.backupsOrd.length + ' منبع قابل‌استفاده' +
        (res.skipped && res.skipped.length ? ' و ' + res.skipped.length + ' منبع بی‌فایده (دلیل زیر آمده)' : '') + '.');
      renderPlanUI();
      if (btn) btn.disabled = false;
    }).catch(function (e) {
      status('⛔ خطا: ' + (e && e.message ? e.message : e));
      if (btn) btn.disabled = false;
    });
  }
  /* v34.38.9: افزودن فایل بک‌آپ دستی به منابع (وقتی بک‌آپ سرور کور بوده) */
  window.ptfContactRecoverPickFiles = function (inp) {
    var files = (inp && inp.files) ? Array.prototype.slice.call(inp.files) : [];
    if (!files.length) return;
    var added = 0, failed = [];
    var seq = Promise.resolve();
    files.forEach(function (file) {
      seq = seq.then(function () {
        return new Promise(function (resolve) {
          var fr = new FileReader();
          fr.onload = function () {
            var r = window.ptfContactRecoverAddSource(file.name, String(fr.result || ''));
            if (r.ok) added++; else failed.push(file.name + ' (' + whyFa(r.why) + ')');
            resolve();
          };
          fr.onerror = function () { failed.push(file.name + ' (خواندن فایل ناموفق)'); resolve(); };
          fr.readAsText(file);
        });
      });
    });
    seq.then(function () {
      var box = document.getElementById('rcSrcInfo');
      if (box) box.innerHTML = (added ? '<span style="color:#047857;font-weight:800">✅ ' + added + ' فایل بک‌آپ به منابع اضافه شد — حالا «شروع اسکن» را بزنید.</span>' : '') +
        (failed.length ? '<div style="color:#b45309">⚠️ ' + esc(failed.join('، ')) + '</div>' : '');
      try { inp.value = ''; } catch (e) {}
    });
  };
  function applyNow() {
    if (!lastScan) return;
    var picked = [];
    var boxes = document.querySelectorAll('#rcList .rcPick');
    for (var i = 0; i < boxes.length; i++) { if (boxes[i].checked) picked.push(boxes[i].getAttribute('data-cd')); }
    if (!picked.length) { alert('هیچ موردی برای بازگردانی انتخاب نشده است.'); return; }
    var rs = lastScan.result;
    var plan = rs.plan.filter(function (p) { return picked.indexOf(p.cd) > -1; });
    applyPlan(lastScan.current, plan, picked);
    try { if (typeof audit === 'function') audit('بازیابی داده', '🛟 بازیابی خودکار تماس: ' + plan.length + ' مشتری — فیلدها: ' + JSON.stringify(plan.map(function (p) { return { cd: p.cd, f: Object.keys(p.restore) }; }))); } catch (e) {}
    var n = plan.length;
    alert('✅ بازیابی ثبت شد: ' + n + ' مشتری. بعد از پایان سینک، صفحه را رفرش کنید و روی سیستم دیگر هم بررسی کنید.');
    var dlg = document.getElementById('rcDlg');
    if (dlg) dlg.remove();
    try { if (typeof renderCustomers === 'function') renderCustomers(); } catch (e2) {}
  }
  function open() {
    if (!canRun()) { alert('بازیابی خودکار از بک‌آپ‌های سرور فقط برای ادمین / رییس هیات مدیره در دسترس است.'); return; }
    mount(
      '<div class="md-b" id="rcDlg"><div class="md" style="max-width:860px;max-height:88vh;overflow:auto">' +
      '<h3 style="margin:0 0 8px">🛟 بازیابی خودکار اطلاعات تماس مشتریان</h3>' +
      '<div style="font-size:12px;color:#475569;line-height:1.9;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:8px 10px;margin-bottom:8px">' +
      'این ابزار بک‌آپ‌های چرخشی سرور (ساعتی/روزانه/هفتگی/ماهانه)، بک‌آپ اضطراری همین دستگاه و هر فایلی که خودتان اضافه کنید را <b>از جدید به قدیمی</b> وارسی می‌کند و <b>هر فیلد تماسِ خالی</b> را از جدیدترین منبعی که آن را دارد پر می‌کند. لازم نیست بدانید پاک‌شدن چه زمانی بوده است. مقدار سالمِ فعلی هرگز بازنویسی نمی‌شود و هیچ رکوردی حذف/ایجاد نمی‌شود.' +
      '<div style="margin-top:6px;color:#9a3412">🧩 مشتریانی که فقط بخشی از تماس‌هایشان رفته (مثلاً شمارهٔ شرکت مانده ولی اشخاص رابط پاک شده) هم از v34.38.9 پوشش داده می‌شوند.</div></div>' +
      '<div style="font-size:12px;background:#f8fafc;border:1px solid var(--brd,#cbd5e1);border-radius:10px;padding:8px 10px;margin-bottom:8px">' +
      '📄 <b>افزودن منبع دستی (اختیاری):</b> اگر بک‌آپ‌های سرور در دورهٔ باگ گرفته شده‌اند، فایل بک‌آپ دانلودشدهٔ قدیمی خود را اینجا اضافه کنید. ' +
      '<input type="file" id="rcFiles" accept=".json" multiple onchange="ptfContactRecoverPickFiles(this)" style="font-size:11.5px">' +
      '<div id="rcSrcInfo" style="margin-top:4px"></div></div>' +
      '<div id="rcStatus" style="font-size:12.5px;color:#334155;margin:8px 0">برای شروع، «شروع اسکن» را بزنید.</div>' +
      '<div id="rcList"></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px;flex-wrap:wrap">' +
      '<button class="bt" id="rcStart">▶️ شروع اسکن بک‌آپ‌ها</button>' +
      '<button class="bt" id="rcApply" disabled style="background:#059669">تایید و بازگردانی انتخاب‌شده‌ها</button>' +
      '<button class="bt bt-o" onclick="document.getElementById(\'rcDlg\').remove()">✕ بستن</button>' +
      '</div></div></div>'
    );
    document.getElementById('rcStart').onclick = startScan;
    document.getElementById('rcApply').onclick = applyNow;
  }
  window.ptfOpenContactRecovery = open;
})();
