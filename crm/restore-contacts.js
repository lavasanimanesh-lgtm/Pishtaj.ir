/* =====================================================================
   PTF CRM — restore-contacts.js (v34.38.8 — CONTACT-RECOVERY-ONECLICK)
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

  /* v34.38.8 (LOCK): فقط تماس — هر فیلد دیگری تخلف از قرارداد است */
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
  /* plan: current + backups(newest→oldest) → {plan, unrecovered}
     plan[i] = { cd, co, restore:{field:value}, src:{field:backupName} } */
  function buildPlan(current, backupsOrd) {
    var pools = {}, order = [];
    (current || []).forEach(function (c) {
      if (!c || !c.cd || hasContacts(c)) return; /* S2: تماس‌دار فعلی دست‌نخورده */
      pools[c.cd] = { cd: c.cd, co: c.co || c.nm || '', restore: {}, src: {} };
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
          if (fieldEmpty(p.restore[f]) && !fieldEmpty(src[f]) && fieldEmpty(curField(cd, f))) {
            /* S1/S2: فقط فیلدی که در فعلیِ سرور خالی مانده و در این بک‌آپ پر است —
               چندمنبعی: پاک‌شدن‌ها تاریخ‌های متفاوت دارند؛ هر فیلد از جدیدترین
               بک‌آپی که «آن فیلد را» دارد می‌آید (ممکن است ترکیبی از دو نسخه شود) */
            p.restore[f] = JSON.parse(JSON.stringify(src[f]));
            p.src[f] = bk.name;
          }
        });
      });
    });
    var plan = [], unrecovered = [];
    order.forEach(function (cd) { if (Object.keys(pools[cd].restore).length) plan.push(pools[cd]); else unrecovered.push({ cd: cd, co: pools[cd].co }); });
    return { plan: plan, unrecovered: unrecovered };
    function curField(cd, f) {
      for (var i = 0; i < current.length; i++) if (current[i] && current[i].cd === cd) return current[i][f];
      return undefined;
    }
  }
  /* apply: فقط رساندنِ plan به مسیر ذخیرهٔ استاندارد (با S1/S2/S3) */
  function applyPlan(current, plan, pickedCds) {
    var byCd = {};
    (plan || []).forEach(function (p) { byCd[p.cd] = p; });
    var out = (current || []).map(function (c) {
      if (!c || !c.cd) return c;
      var p = byCd[c.cd];
      if (!p || (pickedCds && pickedCds.indexOf(c.cd) === -1)) return c;
      if (hasContacts(c)) return c; /* S2 دوباره در لحظهٔ اعمال */
      var c2 = JSON.parse(JSON.stringify(c));
      CONTACT_FIELDS.forEach(function (f) {
        if (!fieldEmpty(p.restore[f]) && fieldEmpty(c2[f])) c2[f] = JSON.parse(JSON.stringify(p.restore[f]));
      });
      return c2;
    });
    if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_customers', out, { reason: SAVE_REASON });
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
        var arr = parseBackupCustomers(t);
        return arr;
      });
  }
  /* اسکن کامل؛ onProgress(label) اختیاری */
  function scanAll(onProgress) {
    var backupsOrd = [];
    return listBackups().then(function (list) {
      /* ترتیب server-side: تازه‌ترین بالا؛ suspectها را هم آخرِ صف اضافه می‌کنیم اگر ابتدای لیست نیامده باشند — همان ترتیب t desc کافی است */
      var cur = (typeof getData === 'function' ? getData('ptf_crm_customers') : []) || [];
      var seq = Promise.resolve();
      list.forEach(function (b) {
        seq = seq.then(function () {
          /* همهٔ فایل‌ها حتماً وارسی می‌شوند (سیاست توقف زودهنگام حذف شد):
             چندمنبعی بودن یعنی بک‌آپ قدیمی‌تر هنوز می‌تواند فیلدهای تازه‌ای را که
             بک‌آپ جدیدتر نداشت تأمین کند (v34.38.8) */
          if (onProgress) onProgress('… در حال وارسی ' + b.name + ' (' + b.t + ')');
          return fetchBackupCustomers(b.name).then(function (arr) {
            if (arr) backupsOrd.push({ name: b.name, t: b.t, customers: arr });
          }).catch(function (e) { if (onProgress) onProgress('⚠️ ' + b.name + ': ' + (e && e.message ? e.message : 'خطا')); });
        });
      });
      return seq.then(function () { return { current: cur, backupsOrd: backupsOrd, result: buildPlan(cur, backupsOrd) }; });
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
  function renderPlanUI() {
    var listEl = document.getElementById('rcList');
    if (!listEl || !lastScan) return;
    var rs = lastScan.result;
    if (!rs.plan.length) {
      listEl.innerHTML = '<div style="padding:10px;border:1px dashed var(--brd,#cbd5e1);border-radius:10px;font-size:12px;color:#64748b">' +
        (rs.unrecovered.length ? 'برای ' + rs.unrecovered.length + ' مشتریِ تماس‌خالی، در هیچ بک‌آپی تماسی پیدا نشد. (ممکن است قبل از شروع بک‌آپ‌گیری پاک شده باشند یا تماس هرگز ثبت نشده)' : 'همهٔ مشتریان فعلی یا تماس دارند یا در بک‌آپ‌ها یافت شدند — کاری لازم نیست.') + '</div>';
      return;
    }
    var rows = rs.plan.map(function (p) {
      var srcs = [];
      Object.keys(p.src).forEach(function (f) { if (srcs.indexOf(p.src[f]) === -1) srcs.push(p.src[f]); });
      return '<label style="display:block;padding:6px 8px;border-bottom:1px solid #f1f5f9;font-size:12px;cursor:pointer">' +
        '<input type="checkbox" class="rcPick" data-cd="' + esc(p.cd) + '" checked> ' +
        '<b>' + esc(p.cd) + '</b> — ' + esc(p.co) +
        ' <span style="color:#059669">→ ' + esc(Object.keys(p.restore).join('، ')) + '</span>' +
        ' <span style="color:#94a3b8;font-size:11px">(منبع: ' + esc(srcs.join('، ')) + ')</span></label>';
    }).join('');
    var un = rs.unrecovered.length ? '<div style="margin-top:8px;font-size:11.5px;color:#b45309">⚠️ ' + rs.unrecovered.length + ' مشتری در هیچ بک‌آپی تماس نداشتند: ' + esc(rs.unrecovered.map(function (u) { return u.cd; }).join('، ')) + '</div>' : '';
    listEl.innerHTML = '<div style="margin:8px 0;font-size:12px;font-weight:800;color:#065f46">' + rs.plan.length + ' مشتری قابل‌بازیابی یافت شد:</div>' +
      '<div style="max-height:38vh;overflow:auto;border:1px solid var(--brd,#cbd5e1);border-radius:10px">' + rows + '</div>' + un;
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
      status('اسکن کامل شد (' + res.backupsOrd.length + ' بک‌آپ خوانده شد). پیش‌نمایش را بررسی و تایید کنید.');
      renderPlanUI();
      if (btn) btn.disabled = false;
    }).catch(function (e) {
      status('⛔ خطا: ' + (e && e.message ? e.message : e));
      if (btn) btn.disabled = false;
    });
  }
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
      'این ابزار بک‌آپ‌های چرخشی سرور (ساعتی/روزانه/هفتگی/ماهانه) را <b>از جدید به قدیمی</b> خودکار وارسی می‌کند و برای هر مشتریِ «تماس‌خالیِ فعلی» جدیدترین تماس‌های موجود را پیدا می‌کند. لازم نیست بدانید، پاک‌شدن چه زمانی بوده است. <b>فقط فیلدهای تماسِ خالی</b> پر می‌شوند؛ هیچ دادهٔ دیگری دست نمی‌خورد.</div>' +
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
