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
  /* v34.1 BUG-PETTY-PERIOD: لاتین‌سازی ارقام فارسی قبل از slice */
  function toLatinDigits(s) { return String(s||'').replace(/[۰-۹]/g,function(d){return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d);}).replace(/[٠-٩]/g,function(d){return '٠١٢٣٤٥٦٧٨٩'.indexOf(d);}); }
  function recMonth(x) { return toLatinDigits(x.month) || toLatinDigits(x.t || '').slice(0, 7) || faMonthNow(); }
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

  /* MOB-041: کنترل‌های تنخواه در موبایل پیش‌تر به آیکون‌های مبهم 44px تبدیل
     می‌شدند. هر action اکنون icon/label جدا، title و aria-label دارد. */
  function pettyToolbarAction(kind, icon, label, title, onClick, primary) {
    return '<button type="button" class="bt' + (primary ? '' : ' bt-o') + ' petty-toolbar-action petty-toolbar-' + kind + '" data-petty-action="' + kind + '" title="' + escP(title || label) + '" aria-label="' + escP(title || label) + '" onclick="' + onClick + '">' +
      '<span class="petty-toolbar-icon" aria-hidden="true">' + icon + '</span><span class="petty-toolbar-label">' + label + '</span></button>';
  }
  window.buildPetty = function () {
    /* id برای اینکه financehub بتواند header/فیلتر تنخواه را در تب‌های دیگر
       واقعاً پنهان کند؛ wrapper مستقل، با rule عمومی .sb2 تداخل ندارد. */
    var filters = (isMgr() ? '<select id="ptFilter" onchange="renderPetty()" aria-label="فیلتر ثبت‌کننده تنخواه"><option value="">همه کاربران</option></select>' : '') +
      (typeof window.ptfSortSelectHtml === 'function' ? window.ptfSortSelectHtml('petty', [
        { key: 't', dir: 'desc', lb: '🕒 جدیدترین' }, { key: 't', dir: 'asc', lb: '🕒 قدیمی‌ترین' },
        { key: 'amt', dir: 'desc', lb: '💰 بیشترین مبلغ' }, { key: 'amt', dir: 'asc', lb: '💰 کمترین مبلغ' },
        { key: 'by', dir: 'asc', lb: '👤 ثبت‌کننده' }
      ]) : '');
    var actions = pettyToolbarAction('report', '📊', 'گزارش دوره', 'گزارش تنخواه با بازهٔ دلخواه', 'ptfPettyPeriodReportDialog()', false) +
      pettyToolbarAction('add', '➕', 'ثبت هزینه', 'ثبت هزینهٔ جدید تنخواه', 'pettyAdd()', true) +
      (isTreasurer() ? pettyToolbarAction('direct', '💳', 'پرداخت مستقیم', 'ثبت پرداخت مستقیم از حساب تنخواه', 'pettyDirectPay()', true) +
        pettyToolbarAction('charge', '💰', 'شارژ حساب', 'شارژ حساب تنخواه', 'pettyCharge()', true) +
        pettyToolbarAction('refer', '📨', 'ارجاع دوره', 'ارجاع دورهٔ تنخواه به حسابداری', 'pettyClosePeriod()', false) : '');
    return '<div class="ph" id="ptPettyHead"><h3>🏛 هاب مالی</h3>' +
      '<div class="pt-petty-toolbar" id="ptToolbar"><div class="pt-petty-filters">' + filters + '</div><div class="pt-petty-actions" role="group" aria-label="عملیات تنخواه">' + actions + '</div></div></div>' +
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
      var files = (p.files || []).map(function (f) { return '<a href="javascript:void(0)" onclick="openStoredFile(\'' + ptfOnClickArg(f.key || '') + '\')">📎' + escP(f.name || 'فایل') + '</a>'; }).join(' ');
      /* UR-11: دوره‌های جدید بازه [from,to] دارند؛ قدیمی‌ها فقط month (سازگاری) */
      var rng = (p.from && p.to) ? ('از ' + p.from + ' تا ' + p.to) : ('ماه ' + (p.month || '-'));
      var arg = (p.from && p.to) ? (escP(p.from) + '|' + escP(p.to)) : escP(p.month || '');
      var acts = '<button class="bt bt-o" style="padding:4px 10px;font-size:12px" onclick="ptfPettyPeriodReport(\'' + arg + '\')">📊 گزارش دوره</button>' +
        '<button class="bt bt-o" style="padding:4px 10px;font-size:12px;color:#1d4ed8" onclick="ptfPettyPeriodCombinedPdf(\'' + arg + '\')" title="گزارش + رسیدها در یک PDF با شناسهٔ هر رسید">📎 PDF تلفیقی</button>';
      if (isAccountant() && p.st === 'referred') acts += '<button class="bt" style="padding:4px 10px;font-size:12px;background:#059669" onclick="pettyPeriodRegistered(\'' + p.cd + '\')">ثبت در حسابداری</button>';
      if (isTreasurer() && p.st === 'referred') acts += '<button class="bt bt-o" style="padding:4px 10px;font-size:12px" onclick="pettyAttachBank(\'' + p.cd + '\')">پیوست صورتحساب</button>';
      var st = p.st === 'registered' ? '<span class="bd b-st4">ثبت‌شده</span>' : '<span class="bd" style="background:#dbeafe;color:#1d4ed8">ارجاع‌شده</span>';
      return '<div style="background:#fff;border:1px solid var(--brd);border-radius:12px;padding:9px 12px;margin-bottom:6px;font-size:12.5px;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><span><b>دوره ' + escP(rng) + '</b> — ' + st + '<br><small style="color:#64748b">گردش: ' + money(p.totalOut || 0) + ' | شارژ: ' + money(p.charges || 0) + ' | مانده: ' + money(p.balance || 0) + ' | ' + escP(p.t || '') + '</small>' + (files ? '<br><small>' + files + '</small>' : '') + '</span><span>' + acts + '</span></div>';
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
      var files = (x.files || []).map(function (f) { return '<a href="javascript:void(0)" onclick="openStoredFile(\'' + ptfOnClickArg(f.key || '') + '\')" style="color:#0e7490">📎' + escP(f.name) + '</a>'; }).join(' ');
      var isVoid = x.st === 'void';
      var canEdit = !isVoid && ((x.by === me.name) || canAll());
      var acts = '';
      if (canEdit) {
        acts = '<button class="bt bt-o" style="padding:3px 8px;font-size:11px" onclick="pettyEdit(\'' + x.cd + '\')">✏️</button>' +
               '<button class="bt bt-o" style="padding:3px 8px;font-size:11px;color:#0e7490" onclick="ptfPettyFilesUi(\'' + x.cd + '\')" title="مدیریت اسناد (مشاهده/حذف/افزودن)">📎 اسناد</button>' +
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
        if (r) {
          r.files = r.files || [];
          /* UR-10: هر رسید شناسهٔ «سند N» می‌گیرد تا در PDF تلفیقی با ردیف گزارش مطابقت داده شود.
             شناسه فقط یک‌بار (اینجا) ساخته و روی خود فایل ذخیره می‌شود. */
          if (!f.petId) f.petId = window.ptfPettyNextPetId();
          r.petId = r.petId || f.petId;
          r.files.push(f); setData(PETTY_KEY, a);
        }
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
  /* v34.0.0-alpha (F4-5): لینک دوطرفهٔ تنخواه ↔ پرونده
     - costEvent از deal قدیمی حذف شود (اگر oldDealRef داده شده)
     - costEvent به deal جدید اضافه شود (اگر newDealRef داده شده) */
  window.ptfPettyUpdateDealLink = function (r, newDealRef, oldDealRef) {
    if (typeof window.ptfDealCostSync === 'function') {
      window.ptfDealCostSync({
        rec: r, source: 'petty', dealCd: newDealRef || '', prevDealCd: oldDealRef || '',
        by: userName(),
        addTx: '🔗 لینک هزینه تنخواه ' + (r.cd || '') + ' (' + money(r.amt) + ' — ' + (r.desc || r.cat || '') + ') به پرونده',
        removeTx: '🔗 حذف لینک هزینه تنخواه ' + (r.cd || '') + ' (' + money(r.amt) + ') از پرونده'
      });
      return;
    }
    try {
      var ds = getData('ptf_crm_deals') || [];
      var dirty = false;
      if (oldDealRef && oldDealRef !== newDealRef) {
        var od = ds.filter(function (x) { return x.cd === oldDealRef; })[0];
        if (od && od.costEvents) {
          var beforeCount = od.costEvents.length;
          od.costEvents = od.costEvents.filter(function (x) { return x.pettyCd !== r.cd && x.cd !== r.cd; });
          if (od.costEvents.length !== beforeCount) {
            od.timeline = od.timeline || [];
            od.timeline.push({ t: faDateTime(), by: userName(), tx: '🔗 حذف لینک هزینه تنخواه ' + r.cd + ' (' + money(r.amt) + ') از پرونده' });
            dirty = true;
          }
        }
      }
      if (newDealRef) {
        var nd = ds.filter(function (x) { return x.cd === newDealRef; })[0];
        if (nd) {
          nd.costEvents = nd.costEvents || [];
          nd.costEvents = nd.costEvents.filter(function (x) { return x.pettyCd !== r.cd && x.cd !== r.cd; });
          nd.costEvents.unshift({ cd: r.cd, amt: r.amt, cat: 'fromPetty', desc: '[تنخواه] ' + (r.desc || r.cat), by: r.by, t: r.t || faDateTime(), files: r.files || [], fromPetty: true, pettyCd: r.cd });
          nd.timeline = nd.timeline || [];
          nd.timeline.push({ t: faDateTime(), by: userName(), tx: '🔗 لینک هزینه تنخواه ' + r.cd + ' (' + money(r.amt) + ' — ' + (r.desc || r.cat) + ') به پرونده' });
          dirty = true;
        }
      }
      if (dirty) setData('ptf_crm_deals', ds);
    } catch (eUd) { console.error('ptfPettyUpdateDealLink:', eUd); }
  };

  /* ============ F4-5: helper functions برای لینک دوطرفه تنخواه ↔ پرونده ============ */
  /* v34.0.0-alpha (F4-5): جلوگیری از ثبت تکراری + پیشنهاد هزینه‌های مرتبط */
  window.ptfPettyRelatedCosts = function (dealCd) {
    if (!dealCd) return [];
    return (getData(PETTY_KEY) || []).filter(function (p) { return p.dealRef === dealCd; });
  };
  window.ptfPettyWarnDuplicate = function (newRec) {
    if (!newRec || !newRec.cat) return null;
    var now = new Date().getTime();
    var ms30 = 30 * 24 * 60 * 60 * 1000;
    var candidates = (getData(PETTY_KEY) || []).filter(function (p) {
      if (p.cd === newRec.excludeCd) return false;
      if (p.st === 'void') return false;
      if (newRec.dealRef && p.dealRef !== newRec.dealRef) return false;
      if (!newRec.dealRef && p.dealRef) return false;
      if (p.cat !== newRec.cat) return false;
      if (Math.abs((+p.amt || 0) - (+newRec.amt || 0)) > ((+newRec.amt || 0) * 0.15)) return false;
      try {
        var pIso = (window.DateKit && window.DateKit.jToIso) ? window.DateKit.jToIso(p.t && p.t.split(' ')[0]) : '';
        if (pIso) {
          var pMs = new Date(pIso).getTime();
          if (Math.abs(now - pMs) > ms30) return false;
        }
      } catch (eTs) {}
      return true;
    });
    if (!candidates.length) return null;
    return candidates;
  };
  window.ptfPettyDealSummary = function (dealCd) {
    if (!dealCd) return '<small style="color:#64748b">💡 برای جلوگیری از ثبت تکراری، می‌توانید هزینه را به یک پروندهٔ فعال لینک کنید.</small>';
    var linked = window.ptfPettyRelatedCosts(dealCd);
    if (!linked.length) return '<small style="color:#64748b">📂 این پرونده هنوز هزینهٔ تنخواه لینک‌شده‌ای ندارد.</small>';
    var totalAmt = linked.reduce(function (s, p) { return s + (+p.amt || 0); }, 0);
    return '<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:8px 10px;margin:6px 0;font-size:12px;color:#0c4a6e">📂 <b>' + linked.length + ' هزینهٔ تنخواه لینک‌شده</b> (جمع: ' + totalAmt.toLocaleString('fa-IR') + ' ریال)</div>';
  };

  window.pettyAdd = function () {
    try{ var curM = (typeof faMonthNow==='function'?faMonthNow():'').split('/')[0]; if(curM && isFiscalLocked(curM)){ alert('🔒 سال مالی '+curM+' قفل است - ثبت هزینه در سال قفل‌شده مجاز نیست.'); return; } }catch(e){}
    var dealOpts = '<option value="">— مستقل از پرونده فروش —</option>' + (getData('ptf_crm_deals') || []).filter(function (d) { return d.wonOffer && d.st !== 'archived'; }).map(function (d) { return '<option value="' + escP(d.cd) + '">' + escP(d.inqNo || d.cd) + ' — ' + escP(d.buyerCo || '') + '</option>'; }).join('');
    ptfDialog({
      title: '💵 ثبت هزینه تنخواه',
      body: '<div style="font-size:12.5px;color:#475569;line-height:1.8;margin-bottom:8px">هزینهٔ تنخواه را ثبت کنید. در صورت لینک به پروندهٔ فعال، در سود پروژه لحاظ می‌شود.</div>' +
        '<div id="ptyDealSummarySlot">' + window.ptfPettyDealSummary('') + '</div>' +
        '<div id="ptyDupWarnSlot" style="display:none;background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:8px 10px;margin-top:6px;font-size:12px;color:#92400e"></div>',
      fields: [
        { id: 'amt', label: 'مبلغ (ریال)', type: 'number', required: true, dir: 'ltr' },
        { id: 'cat', label: 'نوع هزینه', type: 'select', options: CATS.map(function (c) { return { v: c, lb: c }; }) },
        { id: 'rfq', label: 'مربوط به درخواست/پرونده (اختیاری)', placeholder: 'مثال: PTF-RFQ-1405-0012', dir: 'ltr' },
        { id: 'dealRef', label: 'مربوط به کدام پرونده فروش؟ (اختیاری)', type: 'select', optionsHtml: dealOpts,
          onchange: 'try{var s=document.getElementById("ptyDealSummarySlot");if(s)s.innerHTML=ptfPettyDealSummary(this.value);}catch(e){}' },
        { id: 'desc', label: 'توضیح', type: 'textarea', rows: 2, required: true,
          oninput: 'try{var w=document.getElementById("ptyDupWarnSlot");if(!w)return;var deal=document.getElementById("ptfF3");var amt=document.getElementById("ptfF0");var cat=document.getElementById("ptfF1");var rec={cat:cat&&cat.value,amt:amt&&(+amt.value||0),desc:this.value,dealRef:deal&&deal.value};var dups=ptfPettyWarnDuplicate(rec);if(dups&&dups.length){var html="⚠️ <b>"+dups.length+" هزینهٔ مشابه</b> در ۳۰ روز اخیر یافت شد:<br>";dups.slice(0,3).forEach(function(p){html+="<div style=&quot;padding:3px 0;border-top:1px dashed #fde68a&quot;>• <b>"+p.cat+"</b> — "+(+p.amt).toLocaleString("fa-IR")+" ریال — "+escP(p.desc||"")+" ("+escP(p.t||"")+")</div>"});html+="<div style=&quot;margin-top:5px;font-size:11.5px&quot;>اگر تکراری است، «انصراف» بزنید.</div>";w.style.display="block";w.innerHTML=html;}else{w.style.display="none";}}catch(e){}' }
      ],
      okText: 'ثبت و پیوست مدرک',
      onOk: function (v) {
        var rec = { cd: genCode('PTY'), amt: toNum(v.amt), cat: v.cat, rfq: v.rfq, dealRef: v.dealRef||'', desc: v.desc, by: userName(), t: faDateTime(), iso: isoNow(), month: faMonthNow(), st: 'open', files: [] };
        var all = getData(PETTY_KEY); all.unshift(rec); setData(PETTY_KEY, all);
        // v30.5: اگر به پرونده لینک شد، costEvents بساز تا در سود پروژه بیاید ولی دوباره‌شماری نشود
        if(rec.dealRef){
          try { window.ptfPettyUpdateDealLink(rec, rec.dealRef, ''); } catch (e) {}
        }
        audit('تنخواه', 'ثبت هزینه/مطالبه تنخواه ' + money(rec.amt) + ' — ' + v.cat + (rec.dealRef?' [لینک پرونده '+rec.dealRef+']':''), rec.cd);
        renderPetty(); afterAddUpload(rec);
        if (typeof ptfConfirmCloudSave === 'function') ptfConfirmCloudSave('هزینه روی این دستگاه ثبت شد'); else if (typeof ptfToast === 'function') ptfToast('هزینه ثبت شد', 'ok');
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
        if (typeof ptfConfirmCloudSave === 'function') ptfConfirmCloudSave('شارژ روی این دستگاه ثبت شد'); else if (typeof ptfToast === 'function') ptfToast('شارژ حساب ثبت شد', 'ok');
      }
    });
  };

  window.pettySettle = function (cd) {
    if (!isTreasurer()) { alert('⛔ فقط تنخواه‌گردان'); return; }
    var rr = (getData(PETTY_KEY) || []).filter(function (x) { return x.cd === cd; })[0];
    if (!rr) return;
    /* P0-1 FIX: جلوگیری از تسویه تکراری — اگر قبلاً settled/void شده، مسدود شود */
    if (rr.st === 'settled') { alert('⛔ این هزینه قبلاً تسویه شده است (سند: ' + (rr.settleDoc || '-') + '). برای اصلاح از ویرایش استفاده کنید.'); return; }
    if (rr.st === 'void') { alert('⛔ این هزینه ابطال شده است و قابل تسویه نیست.'); return; }
    if (!ensureBalance(rr.amt)) return;
    ptfDialog({
      title: '✔ تسویه از حساب تنخواه',
      fields: [{ id: 'doc', label: 'شماره/شرح سند پرداخت', required: true, placeholder: 'مثال: حواله بانکی 12345' }],
      okText: 'ثبت تسویه',
      onOk: function (v) {
        var all = getData(PETTY_KEY); var r = all.filter(function (x) { return x.cd === cd; })[0]; if (!r) return;
        /* P0-1 FIX: re-check بعد از باز شدن دیالوگ (race condition: کاربر دیگری ممکن است در همین لحظه تسویه کرده باشد) */
        if (r.st === 'settled') { alert('⛔ این هزینه در همین لحظه توسط کاربر دیگری تسویه شد.'); return; }
        if (r.st === 'void') { alert('⛔ این هزینه ابطال شده است.'); return; }
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
    /* v34.0.0-alpha (F4-5): dealOpts برای فیلد dealRef در ویرایش */
    var dealOpts = '<option value="">— مستقل از پرونده فروش —</option>' + (getData('ptf_crm_deals') || []).filter(function (d) { return d.wonOffer && d.st !== 'archived'; }).map(function (d) { return '<option value="' + escP(d.cd) + '"' + (d.cd === r.dealRef ? ' selected' : '') + '>' + escP(d.inqNo || d.cd) + ' — ' + escP(d.buyerCo || '') + '</option>'; }).join('');
    ptfDialog({
      title: '✏️ ویرایش هزینه تنخواه — ' + cd,
      body: (isSettledAmountChange ? '⚠️ این هزینه تسویه شده است. اصلاح مبلغ فقط برای مدیر/تنخواه‌گردان مجاز است و تراکنش حساب تنخواه هم به‌طور هم‌زمان اصلاح می‌شود.' : '') +
        '<div id="ptyDealSummarySlot">' + window.ptfPettyDealSummary(r.dealRef || '') + '</div>',
      fields: [
        { id: 'amt', label: 'مبلغ (ریال)', type: 'number', value: r.amt, required: true, dir: 'ltr' },
        { id: 'cat', label: 'نوع هزینه', type: 'select', value: r.cat, options: CATS.map(function (c) { return { v: c, lb: c }; }) },
        { id: 'rfq', label: 'مربوط به درخواست/پرونده (اختیاری)', value: r.rfq || '', placeholder: 'مثال: PTF-RFQ-1405-0012', dir: 'ltr' },
        { id: 'dealRef', label: 'مربوط به کدام پرونده فروش؟ (اختیاری)', type: 'select', optionsHtml: dealOpts,
          onchange: 'try{var s=document.getElementById("ptyDealSummarySlot");if(s)s.innerHTML=ptfPettyDealSummary(this.value);}catch(e){}' },
        { id: 'desc', label: 'توضیح', type: 'textarea', rows: 2, value: r.desc || '', required: true }
      ].concat(isSettledAmountChange ? [{ id: 'reason', label: 'دلیل اصلاح مبلغ تسویه‌شده *', type: 'textarea', rows: 2, required: true, placeholder: 'مثال: مبلغ اشتباه وارد شده بود' }] : []),
      okText: 'ذخیره تغییرات',
      onOk: function (v) {
        var amt = toNum(v.amt);
        var amtChanged = amt !== r.amt;
        /* v34.0.0-alpha (F4-5): مدیریت تغییر dealRef */
        var newDealRef = v.dealRef || '';
        var dealRefChanged = newDealRef !== (r.dealRef || '');
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
          var oldDealRef = r.dealRef || '';
          r.amt = amt; r.cat = v.cat; r.rfq = v.rfq; r.desc = v.desc; r.editedT = faDateTime(); r.editedBy = userName();
          r.dealRef = newDealRef;
          r.amountCorrections = r.amountCorrections || [];
          r.amountCorrections.push({ from: oldAmt, to: amt, reason: v.reason.trim(), t: faDateTime(), by: userName() });
          setData(PETTY_KEY, all);
          if (dealRefChanged || newDealRef) { try { window.ptfPettyUpdateDealLink(r, newDealRef, oldDealRef); } catch (eU) { console.warn('updateDealLink:', eU); } }
          audit('تنخواه', 'اصلاح مبلغ هزینه تسویه‌شده ' + cd + ' — ' + money(oldAmt) + ' → ' + money(amt) + ' — دلیل: ' + v.reason.trim() + (dealRefChanged ? ' [لینک پرونده: ' + (newDealRef || 'حذف') + ']' : ''), cd);
          renderPetty();
          if (typeof ptfConfirmCloudSave === 'function') ptfConfirmCloudSave('مبلغ روی این دستگاه اصلاح شد'); else if (typeof ptfToast === 'function') ptfToast('مبلغ اصلاح شد', 'ok');
          return;
        }
        var oldDealRef2 = r.dealRef || '';
        r.amt = amt; r.cat = v.cat; r.rfq = v.rfq; r.desc = v.desc; r.editedT = faDateTime(); r.editedBy = userName();
        r.dealRef = newDealRef;
        setData(PETTY_KEY, all);
        if (dealRefChanged) { try { window.ptfPettyUpdateDealLink(r, newDealRef, oldDealRef2); } catch (eU) { console.warn('updateDealLink:', eU); } }
        audit('تنخواه', 'ویرایش هزینه تنخواه ' + cd + ' — ' + money(amt) + (dealRefChanged ? ' [لینک پرونده: ' + (newDealRef || 'حذف شد') + ']' : ''), cd);
        renderPetty();
        if (typeof ptfConfirmCloudSave === 'function') ptfConfirmCloudSave('هزینه روی این دستگاه ویرایش شد'); else if (typeof ptfToast === 'function') ptfToast('هزینه ویرایش شد', 'ok');
      }
    });
  };

  /* ================= v34.0.20-alpha (فاز ۱۸): مدیریت اسناد تنخواه =================
     مودال مشاهده/حذف/افزودن سند برای هر هزینهٔ تنخواه — رفع «فایل قابل مشاهده/حذف نیست». */
  window.ptfPettyFilesUi = function (cd) {
    var all = getData(PETTY_KEY);
    var r = all.filter(function (x) { return x.cd === cd; })[0];
    if (!r) {
      /* CHQ-DOC-002: اگر رکورد در localStorage محلی هنوز نیست (مثلاً همین الان از
         دستگاه/کاربر دیگر ثبت شده و pull دورهٔ ۲۰ثانیه‌ای هنوز نرسیده)، یک pull فوری
         بزن و یک‌بار دوباره امتحان کن — قبلاً این حالت بی‌صدا هیچ پنجره‌ای باز نمی‌کرد. */
      if (typeof window.ptfSyncPullNow === 'function' && !window._ptfPettyFilesRetrying) {
        window._ptfPettyFilesRetrying = true;
        window.ptfSyncPullNow(function () {
          window._ptfPettyFilesRetrying = false;
          var again = (getData(PETTY_KEY) || []).filter(function (x) { return x.cd === cd; })[0];
          if (again) window.ptfPettyFilesUi(cd);
          else alert('این رکورد تنخواه یافت نشد.');
        });
      } else {
        alert('این رکورد تنخواه یافت نشد.');
      }
      return;
    }
    var z = (typeof window.ptfTopZIndex === 'function') ? window.ptfTopZIndex(2750) : 2750;
    var rows = (r.files || []).map(function (f) {
      var key = String(f.key || '').replace(/[\\']/g, '');
      return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px dashed var(--brd);flex-wrap:wrap">' +
        '<a href="javascript:void(0)" onclick="openStoredFile(\'' + key + '\')" style="color:#0e7490;flex:1;min-width:120px">📎 ' + escP(f.name || 'فایل') + '</a>' +
        '<button class="ba" style="color:#dc2626" onclick="pettyRemoveFile(\'' + ptfOnClickArg(cd) + '\',\'' + key + '\')">✕ حذف</button></div>';
    }).join('') || '<div style="color:#94a3b8;font-size:12px;padding:6px 0">سندی ثبت نشده است.</div>';
    var html = '<div class="md-b" id="ptfPettyFilesDlg" style="display:grid;z-index:' + z + '" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:560px">' +
      '<h3>📎 اسناد هزینهٔ تنخواه — ' + escP(r.cat || '') + ' ' + money(r.amt) + '</h3>' + rows +
      '<div id="ptyFilesUp" style="margin-top:10px"></div>' +
      '<div style="display:flex;justify-content:flex-end;margin-top:10px"><button class="bt" onclick="document.getElementById(\'ptfPettyFilesDlg\').remove()">تمام</button></div></div></div>';
    (document.getElementById('panels') || document.body).insertAdjacentHTML('beforeend', html);
    window._ptfPettyFilesCd = cd;
    try { if (typeof attachUploadWidget === 'function') attachUploadWidget('ptyFilesUp', 'petty/' + cd, function (f) {
      var a = getData(PETTY_KEY); var rr = a.filter(function (x) { return x.cd === cd; })[0]; if (!rr) return;
      rr.files = rr.files || []; rr.files.push(f); rr.updatedAtISO = new Date().toISOString(); rr.updatedBy = userName(); setData(PETTY_KEY, a);
      if (typeof ptfConfirmCloudSave === 'function') ptfConfirmCloudSave('سند روی این دستگاه افزوده شد'); else if (typeof ptfToast === 'function') ptfToast('سند افزوده شد', 'ok');
      var d = document.getElementById('ptfPettyFilesDlg'); if (d) d.remove(); window.ptfPettyFilesUi(cd);
    }); } catch (eU) {}
    /* CHQ-DOC-002: اگر سندی از دستگاه/کاربر دیگر تازه ثبت شده و هنوز به این مرورگر
       نرسیده، یک pull فوری بزن و اگر تعداد اسناد واقعاً تغییر کرد، مودال را خودکار
       به‌روز کن — دیگر نیازی به رفتن به تب دیگر و برگشتن نیست. */
    if (typeof window.ptfAttachRefreshOnOpen === 'function') {
      window.ptfAttachRefreshOnOpen('ptfPettyFilesDlg', function () {
        var rr = (getData(PETTY_KEY) || []).filter(function (x) { return x.cd === cd; })[0];
        return (rr && rr.files || []).map(function (f) { return f.key; });
      }, function () { window.ptfPettyFilesUi(cd); });
    }
  };

  window.pettyRemoveFile = function (cd, key) {
    if (!confirm('این سند از تنخواه و فضای ابری حذف شود؟')) return;
    if (typeof window.ptfDeleteStoredFile !== 'function') { alert('سرویس حذف فایل آماده نیست؛ صفحه را تازه کنید.'); return; }
    window.ptfDeleteStoredFile(key, function (res) {
      if (!res.ok) { if (typeof ptfToast === 'function') ptfToast('⛔ سند حذف نشد: ' + res.error, 'warn'); else alert(res.error); return; }
      var a = getData(PETTY_KEY); var r = a.filter(function (x) { return x.cd === cd; })[0]; if (!r) return;
      r.files = (r.files || []).filter(function (f) { return f.key !== key; });
      r._deletedFileKeys = (r._deletedFileKeys || []).concat([key]).filter(function (v, i, all) { return v && all.indexOf(v) === i; });
      r.updatedAtISO = new Date().toISOString(); r.updatedBy = userName();
      setData(PETTY_KEY, a);
      if (typeof ptfConfirmCloudSave === 'function') ptfConfirmCloudSave('حذف سند روی این دستگاه ثبت شد'); else if (typeof ptfToast === 'function') ptfToast('سند از رکورد و فضای ابری حذف شد', 'warn');
      var d = document.getElementById('ptfPettyFilesDlg'); if (d) d.remove(); window.ptfPettyFilesUi(cd);
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
      /* v34.0.0-alpha (F4-5): حذف costEvent مرتبط (اگر هنوز هست) */
      try { window.ptfPettyUpdateDealLink(r, '', r.dealRef); } catch (eU) { console.warn('updateDealLink void:', eU); }
      audit('تنخواه', 'ابطال هزینه تسویه‌شده '+cd+' — دلیل: '+reason.trim(), cd);
      renderPetty();
      if (typeof ptfConfirmCloudSave === 'function') ptfConfirmCloudSave('ابطال روی این دستگاه ثبت شد'); else if(typeof ptfToast==='function') ptfToast('هزینه ابطال شد', 'ok');
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
    if (typeof ptfConfirmCloudSave === 'function') ptfConfirmCloudSave('حذف هزینه روی این دستگاه ثبت شد'); else if (typeof ptfToast === 'function') ptfToast('هزینه حذف شد', 'warn');
  };

  /* ============ UR-11: دورهٔ بازه‌ای تنخواه — از آخرین ارجاع تا تاریخ انتخابی ============ */
  /* BUG-RANGE (۱۴۰۵/۰۸/۱۰): تاریخ رکورد باید مقاوم باشد — رکوردها ممکن است:
     ۱) t شمسی '1405/04/15 09:00'  ۲) t/dateISO میلادی '2026-07-06'  ۳) فقط month '1405/04'
     قبلاً فقط حالت ۱ خوانده می‌شد و بقیه از فیلتر بازه حذف می‌شدند → «هیچ اطلاعاتی در قالب تنخواه‌گردان». */
  /* v34.0.0-alpha (F4-13): تاریخ رکورد با دقت — تشخیص میلادی/شمسی بر اساس سال
     ریشه: padJalaliDate قبلی هر رشتهٔ YYYY/MM/DD را بدون تشخیص میلادی/شمسی normalize می‌کرد.
       اگر t میلادی بود (مثل '2026-07-22' یعنی ۱ مرداد ۱۴۰۵) و month شمسی بود
       (1405/05) → recDate برمی‌گشت '2026/07/22' (میلادی به جای شمسی).
       نتیجه: recDateCmp(d='2026/07/22', '1405/05/01') = عدد ۲۰۲۶۰۷۲۲ vs ۱۴۰۵۰۵۰۱
       → ۲۰۲۶۰۷۲۲ > ۱۴۰۵۰۵۰۱ (عدد بزرگ‌تر) → در بازه نیست → رکورد مرداد حذف شد!
     راه‌حل: ابتدا تشخیص میلادی/شمسی بر اساس سال (میلادی > ۱۹۰۰). سپس اگر میلادی، ابتدا به شمسی تبدیل شود. */
  function recDate(x) {
    if (!x) return '';
    function latinDigits(s) {
      return String(s || '').replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); })
        .replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); });
    }
    function padJalaliDate(s) {
      var m = String(s || '').match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
      if (!m) return '';
      return m[1] + '/' + ('0' + m[2]).slice(-2) + '/' + ('0' + m[3]).slice(-2);
    }
    function fromYmd(raw0) {
      var raw = latinDigits(raw0).replace(/[\u200c\u200e\u200f\u202a-\u202e]/g, '').replace(/[،,]/g, ' ').trim();
      var first = raw.split(/\s+/)[0] || '';
      var m = first.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
      if (m) {
        var y = +m[1];
        var packed = m[1] + '/' + m[2] + '/' + m[3];
        if (y > 1900) {
          if (typeof ptfISOToJ === 'function') {
            try {
              var j = ptfISOToJ(m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2));
              if (j) { var s2 = padJalaliDate(j); if (s2) return s2; }
            } catch (eR1) {}
          }
          return '';
        }
        return padJalaliDate(packed);
      }
      var months = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
      var named = latinDigits(raw).match(/(\d{1,2})\s*(فروردین|اردیبهشت|خرداد|تیر|مرداد|شهریور|مهر|آبان|آذر|دی|بهمن|اسفند)\s*(\d{4})/);
      if (named) {
        var mi = months.indexOf(named[2]) + 1;
        return padJalaliDate(named[3] + '/' + mi + '/' + named[1]);
      }
      if (/^\d{4}-\d{2}-\d{2}/.test(first) && typeof ptfISOToJ === 'function') {
        try { var j2 = ptfISOToJ(first.slice(0, 10)); if (j2) return padJalaliDate(j2); } catch (eR) {}
      }
      return '';
    }
    var fields = [x.t, x.dateFa, x.date, x.dateISO, x.iso];
    for (var fi = 0; fi < fields.length; fi++) {
      if (!fields[fi]) continue;
      var hit = fromYmd(fields[fi]);
      if (hit) return hit;
    }
    var m2 = latinDigits(x.month || '').trim();
    var mp = padJalaliDate(m2 + '/01');
    if (mp) return mp;
    return '';
  }
  /* v34.0.0-alpha (F4-10): تبدیل تاریخ شمسی به عدد YYYYMMDD برای مقایسهٔ صحیح
     - قبلاً مقایسهٔ string بین "1405/5/1" و "1405/04/16" نتیجهٔ غلط می‌داد
     - حالا هر دو به عدد تبدیل می‌شوند: "14050401" < "14050416" → true (همیشه درست)
     - پشتیبان: اگر parse نشد، string comparison فقط برای فرمت normalize‌شدهٔ YYYY/MM/DD */
  function recDateNum(s) {
    if (!s || !/^\d{4}\/\d{2}\/\d{2}$/.test(s)) return 0;
    return +s.replace(/[\/\-]/g, '');
  }
  function recDateCmp(a, b) {
    var na = recDateNum(a), nb = recDateNum(b);
    if (na && nb) return na - nb;
    return String(a || '').localeCompare(String(b || ''));
  }
  function recTimeMin(x) {
    var raw = String((x && (x.t || x.iso || x.dateISO)) || '').replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }).replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); });
    var tm = raw.match(/(?:T|\s)(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!tm) return 0;
    return (+tm[1]) * 60 + (+tm[2]);
  }
  function recSortStamp(x) {
    var d = recDate(x);
    if (!d) return 0;
    return recDateNum(d) * 10000 + recTimeMin(x);
  }
  function faTodayStr() {
    try { if (typeof faDate === 'function') return faDate(); } catch (e) {}
    try { if (typeof ptfTodayJ === 'function') return ptfTodayJ(); } catch (e) {}
    return '';
  }
  window.ptfPettyDayAfter = function (d) {
    if (!d) return '';
    var m = String(d).match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (!m) return d;
    var y = +m[1], mo = +m[2], day = +m[3] + 1;
    var dim = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29][mo - 1] || 30;
    if (day > dim) { day = 1; mo++; if (mo > 12) { mo = 1; y++; } }
    return y + '/' + String(mo).padStart(2, '0') + '/' + String(day).padStart(2, '0');
  };
  /* بازهٔ پیشنهادی دورهٔ جاری: از روزِ پس از «تا» آخرین دورهٔ ارجاع‌شده تا امروز (قابل تغییر دلخواه توسط کاربر) */
  window.ptfPettySuggestedRange = function () {
    var to = faTodayStr();
    var from = '';
    var periods = prAll().filter(function (p) { return p.st === 'referred' || p.st === 'registered'; });
    var last = periods[0] || {};
    if (last.to) from = window.ptfPettyDayAfter(last.to);
    else if (last.month) from = window.ptfPettyDayAfter(String(last.month).slice(0, 7) + '/31');
    if (!from && to) from = String(to).slice(0, 7) + '/01';
    return { from: from || '', to: to || '' };
  };
  /* UR-11: دیالوگ انتخاب بازهٔ دلخواه (از تاریخ/تا تاریخ — هر بازه‌ای مثل ۱۰ روزه، ۴۵ روزه و…) برای گزارش
     — با تقویم شمسی (ptfDatePicker) و پذیرش فرمت‌های رایج (1405/04/01 یا 1405-04-01) */
  window.ptfPettyNormDate = function (s) {
    var v = String(s || '').trim();
    /* تبدیل ارقام فارسی/عربی به لاتین (تقویم/کاربر ممکن است ۱۴۰۵ وارد کند) */
    v = v.replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); })
         .replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); });
    var m = v.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
    if (!m) return v;
    return m[1] + '/' + String(+m[2]).padStart(2, '0') + '/' + String(+m[3]).padStart(2, '0');
  };
  /* v34.0.0-alpha (فاز ۴.۵): دیالوگ انتخاب بازه با DateKit.range
     - دو فیلد تاریخ (DateKit.picker با فلش‌های ناوبری fix شده)
     - quick-pick: امروز / ۷/۱۰/۱۵/۳۰ روز اخیر / این ماه / ماه قبل / امسال
     - range nav: جابجایی بازه با حفظ طول (−۱/۷ روز، −۱ ماه، +۱/۷ روز، +۱ ماه)
     - HTML modal سفارشی (نه ptfDialog) تا دکمه‌های ناوبری/quick-pick کار کنند
     - سازگاری: اگر DateKit هنوز لود نشده باشد، fallback به ptfDialog قدیمی */
  window.ptfPettyPeriodReportDialog = function () {
    var sg = window.ptfPettySuggestedRange();
    if (!window.DateKit) {
      /* fallback: اگر به هر دلیلی DateKit لود نشده (مثلاً نسخهٔ قدیمی کش) */
      ptfDialog({
        title: '📊 گزارش دورهٔ تنخواه — انتخاب بازه',
        body: 'بازهٔ دلخواه را انتخاب کنید (مثلاً ۱۰ روزه، ۴۵ روزه یا هر بازهٔ دیگر — بسته به مصرف تنخواه).',
        fields: [
          { id: 'from', label: 'از تاریخ', value: sg.from || '', required: true, dir: 'ltr', datePicker: true },
          { id: 'to', label: 'تا تاریخ', value: sg.to || '', required: true, dir: 'ltr', datePicker: true }
        ],
        okText: 'نمایش گزارش',
        onOk: function (v) {
          var from = window.ptfPettyNormDate(v.from), to = window.ptfPettyNormDate(v.to);
          if (!/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(from) || !/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(to)) { alert('⚠️ تاریخ‌ها را با فرمت 1405/04/01 وارد کنید (یا از دکمهٔ «انتخاب از تقویم» استفاده کنید).'); return; }
          if (from > to) { alert('⚠️ «از تاریخ» نمی‌تواند بعد از «تا تاریخ» باشد.'); return; }
          window.ptfPettyPeriodReport(from, to);
        }
      });
      return;
    }
    // FIX: اگر sg.from/to خالی بودند (مثلاً به دلیل نبودن دورهٔ قبلی)، از امروز به‌عنوان fallback استفاده کن
    var todayJ = (window.DateKit && window.DateKit.todayJ) ? window.DateKit.todayJ() : '';
    var fallbackFrom = todayJ ? (todayJ.slice(0, 7) + '/01') : '';  // اول ماه جاری
    var fallbackTo = todayJ;
    var initFrom = sg.from || fallbackFrom;
    var initTo = sg.to || fallbackTo;
    var widgetHtml = window.DateKit.range('ptfPettyFromJ', 'ptfPettyToJ', initFrom, initTo);
    var html = '<div class="md-b" style="display:grid;z-index:2700" onclick="if(event.target===this)this.remove()">' +
      '<div class="md" style="max-width:760px;max-height:90vh;overflow:auto">' +
        '<h3>📊 گزارش دورهٔ تنخواه — انتخاب بازه</h3>' +
        '<div style="font-size:12.5px;color:#475569;margin-bottom:10px;line-height:1.8">' +
          'بازهٔ دلخواه را انتخاب کنید. <b>quick-pick</b> برای بازه‌های رایج، و <b>دکمه‌های ناوبری</b> برای جابجایی سریع بازه فعلی با حفظ طول آن.' +
        '</div>' +
        widgetHtml +
        '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">' +
          '<button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">انصراف</button>' +
          '<button class="bt" onclick="ptfPettyRangeDialogGo()">📊 نمایش گزارش</button>' +
        '</div>' +
      '</div>' +
    '</div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };
  /* v34.0.0-alpha: handler دکمهٔ «نمایش گزارش» — مقادیر را از فیلدهای DateKit می‌خواند و validate می‌کند */
  window.ptfPettyRangeDialogGo = function () {
    var fEl = document.getElementById('ptfPettyFromJ');
    var tEl = document.getElementById('ptfPettyToJ');
    if (!fEl || !tEl) { alert('⚠️ فیلدهای تاریخ یافت نشد — صفحه را رفرش کنید.'); return; }
    var from = window.ptfPettyNormDate(fEl.value);
    var to = window.ptfPettyNormDate(tEl.value);
    if (!/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(from) || !/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(to)) {
      alert('⚠️ تاریخ‌ها را با فرمت 1405/04/01 وارد کنید (یا از دکمهٔ «انتخاب از تقویم» استفاده کنید، یا یکی از quick-pick ها را بزنید).');
      return;
    }
    if (from > to) { alert('⚠️ «از تاریخ» نمی‌تواند بعد از «تا تاریخ» باشد.'); return; }
    var md = document.querySelector('.md-b'); if (md) md.remove();
    window.ptfPettyPeriodReport(from, to);
  };
  /* کلید دوره: (from,to) → بازه | (month) → ماه | بدون آرگومان → دورهٔ جاری پیشنهادی */
  function ptfPettyPeriodKey(a, b) {
    /* UR-11 (رفع باگ): آرگومان می‌تواند یک رشتهٔ 'from|to' باشد (از renderPeriods) — split می‌شود */
    if (a && !b && String(a).indexOf('|') > -1) { var pr = String(a).split('|'); a = pr[0]; b = pr[1]; }
    if (a && b && String(a).length > 7) return { month: String(a).slice(0, 7), from: String(a), to: String(b), isRange: true };
    if (a) return { month: String(a), from: '', to: '', isRange: false };
    var sg = window.ptfPettySuggestedRange();
    return { month: sg.from ? sg.from.slice(0, 7) : faMonthNow(), from: sg.from, to: sg.to, isRange: !!(sg.from && sg.to) };
  }
  window.ptfPettyPeriodKey = ptfPettyPeriodKey;

  window.ptfPettyPeriodData = function (a, b) {
    var key = ptfPettyPeriodKey(a, b);
    var allP = getData(PETTY_KEY) || [], allT = txAll(), petty, tx;
    if (key.isRange) {
      /* v34.0.0-alpha (F4-6): رفع بحرانی — فیلتر recDate قبلی رکوردهایی که
         تاریخ دقیق `t` در بازه نبود را حذف می‌کرد (مثلاً اگر t = '2026-08-03'
         میلادی و بازه شمسی 1405/04/15 تا 1405/05/15 بود، recDate نمی‌توانست
         تبدیل کند و رکورد حذف می‌شد → "فقط هزینه آخر نمایش داده شد").
         منطق جدید:
         1) اگر تاریخ دقیق قابل استخراج باشد → مقایسه با بازه
         2) اگر نه ولی month در بازه باشد → نگه داشتن (fallback ماهانه) */
      var mFrom = key.from.slice(0, 7), mTo = key.to.slice(0, 7);
      function inRange(x) {
        var m = toLatinDigits(x.month || (x.t || '').slice(0, 7) || '').slice(0, 7);
        /* v34.0.15-alpha (فاز ۱۲ — رفع باگ «عدم نمایش هزینهٔ ماه بدون انتخاب روز اول»):
           قبلاً recDate هر رکوردی (حتی فقط‌ماه) را به روزِ اول ماه (مثلاً 1405/05/01) تبدیل
           می‌کرد و چون این مقدار در `if (d)` می‌افتاد، با تاریخِ دقیقِ بازه مقایسه می‌شد
           → اگر بازه از وسط ماه شروع می‌شد (مثلاً از 1405/05/15)، هزینهٔ همان ماه حذف می‌شد.
           راه‌حل: فقط وقتی مقایسهٔ دقیق انجام می‌شود که رکورد «تاریخ دقیق واقعی» دارد
           (t/date/dateISO/iso). اگر فقط `month` دارد (بدون تاریخ دقیق) → fallback ماهانه
           (ماهِ رکورد در بازه باشد → نگه دار). */
        var hasExact = !!(x.t || x.date || x.dateISO || x.iso || x.dateFa);
        var d = hasExact ? recDate(x) : '';
        if (hasExact && d) {
          return recDateCmp(d, key.from) >= 0 && recDateCmp(d, key.to) <= 0;
        }
        /* fallback: اگر تاریخ دقیق موجود نیست یا قابل استخراج نبود، ماه رکورد را با بازه مقایسه کن */
        return !!(m && m >= mFrom && m <= mTo);
      }
      petty = allP.filter(inRange);
      tx = allT.filter(inRange);
    } else {
      petty = allP.filter(function (x) { return recMonth(x) === key.month; });
      tx = allT.filter(function (x) { return recMonth(x) === key.month; });
    }
    var totalOut = tx.reduce(function (s, x) { return s + ((x.type === 'direct' || x.type === 'settle') ? +x.amt || 0 : 0); }, 0);
    var charges = tx.reduce(function (s, x) { return s + (x.type === 'charge' ? +x.amt || 0 : 0); }, 0);
    return { month: key.month, from: key.from, to: key.to, isRange: key.isRange, petty: petty, tx: tx, totalOut: totalOut, charges: charges, balance: window.ptfPettyBalance(), pending: window.ptfPettyPendingByUser() };
  };

  /* ============ UR-2026-08-01-09: گزارش کامل دورهٔ تنخواه (v2: با cd برای نگاشت ضمیمه) ============ */
  window.ptfPettyPeriodEvents = function (a, b) {
    var d = window.ptfPettyPeriodData(a, b), events = [];
    /* v34.0.2-alpha (گزارش دوره‌ای): رفع «ردیف‌های تکراری» — هر هزینهٔ تنخواه که
       تسویه/پرداخت‌مستقیم می‌شود، دو رکورد دارد: ردیف «هزینه» در ptf_crm_petty و
       تراکنش «تسویه از حساب»/«پرداخت مستقیم» در ptf_crm_petty_tx (با ref = شناسهٔ
       هزینه). قبلاً هر دو به‌عنوان ردیف مجزا چاپ می‌شدند → ظاهرِ «ردیف تکراری».
       حالا اگر تراکنش، همان پرداختِ یک هزینهٔ حاضر در همین دوره باشد، ردیفِ
       تراکنش حذف می‌شود و اطلاعات آن در ستون «نحوهٔ پرداخت» همان ردیف هزینه می‌آید.
       جمع‌ها دست نمی‌خورند (قبلاً هم جمع درست بود؛ فقط نمایش تکراری بود). */
    var pettyByCd = {};
    (d.petty || []).forEach(function (p) { if (p.cd) pettyByCd[p.cd] = 1; });
    (d.tx || []).forEach(function (x) {
      if ((x.type === 'direct' || x.type === 'settle') && x.ref && pettyByCd[x.ref]) return; /* همان پرداختِ هزینهٔ حاضر → حذف ردیف تکراری */
      var kind = x.type === 'charge' ? 'شارژ حساب' : x.type === 'direct' ? 'پرداخت مستقیم' : x.type === 'settle' ? 'تسویه از حساب' : (x.type || 'تراکنش');
      events.push({
        cd: x.cd,  /* v2: شناسه رکورد برای نگاشت file → row */
        t: x.t || x.date || '',
        desc: (x.note || x.desc || '') + (x.ref ? ' (' + x.ref + ')' : ''),
        by: x.by || '',
        amt: +x.amt || 0,
        kind: kind,
        status: x.type === 'charge' ? 'شارژ حساب' : (x.type === 'direct' ? 'پرداخت مستقیم از تنخواه' : (x.type === 'settle' ? 'تسویه از حساب' : ''))
      });
    });
    (d.petty || []).forEach(function (p) {
      /* UR-11: نحوهٔ پرداخت هر هزینه صریح است: مستقیم از تنخواه / تسویه‌شده با تاریخ و نام / در انتظار */
      var status = p.payMode === 'direct'
        ? 'پرداخت مستقیم از حساب تنخواه' + (p.settleDoc ? ' — سند: ' + p.settleDoc : '')
        : p.st === 'settled'
          ? 'تسویه در ' + (p.settledT || p.t || '') + ' توسط ' + (p.settledBy || p.by || '') + (p.settleDoc ? ' — سند: ' + p.settleDoc : '')
          : p.st === 'void' ? 'ابطال‌شده' : 'در انتظار تسویه';
      events.push({
        cd: p.cd,  /* v2: شناسه رکورد برای نگاشت file → row */
        t: p.t || '',
        desc: (p.cat || 'هزینه') + (p.desc ? ' — ' + p.desc : '') + (p.rfq ? ' (' + p.rfq + ')' : ''),
        by: p.by || '',
        amt: +p.amt || 0,
        kind: p.st === 'void' ? 'هزینه (ابطال‌شده)' : 'هزینه',
        status: status
      });
    });
    /* v34.0.12-alpha (فاز ۹ — گزارش دورهٔ تنخواه با ترتیب درست تاریخ): مرتب‌سازی قبلی فقط با
       `a.t` (رشتهٔ خام) انجام می‌شد؛ تاریخ‌ها در `t` با فرمت‌های ناهمگن‌اند (شمسی `1405/04/15`
       یا میلادی `2026-08-03` یا با ساعت). مقایسهٔ رشت‌های بین این فرمت‌ها ترتیب اشتباه می‌داد.
       حالا با recDate (نرمال‌سازی به شمسی YYYY/MM/DD) و recDateCmp (مقایسهٔ عددی YYYYMMDD) مرتب می‌شود؛
       رکوردِ بی‌تاریخ به انتها می‌رود. برای ثبات، رکوردهای هم‌تاریخ با cd/بدهکار مرتب می‌شوند. */
    events.sort(function (a, b) {
      var da = recDate(a) || '', db = recDate(b) || '';
      var c = recDateCmp(da, db);
      if (c !== 0) return c;
      /* هم‌تاریخ: رکوردِ دارای تاریخ دقیق زودتر (بی‌تاریخ آخر)؛ سپس ساعت همان روز؛ سپس شناسه */
      var ha = da ? 1 : 0, hb = db ? 1 : 0;
      if (ha !== hb) return hb - ha;
      var ta = recSortStamp(a), tb = recSortStamp(b);
      if (ta !== tb) return ta - tb;
      return String(a.cd || '').localeCompare(String(b.cd || ''));
    });
    events.forEach(function (e, i) { e.row = i + 1; });
    return events;
  };

  /* برچسب هدر دوره: «تنخواه‌گردان از تاریخ X تا تاریخ Y» یا «ماه …» (سازگاری با دادهٔ قدیمی) */
  window.ptfPettyRangeLabel = function (a, b) {
    var d = window.ptfPettyPeriodData(a, b);
    return (d.isRange && d.from && d.to) ? ('تنخواه‌گردان از تاریخ ' + d.from + ' تا تاریخ ' + d.to) : ('ماه ' + d.month);
  };

  /* جمع‌های زندهٔ دوره (هر لحظه از دادهٔ فعلی): خرج، شارژ، موجودی */
  window.ptfPettyPeriodTotals = function (a, b) {
    var d = window.ptfPettyPeriodData(a, b);
    var pettyOut = (d.petty || []).filter(function (p) { return p.st !== 'void'; }).reduce(function (s, p) { return s + (+p.amt || 0); }, 0);
    /* v34.0.2-alpha (گزارش دوره‌ای): جلوگیری از دوباره‌شماری پرداخت‌های مستقیم —
       رکورد «هزینهٔ مستقیم» در ptf_crm_petty هست و تراکنش direct (ref=شناسهٔ همان
       هزینه) هم در ptf_crm_petty_tx؛ قبلاً هر دو در totalOut می‌آمدند. حالا
       تراکنش‌های مستقیمی که به هزینهٔ حاضر در همین دوره وصل‌اند فقط یک بار
       (در pettyOut) شمرده می‌شوند. */
    var pettyByCd = {};
    (d.petty || []).forEach(function (p) { if (p.cd) pettyByCd[p.cd] = 1; });
    var directOut = (d.tx || []).filter(function (x) { return x.type === 'direct' && !(x.ref && pettyByCd[x.ref]); }).reduce(function (s, x) { return s + (+x.amt || 0); }, 0);
    /* BUG-TOTALS: موجودی شروع و پایان دوره — از تراکنش‌های قبل از بازه (شارژ/پرداخت/تسویه) */
    function txBalance(beforeDate) {
      return txAll().reduce(function (s, x) {
        var d0 = recDate(x);
        if (beforeDate && d0 && recDateCmp(d0, beforeDate) > 0) return s;
        var a = +x.amt || 0;
        if (x.type === 'charge') return s + a;
        if (x.type === 'direct' || x.type === 'settle') return s - a;
        return s;
      }, 0);
    }
    var fromDate = d.isRange ? d.from : '';
    var balanceStart = fromDate ? txBalance(window.ptfPettyDayAfter(fromDate)) : 0; /* قبل از شروع بازه (شامل روز شروع) */
    var balanceEnd = window.ptfPettyBalance(); /* موجودی لحظه‌ای کل */
    return { pettyOut: pettyOut, directOut: directOut, totalOut: pettyOut + directOut, charges: d.charges, balance: d.balance, balanceStart: balanceStart, balanceEnd: balanceEnd };
  };

  function ptfPettyRowHtml(e) {
    return '<tr><td>' + e.row + '</td><td>' + escP(e.t || '—') + '</td><td>' + escP(e.kind) + '</td><td>' + escP(e.desc || '—') + '</td><td>' + escP(e.by || '—') + '</td><td>' + escP(e.status || '—') + '</td><td>' + money(e.amt) + '</td></tr>';
  }
  /* BUG-TOTALS: ردیف‌های جمع در پایان جدول — مجموع هزینه‌ها / مجموع شارژ / موجودی شروع / موجودی پایان */
  function ptfPettyTotalsRowsHtml(t) {
    return '<tr style="background:#fef3c7;font-weight:bold"><td colspan="6">💸 مجموع هزینه‌های دوره</td><td>' + money(t.totalOut) + '</td></tr>' +
      '<tr style="background:#d1fae5;font-weight:bold"><td colspan="6">💰 مجموع شارژ دوره</td><td>' + money(t.charges) + '</td></tr>' +
      '<tr style="background:#f1f5f9;font-weight:bold"><td colspan="6">🏦 موجودی شروع دوره</td><td>' + money(t.balanceStart) + '</td></tr>' +
      '<tr style="background:#f1f5f9;font-weight:bold"><td colspan="6">🏦 موجودی پایان دوره</td><td>' + money(t.balanceEnd) + '</td></tr>';
  }
  window.ptfPettyTotalsRowsHtml = ptfPettyTotalsRowsHtml;
  function ptfPettyArg(a, b) { return (a && b && String(a).length > 7) ? a + '|' + b : (a || ''); }
  function ptfPettyArgPair(arg) { var p = String(arg || '').split('|'); return p.length === 2 ? p : [p[0], '']; }

  /* v34.0.0-alpha (F4-6): اصلاح بحرانی — متغیر `arg` تعریف نشده بود و
     منطق apply اشتباه بود. حالا arg از ابتدا محاسبه می‌شود. */
  window.ptfPettyPeriodShowReceipts = function (a, b) {
    /* v34.0.0-alpha (F4-6): ساخت arg در ابتدا — ارجاع در onclick بعداً به آن بستگی دارد */
    var arg = ptfPettyArg(a, b);
    /* ptfPettyPeriodFiles و ptfPettyPeriodEvents امضای (a,b) دارند — اگر a یک
       رشتهٔ 'from|to' باشد، باید [from, to] از آن استخراج شود (نه [a, b]). */
    var argPair = ptfPettyArgPair(arg);
    var files = window.ptfPettyPeriodFiles(argPair[0], argPair[1]);
    ptfPettyWaitShow('در حال آماده‌سازی فیش‌های پیوست… لطفاً منتظر بمانید');
    var jobs = files.map(function (f) { return window.ptfPettyResolveUrl(f); });
    Promise.all(jobs).then(function () {
      try {
        var events = window.ptfPettyPeriodEvents(argPair[0], argPair[1]);
        var rowByCd = {};
        events.forEach(function (e) { if (e.cd) rowByCd[e.cd] = e.row; });
        files.forEach(function (f) { if (f.cd && rowByCd[f.cd]) f.row = rowByCd[f.cd]; });
      } catch (eM2) { console.warn('map file→row:', eM2); }
      var convertJobs = files.filter(function (f) {
        var k = window.ptfPettyFileKind(f.name || f.key || '', f);
        return (k === 'pdf' || k === 'heic') && (f.key || (f.url && String(f.url).indexOf('data:') === 0));
      }).map(function (f) { return window.ptfPettyToJpeg(f); });
      return Promise.all(convertJobs);
    }).then(function () {
      var label = window.ptfPettyRangeLabel(argPair[0], argPair[1]);
      var html = '<div class="md-b" id="pettyPeriodReceiptsDlg" style="display:grid;z-index:4050" onclick="if(event.target===this)this.remove()">' +
        '<div class="md" style="max-width:1100px;max-height:92vh;overflow:auto;padding:18px">' +
        '<h3 style="margin:0 0 4px;font-size:15px">📎 فیش‌ها و ضمیمه‌های پرونده — ' + escP(label) + '</h3>' +
        '<div style="font-size:12px;color:#64748b;margin-bottom:12px;line-height:1.8">هر فیش با برچسب «ضمیمه ردیف N» (شماره ردیف در گزارش) و «سند M» (شناسهٔ پیوست) نمایش داده می‌شود. برای تطابق سریع چشمی.</div>' +
        (files.length ? window.ptfPettyReceiptsHtml(files) : '<div style="padding:18px;color:#94a3b8;text-align:center;font-size:13px">هیچ فیشی برای این دوره ثبت نشده است.</div>') +
        '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;border-top:1px solid var(--brd);padding-top:12px">' +
        '<button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button>' +
        /* v34.0.0-alpha (F4-6): arg به درستی در دکمهٔ PDF تلفیقی ارجاع می‌شود */
        '<button class="bt" onclick="this.closest(\'.md-b\').remove();ptfPettyPeriodCombinedPdf(\'' + arg + '\')">📎 دانلود PDF تلفیقی</button>' +
        '</div></div></div>';
      ptfPettyWaitHide();
      document.getElementById('panels').insertAdjacentHTML('beforeend', html);
    }).catch(function (eShow) { console.error('ptfPettyPeriodShowReceipts:', eShow); ptfPettyWaitHide(); if (typeof ptfToast === 'function') ptfToast('⚠️ خطا در نمایش ضمیمه‌ها: ' + (eShow.message || eShow), 'warn'); });
  };

  window.ptfPettyPeriodReport = function (a, b) {
    var events = window.ptfPettyPeriodEvents(a, b), t = window.ptfPettyPeriodTotals(a, b);
    var label = window.ptfPettyRangeLabel(a, b), arg = ptfPettyArg(a, b);
    var emptyMsg = 'رکوردی در این دوره ثبت نشده است';
    if (!events.length) {
      /* BUG-RANGE: راهنمای کاربر وقتی بازه خالی است */
      var dEmpty = window.ptfPettyPeriodData(a, b);
      var allC = (getData(PETTY_KEY) || []).length + txAll().length;
      if (allC > 0) emptyMsg = 'در بازهٔ انتخابی رکوردی نیست — ' + allC + ' رکورد تنخواه در سیستم هست؛ بازه را گسترش دهید یا تاریخ‌ها را بررسی کنید.';
    }
    var body = events.map(ptfPettyRowHtml).join('') || '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:18px">' + emptyMsg + '</td></tr>';
    var summary = '<div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:10px 14px;margin:10px 0;display:flex;gap:14px;flex-wrap:wrap;font-size:13px">' +
      '<b style="color:#b45309">💸 هزینه‌های دوره: ' + money(t.totalOut) + '</b>' +
      '<b style="color:#047857">💰 شارژ دوره: ' + money(t.charges) + '</b>' +
      '<b style="color:#0e7490">🏦 موجودی دوره: ' + money(t.balance) + '</b>' +
      (t.directOut > 0 ? '<small style="color:#64748b">(پرداخت مستقیم: ' + money(t.directOut) + ')</small>' : '') + '</div>';
    var html = '<div class="md-b" id="pettyPeriodReportDlg" style="display:grid;z-index:4000" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:980px;max-height:90vh;overflow:auto"><h3>📊 گزارش دورهٔ تنخواه — ' + escP(label) + '</h3>' + summary +
      '<div class="tb2"><table><thead><tr><th>ردیف</th><th>تاریخ</th><th>نوع</th><th>شرح</th><th>توسط</th><th>نحوهٔ پرداخت/وضعیت</th><th>مبلغ</th></tr></thead><tbody>' + body + ptfPettyTotalsRowsHtml(t) + '</tbody></table></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">' +
      '<button class="bt bt-o" onclick="ptfPettyPeriodCsv(\'' + arg + '\')">⬇ اکسل</button>' +
      '<button class="bt bt-o" onclick="ptfPettyPeriodPrint(\'' + arg + '\')">🖨 چاپ/PDF</button>' +
      '<button class="bt bt-o" onclick="ptfPettyPeriodShowReceipts(\'' + arg + '\')">📎 فیش‌های پیوست</button>' +
      '<button class="bt bt-o" onclick="ptfPettyPeriodCombinedPdf(\'' + arg + '\')">📎 PDF تلفیقی</button>' +
      '<button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };

  window.ptfPettyPeriodCsv = function (a, b) {
    var events = window.ptfPettyPeriodEvents(a, b), t = window.ptfPettyPeriodTotals(a, b);
    var label = window.ptfPettyRangeLabel(a, b);
    var csv = '\uFEFF' + [['ردیف', 'تاریخ', 'نوع', 'شرح', 'توسط', 'نحوهٔ پرداخت/وضعیت', 'مبلغ']]
      .concat(events.map(function (e) { return [e.row, e.t, e.kind, e.desc, e.by, e.status || '', e.amt]; }))
      .concat([[], ['مجموع هزینه‌های دوره', '', '', '', '', '', t.totalOut], ['مجموع شارژ دوره', '', '', '', '', '', t.charges], ['موجودی شروع دوره', '', '', '', '', '', t.balanceStart], ['موجودی پایان دوره', '', '', '', '', '', t.balanceEnd]])
      .map(function (r) { return r.map(function (x) { return '"' + String(x).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
    var a2 = document.createElement('a');
    a2.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a2.download = 'petty-period-' + (label.replace(/[^0-9\/]/g, '').replace(/\//g, '-')) + '-' + new Date().toISOString().slice(0, 10) + '.csv';
    a2.click();
  };

  window.ptfPettyPeriodPrint = function (a, b) {
    var events = window.ptfPettyPeriodEvents(a, b), t = window.ptfPettyPeriodTotals(a, b);
    var label = window.ptfPettyRangeLabel(a, b);
    var html = '<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>@page{size:A4 landscape;margin:8mm}body{font-family:Tahoma;padding:8px;color:#111;font-size:9px}table{width:100%;border-collapse:collapse;table-layout:fixed}td,th{border:1px solid #aaa;padding:3px 4px;text-align:right;font-size:8.5px;word-wrap:break-word;overflow-wrap:anywhere;vertical-align:top}th{background:#eee}</style></head><body>' +
      '<h2>گزارش دورهٔ تنخواه — ' + escP(label) + '</h2>' +
      '<p>هزینه‌های دوره: ' + money(t.totalOut) + ' | شارژ دوره: ' + money(t.charges) + ' | موجودی دوره: ' + money(t.balance) + '</p>' +
      '<table><thead><tr><th>ردیف</th><th>تاریخ</th><th>نوع</th><th>شرح</th><th>توسط</th><th>نحوهٔ پرداخت/وضعیت</th><th>مبلغ</th></tr></thead><tbody>' + events.map(ptfPettyRowHtml).join('') + ptfPettyTotalsRowsHtml(t) + '</tbody></table></body></html>';
    if (typeof ptfPreviewPrintableDoc === 'function') { ptfPreviewPrintableDoc('گزارش دورهٔ تنخواه — ' + label, html, 'petty-period-' + label.replace(/[^0-9\/]/g, '').replace(/\//g, '-')); return; }
    var w = window.open('', '_blank'); if (!w) return;
    w.document.write(html); w.document.close(); w.print();
  };

  /* ============ UR-10: PDF تلفیقی دورهٔ تنخواه (گزارش + ضمائم + رسیدها با شناسهٔ ردیف) ============ */
  /* کلید پیوند شناسهٔ رسید: petId در متادیتای فایل رکورد ذخیره می‌شود (توسط رکورد ابزار پیوست). */
  window._ptfPettyPetId = 0;
  window.ptfPettyNextPetId = function () { return 'سند ' + (++window._ptfPettyPetId); };

  /* پی‌دی‌اف تلفیقی: صفحه‌های زیر را می‌سازد (هر صفحه در چاپ/PDF جدا می‌شود):
     ۱) صفحهٔ ۱: گزارش دوره (جدول ردیف‌ها + جمع‌ها + نحوهٔ پرداخت)
     ۲) صفحهٔ ۲: تصاویر رسیدها/ضمائم در چیدمان فشردهٔ ۳-در-صفحه (هر رسید یک بلوک با شناسهٔ «سند N»)
     ۳) بعدی: تصاویر ضمیمهٔ صورتحساب بانک (در صورت وجود) + هر فایل دیگر */
  window.ptfPettyPeriodCombinedPdfHtml = function (a, b, pageBreakLabel) {
    var events = window.ptfPettyPeriodEvents(a, b), t = window.ptfPettyPeriodTotals(a, b);
    var label = window.ptfPettyRangeLabel(a, b);
    var html = '<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>' +
      '@page{size:A4 landscape;margin:8mm}' +
      'body{font-family:Tahoma,Arial;padding:4mm;margin:0;color:#111;font-size:9px}' +
      'table{width:100%;border-collapse:collapse;table-layout:fixed}' +
      'td,th{border:1px solid #aaa;padding:3px 4px;text-align:right;font-size:8.5px;word-wrap:break-word;overflow-wrap:anywhere;vertical-align:top}' +
      'th{background:#eee}' +
      'col.c1{width:5%}col.c2{width:12%}col.c3{width:10%}col.c4{width:28%}col.c5{width:12%}col.c6{width:21%}col.c7{width:12%}' +
      '.page{page-break-after:always}' +
      '.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:4px;align-items:stretch;justify-items:stretch}' +
      '.rcpt{box-sizing:border-box;border:1px solid #ddd;border-radius:8px;padding:4px;page-break-inside:avoid;background:#fff;overflow:hidden;width:100%}' +
      '.rcpt img{width:100%;height:auto;display:block;border-radius:5px;max-height:220px;object-fit:contain;background:#fff}' +
      '.rcpt .cap{font-size:9.5px;color:#1d4ed8;font-weight:bold;margin:3px 0 2px}' +
      '.rcpt embed{width:100%;height:200px;border:1px solid #ddd;border-radius:5px;background:#fff}' +
      '.rcpt .meta{font-size:9px;color:#475569;margin-bottom:3px}' +
      '</style></head><body>' +
      '<div class="page"><h2 style="font-size:16px;margin:0 0 8px">گزارش دورهٔ تنخواه — ' + escP(label) + '</h2>' +
      '<p style="margin:0 0 8px">هزینه‌های دوره: <b>' + money(t.totalOut) + '</b> | شارژ دوره: <b>' + money(t.charges) + '</b> | موجودی دوره: <b>' + money(t.balance) + '</b></p>' +
      '<table><colgroup><col class="c1"><col class="c2"><col class="c3"><col class="c4"><col class="c5"><col class="c6"><col class="c7"></colgroup><thead><tr><th>ردیف</th><th>تاریخ</th><th>نوع</th><th>شرح</th><th>توسط</th><th>نحوهٔ پرداخت/وضعیت</th><th>مبلغ</th></tr></thead><tbody>' + events.map(ptfPettyRowHtml).join('') + ptfPettyTotalsRowsHtml(t) + '</tbody></table>' +
      (pageBreakLabel ? '<p style="font-size:10px;color:#64748b;margin-top:6px">' + escP(pageBreakLabel) + '</p>' : '') +
      '</div>';
    return html;
  };

  /* صفحهٔ ضمائم: چیدمان ۳-در-صفحهٔ فشرده + شناسهٔ «سند N» برای هر فایل */
  /* BUG-PDF-ATTACH v2: نوع فایل (عکس/PDF/HEIC/سایر) — فرمت‌های رایج برای نمایش صحیح */
  window.ptfPettyFileKind = function (name, extra) {
    extra = extra || {};
    var n = String(name || extra.name || extra.key || '').toLowerCase();
    var key = String(extra.key || '').toLowerCase();
    var ct = String(extra.contentType || extra.type || extra.mime || '').toLowerCase();
    var url = String(extra.url || '');
    var blob = extra.blobType ? String(extra.blobType).toLowerCase() : '';
    function hit(s) {
      s = String(s || '');
      if (/\.(jpe?g|png|gif|webp|bmp|svg)(?:$|[?#])/.test(s) || /image\/(jpeg|jpg|png|gif|webp|bmp|svg)/.test(s)) return 'image';
      if (/\.pdf(?:$|[?#])/.test(s) || s.indexOf('application/pdf') > -1) return 'pdf';
      if (/\.(heic|heif|heics)(?:$|[?#])/.test(s) || s.indexOf('image/heic') > -1 || s.indexOf('image/heif') > -1) return 'heic';
      return '';
    }
    return hit(n) || hit(key) || hit(ct) || hit(blob) || hit(url.slice(0, 64)) || 'other';
  };
  /* BUG-PDF-ATTACH v2: تبدیل PDF/HEIC به JPEG — با fallback کامل
     - اگر سرور Imagick داشت → از آن استفاده می‌کند
     - اگر نداشت یا خطا داد → فایل با همان URL اصلی باقی می‌ماند (نمایش در <img> یا <embed>)
     - برای HEIC: مرورگرهای مدرن (Safari 14+, Chrome 110+) خودشان HEIC را در <img> نمایش می‌دهند
     - برای PDF: اگر Imagick نبود، در <embed> نمایش داده می‌شود */
  window.ptfPettyToJpeg = function (f) {
    return new Promise(function (resolve) {
      if (!f) return resolve(f);
      if ((f.previewReady || f.converted) && f.url && String(f.url).indexOf('data:image/') === 0) return resolve(f);
      var kind = window.ptfPettyFileKind(f.name || f.key || '', f);
      if (kind === 'image') return resolve(f);
      function finish(x) { resolve(x || f); }
      function client() {
        if (typeof window.ptfRasterizeCloudFile !== 'function') return finish(f);
        window.ptfRasterizeCloudFile(f, 4).then(finish).catch(function () { finish(f); });
      }
      if (typeof window.ptfServerRasterFile === 'function') {
        window.ptfServerRasterFile(f).then(function (out) {
          if (out && out.converted && out.url && String(out.url).indexOf('data:image/') === 0) return finish(out);
          client();
        }).catch(client);
        return;
      }
      client();
    });
  };
  /* گرفتن URL واقعی هر فایل از storage (presign_get) — مثل openStoredFile */
  window.ptfPettyResolveUrl = function (f) { return ptfPettyResolveUrl(f); };
  function ptfPettyResolveUrl(f) {
    return new Promise(function (resolve) {
      if (!f || !f.key) return resolve(f && f.url ? f.url : '');
      if (f.url && String(f.url).indexOf('data:image/') === 0) return resolve(f.url);
      function asDataUrl(blob) {
        return new Promise(function (ok, bad) {
          var fr = new FileReader();
          fr.onload = function () { f.url = fr.result; if (blob && blob.type) f.blobType = blob.type; ok(f.url); };
          fr.onerror = bad;
          fr.readAsDataURL(blob);
        });
      }
      function fallbackPresign() {
        try {
          fetch(STORAGE_API + '?action=presign_get', {
            method: 'POST', headers: ptfStorageAuthHeaders(true),
            body: JSON.stringify({ key: f.key, disposition: 'inline' })
          }).then(function (r) { return r.json(); })
            .then(function (d) { if (d && d.ok && d.url) f.url = d.url; resolve(f.url || ''); })
            .catch(function () { resolve(f.url || ''); });
        } catch (e2) { resolve(f.url || ''); }
      }
      try {
        /* inline بدون سقف ۶ مگابایت base64 — برای چاپ باید data URL هم‌دامنه باشد */
        fetch('../api/attachment-read.php', {
          method: 'POST', headers: ptfStorageAuthHeaders(true),
          body: JSON.stringify({ key: f.key, name: f.name || f.key, mode: 'inline' })
        }).then(function (r) {
          if (!r.ok) throw new Error('read');
          return r.blob();
        }).then(function (blob) { return asDataUrl(blob); })
          .then(function (u) { resolve(u); })
          .catch(function () { fallbackPresign(); });
      } catch (e) { fallbackPresign(); }
    });
  }
  /* رندر یک ضمیمه (v2: با fallback قوی)
     - image (jpg/png/webp/svg): → <img>
     - heic: → <img> (اکثر مرورگرهای مدرن HEIC را نمایش می‌دهند)
     - pdf: → <embed> (اگر سرور Imagick نداشت، PDF اصلی نمایش داده می‌شود)
     - pdf (تبدیل‌شده): → <img> از JPEG تولید شده
     - heic (تبدیل‌شده): → <img> از JPEG تولید شده
     - other: → پیام + لینک «باز کردن فایل»
     - اگر URL اصلاً نیست: placeholder زیبا + لینک «باز کردن فایل» */
  window.ptfPettyReceiptHtml = function (f, pageLabel) {
    var petId = (pageLabel ? pageLabel + ' — ' : '') + (f.petId || 'سند');
    var kind = window.ptfPettyFileKind(f.name || f.key || '', f);
    var url = String(f.url || '').replace(/"/g, '&quot;');
    var inner;
    var openBtn = (f.key && typeof openStoredFile === 'function') ? '<div style="margin-top:4px"><a href="javascript:void(0)" onclick="openStoredFile(\'' + ptfOnClickArg(f.key) + '\')" style="font-size:10px;color:#0e7490">↗ باز کردن فایل</a></div>' : '';

    if (!url && f.key) {
      /* FIX v2: حتی اگر URL نیست، یک placeholder زیبا نمایش بده (نه حذف فایل) */
      var ext = (f.name || f.key || '').split('.').pop().toUpperCase();
      var iconMap = { 'JPG': '🖼', 'JPEG': '🖼', 'PNG': '🖼', 'WEBP': '🖼', 'GIF': '🖼', 'BMP': '🖼', 'SVG': '🖼',
                      'PDF': '📕', 'HEIC': '📷', 'HEIF': '📷' };
      var icon = iconMap[ext] || '📄';
      var errMsg = f.convertError === 'no_imagick'
        ? 'سرور تبدیل PDF/HEIC ندارد (Imagick)'
        : f.convertError === 'read_failed'
          ? 'فایل از آروان خوانده نشد'
          : f.convertError === 'convert_failed'
            ? 'تبدیل فایل ناموفق بود'
            : f.convertError === 'net'
              ? 'خطای شبکه'
              : f.convertError
                ? 'خطا: ' + f.convertError
                : 'لینک فایل در دسترس نیست';
      inner = '<div style="padding:18px 12px;color:#475569;font-size:11px;text-align:center;background:#f8fafc;border-radius:6px;border:1px dashed #cbd5e1">' +
        '<div style="font-size:32px;margin-bottom:6px">' + icon + '</div>' +
        '<div style="font-weight:bold;margin-bottom:4px">' + escP(f.name || ('سند ' + (f.petId || ''))) + '</div>' +
        '<div style="color:#92400e;margin-bottom:6px">⚠️ ' + errMsg + '</div>' +
        '<small style="color:#64748b">برای مشاهده روی «باز کردن فایل» بزنید.</small>' +
        openBtn + '</div>';
    } else if (kind === 'pdf' && !f.converted) {
      /* PDF بدون تبدیل → <embed> که در اکثر مرورگرها/پرینترها کار می‌کند */
      inner = '<embed src="' + url + '" type="application/pdf" style="width:100%;height:220px;border-radius:5px;background:#fff" onerror="this.outerHTML=\'<div style=&quot;padding:10px;color:#b91c1c;font-size:10px&quot;>⚠️ PDF قابل نمایش نیست — ' + openBtn + '</div>\'">' + openBtn;
    } else if (kind === 'image' || kind === 'heic' || f.converted) {
      /* تصویر (یا PDF/HEIC تبدیل‌شده) → <img> */
      inner = '<img src="' + url + '" alt="' + escP(f.name || 'سند') + '" style="width:100%;height:auto;display:block;border-radius:5px;max-height:300px;object-fit:contain;background:#fff" onerror="this.outerHTML=\'<div style=&quot;padding:10px;color:#b91c1c;font-size:10px&quot;>⚠️ تصویر قابل نمایش نیست — ' + openBtn.replace(/'/g, '\\\'') + '</div>\'">';
      if (f.converted && f.convertError) {
        /* اگر تبدیل موفق بوده ولی قبلاً خطا داشت، پیام نمی‌دهیم */
      }
    } else {
      /* فرمت ناشناس → پیام + لینک باز کردن */
      inner = '<div style="padding:14px;color:#7c3aed;font-size:11px;text-align:center;background:#f5f3ff;border-radius:6px">📄 ' + escP(f.name || f.key || 'سند') + '<br><small style="color:#94a3b8">این فرمت در گزارش تلفیقی نمایش داده نمی‌شود.</small>' + openBtn + '</div>';
    }
    /* v2: تگ دوگانه — «ضمیمه ردیف N» (از row گزارش) + «سند M» (petId)
       اگر f.row نباشد (مثل ضمیمهٔ صورتحساب بانک)، فقط petId نمایش داده می‌شود */
    var tags = [];
    if (f.row) tags.push('ضمیمه ردیف ' + f.row);
    tags.push(petId);
    var tagsHtml = '<div class="cap" style="display:flex;justify-content:space-between;align-items:center;gap:4px;flex-wrap:wrap">' +
      '<span>' + escP(tags.join(' — ')) + '</span>' +
      '</div>';
    return '<div class="rcpt" style="font-size:10.5px">' + tagsHtml +
      (f.name ? '<div class="meta" style="font-size:10px;color:#64748b;margin-bottom:3px;word-break:break-all">' + escP(f.name) + '</div>' : '') + inner + '</div>';
  };
  /* v2: ضمیمه‌ها به‌صورت فشرده (۲-ستونه + max-height کم) با تگ دوگانه
     - F4-9 (گزارش استیج): «تماماً زیر هم (وسط‌چین) با حاشیهٔ سفید زیاد» — قبلاً ۴-ستونه بود
       و در چاپ A4 (عرض ~۱۹۰mm محتوا) ۴ ستون جا نمی‌شد → margin خودکار + center-align
     - رفع: grid-template-columns: repeat(2, 1fr) (دو ستون پر) + max-height: 220px (فشرده‌تر)
       + justify-items: stretch (پر کردن عرض). نتیجه: ضمیمه‌ها عرض A4 را پر می‌کنند.
     - «ضمیمه ردیف N» (از شمارهٔ ردیف گزارش — برای تطابق سریع چشمی)
     - «سند M» (petId موجود — شناسهٔ منحصر به فرد هر پیوست)
     نگاشت file → row از طریق f.cd === event.cd (در ptfPettyPeriodReport ساخته می‌شود) */
  window.ptfPettyReceiptsHtml = function (records) {
    var cards = (records || []).map(function (f) {
      var h = window.ptfPettyReceiptHtml(f);
      (f.extraImages || []).forEach(function (im, i) {
        h += window.ptfPettyReceiptHtml({ key: im.key, name: (f.name || '') + ' (صفحه ' + (i + 2) + ')', url: im.url, petId: f.petId || '', converted: true }, 'صفحه ' + (i + 2));
      });
      return h;
    }).join('');
    if (!cards) return '<div style="padding:16px;color:#64748b;font-size:12px">رسید/ضمیمه‌ای برای نمایش در این دوره موجود نیست.</div>';
    /* F4-9: ۲-ستونه + gap کم + max-height کم برای چاپ فشرده (پر کردن عرض A4) */
    return '<div class="grid" style="grid-template-columns:repeat(2,1fr);gap:4px;align-items:stretch;justify-items:stretch">' + cards + '</div>';
  };

  /* جمع‌آوری فایل‌های دوره: (الف) دورهٔ ذخیره‌شده → دقیقاً از pettyIds/txIds همان لحظهٔ ارجاع
     (ب) دورهٔ جاری/بازه → از دادهٔ بازه
     v2: هر file همراه cd (شناسه رکورد) و kind ذخیره می‌شود برای نگاشت به row گزارش + تگ «ضمیمه ردیف N» */
  window.ptfPettyFindPeriodRec = function (a, b) {
    var key = ptfPettyPeriodKey(a, b);
    var list = prAll();
    if (key.isRange && key.from && key.to) {
      return list.filter(function (x) { return x.from === key.from && x.to === key.to; })[0] || null;
    }
    if (key.month) return list.filter(function (x) { return x.month === key.month; })[0] || null;
    return null;
  };
  window.ptfPettyPeriodFiles = function (a, b, ids) {
    var out = [], seen = {};
    function pushRec(r, kind) {
      if (!r) return;
      var petId = r.petId || ((r.files || []).length ? (r.files[0].petId || '') : '');
      (r.files || []).forEach(function (f, fi) {
        if (!f) return;
        var k = String(f.key || '') || (String(r.cd || '') + '|' + fi + '|' + String(f.name || ''));
        if (seen[k]) return;
        seen[k] = 1;
        out.push({ key: f.key || '', name: f.name || f.key || ('سند ' + (fi + 1)), url: f.url || '', petId: f.petId || petId || '', cd: r.cd, kind: kind, record: r });
      });
    }
    var idList = [];
    function addId(cd) { if (cd && idList.indexOf(cd) < 0) idList.push(cd); }
    (Array.isArray(ids) ? ids : []).forEach(addId);
    var pr = window.ptfPettyFindPeriodRec(a, b);
    if (pr) {
      (pr.pettyIds || []).forEach(addId);
      (pr.txIds || []).forEach(addId);
    }
    var byId = {};
    (getData(PETTY_KEY) || []).forEach(function (p) { if (p && p.cd) byId[p.cd] = p; });
    txAll().forEach(function (x) { if (x && x.cd) byId[x.cd] = x; });
    idList.forEach(function (cd) {
      var r = byId[cd];
      if (!r) return;
      var kind = (r.type === 'charge' || r.type === 'direct' || r.type === 'settle') ? 'tx' : 'petty';
      pushRec(r, kind);
    });
    var d = window.ptfPettyPeriodData(a, b);
    (d.petty || []).forEach(function (r) { pushRec(r, 'petty'); });
    (d.tx || []).forEach(function (r) { pushRec(r, 'tx'); });
    return out;
  };

  /* v34.4.68: پوشش انتظار پایدار — toast کوتاه ناپدید می‌شود ولی ساخت تلفیقی ممکن است
     ده‌ها ثانیه طول بکشد. این پوشش تا پایان کار می‌ماند و متن مرحله را عوض می‌کند. */
  function ptfPettyWaitShow(msg) {
    var el = document.getElementById('ptfPettyWait');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ptfPettyWait';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      el.style.cssText = 'position:fixed;inset:0;z-index:12000;background:rgba(15,23,42,.55);display:grid;place-items:center;padding:16px';
      el.innerHTML = '<div style="background:#fff;border-radius:16px;padding:22px 26px;max-width:420px;width:92vw;box-shadow:0 20px 50px rgba(0,0,0,.28);text-align:center">' +
        '<div style="font-size:28px;margin-bottom:8px">⏳</div>' +
        '<div id="ptfPettyWaitMsg" style="font-size:15px;font-weight:800;color:#0f172a;line-height:1.8"></div>' +
        '<div style="margin-top:8px;font-size:12px;color:#64748b;line-height:1.7">لطفاً این صفحه را نبندید تا گزارش آماده شود.</div></div>';
      document.body.appendChild(el);
    }
    var t = document.getElementById('ptfPettyWaitMsg');
    if (t) t.textContent = msg || 'در حال آماده‌سازی گزارش تلفیقی…';
    el.style.display = 'grid';
  }
  function ptfPettyWaitHide() {
    var el = document.getElementById('ptfPettyWait');
    if (el) el.remove();
  }

  /* اجرا: ساخت PDF تلفیقی با گرفتن URL هر فایل (async) و سپس چاپ/دانلود */
  window.ptfPettyPeriodCombinedPdf = function (a, b) {
    if (window._ptfPettyCombinedBusy) return;
    window._ptfPettyCombinedBusy = true;
    ptfPettyWaitShow('در حال آماده‌سازی گزارش تلفیقی… دریافت اسناد از فضای ابری');
    var periodRec = window.ptfPettyFindPeriodRec(a, b);
    var ids = periodRec ? (periodRec.pettyIds || []).concat(periodRec.txIds || []) : null;
    var files = window.ptfPettyPeriodFiles(a, b, ids);
    var periodFiles = (periodRec && periodRec.files) || [];
    /* BUG-PDF-ATTACH: اول URL همهٔ ضمائم (عکس/PDF) از storage گرفته می‌شود، بعد HTML ساخته و چاپ می‌شود */
    var all = files.concat(periodFiles);
    var jobs = all.map(function (f) {
      return ptfPettyResolveUrl(f).then(function (u) { f.url = u || ''; }).catch(function () { f.url = f.url || ''; });
    });
    Promise.all(jobs).then(function () {
      var need = all.filter(function (f) {
        if (f.previewReady || (f.key && String(f.key).indexOf('previews/') === 0)) return false;
        var k = window.ptfPettyFileKind(f.name || f.key || '', f);
        if (f.url && String(f.url).indexOf('data:application/pdf') === 0) k = 'pdf';
        return (k === 'pdf' || k === 'heic' || k === 'other') && (f.key || f.url);
      });
      var i = 0;
      function next() {
        if (i >= need.length) return Promise.resolve();
        var f = need[i++];
        ptfPettyWaitShow('در حال تبدیل سند ' + i + ' از ' + need.length + '…');
        return window.ptfPettyToJpeg(f).then(next, next);
      }
      return next();
    }).then(function () {
      ptfPettyWaitShow('در حال آماده‌سازی گزارش تلفیقی… ساخت پیش‌نمایش');
      /* v2: نگاشت file → row گزارش — هر file، ردیف رکوردش را می‌گیرد */
      try {
        var events = window.ptfPettyPeriodEvents(a, b);
        var rowByCd = {};
        events.forEach(function (e) { if (e.cd) rowByCd[e.cd] = e.row; });
        all.forEach(function (f) { if (f.cd && rowByCd[f.cd]) f.row = rowByCd[f.cd]; });
      } catch (eMap) { console.warn('map file→row:', eMap); }
      var pageBreaks = [];
      var receiptsHtml = window.ptfPettyReceiptsHtml(files);
      pageBreaks.push('<div class="page"><h3 style="font-size:14px;margin:0 0 6px">📎 ضمائم و رسیدهای پرداخت (شناسهٔ هر رسید مطابق ردیف‌های گزارش)</h3>' + receiptsHtml + '</div>');
      if (periodFiles.length) {
        pageBreaks.push('<div class="page"><h3 style="font-size:14px;margin:0 0 6px">🏦 پیوست صورتحساب بانک / گردش حساب دوره</h3>' + window.ptfPettyReceiptsHtml(periodFiles) + '</div>');
      }
      var label = window.ptfPettyRangeLabel(a, b);
      var reportHtml = window.ptfPettyPeriodCombinedPdfHtml(a, b, 'تعداد رسیدهای ضمیمه‌شده: ' + files.length + (periodFiles.length ? ' | پیوست بانک: ' + periodFiles.length : ''));
      var fullHtml = reportHtml + pageBreaks.join('');
      ptfPettyWaitHide();
      window._ptfPettyCombinedBusy = false;
      if (typeof ptfPreviewPrintableDoc === 'function') { ptfPreviewPrintableDoc('گزارش تلفیقی دورهٔ تنخواه — ' + label, fullHtml, 'petty-period-combined-' + label.replace(/[^0-9\/]/g, '').replace(/\//g, '-')); return; }
      var w = window.open('', '_blank'); if (!w) return;
      w.document.write(fullHtml); w.document.close(); w.print();
    }).catch(function (ePdf) {
      console.error('ptfPettyPeriodCombinedPdf:', ePdf);
      ptfPettyWaitHide();
      window._ptfPettyCombinedBusy = false;
      if (typeof ptfToast === 'function') ptfToast('⚠️ ساخت گزارش تلفیقی کامل نشد: ' + ((ePdf && ePdf.message) || ePdf), 'warn');
    });
  };

  window.pettyClosePeriod = function () {
    if (!isTreasurer()) { alert('⛔ فقط تنخواه‌گردان'); return; }
    var sg = window.ptfPettySuggestedRange();
    ptfDialog({
      title: '📤 ارجاع گزارش دوره تنخواه به حسابدار',
      body: 'گزارش گردش دوره شامل پرداخت‌های مستقیم، تسویه مطالبات اشخاص، مانده حساب و همه ضمایم هزینه‌هاست. پس از ثبت، در کارتابل حسابدار قابل پیگیری می‌شود.<br><b style="color:#b45309">⚠️ پیوست «صورتحساب بانک / گردش حساب» قبل از ارجاع الزامی است.</b><br><small style="color:#475569">بازهٔ پیشنهادی از «روز پس از آخرین ارجاع» تا امروز است — می‌توانید «تا تاریخ» را تغییر دهید.</small>',
      fields: [
        { id: 'from', label: 'از تاریخ (روز پس از آخرین ارجاع)', value: sg.from || '', required: true, dir: 'ltr', datePicker: true },
        { id: 'to', label: 'تا تاریخ', value: sg.to || '', required: true, dir: 'ltr', datePicker: true },
        { id: 'bankFile', label: '📎 فایل PDF گردش حساب بانک (الزامی — قبل از ارجاع)', type: 'upload', uploadFolder: 'petty-period/' },
        { id: 'note', label: 'یادداشت برای حسابدار', type: 'textarea', rows: 2 },
        { id: 'sms', label: 'پیامک اطلاع‌رسانی؟', type: 'select', options: [{ v: 'no', lb: 'خیر' }, { v: 'yes', lb: 'بله، اگر شماره حسابدار موجود است' }] }
      ],
      okText: 'ثبت و ارجاع',
      onOk: function (v) {
        var from = window.ptfPettyNormDate(v.from), to = window.ptfPettyNormDate(v.to);
        if (!/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(from) || !/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(to)) { alert('⚠️ تاریخ‌ها را با فرمت 1405/04/01 وارد کنید (یا از تقویم استفاده کنید).'); return; }
        if (from > to) { alert('⚠️ «از تاریخ» نمی‌تواند بعد از «تا تاریخ» باشد.'); return; }
        /* UR-13 (اصلاح): فایل گردش حساب بانک باید در همین پنجره ضمیمه شده باشد — بدون آن ارجاع نمی‌شود */
        var bankFiles = (v.bankFile || []).filter(Boolean);
        if (!bankFiles.length) { alert('⚠️ ابتدا فایل «صورتحساب بانک / گردش حساب بانک» را در همین پنجره ضمیمه کنید؛ ارجاع بدون آن انجام نمی‌شود.'); return; }
        var d = window.ptfPettyPeriodData(from, to);
        var ps = prAll();
        /* UR-10/UR-11: اگر آخرین دورهٔ ارجاع‌شده بدون پیوست بانک باشد، ارجاع جدید مسدود می‌شود
           (چون دورهٔ جدید از روز پس از آن شروع می‌شود و آن دوره باید کامل باشد). */
        var lastClosed = ps.filter(function (x) { return x.st === 'referred' || x.st === 'registered'; })[0];
        if (lastClosed && !(lastClosed.files || []).length) {
          alert('⚠️ دورهٔ قبلی (' + (lastClosed.from && lastClosed.to ? 'از ' + lastClosed.from + ' تا ' + lastClosed.to : 'ماه ' + lastClosed.month) + ') هنوز «صورتحساب بانک / گردش حساب» ندارد — ابتدا آن را ضمیمه کنید؛ ارجاع تا الحاق پیوست انجام نمی‌شود.');
          pettyAttachBank(lastClosed.cd);
          return;
        }
        var rec = { cd: genCode('PPR'), from: from, to: to, month: d.month, st: 'referred', by: userName(), t: faDateTime(), iso: isoNow(), note: v.note || '', pettyIds: d.petty.map(function (x) { return x.cd; }), txIds: d.tx.map(function (x) { return x.cd; }), totalOut: d.totalOut, charges: d.charges, balance: d.balance, files: bankFiles };
        ps.unshift(rec); prSave(ps);
        audit('تنخواه', 'ارجاع گزارش دوره از ' + from + ' تا ' + to + ' به حسابدار — گردش ' + money(d.totalOut), rec.cd);
        if (typeof notify === 'function') notify({ toRoles: ['accountant'], title: '📤 گزارش دوره تنخواه (از ' + from + ' تا ' + to + ') برای ثبت حسابداری ارجاع شد', body: 'گردش دوره: ' + money(d.totalOut) + ' | مانده حساب: ' + money(d.balance), kind: 'petty_period', channels: ['cart'], link: { panel: 'petty' } });
        if (v.sms === 'yes' && typeof smsSendSingle === 'function') accountants().forEach(function (u) { if (u.mobile) smsSendSingle(u.mobile, 'حسابدار محترم، گزارش دوره تنخواه (از ' + from + ' تا ' + to + ') در CRM برای ثبت حسابداری ارجاع شد. https://pishtaj.ir/crm/'); });
        renderPetty();
        /* UR-13: فایل گردش حساب بانک از قبل در همین پنجره ضمیمه شده — دیگر دیالوگ پیوست جدا لازم نیست */
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
    /* US-FX2RIAL: نسخه ریالی (همراه) سند ارائه‌ای است — پیش‌پرداخت/مطالبه فقط روی سند ارزی مبدأ ثبت می‌شود
       تا مطالبهٔ تکراری ایجاد نشود و مبنای ارزی/نرخ ثبت‌شدهٔ اصلی محفوظ بماند. */
    if (o.rialOf) {
      alert('🔒 این سند «نسخه ریالی» پیشنهاد ارزی ' + o.rialOf + ' است.\n\n• پیش‌پرداخت واقعی فقط روی پیشنهاد ارزی مبدأ (' + o.rialOf + ') ثبت می‌شود و نرخ/مبلغ وصولیِ آنجا محفوظ است.\n• ثبت پیش‌پرداخت روی نسخه ریالی «مطالبه تکراری» می‌سازد و مجاز نیست.\n\nبرای اصلاح پیش‌پرداخت به پیشنهاد ارزی مبدأ یا پرونده فروش مراجعه کنید.');
      return;
    }
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
        openAdvs.map(function (o) { var a = ptfAdvanceNormalize(o); var pays = (a.payments || []).map(function (p) { return '◽ ' + escP(p.t || '') + ' — ' + (+p.amt || 0).toLocaleString('fa-IR') + ' ریال' + (p.docAmt ? ' <small style="color:#0e7490">(' + (+p.docAmt || 0).toLocaleString('en-US') + ' ' + escP(a.cur || '') + ' @ ' + (+p.rate || 0).toLocaleString('fa-IR') + ')</small>' : '') + ' <a href="javascript:void(0)" onclick="advancePayDel(\'' + ptfOnClickArg(o.no) + '\',\'' + ptfOnClickArg(p.cd || '') + '\')" style="color:#dc2626">✕</a>'; }).join('<br>'); return '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px dashed #fed7aa;flex-wrap:wrap"><span style="font-size:12.5px"><b>' + escP(o.buyerCo || '-') + '</b> — ' + escP(o.no) + ' — پیش‌پرداخت: <b>' + ptfAdvanceLabel(o) + '</b><br><small style="color:#166534">وصول‌شده: ' + (+a.receivedAmt || 0).toLocaleString('fa-IR') + ' ریال' + (a.cur !== 'IRR' ? ' | ' + (+a.receivedDocAmt || 0).toLocaleString('en-US') + ' ' + escP(a.cur) : '') + ' | مانده: ' + (+a.remainAmt || 0).toLocaleString('fa-IR') + ' ریال' + (a.cur !== 'IRR' ? ' | ' + (+a.remainDocAmt || 0).toLocaleString('en-US') + ' ' + escP(a.cur) : '') + '</small>' + (a.note ? '<br><small style="color:#64748b">' + escP(a.note) + '</small>' : '') + (pays ? '<br><small style="color:#475569">' + pays + '</small>' : '') + '</span><span style="display:flex;gap:5px"><button class="bt bt-o" style="padding:4px 10px;font-size:12px" onclick="ptfAdvanceOpen(\'' + ptfOnClickArg(o.no) + '\')">اصلاح</button><button class="bt" style="padding:4px 11px;font-size:12px;background:#059669" onclick="advancePaid(\'' + ptfOnClickArg(o.no) + '\')">+ ثبت وصول</button></span></div>'; }).join('') +
        (fulls.length ? '<div style="margin-top:8px;font-size:12px;color:#059669">✅ پرداخت کامل/نقدی: ' + fulls.map(function (o) { return escP(o.no); }).join('، ') + '</div>' : '') + '</div>';
      el.insertAdjacentHTML('afterbegin', h);
    };
  }
  window.advancePaid = function (no) {
    var offers = getData('ptf_crm_offers'); var o = offers.filter(function (x) { return x.no === no; })[0];
    if (o && o.rialOf) { alert('🔒 این سند «نسخه ریالی» پیشنهاد ارزی ' + o.rialOf + ' است — وصول پیش‌پرداخت فقط روی پیشنهاد ارزی مبدأ ثبت می‌شود (US-FX2RIAL).'); return; }
    var hasInv = (getData('ptf_crm_invoices') || []).some(function (iv) { return iv.offerNo === no; });
    if (hasInv) { alert('برای این درخواست فاکتور صادر شده است؛ از این به بعد ملاک وصول، مبلغ فاکتور ریالی است و ثبت وصول باید در بخش مطالبات/فاکتور انجام شود.'); return; }
    if (!o || !o.advance) return;
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
