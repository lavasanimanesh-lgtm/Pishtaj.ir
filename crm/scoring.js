/* =====================================================================
   PTF CRM — scoring.js — v16.6 — US-400/US-401 (مصوب کارفرما ۱۴۰۵/۰۴/۱۹)
   نظام امتیازدهی تامین‌کنندگان و مشتریان + بستانکاری تامین‌کننده (ابلاغ تکمیلی)
   سند مبنا: PROPOSAL-SCORING-SYSTEM-v1.md — پاسخ‌های کارفرما:
   ① وزن‌ها تایید ② معیار تحویل = یک کلیک اختیاری هنگام خرید واقعی + فقط سوال ۱و۲
   ③ هشدار بدحسابی هنگام صدور CO نمایش داده شود ④ سطح‌بندی تایید
   ⑤ گزارش = خروجی درخواستی مدیر (همیشه فعال نیست)
   + ابلاغ تکمیلی: تامین‌کننده هر آیتم هنگام ورود قیمت مشخص است (buycmp)؛
     ثبت خرید → بستانکاری تامین‌کننده؛ نقدی = تسویه فوری؛ غیرنقدی = پرداخت مرحله‌ای؛
     بدهی غیرنقدی = امتیاز/ضریب بالاتر تامین‌کننده؛ مدیران در هر لحظه بدهی
     غیرنقدی به هر تامین‌کننده را می‌بینند.
   اصول: صفر فیلد اجباری جدید — همه از داده موجود. امتیاز = ابزار تصمیم با دلیل.
   داده: ptf_crm_payables = [{cd, sup, inqNo, idx, item, amount, cur, rate,
         pay:'cash'|'credit', paid:[{amt,t,by,note}], settled, dueISO, dueNote, dlv:'ok'|'issue', dlvISO, dlvLate, t, by}]
   ===================================================================== */
