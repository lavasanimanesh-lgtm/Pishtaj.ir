/* =====================================================================
   PTF CRM — restore-collection.js (v34.38.13 — RECORD-RECOVERY)
   بازیابی «رکوردهای گم‌شدهٔ یک مجموعه» از بک‌آپ‌های چرخشی سرور یا فایل دانلودشده
   ---------------------------------------------------------------------
   انگیزه (حادثهٔ ۱۴۰۵/۰۶/۱۷ — ARENA-CRM-RFQSMART-MASS-DELETION-RCA-2026-09-09):
   کلید ptf_crm_rfqsmart («درخواست تأمین») روی سرور از ۶۸ رکورد به ۱ رکورد رسید،
   بدون هیچ سنگ‌قبری. سپرهای v34.38.12 جلوی تکرار را می‌گیرند، ولی رکوردهای
   ازدست‌رفته باید برگردند. ابزار بازیابی موجود (restore-contacts.js) عمداً فقط
   «فیلدهای تماسِ مشتری» را ترمیم می‌کند و هیچ رکوردی نمی‌سازد؛ این ابزار مکمل آن
   است و فقط «رکوردِ کاملاً غایب» را بازمی‌گرداند.

   قواعد امنیت (سخت — همان سبک S1..S5 ابزار تماس):
     R1) فقط افزودن. هیچ رکورد موجودی ویرایش یا حذف نمی‌شود (حتی اگر نسخهٔ بک‌آپ
         «کامل‌تر» به‌نظر برسد) — تصمیم دربارهٔ محتوای رکورد زنده با کاربر است.
     R2) رکوردی که سنگ‌قبر حذف دارد هرگز زنده نمی‌شود (پایان «رکورد حذف‌شده برگشت»).
     R3) فقط رکوردی که شناسهٔ یکتا دارد (همان قرارداد سرور: _id/cd/no/id/code) و
         شناسه‌اش در مجموعهٔ فعلی نیست.
     R4) نقش مجاز: admin/chairman (هم‌پایهٔ get_backup: users_write).
     R5) هر بازیابی در audit ثبت و با reason مخصوص روی مسیر ذخیرهٔ استاندارد
         اعمال می‌شود؛ چون فقط «افزایش» رخ می‌دهد، سپر حذف انبوهِ v34.38.12
         مانع آن نیست.
   ============================================================================= */
