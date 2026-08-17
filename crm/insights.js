/* =====================================================================
   PTF CRM — insights.js — v14.8 — اسپرینت «تحلیل مدیریتی» (نقشه راه مصوب)
   US-350: ویجت قیف تبدیل داشبورد (سرنخ → درخواست → پیشنهاد → برنده)
   US-349: گزارش مدیریتی Win/Loss از دلایل استاندارد باخت (closeReason)
   - داده‌ها ۱۰۰٪ از رکوردهای موجود (leads/rfqs/offers/projects) — بدون کلید جدید
   - سازگاری با رکوردهای قدیمی: باخت‌های بدون closeReason از روی متن closeWhy
     دسته‌بندی می‌شوند؛ در غیر این صورت «نامشخص (قدیمی)»
   ===================================================================== */
(function () {
  'use strict';

  /* ============ US-350: داده قیف تبدیل ============ */
  window.ptfFunnelData = function () {
    var leads = getData('ptf_crm_leads').length;
    var rfqs = getData('ptf_crm_rfqs').length;
    /* پیشنهاد = پرونده‌های متمایز که حداقل یک پیشنهاد دارند (TO/CO/TC — بدون شمارش رویژن/چندسند یک درخواست) */
    var offSet = {};
    getData('ptf_crm_offers').forEach(function (o) { offSet[o.inqNo || o.no] = 1; });
    var offers = Object.keys(offSet).length;
    /* برنده = پیشنهاد مالی won + پرونده‌های بایگانی «تسویه کامل» — متمایز بر اساس درخواست */
    var wonSet = {};
    getData('ptf_crm_offers').forEach(function (o) {
      if (o.kind !== 'TO' && (o.st === 'won' || o.st === 'approved-final')) wonSet[o.inqNo || o.no] = 1;
    });
    getData('ptf_crm_projects').forEach(function (p) {
      if (p.state === 'archived' && p.closeKind === 'settled') wonSet[p.inqNo || p.no] = 1;
    });
    var won = Object.keys(wonSet).length;
    function pct(a, b) { return b ? Math.round(a * 100 / b) : 0; }
    return {
      leads: leads, rfqs: rfqs, offers: offers, won: won,
      cLeadRfq: pct(rfqs, leads),
      cRfqOff: pct(offers, rfqs),
      cOffWon: pct(won, offers),
      cTotal: pct(won, leads || rfqs || 1)
    };
  };

  /* ---- رندر ویجت قیف (خالص — قابل تست بدون DOM) ---- */
  window.ptfFunnelHtml = function () {
    var d = ptfFunnelData();
    var maxV = Math.max(d.leads, d.rfqs, d.offers, d.won, 1);
    var ST = [
      { lb: '🎯 سرنخ', v: d.leads, cl: '#8b5cf6' },
      { lb: '📋 درخواست', v: d.rfqs, cl: '#0ea5e9', cv: d.cLeadRfq },
      { lb: '📄 پیشنهاد', v: d.offers, cl: '#f59e0b', cv: d.cRfqOff },
      { lb: '🏆 برنده', v: d.won, cl: '#10b981', cv: d.cOffWon }
    ];
    var rows = '';
    ST.forEach(function (s, i) {
      var w = Math.max(Math.round(s.v * 100 / maxV), s.v ? 8 : 3);
      rows += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:7px">' +
        '<span style="min-width:86px;font-size:12px;font-weight:800;color:var(--tx,#334155)">' + s.lb + '</span>' +
        '<div style="flex:1;background:var(--bg,#f1f5f9);border-radius:9px;height:26px;position:relative;overflow:hidden">' +
        '<div style="position:absolute;right:0;top:0;bottom:0;width:' + w + '%;background:linear-gradient(90deg,' + s.cl + ',' + s.cl + 'cc);border-radius:9px"></div>' +
        '<span style="position:absolute;inset:0;display:flex;align-items:center;padding-right:10px;font-size:12px;font-weight:900;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.35)">' + s.v.toLocaleString('fa-IR') + '</span></div>' +
        '<span style="min-width:74px;font-size:11px;color:#64748b;text-align:left" dir="ltr">' + (i === 0 ? '' : '↑ ' + (s.cv || 0) + '%') + '</span>' +
        '</div>';
    });
    return '<div id="ptfFunnelBox" style="background:var(--crd,#fff);border:1px solid var(--brd);border-radius:16px;padding:16px 18px;margin-bottom:16px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px">' +
      '<h4 style="margin:0;font-size:14px">📊 قیف تبدیل فروش (US-350)</h4>' +
      '<span style="background:#ecfdf5;border:1px solid #a7f3d0;color:#047857;border-radius:12px;padding:3px 12px;font-size:11.5px;font-weight:800">نرخ تبدیل کل سرنخ→برنده: ' + d.cTotal + '٪</span></div>' +
      rows +
      '<div style="font-size:11px;color:#94a3b8;margin-top:6px">درصد هر مرحله = نسبت به مرحله قبل | «پیشنهاد» = درخواست‌های دارای حداقل یک پیشنهاد | «برنده» = پیشنهاد مالی برنده یا پرونده تسویه‌شده در بایگانی</div>' +
      '</div>';
  };

  /* ---- تزریق قیف به داشبورد: بین کاشی‌های لانچر و آمار قدیم ---- */
  function hookDash() {
    if (window._insDashHooked) return true;
    if (typeof window.buildDashboard !== 'function') return false;
    window._insDashHooked = true;
    var _bd = window.buildDashboard;
    window.buildDashboard = function () {
      var h = _bd();
      var fn = '';
      try { fn = ptfFunnelHtml(); } catch (e) { fn = ''; }
      var i = h.indexOf('<details');
      return i > -1 ? h.slice(0, i) + fn + h.slice(i) : fn + h;
    };
    return true;
  }
  var hdTries = 0;
  var hdT = setInterval(function () { hdTries++; if (hookDash() || hdTries > 50) clearInterval(hdT); }, 300);
  hookDash();

  /* ============ US-349: گزارش Win/Loss از بایگانی ============ */
  window.ptfWinLossStats = function () {
    var arcs = getData('ptf_crm_projects').filter(function (p) {
      return p.state === 'archived' && (p.closeKind === 'settled' || p.closeKind === 'lost');
    });
    var wins = arcs.filter(function (p) { return p.closeKind === 'settled'; });
    var losses = arcs.filter(function (p) { return p.closeKind === 'lost'; });
    /* دسته‌بندی دلیل باخت: closeReason استاندارد (v14.8) یا استنتاج از متن قدیمی closeWhy */
    var REASONS = (window.SF_LOST_REASONS || [
      { id: 'price', lb: 'قیمت' }, { id: 'delivery', lb: 'زمان تحویل' }, { id: 'brand', lb: 'برند' },
      { id: 'cancel', lb: 'انصراف مشتری' }, { id: 'other', lb: 'سایر' }
    ]);
    function classify(p) {
      if (p.closeReason) return p.closeReason;
      var w = String(p.closeWhy || '');
      for (var i = 0; i < REASONS.length; i++) if (w.indexOf(REASONS[i].lb) > -1) return REASONS[i].id;
      if (/قیمت|گران/.test(w)) return 'price';
      if (/تحویل|زمان/.test(w)) return 'delivery';
      if (/برند/.test(w)) return 'brand';
      if (/انصراف|منصرف|لغو/.test(w)) return 'cancel';
      return w ? 'other' : 'legacy';
    }
    var byReason = {};
    losses.forEach(function (p) {
      var k = classify(p);
      byReason[k] = byReason[k] || { n: 0, val: 0, items: [] };
      byReason[k].n++;
      byReason[k].val += +((p.stats || {}).totalCO) || 0;
      byReason[k].items.push(p.inqNo || p.no);
    });
    var total = wins.length + losses.length;
    /* AN-02 (v34.7.24): هم‌ترازی تعریف با لایهٔ سنجهٔ واحد.
       این گزارش «پرونده‌های مختومهٔ بایگانی» را می‌شمارد؛ پس مخرجش ذاتاً «تعیین‌تکلیف‌شده‌ها»
       است. تا امروز همین عدد بدون هیچ برچسبی «نرخ برد» نامیده می‌شد و کنار نرخ برد تحلیلگر
       (که از کل پیشنهادهای صادرشده حساب می‌شود) دو عدد متفاوت با یک نام دیده می‌شد.
       اکنون: نام صریح + حجم نمونه + همان قاعدهٔ «زیر ۳ نمونه درصد نده» لایهٔ مشترک. */
    var _mx = (window.PTF || {}).metrics;
    var MIN_SAMPLE = 3;
    var _rate = total ? Math.round(wins.length * 1000 / total) / 10 : null;
    return {
      wins: wins.length, losses: losses.length, total: total,
      sample: total, reliable: total >= MIN_SAMPLE,
      winRateBasis: 'decided-archived-cases',
      winRateLabel: 'نرخ برد پرونده‌های مختومه',
      winRateDecided: total >= MIN_SAMPLE ? _rate : null,
      /* سازگاری عقب‌رو: مصرف‌کنندگان قدیمی همان عدد صحیح قبلی را می‌گیرند */
      winRate: total ? Math.round(wins.length * 100 / total) : 0,
      orgWinRateAll: (function () {
        /* سنجهٔ سازمانی (برد از کل پیشنهادهای صادرشده) برای مقایسهٔ کنار هم */
        try {
          if (!_mx || typeof _mx.winStats !== 'function') return null;
          var st = _mx.winStats(getData('ptf_crm_offers') || []);
          return st.winRateAll;
        } catch (e) { return null; }
      })(),
      wonValue: wins.reduce(function (s, p) { return s + (+((p.stats || {}).totalCO) || 0); }, 0),
      lostValue: losses.reduce(function (s, p) { return s + (+((p.stats || {}).totalCO) || 0); }, 0),
      byReason: byReason,
      reasons: REASONS
    };
  };

  window.ptfRenderWinLoss = function () {
    var el = document.getElementById('wlWrap');
    if (!el) return;
    var s = ptfWinLossStats();
    if (!s.total) {
      el.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:22px;background:var(--crd,#f8fafc);border:1px dashed var(--brd);border-radius:14px;font-size:12.5px">هنوز پرونده مختومه‌ای (برد/باخت) در بایگانی ثبت نشده — با اولین مختومه‌سازی، این گزارش زنده می‌شود.</div>';
      return;
    }
    var LB = { legacy: 'نامشخص (رکورد قدیمی)' };
    s.reasons.forEach(function (r) { LB[r.id] = r.lb; });
    var maxN = 1;
    Object.keys(s.byReason).forEach(function (k) { if (s.byReason[k].n > maxN) maxN = s.byReason[k].n; });
    var rows = Object.keys(s.byReason).sort(function (a, b) { return s.byReason[b].n - s.byReason[a].n; }).map(function (k) {
      var r = s.byReason[k];
      var pctL = s.losses ? Math.round(r.n * 100 / s.losses) : 0;
      var w = Math.max(Math.round(r.n * 100 / maxN), 6);
      return '<tr><td><b>' + escP(LB[k] || k) + '</b></td>' +
        '<td>' + r.n + '</td><td>' + pctL + '٪</td>' +
        '<td>' + (r.val ? r.val.toLocaleString('fa-IR') + ' ریال' : '—') + '</td>' +
        '<td style="min-width:120px"><div style="background:#fee2e2;border-radius:6px;height:12px;overflow:hidden"><div style="width:' + w + '%;height:100%;background:linear-gradient(90deg,#ef4444,#f87171)"></div></div></td>' +
        '<td style="font-size:10.5px;color:#94a3b8;direction:ltr">' + r.items.slice(0, 3).map(escP).join('، ') + (r.items.length > 3 ? ' +' + (r.items.length - 3) : '') + '</td></tr>';
    }).join('');
    el.innerHTML =
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:12px">' +
      '<div class="sc" style="border-color:#a7f3d0"><b style="-webkit-text-fill-color:#059669">' + s.wins + '</b><span>🏆 پرونده برنده</span></div>' +
      '<div class="sc" style="border-color:#fecaca"><b style="-webkit-text-fill-color:#dc2626">' + s.losses + '</b><span>🚫 پرونده باخته</span></div>' +
      '<div class="sc"><b>' + (s.winRateDecided == null ? '—' : s.winRateDecided + '٪') + '</b><span>📈 ' + escP(s.winRateLabel) + ' (' + s.wins + ' از ' + s.total + ')' + (s.reliable ? '' : ' — نمونه ناکافی') + '</span></div>' +
      (s.orgWinRateAll == null ? '' : '<div class="sc"><b>' + s.orgWinRateAll + '٪</b><span>📊 نرخ برد سازمان (از کل پیشنهادهای صادرشده)</span></div>') +
      '<div class="sc"><b style="font-size:16px;-webkit-text-fill-color:#059669">' + s.wonValue.toLocaleString('fa-IR') + '</b><span>ارزش بردها (ریال)</span></div>' +
      '<div class="sc"><b style="font-size:16px;-webkit-text-fill-color:#dc2626">' + s.lostValue.toLocaleString('fa-IR') + '</b><span>ارزش ازدست‌رفته (ریال)</span></div>' +
      '</div>' +
      '<h5 style="margin:6px 0 8px;font-size:13px">🔎 تفکیک دلایل باخت (استاندارد US-349)</h5>' +
      (rows
        ? '<div class="tb2"><table><thead><tr><th>دلیل باخت</th><th>تعداد</th><th>سهم از باخت‌ها</th><th>ارزش پیشنهاد</th><th>نمودار</th><th>نمونه پرونده‌ها</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
        : '<div style="color:#94a3b8;font-size:12px">باختی ثبت نشده — همه پرونده‌های مختومه برنده بوده‌اند 🎉</div>') +
      '<div style="font-size:11px;color:#94a3b8;margin-top:8px">رکوردهای مختومه‌شده قبل از v14.8 دلیل استاندارد ندارند و از متن آزادشان دسته‌بندی شده‌اند («نامشخص» = بدون متن).</div>';
  };

  /* ---- تزریق بخش Win/Loss به ماژول گزارشات (rep — admin/chairman) ---- */
  function hookReports() {
    if (window._insRepHooked) return true;
    if (typeof window.buildReports !== 'function' || typeof window.renderReports !== 'function') return false;
    window._insRepHooked = true;
    var _br = window.buildReports;
    window.buildReports = function () {
      return _br() +
        '<h4 style="margin:22px 0 8px;font-size:14px">🏆 گزارش برد/باخت (Win/Loss — US-349)</h4>' +
        '<div id="wlWrap" style="margin-bottom:20px"></div>';
    };
    var _rr = window.renderReports;
    window.renderReports = function () {
      _rr();
      try { ptfRenderWinLoss(); } catch (e) {}
    };
    return true;
  }
  var hrTries = 0;
  var hrT = setInterval(function () { hrTries++; if (hookReports() || hrTries > 50) clearInterval(hrT); }, 300);
  hookReports();
})();
