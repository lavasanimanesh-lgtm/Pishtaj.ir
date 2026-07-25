/* =====================================================================
   PTF CRM — draftx.js — v31.7.52 — US-DRAFT-EVERYWHERE + STORAGE-IDB-AI-DRAFT-001
   پیش‌نویس سراسری فرم‌ها (درخواست کارفرما):
   «با بستن پنجره کل نوشته‌ها از دست می‌رود — امکان ثبت پیش‌نویس همیشه باشد»

   طراحی مصوب پنل متخصصان (EXPERT-PANEL-DRAFTS-v31.7.23.md) — اصول بی‌خطری:
   ① صفر تغییر در فرم‌های موجود: فقط event-delegation روی document (بدون دست‌زدن به کد ماژول‌ها)
   ② بدون setInterval — رویدادمحور (input/click) + MutationObserver (الگوی مصوب theme/mobilenav)
   ③ کلید مستقل ptf_draft_forms — عمداً خارج از SYNC_KEYS (هیچ اثری روی sync/backup/merge)؛ نسخه کامل در IndexedDB و summary سبک در localStorage
   ④ بازیابی همیشه با کلیک صریح کاربر — هیچ auto-restore ای فرم را غافلگیر نمی‌کند
   ⑤ فیلد رمز/فایل هرگز ذخیره نمی‌شود؛ سقف ۱۵ پیش‌نویس + انقضای ۷ روزه
   ⑥ شناسه فرم = امضای فیلدهای id-دار همان مودال — بدون نیاز به ثبت‌نام دستی فرم‌ها
   ===================================================================== */
