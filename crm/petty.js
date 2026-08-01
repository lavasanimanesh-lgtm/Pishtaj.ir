/* =====================================================================
   PTF CRM — v17.8
   US-171: تنخواه گردان — ثبت هزینه توسط همه، دید مدیریتی + تسویه
   US-422: حساب تنخواه کامل — موجودی/شارژ/پرداخت مستقیم/تسویه/گزارش دوره/ارجاع حسابدار
   US-170 AC2: پیش‌پرداخت CO برنده → مطالبات
   ===================================================================== */
(function () {
  'use strict';
  var MANAGERS = ['admin', 'chairman', 'ceo', 'commercial']; /* v33.1.0: سهامداران کامل (رییس هیات مدیره، مدیرعامل، مدیر بازرگانی)؛ سایر کاربران فقط ثبت هزینه خود */
  function isMgr() { return MANAGERS.indexOf(curRole()) > -1; }
  function isAccountant() { return curRole() === 'accountant'; }
  function stObj() { var s = getData('ptf_crm_settings'); return (s && !Array.isArray(s) && typeof s === 'object') ? s : {}; }
  function saveSt(s) { setData('ptf_crm_settings', s || {}); }
  function treasurerRole() { return stObj().pettyTreasurerRole || 'chairman'; }
  function isTreasurer() { return curRole() === 'admin' || curRole() === treasurerRole(); }
  function canAll() { return isMgr() || isTreasurer(); }

  function isFiscalLocked(year){
    try{
      var snaps=getData('ptf_crm_fiscal_snapshots')||[];
      return snaps.some(function(s){ return String(s.year)===String(year) && s.locked; });
    }catch(e){ return false; }
  }

  var CATS = ['حمل و نقل', 'پیک', 'تست و بازرسی', 'خرید اداری', 'پذیرایی', 'ماموریت', 'سایر'];
  /* فاز ۲ / گام ۶ (crm/DESIGN-OFFICIAL-UNOFFICIAL-SEPARATION-PHASE2.md):
     طبق تایید کارفرما، تمام دسته‌های تنخواه (شامل «سایر») قابل‌قبول مالیاتی
     محسوب می‌شوند. این ثابت صرفاً برای مستندسازی صریح این قاعده است — همان
     CATS بالا را منعکس می‌کند تا اگر در آینده یک دسته‌ی غیرقابل‌قبول اضافه
     شد، محل تغییرش مشخص باشد. هیچ فیلتری بر اساس این ثابت اعمال نمی‌شود. */
  window.PTF_PETTY_TAX_DEDUCTIBLE_CATS = CATS.slice();
  var PETTY_KEY = 'ptf_crm_petty', TX_KEY = 'ptf_crm_petty_tx', PERIOD_KEY = 'ptf_crm_petty_periods';

  function txAll() { var a = getData(TX_KEY); return Array.isArray(a) ? a : []; }
  function txSave(a) { setData(TX_KEY, a || []); }
  function prAll() { var a = getData(PERIOD_KEY); return Array.isArray(a) ? a : []; }
  function prSave(a) { setData(PERIOD_KEY, a || []); }
  function money(v) { return (+v || 0).toLocaleString('fa-IR') + ' ریال'; }
  function toNum(v) { return +String(v == null ? '' : v).replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }).replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }).replace(/[^\d.-]/g, '') || 0; }
  function isoNow() { try { return new Date().toISOString(); } catch (e) { return ''; } }
  function faMonthNow() { try { var s = new Intl.DateTimeFormat('fa-IR-u-nu-latn', { year: 'numeric', month: '2-digit' }).format(new Date()); return s.replace(/\s/g, '').replace('-', '/'); } catch (e) { return (faDate ? faDate().slice(0, 7) : ''); } }
  function recMonth(x) { return x.month || (x.t || '').slice(0, 7) || faMonthNow(); }
  function userName() { return (curSession() || {}).name || (curSession() || {}).user || ''; }
  function userToUsername(name) { return ((getData('ptf_crm_users') || []).filter(function (u) { return u.name === name; })[0] || {}).username || ''; }
  function accountants() { return (getData('ptf_crm_users') || []).filter(function (u) { return u.roleId === 'accountant'; }); }

  window.ptfPettyBalance = function () {
    return txAll().reduce(function (s, x) {
      var a = +x.amt || 0;
      if (x.type === 'charge') return s + a;
      if (x.type === 'direct' || x.type === 'settle') return s - a;
      return s;
    }, 0);
  };
  window.ptfPettyPendingByUser = function () {
    var per = {};
    (getData(PETTY_KEY) || []).forEach(function (x) {
      /* فاز ۲ / گام ۸: رکورد ابطال‌شده (st==='void') نباید به‌عنوان مطالبه‌ی
         معلق حساب شود — قبلاً فقط st!=='settled' چک می‌شد که 'void' را هم
         اشتباهاً «معلق» می‌شمرد. */
      if (x.st !== 'settled' && x.st !== 'void') per[x.by] = (per[x.by] || 0) + (+x.amt || 0);
    });
    return per;
  };
  function addTx(type, amt, desc, ref, extra) {
    var r = Object.assign({ cd: genCode('PTX'), type: type, amt: +amt || 0, desc: desc || '', ref: ref || '', by: userName(), t: faDateTime(), iso: isoNow(), month: faMonthNow() }, extra || {});
    var a = txAll(); a.unshift(r); txSave(a); return r;
  }
  function ensureBalance(amt) {
    var bal = window.ptfPettyBalance();
    if (bal < (+amt || 0)) { alert('⛔ موجودی حساب تنخواه کافی نیست. موجودی فعلی: ' + money(bal) + '\nابتدا شارژ حساب تنخواه را ثبت کنید.'); return false; }
    return true;
  }

  window.buildPetty = function () {
    return '<div class="ph"><h3>🏛 هاب مالی</h3>' +
      '<div class="sb2" id="ptToolbar">' + (isMgr() ? '<select id="ptFilter" onchange="renderPetty()" style="padding:8px;border:1px solid var(--brd);border-radius:10px;font-size:13px"><option value="">همه کاربران</option></select>' : '') +
      (typeof window.ptfSortSelectHtml === 'function' ? window.ptfSortSelectHtml('petty', [
        { key: 't', dir: 'desc', lb: '🕒 جدیدترین' }, { key: 't', dir: 'asc', lb: '🕒 قدیمی‌ترین' },
        { key: 'amt', dir: 'desc', lb: '💰 بیشترین مبلغ' }, { key: 'amt', dir: 'asc', lb: '💰 کمترین مبلغ' },
        { key: 'by', dir: 'asc', lb: '👤 ثبت‌کننده' }
      ]) : '') +
      '<button class="bt bt-o" onclick="ptfPettyPeriodReport()" title="گزارش کامل دورهٔ جاری">📊 گزارش دورهٔ جاری</button>' +
      '<button class="bt" onclick="pettyAdd()">+ ثبت هزینه</button>' +
      (isTreasurer() ? '<button class="bt" onclick="pettyDirectPay()" style="background:#0e7490">پرداخت مستقیم</button><button class="bt" onclick="pettyCharge()" style="background:#059669">شارژ حساب</button><button class="bt bt-o" onclick="pettyClosePeriod()">ارجاع دوره</button>' : '') +
      '</div></div>' +
      '<div id="ptAccount" style="margin-bottom:10px"></div><div id="ptPeriods" style="margin-bottom:10px"></div>' +
      '<div id="ptSummary" style="margin-bottom:10px"></div><div id="ptWrap"></div>';
  };

  function renderAccountBox() {
    var el = document.getElementById('ptAccount'); if (!el) return;
    var bal = window.ptfPettyBalance();
    var tx = txAll();
    var charge = tx.reduce(function (s, x) { return s + (x.type === 'charge' ? +x.amt || 0 : 0); }, 0);
    var direct = tx.reduce(function (s, x) { return s + (x.type === 'direct' ? +x.amt || 0 : 0); }, 0);
    var settle = tx.reduce(function (s, x) { return s + (x.type === 'settle' ? +x.amt || 0 : 0); }, 0);
    var pending = Object.keys(window.ptfPettyPendingByUser()).reduce(function (s, k) { return s + window.ptfPettyPendingByUser()[k]; }, 0);
    var roleCtl = '';
    if (curRole() === 'admin' || curRole() === 'chairman') roleCtl = '<button class="bt bt-o" style="padding:5px 10px;font-size:12px" onclick="pettySetTreasurerRole()">تنخواه‌گردان: ' + escP(treasurerRole()) + '</button>';
    el.innerHTML = '<div style="background:linear-gradient(135deg,#ecfdf5,#f0f9ff);border:1px solid #a7f3d0;border-radius:14px;padding:12px 14px">' +
      '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center"><div><b style="font-size:16px;color:#065f46">موجودی ثبت‌شده حساب تنخواه: ' + money(bal) + '</b><br><small style="color:#64748b">شارژ: ' + money(charge) + ' | پرداخت مستقیم: ' + money(direct) + ' | تسویه اشخاص: ' + money(settle) + ' | مطالبات باز: ' + money(pending) + '</small></div>' + roleCtl + '</div></div>';
  }

  function renderPeriods() {
    var el = document.getElementById('ptPeriods'); if (!el) return;
    var periods = prAll().slice(0, 8);
    if (!periods.length && !isTreasurer() && !isAccountant()) { el.innerHTML = ''; return; }
    var rows = periods.map(function (p) {
      var files = (p.files || []).map(function (f) { return '<a href="javascript:void(0)" onclick="openStoredFile(\'' + escP(f.key || '') + '\')">📎' + escP(f.name || 'فایل') + '</a>'; }).join(' ');
      var acts = '<button class="bt bt-o" style="padding:4px 10px;font-size:12px" onclick="ptfPettyPeriodReport(\'' + escP(p.month) + '\')">📊 گزارش دوره</button>';
      if (isAccountant() && p.st === 'referred') acts += '<button class="bt" style="padding:4px 10px;font-size:12px;background:#059669" onclick="pettyPeriodRegistered(\'' + p.cd + '\')">ثبت در حسابداری</button>';
      if (isTreasurer() && p.st === 'referred') acts += '<button class="bt bt-o" style="padding:4px 10px;font-size:12px" onclick="pettyAttachBank(\'' + p.cd + '\')">پیوست صورتحساب</button>';
      var st = p.st === 'registered' ? '<span class="bd b-st4">ثبت‌شده</span>' : '<span class="bd" style="background:#dbeafe;color:#1d4ed8">ارجاع‌شده</span>';
      return '<div style="background:#fff;border:1px solid var(--brd);border-radius:12px;padding:9px 12px;margin-bottom:6px;font-size:12.5px;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><span><b>دوره ' + escP(p.month || '-') + '</b> — ' + st + '<br><small style="color:#64748b">گردش: ' + money(p.totalOut || 0) + ' | مانده: ' + money(p.balance || 0) + ' | ' + escP(p.t || '') + '</small>' + (files ? '<br><small>' + files + '</small>' : '') + '</span><span>' + acts + '</span></div>';
    }).join('');
    el.innerHTML = '<div style="background:#f8fafc;border:1px solid var(--brd);border-radius:14px;padding:10px 12px"><b style="font-size:13px">📚 دوره‌های گزارش تنخواه</b><div style="margin-top:8px">' + (rows || '<small style="color:#94a3b8">دوره‌ای ارجاع نشده</small>') + '</div></div>';
  }

  window.renderPetty = function () {
    renderAccountBox(); renderPeriods();
    var el = document.getElementById('ptWrap');
    if (!el) return;
    var me = curSession();
    var all = getData(PETTY_KEY);
    var sel = document.getElementById('ptFilter');
    if (sel && sel.options.length <= 1) {
      var names = {};
      all.forEach(function (x) { names[x.by] = true; });
      Object.keys(names).forEach(function (n) { sel.insertAdjacentHTML('beforeend', '<option value="' + escP(n) + '">' + escP(n) + '</option>'); });
    }
    var filter = sel ? sel.value : '';
    var list = all.filter(function (x) {
      if (!canAll()) return x.by === me.name;
      return !filter || x.by === filter;
    });
    /* UR-2026-08-01-07: سورت تنخواه (تاریخ/مبلغ/ثبت‌کننده) */
    if (window.ptfRegisterSortable) window.ptfRegisterSortable('petty', {
      getters: { t: function (x) { return x.t || ''; }, amt: function (x) { return +x.amt || 0; }, by: function (x) { return x.by || ''; } },
      render: renderPetty
    });
    list = (typeof window.ptfSorted === 'function') ? window.ptfSorted('petty', list) : list;
    var sm = document.getElementById('ptSummary');
    if (sm) {
      if (isMgr() || isTreasurer()) {
        var per = window.ptfPettyPendingByUser();
        var chips = Object.keys(per).map(function (n) { return '<span style="background:#fff7ed;border:1px solid #fdba74;border-radius:999px;padding:5px 12px;font-size:12px"><b>' + escP(n) + '</b>: ' + money(per[n]) + '</span>'; }).join(' ');
        var tot = Object.keys(per).reduce(function (s, n) { return s + per[n]; }, 0);
        sm.innerHTML = '<div style="background:#fff;border:1px solid var(--brd);border-radius:12px;padding:10px 14px"><b style="font-size:13px">مطالبات تنخواه تسویه‌نشده: ' + money(tot) + '</b><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">' + (chips || '<span style="color:#94a3b8;font-size:12px">موردی نیست</span>') + '</div></div>';
      } else {
        var mine = all.filter(function (x) { return x.by === me.name && x.st !== 'settled' && x.st !== 'void'; }).reduce(function (s, x) { return s + (+x.amt || 0); }, 0);
        sm.innerHTML = '<div style="background:#fff;border:1px solid var(--brd);border-radius:12px;padding:10px 14px;font-size:13px">💰 مطالبات تنخواه شما (در انتظار تسویه): <b>' + money(mine) + '</b></div>';
      }
    }
    el.innerHTML = list.map(function (x) {
      var files = (x.files || []).map(function (f) { return '<a href="javascript:void(0)" onclick="openStoredFile(\'' + escP(f.key || '') + '\')" style="color:#0e7490">📎' + escP(f.name) + '</a>'; }).join(' ');
      var isVoid = x.st === 'void';
      var canEdit = !isVoid && ((x.by === me.name) || canAll());
      var acts = '';
      if (canEdit) {
        acts = '<button class="bt bt-o" style="padding:3px 8px;font-size:11px" onclick="pettyEdit(\'' + x.cd + '\')">✏️</button>' +
               '<button class="bt bt-o" style="padding:3px 8px;font-size:11px;color:#dc2626" onclick="pettyDel(\'' + x.cd + '\')">🗑️</button>';
      }
      /* فاز ۲ / گام ۸: رفع باگ نمایشی — رکورد ابطال‌شده باید صریحاً با برچسب
         «ابطال شد» دیده شود و دکمه‌های ویرایش/حذف/تسویه رویش ظاهر نشوند. */
      return '<div style="background:' + (isVoid ? '#fef2f2' : '#fff') + ';border:1px solid ' + (isVoid ? '#fecaca' : 'var(--brd)') + ';border-radius:12px;padding:11px 13px;margin-bottom:7px' + (isVoid ? ';opacity:0.75' : '') + '">' +
        '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;align-items:center">' +
        '<span style="font-size:13px"><b' + (isVoid ? ' style="text-decoration:line-through;color:#94a3b8"' : '') + '>' + money(x.amt) + '</b> — ' + escP(x.cat) + (x.payMode === 'direct' ? ' <span class="bd b-st4">پرداخت مستقیم</span>' : '') + (x.rfq ? ' <small style="color:#0e7490">(' + escP(x.rfq) + ')</small>' : '') +
        '<br><small style="color:#64748b">' + escP(x.t) + ' | ' + escP(x.by) + (x.desc ? ' — ' + escP(x.desc) : '') + '</small>' + (files ? '<br><small>' + files + '</small>' : '') +
        (x.st === 'settled' ? '<br><small style="color:#059669">✔ تسویه: ' + escP(x.settledT || '') + ' — سند: ' + escP(x.settleDoc || '-') + ' (' + escP(x.settledBy || '') + ')</small>' : '') +
        (isVoid ? '<br><small style="color:#dc2626">⛔ ابطال شد: ' + escP(x.voidAt || '') + ' — دلیل: ' + escP(x.voidReason || '-') + ' (' + escP(x.voidBy || '') + ')</small>' : '') +
        ((x.amountCorrections || []).length ? '<br><small style="color:#7c3aed">✏️ اصلاح مبلغ: ' + x.amountCorrections.map(function (c) { return money(c.from) + ' → ' + money(c.to) + ' (' + escP(c.reason) + ')'; }).join('، ') + '</small>' : '') + '</span>' +
        '<span style="display:flex;gap:5px;align-items:center">' + acts +
        (isVoid ? '<span class="bd" style="background:#fee2e2;color:#b91c1c">ابطال شد</span>' : (x.st === 'settled' ? '<span class="bd b-st4">تسویه شد</span>' : (isTreasurer() ? '<button class="bt" style="padding:4px 11px;font-size:12px;background:#059669" onclick="pettySettle(\'' + x.cd + '\')">✔ تسویه از حساب</button>' : '<span class="bd" style="background:#fef3c7;color:#b45309">در انتظار تسویه</span>'))) + '</span>' +
        '</div></div>';
    }).join('') || '<div style="text-align:center;color:#94a3b8;padding:22px">هزینه‌ای ثبت نشده</div>';
  };

  function afterAddUpload(rec) {
    var html = '<div class="md-b" style="display:grid" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:440px">' +
      '<h3>📎 پیوست رسید/فاکتور پرداخت</h3><div id="ptyUp"></div>' +
      '<div style="display:flex;justify-content:flex-end;margin-top:10px"><button class="bt" onclick="this.closest(\'.md-b\').remove();renderPetty()">تمام</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
    if (typeof attachUploadWidget === 'function') {
      attachUploadWidget('ptyUp', 'petty/' + rec.cd, function (f) {
        var a = getData(PETTY_KEY); var r = a.filter(function (x) { return x.cd === rec.cd; })[0];
        if (r) { r.files = r.files || []; r.files.push(f); setData(PETTY_KEY, a); }
      });
    }
  }

  /* AUD-09 (ممیزی ۱۴۰۵/۰۵/۰۷ — crm/AUDIT-FINANCIAL-SYSTEM-2026-07-29.md):
     هنگام ثبت (pettyAdd)، اگر هزینه به یک پرونده‌ی فروش لینک شود، یک
     costEvent متناظر در deal.costEvents ساخته می‌شود (برای این‌که در سود
     پروژه لحاظ شود بدون دوباره‌شماری با OPEX). این تابع، عکس همان عملیات
     را انجام می‌دهد — دقیقاً مطابق الگوی درست موجود در opex.js#ptfOpexDel —
     تا وقتی رکورد تنخواه حذف/ابطال می‌شود، اثر یتیم آن هم از پرونده پاک شود. */
  function ptfPettyRemoveDealCostEvent(r) {
    if (!r || !r.dealRef) return;
    try {
      var ds = getData('ptf_crm_deals');
      var d = ds.filter(function (x) { return x.cd === r.dealRef; })[0];
      if (d) {
        d.costEvents = (d.costEvents || []).filter(function (x) { return x.cd !== r.cd; });
        d.timeline = d.timeline || [];
        d.timeline.push({ t: faDateTime(), by: userName(), tx: '🗑 حذف/ابطال هزینه تنخواه لینک‌شده از پرونده: ' + money(r.amt) + ' — ' + (r.desc || r.cat) });
        setData('ptf_crm_deals', ds);
      }
    } catch (e) {}
  }

  window.pettyAdd = function () {
    try{ var curM = (typeof faMonthNow==='function'?faMonthNow():'').split('/')[0]; if(curM && isFiscalLocked(curM)){ alert('🔒 سال مالی '+curM+' قفل است - ثبت هزینه در سال قفل‌شده مجاز نیست.'); return; } }catch(e){}
    var dealOpts = '<option value="">— مستقل از پرونده فروش —</option>' + (getData('ptf_crm_deals') || []).filter(function (d) { return d.wonOffer && d.st !== 'archived'; }).map(function (d) { return '<option value="' + escP(d.cd) + '">' + escP(d.inqNo || d.cd) + ' — ' + escP(d.buyerCo || '') + '</option>'; }).join('');
    ptfDialog({
      title: '💵 ثبت هزینه تنخواه',
      fields: [
        { id: 'amt', label: 'مبلغ (ریال)', type: 'number', required: true, dir: 'ltr' },
        { id: 'cat', label: 'نوع هزینه', type: 'select', options: CATS.map(function (c) { return { v: c, lb: c }; }) },
        { id: 'rfq', label: 'مربوط به درخواست/پرونده (اختیاری)', placeholder: 'مثال: PTF-RFQ-1405-0012', dir: 'ltr' },
        { id: 'dealRef', label: 'مربوط به کدام پرونده فروش؟ (اختیاری - برای جلوگیری از دوباره‌شماری)', type: 'select', optionsHtml: dealOpts },
        { id: 'desc', label: 'توضیح', type: 'textarea', rows: 2, required: true }
      ],
      okText: 'ثبت و پیوست مدرک',
      onOk: function (v) {
        var rec = { cd: genCode('PTY'), amt: toNum(v.amt), cat: v.cat, rfq: v.rfq, dealRef: v.dealRef||'', desc: v.desc, by: userName(), t: faDateTime(), iso: isoNow(), month: faMonthNow(), st: 'open', files: [] };
        var all = getData(PETTY_KEY); all.unshift(rec); setData(PETTY_KEY, all);
        // v30.5: اگر به پرونده لینک شد، costEvents بساز تا در سود پروژه بیاید ولی دوباره‌شماری نشود
        if(rec.dealRef){
          try{
            var ds=getData('ptf_crm_deals');
            var d=ds.filter(function(x){ return x.cd===rec.dealRef; })[0];
            if(d){
              d.costEvents=d.costEvents||[];
              d.costEvents.unshift({ cd: rec.cd, amt: rec.amt, cat: 'fromPetty', desc: '[تنخواه] '+(v.desc||v.cat), by: userName(), t: faDateTime(), files: [], fromPetty: true, pettyCd: rec.cd });
              d.timeline=d.timeline||[];
              d.timeline.push({ t: faDateTime(), by: userName(), tx: '➕ لینک هزینه تنخواه به پرونده: '+money(rec.amt)+' — '+(v.desc||v.cat) });
              setData('ptf_crm_deals', ds);
            }
          }catch(e){}
        }
        audit('تنخواه', 'ثبت هزینه/مطالبه تنخواه ' + money(rec.amt) + ' — ' + v.cat + (rec.dealRef?' [لینک پرونده '+rec.dealRef+']':''), rec.cd);
        renderPetty(); afterAddUpload(rec);
        if (typeof ptfToast === 'function') ptfToast('هزینه ثبت شد و به‌عنوان مطالبه شما از تنخواه منظور شد', 'ok');
      }
    });
  };

  window.pettyDirectPay = function () {
    if (!isTreasurer()) { alert('⛔ فقط تنخواه‌گردان'); return; }
    try{ var curM = (typeof faMonthNow==='function'?faMonthNow():'').split('/')[0]; if(curM && isFiscalLocked(curM)){ alert('🔒 سال مالی '+curM+' قفل است'); return; } }catch(e){}
    ptfDialog({
      title: '💳 پرداخت مستقیم از حساب تنخواه',
      fields: [
        { id: 'amt', label: 'مبلغ پرداخت', type: 'number', required: true, dir: 'ltr' },
        { id: 'cat', label: 'نوع هزینه', type: 'select', options: CATS.map(function (c) { return { v: c, lb: c }; }) },
        { id: 'doc', label: 'شماره/شرح سند پرداخت', required: true },
        { id: 'desc', label: 'شرح هزینه', type: 'textarea', rows: 2, required: true }
      ],
      okText: 'ثبت پرداخت مستقیم',
      onOk: function (v) {
        var amt = toNum(v.amt); if (!ensureBalance(amt)) return;
        var rec = { cd: genCode('PTY'), amt: amt, cat: v.cat, desc: v.desc, by: userName(), t: faDateTime(), iso: isoNow(), month: faMonthNow(), st: 'settled', payMode: 'direct', settleDoc: v.doc, settledBy: userName(), settledT: faDateTime(), files: [] };
        var tx = addTx('direct', amt, v.doc || v.desc, rec.cd, { cat: v.cat }); rec.acctTx = tx.cd;
        var all = getData(PETTY_KEY); all.unshift(rec); setData(PETTY_KEY, all);
        audit('تنخواه', 'پرداخت مستقیم از حساب تنخواه ' + money(amt), rec.cd);
        renderPetty(); afterAddUpload(rec);
      }
    });
  };

  window.pettyCharge = function () {
    if (!isTreasurer()) { alert('⛔ فقط تنخواه‌گردان'); return; }
    try{ var curM = (typeof faMonthNow==='function'?faMonthNow():'').split('/')[0]; if(curM && isFiscalLocked(curM)){ alert('🔒 سال مالی '+curM+' قفل است'); return; } }catch(e){}
    ptfDialog({
      title: '➕ شارژ حساب تنخواه',
      fields: [
        { id: 'amt', label: 'مبلغ شارژ', type: 'number', required: true, dir: 'ltr' },
        { id: 'doc', label: 'شماره/شرح سند واریز', required: true },
        { id: 'desc', label: 'توضیح', placeholder: 'مثال: شارژ تنخواه تیرماه' }
      ],
      okText: 'ثبت شارژ',
      onOk: function (v) {
        var tx = addTx('charge', toNum(v.amt), v.doc || v.desc, '', { doc: v.doc });
        audit('تنخواه', 'شارژ حساب تنخواه ' + money(tx.amt), tx.cd);
        renderPetty();
        if (typeof ptfToast === 'function') ptfToast('شارژ حساب ثبت شد', 'ok');
      }
    });
  };

  window.pettySettle = function (cd) {
    if (!isTreasurer()) { alert('⛔ فقط تنخواه‌گردان'); return; }
    var rr = (getData(PETTY_KEY) || []).filter(function (x) { return x.cd === cd; })[0];
    if (rr && !ensureBalance(rr.amt)) return;
    ptfDialog({
      title: '✔ تسویه از حساب تنخواه',
      fields: [{ id: 'doc', label: 'شماره/شرح سند پرداخت', required: true, placeholder: 'مثال: حواله بانکی 12345' }],
      okText: 'ثبت تسویه',
      onOk: function (v) {
        var all = getData(PETTY_KEY); var r = all.filter(function (x) { return x.cd === cd; })[0]; if (!r) return;
        if (!ensureBalance(r.amt)) return;
        var tx = addTx('settle', r.amt, v.doc, cd, { to: r.by });
        r.st = 'settled'; r.settleDoc = v.doc; r.settledBy = userName(); r.settledT = faDateTime(); r.acctTx = tx.cd;
        setData(PETTY_KEY, all);
        audit('تنخواه', 'تسویه هزینه از حساب تنخواه با سند ' + v.doc + ' — ' + money(r.amt), cd);
        var uname = userToUsername(r.by);
        if (typeof notify === 'function') notify({ toUsers: [uname].filter(Boolean), title: '✔ هزینه تنخواه ' + money(r.amt) + ' شما تسویه شد (سند: ' + v.doc + ')', kind: 'petty', channels: ['cart'] });
        renderPetty();
      }
    });
  };

  window.pettyEdit = function (cd) {
    var all = getData(PETTY_KEY);
    var r = all.filter(function (x) { return x.cd === cd; })[0];
    if (!r) return;
    if (r.st === 'void') { alert('⛔ این رکورد ابطال شده است و قابل ویرایش نیست.'); return; }
    var me = curSession();
    if ((r.by !== me.name) && !canAll()) { alert('⛔ فقط ثبت‌کننده یا مدیر می‌تواند ویرایش کند'); return; }
    /* فاز ۲ / گام ۸ (رفع درخواست کارفرما — اصلاح مبلغ اشتباه هزینه‌ی تسویه‌شده):
       اصلاح مبلغ رکورد تسویه‌شده/پرداخت‌مستقیم فقط برای مدیر/تنخواه‌گردان
       مجاز است، چون باید هم‌زمان تراکنش حساب تنخواه (ptf_crm_petty_tx)
       اصلاح شود تا موجودی حساب با رکورد هزینه ناهماهنگ نماند. */
    var isSettledAmountChange = r.st === 'settled';
    ptfDialog({
      title: '✏️ ویرایش هزینه تنخواه — ' + cd,
      body: isSettledAmountChange ? '⚠️ این هزینه تسویه شده است. اصلاح مبلغ فقط برای مدیر/تنخواه‌گردان مجاز است و تراکنش حساب تنخواه هم به‌طور هم‌زمان اصلاح می‌شود.' : '',
      fields: [
        { id: 'amt', label: 'مبلغ (ریال)', type: 'number', value: r.amt, required: true, dir: 'ltr' },
        { id: 'cat', label: 'نوع هزینه', type: 'select', value: r.cat, options: CATS.map(function (c) { return { v: c, lb: c }; }) },
        { id: 'rfq', label: 'مربوط به درخواست/پرونده (اختیاری)', value: r.rfq || '', placeholder: 'مثال: PTF-RFQ-1405-0012', dir: 'ltr' },
        { id: 'desc', label: 'توضیح', type: 'textarea', rows: 2, value: r.desc || '', required: true }
      ].concat(isSettledAmountChange ? [{ id: 'reason', label: 'دلیل اصلاح مبلغ تسویه‌شده *', type: 'textarea', rows: 2, required: true, placeholder: 'مثال: مبلغ اشتباه وارد شده بود' }] : []),
      okText: 'ذخیره تغییرات',
      onOk: function (v) {
        var amt = toNum(v.amt);
        var amtChanged = amt !== r.amt;
        if (isSettledAmountChange && amtChanged) {
          if (!canAll()) { alert('⛔ اصلاح مبلغ هزینه‌ی تسویه‌شده فقط برای مدیر/تنخواه‌گردان مجاز است'); return; }
          if (!v.reason || !v.reason.trim()) { alert('⛔ دلیل اصلاح مبلغ الزامی است'); return; }
          try {
            var y = String((r.month || '').split('/')[0] || '').trim();
            if (y && isFiscalLocked(y)) { alert('🔒 سال مالی ' + y + ' قفل است - اصلاح مبلغ در سال قفل‌شده مجاز نیست. سند اصلاحی ثبت کنید.'); return; }
          } catch (e) {}
          var oldAmt = r.amt;
          /* هماهنگ‌سازی تراکنش حساب تنخواه (direct/settle) با مبلغ جدید تا موجودی حساب درست بماند */
          try {
            var txs = txAll();
            var tx = r.acctTx ? txs.filter(function (x) { return x.cd === r.acctTx; })[0] : null;
            if (!tx) tx = txs.filter(function (x) { return x.ref === r.cd && (x.type === 'direct' || x.type === 'settle'); })[0];
            if (tx) {
              tx.amt = amt;
              tx.desc = (tx.desc || '') + ' [اصلاح مبلغ: ' + money(oldAmt) + ' → ' + money(amt) + ' — ' + v.reason.trim() + ']';
              tx.correctedAt = faDateTime(); tx.correctedBy = userName();
              txSave(txs);
            }
          } catch (eTx) {}
          r.amt = amt; r.cat = v.cat; r.rfq = v.rfq; r.desc = v.desc; r.editedT = faDateTime(); r.editedBy = userName();
          r.amountCorrections = r.amountCorrections || [];
          r.amountCorrections.push({ from: oldAmt, to: amt, reason: v.reason.trim(), t: faDateTime(), by: userName() });
          setData(PETTY_KEY, all);
          audit('تنخواه', 'اصلاح مبلغ هزینه تسویه‌شده ' + cd + ' — ' + money(oldAmt) + ' → ' + money(amt) + ' — دلیل: ' + v.reason.trim(), cd);
          renderPetty();
          if (typeof ptfToast === 'function') ptfToast('مبلغ اصلاح شد و حساب تنخواه هم‌زمان به‌روزرسانی شد', 'ok');
          return;
        }
        r.amt = amt; r.cat = v.cat; r.rfq = v.rfq; r.desc = v.desc; r.editedT = faDateTime(); r.editedBy = userName();
        setData(PETTY_KEY, all);
        audit('تنخواه', 'ویرایش هزینه تنخواه ' + cd + ' — ' + money(amt), cd);
        renderPetty();
        if (typeof ptfToast === 'function') ptfToast('هزینه ویرایش شد', 'ok');
      }
    });
  };

  window.pettyDel = function (cd) {
    var all = getData(PETTY_KEY);
    var r = all.filter(function (x) { return x.cd === cd; })[0];
    if (!r) return;
    var me = curSession();
    if ((r.by !== me.name) && !canAll()) { alert('⛔ فقط ثبت‌کننده یا مدیر می‌تواند حذف کند'); return; }
    try {
      var y = String((r.month||'').split('/')[0] || '').trim();
      if(!y && r.t) { var m = String(r.t||'').match(/^\d{4}\/\d{2}/); if(m) y=m[0].split('/')[0]; }
      if(y && typeof getData==='function'){
        var snaps=getData('ptf_crm_fiscal_snapshots')||[];
        if(snaps.some(function(s){ return String(s.year)===String(y) && s.locked; })){
          alert('🔒 سال مالی '+y+' قفل است - حذف هزینه تنخواه در سال قفل‌شده مجاز نیست. برای اصلاح، سند اصلاحی ثبت کنید.');
          return;
        }
      }
    } catch(e){}
    // v31.1 FIN-WF-009 / FIN-EX-04: ابطال به جای حذف فیزیکی برای settled
    if(r.st==='settled'){
      var reason=prompt('این هزینه تسویه شده است - دلیل ابطال؟','اشتباه ثبت');
      if(reason===null) return;
      if(!reason.trim()){ alert('دلیل الزامی است'); return; }
      try{
        var txAll=getData(TX_KEY)||[];
        var rev={ cd: genCode('PTX'), type: 'charge', amt: +r.amt||0, desc: 'ابطال: '+reason.trim()+' - هزینه '+r.cd, ref: r.cd, by: userName(), t: faDateTime(), iso: isoNow(), month: faMonthNow(), voidRef: r.cd };
        txAll.unshift(rev);
        setData(TX_KEY, txAll);
      }catch(e){}
      r.st='void'; r.voidAt=faDateTime(); r.voidBy=userName(); r.voidReason=reason.trim();
      setData(PETTY_KEY, all);
      /* AUD-09 (ممیزی ۱۴۰۵/۰۵/۰۷ — crm/AUDIT-FINANCIAL-SYSTEM-2026-07-29.md):
         هزینه‌ی تنخواهِ ابطال‌شده دیگر نباید در سود پروژه‌ی لینک‌شده اثر
         بگذارد؛ الگو دقیقاً مثل opex.js#ptfOpexDel. */
      ptfPettyRemoveDealCostEvent(r);
      audit('تنخواه', 'ابطال هزینه تسویه‌شده '+cd+' — دلیل: '+reason.trim(), cd);
      renderPetty();
      if(typeof ptfToast==='function') ptfToast('هزینه ابطال شد - تراکنش معکوس ثبت شد', 'ok');
      return;
    }
    if (!confirm('هزینه ' + money(r.amt) + ' (' + r.cat + ') حذف شود؟\nاین عمل قابل بازگشت نیست.')) return;
    setData(PETTY_KEY, all.filter(function (x) { return x.cd !== cd; }));
    /* AUD-09: همان دلیل بالا — رکورد از تنخواه حذف شد، پس costEvent متناظر در
       پرونده‌ی فروش لینک‌شده هم باید حذف شود، وگرنه هزینه‌ی «شبح» در سود
       پروژه باقی می‌ماند. */
    ptfPettyRemoveDealCostEvent(r);
    audit('تنخواه', 'حذف هزینه تنخواه ' + cd + ' — ' + money(r.amt), cd);
    renderPetty();
    if (typeof ptfToast === 'function') ptfToast('هزینه حذف شد', 'warn');
  };

  window.ptfPettyPeriodData = function (month) {
    month = month || faMonthNow();
    var petty = (getData(PETTY_KEY) || []).filter(function (x) { return recMonth(x) === month; });
    var tx = txAll().filter(function (x) { return recMonth(x) === month; });
    var totalOut = tx.reduce(function (s, x) { return s + ((x.type === 'direct' || x.type === 'settle') ? +x.amt || 0 : 0); }, 0);
    var charges = tx.reduce(function (s, x) { return s + (x.type === 'charge' ? +x.amt || 0 : 0); }, 0);
    return { month: month, petty: petty, tx: tx, totalOut: totalOut, charges: charges, balance: window.ptfPettyBalance(), pending: window.ptfPettyPendingByUser() };
  };

  /* ============ UR-2026-08-01-09: گزارش کامل دورهٔ تنخواه ============ */
  window.ptfPettyPeriodEvents = function (month) {
    var d = window.ptfPettyPeriodData(month), events = [];
    (d.tx || []).forEach(function (x) {
      var kind = x.type === 'charge' ? 'شارژ حساب' : x.type === 'direct' ? 'پرداخت مستقیم' : x.type === 'settle' ? 'تسویه از حساب' : (x.type || 'تراکنش');
      events.push({ t: x.t || x.date || '', desc: (x.note || x.desc || '') + (x.ref ? ' (' + x.ref + ')' : ''), by: x.by || '', amt: +x.amt || 0, kind: kind });
    });
    (d.petty || []).forEach(function (p) {
      events.push({
        t: p.t || '',
        desc: (p.cat || 'هزینه') + (p.desc ? ' — ' + p.desc : '') + (p.rfq ? ' (' + p.rfq + ')' : ''),
        by: p.by || '',
        amt: +p.amt || 0,
        kind: p.st === 'void' ? 'هزینه (ابطال‌شده)' : (p.st === 'settled' ? 'هزینه (تسویه‌شده)' : 'هزینه (در انتظار تسویه)')
      });
    });
    events.sort(function (a, b) { var ta = a.t || '9999', tb = b.t || '9999'; return ta < tb ? -1 : ta > tb ? 1 : 0; });
    events.forEach(function (e, i) { e.row = i + 1; });
    return events;
  };

  /* جمع‌های زندهٔ دوره (هر لحظه از دادهٔ فعلی): خرج، شارژ، موجودی */
  window.ptfPettyPeriodTotals = function (month) {
    var d = window.ptfPettyPeriodData(month);
    var pettyOut = (d.petty || []).filter(function (p) { return p.st !== 'void'; }).reduce(function (s, p) { return s + (+p.amt || 0); }, 0);
    var directOut = (d.tx || []).filter(function (x) { return x.type === 'direct'; }).reduce(function (s, x) { return s + (+x.amt || 0); }, 0);
    return { pettyOut: pettyOut, directOut: directOut, totalOut: pettyOut + directOut, charges: d.charges, balance: d.balance };
  };

  window.ptfPettyPeriodReport = function (month) {
    month = month || faMonthNow();
    var events = window.ptfPettyPeriodEvents(month), t = window.ptfPettyPeriodTotals(month);
    function rowHtml(e) {
      return '<tr><td>' + e.row + '</td><td>' + escP(e.t || '—') + '</td><td>' + escP(e.kind) + '</td><td>' + escP(e.desc || '—') + '</td><td>' + escP(e.by || '—') + '</td><td>' + money(e.amt) + '</td></tr>';
    }
    var body = events.map(rowHtml).join('') || '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:18px">رکوردی در این دوره ثبت نشده است</td></tr>';
    var summary = '<div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:10px 14px;margin:10px 0;display:flex;gap:14px;flex-wrap:wrap;font-size:13px">' +
      '<b style="color:#b45309">💸 هزینه‌های دوره: ' + money(t.totalOut) + '</b>' +
      '<b style="color:#047857">💰 شارژ دوره: ' + money(t.charges) + '</b>' +
      '<b style="color:#0e7490">🏦 موجودی دوره: ' + money(t.balance) + '</b>' +
      (t.directOut > 0 ? '<small style="color:#64748b">(پرداخت مستقیم: ' + money(t.directOut) + ')</small>' : '') + '</div>';
    var html = '<div class="md-b" id="pettyPeriodReportDlg" style="display:grid;z-index:4000" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:860px;max-height:90vh;overflow:auto"><h3>📊 گزارش دورهٔ تنخواه — ' + escP(month) + '</h3>' + summary +
      '<div class="tb2"><table><thead><tr><th>ردیف</th><th>تاریخ</th><th>نوع</th><th>شرح</th><th>توسط</th><th>مبلغ</th></tr></thead><tbody>' + body + '</tbody></table></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">' +
      '<button class="bt bt-o" onclick="ptfPettyPeriodCsv(\'' + escP(month) + '\')">⬇ اکسل</button>' +
      '<button class="bt bt-o" onclick="ptfPettyPeriodPrint(\'' + escP(month) + '\')">🖨 چاپ/PDF</button>' +
      '<button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };

  window.ptfPettyPeriodCsv = function (month) {
    var events = window.ptfPettyPeriodEvents(month), t = window.ptfPettyPeriodTotals(month);
    var csv = '\uFEFF' + [['ردیف', 'تاریخ', 'نوع', 'شرح', 'توسط', 'مبلغ']]
      .concat(events.map(function (e) { return [e.row, e.t, e.kind, e.desc, e.by, e.amt]; }))
      .concat([[], ['هزینه‌های دوره', '', '', '', '', t.totalOut], ['شارژ دوره', '', '', '', '', t.charges], ['موجودی دوره', '', '', '', '', t.balance]])
      .map(function (r) { return r.map(function (x) { return '"' + String(x).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'petty-period-' + month.replace(/\//g, '-') + '-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
  };

  window.ptfPettyPeriodPrint = function (month) {
    var events = window.ptfPettyPeriodEvents(month), t = window.ptfPettyPeriodTotals(month);
    function rowHtml(e) { return '<tr><td>' + e.row + '</td><td>' + escP(e.t || '—') + '</td><td>' + escP(e.kind) + '</td><td>' + escP(e.desc || '—') + '</td><td>' + escP(e.by || '—') + '</td><td>' + money(e.amt) + '</td></tr>'; }
    var html = '<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>body{font-family:Tahoma;padding:20px;color:#111}table{width:100%;border-collapse:collapse}td,th{border:1px solid #aaa;padding:6px;text-align:right}th{background:#eee}</style></head><body>' +
      '<h2>گزارش دورهٔ تنخواه — ' + escP(month) + '</h2>' +
      '<p>هزینه‌های دوره: ' + money(t.totalOut) + ' | شارژ دوره: ' + money(t.charges) + ' | موجودی دوره: ' + money(t.balance) + '</p>' +
      '<table><thead><tr><th>ردیف</th><th>تاریخ</th><th>نوع</th><th>شرح</th><th>توسط</th><th>مبلغ</th></tr></thead><tbody>' + events.map(rowHtml).join('') + '</tbody></table></body></html>';
    if (typeof ptfPreviewPrintableDoc === 'function') { ptfPreviewPrintableDoc('گزارش دورهٔ تنخواه — ' + month, html, 'petty-period-' + month.replace(/\//g, '-')); return; }
    var w = window.open('', '_blank'); if (!w) return;
    w.document.write(html); w.document.close(); w.print();
  };

  window.pettyClosePeriod = function () {
    if (!isTreasurer()) { alert('⛔ فقط تنخواه‌گردان'); return; }
    ptfDialog({
      title: '📤 ارجاع گزارش دوره تنخواه به حسابدار',
      body: 'گزارش گردش دوره شامل پرداخت‌های مستقیم، تسویه مطالبات اشخاص، مانده حساب و همه ضمایم هزینه‌هاست. پس از ثبت، در کارتابل حسابدار قابل پیگیری می‌شود.',
      fields: [
        { id: 'month', label: 'ماه دوره (مثال 1405/04)', value: faMonthNow(), required: true, dir: 'ltr' },
        { id: 'note', label: 'یادداشت برای حسابدار', type: 'textarea', rows: 2 },
        { id: 'sms', label: 'پیامک اطلاع‌رسانی؟', type: 'select', options: [{ v: 'no', lb: 'خیر' }, { v: 'yes', lb: 'بله، اگر شماره حسابدار موجود است' }] }
      ],
      okText: 'ثبت و ارجاع',
      onOk: function (v) {
        var d = window.ptfPettyPeriodData(v.month);
        var rec = { cd: genCode('PPR'), month: d.month, st: 'referred', by: userName(), t: faDateTime(), iso: isoNow(), note: v.note || '', pettyIds: d.petty.map(function (x) { return x.cd; }), txIds: d.tx.map(function (x) { return x.cd; }), totalOut: d.totalOut, charges: d.charges, balance: d.balance, files: [] };
        var ps = prAll(); ps.unshift(rec); prSave(ps);
        audit('تنخواه', 'ارجاع گزارش دوره ' + d.month + ' به حسابدار — گردش ' + money(d.totalOut), rec.cd);
        if (typeof notify === 'function') notify({ toRoles: ['accountant'], title: '📤 گزارش دوره تنخواه ' + d.month + ' برای ثبت حسابداری ارجاع شد', body: 'گردش دوره: ' + money(d.totalOut) + ' | مانده حساب: ' + money(d.balance), kind: 'petty_period', channels: ['cart'], link: { panel: 'petty' } });
        if (v.sms === 'yes' && typeof smsSendSingle === 'function') accountants().forEach(function (u) { if (u.mobile) smsSendSingle(u.mobile, 'حسابدار محترم، گزارش دوره تنخواه ' + d.month + ' در CRM برای ثبت حسابداری ارجاع شد. https://pishtaj.ir/crm/'); });
        renderPetty(); pettyAttachBank(rec.cd);
      }
    });
  };

  window.pettyAttachBank = function (cd) {
    if (!isTreasurer()) return;
    var html = '<div class="md-b" style="display:grid" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:460px"><h3>📎 پیوست صورتحساب بانک / گزارش دوره</h3><div id="ptyPerUp"></div><div style="display:flex;justify-content:flex-end;margin-top:10px"><button class="bt" onclick="this.closest(\'.md-b\').remove();renderPetty()">تمام</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
    if (typeof attachUploadWidget === 'function') attachUploadWidget('ptyPerUp', 'petty-period/' + cd, function (f) { var ps = prAll(); var p = ps.filter(function (x) { return x.cd === cd; })[0]; if (p) { p.files = p.files || []; p.files.push(f); prSave(ps); } });
  };

  window.pettyPeriodRegistered = function (cd) {
    if (!isAccountant() && curRole() !== 'admin') { alert('⛔ فقط حسابدار'); return; }
    ptfDialog({
      title: '✅ ثبت دوره تنخواه در حسابداری',
      fields: [{ id: 'doc', label: 'شماره سند/شرح ثبت در سیستم حسابداری', required: true }],
      okText: 'ثبت نهایی',
      onOk: function (v) {
        var ps = prAll(); var p = ps.filter(function (x) { return x.cd === cd; })[0]; if (!p) return;
        p.st = 'registered'; p.accDoc = v.doc; p.accBy = userName(); p.accT = faDateTime(); prSave(ps);
        audit('تنخواه', 'ثبت حسابداری گزارش دوره ' + (p.month || '') + ' — سند ' + v.doc, cd);
        if (typeof notify === 'function') notify({ toRoles: ['chairman', 'admin'], title: '✅ گزارش دوره تنخواه ' + (p.month || '') + ' در حسابداری ثبت شد', kind: 'petty_period', channels: ['cart'], link: { panel: 'petty' } });
        renderPetty();
      }
    });
  };

  window.pettySetTreasurerRole = function () {
    if (curRole() !== 'admin' && curRole() !== 'chairman') return;
    ptfDialog({
      title: '⚙️ تنظیم نقش تنخواه‌گردان',
      fields: [{ id: 'rl', label: 'نقش تنخواه‌گردان', type: 'select', value: treasurerRole(), options: [
        { v: 'chairman', lb: 'رییس هیات مدیره' }, { v: 'ceo', lb: 'مدیرعامل' }, { v: 'commercial', lb: 'مدیر بازرگانی' }, { v: 'admin', lb: 'ادمین' }
      ] }],
      okText: 'ذخیره',
      onOk: function (v) { var s = stObj(); s.pettyTreasurerRole = v.rl; saveSt(s); audit('تنخواه', 'تغییر نقش تنخواه‌گردان به ' + v.rl, 'settings'); renderPetty(); }
    });
  };

  /* ============ v18.2 (BUG-023 + US-424): پیش‌پرداخت ساختاریافته و مطالبات قابل اعتماد ============ */
  function offerTotal(o) {
    return (o && o.items || []).reduce(function (s, it) { return s + (+it.qty || 0) * (+it.price || 0); }, 0);
  }
  function offerCur(o) { return (o && o.currency) || 'IRR'; }
  function liveRate(cur) {
    /* v33.4.2 (دستور کارفرما): سنا کنار گذاشته شد — فقط نرخ آزاد (زنده و صحیح) به‌عنوان پیشنهاد اولیه استفاده می‌شود */
    var L = (window._ptfFxLive && window._ptfFxLive.rates) || {};
    if (cur === 'USD') return +L.usd_free || 0;
    if (cur === 'EUR') return +L.eur_free || 0;
    return 0;
  }
  function advMoney(v, cur) {
    if (typeof ptfMoney === 'function') return ptfMoney(v, cur || 'IRR');
    return cur && cur !== 'IRR' ? (+v || 0).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ' + cur : money(v);
  }
  window.ptfAdvanceNormalize = function (o) {
    var a = o && o.advance;
    if (!a) return null;
    var cur = offerCur(o), total = offerTotal(o), rate = +a.rate || 0;
    var out = Object.assign({}, a);
    out.cur = out.cur || cur;
    if (out.mode === 'no') out.mode = 'none';
    if (out.mode === 'full') { out.pct = 100; out.docAmt = total; out.amt = cur === 'IRR' ? total : Math.round(total * (+out.rate || rate || 0)); out.cashFull = true; }
    else if (out.mode === 'pct') {
      var pct = +out.pct || +out.val || 0;
      var amt = +out.amt || 0;
      if (pct > 100 && amt && total) pct = Math.min(100, Math.round((cur === 'IRR' ? amt / total : ((+out.docAmt || 0) / total)) * 100));
      if (pct > 100) pct = 100;
      out.pct = Math.max(0, pct);
      out.docAmt = +out.docAmt || (total * out.pct / 100);
      out.amt = cur === 'IRR' ? Math.round(out.docAmt) : Math.round(out.docAmt * (+out.rate || rate || 0));
    }
    else if (out.mode === 'amt') {
      out.docAmt = +out.docAmt || +out.val || (cur === 'IRR' ? +out.amt || 0 : 0);
      out.amt = cur === 'IRR' ? Math.round(out.docAmt) : Math.round(out.docAmt * (+out.rate || rate || 0));
      out.pct = total ? Math.round(out.docAmt * 10000 / total) / 100 : 0;
      if (out.pct > 100 && !out.exceptional) out.pct = 100;
    }
    out.payments = Array.isArray(out.payments) ? out.payments.slice() : [];
    out.receivedAmt = out.cashFull ? (+out.amt || 0) : out.payments.reduce(function (s, p) { return s + (+p.amt || 0); }, 0);
    out.receivedDocAmt = out.cashFull ? (+out.docAmt || 0) : out.payments.reduce(function (s, p) {
      if (p.docAmt != null) return s + (+p.docAmt || 0);
      if (cur !== 'IRR' && +p.rate) return s + ((+p.amt || 0) / (+p.rate || 1));
      return s + (+p.amt || 0);
    }, 0);
    out.remainAmt = Math.max(0, Math.round((+out.amt || 0) - (+out.receivedAmt || 0)));
    out.remainDocAmt = Math.max(0, +(((+out.docAmt || 0) - (+out.receivedDocAmt || 0)).toFixed ? ((+out.docAmt || 0) - (+out.receivedDocAmt || 0)).toFixed(2) : ((+out.docAmt || 0) - (+out.receivedDocAmt || 0))));
    out.receivedPct = total ? Math.round((+out.receivedDocAmt || 0) * 10000 / total) / 100 : 0;
    out.paid = !!(out.cashFull || out.remainAmt <= 0.5 || out.remainDocAmt <= 0.01 || a.paid);
    return out;
  };
  window.ptfAdvanceLabel = function (o, opts) {
    var a = ptfAdvanceNormalize(o);
    if (!a || a.mode === 'none') return (opts && opts.en) ? 'None' : 'ندارد';
    if (a.cashFull) return (opts && opts.en) ? 'Full / cash payment — settled' : 'پرداخت کامل/نقدی — تسویه‌شده';
    var cur = offerCur(o);
    var en = !!(opts && opts.en);
    var pctN = Math.max(0, Math.min(100, +a.pct || 0));
    var pct = a.pct != null && a.pct !== '' ? (en ? (' (' + pctN + '%)') : (' (' + pctN + '٪)')) : '';
    var rateStr = a.rate ? (en ? (+a.rate).toLocaleString('en-US') : (+a.rate).toLocaleString('fa-IR')) : '';
    var doc = cur !== 'IRR'
      ? (en
          ? (' — ' + (+a.docAmt || 0).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ' + cur + (rateStr ? (' × ' + rateStr + ' IRR') : ''))
          : (' — ' + advMoney(a.docAmt, cur) + (rateStr ? (' × ' + rateStr) : '')))
      : '';
    var irrAmt = en
      ? ((+a.amt || 0).toLocaleString('en-US') + ' IRR')
      : advMoney(a.amt, 'IRR');
    return irrAmt + pct + doc + (a.exceptional ? (en ? ' ⚠️ exceptional' : ' ⚠️ غیرعادی') : '');
  };

  /* v20.3 US-428: محاسبه زنده درصد/مبلغ/نرخ پیش‌پرداخت */
  window.ptfAdvanceLiveBind = function (total, cur) {
    setTimeout(function () {
      var mode = document.getElementById('ptfF0'), pct = document.getElementById('ptfF1'), amt = document.getElementById('ptfF2'), rate = document.getElementById('ptfF3');
      var box = document.getElementById('advLiveBox');
      if (!mode || !pct || !amt || !box) return;
      function num(v) { return (typeof ptfNum === 'function') ? ptfNum(v) : toNum(v); }
      function fmt(v, c) { return (typeof ptfMoney === 'function') ? ptfMoney(v, c || 'IRR') : advMoney(v, c || 'IRR'); }
      function setVal(el, v) { if (!el) return; el.value = (Math.round((+v || 0) * 100) / 100) || ''; }
      function calc(src) {
        var m = mode.value || 'none';
        var r = num(rate && rate.value);
        if (m === 'full') { setVal(pct, 100); setVal(amt, total); }
        else if (m === 'none') { setVal(pct, ''); setVal(amt, ''); }
        else if (m === 'pct' && src === 'pct') { var pc = Math.max(0, Math.min(100, num(pct.value))); setVal(amt, total * pc / 100); }
        else if (m === 'amt' && src === 'amt') { var a = num(amt.value); setVal(pct, total ? (a * 100 / total) : 0); }
        else if (m === 'pct' && !num(amt.value) && num(pct.value)) { setVal(amt, total * Math.max(0, Math.min(100, num(pct.value))) / 100); }
        else if (m === 'amt' && !num(pct.value) && num(amt.value)) { setVal(pct, total ? (num(amt.value) * 100 / total) : 0); }
        var docAmt = num(amt.value), pc2 = num(pct.value);
        var irr = cur !== 'IRR' ? (docAmt * r) : docAmt;
        box.innerHTML = '<div style="background:#f8fafc;border:1px solid var(--brd);border-radius:10px;padding:8px 10px;font-size:12.5px;line-height:1.9">' +
          '<b>محاسبه زنده:</b> ' + (m === 'none' ? 'بدون پیش‌پرداخت' : (pc2 ? pc2.toLocaleString('fa-IR') + '٪' : '—٪') + ' از ' + fmt(total, cur) + ' = <b dir="ltr">' + fmt(docAmt, cur) + '</b>' + (cur !== 'IRR' ? ' × نرخ ' + (r ? r.toLocaleString('fa-IR') : '—') + ' = <b>' + fmt(irr, 'IRR') + '</b>' : '')) +
          (docAmt > total && m === 'amt' ? '<br><span style="color:#dc2626">⚠️ مبلغ بیش از کل سند است و حالت استثنایی می‌خواهد.</span>' : '') + '</div>';
      }
      mode.onchange = function () { calc('mode'); };
      pct.oninput = function () { mode.value = mode.value === 'none' ? 'pct' : mode.value; if (mode.value !== 'amt') mode.value = 'pct'; calc('pct'); };
      amt.oninput = function () { mode.value = mode.value === 'none' ? 'amt' : mode.value; if (mode.value !== 'pct') mode.value = 'amt'; calc('amt'); };
      if (rate) rate.oninput = function () { calc('rate'); };
      calc('init');
    }, 80);
  };

  window.ptfAdvanceOpen = function (no) {
    var offers = getData('ptf_crm_offers');
    var o = offers.filter(function (x) { return x.no === no; })[0];
    if (!o) return;
    if (o.kind !== 'CO' && o.kind !== 'TC') { alert('پیش‌پرداخت فقط برای پیشنهاد مالی/فنی‌مالی کاربرد دارد'); return; }
    var cur = offerCur(o), total = offerTotal(o), old = ptfAdvanceNormalize(o) || {};
    var fx = cur !== 'IRR';
    var body = 'مبلغ کل سند: <b dir="ltr">' + advMoney(total, cur) + '</b><br>درصد و مبلغ به‌صورت ساختاریافته ذخیره می‌شود و متن/مطالبات از همین داده ساخته می‌شود؛ متن آزاد مبنای محاسبه مالی نیست.' + (fx ? '<br>برای سند ارزی، نرخ تسعیر پیش‌پرداخت الزامی است.' : '') + '<div id="advLiveBox" style="margin-top:8px"></div>';
    ptfDialog({
      title: '💰 پیش‌پرداخت ساختاریافته — ' + no,
      body: body,
      fields: [
        { id: 'mode', label: 'نوع پیش‌پرداخت', type: 'select', value: old.cashFull ? 'full' : (old.mode || 'none'), options: [
          { v: 'none', lb: 'بدون پیش‌پرداخت' }, { v: 'pct', lb: 'درصدی' }, { v: 'amt', lb: 'مبلغ ثابت' }, { v: 'full', lb: 'پرداخت کامل / نقدی (۱۰۰٪)' }
        ] },
        /* BUGFIX — الگوی باگ تکرارشونده ورود عدد در برخی مودال‌ها:
           این فیلدها در بعضی موبایل‌ها با money formatter دچار caret-reverse می‌شدند (مثل 15 → 51).
           برای پیش‌پرداخت، پایداری ورود از زیبایی نمایش مهم‌تر است؛ پس این سه فیلد plain numeric هستند. */
        { id: 'pct', label: 'درصد پیش‌پرداخت (۰ تا ۱۰۰)', type: 'number', money: false, value: old.pct || '', dir: 'ltr' },
        { id: 'docAmt', label: fx ? ('مبلغ پیش‌پرداخت به ارز سند (' + cur + ')') : 'مبلغ پیش‌پرداخت (ریال)', type: 'number', money: false, value: old.docAmt || (old.amt && !fx ? old.amt : ''), dir: 'ltr' },
        { id: 'rate', label: fx ? ('نرخ تسعیر ریال per ' + cur + ' *') : 'نرخ تسعیر (برای ریالی خالی)', type: 'number', money: false, value: old.rate || liveRate(cur) || '', dir: 'ltr' },
        { id: 'note', label: 'توضیح/شرایط پرداخت چاپی', type: 'textarea', rows: 2, value: old.note || '' }
      ],
      okText: 'ثبت پیش‌پرداخت',
      onOk: function (v) {
        var mode = v.mode || 'none';
        var pct = toNum(v.pct), docAmt = toNum(v.docAmt), rate = toNum(v.rate);
        if (mode === 'none') {
          o.advance = { mode: 'none', struct: true, paid: false, t: faDate(), by: userName(), note: v.note || '' };
        } else if (mode === 'full') {
          if (fx && !rate) { alert('نرخ تسعیر برای پرداخت کامل ارزی الزامی است'); return; }
          o.advance = { mode: 'full', pct: 100, docAmt: total, cur: cur, rate: fx ? rate : 1, amt: fx ? Math.round(total * rate) : total, paid: true, cashFull: true, paidT: faDateTime(), paidBy: userName(), paidHow: 'پرداخت کامل/نقدی هنگام ثبت پیشنهاد', struct: true, t: faDate(), by: userName(), note: v.note || '' };
        } else if (mode === 'pct') {
          if (pct <= 0 || pct > 100) { alert('درصد پیش‌پرداخت باید بین ۰ تا ۱۰۰ باشد.'); return; }
          docAmt = total * pct / 100;
          if (fx && !rate) { alert('نرخ تسعیر برای پیش‌پرداخت ارزی الزامی است'); return; }
          o.advance = { mode: 'pct', pct: pct, docAmt: docAmt, cur: cur, rate: fx ? rate : 1, amt: fx ? Math.round(docAmt * rate) : Math.round(docAmt), paid: false, struct: true, t: faDate(), by: userName(), note: v.note || '' };
          if (pct === 100) { o.advance.mode = 'full'; o.advance.paid = true; o.advance.cashFull = true; o.advance.paidT = faDateTime(); o.advance.paidBy = userName(); o.advance.paidHow = 'پرداخت کامل/نقدی'; }
        } else if (mode === 'amt') {
          if (docAmt <= 0) { alert('مبلغ پیش‌پرداخت الزامی است'); return; }
          var exceptional = docAmt > total;
          if (exceptional && !confirm('⚠️ مبلغ پیش‌پرداخت از مبلغ کل سند بیشتر است. فقط در حالت استثنایی و با ثبت audit ادامه دهید؟')) return;
          if (fx && !rate) { alert('نرخ تسعیر برای پیش‌پرداخت ارزی الزامی است'); return; }
          pct = total ? Math.round(docAmt * 10000 / total) / 100 : 0;
          o.advance = { mode: 'amt', pct: pct, docAmt: docAmt, cur: cur, rate: fx ? rate : 1, amt: fx ? Math.round(docAmt * rate) : Math.round(docAmt), paid: false, exceptional: exceptional, struct: true, t: faDate(), by: userName(), note: v.note || '' };
          if (docAmt >= total && !exceptional) { o.advance.mode = 'full'; o.advance.paid = true; o.advance.cashFull = true; o.advance.paidT = faDateTime(); o.advance.paidBy = userName(); o.advance.paidHow = 'پرداخت کامل/نقدی'; }
        }
        setData('ptf_crm_offers', offers);
        audit('پیشنهادها', 'ثبت/اصلاح پیش‌پرداخت ساختاریافته ' + no + ': ' + ptfAdvanceLabel(o), no);
        if (typeof notify === 'function' && o.advance && o.advance.amt && !o.advance.paid) notify({ toRoles: ['admin', 'chairman', 'ceo', 'accountant'], title: '💰 مطالبه پیش‌پرداخت ' + ptfAdvanceLabel(o) + ' برای ' + no + ' (' + (o.buyerCo || '') + ') ثبت شد', kind: 'advance', channels: ['cart'], link: { panel: 'recv' } });
        if (typeof renderReceivables === 'function') renderReceivables();
        if (typeof renderOffers === 'function') renderOffers();
        if (typeof ptfToast === 'function') ptfToast('پیش‌پرداخت ساختاریافته ثبت شد', 'ok');
      }
    });
    if (typeof ptfAdvanceLiveBind === 'function') ptfAdvanceLiveBind(total, cur);
  };

  var _offerSaveAdv = window.offerSave;
  if (typeof _offerSaveAdv === 'function' && !window._advOfferSaveHooked) {
    window._advOfferSaveHooked = true;
    window.offerSave = function () {
      _offerSaveAdv.apply(this, arguments);
      try {
        var st = window._offState || {};
        var o = getData('ptf_crm_offers').filter(function (x) { return x.no === st.no; })[0];
        if (o && (o.kind === 'CO' || o.kind === 'TC') && !o.advance && !o.advanceAsked) {
          o.advanceAsked = true;
          var list = getData('ptf_crm_offers');
          list = list.map(function (x) { return x.no === o.no ? o : x; });
          setData('ptf_crm_offers', list);
          setTimeout(function () { if (confirm('برای این پیشنهاد پیش‌پرداخت/شرایط پرداخت ساختاریافته ثبت شود؟')) ptfAdvanceOpen(o.no); }, 120);
        }
      } catch (e) {}
    };
  }

  var _setSt = window.offerSetSt;
  if (typeof _setSt === 'function') {
    window.offerSetSt = function (no, st, selEl) {
      var wasWon = (getData('ptf_crm_offers').filter(function (o) { return o.no === no; })[0] || {}).st === 'won';
      _setSt(no, st, selEl);
      var o = getData('ptf_crm_offers').filter(function (x) { return x.no === no; })[0];
      if (st === 'won' && o && o.st === 'won' && !wasWon && (o.kind === 'CO' || o.kind === 'TC') && !o.advance) {
        ptfAdvanceOpen(no);
      }
    };
  }

  var _renderRecv = window.renderReceivables;
  if (typeof _renderRecv === 'function') {
    window.renderReceivables = function () {
      _renderRecv();
      var el = document.getElementById('rcWrap'); if (!el) return;
      var invOfferNos = {};
      (getData('ptf_crm_invoices') || []).forEach(function (iv) { if (iv && iv.offerNo) invOfferNos[iv.offerNo] = 1; });
      var advs = getData('ptf_crm_offers').filter(function (o) { var a = ptfAdvanceNormalize(o); return a && a.amt && a.mode !== 'none' && !invOfferNos[o.no]; });
      var openAdvs = advs.filter(function (o) { var a = ptfAdvanceNormalize(o); return !a.paid && (+a.remainAmt || 0) > 0; });
      var fulls = getData('ptf_crm_offers').filter(function (o) { var a = ptfAdvanceNormalize(o); return a && a.cashFull && !invOfferNos[o.no]; });
      if (!advs.length && !fulls.length) return;
      var totalAdv = openAdvs.reduce(function (s, o) { return s + (ptfAdvanceNormalize(o).remainAmt || 0); }, 0);
      var h = '<div style="background:#fff7ed;border:1px solid #fdba74;border-radius:14px;padding:12px 14px;margin-bottom:10px">' +
        '<h4 style="margin:0 0 8px;font-size:13.5px;color:#c2410c">💰 پیش‌پرداخت‌ها (' + openAdvs.length + ' مطالبه باز — جمع مانده: ' + totalAdv.toLocaleString('fa-IR') + ' ریال)</h4>' +
        openAdvs.map(function (o) { var a = ptfAdvanceNormalize(o); var pays = (a.payments || []).map(function (p) { return '◽ ' + escP(p.t || '') + ' — ' + (+p.amt || 0).toLocaleString('fa-IR') + ' ریال' + (p.docAmt ? ' <small style="color:#0e7490">(' + (+p.docAmt || 0).toLocaleString('en-US') + ' ' + escP(a.cur || '') + ' @ ' + (+p.rate || 0).toLocaleString('fa-IR') + ')</small>' : '') + ' <a href="javascript:void(0)" onclick="advancePayDel(\'' + escP(o.no) + '\',\'' + escP(p.cd || '') + '\')" style="color:#dc2626">✕</a>'; }).join('<br>'); return '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px dashed #fed7aa;flex-wrap:wrap"><span style="font-size:12.5px"><b>' + escP(o.buyerCo || '-') + '</b> — ' + escP(o.no) + ' — پیش‌پرداخت: <b>' + ptfAdvanceLabel(o) + '</b><br><small style="color:#166534">وصول‌شده: ' + (+a.receivedAmt || 0).toLocaleString('fa-IR') + ' ریال' + (a.cur !== 'IRR' ? ' | ' + (+a.receivedDocAmt || 0).toLocaleString('en-US') + ' ' + escP(a.cur) : '') + ' | مانده: ' + (+a.remainAmt || 0).toLocaleString('fa-IR') + ' ریال' + (a.cur !== 'IRR' ? ' | ' + (+a.remainDocAmt || 0).toLocaleString('en-US') + ' ' + escP(a.cur) : '') + '</small>' + (a.note ? '<br><small style="color:#64748b">' + escP(a.note) + '</small>' : '') + (pays ? '<br><small style="color:#475569">' + pays + '</small>' : '') + '</span><span style="display:flex;gap:5px"><button class="bt bt-o" style="padding:4px 10px;font-size:12px" onclick="ptfAdvanceOpen(\'' + escP(o.no) + '\')">اصلاح</button><button class="bt" style="padding:4px 11px;font-size:12px;background:#059669" onclick="advancePaid(\'' + escP(o.no) + '\')">+ ثبت وصول</button></span></div>'; }).join('') +
        (fulls.length ? '<div style="margin-top:8px;font-size:12px;color:#059669">✅ پرداخت کامل/نقدی: ' + fulls.map(function (o) { return escP(o.no); }).join('، ') + '</div>' : '') + '</div>';
      el.insertAdjacentHTML('afterbegin', h);
    };
  }
  window.advancePaid = function (no) {
    var hasInv = (getData('ptf_crm_invoices') || []).some(function (iv) { return iv.offerNo === no; });
    if (hasInv) { alert('برای این درخواست فاکتور صادر شده است؛ از این به بعد ملاک وصول، مبلغ فاکتور ریالی است و ثبت وصول باید در بخش مطالبات/فاکتور انجام شود.'); return; }
    var offers = getData('ptf_crm_offers'); var o = offers.filter(function (x) { return x.no === no; })[0]; if (!o || !o.advance) return;
    var a = ptfAdvanceNormalize(o); var cur = a.cur || offerCur(o);
    if (cur !== 'IRR') {
      ptfDialog({ title: '✔ ثبت وصول پیش‌پرداخت ارزی ' + no, body: 'سند ارزی است. یا «درصد از مانده پیش‌پرداخت» را وارد کنید یا مبلغ ریالی وصولی را. نرخ تسعیر روز الزامی است.', fields: [
        { id: 'pct', label: '٪ درصد از مانده پیش‌پرداخت (اختیاری)', type: 'number', money: false, dir: 'ltr' },
        { id: 'rtype', label: 'مبنای نرخ تسعیر', type: 'select', options: [{v:'free',lb:'آزاد'},{v:'agreed',lb:'توافقی'}] },
        { id: 'rate', label: 'نرخ تسعیر روز (ریال per ' + cur + ') *', type: 'number', money: false, value: liveRate(cur) || '', dir: 'ltr', required: true },
        { id: 'amt', label: 'مبلغ ریالی وصولی — خالی بگذارید تا از درصد محاسبه شود', type: 'number', money: false, dir: 'ltr' },
        { id: 'how', label: 'نحوه دریافت (حواله/چک/...)', value: 'حواله' },
        { id: 'note', label: 'یادداشت', type: 'textarea', rows: 2 }
      ], okText: 'ثبت وصول', onOk: function (v) {
        /* v24.8 BUG-126-01: پیش‌فرض نرخ/مانده/نحوه — فراخوانی برنامه‌ای فقط با how هم کار کند */
        v = v || {};
        if (!v.how) v.how = 'حواله';
        var rate = toNum(v.rate) || toNum(typeof liveRate === 'function' ? liveRate(cur) : 0) || +a.rate || 110000;
        var amt = toNum(v.amt), pct = toNum(v.pct);
        var remainDoc = +a.remainDocAmt || +a.docAmt || 0;
        var remainAmt = +a.remainAmt || +a.amt || 0;
        var docAmt = 0;
        if (!amt && pct > 0 && remainDoc > 0) { docAmt = +(remainDoc * pct / 100).toFixed(2); amt = Math.round(docAmt * rate); }
        else if (!amt && remainDoc > 0) { docAmt = remainDoc; amt = Math.round(docAmt * rate); }
        else if (!amt && remainAmt > 0) { amt = remainAmt; docAmt = rate ? +(amt / rate).toFixed(2) : 0; }
        else docAmt = rate ? +(amt / rate).toFixed(2) : 0;
        if (!amt || amt <= 0) { alert('مبلغ وصولی نامعتبر است'); return; }
        if (!docAmt || docAmt <= 0) { docAmt = rate ? +(amt / rate).toFixed(2) : amt; }
        if (amt > (+a.remainAmt || 0) + 1) { alert('مبلغ از مانده پیش‌پرداخت بیشتر است'); return; }
        o.advance.payments = Array.isArray(o.advance.payments) ? o.advance.payments : [];
        o.advance.payments.push({ cd: genCode('ADP'), amt: amt, docAmt: docAmt, rate: rate, rateType: v.rtype || 'agreed', how: v.how, note: v.note || '', t: faDateTime(), by: userName() });
        var ax = ptfAdvanceNormalize(o);
        o.advance.paid = ax.paid; o.advance.paidT = ax.paid ? faDateTime() : ''; o.advance.paidBy = ax.paid ? userName() : ''; o.advance.paidHow = ax.paid ? v.how : '';
        setData('ptf_crm_offers', offers);
        audit('مطالبات', 'ثبت وصول پیش‌پرداخت ' + amt.toLocaleString('fa-IR') + ' ریال (معادل ' + docAmt.toLocaleString('en-US') + ' ' + cur + ')', no);
        renderReceivables(); if (typeof ptfToast === 'function') ptfToast('وصول پیش‌پرداخت ثبت شد', 'ok');
      } });
      return;
    }
    ptfDialog({ title: '✔ ثبت وصول پیش‌پرداخت ' + no, fields: [
      { id: 'amt', label: 'مبلغ وصولی (ریال) *', type: 'number', money: false, required: true, dir: 'ltr', value: a.remainAmt || '' },
      { id: 'how', label: 'نحوه دریافت (حواله/چک/...)', value: 'حواله' },
      { id: 'note', label: 'یادداشت', type: 'textarea', rows: 2 }
    ], okText: 'ثبت وصول', onOk: function (v) {
      v = v || {};
      if (!v.how) v.how = 'حواله';
      var amt = toNum(v.amt) || toNum(a.remainAmt) || 0;
      if (!amt || amt <= 0) { alert('مبلغ وصولی نامعتبر است'); return; }
      if (amt > (+a.remainAmt || 0) + 1) { alert('مبلغ از مانده پیش‌پرداخت بیشتر است'); return; }
      o.advance.payments = Array.isArray(o.advance.payments) ? o.advance.payments : [];
      o.advance.payments.push({ cd: genCode('ADP'), amt: amt, docAmt: amt, how: v.how, note: v.note || '', t: faDateTime(), by: userName() });
      var ax = ptfAdvanceNormalize(o);
      o.advance.paid = ax.paid; o.advance.paidT = ax.paid ? faDateTime() : ''; o.advance.paidBy = ax.paid ? userName() : ''; o.advance.paidHow = ax.paid ? v.how : '';
      setData('ptf_crm_offers', offers);
      audit('مطالبات', 'ثبت وصول پیش‌پرداخت ' + amt.toLocaleString('fa-IR') + ' ریال', no);
      renderReceivables(); if (typeof ptfToast === 'function') ptfToast('وصول پیش‌پرداخت ثبت شد', 'ok');
    } });
  };
  window.advancePayDel = function (no, payCd) {
    var offers = getData('ptf_crm_offers'); var o = offers.filter(function (x) { return x.no === no; })[0]; if (!o || !o.advance) return;
    if (!confirm('این پرداخت/وصول از پیش‌پرداخت حذف شود؟')) return;
    o.advance.payments = (o.advance.payments || []).filter(function (p) { return p.cd !== payCd; });
    var ax = ptfAdvanceNormalize(o);
    o.advance.paid = ax.paid; if (!ax.paid) { o.advance.paidT = ''; o.advance.paidBy = ''; o.advance.paidHow = ''; }
    setData('ptf_crm_offers', offers);
    audit('مطالبات', 'حذف یک ثبت وصول از پیش‌پرداخت', no);
    renderReceivables(); if (typeof ptfToast === 'function') ptfToast('ثبت وصول حذف شد', 'warn');
  };

  /* ============ روتینگ تنخواه ============ */
  var _go = window.goPanel;
  window.goPanel = function (id, btn) {
    if (id === 'petty') {
      var btns = document.querySelectorAll('.sb-i'); for (var i = 0; i < btns.length; i++) btns[i].classList.remove('act');
      if (btn) btn.classList.add('act'); document.getElementById('pgTitle').textContent = '🏛 هاب مالی';
      document.getElementById('panels').innerHTML = buildPetty(); renderPetty(); return;
    }
    _go(id, btn);
  };
})();

// v30.5: بستن خودکار گزارش ماه قبل + گردش بانک + ارجاع به حسابدار
window.ptfPettyPrevMonth = function(){
  try{
    var now=new Date();
    var y=now.getFullYear(), m=now.getMonth(); // 0-based, m-1 = prev month
    var prev=new Date(y, m-1, 1);
    var jyStr = new Intl.DateTimeFormat('fa-IR-u-nu-latn',{year:'numeric',month:'2-digit'}).format(prev);
    var parts=jyStr.split('/'); return parts[0]+'/'+('0'+parts[1]).slice(-2);
  }catch(e){
    try{ var s=faMonthNow().split('/'); var yy=parseInt(s[0],10); var mm=parseInt(s[1],10)-1; if(mm<=0){ mm=12; yy--; } return yy+'/'+('0'+mm).slice(-2); }catch(e2){ return ''; }
  }
};

window.ptfPettyAutoCloseCheck = function(){
  try{
    if(typeof isTreasurer!=='function' || !isTreasurer()) return;
    var prev=window.ptfPettyPrevMonth();
    if(!prev) return;
    var periods=getData('ptf_crm_petty_periods')||[];
    if(periods.some(function(p){ return p.month===prev; })) return; // قبلاً بسته شده
    var today=new Date().getDate();
    if(today>5) return; // فقط 5 روز اول ماه بعد پیشنهاد بده
    var data=window.ptfPettyPeriodData(prev);
    if(!data || (!data.petty.length && !data.tx.length)) return;
    if(typeof ptfToast==='function'){
      ptfToast('📅 گزارش تنخواه ماه '+prev+' آماده بستن است - موجودی: '+(data.balance||0).toLocaleString('fa-IR')+' ریال', 'info');
    }
    // نوتفیکیشن به حسابدار هم
    if(confirm('📅 گزارش تنخواه ماه قبل ('+prev+') آماده است:\n\nگردش: '+(data.totalOut||0).toLocaleString('fa-IR')+' ریال\nمانده: '+(data.balance||0).toLocaleString('fa-IR')+' ریال\n'+data.petty.length+' هزینه\n\nالان گزارش را ببندیم و به حسابدار ارجاع دهیم؟ (می‌توانید گردش بانک را هم پیوست کنید)')){
      pettyClosePeriod();
    }
  }catch(e){}
};

// اجرای چک خودکار بعد از لود
setTimeout(window.ptfPettyAutoCloseCheck, 4000);
