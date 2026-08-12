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
      files: (rec.files || []).slice(),
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
      return ((deal && deal.costEvents) || []).filter(function (x) {
        return window.ptfDealCostMatch(x, rec, source);
      })[0] || null;
    }
    if (prevDeal && prevDeal !== nextDeal) {
      var od = ds.filter(function (x) { return x.cd === prevDeal; })[0];
      if (od) {
        var ev = findEv(od);
        if (ev) {
          od.costEvents = (od.costEvents || []).filter(function (x) { return x !== ev; });
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
    if (dirty) setData('ptf_crm_deals', ds);
    return { ok: true, dirty: dirty };
  };
})();
