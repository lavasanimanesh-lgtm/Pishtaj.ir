/* =====================================================================
   PTF CRM — commission.js — v21.6 — US-411 فاز ۲ (پورسانت فروش)
   - تنظیمات: درصد پیش‌فرض + per کارشناس + مبنا (وصولی واقعی / مبلغ CO برنده)
   - گزارش per کارشناس per دوره
   - ارشد: همه | کارشناس فروش: فقط سهم خودش
   - بدون کلید داده جدید — همه در ptf_crm_settings.commission
   ===================================================================== */
(function () {
  'use strict';

  function isSenior() {
    try { return ['admin', 'chairman', 'ceo', 'commercial'].indexOf(curRole()) > -1; } catch (e) { return false; }
  }
  function me() {
    try { return (curSession() || {}).user || ''; } catch (e) { return ''; }
  }
  function settings() {
    try { return JSON.parse(localStorage.getItem('ptf_crm_settings') || '{}'); } catch (e) { return {}; }
  }
  function saveSettings(st) {
    setData('ptf_crm_settings', st);
  }
  function cfg() {
    var st = settings();
    var c = st.commission || {};
    return {
      basis: c.basis === 'won' ? 'won' : 'collected', /* پیش‌فرض مصوب: وصولی واقعی */
      defaultPct: (c.defaultPct != null && !isNaN(+c.defaultPct)) ? Math.max(0, Math.min(50, +c.defaultPct)) : 1,
      byUser: c.byUser || {}
    };
  }
  function userPct(username) {
    var c = cfg();
    if (username && c.byUser && c.byUser[username] != null && c.byUser[username] !== '') {
      return Math.max(0, Math.min(50, +c.byUser[username]));
    }
    return c.defaultPct;
  }
  function userLabel(username) {
    if (!username) return '—';
    try {
      var u = (getData('ptf_crm_users') || []).filter(function (x) {
        return (x.username || x.user) === username;
      })[0];
      if (u) return (u.name || u.nm || username) + ' (' + username + ')';
    } catch (e) {}
    return username;
  }
  function periodBounds(ym) {
    /* ym = '1405/04' شمسی نمایشی یا 'YYYY-MM' میلادی — برای فیلتر date از ISO میلادی invoices/offers استفاده می‌کنیم */
    ym = String(ym || '').trim();
    if (/^\d{4}-\d{2}$/.test(ym)) {
      var y = +ym.slice(0, 4), m = +ym.slice(5, 7);
      var start = ym + '-01';
      var mm = (m === 12 ? 1 : m + 1); var yy = (m === 12 ? y + 1 : y); var endM = yy + '-' + (mm < 10 ? '0' : '') + mm + '-01';
      return { start: start, end: endM, label: ym };
    }
    /* fallback: ماه جاری میلادی */
    var d = new Date();
    var cur = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    return periodBounds(cur);
  }
  function inPeriod(iso, b) {
    if (!iso) return false;
    var s = String(iso).slice(0, 10);
    return s >= b.start && s < b.end;
  }
  function offerTotal(o) {
    if (!o || !o.items) return 0;
    return (o.items || []).reduce(function (s, it) { return s + (+it.qty || 0) * (+it.price || 0); }, 0);
  }
  function ownerOfCustomer(custCd) {
    if (!custCd) return '';
    try {
      var c = (getData('ptf_crm_customers') || []).filter(function (x) { return x.cd === custCd; })[0];
      if (!c) return '';
      return c.owner || c.crBy || '';
    } catch (e) { return ''; }
  }
  function resolveOfferOwner(o) {
    if (!o) return '';
    if (o.buyerCd) return ownerOfCustomer(o.buyerCd);
    /* fallback: نام خریدار → مشتری */
    try {
      if (o.buyerCo) {
        var c = (getData('ptf_crm_customers') || []).filter(function (x) {
          return x.co === o.buyerCo || x.coEn === o.buyerCo ||
            (typeof dedupNorm === 'function' && (dedupNorm(x.co) === dedupNorm(o.buyerCo) || (x.coEn && dedupNorm(x.coEn) === dedupNorm(o.buyerCo))));
        })[0];
        if (c) return c.owner || c.crBy || '';
      }
    } catch (e) {}
    return o.issuedBy || o.crBy || '';
  }

  /**
   * هسته محاسبه — تست‌پذیر
   * basis collected: Σ payments در دوره روی فاکتورهای CO/TC مشتریانِ تحت مالکیت کارشناس
   * basis won: Σ مبلغ CO/TC برنده در دوره (wonAt/dateEn) برای مشتریان تحت مالکیت
   */
  window.ptfCommissionCalc = function (opts) {
    opts = opts || {};
    var c = cfg();
    var basis = opts.basis || c.basis;
    var b = periodBounds(opts.period || opts.ym);
    var filterUser = opts.user || ''; /* خالی = همه (فقط ارشد در UI) */
    var byUser = {};

    function ensure(u) {
      if (!u) u = '_none';
      if (!byUser[u]) byUser[u] = { user: u, base: 0, lines: [], pct: userPct(u === '_none' ? '' : u) };
      return byUser[u];
    }

    if (basis === 'won') {
      (getData('ptf_crm_offers') || []).forEach(function (o) {
        if (!o || o.kind === 'TO') return;
        if (o.st !== 'won') return;
        var when = (o.wonAt && String(o.wonAt).match(/\d{4}-\d{2}-\d{2}/)) ? String(o.wonAt).match(/\d{4}-\d{2}-\d{2}/)[0]
          : (o.dateEn || '');
        if (!inPeriod(when, b)) return;
        var owner = resolveOfferOwner(o);
        if (filterUser && owner !== filterUser) return;
        var tot = offerTotal(o);
        if (tot <= 0) return;
        var row = ensure(owner || '_none');
        row.base += tot;
        row.lines.push({ kind: 'won', no: o.no, buyer: o.buyerCo || '', amt: tot, t: when, cur: o.currency || 'IRR' });
      });
    } else {
      /* collected — پیش‌فرض مصوب */
      var offers = getData('ptf_crm_offers') || [];
      var offerByNo = {};
      offers.forEach(function (o) { if (o && o.no) offerByNo[o.no] = o; });
      (getData('ptf_crm_invoices') || []).forEach(function (inv) {
        if (!inv) return;
        var o = offerByNo[inv.offerNo] || {};
        var owner = resolveOfferOwner(o);
        if (filterUser && owner !== filterUser) return;
        ((inv.payments || []).concat(inv.pays || []).filter(window.PTF && window.PTF.isPaymentActive ? window.PTF.isPaymentActive : function(){return true})).forEach(function (p) {
          var when = '';
          var rawT = p.iso || p.date || p.t || '';
          var hasPayISO = !!(rawT && String(rawT).match(/\d{4}-\d{2}-\d{2}/));
          if (hasPayISO) when = String(rawT).match(/\d{4}-\d{2}-\d{2}/)[0];
          else if (inv.invDate && String(inv.invDate).match(/\d{4}-\d{2}-\d{2}/)) when = String(inv.invDate).match(/\d{4}-\d{2}-\d{2}/)[0];
          else if (inv.t && String(inv.t).match(/\d{4}-\d{2}-\d{2}/)) when = String(inv.t).match(/\d{4}-\d{2}-\d{2}/)[0];
          /* اگر پرداخت تاریخ میلادی دارد فقط همان مبنا است؛ اگر ندارد/شمسی → fallback به invDate */
          if (hasPayISO) {
            if (!inPeriod(when, b)) return;
          } else {
            if (!when || !inPeriod(when, b)) return;
          }
          var amt = +p.amt || 0;
          if (amt <= 0) return;
          var row = ensure(owner || '_none');
          row.base += amt;
          row.lines.push({
            kind: 'pay', inv: inv.no || inv.cd, offer: inv.offerNo || '', buyer: o.buyerCo || '',
            amt: amt, t: when, how: p.how || ''
          });
        });
      });
    }

    var list = Object.keys(byUser).map(function (k) {
      var r = byUser[k];
      r.commission = Math.round(r.base * (r.pct / 100));
      r.userLabel = userLabel(r.user === '_none' ? '' : r.user);
      return r;
    }).filter(function (r) { return r.user !== '_none' || r.base > 0; })
      .sort(function (a, b2) { return b2.commission - a.commission; });

    var totalBase = list.reduce(function (s, r) { return s + r.base; }, 0);
    var totalComm = list.reduce(function (s, r) { return s + r.commission; }, 0);
    return {
      basis: basis,
      period: b,
      rows: list,
      totalBase: totalBase,
      totalComm: totalComm,
      cfg: c
    };
  };

  window.ptfCommissionCfg = cfg;
  window.ptfCommissionUserPct = userPct;

  /* ---------- UI تنظیمات ---------- */
  function salesUserOptions(selected) {
    var h = '';
    try {
      (getData('ptf_crm_users') || []).forEach(function (u) {
        var un = u.username || u.user || '';
        var rl = u.roleId || u.role || '';
        if (!un) return;
        if (['sales', 'commercial', 'ceo', 'chairman', 'admin'].indexOf(rl) < 0 && rl) return;
        h += '<option value="' + escP(un) + '"' + (selected === un ? ' selected' : '') + '>' + escP(u.name || u.nm || un) + ' (' + escP(rl || '-') + ')</option>';
      });
    } catch (e) {}
    return h;
  }

  function settingsHtml() {
    var c = cfg();
    if (!isSenior() && curRole() !== 'sales') return '';
    var rows = '';
    try {
      (getData('ptf_crm_users') || []).forEach(function (u) {
        var un = u.username || u.user || '';
        var rl = u.roleId || u.role || '';
        if (!un || (rl && ['sales', 'commercial'].indexOf(rl) < 0 && rl !== 'ceo')) return;
        var pct = c.byUser[un] != null ? c.byUser[un] : '';
        rows += '<tr><td style="text-align:right">' + escP(u.name || u.nm || un) + ' <small style="color:#94a3b8">' + escP(un) + '</small></td><td>' +
          (isSenior()
            ? '<input type="number" min="0" max="50" step="0.1" id="cmPct_' + escP(un) + '" value="' + escP(pct) + '" placeholder="' + c.defaultPct + '" style="width:70px;padding:4px;border:1px solid var(--brd);border-radius:7px;direction:ltr" title="خالی = درصد پیش‌فرض">'
            : '<b>' + (pct !== '' ? pct : c.defaultPct) + '٪</b>') +
          '</td></tr>';
      });
    } catch (e) {}
    return '<div style="max-width:560px" id="cmSettingsBox"><hr style="border:none;border-top:1px solid var(--brd);margin:16px 0">' +
      '<h4 style="margin:0 0 8px">💸 پورسانت فروش (US-411 فاز ۲)</h4>' +
      '<div style="font-size:11.5px;color:#64748b;margin-bottom:8px">مبنا پیش‌فرض: <b>وصولی واقعی</b> (انگیزه پیگیری وصول). گزارش per کارشناس از مالک مشتری (owner/crBy) + فاکتور/پرداخت.</div>' +
      (isSenior()
        ? ('<div class="fr" style="gap:10px;flex-wrap:wrap;margin-bottom:8px">' +
          '<div class="fld" style="min-width:160px"><label>مبنا</label><select id="cmBasis">' +
          '<option value="collected"' + (c.basis === 'collected' ? ' selected' : '') + '>💰 وصولی واقعی (payments)</option>' +
          '<option value="won"' + (c.basis === 'won' ? ' selected' : '') + '>🏆 مبلغ CO برنده</option></select></div>' +
          '<div class="fld" style="min-width:120px"><label>درصد پیش‌فرض</label><input type="number" id="cmDefPct" min="0" max="50" step="0.1" value="' + c.defaultPct + '" style="direction:ltr;padding:6px;border:1px solid var(--brd);border-radius:8px"></div></div>' +
          '<table style="font-size:12px;border-collapse:collapse;width:100%;margin-bottom:8px"><thead><tr><th style="text-align:right">کارشناس</th><th>٪ اختصاصی</th></tr></thead><tbody>' + (rows || '<tr><td colspan="2" style="color:#94a3b8">کاربری نیست</td></tr>') + '</tbody></table>' +
          '<button class="bt bt-o" style="font-size:12px" onclick="ptfCommissionSaveCfg()">💾 ذخیره تنظیمات پورسانت (audit)</button> ')
        : '<div style="font-size:12.5px;margin-bottom:8px">درصد شما: <b>' + userPct(me()) + '٪</b> | مبنا: ' + (c.basis === 'won' ? 'CO برنده' : 'وصولی واقعی') + '</div>') +
      '<button class="bt bt-o" style="font-size:12px;color:#0e7490" onclick="ptfCommissionReport()">📄 گزارش پورسانت</button></div>';
  }

  window.ptfCommissionSaveCfg = function () {
    if (!isSenior()) { alert('⛔ فقط مدیران ارشد'); return; }
    var st = settings();
    var byUser = {};
    try {
      (getData('ptf_crm_users') || []).forEach(function (u) {
        var un = u.username || u.user || '';
        if (!un) return;
        var el = document.getElementById('cmPct_' + un);
        if (el && String(el.value).trim() !== '') byUser[un] = Math.max(0, Math.min(50, +el.value));
      });
    } catch (e) {}
    st.commission = {
      basis: ((document.getElementById('cmBasis') || {}).value) === 'won' ? 'won' : 'collected',
      defaultPct: Math.max(0, Math.min(50, +((document.getElementById('cmDefPct') || {}).value) || 1)),
      byUser: byUser
    };
    saveSettings(st);
    try { audit('پورسانت', 'ذخیره تنظیمات پورسانت: basis=' + st.commission.basis + ' default=' + st.commission.defaultPct + '% byUser=' + JSON.stringify(byUser), ''); } catch (eA) {}
    if (typeof ptfToast === 'function') ptfToast('💾 تنظیمات پورسانت ذخیره شد', 'ok');
  };

  window.ptfCommissionReport = function (period) {
    if (!isSenior() && curRole() !== 'sales' && curRole() !== 'commercial') {
      alert('⛔ دسترسی ندارید'); return;
    }
    var d = new Date();
    var defYm = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    var ym = period || defYm;
    var filterUser = isSenior() ? '' : me();
    var res = ptfCommissionCalc({ period: ym, user: filterUser });
    var basisLb = res.basis === 'won' ? 'مبلغ CO برنده' : 'وصولی واقعی';
    var body = res.rows.map(function (r) {
      var detail = (r.lines || []).slice(0, 8).map(function (ln) {
        if (ln.kind === 'pay') {
          return '<div style="font-size:11px;color:#64748b;padding:2px 0">◽ ' + escP(ln.t) + ' — فاکتور ' + escP(ln.inv) + ' / ' + escP(ln.offer) + ' — ' + (+ln.amt).toLocaleString('fa-IR') + ' ریال' + (ln.buyer ? ' — ' + escP(ln.buyer) : '') + '</div>';
        }
        return '<div style="font-size:11px;color:#64748b;padding:2px 0">◽ ' + escP(ln.t) + ' — ' + escP(ln.no) + ' — ' + (+ln.amt).toLocaleString('fa-IR') + (ln.buyer ? ' — ' + escP(ln.buyer) : '') + '</div>';
      }).join('') + ((r.lines || []).length > 8 ? '<div style="font-size:11px;color:#94a3b8">… و ' + (r.lines.length - 8) + ' مورد دیگر</div>' : '');
      return '<div style="border:1px solid var(--brd);border-radius:12px;padding:10px 12px;margin-bottom:8px;background:var(--crd,#fff)">' +
        '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center">' +
        '<div><b>' + escP(r.userLabel) + '</b><div style="font-size:11.5px;color:#64748b">مبنا: ' + (+r.base).toLocaleString('fa-IR') + ' × ' + r.pct + '٪</div></div>' +
        '<div style="font-size:15px;font-weight:900;color:#0e7490">' + (+r.commission).toLocaleString('fa-IR') + ' ریال</div></div>' +
        detail + '</div>';
    }).join('') || '<div style="text-align:center;color:#94a3b8;padding:20px">در این دوره موردی نیست</div>';

    var html = '<div class="md-b" id="cmReportDlg" style="display:grid;z-index:2400" onclick="if(event.target===this)this.remove()">' +
      '<div class="md" style="max-width:640px;max-height:92vh;overflow:auto" onclick="event.stopPropagation()">' +
      '<h3>💸 گزارش پورسانت</h3>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-bottom:12px">' +
      '<div class="fld" style="margin:0"><label>دوره (YYYY-MM میلادی)</label>' +
      '<input type="month" id="cmPeriod" value="' + escP(ym) + '" style="direction:ltr;padding:6px;border:1px solid var(--brd);border-radius:8px"></div>' +
      '<button class="bt" style="font-size:12px" onclick="ptfCommissionReport(((document.getElementById(\'cmPeriod\')||{}).value)||\'' + ptfOnClickArg(ym) + '\');document.getElementById(\'cmReportDlg\').remove()">🔄 محاسبه</button></div>' +
      '<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:10px 12px;font-size:12.5px;color:#0c4a6e;margin-bottom:10px">' +
      'مبنا: <b>' + basisLb + '</b> | دوره: <b dir="ltr">' + escP(res.period.label) + '</b><br>' +
      'جمع مبنا: <b>' + res.totalBase.toLocaleString('fa-IR') + '</b> — جمع پورسانت: <b style="color:#0e7490">' + res.totalComm.toLocaleString('fa-IR') + ' ریال</b>' +
      (filterUser ? '<br>نمای شخصی: فقط سهم شما' : '') + '</div>' +
      body +
      '<div style="display:flex;justify-content:flex-end;margin-top:12px"><button class="bt" onclick="var m=document.getElementById(\'cmReportDlg\');if(m)m.remove()">بستن</button></div>' +
      '</div></div>';
    /* بستن قبلی */
    try { var old = document.getElementById('cmReportDlg'); if (old) old.remove(); } catch (e) {}
    var host = document.getElementById('panels') || document.body;
    host.insertAdjacentHTML('beforeend', html);
  };

  /* ---------- hooks ---------- */
  function hookSettings() {
    if (window._cmSetHooked || typeof window.buildSettings !== 'function') return false;
    window._cmSetHooked = true;
    var _bs = window.buildSettings;
    window.buildSettings = function () {
      return _bs() + settingsHtml();
    };
    return true;
  }

  function hookFinanceHub() {
    if (window._cmHubHooked) return !!window.finHubSet;
    if (typeof window.finHubSet !== 'function') return false;
    window._cmHubHooked = true;
    /* دکمه گزارش در هاب — از طریق گسترش bar اگر ممکن */
    var _apply = window.finHubApply;
    if (typeof _apply === 'function') {
      window.finHubApply = function () {
        _apply();
        try {
          if (!isSenior() && curRole() !== 'sales') return;
          var bar = document.getElementById('finHubBar');
          if (!bar || document.getElementById('cmHubBtn')) return;
          var wrap = bar.querySelector('div[style*="flex-wrap"]') || bar;
          var btn = document.createElement('button');
          btn.id = 'cmHubBtn';
          btn.type = 'button';
          btn.className = 'bt bt-o';
          btn.style.cssText = 'font-size:12px;color:#0e7490';
          btn.textContent = '💸 پورسانت';
          btn.onclick = function () { ptfCommissionReport(); };
          wrap.appendChild(btn);
        } catch (e) {}
      };
    }
    return true;
  }

  var n = 0;
  var it = setInterval(function () {
    n++;
    var a = hookSettings();
    var b = hookFinanceHub();
    if ((a || window._cmSetHooked) && (b || window._cmHubHooked || n > 20)) clearInterval(it);
    if (n > 60) clearInterval(it);
  }, 300);
  hookSettings();
  hookFinanceHub();
})();