(function () {
  'use strict';
  var API = '../api/crm.php';
  var ROLES_OK = ['admin', 'chairman'];
  var SAVE_REASON = 'record-restore';
  var MAX_RESTORE = 2000;

  /* مجموعه‌های قابل بازیابی + برچسب فارسی. کلید باید در فهرست همگام‌سازی باشد. */
  var COLLECTIONS = [
    ['ptf_crm_rfqsmart', 'درخواست تأمین'],
    ['ptf_crm_rfqs', 'استعلام/درخواست مشتری'],
    ['ptf_crm_offers', 'پیشنهادها'],
    ['ptf_crm_customers', 'مشتریان'],
    ['ptf_crm_suppliers', 'تأمین‌کنندگان'],
    ['ptf_crm_products', 'کالاها'],
    ['ptf_crm_leads', 'سرنخ‌ها'],
    ['ptf_crm_deals', 'پرونده‌های فروش'],
    ['ptf_crm_projects', 'پروژه‌ها'],
    ['ptf_crm_invoices', 'فاکتورها'],
    ['ptf_crm_contracts', 'قراردادها'],
    ['ptf_crm_letters', 'مکاتبات'],
    ['ptf_crm_inqitems', 'اقلام استعلام'],
    ['ptf_crm_reminders', 'یادآورها'],
    ['ptf_crm_packinglists', 'لیست‌های بسته‌بندی']
  ];
  /* همان نگاشت سرور (sync_tombstone_kinds_for_key) — بدون آن، سنگ‌قبرها دیده نمی‌شوند */
  var TOMB_KINDS = {
    ptf_crm_offers: ['offer', 'offers', 'to', 'co', 'tc'],
    ptf_crm_rfqs: ['rfq', 'request', 'inq', 'inquiry'],
    ptf_crm_customers: ['customer', 'customers', 'cust'],
    ptf_crm_suppliers: ['supplier', 'suppliers', 'sup'],
    ptf_crm_products: ['product', 'products', 'prod'],
    ptf_crm_leads: ['lead', 'leads'],
    ptf_crm_invoices: ['invoice', 'invoices', 'inv'],
    ptf_crm_deals: ['deal', 'deals', 'salesfile'],
    ptf_crm_projects: ['project', 'projects', 'salesfile'],
    ptf_crm_letters: ['letter', 'letters'],
    ptf_crm_contracts: ['contract', 'contracts'],
    ptf_crm_rfqsmart: ['rfqsmart', 'supplyrfq'],
    ptf_crm_inqitems: ['inqitem', 'inqitems', 'iqi']
  };

  function h(json) {
    var hd = json ? { 'Content-Type': 'application/json' } : {};
    try { hd['X-CRM-Role'] = curRole(); var t = (typeof ptfAuthToken === 'function' ? ptfAuthToken() : ''); if (t) hd['X-CRM-Token'] = t; } catch (e) {}
    return hd;
  }
  function canRun() { try { return ROLES_OK.indexOf(curRole()) > -1; } catch (e) { return false; } }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function labelOf(key) {
    for (var i = 0; i < COLLECTIONS.length; i++) if (COLLECTIONS[i][0] === key) return COLLECTIONS[i][1];
    return String(key || '').replace('ptf_crm_', '');
  }

  /* ---------- منطق خالص (بدون DOM — قابل تست در vm) ---------- */
  /* قرارداد شناسه دقیقاً مثل سرور (sync_record_id_for_key) تا «موجود بودن» دو طرف یکی فهمیده شود */
  function recordId(key, r) {
    if (!r || typeof r !== 'object') return '';
    if (key === 'ptf_crm_offers') return String(r.no == null ? (r.cd == null ? (r.id == null ? '' : r.id) : r.cd) : r.no).trim();
    var order = ['_id', 'cd', 'no', 'id', 'code', 'invoiceCd'];
    for (var i = 0; i < order.length; i++) {
      var v = r[order[i]];
      if (v != null && String(v).trim() !== '') return String(v).trim();
    }
    return '';
  }
  /* R2: مجموعهٔ شناسه‌هایی که سنگ‌قبر حذف دارند (هم‌ارز sync_tombstone_id_set سرور) */
  function tombstoneIdSet(key, archive) {
    var kinds = TOMB_KINDS[key] || [], ids = {};
    (Array.isArray(archive) ? archive : []).forEach(function (d) {
      if (!d || typeof d !== 'object') return;
      var kind = String(d.kind || '').toLowerCase();
      if (kind === 'archive_purge') {
        if (d.identities && Array.isArray(d.identities[key])) {
          d.identities[key].forEach(function (x) { x = String(x == null ? '' : x).trim(); if (x) ids[x] = true; });
        }
        return;
      }
      if (kinds.indexOf(kind) < 0) return;
      var id = String(d.id == null ? (d.no == null ? (d.cd == null ? '' : d.cd) : d.no) : d.id).trim();
      if (id) ids[id] = true;
    });
    return ids;
  }
  /* نقشهٔ نامزدها از منابع مرتب‌شده (جدید→قدیم): اولین منبعی که رکورد را دارد برنده است */
  function buildRestorePlan(key, current, sources, archive) {
    var tomb = tombstoneIdSet(key, archive);
    var have = {};
    (Array.isArray(current) ? current : []).forEach(function (r) { var id = recordId(key, r); if (id) have[id] = true; });
    var plan = [], seen = {}, blockedByTomb = [], noId = 0;
    (sources || []).forEach(function (src) {
      (Array.isArray(src.rows) ? src.rows : []).forEach(function (r) {
        if (!r || typeof r !== 'object' || Array.isArray(r)) return;
        var id = recordId(key, r);
        if (!id) { noId++; return; }
        if (have[id] || seen[id]) return;
        if (tomb[id]) { if (blockedByTomb.indexOf(id) < 0) blockedByTomb.push(id); return; }
        seen[id] = true;
        plan.push({ id: id, row: r, from: src.name, t: src.t || '', title: rowTitle(r) });
      });
    });
    return { plan: plan, blockedByTomb: blockedByTomb, withoutId: noId, currentCount: (current || []).length };
  }
  function rowTitle(r) {
    var cands = ['nm', 'title', 'co', 'name', 'subject', 'desc'];
    for (var i = 0; i < cands.length; i++) {
      var v = r[cands[i]];
      if (typeof v === 'string' && v.trim()) return v.trim().slice(0, 60);
    }
    return '';
  }
  /* R1: فقط الحاق. ترتیب: رکوردهای فعلی، سپس بازیابی‌شده‌ها (به ترتیب منبع). */
  function applyPlan(key, current, plan, pickedIds) {
    var cur = Array.isArray(current) ? current.slice() : [];
    var have = {};
    cur.forEach(function (r) { var id = recordId(key, r); if (id) have[id] = true; });
    var added = 0;
    (plan || []).forEach(function (p) {
      if (pickedIds && pickedIds.indexOf(p.id) < 0) return;
      if (have[p.id]) return;              /* دوباره‌بررسی در لحظهٔ اعمال */
      if (added >= MAX_RESTORE) return;
      var row = JSON.parse(JSON.stringify(p.row));
      row._restoredFrom = String(p.from || 'backup');
      row._restoredAt = new Date().toISOString();
      cur.push(row);
      have[p.id] = true;
      added++;
    });
    return { out: cur, added: added };
  }
  function parseBackupRows(payload, key) {
    var j = payload;
    if (typeof j === 'string') { try { j = JSON.parse(j); } catch (e) { return { rows: null, why: 'unparsable' }; } }
    if (!j || typeof j !== 'object') return { rows: null, why: 'unparsable' };
    if (j.ok === false) return { rows: null, why: 'server_error:' + (j.error || '') };
    if (Array.isArray(j)) return { rows: j, why: 'ok' };
    if (!j.data || typeof j.data !== 'object') return { rows: null, why: 'no_data_section' };
    var v = j.data[key];
    if (v == null) return { rows: null, why: 'no_key' };
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e2) { return { rows: null, why: 'unparsable_key' }; } }
    if (!Array.isArray(v)) return { rows: null, why: 'not_a_list' };
    return { rows: v, why: 'ok', t: j.t || '' };
  }
  window.ptfRestoreCollectionId = recordId;
  window.ptfRestoreCollectionTombSet = tombstoneIdSet;
  window.ptfRestoreCollectionPlan = buildRestorePlan;
  window.ptfRestoreCollectionApply = applyPlan;
  window.ptfRestoreCollectionParse = parseBackupRows;

  /* ---------- خواندن وضعیت فعلی ---------- */
  /* خواندن فقط از لایهٔ داده (getData ⇒ آینهٔ فاز B سپس localStorage). دسترسی مستقیم
     به localStorage در این ابزار ممنوع است: هم قرارداد معماری (T0-1) و هم دقیقاً همان
     نقطه‌ای که در حادثهٔ اصلی «نمای ناقص» ساخت. */
  function currentRows(key) {
    try {
      if (typeof getData === 'function') { var d = getData(key); if (Array.isArray(d)) return d; }
    } catch (e) {}
    return [];
  }
  function currentArchive() {
    try {
      if (typeof getData === 'function') { var a = getData('ptf_crm_deleted_archive'); if (Array.isArray(a)) return a; }
    } catch (e) {}
    return [];
  }

  /* ---------- اسکن: فهرست بک‌آپ سرور → دانلود ترتیبی (جدید→قدیم) ---------- */
  var manualSources = [];
  window.ptfRestoreCollectionAddSource = function (name, text, key) {
    var p = parseBackupRows(text, key);
    if (!p.rows) return { ok: false, why: p.why };
    manualSources.push({ name: 'فایل: ' + name, t: p.t || '', rows: p.rows });
    return { ok: true, count: p.rows.length };
  };
  function listBackups() {
    return fetch(API + '?action=list_backups', { headers: h(false), cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) { return (d && d.ok && Array.isArray(d.backups)) ? d.backups : []; });
  }
  function scan(key, onProgress) {
    var sources = [], skipped = [];
    return listBackups().then(function (list) {
      var seq = Promise.resolve();
      list.forEach(function (b) {
        seq = seq.then(function () {
          if (onProgress) onProgress('… وارسی ' + b.name + ' (' + b.t + ')');
          return fetch(API + '?action=get_backup&name=' + encodeURIComponent(b.name), { headers: h(false), cache: 'no-store' })
            .then(function (r) { return r.text(); })
            .then(function (txt) {
              var p = parseBackupRows(txt, key);
              if (p.rows) sources.push({ name: b.name, t: b.t || p.t || '', rows: p.rows });
              else skipped.push({ name: b.name, why: p.why });
            })
            .catch(function (e) { skipped.push({ name: b.name, why: 'fetch_error:' + (e && e.message ? e.message : 'خطا') }); });
        });
      });
      return seq;
    }).then(function () {
      manualSources.forEach(function (s) { sources.push(s); });
      sources.sort(function (a, b) { return String(b.t || '') < String(a.t || '') ? -1 : (String(b.t || '') > String(a.t || '') ? 1 : 0); });
      var cur = currentRows(key);
      return { key: key, current: cur, sources: sources, skipped: skipped, result: buildRestorePlan(key, cur, sources, currentArchive()) };
    });
  }
  window.ptfRestoreCollectionScan = scan;

  /* ---------- UI ---------- */
  var lastScan = null;
  function status(t) { var el = document.getElementById('rkStatus'); if (el) el.innerHTML = esc(t); }
  function selectedKey() {
    var sel = document.getElementById('rkKey');
    return sel ? sel.value : 'ptf_crm_rfqsmart';
  }
  function renderPlan() {
    var box = document.getElementById('rkList');
    if (!box || !lastScan) return;
    var rs = lastScan.result, key = lastScan.key;
    var head = '<div style="margin:8px 0;font-size:12px">وضعیت فعلی «' + esc(labelOf(key)) + '»: <b>' + rs.currentCount + '</b> رکورد · منابع قابل استفاده: <b>' + lastScan.sources.length + '</b></div>';
    if (!rs.plan.length) {
      box.innerHTML = head + '<div style="padding:10px;border:1px dashed var(--brd,#cbd5e1);border-radius:10px;font-size:12px;color:#64748b">هیچ رکورد غایبی در بک‌آپ‌ها پیدا نشد' +
        (rs.blockedByTomb.length ? ' (' + rs.blockedByTomb.length + ' رکورد سنگ‌قبرِ حذف دارند و عمداً بازگردانده نمی‌شوند).' : '.') + '</div>';
      return;
    }
    var shown = rs.plan.slice(0, 300);
    var rows = shown.map(function (p) {
      return '<label style="display:block;padding:5px 8px;border-bottom:1px solid #f1f5f9;font-size:12px;cursor:pointer">' +
        '<input type="checkbox" class="rkPick" data-id="' + esc(p.id) + '" checked> <b>' + esc(p.id) + '</b>' +
        (p.title ? ' — ' + esc(p.title) : '') +
        ' <span style="color:#94a3b8;font-size:11px">(منبع: ' + esc(p.from) + (p.t ? ' · ' + esc(p.t) : '') + ')</span></label>';
    }).join('');
    box.innerHTML = head +
      '<div style="margin:6px 0;font-size:12.5px;font-weight:800;color:#065f46">✅ ' + rs.plan.length + ' رکورد غایب قابل بازگردانی' + (rs.plan.length > shown.length ? ' (نمایش ' + shown.length + ' مورد اول؛ همه اعمال می‌شوند)' : '') + '</div>' +
      '<div style="max-height:38vh;overflow:auto;border:1px solid var(--brd,#cbd5e1);border-radius:10px">' + rows + '</div>' +
      (rs.blockedByTomb.length ? '<div style="margin-top:8px;font-size:11.5px;color:#b45309">🪦 ' + rs.blockedByTomb.length + ' رکورد به‌دلیل داشتن سنگ‌قبرِ حذف بازگردانده نمی‌شوند (حذف عمدی بوده): ' + esc(rs.blockedByTomb.slice(0, 12).join('، ')) + '</div>' : '') +
      (rs.withoutId ? '<div style="margin-top:4px;font-size:11.5px;color:#94a3b8">' + rs.withoutId + ' ردیف بک‌آپ شناسهٔ یکتا نداشتند و نادیده گرفته شدند.</div>' : '') +
      (lastScan.skipped.length ? '<div style="margin-top:6px;font-size:11.5px;color:#7c2d12">فایل‌های بی‌فایده: ' + esc(lastScan.skipped.map(function (s) { return s.name + ' (' + s.why + ')'; }).join('، ')) + '</div>' : '');
    var btn = document.getElementById('rkApply');
    if (btn) btn.disabled = false;
  }
  function startScan() {
    var key = selectedKey();
    var btn = document.getElementById('rkStart');
    if (btn) btn.disabled = true;
    lastScan = null;
    var applyBtn = document.getElementById('rkApply');
    if (applyBtn) applyBtn.disabled = true;
    status('در حال دریافت فهرست بک‌آپ‌های سرور…');
    scan(key, status).then(function (res) {
      lastScan = res;
      status('اسکن کامل شد.');
      renderPlan();
      if (btn) btn.disabled = false;
    }).catch(function (e) {
      status('⛔ خطا: ' + (e && e.message ? e.message : e));
      if (btn) btn.disabled = false;
    });
  }
  window.ptfRestoreCollectionPickFiles = function (inp) {
    var files = (inp && inp.files) ? Array.prototype.slice.call(inp.files) : [];
    if (!files.length) return;
    var key = selectedKey(), added = 0, failed = [];
    var seq = Promise.resolve();
    files.forEach(function (file) {
      seq = seq.then(function () {
        return new Promise(function (resolve) {
          var fr = new FileReader();
          fr.onload = function () {
            var r = window.ptfRestoreCollectionAddSource(file.name, String(fr.result || ''), key);
            if (r.ok) added++; else failed.push(file.name + ' (' + r.why + ')');
            resolve();
          };
          fr.onerror = function () { failed.push(file.name + ' (خواندن فایل ناموفق)'); resolve(); };
          fr.readAsText(file);
        });
      });
    });
    seq.then(function () {
      var box = document.getElementById('rkSrcInfo');
      if (box) box.innerHTML = (added ? '<span style="color:#047857;font-weight:800">✅ ' + added + ' فایل اضافه شد — حالا «شروع اسکن» را بزنید.</span>' : '') +
        (failed.length ? '<div style="color:#b45309">⚠️ ' + esc(failed.join('، ')) + '</div>' : '');
      try { inp.value = ''; } catch (e) {}
    });
  };
  function applyNow() {
    if (!lastScan) return;
    var key = lastScan.key;
    var picked = [];
    var boxes = document.querySelectorAll('#rkList .rkPick');
    for (var i = 0; i < boxes.length; i++) if (boxes[i].checked) picked.push(boxes[i].getAttribute('data-id'));
    /* موارد فراتر از ۳۰۰ ردیفِ نمایش‌داده‌شده هم بازگردانده می‌شوند مگر کاربر تیکشان را بردارد */
    lastScan.result.plan.forEach(function (p) { if (picked.indexOf(p.id) < 0 && !document.querySelector('#rkList .rkPick[data-id="' + p.id.replace(/"/g, '') + '"]')) picked.push(p.id); });
    if (!picked.length) { alert('هیچ رکوردی انتخاب نشده است.'); return; }
    /* وضعیت را دوباره و تازه می‌خوانیم تا بین اسکن و اعمال چیزی از دست نرود */
    var fresh = currentRows(key);
    var res = applyPlan(key, fresh, lastScan.result.plan, picked);
    if (!res.added) { alert('چیزی برای افزودن نماند (احتمالاً در این فاصله سینک شده است).'); return; }
    var saved = false;
    try {
      if (typeof window.ptfEntitySaveCollection === 'function') {
        window.ptfEntitySaveCollection(key, res.out, { reason: SAVE_REASON, maxOps: Math.max(40, res.added + 5) });
        saved = true;
      }
    } catch (eEnt) { saved = false; }
    if (!saved) { try { setData(key, res.out); saved = true; } catch (eSet) { saved = false; } }
    if (!saved) { alert('⛔ ذخیرهٔ محلی ناموفق بود؛ چیزی ارسال نشد.'); return; }
    try { audit('بازیابی داده', '🛟 بازگردانی ' + res.added + ' رکورد غایب در «' + labelOf(key) + '» از بک‌آپ (' + (lastScan.result.plan[0] ? lastScan.result.plan[0].from : '') + ')', key); } catch (eA) {}
    try { if (typeof window.ptfSyncFlushNow === 'function') window.ptfSyncFlushNow(function () {}); } catch (eF) {}
    alert('✅ ' + res.added + ' رکورد به «' + labelOf(key) + '» بازگردانده شد و در حال ارسال به سرور است.\nپس از سبزشدن نشانگر همگام، روی دستگاه دیگر هم بررسی کنید.');
    var dlg = document.getElementById('rkDlg');
    if (dlg) dlg.remove();
    try { if (typeof window.ptfRefreshCurrentPanel === 'function') window.ptfRefreshCurrentPanel(); } catch (eR) {}
  }
  function open(preKey) {
    if (!canRun()) { alert('بازیابی رکورد از بک‌آپ‌های سرور فقط برای ادمین / رییس هیات مدیره در دسترس است.'); return; }
    manualSources = [];
    var opts = COLLECTIONS.map(function (c) {
      return '<option value="' + c[0] + '"' + (c[0] === (preKey || 'ptf_crm_rfqsmart') ? ' selected' : '') + '>' + esc(c[1]) + ' (' + esc(c[0].replace('ptf_crm_', '')) + ')</option>';
    }).join('');
    var host = document.body || document.getElementById('panels');
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div class="md-b" id="rkDlg" style="display:grid;z-index:3700"><div class="md" style="max-width:880px;max-height:88vh;overflow:auto">' +
      '<h3 style="margin:0 0 8px">🛟 بازیابی رکوردهای گم‌شده از بک‌آپ</h3>' +
      '<div style="font-size:12px;color:#475569;line-height:1.9;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:8px 10px;margin-bottom:8px">' +
      'بک‌آپ‌های چرخشی سرور (ساعتی/روزانه/هفتگی/ماهانه/قرنطینه) و هر فایل بک‌آپی که خودتان اضافه کنید، <b>از جدید به قدیم</b> وارسی می‌شوند و <b>فقط رکوردهایی که امروز در سامانه نیستند</b> برمی‌گردند. ' +
      'هیچ رکورد موجودی ویرایش یا حذف نمی‌شود و رکوردی که <b>سنگ‌قبر حذف</b> دارد (حذف عمدی) هرگز زنده نمی‌شود.</div>' +
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px">' +
      '<label style="font-size:12.5px;font-weight:800">مجموعه:</label><select id="rkKey" class="in" style="max-width:320px">' + opts + '</select></div>' +
      '<div style="font-size:12px;background:#f8fafc;border:1px solid var(--brd,#cbd5e1);border-radius:10px;padding:8px 10px;margin-bottom:8px">' +
      '📄 <b>افزودن فایل بک‌آپ دانلودشده (اختیاری):</b> ' +
      '<input type="file" id="rkFiles" accept=".json" multiple onchange="ptfRestoreCollectionPickFiles(this)" style="font-size:11.5px">' +
      '<div id="rkSrcInfo" style="margin-top:4px"></div></div>' +
      '<div id="rkStatus" style="font-size:12.5px;color:#334155;margin:8px 0">برای شروع، «شروع اسکن» را بزنید.</div>' +
      '<div id="rkList"></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px;flex-wrap:wrap">' +
      '<button class="bt" id="rkStart">▶️ شروع اسکن بک‌آپ‌ها</button>' +
      '<button class="bt" id="rkApply" disabled style="background:#059669">تایید و بازگردانی</button>' +
      '<button class="bt bt-o" onclick="document.getElementById(\'rkDlg\').remove()">✕ بستن</button>' +
      '</div></div></div>';
    while (wrap.firstChild) host.appendChild(wrap.firstChild);
    document.getElementById('rkStart').onclick = startScan;
    document.getElementById('rkApply').onclick = applyNow;
  }
  window.ptfOpenRecordRecovery = open;
})();