(function () {
  'use strict';
  var KEY = 'ptf_draft_forms';
  var MAX_DRAFTS = 15;
  var TTL = 7 * 864e5; // ۷ روز
  var MIN_CONTENT = 12; // حداقل مجموع طول متن تا پیش‌نویس «ارزش ذخیره» داشته باشد

  var IDB_KEY = KEY + ':idb-full';
  var LOCAL_DRAFTS = 8;
  function loadAll() { try { var d = JSON.parse(localStorage.getItem(KEY) || '{}'); return (d && typeof d === 'object') ? d : {}; } catch (e) { return {}; } }
  function localSummary(d) {
    var keys = Object.keys(d || {}).sort(function (a, b) { return ((d[b] || {}).ts || 0) - ((d[a] || {}).ts || 0); });
    var out = {};
    keys.slice(0, LOCAL_DRAFTS).forEach(function (k) { out[k] = d[k]; });
    return out;
  }
  function saveAll(d) {
    try {
      var fullNow = prune(d || {});
      if (typeof ptfStorageIdbGet === 'function' && typeof ptfStorageIdbSet === 'function') {
        ptfStorageIdbGet(IDB_KEY, function (rec) {
          try {
            var base = {};
            if (rec && rec.value) { var parsed = JSON.parse(rec.value); if (parsed && typeof parsed === 'object') base = parsed; }
            Object.keys(fullNow).forEach(function (k) { base[k] = fullNow[k]; });
            ptfStorageIdbSet(IDB_KEY, JSON.stringify(prune(base)));
          } catch (eM) { try { ptfStorageIdbSet(IDB_KEY, JSON.stringify(fullNow)); } catch (eS) {} }
        });
      } else if (typeof ptfStorageIdbSet === 'function') ptfStorageIdbSet(IDB_KEY, JSON.stringify(fullNow));
      localStorage.setItem(KEY, JSON.stringify(localSummary(fullNow)));
    } catch (e) {}
  }
  function dropDraft(sig) {
    try { var all = loadAll(); if (all[sig]) { delete all[sig]; localStorage.setItem(KEY, JSON.stringify(all)); } } catch (e) {}
    try {
      if (typeof ptfStorageIdbGet === 'function' && typeof ptfStorageIdbSet === 'function') {
        ptfStorageIdbGet(IDB_KEY, function (rec) {
          try { var full = rec && rec.value ? JSON.parse(rec.value) : {}; if (full && full[sig]) { delete full[sig]; ptfStorageIdbSet(IDB_KEY, JSON.stringify(full)); } } catch (e2) {}
        });
      }
    } catch (e3) {}
  }
  function loadDraftAsync(sig, cb) {
    var local = loadAll();
    if (local[sig]) { cb(local[sig]); return; }
    try {
      if (typeof ptfStorageIdbGet === 'function') {
        ptfStorageIdbGet(IDB_KEY, function (rec) {
          var d = null;
          try { var full = rec && rec.value ? JSON.parse(rec.value) : {}; d = full && full[sig] ? full[sig] : null; } catch (e) {}
          cb(d);
        });
        return;
      }
    } catch (e2) {}
    cb(null);
  }

  function prune(d) {
    var now = Date.now();
    var keys = Object.keys(d).filter(function (k) { return d[k] && (now - (d[k].ts || 0)) < TTL; });
    keys.sort(function (a, b) { return (d[b].ts || 0) - (d[a].ts || 0); });
    var out = {};
    keys.slice(0, MAX_DRAFTS).forEach(function (k) { out[k] = d[k]; });
    return out;
  }

  /* ---------- فیلدهای قابل‌ذخیره یک مودال ---------- */
  function fieldsOf(modal) {
    var els = modal.querySelectorAll('input[id],textarea[id],select[id]');
    var out = [];
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.type === 'password' || el.type === 'file' || el.type === 'hidden') continue;
      out.push(el);
    }
    return out;
  }
  function sigOf(modal) {
    var ids = fieldsOf(modal).map(function (el) { return el.id; }).sort();
    if (ids.length < 2) return null; // دیالوگ‌های ریز (confirm/تک‌فیلد) پیش‌نویس نمی‌خواهند
    return 'f:' + ids.join(',');
  }
  function titleOf(modal) {
    var h = modal.querySelector('h3,h4');
    return h ? String(h.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60) : 'فرم';
  }
  function collect(modal) {
    var data = { v: {}, c: {} }, content = 0;
    fieldsOf(modal).forEach(function (el) {
      if (el.type === 'checkbox' || el.type === 'radio') { data.c[el.id] = !!el.checked; return; }
      var val = String(el.value || '');
      data.v[el.id] = val;
      if (el.tagName !== 'SELECT') content += val.trim().length;
    });
    data.len = content;
    /* هوک اختیاری ماژول‌ها (مثل تصاویر نامه) — بدون وابستگی اجباری */
    try {
      Object.keys(window.ptfDraftHooks || {}).forEach(function (hid) {
        var hk = window.ptfDraftHooks[hid];
        if (hk && typeof hk.match === 'function' && hk.match(modal) && typeof hk.collect === 'function') {
          data.x = data.x || {}; data.x[hid] = hk.collect();
        }
      });
    } catch (eH) {}
    return data;
  }

  /* ---------- ذخیره (debounced روی input/change) ---------- */
  var t = null;
  function scheduleSave(modal) {
    clearTimeout(t);
    t = setTimeout(function () {
      try {
        if (!modal || !document.body.contains(modal)) return;
        var sig = sigOf(modal);
        if (!sig) return;
        var data = collect(modal);
        var all = loadAll();
        if (data.len < MIN_CONTENT) { return; } /* محتوای ناچیز — ذخیره نکن (ولی پیش‌نویس قبلی را هم نگه دار) */
        all[sig] = { ts: Date.now(), title: titleOf(modal), data: data, by: (function () { try { return (curSession() || {}).user || ''; } catch (e) { return ''; } })() };
        saveAll(prune(all));
      } catch (e) {}
    }, 800);
  }

  document.addEventListener('input', function (ev) {
    try {
      var el = ev.target;
      if (!el || !el.id) return;
      var modal = el.closest ? el.closest('.md-b') : null;
      if (!modal) return;
      scheduleSave(modal);
    } catch (e) {}
  }, true);
  document.addEventListener('change', function (ev) {
    try {
      var el = ev.target;
      if (!el || !el.id) return;
      var modal = el.closest ? el.closest('.md-b') : null;
      if (modal) scheduleSave(modal);
    } catch (e) {}
  }, true);

  /* ---------- پاکسازی پس از ثبت موفق (heuristic تاییدشده پنل) ----------
     کلیک روی دکمه «ثبت/ذخیره/تایید» داخل مودال → اگر مودال ظرف ۱.۵ ثانیه بسته شد
     یعنی ذخیره موفق بوده → پیش‌نویس همان فرم پاک می‌شود (انصراف/بستن، پیش‌نویس را نگه می‌دارد). */
  document.addEventListener('click', function (ev) {
    try {
      var btn = ev.target && (ev.target.closest ? ev.target.closest('button') : null);
      if (!btn) return;
      var modal = btn.closest('.md-b');
      if (!modal) return;
      var txt = String(btn.textContent || '');
      if (!/ثبت|ذخیره|✅|تایید و/.test(txt) || /انصراف|بستن|پیش‌نمایش/.test(txt)) return;
      var sig = sigOf(modal);
      if (!sig) return;
      setTimeout(function () {
        try {
          if (!document.body.contains(modal)) { /* بسته شد = ثبت موفق */
            dropDraft(sig)
          }
        } catch (e2) {}
      }, 1500);
    } catch (e) {}
  }, true);

  /* ---------- نوار بازیابی هنگام بازشدن دوباره همان فرم ---------- */
  function offerRestore(modal) {
    try {
      if (modal.getAttribute('data-draftx')) return;
      var sig = sigOf(modal);
      if (!sig) return;
      modal.setAttribute('data-draftx', '1');
      loadDraftAsync(sig, function (d) {
        try {
          if (!d || !d.data || (d.data.len || 0) < MIN_CONTENT) return;
          /* اگر فرم همین حالا محتوا دارد (ویرایش رکورد موجود)، مزاحم نشو */
          var cur = collect(modal);
          if (cur.len >= MIN_CONTENT) return;
          var box = modal.querySelector('.md');
          if (!box) return;
          var when = new Date(d.ts);
          var bar = document.createElement('div');
      bar.id = 'draftxBar';
      bar.style.cssText = 'background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:8px 12px;margin-bottom:10px;font-size:12.5px;color:#92400e;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap';
      bar.innerHTML = '<span>📝 <b>پیش‌نویس ذخیره‌شده</b> از ' + when.toLocaleString('fa-IR') + ' موجود است.</span>' +
        '<span style="display:flex;gap:6px">' +
        '<button type="button" class="bt" style="padding:4px 12px;font-size:12px" id="draftxRestore">↩️ بازیابی</button>' +
        '<button type="button" class="bt bt-o" style="padding:4px 10px;font-size:12px;color:#dc2626" id="draftxDrop">🗑 حذف پیش‌نویس</button></span>';
      var h3 = box.querySelector('h3,h4');
      if (h3 && h3.nextSibling) box.insertBefore(bar, h3.nextSibling); else box.insertBefore(bar, box.firstChild);
      bar.querySelector('#draftxRestore').onclick = function () {
        try {
          Object.keys(d.data.v || {}).forEach(function (id) { var el = document.getElementById(id); if (el) el.value = d.data.v[id]; });
          Object.keys(d.data.c || {}).forEach(function (id) { var el = document.getElementById(id); if (el) el.checked = !!d.data.c[id]; });
          try {
            Object.keys(d.data.x || {}).forEach(function (hid) {
              var hk = (window.ptfDraftHooks || {})[hid];
              if (hk && typeof hk.restore === 'function') hk.restore(d.data.x[hid]);
            });
          } catch (eHR) {}
          bar.remove();
          if (typeof ptfToast === 'function') ptfToast('↩️ پیش‌نویس بازیابی شد', 'ok');
        } catch (eR) {}
      };
      bar.querySelector('#draftxDrop').onclick = function () {
        try { dropDraft(sig); bar.remove(); } catch (eD) {}
      };
        } catch (eAsync) {}
      });
    } catch (e) {}
  }

  var mo = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var added = muts[i].addedNodes || [];
      for (var j = 0; j < added.length; j++) {
        var n = added[j];
        if (n && n.nodeType === 1) {
          if (n.classList && n.classList.contains('md-b')) offerRestore(n);
          else if (n.querySelectorAll) { var inner = n.querySelectorAll('.md-b'); for (var k = 0; k < inner.length; k++) offerRestore(inner[k]); }
        }
      }
    }
  });
  function boot() {
    try { mo.observe(document.body, { childList: true, subtree: true }); } catch (e) {}
  }
  if (document.body) boot(); else document.addEventListener('DOMContentLoaded', boot);

  /* ---------- هوک تصاویر نامه (US-LTR-IMG) — تنها هوک اختصاصی فعلی ---------- */
  window.ptfDraftHooks = window.ptfDraftHooks || {};
  window.ptfDraftHooks.letterImgs = {
    match: function (modal) { return !!modal.querySelector('#ltImgThumbs'); },
    collect: function () { return (window._ltImgs || []).slice(0, 3); },
    restore: function (v) { window._ltImgs = Array.isArray(v) ? v : []; if (typeof ptfLtImgRender === 'function') ptfLtImgRender(); }
  };
})();
