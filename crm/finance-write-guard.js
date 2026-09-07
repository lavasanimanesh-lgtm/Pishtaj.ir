/* =====================================================================
   PTF CRM — finance-write-guard.js — v34.4.54
   فاز ۲ طرح بهینه‌سازی ورک‌فلو: یک دروازهٔ نوشتن مالی + وضعیت لینک فاکتور خرید.
   ماژول‌ها باید قبل از edit/delete/void/add از ptfFinanceAssertWritable عبور کنند.
   ===================================================================== */
(function () {
  'use strict';

  function fiscalYearOf(v) {
    if (typeof window.ptfFiscalYearOf === 'function') return window.ptfFiscalYearOf(v);
    var t = String(v || '').replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); });
    var m = t.match(/(13|14)\d{2}/);
    return m ? m[0] : '';
  }

  /* dateOrIso: تاریخ سند یا سال مثل 1404 */
  window.ptfFinanceAssertWritable = function (dateOrIso, opts) {
    opts = opts || {};
    var year = fiscalYearOf(dateOrIso) || String(dateOrIso || '').replace(/\D/g, '').slice(0, 4);
    if (year && typeof window.ptfFiscalYearLocked === 'function' && window.ptfFiscalYearLocked(year)) {
      var msg = '🔒 سال مالی ' + year + ' قفل است؛ ' + (opts.action || 'تغییر سند اصلی') + ' مجاز نیست. از سند اصلاحی استفاده کنید.';
      if (opts.silent) return { ok: false, why: 'fiscal-lock', year: year, error: msg };
      alert(msg);
      return { ok: false, why: 'fiscal-lock', year: year, error: msg };
    }
    if (opts.requireCode) {
      var cd = String(opts.requireCode);
      if (/^TMP-/.test(cd)) {
        var e2 = '⛔ شماره رسمی سند از سرور نیامده است. اتصال را برقرار کنید و دوباره تلاش کنید.';
        if (!opts.silent) alert(e2);
        return { ok: false, why: 'tmp-code', error: e2 };
      }
    }
    if (opts.companyCheque && typeof window.ptfCanCreateCompanyCheque === 'function' && !window.ptfCanCreateCompanyCheque()) {
      var e3 = '⛔ فقط رئیس هیئت‌مدیره، مدیرعامل و مدیر بازرگانی می‌توانند چک شرکتی ثبت کنند.';
      if (!opts.silent) alert(e3);
      return { ok: false, why: 'cheque-role', error: e3 };
    }
    return { ok: true };
  };

  window.ptfInvoiceLinkStatus = function (inv) {
    inv = inv || {};
    var cds = inv.legacyPayableCds || [];
    var invoiceIrr = +inv.amountIrr || +inv.amount || 0;
    if (!cds.length) {
      return { code: 'unlinked', label: 'بدون لینک تعهد', invoiceIrr: invoiceIrr, linkedIrr: 0, diff: invoiceIrr, zeroPrice: [] };
    }
    var pays = [];
    try { pays = (typeof getData === 'function' ? getData('ptf_crm_payables') : []) || []; } catch (e) { pays = []; }
    var linked = pays.filter(function (p) { return p && cds.indexOf(p.cd) > -1; });
    var linkedIrr = linked.reduce(function (s, p) { return s + (+p.amount || 0); }, 0);
    var zeroPrice = linked.filter(function (p) { return !(+p.amount); }).map(function (p) {
      return { cd: p.cd, item: p.item || p.desc || p.inqNo || p.cd };
    });
    var diff = invoiceIrr - linkedIrr;
    var mismatch = invoiceIrr && Math.abs(diff) > 1;
    var sig = Math.round(invoiceIrr) + ':' + Math.round(linkedIrr) + ':' + cds.slice().sort().join(',');
    var acked = !!(inv.linkMismatchAck && inv.linkMismatchAckSig === sig);
    if (mismatch && acked) {
      return { code: 'amount-acked', label: 'لینک‌شده — اختلاف مبلغ تأییدشده', invoiceIrr: invoiceIrr, linkedIrr: linkedIrr, diff: diff, zeroPrice: zeroPrice };
    }
    if (mismatch) {
      return { code: 'amount-mismatch', label: 'لینک‌شده — اختلاف مبلغ (نه نبود لینک)', invoiceIrr: invoiceIrr, linkedIrr: linkedIrr, diff: diff, zeroPrice: zeroPrice };
    }
    return { code: 'matched', label: 'لینک کامل و منطبق', invoiceIrr: invoiceIrr, linkedIrr: linkedIrr, diff: 0, zeroPrice: zeroPrice };
  };

  window.ptfInvoiceLinkStatusHtml = function (inv) {
    var st = window.ptfInvoiceLinkStatus(inv);
    var color = st.code === 'matched' ? '#059669' : st.code === 'amount-acked' ? '#64748b' : st.code === 'unlinked' ? '#92400e' : '#dc2626';
    var extra = '';
    if (st.zeroPrice && st.zeroPrice.length) {
      extra = '<br><small>اقلام بدون قیمت خرید: ' + st.zeroPrice.map(function (z) { return z.item; }).slice(0, 4).join('، ') + (st.zeroPrice.length > 4 ? '…' : '') + '</small>';
    }
    if (st.code === 'amount-mismatch' || st.code === 'amount-acked') {
      extra = '<br><small>فاکتور ' + Math.round(st.invoiceIrr).toLocaleString('fa-IR') + ' — تعهدها ' + Math.round(st.linkedIrr).toLocaleString('fa-IR') + ' ریال</small>' + extra;
    }
    return '<span style="color:' + color + ';font-weight:800">' + st.label + '</span>' + extra;
  };

  /* P3: یک مسیر لینک/حذف هزینه روی پرونده — OPEX و تنخواه دوقلو نمانند. */
  window.ptfDealCostTomb = function (deal, cd) {
    /* v34.29.8 (COST-EVENT-TOMB): حذف هزینهٔ پرونده باید در merge بین‌دستگاهی
       بماند — union ساده حذف را برمی‌گرداند. tombstone نقشهٔ {cd: iso} روی خود
       رکورد پرونده سفر می‌کند و ptfSmartMerge موارد tombstoneشده را از costEvents
       بیرون می‌اندازد. */
    try {
      if (!deal || !cd) return;
      deal._costTomb = deal._costTomb || {};
      deal._costTomb[String(cd)] = new Date().toISOString();
    } catch (eT) {}
  };

  /* ═══ v34.38.2 (COST-VISIBLE + COST-SUM): منبع واحد «خواندن/جمع هزینهٔ قابل‌نمایش پرونده» ═══
     گزارش کارفرما: «جمع کل هزینه‌ها درست نیست» و «هزینهٔ حذف‌شده با رفرش برمی‌گردد».
     ریشهٔ مشترک: هر نما هزینه‌ها را جداگانه و مستقیم از costEvents می‌خواند، در حالی که
     _costTomb (حذف ماندگار v34.29.8) فقط در merge بین‌دستگاهی اعمال می‌شد و render/پروجکشن/
     overwrite آن را نمی‌دیدند. از این پس هر نمایش/جمع هزینهٔ پرونده باید از این توابع عبور
     کند تا ① هزینهٔ tombstoneشده هرگز دیده/شمرده نشود و ② همهٔ نماها یک عدد ببینند. */
  window.ptfDealVisibleCosts = function (deal) {
    /* costEventsِ زندهٔ پرونده = فیلتر _costTomb + ددوب بر cd (هم‌سنخ merge در sync.js). */
    var evs = (deal && deal.costEvents) || [];
    if (!evs.length) return [];
    var tomb = (deal && deal._costTomb) || {};
    var seen = {}, out = [];
    evs.forEach(function (e) {
      if (!e || typeof e !== 'object') return;
      var cd = String(e.cd || '');
      if (!cd) { out.push(e); return; } /* رویداد بدون cd (قدیمی) → دست‌نخورده */
      if (tomb[cd]) return;              /* حذف ماندگار */
      if (seen[cd]) return;              /* تکرار هم‌کد */
      seen[cd] = 1;
      out.push(e);
    });
    return out;
  };
  window.ptfDealCostSumIRR = function (deal, opts) {
    /* جمعِ قطعیِ «هزینه‌های مستقیم» که با ردیف‌های فهرستِ کشوی پرونده یکسان است:
       costEvents زنده (مبلغ زندهٔ تنخواه برای رویدادهای لینک‌شده) + پروجکشن زندهٔ تنخواه
       (dealRef) با رعایت _costTomb؛ advance/پیش‌پرداخت شمرده نمی‌شود. */
    opts = opts || {};
    var skipAdv = opts.skipAdvance !== false;
    function isAdv(x) { return !!(x && (x.fromAdvance || x.cat === 'advance' || /پیش.?پرداخت|prepay|advance/.test(String(x.desc || x.cat || '')))); }
    var dealCd = String((deal && deal.cd) || '');
    var tomb = (deal && deal._costTomb) || {};
    var petty = [];
    try { petty = (typeof getData === 'function' ? (getData('ptf_crm_petty') || []) : []); } catch (e) { petty = []; }
    var pettyByCd = {};
    petty.forEach(function (p) { if (p && p.cd) pettyByCd[p.cd] = p; });
    var linked = {}, s = 0;
    window.ptfDealVisibleCosts(deal).forEach(function (x) {
      if (skipAdv && isAdv(x)) return;
      var pettyCd = String(x.pettyCd || (x.fromPetty ? x.cd : '') || '');
      var live = pettyCd ? (pettyByCd[pettyCd] || null) : null;
      if (pettyCd) linked[pettyCd] = 1;
      s += +(live ? live.amt : x.amt) || 0;
    });
    if (dealCd) {
      petty.forEach(function (p) {
        if (!p || p.st === 'void' || String(p.dealRef || '') !== dealCd) return;
        var cd = String(p.cd || '');
        if (!cd || linked[cd]) return;
        if (tomb[cd]) return; /* حذف ماندگار — پروجکشن بازسازی‌اش نکند */
        s += +(p.amt || 0);
      });
    }
    return s;
  };
  window.ptfCostListSumIRR = function (list, deal, opts) {
    /* v34.38.2 (COST-SUM): جمع یک لیست هزینه (costEvents/postArchiveCosts) با
       ددوب cd + احترام به _costTomb + حذف advance/پیش‌پرداخت. مبنای سود پروژه —
       همپوشانی اسنپ‌شات deal/project دیگر دوباره‌شماری نمی‌شود. */
    opts = opts || {};
    var skipAdv = opts.skipAdvance !== false;
    function isAdv(x) { return !!(x && (x.fromAdvance || x.cat === 'advance' || /پیش.?پرداخت|prepay|advance/.test(String(x.desc || x.cat || '')))); }
    var tomb = (deal && deal._costTomb) || {};
    var seen = {}, s = 0;
    (list || []).forEach(function (x) {
      if (!x) return;
      if (skipAdv && isAdv(x)) return;
      var cd = String(x.cd || '');
      if (cd) {
        if (tomb[cd] || seen[cd]) return;
        seen[cd] = 1;
      }
      s += (+x.amt || 0);
    });
    return s;
  };
  window.ptfDealsApplyCostTombstones = function (localStr, serverStr) {
    /* v34.38.2: مسیر «جایگزینی مستقیم» pull برای ptf_crm_deals نباید tombstone هزینهٔ
       حذف‌شدهٔ محلی را رونویسی کند. نقشهٔ _costTomb محلی/سروری اجتماع شده و روی costEvents
       نسخهٔ سرور اعمال می‌شود — هیچ فیلد دیگری دست نمی‌خورد؛ خطا = برگرداندن نسخهٔ سرور. */
    try {
      var loc = JSON.parse(localStr || '[]');
      var srv = JSON.parse(serverStr || '[]');
      if (!Array.isArray(loc) || !Array.isArray(srv) || !srv.length) return serverStr;
      var localTombByCd = {};
      loc.forEach(function (r) { if (r && r.cd && r._costTomb) localTombByCd[String(r.cd)] = r._costTomb; });
      var changed = false;
      srv = srv.map(function (r) {
        if (!r || typeof r !== 'object') return r;
        var cd = String(r.cd || '');
        var union = {};
        [localTombByCd[cd], r._costTomb].forEach(function (m) {
          if (!m) return;
          Object.keys(m).forEach(function (k) { var v = String(m[k] || ''); if (v && (!union[k] || v > union[k])) union[k] = v; });
        });
        if (!Object.keys(union).length) return r;
        var kept = [], seen = {}, removed = 0;
        (Array.isArray(r.costEvents) ? r.costEvents : []).forEach(function (e) {
          if (!e || typeof e !== 'object') { kept.push(e); return; }
          var c = String(e.cd || '');
          if (!c) { kept.push(e); return; }
          if (union[c] || seen[c]) { removed++; return; }
          seen[c] = 1;
          kept.push(e);
        });
        var unionHasNew = Object.keys(union).some(function (k) { return !(r._costTomb && String(r._costTomb[k] || '') === String(union[k] || '')); });
        if (removed || unionHasNew) { r.costEvents = kept; r._costTomb = union; changed = true; }
        return r;
      });
      return changed ? JSON.stringify(srv) : serverStr;
    } catch (e) { return serverStr; }
  };
  window.ptfProjectsApplyCostTombstones = function (localStr, serverStr) {
    /* v34.38.3 (PRJ-COST-RESURRECTION): مسیر «جایگزینی مستقیم» pull برای ptf_crm_projects
       نباید tombstone هزینهٔ حذف‌شدهٔ بایگانی را رونویسی کند — اجتماع _costTomb محلی/سروری
       روی costEvents و postArchiveCosts نسخهٔ سرور اعمال می‌شود؛ هیچ فیلد دیگری دست نمی‌خورد. */
    try {
      var loc = JSON.parse(localStr || '[]');
      var srv = JSON.parse(serverStr || '[]');
      if (!Array.isArray(loc) || !Array.isArray(srv) || !srv.length) return serverStr;
      var localTombByCd = {};
      loc.forEach(function (r) { if (r && r.cd && r._costTomb) localTombByCd[String(r.cd)] = r._costTomb; });
      var changed = false;
      srv = srv.map(function (r) {
        if (!r || typeof r !== 'object') return r;
        var cd = String(r.cd || '');
        var union = {};
        [localTombByCd[cd], r._costTomb].forEach(function (m) {
          if (!m) return;
          Object.keys(m).forEach(function (k) { var v = String(m[k] || ''); if (v && (!union[k] || v > union[k])) union[k] = v; });
        });
        if (!Object.keys(union).length) return r;
        var removed = 0;
        function filterList(list) {
          var kept = [], seen = {};
          (Array.isArray(list) ? list : []).forEach(function (e) {
            if (!e || typeof e !== 'object') { kept.push(e); return; }
            var c = String(e.cd || '');
            if (!c) { kept.push(e); return; }
            if (union[c] || seen[c]) { removed++; return; }
            seen[c] = 1;
            kept.push(e);
          });
          return kept;
        }
        var ce = filterList(r.costEvents);
        var pac = filterList(r.postArchiveCosts);
        var unionHasNew = Object.keys(union).some(function (k) { return !(r._costTomb && String(r._costTomb[k] || '') === String(union[k] || '')); });
        if (removed || unionHasNew) {
          r.costEvents = ce;
          r.postArchiveCosts = pac;
          r._costTomb = union;
          changed = true;
        }
        return r;
      });
      return changed ? JSON.stringify(srv) : serverStr;
    } catch (e) { return serverStr; }
  };
  window.ptfDealCostMatch = function (ev, rec, source) {
    if (!ev || !rec) return false;
    if (source === 'opex') {
      if (rec._opexRowId && ev.opexRowId === rec._opexRowId) return true;
      return !!(ev.fromOpex && !ev.opexRowId && ev.cd === rec.cd);
    }
    if (source === 'petty') {
      return ev.pettyCd === rec.cd || !!(ev.fromPetty && ev.cd === rec.cd);
    }
    return ev.cd === rec.cd;
  };

  window.ptfDealCostBuild = function (rec, source) {
    rec = rec || {};
    var when = (typeof faDateTime === 'function' ? faDateTime() : '');
    if (source === 'opex') {
      return {
        cd: rec.cd,
        opexRowId: rec._opexRowId,
        amt: +rec.amt || 0,
        cat: 'other',
        desc: '[هزینه جاری] ' + (rec.desc || rec.cat || ''),
        by: rec.editedBy || rec.by || '',
        t: when,
        files: (rec.files || []).slice(),
        fromOpex: true
      };
    }
    return {
      cd: rec.cd,
      amt: +rec.amt || 0,
      cat: 'fromPetty',
      desc: '[تنخواه] ' + (rec.desc || rec.cat || ''),
      by: rec.by || '',
      t: rec.t || when,
      files: (typeof window.ptfPettyRecordFiles === 'function' ? window.ptfPettyRecordFiles(rec) : (rec.files || [])).slice(),
      fromPetty: true,
      pettyCd: rec.cd
    };
  };

  window.ptfDealCostSync = function (opts) {
    opts = opts || {};
    var rec = opts.rec;
    if (!rec) return { ok: false, why: 'no-rec' };
    var source = opts.source || 'petty';
    var nextDeal = opts.dealCd || '';
    var prevDeal = opts.prevDealCd != null ? opts.prevDealCd : '';
    var who = opts.by || '';
    var ds;
    try { ds = getData('ptf_crm_deals') || []; } catch (e) { return { ok: false, why: 'deals' }; }
    var dirty = false;
    function findEv(deal) {
      var evs = ((deal && deal.costEvents) || []);
      /* P3 — اصلاحیه 2026-08-13 (OPEX-ROW-CLAIM-REGRESSION، منشأ tester340):
         برای source='opex' تطبیق باید دقیقاً به امنیِ opexDealEvent باشد:
         شناسهٔ ردیف مقدم است؛ رویداد لگاسی فقط وقتی ادعا می‌شود که بی‌ابهام
         باشد (یک رویداد هم‌کد، یا در حالت چندتایی فقط تطبیقِ مبلغِ یکتا).
         نسخهٔ قبلی اولین رویداد هم‌کد لگاسی را می‌گرفت → در کدهای تکراری
         رویدادِ خواهر (متعلق به ردیف دیگر) ربوده و بازنویسی می‌شد؛ مبلغ
         پرونده و سود پروژه به‌صورت بی‌صدا خراب می‌شد. */
      if (source === 'opex') {
        var exact = evs.filter(function (x) { return x && rec._opexRowId && x.opexRowId === rec._opexRowId; });
        if (exact.length === 1) return exact[0];
        var legacy = evs.filter(function (x) { return x && x.fromOpex && !x.opexRowId && x.cd === rec.cd; });
        if (legacy.length === 1) return legacy[0];
        if (legacy.length > 1) {
          var amtMatch = legacy.filter(function (x) { return (+x.amt || 0) === (+rec.amt || 0); });
          if (amtMatch.length === 1) return amtMatch[0];
        }
        return null; /* مبهم — هیچ رویدادی ادعا/دستکاری نمی‌شود؛ رویداد جدید ساخته می‌شود */
      }
      return evs.filter(function (x) {
        return window.ptfDealCostMatch(x, rec, source);
      })[0] || null;
    }
    if (prevDeal && prevDeal !== nextDeal) {
      var od = ds.filter(function (x) { return x.cd === prevDeal; })[0];
      if (od) {
        var ev = findEv(od);
        if (ev) {
          od.costEvents = (od.costEvents || []).filter(function (x) { return x !== ev; });
          window.ptfDealCostTomb(od, ev.cd); /* v34.29.8: حذف لینک = tombstone — union در merge دیگر آن را برنمی‌گرداند */
          od.timeline = od.timeline || [];
          od.timeline.push({ t: (typeof faDateTime === 'function' ? faDateTime() : ''), by: who, tx: opts.removeTx || '🗑 حذف لینک هزینه از پرونده' });
          dirty = true;
        }
      }
    }
    if (nextDeal) {
      var nd = ds.filter(function (x) { return x.cd === nextDeal; })[0];
      if (nd) {
        nd.costEvents = nd.costEvents || [];
        var ev2 = findEv(nd);
        var built = window.ptfDealCostBuild(rec, source);
        if (ev2) {
          ev2.amt = built.amt;
          ev2.desc = built.desc;
          ev2.files = built.files;
          if (built.opexRowId) ev2.opexRowId = built.opexRowId;
          if (built.pettyCd) ev2.pettyCd = built.pettyCd;
        } else {
          nd.costEvents.unshift(built);
          nd.timeline = nd.timeline || [];
          nd.timeline.push({ t: built.t, by: who || built.by, tx: opts.addTx || '➕ لینک هزینه به پرونده' });
        }
        dirty = true;
      }
    }
    if (dirty) if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_deals', ds, { reason: 'w2' }); else setData('ptf_crm_deals', ds);
    return { ok: true, dirty: dirty };
  };

  /* P4: ژورنال append-only اسناد مالی — تعارض = اتحاد رویداد، نه جایگزینی رکورد. */
  var FIN_EV_KEY = 'ptf_crm_fin_events';
  var FIN_WATCH = {
    'ptf_crm_invoices': 'sale-invoice',
    'ptf_crm_cheques_issued': 'cheque-issued',
    'ptf_crm_cheques_received': 'cheque-received'
  };
  window.PTF_FIN_EVENTS_KEY = FIN_EV_KEY;

  function finWho() {
    try { return (typeof curSession === 'function' ? (curSession().name || curSession().user) : '') || ''; } catch (e) { return ''; }
  }
  function finIsVoid(r) {
    if (!r) return false;
    var st = String(r.status || r.st || '');
    return st === 'void' || st === 'voided_transfer' || r.void === true;
  }
  function finSnap(r) {
    if (!r || typeof r !== 'object') return null;
    return {
      cd: r.cd, no: r.no, amount: r.amount || r.amountIrr || r.amt,
      status: r.status || r.st || '', supplierCd: r.supplierCd || '',
      dateISO: r.dateISO || r.dueISO || r.invDate || ''
    };
  }
  function finReadEvents() {
    try {
      var v = typeof getData === 'function' ? getData(FIN_EV_KEY) : JSON.parse(localStorage.getItem(FIN_EV_KEY) || '[]');
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }
  window.ptfFinanceEventAppend = function (ev) {
    if (!ev || !ev.kind || !ev.recCd) return { ok: false };
    ev.id = ev.id || ('FEV-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8));
    ev.t = ev.t || (typeof faDateTime === 'function' ? faDateTime() : new Date().toISOString());
    ev.iso = ev.iso || new Date().toISOString();
    ev.by = ev.by || finWho();
    var list = finReadEvents();
    if (list.some(function (x) { return x && x.id === ev.id; })) return { ok: true, dup: true };
    list.unshift(ev);
    if (list.length > 4000) list = list.slice(0, 4000);
    if (typeof setData === 'function') setData(FIN_EV_KEY, list);
    else try { localStorage.setItem(FIN_EV_KEY, JSON.stringify(list)); } catch (eW) {}
    return { ok: true, id: ev.id };
  };
  window.ptfFinanceUnionEvents = function (a, b) {
    var by = {};
    (Array.isArray(a) ? a : []).concat(Array.isArray(b) ? b : []).forEach(function (e) {
      if (e && e.id && !by[e.id]) by[e.id] = e;
    });
    return Object.keys(by).map(function (k) { return by[k]; })
      .sort(function (x, y) { return String(y.iso || y.t || '').localeCompare(String(x.iso || x.t || '')); });
  };
  function finIndex(arr) {
    var m = {};
    (arr || []).forEach(function (r, i) { if (r && r.cd) m[r.cd] = i; });
    return m;
  }
  window.ptfFinanceReplayEvents = function (key, recs, events) {
    if (!Array.isArray(recs)) return recs;
    var out = recs.slice();
    var idx = finIndex(out);
    (events || []).filter(function (e) { return e && e.key === key; }).forEach(function (e) {
      var i = idx[e.recCd];
      if (e.kind === 'create' && i == null && e.snap && e.snap.cd) {
        out.push(Object.assign({ fromJournal: true }, e.snap));
        idx[e.recCd] = out.length - 1;
      } else if (e.kind === 'void' && i != null && !finIsVoid(out[i])) {
        out[i].status = out[i].status != null ? 'void' : out[i].status;
        out[i].st = out[i].st != null ? 'void' : out[i].st;
        out[i].void = true;
        out[i].voidFromJournal = e.iso || e.t;
      }
    });
    return out;
  };
  window.ptfFinanceReplaySupplier = function (obj, events) {
    obj = obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : { schema: 1, invoices: [], payments: [] };
    obj.invoices = window.ptfFinanceReplayEvents('ptf_crm_supplier_finance:invoices', obj.invoices || [], events);
    obj.payments = window.ptfFinanceReplayEvents('ptf_crm_supplier_finance:payments', obj.payments || [], events);
    return obj;
  };
  function finJournalRows(key, beforeArr, afterArr, recType) {
    var b = finIndex(beforeArr), a = afterArr || [];
    a.forEach(function (r) {
      if (!r || !r.cd) return;
      if (b[r.cd] == null) {
        window.ptfFinanceEventAppend({ kind: 'create', key: key, recType: recType, recCd: r.cd, snap: finSnap(r) });
      } else {
        var old = beforeArr[b[r.cd]];
        if (!finIsVoid(old) && finIsVoid(r)) {
          window.ptfFinanceEventAppend({ kind: 'void', key: key, recType: recType, recCd: r.cd, snap: finSnap(r) });
        }
      }
    });
  }
  window.ptfFinanceJournalDiff = function (key, before, after) {
    if (window._ptfFinJournalMute) return;
    if (FIN_WATCH[key]) {
      finJournalRows(key, Array.isArray(before) ? before : [], Array.isArray(after) ? after : [], FIN_WATCH[key]);
      return;
    }
    if (key !== 'ptf_crm_supplier_finance') return;
    var b = before && typeof before === 'object' ? before : {};
    var a = after && typeof after === 'object' ? after : {};
    finJournalRows('ptf_crm_supplier_finance:invoices', b.invoices || [], a.invoices || [], 'supplier-invoice');
    finJournalRows('ptf_crm_supplier_finance:payments', b.payments || [], a.payments || [], 'supplier-payment');
  };

  var _finSet = window.setData;
  if (typeof _finSet === 'function') {
    window.setData = function (k, d) {
      var before = null;
      if (FIN_WATCH[k] || k === 'ptf_crm_supplier_finance') {
        try { before = typeof getData === 'function' ? getData(k) : null; } catch (eB) {}
      }
      var r = _finSet(k, d);
      try { window.ptfFinanceJournalDiff(k, before, d); } catch (eJ) {}
      return r;
    };
  }

  window.ptfFinanceVoidWins = function (a, b) {
    if (finIsVoid(a) && !finIsVoid(b)) return a;
    if (finIsVoid(b) && !finIsVoid(a)) return b;
    return null;
  };
})();