(function () {
  'use strict';

  var PK = 'ptf_crm_payables';
  function pAll() { return getData(PK); }
  function pSave(l) { setData(PK, l); }
  function norm(s) { return (typeof dedupNorm === 'function') ? dedupNorm(s) : String(s || '').toLowerCase(); }
  function fmtT(v) { return (+v || 0).toLocaleString('fa-IR'); }

  /* ---------- RBAC نمایش (سند بخش ۳): تامین‌کننده = بازرگانی+ | مشتری = finance ---------- */
  function canSeeSup() { try { return (roleDef() || {}).buyPrice || isSenior(); } catch (e) { return false; } }
  function canSeeCust() { try { return !!(roleDef() || {}).finance; } catch (e) { return false; } }

  /* ---------- وزن‌ها (مصوب — قابل مشاهده در تنظیمات؛ تغییر فقط ارشد با audit) ---------- */
  var DEF_W = {
    sup: { resp: 20, price: 20, hist: 20, spec: 15, dlv: 15, reg: 10 },
    cust: { pay: 30, vol: 25, conv: 20, loyal: 15, inter: 10 }
  };
  function weights() {
    try {
      var st = JSON.parse(localStorage.getItem('ptf_crm_settings') || '{}');
      var w = st.scoreWeights || {};
      return { sup: Object.assign({}, DEF_W.sup, w.sup || {}), cust: Object.assign({}, DEF_W.cust, w.cust || {}) };
    } catch (e) { return DEF_W; }
  }
  function adjOf(kind, cd) {
    try {
      var st = JSON.parse(localStorage.getItem('ptf_crm_settings') || '{}');
      return ((st.scoreAdj || {})[kind] || {})[cd] || null;
    } catch (e) { return null; }
  }

  /* ===================================================================
     بخش ۱ — بستانکاری تامین‌کننده (ابلاغ تکمیلی کارفرما)
     =================================================================== */
  window.ptfPayableUpsert = function (o) {
    var list = pAll();
    /* ثبت مجدد خرید همان قلم = جایگزینی رکورد بستانکاری (پرداخت‌های قبلی حفظ) */
    var old = list.filter(function (p) { return p.inqNo === o.inqNo && p.idx === o.idx; })[0];
    var rec = {
      cd: old ? old.cd : genCode('PAY'),
      sup: o.sup, inqNo: o.inqNo, idx: o.idx, item: o.item,
      amount: +o.amount || 0, cur: o.cur || 'IRR', rate: +o.rate || 0,
      pay: o.pay || 'cash',
      paid: old ? (old.paid || []) : [],
      dueISO: o.dueISO || (old ? old.dueISO : '') || '',
      dueNote: o.dueNote || (old ? old.dueNote : '') || '',
      dlv: old ? old.dlv : undefined,
      dlvISO: old ? old.dlvISO : '',
      dlvLate: old ? old.dlvLate : false,
      t: faDate(), by: curSession().name
    };
    if (rec.pay === 'cash') {
      /* نقدی: در همان لحظه صفر می‌شود (ابلاغ کارفرما) */
      rec.paid = [{ amt: rec.amount, t: faDate(), by: curSession().name, note: 'تسویه نقدی هنگام خرید', auto: true }];
      rec.settled = true;
    } else {
      rec.settled = ptfPayableRemain(rec) <= 0;
    }
    list = list.filter(function (p) { return p.cd !== rec.cd; });
    list.unshift(rec);
    pSave(list);
    if (typeof audit === 'function') audit('بستانکاری تامین', (rec.pay === 'cash' ? 'خرید نقدی (تسویه فوری) ' : 'بستانکاری غیرنقدی ') + rec.sup + ' — ' + fmtT(rec.amount) + (rec.cur !== 'IRR' ? ' ' + rec.cur : ' ریال') + ' بابت ' + rec.item, rec.cd);
    if (rec.pay === 'credit' && typeof notify === 'function') {
      notify({ toRoles: SENIOR_ROLES, title: '🧾 بستانکاری غیرنقدی ' + rec.sup + ': ' + fmtT(rec.amount) + (rec.cur !== 'IRR' ? ' ' + rec.cur : ' ریال') + ' (' + rec.item + ')', kind: 'payable', channels: ['cart'], link: { panel: 'sup' } });
    }
    return rec;
  };

  window.ptfPayableRemain = function (p) {
    var paid = (p.paid || []).reduce(function (s, x) { return s + (+x.amt || 0); }, 0);
    return Math.max(0, (+p.amount || 0) - paid);
  };

  /* ارزش ریالی مانده: ارزی×نرخ؛ بی‌نرخ → {irr:0, fx} برای نمایش شفاف */
  function remainIrr(p) {
    var r = ptfPayableRemain(p);
    if (p.cur === 'IRR' || !p.cur) return { irr: r, fx: 0 };
    if (p.rate > 0) return { irr: r * p.rate, fx: 0 };
    return { irr: 0, fx: r };
  }

  /* بدهی غیرنقدی باز per تامین‌کننده — منبع نمای مدیران و ضریب امتیاز */
  window.ptfSupplierDebts = function () {
    var by = {};
    pAll().forEach(function (p) {
      /* Sprint 262: payable لینک‌شده به فاکتور خرید جدید در زیر‌دفتر دوباره‌شماری نمی‌شود. */
      if (p.sfInvoiceCd || p.pay !== 'credit' || p.settled) return;
      var rem = ptfPayableRemain(p);
      if (rem <= 0) return;
      var k = norm(p.sup);
      if (!by[k]) by[k] = { sup: p.sup, irr: 0, fx: {}, cnt: 0 };
      var ri = remainIrr(p);
      by[k].irr += ri.irr;
      if (ri.fx) by[k].fx[p.cur] = (by[k].fx[p.cur] || 0) + ri.fx;
      by[k].cnt++;
    });
    return Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return b.irr - a.irr; });
  };

  /* باکس «بدهی غیرنقدی تامین‌کنندگان» بالای ماژول تامین‌کنندگان — رویت لحظه‌ای مدیران */
  function payablesBoxHtml() {
    if (!canSeeSup()) return '';
    var debts = ptfSupplierDebts();
    var tot = debts.reduce(function (s, d) { return s + d.irr; }, 0);
    var rows = debts.slice(0, 8).map(function (d) {
      var fxTx = Object.keys(d.fx).map(function (c) { return fmtT(d.fx[c]) + ' ' + c + ' (بی‌نرخ)'; }).join(' + ');
      return '<div style="display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-bottom:1px dashed var(--brd);font-size:12.5px">' +
        '<span><b>' + escP(d.sup) + '</b> <small style="color:#94a3b8">(' + d.cnt + ' قلم باز)</small></span>' +
        '<span style="white-space:nowrap"><b style="color:#b45309">' + fmtT(Math.round(d.irr)) + ' ریال</b>' + (fxTx ? ' <small style="color:#dc2626">+ ' + fxTx + '</small>' : '') +
        ' <button class="bt bt-o" style="padding:2px 9px;font-size:11px" onclick="ptfPayablesOpen(\'' + escP(d.sup) + '\')">💳 پرداخت/جزئیات</button></span></div>';
    }).join('');
    return '<div id="payablesBox" style="background:#fffbeb;border:1px solid #fcd34d;border-radius:14px;padding:12px 14px;margin-bottom:14px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:6px">' +
      '<h4 style="margin:0;font-size:13.5px;color:#92400e">💳 بدهی غیرنقدی به تامین‌کنندگان (US-400)' + (debts.length ? ' — جمع: ' + fmtT(Math.round(tot)) + ' ریال' : '') + '</h4>' +
      '<span style="display:flex;gap:6px">' +
      '<button class="bt bt-o" style="font-size:11.5px;padding:4px 10px" onclick="ptfPayablesOpen()">📋 همه بستانکاری‌ها</button>' +
      '<button class="bt bt-o" style="font-size:11.5px;padding:4px 10px;color:#7c3aed" onclick="ptfScoreReport()">📄 گزارش امتیازها (درخواستی)</button></span></div>' +
      (rows || '<div style="color:#94a3b8;font-size:12px">بدهی غیرنقدی بازی وجود ندارد — خرید نقدی همان لحظه تسویه می‌شود ✅</div>') + '</div>';
  }

  /* مودال جزئیات بستانکاری‌ها + ثبت پرداخت مرحله‌ای + رویداد تحویل (یک کلیک اختیاری) */
  window.ptfPayablesOpen = function (sup) {
    if (!canSeeSup()) { alert('⛔ دسترسی ندارید'); return; }
    var list = pAll().filter(function (p) { return !p.sfInvoiceCd && (!sup || norm(p.sup) === norm(sup)); });
    var rows = list.map(function (p) {
      var rem = ptfPayableRemain(p);
      var isOpen = p.pay === 'credit' && !p.settled && rem > 0;
      var payLog = (p.paid || []).map(function (x) { return '<div style="font-size:11px;color:#64748b">◉ ' + escP(x.t) + ' — ' + fmtT(x.amt) + (p.cur !== 'IRR' ? ' ' + p.cur : ' ریال') + (x.note ? ' (' + escP(x.note) + ')' : '') + ' — ' + escP(x.by || '') + '</div>'; }).join('');
      var dlvBtns = p.dlv
        ? (p.dlv === 'ok' ? '<span class="bd" style="background:#d1fae5;color:#065f46">✅ تحویل بدون مشکل</span>' : '<span class="bd" style="background:#fee2e2;color:#b91c1c">⚠️ تحویل با مشکل</span>')
        : '<button class="bt bt-o" style="padding:2px 8px;font-size:10.5px;color:#059669" onclick="ptfPayableDlv(\'' + escP(p.cd) + '\',\'ok\')" title="اختیاری — در امتیاز کیفیت تحویل اثر دارد">✅ تحویل ok</button> <button class="bt bt-o" style="padding:2px 8px;font-size:10.5px;color:#dc2626" onclick="ptfPayableDlv(\'' + escP(p.cd) + '\',\'issue\')">⚠️ با مشکل</button>';
      var dueInfo = (p.dueISO ? '<br><small style="color:#0e7490">تعهد تحویل تامین‌کننده: ' + escP(p.dueISO) + (p.dueNote ? ' — ' + escP(p.dueNote) : '') + '</small>' : '') +
        (p.dlvISO ? '<br><small style="color:' + (p.dlvLate ? '#dc2626' : '#059669') + '">تحویل واقعی: ' + escP(p.dlvISO) + (p.dlvLate ? ' — با تاخیر' : '') + '</small>' : '');
      return '<div style="border:1px solid var(--brd);border-right:4px solid ' + (isOpen ? '#f59e0b' : '#10b981') + ';border-radius:11px;padding:9px 12px;margin-bottom:7px">' +
        '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;font-size:12.5px">' +
        '<span><b>' + escP(p.sup) + '</b> — ' + escP(p.item) + ' <small style="color:#94a3b8">(' + escP(p.inqNo) + ' | ' + escP(p.t) + ')</small><br>' +
        '<small>مبلغ: <b>' + fmtT(p.amount) + (p.cur !== 'IRR' ? ' ' + p.cur : ' ریال') + '</b> | ' + (p.pay === 'cash' ? '💵 نقدی — تسویه‌شده' : isOpen ? '🧾 غیرنقدی — مانده: <b style="color:#b45309">' + fmtT(rem) + (p.cur !== 'IRR' ? ' ' + p.cur : ' ریال') + '</b>' : '🧾 غیرنقدی — تسویه کامل ✅') + '</small>' + dueInfo + '</span>' +
        '<span style="white-space:nowrap;display:flex;gap:4px;align-items:center">' + (isOpen ? '<button class="bt" style="padding:4px 11px;font-size:11.5px;background:#059669" onclick="ptfPayablePay(\'' + escP(p.cd) + '\')">💰 پرداخت</button>' : '') + '<button class="bt bt-o" style="padding:4px 8px;font-size:11px;color:#0e7490;border-color:#bae6fd" onclick="ptfPayableEdit(\'' + escP(p.cd) + '\')" title="اصلاح و ویرایش بدهی">✏️ ویرایش</button><button class="bt bt-o" style="padding:4px 7px;font-size:11px;color:#dc2626;border-color:#fecaca" onclick="ptfPayableDel(\'' + escP(p.cd) + '\')" title="حذف بدهی">🗑 حذف</button>' + dlvBtns + '</span></div>' + payLog + '</div>';
    }).join('');
    var html = '<div class="md-b" style="display:grid;z-index:2200" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:760px;max-height:92vh;overflow:auto">' +
      '<h3>💳 بستانکاری تامین‌کنندگان' + (sup ? ' — ' + escP(sup) : '') + '</h3>' +
      '<div style="font-size:11.5px;color:#64748b;margin-bottom:8px">خرید نقدی همان لحظه تسویه می‌شود؛ غیرنقدی با «ثبت پرداخت» مرحله‌ای صفر می‌شود (ابلاغ کارفرما — US-400). رویداد تحویل، اختیاری و یک‌کلیکی است.</div>' +
      (rows || '<div style="color:#94a3b8;text-align:center;padding:18px">رکوردی نیست</div>') +
      '<div style="display:flex;justify-content:flex-end;margin-top:8px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };

  
  window.ptfPayableEdit = function (cd) {
    if (!canSeeSup()) { alert('⛔ دسترسی ندارید'); return; }
    var list = pAll();
    var p = list.filter(function (x) { return x.cd === cd; })[0];
    if (!p) return;
    ptfDialog({
      title: '✏️ ویرایش بدهی / بستانکاری تامین‌کننده (' + escP(p.sup) + ')',
      body: 'کد رکورد: <b>' + escP(p.cd) + '</b>' + (p.inqNo ? ' | متصل به استعلام/خرید: <b>' + escP(p.inqNo) + '</b>' : ''),
      fields: [
        { id: 'sup', label: 'نام تامین‌کننده *', type: 'text', value: p.sup || '', required: true },
        { id: 'item', label: 'شرح اقلام / کالا *', type: 'text', value: p.item || '', required: true },
        { id: 'amount', label: 'مبلغ کل بدهی/فاکتور *', type: 'number', money: false, value: p.amount || 0, dir: 'ltr', required: true },
        { id: 'cur', label: 'ارز فاکتور', type: 'select', value: p.cur || 'IRR', options: [
          { v: 'IRR', lb: 'ریال' }, { v: 'EUR', lb: 'یورو' }, { v: 'USD', lb: 'دلار' },
          { v: 'CNY', lb: 'یوان' }, { v: 'AED', lb: 'درهم' }, { v: 'GBP', lb: 'پوند' }
        ]},
        { id: 'rate', label: 'نرخ تسعیر (ریال per ارز)', type: 'number', money: false, value: p.rate || '', dir: 'ltr' },
        { id: 'pay', label: 'نحوه تسویه', type: 'select', value: p.pay || 'credit', options: [
          { v: 'credit', lb: '🧾 اعتباری / غیرنقدی (مرحله‌ای)' }, { v: 'cash', lb: '💵 نقدی (تسویه فوری)' }
        ]},
        { id: 'dueISO', label: 'تاریخ تعهد تحویل (میلادی/شمسی)', type: 'text', value: p.dueISO || '', dir: 'ltr' },
        { id: 'dueNote', label: 'یادداشت تعهد تحویل', type: 'text', value: p.dueNote || '' }
      ],
      okText: 'ذخیره تغییرات',
      onOk: function (v) {
        var sup = (v.sup || '').trim();
        var item = (v.item || '').trim();
        var amount = +v.amount || 0;
        if (!sup || !item || amount <= 0) { alert('⛔ نام تامین‌کننده، شرح کالا و مبلغ معتبر الزامی است'); return; }
        p.sup = sup;
        p.item = item;
        p.amount = amount;
        p.cur = v.cur || 'IRR';
        p.rate = +v.rate || (p.cur === 'IRR' ? 1 : 0);
        p.pay = v.pay || 'credit';
        p.dueISO = (v.dueISO || '').trim();
        p.dueNote = (v.dueNote || '').trim();
        p.settled = (p.pay === 'cash' || ptfPayableRemain(p) <= 0);
        pSave(list);
        audit('بستانکاری تامین', 'ویرایش بدهی/بستانکاری ' + p.sup + ' — مبلغ جدید: ' + fmtT(p.amount) + ' ' + p.cur, p.cd);
        if (typeof ptfToast === 'function') ptfToast('✅ بستانکاری با موفقیت ویرایش شد', 'ok');
        var md = document.querySelector('#panels .md-b:last-child');
        if (md && (md.style || {}).display !== 'none') md.remove();
        ptfPayablesOpen(p.sup);
        refreshBox();
      }
    });
  };

  window.ptfPayableDel = function (cd) {
    if (!canSeeSup()) { alert('⛔ دسترسی ندارید'); return; }
    var list = pAll();
    var p = list.filter(function (x) { return x.cd === cd; })[0];
    if (!p) return;
    if (!confirm('⚠️ آیا از حذف بدهی/بستانکاری تامین‌کننده «' + p.sup + '» (شرح: ' + p.item + ' - مبلغ: ' + fmtT(p.amount) + ' ' + p.cur + ') اطمینان دارید؟\nاین عملیات قابل بازگشت نیست.')) return;
    var newList = list.filter(function (x) { return x.cd !== cd; });
    pSave(newList);
    audit('بستانکاری تامین', 'حذف بدهی/بستانکاری ' + p.sup + ' — شرح: ' + p.item + ' — مبلغ: ' + fmtT(p.amount) + ' ' + p.cur, cd);
    if (typeof ptfToast === 'function') ptfToast('🗑 بدهی/بستانکاری حذف شد', 'warn');
    var md = document.querySelector('#panels .md-b:last-child');
    if (md && (md.style || {}).display !== 'none') md.remove();
    ptfPayablesOpen(newList.some(function (x) { return norm(x.sup) === norm(p.sup); }) ? p.sup : '');
    refreshBox();
  };

  window.ptfPayablePay = function (cd) {
    var p = pAll().filter(function (x) { return x.cd === cd; })[0];
    if (!p) return;
    var rem = ptfPayableRemain(p);
    ptfDialog({
      title: '💰 ثبت پرداخت به ' + p.sup,
      body: 'مانده فعلی: <b>' + fmtT(rem) + (p.cur !== 'IRR' ? ' ' + p.cur : ' ریال') + '</b> — میزان پرداختی این مرحله را ثبت کنید.',
      fields: [
        { id: 'amt', label: 'مبلغ پرداختی' + (p.cur !== 'IRR' ? ' (' + p.cur + ')' : ' (ریال)'), type: 'number', value: rem, dir: 'ltr', required: true },
        { id: 'note', label: 'شرح (چک/حواله/کارت...)', type: 'text' }
      ],
      okText: 'ثبت پرداخت',
      onOk: function (v) {
        var amt = +v.amt || 0;
        if (amt <= 0) { alert('مبلغ نامعتبر'); return; }
        var list = pAll();
        var p2 = list.filter(function (x) { return x.cd === cd; })[0];
        if (!p2) return;
        p2.paid = p2.paid || [];
        p2.paid.push({ amt: amt, t: faDate(), by: curSession().name, note: v.note || '' });
        p2.settled = ptfPayableRemain(p2) <= 0;
        pSave(list);
        audit('بستانکاری تامین', 'پرداخت ' + fmtT(amt) + (p2.cur !== 'IRR' ? ' ' + p2.cur : ' ریال') + ' به ' + p2.sup + (p2.settled ? ' — تسویه کامل ✅' : ' — مانده: ' + fmtT(ptfPayableRemain(p2))), cd);
        if (typeof ptfToast === 'function') ptfToast(p2.settled ? '✅ بستانکاری ' + p2.sup + ' تسویه کامل شد' : '💰 پرداخت ثبت شد — مانده: ' + fmtT(ptfPayableRemain(p2)), 'ok');
        var md = document.querySelector('#panels .md-b:last-child');
        if (md && (md.style || {}).display !== 'none') md.remove();
        ptfPayablesOpen(p2.sup);
        refreshBox();
        if (typeof window.slRefreshSupplierPanel === 'function') window.slRefreshSupplierPanel();
      }
    });
  };

  window.ptfPayableDlv = function (cd, v) {
    var list = pAll();
    var p = list.filter(function (x) { return x.cd === cd; })[0];
    if (!p) return;
    p.dlv = v;
    p.dlvISO = (function(){ try { return new Date().toISOString().slice(0, 10); } catch (e) { return ''; } })();
    p.dlvLate = !!(p.dueISO && p.dlvISO && p.dlvISO > p.dueISO);
    p.dlvBy = curSession().name;
    p.dlvAt = faDateTime();
    pSave(list);
    audit('بستانکاری تامین', 'رویداد تحویل ' + (v === 'ok' ? 'بدون مشکل' : 'با مشکل') + (p.dlvLate ? ' / با تاخیر نسبت به تعهد ' + p.dueISO : '') + ' — ' + p.sup + ' (' + p.item + ')', cd);
    /* v17.3 (US-413 — کیس R8): همه اقلام خریداری‌شده این درخواست تحویل ok → پیشنهاد گذار «📦 تحویل تامین‌کننده» با تایید کاربر */
    try {
      if (v === 'ok' && p.inqNo && typeof ptfRfqSetStatus === 'function' && (window.PTF_RFQ_STATUSES || []).some(function (s) { return s.v === 'st9'; })) {
        var cmp = getData('ptf_crm_buycmp').filter(function (c) { return c.inqNo === p.inqNo; })[0];
        var pays = pAll().filter(function (x) { return x.inqNo === p.inqNo; });
        var allBought = cmp && (cmp.items || []).length > 0 && (cmp.items || []).every(function (it2, ix) { return (cmp.purchases || []).some(function (pu) { return pu.idx === ix; }); });
        var allDlv = pays.length > 0 && pays.every(function (x2) { return x2.dlv === 'ok'; });
        if (allBought && allDlv) {
          var rfqRec = getData('ptf_crm_rfqs').filter(function (r) { return r.cd === p.inqNo || r.inqNo === p.inqNo; })[0];
          if (rfqRec && ['st9', 'st6', 'st7', 'stX'].indexOf(rfqRec.st) < 0) {
            if (confirm('📦 همه اقلام خرید این درخواست (' + p.inqNo + ') توسط تامین‌کننده تحویل شده‌اند.\n\nوضعیت درخواست به «تحویل تامین‌کننده» تغییر کند؟')) {
              ptfRfqSetStatus(rfqRec.cd, 'st9', '📦 تحویل تامین‌کننده');
              if (typeof ptfToast === 'function') ptfToast('📦 وضعیت درخواست: تحویل تامین‌کننده', 'ok');
            }
          }
        }
      }
    } catch (e) {}
    if (typeof ptfToast === 'function') ptfToast('رویداد تحویل ثبت شد' + (p.dlvLate ? ' — با تاخیر نسبت به تعهد' : ''), v === 'ok' && !p.dlvLate ? 'ok' : 'warn');
    ptfPayablesOpen();
  };

  /* ===================================================================
     بخش ۲ — موتور امتیاز تامین‌کننده (US-400) — ۶ معیار مصوب + ضریب اعتباردهی
     خروجی: {score, level, lb, icon, parts[], adj, dataOk, creditBonus}
     =================================================================== */
  window.ptfSupplierScore = function (s) {
    var W = weights().sup;
    var parts = [], earned = 0, avail = 0, signals = 0;

    /* ۱) پاسخگویی به استعلام (rfqsmart targets) */
    var asked = 0, responded = 0;
    getData('ptf_crm_rfqsmart').forEach(function (r) {
      (r.targets || []).forEach(function (t) {
        if (t.cd === s.cd || norm(t.co) === norm(s.co)) {
          asked++;
          if (t.st === 'replied' || t.st === 'declined') responded++;
        }
      });
    });
    if (asked > 0) {
      signals++;
      var v1 = (responded / asked) * W.resp;
      earned += v1; avail += W.resp;
      parts.push({ k: 'پاسخگویی استعلام', v: Math.round(v1), max: W.resp, tx: responded + ' از ' + asked });
    }

    /* ۲) رقابتی بودن قیمت (جایگاه در جداول مقایسه) */
    var rankSum = 0, rankN = 0;
    getData('ptf_crm_buycmp').forEach(function (c) {
      (c.items || []).forEach(function (it, idx) {
        var last = {};
        (c.quotes || []).forEach(function (q) {
          if (q.idx !== idx) return;
          if (!last[q.sup] || q.round >= last[q.sup].round) last[q.sup] = q;
        });
        var supsK = Object.keys(last);
        if (supsK.length < 2) return;
        var mine = supsK.filter(function (k) { return norm(k) === norm(s.co); })[0];
        if (!mine) return;
        var prices = supsK.map(function (k) { return +last[k].price; }).sort(function (a, b) { return a - b; });
        var pos = prices.indexOf(+last[mine].price);
        rankSum += 1 - pos / (prices.length - 1);
        rankN++;
      });
    });
    if (rankN > 0) {
      signals++;
      var v2 = (rankSum / rankN) * W.price;
      earned += v2; avail += W.price;
      parts.push({ k: 'رقابتی بودن قیمت', v: Math.round(v2), max: W.price, tx: 'میانگین جایگاه در ' + rankN + ' قلم' });
    }

    /* ۳) سابقه خرید موفق (purchases خرید واقعی) */
    var buys = 0;
    getData('ptf_crm_buycmp').forEach(function (c) {
      (c.purchases || []).forEach(function (p) { if (norm(p.sup) === norm(s.co)) buys++; });
    });
    if (buys > 0) {
      signals++;
      var v3 = Math.min(1, buys / 5) * W.hist;
      earned += v3; avail += W.hist;
      parts.push({ k: 'سابقه خرید موفق', v: Math.round(v3), max: W.hist, tx: buys + ' خرید قطعی' });
    }

    /* ۴) تخصص و پوشش کالایی (US-399) — همیشه قابل محاسبه */
    var nBr = (s.spBrands || []).length, nEq = (s.spEquip || []).length;
    var v4 = (Math.min(nBr, 5) / 5 * 0.6 + Math.min(nEq, 5) / 5 * 0.4) * W.spec;
    earned += v4; avail += W.spec;
    parts.push({ k: 'تخصص کالایی', v: Math.round(v4), max: W.spec, tx: nBr + ' برند / ' + nEq + ' تجهیز' });

    /* ۵) کیفیت تحویل (تعهد تحویل تامین‌کننده + رویداد واقعی payables) */
    var dOk = 0, dBad = 0, dLate = 0, dDue = 0;
    pAll().forEach(function (p) {
      if (norm(p.sup) !== norm(s.co)) return;
      if (p.dueISO) dDue++;
      if (p.dlv === 'ok') { dOk++; if (p.dlvLate) dLate++; }
      else if (p.dlv === 'issue') dBad++;
    });
    if (dOk + dBad > 0) {
      signals++;
      var quality = Math.max(0, dOk - dLate * 0.5) / (dOk + dBad);
      var v5 = quality * W.dlv;
      earned += v5; avail += W.dlv;
      parts.push({ k: 'کیفیت تحویل', v: Math.round(v5), max: W.dlv, tx: dOk + ' بدون مشکل / ' + dBad + ' با مشکل / ' + dLate + ' با تاخیر از ' + dDue + ' تعهد ثبت‌شده' });
    }

    /* ۶) اعتبار و شفافیت ثبتی — همیشه قابل محاسبه */
    var reg = 0;
    if (s.natId || s.melli) reg += 0.35;
    if (s.ph || (s.coTels || []).length || (s.people || []).length) reg += 0.35;
    if (s.coWeb || s.email) reg += 0.15;
    if (s.approvedBy || s.origin) reg += 0.15;
    var v6 = reg * W.reg;
    earned += v6; avail += W.reg;
    parts.push({ k: 'اعتبار ثبتی', v: Math.round(v6), max: W.reg, tx: Math.round(reg * 100) + '٪ تکمیل' });

    /* ضریب اعتباردهی (ابلاغ تکمیلی): بدهی غیرنقدی = امتیاز بالاتر */
    var crCnt = 0, crOpen = 0;
    pAll().forEach(function (p) {
      if (norm(p.sup) !== norm(s.co) || p.pay !== 'credit') return;
      crCnt++;
      crOpen += remainIrr(p).irr;
    });
    var creditBonus = Math.min(15, crCnt * 3 + (crOpen > 0 ? 3 : 0));
    if (creditBonus) parts.push({ k: 'ضریب اعتباردهی (خرید غیرنقدی)', v: creditBonus, max: 15, tx: crCnt + ' خرید اعتباری' + (crOpen > 0 ? ' — بدهی باز ' + fmtT(Math.round(crOpen)) + ' ریال' : '') });

    var dataOk = signals >= 1; /* حداقل یک سیگنال تراکنشی */
    var base = avail > 0 ? (earned / avail) * 100 : 0;
    var a = adjOf('sup', s.cd);
    var score = Math.max(0, Math.min(100, Math.round(base + creditBonus + (a ? +a.adj : 0))));
    var lv = !dataOk ? { icon: '⬜', lb: 'داده ناکافی' }
      : score >= 80 ? { icon: '🥇', lb: 'ممتاز' }
      : score >= 60 ? { icon: '🥈', lb: 'تاییدشده' }
      : score >= 40 ? { icon: '🥉', lb: 'قابل استفاده' }
      : { icon: '⚠️', lb: 'نیازمند ارزیابی' };
    return { score: score, icon: lv.icon, lb: lv.lb, parts: parts, adj: a, dataOk: dataOk, creditBonus: creditBonus };
  };

  /* ===================================================================
     بخش ۳ — موتور امتیاز مشتری (US-401) — ۵ معیار مصوب
     =================================================================== */
  window.ptfCustomerScore = function (c) {
    var W = weights().cust;
    var parts = [], earned = 0, avail = 0, signals = 0;
    var offers = getData('ptf_crm_offers');
    var invs = getData('ptf_crm_invoices');
    var myCOs = {};
    offers.forEach(function (o) {
      if ((o.buyerCd === c.cd || norm(o.buyerCo) === norm(c.co) || (c.coEn && norm(o.buyerCo) === norm(c.coEn))) && (o.kind === 'CO' || o.kind === 'TC')) myCOs[o.no] = o;
    });

    /* ۱) خوش‌حسابی — نسبت وصول فاکتورها */
    var invAmt = 0, invPaid = 0, invN = 0;
    invs.forEach(function (inv) {
      if (!myCOs[inv.offerNo]) return;
      invN++;
      invAmt += (+inv.amount || 0);
      invPaid += (window.PTF && PTF.invPaidSum) ? PTF.invPaidSum(inv) : ((inv.payments || []).concat(inv.pays || [])).reduce(function (s, p) { return s + (+p.amt || 0); }, 0);
    });
    if (invN > 0 && invAmt > 0) {
      signals++;
      var payRatio = Math.min(1, invPaid / invAmt);
      var v1 = payRatio * W.pay;
      earned += v1; avail += W.pay;
      parts.push({ k: 'خوش‌حسابی', v: Math.round(v1), max: W.pay, tx: Math.round(payRatio * 100) + '٪ وصول از ' + invN + ' فاکتور', ratio: payRatio });
    }

    /* ۲) حجم خرید — CO برنده (نرمال لگاریتمی نسبت به بزرگ‌ترین مشتری) */
    function wonSum(custKeyCd, custKeyCo) {
      var t = 0;
      offers.forEach(function (o) {
        if (o.st !== 'won' || (o.kind !== 'CO' && o.kind !== 'TC')) return;
        if (o.buyerCd === custKeyCd || norm(o.buyerCo) === norm(custKeyCo)) {
          t += (o.items || []).reduce(function (s, it) { return s + (+it.qty || 0) * (+it.price || 0); }, 0);
        }
      });
      return t;
    }
    var mySum = wonSum(c.cd, c.co);
    if (mySum > 0) {
      signals++;
      var maxSum = mySum;
      getData('ptf_crm_customers').forEach(function (c2) {
        var t2 = wonSum(c2.cd, c2.co);
        if (t2 > maxSum) maxSum = t2;
      });
      var v2 = (Math.log10(1 + mySum) / Math.log10(1 + maxSum)) * W.vol;
      earned += v2; avail += W.vol;
      parts.push({ k: 'حجم خرید', v: Math.round(v2), max: W.vol, tx: fmtT(Math.round(mySum)) + ' ت خرید برنده' });
    }

    /* ۳) نرخ تبدیل درخواست→برد */
    var myRfqs = getData('ptf_crm_rfqs').filter(function (r) { return norm(r.co) === norm(c.co) || (c.coEn && norm(r.co) === norm(c.coEn)); }).length;
    var myWins = Object.keys(myCOs).filter(function (no) { return myCOs[no].st === 'won'; }).length;
    if (myRfqs > 0) {
      signals++;
      var v3 = Math.min(1, myWins / myRfqs) * W.conv;
      earned += v3; avail += W.conv;
      parts.push({ k: 'نرخ تبدیل', v: Math.round(v3), max: W.conv, tx: myWins + ' برد از ' + myRfqs + ' درخواست' });
    }

    /* ۴) تداوم و وفاداری — تعداد بردها + تازگی فعالیت */
    if (myWins > 0) {
      signals++;
      var lastEn = '';
      Object.keys(myCOs).forEach(function (no) { if ((myCOs[no].dateEn || '') > lastEn) lastEn = myCOs[no].dateEn || ''; });
      var stale = false;
      try { stale = lastEn && (Date.now() - new Date(lastEn).getTime()) > 365 * 86400000; } catch (e) {}
      var v4 = Math.min(1, myWins / 4) * (stale ? 0.5 : 1) * W.loyal;
      earned += v4; avail += W.loyal;
      parts.push({ k: 'وفاداری', v: Math.round(v4), max: W.loyal, tx: myWins + ' معامله' + (stale ? ' — راکد >۱۲ ماه' : '') });
    }

    /* ۵) کیفیت تعامل — تکمیل پروفایل (همیشه قابل محاسبه) */
    var q = 0;
    if ((c.people || []).length || c.ph) q += 0.4;
    if (c.ind) q += 0.2;
    if (c.natId || c.melli) q += 0.2;
    if ((c.people || []).length > 1) q += 0.2;
    var v5 = q * W.inter;
    earned += v5; avail += W.inter;
    parts.push({ k: 'کیفیت تعامل', v: Math.round(v5), max: W.inter, tx: Math.round(q * 100) + '٪ تکمیل پروفایل' });

    var dataOk = signals >= 1;
    var base = avail > 0 ? (earned / avail) * 100 : 0;
    var a = adjOf('cust', c.cd);
    var score = Math.max(0, Math.min(100, Math.round(base + (a ? +a.adj : 0))));
    var lv = !dataOk ? { icon: '⚪', lb: 'راکد/جدید' }
      : score >= 80 ? { icon: '💎', lb: 'کلیدی' }
      : score >= 60 ? { icon: '🌟', lb: 'ارزشمند' }
      : score >= 40 ? { icon: '🔵', lb: 'عادی' }
      : { icon: '⚪', lb: 'راکد/جدید' };
    var payPart = parts.filter(function (p) { return p.k === 'خوش‌حسابی'; })[0];
    return { score: score, icon: lv.icon, lb: lv.lb, parts: parts, adj: a, dataOk: dataOk, payRatio: payPart ? payPart.ratio : null };
  };

  /* ---------- تعدیل دستی ±۱۵ (فقط ارشد، با دلیل + audit) ---------- */
  window.ptfScoreAdjust = function (kind, cd, label) {
    if (!isSenior()) { alert('⛔ تعدیل دستی فقط توسط مدیران ارشد'); return; }
    var cur = adjOf(kind, cd);
    ptfDialog({
      title: '⚖️ تعدیل دستی امتیاز — ' + label,
      body: 'حداکثر ±۱۵ امتیاز (سند مصوب) — با دلیل و ثبت در audit. مقدار فعلی: ' + (cur ? cur.adj : 0),
      fields: [
        { id: 'adj', label: 'تعدیل (مثبت یا منفی، حداکثر ۱۵)', type: 'text', value: cur ? cur.adj : 0, dir: 'ltr', required: true, placeholder: 'مثلا 15 یا -10' },
        { id: 'why', label: 'دلیل *', type: 'text', value: cur ? cur.why : '', required: true }
      ],
      okText: 'ثبت تعدیل',
      onOk: function (v) {
        /* v20.7 BUG-034: فیلد تعدیل نباید data-money/formatter بگیرد؛ عدد «15» در برخی موبایل‌ها با caret معکوس «51» می‌شد. */
        var rawAdj = String(v.adj || '').replace(/[۰-۹]/g, function(d){return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d);}).replace(/[٠-٩]/g, function(d){return '٠١٢٣٤٥٦٧٨٩'.indexOf(d);}).replace(/[^\d.-]/g, '');
        var adj = Math.max(-15, Math.min(15, +rawAdj || 0));
        var st = {};
        try { st = JSON.parse(localStorage.getItem('ptf_crm_settings') || '{}'); } catch (e) {}
        st.scoreAdj = st.scoreAdj || {};
        st.scoreAdj[kind] = st.scoreAdj[kind] || {};
        if (adj === 0) delete st.scoreAdj[kind][cd];
        else st.scoreAdj[kind][cd] = { adj: adj, why: v.why, by: curSession().name, t: faDateTime() };
        setData('ptf_crm_settings', st);
        audit('امتیازدهی', 'تعدیل دستی ' + (kind === 'sup' ? 'تامین‌کننده' : 'مشتری') + ' ' + label + ': ' + (adj > 0 ? '+' : '') + adj + ' — ' + v.why, cd);
        if (typeof ptfToast === 'function') ptfToast('⚖️ تعدیل ثبت شد', 'ok');
        if (typeof renderSuppliers === 'function' && kind === 'sup') renderSuppliers();
        if (typeof renderCustomers === 'function' && kind === 'cust') renderCustomers();
      }
    });
  };

  /* ---------- کارت جزئیات امتیاز ---------- */
  window.ptfScoreCard = function (kind, cd) {
    var key = kind === 'sup' ? 'ptf_crm_suppliers' : 'ptf_crm_customers';
    var rec = getData(key).filter(function (x) { return x.cd === cd; })[0];
    if (!rec) return;
    var r = kind === 'sup' ? ptfSupplierScore(rec) : ptfCustomerScore(rec);
    var rows = r.parts.map(function (p) {
      var pct = p.max ? Math.round(p.v / p.max * 100) : 0;
      return '<div style="margin-bottom:7px"><div style="display:flex;justify-content:space-between;font-size:12px"><span>' + escP(p.k) + ' <small style="color:#94a3b8">(' + escP(p.tx) + ')</small></span><b>' + p.v + '/' + p.max + '</b></div>' +
        '<div style="background:#f1f5f9;border-radius:99px;height:7px"><div style="width:' + Math.min(100, pct) + '%;height:7px;border-radius:99px;background:linear-gradient(90deg,var(--pri,#ef4b1a),var(--org,#f79400))"></div></div></div>';
    }).join('');
    var html = '<div class="md-b" style="display:grid;z-index:2300" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:520px;max-height:90vh;overflow:auto">' +
      '<h3>' + r.icon + ' امتیاز ' + (kind === 'sup' ? 'تامین‌کننده' : 'مشتری') + ' — ' + escP(rec.co) + '</h3>' +
      '<div style="text-align:center;margin:8px 0 14px"><span style="font-size:34px;font-weight:900;color:var(--pri,#ef4b1a)">' + (r.dataOk ? r.score : '—') + '</span><span style="color:#94a3b8"> /۱۰۰</span><br><b>' + r.icon + ' ' + r.lb + '</b>' +
      (r.adj ? '<div style="font-size:11px;color:#7c3aed;margin-top:3px">⚖️ تعدیل‌شده: ' + (r.adj.adj > 0 ? '+' : '') + r.adj.adj + ' (' + escP(r.adj.why) + ' — ' + escP(r.adj.by) + ')</div>' : '') +
      (!r.dataOk ? '<div style="font-size:11px;color:#94a3b8;margin-top:3px">داده تراکنشی ناکافی — امتیاز پس از اولین تعاملات ساخته می‌شود</div>' : '') + '</div>' +
      rows +
      '<div style="display:flex;gap:8px;justify-content:space-between;margin-top:12px">' +
      (isSenior() ? '<button class="bt bt-o" style="font-size:12px;color:#7c3aed" onclick="this.closest(\'.md-b\').remove();ptfScoreAdjust(\'' + kind + '\',\'' + escP(cd) + '\',\'' + escP(rec.co) + '\')">⚖️ تعدیل دستی</button>' : '<span></span>') +
      '<button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };

  /* ---------- بج در فهرست‌ها (پس-پردازش — الگوی supspec) ---------- */
  function badgeHtml(kind, rec) {
    var r = kind === 'sup' ? ptfSupplierScore(rec) : ptfCustomerScore(rec);
    return ' <span class="bd" style="background:#f8fafc;border:1px solid var(--brd);cursor:pointer;font-size:10.5px" title="' + r.lb + (r.dataOk ? ' — ' + r.score + '/۱۰۰' : '') + ' — کلیک: جزئیات" onclick="event.stopPropagation();ptfScoreCard(\'' + kind + '\',\'' + escP(rec.cd) + '\')">' + r.icon + ' ' + (r.dataOk ? r.score : '—') + (r.adj ? '⚖️' : '') + '</span>';
  }
  function decorateSup() {
    if (!canSeeSup()) return;
    var tb = document.getElementById('sTb');
    if (!tb) return;
    var items = getData('ptf_crm_suppliers');
    var byCd = {};
    items.forEach(function (s) { byCd[s.cd] = s; });
    tb.querySelectorAll('tr').forEach(function (tr) {
      if (tr.getAttribute('data-scdec')) return;
      var strong = tr.querySelector('td strong');
      if (!strong) return;
      var s = byCd[strong.textContent.trim()];
      if (!s) return;
      tr.setAttribute('data-scdec', '1');
      strong.insertAdjacentHTML('afterend', badgeHtml('sup', s));
    });
  }
  function decorateCust() {
    if (!canSeeCust()) return;
    var tb = document.getElementById('cTb');
    if (!tb) return;
    var items = getData('ptf_crm_customers');
    var byCd = {};
    items.forEach(function (c) { byCd[c.cd] = c; });
    tb.querySelectorAll('tr').forEach(function (tr) {
      if (tr.getAttribute('data-scdec')) return;
      var strong = tr.querySelector('td strong');
      if (!strong) return;
      var c = byCd[strong.textContent.trim()];
      if (!c) return;
      tr.setAttribute('data-scdec', '1');
      strong.insertAdjacentHTML('afterend', badgeHtml('cust', c));
    });
  }

  /* ---------- هشدار بدحسابی هنگام صدور CO (پاسخ ③ کارفرما: نمایش داده شود) ---------- */
  function hookCreditBox() {
    if (window._scCreditHooked || typeof window.ptfRenderCreditBox !== 'function') return false;
    window._scCreditHooked = true;
    var _cb = window.ptfRenderCreditBox;
    window.ptfRenderCreditBox = function (custCd) {
      _cb(custCd);
      try {
        if (!custCd || !canSeeCust()) return;
        var box = document.getElementById('ofCreditBox');
        if (!box || !box.innerHTML) return;
        var c = getData('ptf_crm_customers').filter(function (x) { return x.cd === custCd; })[0];
        if (!c) return;
        var r = ptfCustomerScore(c);
        if (r.dataOk && r.payRatio !== null && r.payRatio < 0.6) {
          box.insertAdjacentHTML('beforeend',
            '<div data-noix style="font-size:12px;border-radius:10px;padding:8px 12px;margin:0 0 8px;background:#fef2f2;border:1px solid #fecaca;color:#b91c1c">' +
            '⚠️ <b>هشدار سابقه وصول (US-401):</b> این مشتری فقط ' + Math.round(r.payRatio * 100) + '٪ فاکتورهایش را وصول کرده (' + r.icon + ' امتیاز ' + r.score + ') — پیشنهاد: شرایط پرداخت سفت‌تر (پیش‌پرداخت بیشتر / اعتبار کمتر).</div>');
        }
      } catch (e) {}
    };
    return true;
  }

  /* ---------- گزارش درخواستی مدیر (پاسخ ⑤: همیشه فعال نیست — فقط با درخواست) ---------- */
  window.ptfScoreReport = function () {
    if (!isSenior() && !canSeeSup()) { alert('⛔ دسترسی ندارید'); return; }
    var sups = getData('ptf_crm_suppliers').map(function (s) { return { rec: s, r: ptfSupplierScore(s) }; })
      .sort(function (a, b) { return b.r.score - a.r.score; });
    var custs = canSeeCust() ? getData('ptf_crm_customers').map(function (c) { return { rec: c, r: ptfCustomerScore(c) }; })
      .sort(function (a, b) { return b.r.score - a.r.score; }) : [];
    var debts = ptfSupplierDebts();
    function tbl(list) {
      return list.map(function (x) {
        return '<tr><td>' + x.r.icon + '</td><td style="text-align:right">' + escP(x.rec.co) + '</td><td><b>' + (x.r.dataOk ? x.r.score : '—') + '</b>' + (x.r.adj ? ' ⚖️' : '') + '</td><td style="font-size:11px">' + x.r.lb + '</td>' +
          '<td style="font-size:10.5px;text-align:right">' + x.r.parts.map(function (p) { return p.k + ' ' + p.v + '/' + p.max; }).join(' | ') + '</td></tr>';
      }).join('');
    }
    var debtRows = debts.map(function (d) {
      var fxTx = Object.keys(d.fx).map(function (cu) { return fmtT(d.fx[cu]) + ' ' + cu + ' (بی‌نرخ)'; }).join(' + ');
      return '<tr><td style="text-align:right"><b>' + escP(d.sup) + '</b></td><td>' + d.cnt + '</td><td><b>' + fmtT(Math.round(d.irr)) + ' ریال</b>' + (fxTx ? ' + ' + fxTx : '') + '</td></tr>';
    }).join('');
    var html = '<div class="md-b" style="display:grid;z-index:2400" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:900px;max-height:94vh;overflow:auto">' +
      '<h3>📄 گزارش درخواستی امتیازها و بدهی‌ها — ' + faDate() + '</h3>' +
      '<div style="font-size:11px;color:#94a3b8;margin-bottom:10px">این گزارش فقط با درخواست مدیر ساخته می‌شود (مصوبه ⑤) — امتیازها لحظه‌ای از داده‌های جاری محاسبه شدند.</div>' +
      '<h4 style="margin:8px 0 6px">💳 بدهی غیرنقدی باز به تامین‌کنندگان</h4>' +
      '<div class="tb2"><table><thead><tr><th>تامین‌کننده</th><th>اقلام باز</th><th>مانده بدهی</th></tr></thead><tbody>' + (debtRows || '<tr><td colspan="3" style="text-align:center;color:#94a3b8">بدهی بازی نیست ✅</td></tr>') + '</tbody></table></div>' +
      '<h4 style="margin:14px 0 6px">🏭 امتیاز تامین‌کنندگان (' + sups.length + ')</h4>' +
      '<div class="tb2"><table><thead><tr><th></th><th>نام</th><th>امتیاز</th><th>سطح</th><th>ریز معیارها</th></tr></thead><tbody>' + (tbl(sups) || '') + '</tbody></table></div>' +
      (canSeeCust() ? '<h4 style="margin:14px 0 6px">🤝 امتیاز مشتریان (' + custs.length + ')</h4>' +
        '<div class="tb2"><table><thead><tr><th></th><th>نام</th><th>امتیاز</th><th>سطح</th><th>ریز معیارها</th></tr></thead><tbody>' + (tbl(custs) || '') + '</tbody></table></div>' : '') +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px">' +
      '<button class="bt bt-o" onclick="ptfPrintWithTitle(\'SCORE\')">🖨 چاپ</button>' +
      '<button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
    if (typeof audit === 'function') audit('امتیازدهی', 'ساخت گزارش درخواستی امتیازها/بدهی‌ها', '');
  };

  /* ---------- بونوس امتیاز وندور در تامین‌یاب (اتصال به US-399) ---------- */
  window.ptfSupScoreBonus = function (s) {
    try {
      var r = ptfSupplierScore(s);
      if (!r.dataOk) return { bonus: 0, why: '' };
      var b = r.score >= 80 ? 10 : r.score >= 60 ? 5 : 0;
      b += Math.round(r.creditBonus / 3); /* اعتباردهنده غیرنقدی = ضریب بالاتر (ابلاغ کارفرما) */
      return b > 0 ? { bonus: b, why: r.icon + ' امتیاز وندور ' + r.score } : { bonus: 0, why: '' };
    } catch (e) { return { bonus: 0, why: '' }; }
  };

  /* ---------- بخش تنظیمات: وزن‌ها (نمایش همه؛ ویرایش فقط ارشد + audit) ---------- */
  function hookSettings() {
    if (window._scSetHooked || typeof window.buildSettings !== 'function') return false;
    window._scSetHooked = true;
    var _bs = window.buildSettings;
    window.buildSettings = function () {
      var W = weights();
      var labels = { resp: 'پاسخگویی استعلام', price: 'رقابتی بودن قیمت', hist: 'سابقه خرید', spec: 'تخصص کالایی', dlv: 'کیفیت تحویل', reg: 'اعتبار ثبتی', pay: 'خوش‌حسابی', vol: 'حجم خرید', conv: 'نرخ تبدیل', loyal: 'وفاداری', inter: 'کیفیت تعامل' };
      function row(kind, W2) {
        return Object.keys(W2).map(function (k) {
          return '<tr><td style="text-align:right">' + labels[k] + '</td><td>' +
            (isSenior() ? '<input type="number" id="scW_' + kind + '_' + k + '" value="' + W2[k] + '" min="0" max="50" style="width:60px;padding:4px;border:1px solid var(--brd);border-radius:7px;direction:ltr">' : '<b>' + W2[k] + '</b>') + '</td></tr>';
        }).join('');
      }
      return _bs() + '<div style="max-width:560px"><hr style="border:none;border-top:1px solid var(--brd);margin:16px 0">' +
        '<h4 style="margin:0 0 8px">📊 نظام امتیازدهی (US-400/401 — مصوب کارفرما)</h4>' +
        '<div style="font-size:11.5px;color:#64748b;margin-bottom:8px">وزن‌ها برای همه قابل مشاهده است؛ تغییر فقط توسط مدیران ارشد و با ثبت در audit.</div>' +
        '<div style="display:flex;gap:14px;flex-wrap:wrap">' +
        '<div><b style="font-size:12.5px">🏭 تامین‌کننده</b><table style="font-size:12px;border-collapse:collapse">' + row('sup', W.sup) + '</table></div>' +
        '<div><b style="font-size:12.5px">🤝 مشتری</b><table style="font-size:12px;border-collapse:collapse">' + row('cust', W.cust) + '</table></div></div>' +
        (isSenior() ? '<button class="bt bt-o" style="margin-top:8px;font-size:12px" onclick="ptfScoreWeightsSave()">💾 ذخیره وزن‌ها (audit)</button> ' : '') +
        '<button class="bt bt-o" style="margin-top:8px;font-size:12px;color:#7c3aed" onclick="ptfScoreReport()">📄 گزارش درخواستی امتیازها</button></div>';
    };
    return true;
  }

  window.ptfScoreWeightsSave = function () {
    if (!isSenior()) { alert('⛔ فقط مدیران ارشد'); return; }
    var st = {};
    try { st = JSON.parse(localStorage.getItem('ptf_crm_settings') || '{}'); } catch (e) {}
    st.scoreWeights = { sup: {}, cust: {} };
    ['resp', 'price', 'hist', 'spec', 'dlv', 'reg'].forEach(function (k) {
      var el = document.getElementById('scW_sup_' + k);
      if (el) st.scoreWeights.sup[k] = Math.max(0, Math.min(50, +el.value || DEF_W.sup[k]));
    });
    ['pay', 'vol', 'conv', 'loyal', 'inter'].forEach(function (k) {
      var el = document.getElementById('scW_cust_' + k);
      if (el) st.scoreWeights.cust[k] = Math.max(0, Math.min(50, +el.value || DEF_W.cust[k]));
    });
    setData('ptf_crm_settings', st);
    audit('امتیازدهی', 'تغییر وزن‌های نظام امتیازدهی توسط ' + curSession().name + ': sup=' + JSON.stringify(st.scoreWeights.sup) + ' cust=' + JSON.stringify(st.scoreWeights.cust), '');
    if (typeof ptfToast === 'function') ptfToast('💾 وزن‌ها ذخیره شد (در audit ثبت شد)', 'ok');
  };

  /* ---------- بوت: hook روی build/render تامین‌کنندگان و مشتریان ---------- */
  function hookPanels() {
    if (window._scPanelsHooked || typeof window.buildSuppliers !== 'function' || typeof window.renderSuppliers !== 'function') return false;
    window._scPanelsHooked = true;
    var _bSup = window.buildSuppliers;
    window.buildSuppliers = function () { return payablesBoxHtml() + _bSup(); };
    var _rSup = window.renderSuppliers;
    window.renderSuppliers = function () { _rSup(); try { decorateSup(); } catch (e) {} };
    if (typeof window.renderCustomers === 'function') {
      var _rC = window.renderCustomers;
      window.renderCustomers = function () { _rC(); try { decorateCust(); } catch (e) {} };
    }
    if (typeof window.renderCustomers2 === 'function') {
      var _rC2 = window.renderCustomers2;
      window.renderCustomers2 = function () { _rC2(); try { decorateCust(); } catch (e) {} };
    }
    return true;
  }

  var tries = 0;
  var t = setInterval(function () {
    tries++;
    var a = hookPanels();
    var b = hookSettings();
    var c = hookCreditBox();
    if ((a || window._scPanelsHooked) && (b || window._scSetHooked) && (c || window._scCreditHooked)) clearInterval(t);
    if (tries > 60) clearInterval(t);
  }, 300);
})();
