/* =====================================================================
   PTF CRM — salesfiles.js — v13.2 — US-322 (بازطراحی نقش پرونده‌های فروش — دستور کارفرما)
   - با ثبت هر پیشنهاد (TO/CO/TC) رکوردی با همان شماره درخواست خودکار ساخته می‌شود
   - کلیک روی رکورد = منوی کشویی همه اسناد منضم (پیشنهادها با آخرین رویژن،
     نامه‌ها، فاکتورها، اسناد متفرقه) + افزودن سند از بیرون
   - مختومه بدون فاکتور: تایید کاربر ← پیشنهاد دانلود اسناد ← حذف اسناد متفرقه
     از فضای ابری ← انتقال رکورد آماری به «بایگانی» (نام جدید پرونده‌های پروژه)
   - مختومه با فاکتور ثبت‌شده: پایان پروژه و تسویه کامل ← انتقال کل پرونده با ضمایم به بایگانی
   ===================================================================== */
(function () {
  'use strict';

  var K = 'ptf_crm_deals';

  function sfAll() { return getData(K); }
  function sfSave(list) { setData(K, list); }

  /* v14.8: دلایل استاندارد باخت — به جای متن آزاد */
  window.SF_LOST_REASONS = [
    { id: 'price', lb: 'قیمت' },
    { id: 'delivery', lb: 'زمان تحویل' },
    { id: 'brand', lb: 'برند' },
    { id: 'cancel', lb: 'انصراف مشتری' },
    { id: 'other', lb: 'سایر' }
  ];

  /* v14.8: وضعیت تاریخ تحویل تعهدی — قرمز=گذشته/امروز، نارنجی=تا ۳ روز آینده */
  window.ptfSfDueState = function (r) {
    if (!r || !r.dueISO || r.st === 'archived') return null;
    var today = new Date().toISOString().slice(0, 10);
    if (r.dueISO <= today) return 'red';
    var diff = Math.round((new Date(r.dueISO) - new Date(today)) / 86400000);
    return diff <= 3 ? 'orange' : null;
  };

  /* ---------- ساخت/به‌روزرسانی خودکار رکورد از پیشنهاد ---------- */
  window.ptfSF_ensure = function (inqNo, buyerCo) {
    if (!inqNo) return null;
    var list = sfAll();
    var r = list.filter(function (x) { return x.inqNo === inqNo; })[0];
    if (!r) {
      r = { cd: genCode('DEAL'), inqNo: inqNo, buyerCo: buyerCo || '', docs: [], st: 'open', t: faDateTime(), by: curSession().name };
      list.unshift(r);
      sfSave(list);
      try { audit('پرونده‌های فروش', 'ایجاد خودکار پرونده فروش برای درخواست ' + inqNo, r.cd); } catch (e) {}
    } else if (buyerCo && !r.buyerCo) { r.buyerCo = buyerCo; sfSave(list); }
    return r;
  };

  /* v16.8 (US-404 فاز ۱ — مصوب کارفرما): ثبت پیشنهاد دیگر پرونده نمی‌سازد.
     «پرونده فروش = ابلاغ سفارش (CO برنده)» — تنها نقطه ساخت: autoCreateProjectFromCO (ptfSF_ensure).
     قبل از برد، درخواست در تب «🎯 فرصت‌های فعال» (oppo.js) رهگیری می‌شود.
     hook حفظ شد فقط برای به‌روزرسانی buyerCo رکورد موجود (بدون ساخت). */
  function hookOfferSave() {
    if (window._sfOfferHooked || typeof window.offerSave !== 'function') return false;
    window._sfOfferHooked = true;
    var _os = window.offerSave;
    window.offerSave = function () {
      _os.apply(this, arguments);
      try {
        var st = window._offState || {};
        if (st.no && st.inqNo) {
          var saved = getData('ptf_crm_offers').filter(function (o) { return o.no === st.no; })[0];
          if (saved && saved.buyerCo) {
            var list = sfAll();
            var r = list.filter(function (x) { return x.inqNo === saved.inqNo; })[0];
            if (r && !r.buyerCo) { r.buyerCo = saved.buyerCo; sfSave(list); }
          }
        }
      } catch (e) {}
    };
    return true;
  }
  var htr = 0;
  var ht = setInterval(function () { htr++; if (hookOfferSave() || htr > 50) clearInterval(ht); }, 400);

  /* ---------- جمع‌آوری زنده اسناد منضم یک درخواست ---------- */
  window.ptfSalesFileOffers = function (r) {
    if (!r) return [];
    var all = getData('ptf_crm_offers'), out = [], seen = {};
    function add(o) { if (!o || !o.no || seen[o.no]) return; seen[o.no] = true; out.push(o); }
    /* BUG-ARCHIVE (۱۴۰۵/۰۸/۱۰): پیش از این فقط wonOffer + offers با st==='won' برمی‌گشت
       و سایر اسناد پرونده (پیشنهاد اصلی، متمم‌ها، پیشنهادهای غیربرندهٔ همان درخواست) از
       نمایش حذف می‌شدند → در بایگانی فقط «سند متمم» دیده می‌شد. حالا همهٔ پیشنهادهای
       همان درخواست + زنجیرهٔ (altOf/srcToNo/coNo) + wonOffer برگردانده می‌شوند تا
       فاکتورها/نامه‌های مرتبط هم در بایگانی دیده شوند. */
    if (r.wonOffer) add(all.filter(function (o) { return o.no === r.wonOffer; })[0]);
    all.filter(function (o) {
      return o.inqNo === r.inqNo;
    }).forEach(add);
    /* زنجیرهٔ پیشنهادها دوطرفه است. متمم ممکن است offer برندهٔ پرونده باشد و
       فقط با altOf/srcToNo به پیشنهاد اصلی وصل شده باشد؛ در این حالت شرط یک‌طرفهٔ
       قبلی، چون «پیشنهاد اصلی» به متمم اشاره نمی‌کرد، آن را پیدا نمی‌کرد. */
    var grew = true;
    while (grew) {
      grew = false;
      all.forEach(function (o) {
        if (seen[o.no]) return;
        var linkedToKnown = (o.altOf && seen[o.altOf]) || (o.srcToNo && seen[o.srcToNo]) || (o.coNo && seen[o.coNo]);
        var knownLinksBack = out.some(function (known) {
          return known && (known.altOf === o.no || known.srcToNo === o.no || known.coNo === o.no);
        });
        if (linkedToKnown || knownLinksBack) { add(o); grew = true; }
      });
    }
    return out;
  };
  function sfDocsOf(r) {
    var out = { offers: [], letters: [], invoices: [], misc: r.docs || [], supply: [] };
    var offers = typeof window.ptfSalesFileOffers === 'function' ? window.ptfSalesFileOffers(r) : getData('ptf_crm_offers').filter(function (o) { return o.inqNo === r.inqNo; });
    out.offers = offers; // نمایش زنده = همیشه آخرین رویژن (o.rev)
    out.letters = getData('ptf_crm_letters').filter(function (l) {
      return l.prjNo === 'SF:' + r.inqNo || l.inqNo === r.inqNo;
    });
    var offNos = offers.map(function (o) { return o.no; });
    out.invoices = getData('ptf_crm_invoices').filter(function (i) { return offNos.indexOf(i.offerNo) > -1; });
    /* v17.1 (US-404 فاز ۲ — تکمیل اسناد چهارگانه): استعلام‌های تامین مرتبط (rfqsmart)
       با هر دو شناسه درخواست (کد سیستمی + شماره کارفرما — US-386) */
    try {
      var aliases = [r.inqNo];
      var rfq = getData('ptf_crm_rfqs').filter(function (x) { return x.cd === r.inqNo || x.inqNo === r.inqNo; })[0];
      if (rfq) { if (aliases.indexOf(rfq.cd) < 0) aliases.push(rfq.cd); if (rfq.inqNo && aliases.indexOf(rfq.inqNo) < 0) aliases.push(rfq.inqNo); }
      out.supply = getData('ptf_crm_rfqsmart').filter(function (q) { return q.srcRfq && aliases.indexOf(q.srcRfq) > -1; });
    } catch (eS) { out.supply = []; }
    return out;
  }
  function sfHasInvoice(r) { return sfDocsOf(r).invoices.length > 0; }

  /* v34.4.49: حاشیه سود واقعی هر پرونده — مبلغ ریال + درصد روی همان موتور
     ptfProjectProfitIRR (فروش قطعی − فاکتور خرید − هزینه مستقیم − زیان). */
  window.ptfSalesFileMargin = function (r) {
    var empty = { sell: 0, buy: 0, extra: 0, cost: 0, profit: null, pct: null, complete: false, ok: false, provisional: false, warnings: [], sellSrc: '' };
    if (!r) return empty;
    var prj = {
      _kind: 'deal',
      no: r.cd, cd: r.cd,
      offerNo: r.wonOffer || r.offerNo || '',
      inqNo: r.inqNo || '',
      buyerCo: r.buyerCo || '',
      costEvents: r.costEvents || [],
      lossEvents: r.lossEvents || []
    };
    var res = { ok: false, complete: false, warnings: [], sellIrr: 0, buyIrr: 0, profit: null, pct: null };
    try {
      if (typeof window.ptfProjectProfitIRR === 'function') res = window.ptfProjectProfitIRR(prj) || res;
    } catch (eP) {}
    var sell = +res.sellIrr || 0;
    var buy = +res.buyIrr || 0;
    var extra = (r.costEvents || []).reduce(function (s, x) { return s + (+x.amt || 0); }, 0);
    extra += (typeof window.ptfProjectLossTotal === 'function') ? window.ptfProjectLossTotal(r) : (r.lossEvents || []).reduce(function (s, x) { return s + (+x.amt || 0); }, 0);
    var cost = buy + extra;
    /* مبلغ/درصد را از اجزا می‌سازیم تا hookهای سود (کسر دوبارهٔ هزینه/زیان) دوبار کم نکنند. */
    var profit = sell > 0 ? (sell - cost) : null;
    var provisional = !(res.complete && res.ok && sell > 0);
    var pct = (sell > 0 && profit != null) ? Math.round(profit * 1000 / sell) / 10 : null;
    return {
      sell: sell, buy: buy, extra: extra, cost: cost,
      profit: profit, pct: pct,
      complete: !!(res.complete && !provisional),
      ok: !!(res.ok && sell > 0),
      provisional: provisional || !res.complete,
      warnings: res.warnings || [],
      sellSrc: res.sellSrc || ''
    };
  };
  window.ptfSalesFileMarginBadge = function (r) {
    var m = window.ptfSalesFileMargin(r);
    if (!m.ok && m.profit == null) {
      return '<span style="background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0;border-radius:8px;padding:2px 8px;font-size:11px">حاشیه سود: —</span>';
    }
    var pos = m.profit >= 0;
    var col = m.provisional ? '#b45309' : (pos ? '#047857' : '#b91c1c');
    var bg = m.provisional ? '#fffbeb' : (pos ? '#ecfdf5' : '#fef2f2');
    var bd = m.provisional ? '#fde68a' : (pos ? '#86efac' : '#fecaca');
    var amt = (m.profit || 0).toLocaleString('fa-IR') + ' ریال';
    var pct = (m.pct != null) ? (m.pct.toLocaleString('fa-IR') + '٪') : '—';
    var tag = m.provisional ? ' تقریبی' : ' واقعی';
    return '<span title="' + escP((m.warnings || []).join(' | ') || (m.sellSrc || 'حاشیه سود پرونده')) + '" style="background:' + bg + ';color:' + col + ';border:1px solid ' + bd + ';border-radius:8px;padding:2px 8px;font-size:11px;font-weight:800">حاشیه سود' + tag + ': ' + amt + ' <span dir="ltr">(' + pct + ')</span></span>';
  };

  /* ===== v19.1: اسناد قطعی برد — snapshot تغییرناپذیر پیشنهاد مالی برنده + آخرین فنی مرتبط.
     ساخت اصلی: لحظه برد در autoCreateProjectFromCO (offers.js). این تابع مهاجرت نرم پرونده‌های
     قدیمی برد‌شده (قبل از v19.1) است: یک‌بار از پیشنهاد زنده snapshot می‌سازد. ===== */
  window.sfAwardEnsure = function (r) {
    if (!r || !r.wonOffer) return (r && r.awardDocs) || [];
    if (r.awardDocs && r.awardDocs.length) return r.awardDocs;
    try {
      var all = getData('ptf_crm_offers');
      var o = all.filter(function (x) { return x.no === r.wonOffer; })[0];
      if (!o) return [];
      var docs = [{ kind: o.kind, no: o.no, rev: o.rev || 0, role: 'commercial', t: faDateTime(), by: curSession().name, migrated: true, snap: JSON.parse(JSON.stringify(o)) }];
      var to = null;
      if (o.srcToNo) to = all.filter(function (x) { return x.no === o.srcToNo; })[0];
      if (!to) to = all.filter(function (x) { return x.kind === 'TO' && (x.coNo === o.no || (o.inqNo && x.inqNo === o.inqNo)); }).sort(function (a, b) { return (b.rev || 0) - (a.rev || 0); })[0];
      if (to) docs.push({ kind: 'TO', no: to.no, rev: to.rev || 0, role: 'technical', t: faDateTime(), by: curSession().name, migrated: true, snap: JSON.parse(JSON.stringify(to)) });
      var list = sfAll();
      var rec = list.filter(function (x) { return x.cd === r.cd; })[0];
      if (rec) {
        rec.awardDocs = docs; sfSave(list); r.awardDocs = docs;
        try { audit('پرونده‌های فروش', 'US-432 (مهاجرت نرم): snapshot اسناد قطعی برد پرونده ' + (r.inqNo || r.cd) + ' ساخته شد', r.cd); } catch (e2) {}
      }
      return docs;
    } catch (e) { return r.awardDocs || []; }
  };
  /* AC4: چاپ/PDF سند برد از snapshot — حتی اگر پیشنهاد بعدا از ماژول پیشنهادها حذف شده باشد */
  window.sfAwardPrint = function (cd, no) {
    var r = sfAll().filter(function (x) { return x.cd === cd; })[0];
    if (!r) return;
    var ad = (r.awardDocs || []).filter(function (d) { return d.no === no; })[0];
    if (!ad || !ad.snap) { alert('سند قطعی برد یافت نشد'); return; }
    var snap = JSON.parse(JSON.stringify(ad.snap)); /* کپی — snapshot اصلی هرگز mutate نمی‌شود */
    if (typeof offerPrintObj === 'function') offerPrintObj(snap);
    else if (typeof offerPrint === 'function') offerPrint(no);
    try { audit('پرونده‌های فروش', 'چاپ/PDF سند قطعی برد ' + no + ' از پرونده ' + (r.inqNo || cd), cd); } catch (e) {}
  };

  /* ===== v20.7: QC داخل پرونده فقط برای نتایج/گزارش‌های صادره است.
     نوت بازرسی رسمی از docsx (Inspection Notice) صادر می‌شود و در آن نتیجه درج نمی‌شود. */
  window.SF_QC_TYPES = [
    { id: 'test', lb: '🧪 نتیجه آزمایش' },
    { id: 'report', lb: '📋 پیوست گزارش بازرسی صادره توسط بازرس' },
    { id: 'cert', lb: '📜 MTC / TPI / Release Note' }
  ];
  window.SF_QC_CONF = [
    { id: 'pending', lb: '⏳ در انتظار نتیجه' },
    { id: 'conform', lb: '✅ انطباق' },
    { id: 'nonconform', lb: '⛔ عدم انطباق' }
  ];
  /* هسته برنامه‌ای (قابل تست) — UI فقط wrapper است */
  window.sfQcCommit = function (cd, typeId, confId, desc) {
    var list = sfAll();
    var r = list.filter(function (x) { return x.cd === cd; })[0];
    /* US-434: QC فقط در پروندهٔ ابلاغ‌شده/برنده مجاز است؛ guard در هسته نه فقط UI */
    if (!r || !r.wonOffer) return null;
    var tp = SF_QC_TYPES.filter(function (x) { return x.id === typeId; })[0] || SF_QC_TYPES[0];
    var cf = SF_QC_CONF.filter(function (x) { return x.id === confId; })[0] || SF_QC_CONF[0];
    var ev = { cd: genCode('QC'), type: tp.id, conf: cf.id, desc: (desc || '').trim(), t: faDateTime(), by: curSession().name, files: [] };
    r.qcEvents = r.qcEvents || []; r.qcEvents.unshift(ev);
    r.timeline = r.timeline || []; r.timeline.push({ t: faDateTime(), by: curSession().name, tx: '🔬 ' + tp.lb + ' — ' + cf.lb + (ev.desc ? ' — ' + ev.desc : '') });
    sfSave(list);
    try { audit('پرونده‌های فروش', 'ثبت ' + tp.lb + ' (' + cf.lb + ') برای پرونده ' + (r.inqNo || cd), cd); } catch (e) {}
    if (cf.id === 'nonconform' && typeof notify === 'function') {
      try { notify({ toRoles: SENIOR_ROLES, title: '⛔ عدم انطباق کالا در پرونده ' + (r.inqNo || cd) + ' — بررسی فوری (ریسک زیان)', kind: 'warn', channels: ['cart'], link: { panel: 'deals' } }); } catch (e3) {}
    }
    return ev;
  };
  window.sfQcOpen = function (cd) {
    var r = sfAll().filter(function (x) { return x.cd === cd; })[0];
    if (!r) return;
    ptfDialog({
      title: '🔬 کنترل کیفیت / بازرسی — ' + (r.inqNo || cd),
      body: 'نوت بازرسی رسمی از بخش «اسناد رسمی قالب شرکت» و با قالب انگلیسی Inspection Notice صادر می‌شود و نتیجه ندارد. این بخش فقط برای ثبت/پیوست نتایج آزمایش، گزارش بازرسی صادره توسط بازرس و گواهی‌هاست. در صورت «عدم انطباق»، ثبت زیان پروژه پیشنهاد می‌شود.',
      fields: [
        { id: 'type', label: 'نوع رکورد', type: 'select', options: SF_QC_TYPES.map(function (x) { return { v: x.id, lb: x.lb }; }) },
        { id: 'conf', label: 'وضعیت انطباق', type: 'select', options: SF_QC_CONF.map(function (x) { return { v: x.id, lb: x.lb }; }) },
        { id: 'desc', label: 'شرح', type: 'textarea', rows: 3, required: true, placeholder: 'مثلا: گزارش بازرسی بازرس پیوست شد / نتیجه آزمایش ضمیمه شد' }
      ],
      okText: 'ثبت در پرونده',
      onOk: function (v) {
        var ev = sfQcCommit(cd, v.type, v.conf, v.desc);
        if (!ev) return;
        if (typeof ptfToast === 'function') ptfToast('رکورد QC در پرونده ثبت شد 🔬', 'ok');
        if (v.conf === 'nonconform' && confirm('⛔ عدم انطباق ثبت شد.\n\nاگر این عدم انطباق هزینه ازدست‌رفته دارد (مثل کیس واردات کالای نامنطبق)، همین حالا «ثبت زیان پروژه» باز شود؟')) {
          if (typeof ptfLossOpen === 'function') ptfLossOpen('deal', cd);
        }
        if (confirm('برای این رکورد QC مدرک/گزارش پیوست می‌کنید؟') && typeof attachUploadWidget === 'function') sfQcUpload(cd, ev.cd);
        if (typeof renderDeals === 'function') renderDeals();
      }
    });
  };
  /* ===== v19.2: وضعیت‌های مرحله‌ای ۱۲گانه پرونده فروش پس از برد =====
     اصل معماری: وضعیت پرونده «مشتق» است نه فیلد آزاد — تابع واحد sfStageOf از روی
     سیگنال‌های واقعی (وضعیت درخواست، رویدادهای ارسال، ارجاع/صدور فاکتور، وصول) محاسبه
     می‌کند؛ لذا عقب‌گرد ساختاری ناممکن است (AC3) و پرونده/درخواست/کانبان همیشه از
     یک منبع هم‌راستا هستند (AC1/AC4). گذارهای درخواست فقط از ptfRfqSetStatus (قاعده دائمی). */
  window.PTF_SF_STAGES = [
    { id: 1, lb: '📋 ابلاغ سفارش / پرونده فعال' },
    { id: 2, lb: '🤖 استعلام تامین مرحله دوم' },
    { id: 3, lb: '🏭 در حال تامین توسط تامین‌کننده' },
    { id: 4, lb: '📦 تحویل تامین‌کننده' },
    { id: 5, lb: '🧰 در حال آماده‌سازی ارسال' },
    { id: 6, lb: '🚚 ارسال‌شده' },
    { id: 7, lb: '🤝 تحویل‌شده به کارفرما' },
    { id: 8, lb: '🧾 در حال صدور فاکتور' },
    { id: 9, lb: '🧾 فاکتور صادر شد' },
    { id: 10, lb: '💰 در حال تسویه' },
    { id: 11, lb: '🏁 تسویه‌شده / مختومه' },
    { id: 12, lb: '🗄 بایگانی‌شده' }
  ];
  window.sfStageOf = function (r) {
    if (!r || !r.wonOffer) return 0; /* فقط پرونده ابلاغ‌شده مرحله دارد */
    var st = 1;
    function up(n) { if (n > st) st = n; }
    try {
      var d = sfDocsOf(r.inqNo ? r : { inqNo: '', docs: r.docs || [] });
      if ((d.supply || []).length) up(2); /* استعلام تامین مرحله دوم ثبت شده */
      /* هم‌راستایی با وضعیت درخواست (st8/st9 از v17.3 — گذار خودکار خرید واقعی/تحویل تامین) */
      var rfq = getData('ptf_crm_rfqs').filter(function (x) { return x.cd === r.inqNo || x.inqNo === r.inqNo; })[0];
      if (rfq) {
        if (rfq.st === 'st8') up(3);
        else if (rfq.st === 'st9') up(4);
        else if (rfq.st === 'st6') up(5);
        else if (rfq.st === 'st7') up(7);
      }
      /* رویدادهای ارسال (US-434 فاز ۲) */
      (r.shipEvents || []).forEach(function (ev) {
        if (ev.type === 'packing') up(5);
        else if (ev.type === 'shipdoc') up(6);
        else if (ev.type === 'delivered') up(7);
      });
      /* فاکتور: ارجاع (پیشنهاد برنده) → ۸؛ فاکتور ثبت‌شده → ۹؛ مانده وصول → ۱۰؛ تسویه کامل → ۱۱ */
      var wo = getData('ptf_crm_offers').filter(function (o) { return o.no === r.wonOffer; })[0];
      if (wo && wo.invRef) up(8);
      if (d.invoices.length) {
        up(9);
        var remain = d.invoices.reduce(function (s2, i) {
          var paid = ((i.payments || []).concat(i.pays || [])).reduce(function (s3, pp) { return s3 + (+pp.amt || 0); }, 0);
          return s2 + Math.max(0, (+i.amount || 0) - paid);
        }, 0);
        up(remain > 0.5 ? 10 : 11);
      }
      if (r.st === 'archived') up(12);
    } catch (e) {}
    return st;
  };
  window.sfStageLabel = function (r) {
    var n = sfStageOf(r);
    if (!n) return '';
    var stg = PTF_SF_STAGES.filter(function (x) { return x.id === n; })[0];
    return stg ? stg.lb : '';
  };

  /* هم‌راستاسازی درخواست با مرحله پرونده — فقط رو به جلو (AC3/AC4).
     ترتیب = ترتیب آرایه PTF_RFQ_STATUSES (st5→st8→st9→st6→st7) — منبع واحد v17.3. */
  function sfRfqAlign(inqNo, targetSt, txt) {
    try {
      var order = (window.PTF_RFQ_STATUSES || []).map(function (x) { return x.v; });
      var rfq = getData('ptf_crm_rfqs').filter(function (x) { return x.cd === inqNo || x.inqNo === inqNo; })[0];
      if (!rfq) return false;
      var ci = order.indexOf(rfq.st), ti = order.indexOf(targetSt);
      if (rfq.st === 'stX' || ti < 0 || ci >= ti) return false; /* عقب‌گرد/لغوشده = هرگز */
      if (typeof ptfRfqSetStatus === 'function') return ptfRfqSetStatus(rfq.cd, targetSt, txt);
      return false;
    } catch (e) { return false; }
  }
  window.sfRfqAlign = sfRfqAlign;

  /* ===== v19.2 (US-434 فاز ۲): پکینگ لیست / اسناد ارسال / تحویل کارفرما — داخل پرونده ===== */
  window.SF_SHIP_TYPES = [
    { id: 'packing', lb: '🧰 پکینگ لیست', rfq: 'st6', rfqTxt: '🟠 آماده‌سازی' },
    { id: 'shipdoc', lb: '🚚 بارنامه / بیجک / سند ارسال', rfq: 'st6', rfqTxt: '🟠 آماده‌سازی' },
    { id: 'delivered', lb: '🤝 تحویل به کارفرما', rfq: 'st7', rfqTxt: '✅ تحویل شده' }
  ];
  /* هسته برنامه‌ای (قابل تست) — UI فقط wrapper است (الگوی sfQcCommit) */
  /* v19.7 (US-440 فاز ۱ — قاعده سراسری توالی رویدادها، ابلاغ کارفرما):
     «تاریخ تحویل به کارفرما نمی‌تواند قبل از زمان ارسال باشد» — چک ترتیب زمانی زنجیره:
     پکینگ ≤ بارنامه ≤ تحویل. خروجی: null یا {ok:false, why:'seq', ...} برای UI. */
  window.sfShipSeqCheck = function (r, typeId, dateISO) {
    if (!r || !dateISO) return null; /* بدون تاریخ صریح = چک زمانی ندارد (توالی مرحله‌ای سر جای خود) */
    var evs = r.shipEvents || [];
    function lastDate(t) {
      var ds = evs.filter(function (e) { return e.type === t && e.dateISO; }).map(function (e) { return e.dateISO; }).sort();
      return ds.length ? ds[ds.length - 1] : '';
    }
    if (typeId === 'delivered') {
      var ship = lastDate('shipdoc');
      if (ship && dateISO < ship) return { ok: false, why: 'seq', lb: 'تاریخ تحویل به کارفرما (' + dateISO + ') نمی‌تواند قبل از تاریخ ارسال/بارنامه (' + ship + ') باشد', prev: ship };
    }
    if (typeId === 'shipdoc') {
      var pk = lastDate('packing');
      if (pk && dateISO < pk) return { ok: false, why: 'seq', lb: 'تاریخ بارنامه (' + dateISO + ') نمی‌تواند قبل از تاریخ پکینگ لیست (' + pk + ') باشد', prev: pk };
    }
    return null;
  };
  window.sfShipCommit = function (cd, typeId, v) {
    v = v || {};
    var list = sfAll();
    var r = list.filter(function (x) { return x.cd === cd; })[0];
    /* US-434/440: ارسال و تحویل فقط در پروندهٔ ابلاغ‌شده/برنده مجاز است؛ guard در هسته */
    if (!r || !r.wonOffer) return null;
    var tp = SF_SHIP_TYPES.filter(function (x) { return x.id === typeId; })[0];
    if (!tp) return null;
    /* v19.7 (US-440ف۱): سد توالی زمانی — برنامه‌ای نه فقط UI */
    var seq = sfShipSeqCheck(r, typeId, (v.dateISO || '').trim());
    if (seq && !seq.ok) return seq;
    if (typeId === 'delivered' && sfStageOf(r) < 5 && !(r.shipEvents || []).length) {
      /* تحویل کارفرما بدون هیچ سابقه ارسال/آماده‌سازی — مجاز ولی در timeline شفاف می‌شود */
      v.note = ((v.note || '') + ' (ثبت مستقیم — بدون پکینگ/بارنامه قبلی)').trim();
    }
    var ev = { cd: genCode('SHP'), type: tp.id, no: (v.no || '').trim(), carrier: (v.carrier || '').trim(), dateISO: (v.dateISO || '').trim(), receiver: (v.receiver || '').trim(), note: (v.note || '').trim(), t: faDateTime(), by: curSession().name, files: [] };
    r.shipEvents = r.shipEvents || []; r.shipEvents.unshift(ev);
    r.timeline = r.timeline || []; r.timeline.push({ t: faDateTime(), by: curSession().name, tx: tp.lb + (ev.no ? ' — ' + ev.no : '') + (ev.receiver ? ' — تحویل‌گیرنده: ' + ev.receiver : '') + (ev.note ? ' — ' + ev.note : '') });
    sfSave(list);
    try { audit('پرونده‌های فروش', 'ثبت ' + tp.lb + (ev.no ? ' (' + ev.no + ')' : '') + ' برای پرونده ' + (r.inqNo || cd), cd); } catch (e) {}
    /* گذار خودکار وضعیت درخواست — فقط رو به جلو، از مسیر واحد (AC2/AC4) */
    if (r.inqNo) sfRfqAlign(r.inqNo, tp.rfq, tp.rfqTxt);
    if (typeId === 'delivered' && typeof notify === 'function') {
      try { notify({ toRoles: SENIOR_ROLES, title: '🤝 کالای پرونده ' + (r.inqNo || cd) + ' به کارفرما تحویل شد — گام بعد: ارجاع فاکتور از پرونده', kind: 'info', channels: ['cart'], link: { panel: 'deals' } }); } catch (e2) {}
    }
    return ev;
  };
  window.sfShipOpen = function (cd, typeId) {
    var r = sfAll().filter(function (x) { return x.cd === cd; })[0];
    if (!r) return;
    var tp = SF_SHIP_TYPES.filter(function (x) { return x.id === typeId; })[0] || SF_SHIP_TYPES[0];
    var flds = [];
    if (typeId === 'packing') flds = [
      { id: 'no', label: 'شماره پکینگ لیست', type: 'text', dir: 'ltr', placeholder: 'PL-1405-001' },
      { id: 'dateISO', label: 'تاریخ پکینگ (میلادی)', type: 'date', dir: 'ltr' }, /* v19.7 US-440ف۱: مبنای چک توالی */
      { id: 'note', label: 'شرح بسته‌بندی / تعداد نگله', type: 'textarea', rows: 2, required: true, placeholder: 'مثلا: ۳ پالت چوبی — ۴۵۰ کیلوگرم' }
    ];
    else if (typeId === 'shipdoc') flds = [
      { id: 'no', label: 'شماره بارنامه / بیجک', type: 'text', dir: 'ltr', required: true },
      { id: 'carrier', label: 'شرکت حمل / راننده', type: 'text', required: true },
      { id: 'dateISO', label: 'تاریخ ارسال (میلادی)', type: 'date', dir: 'ltr' },
      { id: 'note', label: 'توضیح (اختیاری)', type: 'textarea', rows: 2 }
    ];
    else flds = [
      { id: 'receiver', label: 'نام تحویل‌گیرنده کارفرما', type: 'text', required: true },
      { id: 'dateISO', label: 'تاریخ تحویل (میلادی)', type: 'date', dir: 'ltr' },
      { id: 'note', label: 'توضیح / شماره رسید تحویل (اختیاری)', type: 'textarea', rows: 2 }
    ];
    ptfDialog({
      title: tp.lb + ' — ' + (r.inqNo || cd),
      body: typeId === 'delivered'
        ? 'با ثبت تحویل، وضعیت درخواست به «✅ تحویل شده» می‌رود و مرحله پرونده «تحویل‌شده به کارفرما» می‌شود — پیش‌نیاز ارجاع فاکتور.'
        : 'سند در پرونده ثبت و وضعیت درخواست (در صورت عقب‌تر بودن) به «🟠 آماده‌سازی» می‌رود — عقب‌گرد هرگز رخ نمی‌دهد.',
      fields: flds,
      okText: 'ثبت در پرونده',
      onOk: function (v) {
        var ev = sfShipCommit(cd, typeId, v);
        if (ev && ev.ok === false && ev.why === 'seq') { alert('⛔ نقض توالی رویدادها:\n' + ev.lb); return; }
        if (!ev) return;
        if (typeof ptfToast === 'function') ptfToast(tp.lb + ' ثبت شد', 'ok');
        if (confirm('برای این رکورد، سند/اسکن پیوست می‌کنید؟') && typeof attachUploadWidget === 'function') sfShipUpload(cd, ev.cd);
        if (typeof renderDeals === 'function') renderDeals();
      }
    });
  };
  window.sfShipUpload = function (cd, shpCd) {
    var html = '<div class="md-b" style="display:grid;z-index:2600" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:460px"><h3>📎 پیوست سند ارسال/تحویل</h3><div id="sfShipUp"></div><div style="text-align:left;margin-top:10px"><button class="bt" onclick="this.closest(\'.md-b\').remove();if(typeof renderDeals===\'function\')renderDeals()">تمام</button></div></div></div>';
    (document.getElementById('panels') || document.body).insertAdjacentHTML('beforeend', html);
    attachUploadWidget('sfShipUp', 'salesfiles-ship/' + cd, function (f) {
      var list = sfAll();
      var r = list.filter(function (x) { return x.cd === cd; })[0];
      if (!r) return;
      var ev = (r.shipEvents || []).filter(function (x) { return x.cd === shpCd; })[0];
      if (!ev) return;
      ev.files = ev.files || []; ev.files.push(f);
      r.docs = r.docs || [];
      if (f.key && !r.docs.some(function (d) { return d.key === f.key; })) r.docs.push({ name: 'ارسال — ' + f.name, key: f.key, size: f.size || 0, t: faDate(), by: curSession().name, note: 'سند ارسال/تحویل' });
      sfSave(list);
      if (typeof ptfToast === 'function') ptfToast('سند به پرونده پیوست شد', 'ok');
    });
  };

  /* ===== v19.3: ارجاع فاکتور رسمی — فقط از پرونده فروش و فقط پس از تحویل کارفرما =====
     هسته برنامه‌ای قابل تست؛ خروجی {ok, why} — UI فقط wrapper.
     قفل سه‌لایه: ① نقش ارشد ② پرونده برنده ③ مرحله >= ۷ (تحویل‌شده به کارفرما — sfStageOf مشتق v19.2).
     پس از ارجاع، مرحله خودکار ۸ «در حال صدور فاکتور» می‌شود (invRef سیگنال sfStageOf است). */
  window.sfInvoiceRefCommit = function (cd) {
    var r = sfAll().filter(function (x) { return x.cd === cd; })[0];
    if (!r || !r.wonOffer) return { ok: false, why: 'nofile' };
    if (typeof isSenior === 'function' && !isSenior()) return { ok: false, why: 'role' };
    var stg = (typeof sfStageOf === 'function') ? sfStageOf(r) : 0;
    if (stg < 7) return { ok: false, why: 'stage', stage: stg };
    var offers = getData('ptf_crm_offers');
    var o = offers.filter(function (x) { return x.no === r.wonOffer; })[0];
    if (!o) return { ok: false, why: 'nooffer' };
    if (o.invRef) return { ok: false, why: 'already' };
    /* AC3: سند مالی ضمیمه ارجاع = snapshot قطعی برد، نه پیشنهاد زندهٔ قابل‌تغییر */
    if (typeof sfAwardEnsure === 'function') sfAwardEnsure(r);
    o.invRef = { by: curSession().name, role: (typeof roleDef === 'function' ? roleDef().lb : ''), t: faDate(), fromFile: r.cd, awardDoc: r.wonOffer };
    setData('ptf_crm_offers', offers);
    var list = sfAll();
    var rr = list.filter(function (x) { return x.cd === cd; })[0];
    if (rr) { rr.timeline = rr.timeline || []; rr.timeline.push({ t: faDateTime(), by: curSession().name, tx: '🧾 ارجاع فاکتور رسمی به حسابدار (پس از تحویل کارفرما — US-435)' }); sfSave(list); }
    try { audit('پرونده‌های فروش', 'ارجاع فاکتور رسمی ' + r.wonOffer + ' از پرونده ' + (r.inqNo || cd) + ' به حسابدار (مرحله: تحویل‌شده به کارفرما)', cd); } catch (e) {}
    if (typeof notify === 'function') {
      try { notify({ toRoles: ['accountant'], title: '🧾 پرونده ' + (r.inqNo || cd) + ' — پیش‌فاکتور ' + r.wonOffer + ' برای صدور فاکتور رسمی ارجاع شد (کالا تحویل کارفرما شده)', body: 'خریدار: ' + (r.buyerCo || '-') + ' — سند قطعی برد در کارتابل ضمیمه است', kind: 'inv_ref', channels: ['cart'], link: { panel: 'inv' }, actionable: true }); } catch (e2) {}
    }
    return { ok: true };
  };
  window.sfInvoiceRef = function (cd) {
    var res = sfInvoiceRefCommit(cd);
    if (!res.ok) {
      var msgs = {
        role: '⛔ فقط نقش‌های ارشد می‌توانند ارجاع فاکتور بدهند.',
        stage: '🔒 ارجاع فاکتور قفل است — تا قبل از ثبت «🤝 تحویل کارفرما» در همین پرونده، ارجاع به حسابدار مجاز نیست.\n\nمرحله فعلی پرونده: ' + (typeof sfStageLabel === 'function' ? sfStageLabel(sfAll().filter(function (x) { return x.cd === cd; })[0]) : '') ,
        already: 'ℹ️ این پرونده قبلا برای فاکتور ارجاع شده است.',
        nofile: '⛔ پرونده برنده یافت نشد.', nooffer: '⛔ پیشنهاد برنده پرونده یافت نشد.'
      };
      alert(msgs[res.why] || '⛔ ارجاع ممکن نیست');
      return;
    }
    if (typeof ptfToast === 'function') ptfToast('🧾 برای حسابدار ارجاع شد — مرحله پرونده: در حال صدور فاکتور', 'ok');
    /* پیامک اختیاری به حسابدار (الگوی US-150) */
    if (typeof smsSendSingle === 'function' && confirm('📱 پیامک اطلاع‌رسانی هم برای حسابدار ارسال شود؟')) {
      var accs = getData('ptf_crm_users').filter(function (u) { return u.roleId === 'accountant' && u.mobile; });
      if (!accs.length) alert('⚠️ کاربری با نقش حسابدار و شماره موبایل ثبت نشده');
      accs.forEach(function (u) {
        smsSendSingle(u.mobile, 'حسابدار محترم شرکت پیشرو تجهیز فرتاک،\nکالای پرونده ارجاعی به کارفرما تحویل شده و پیش‌فاکتور جهت صدور فاکتور رسمی به کارتابل شما ارجاع شد.\nhttps://pishtaj.ir/crm/', function (d) { addLog(d.ok && d.sent ? 'پیامک ارجاع فاکتور ارسال شد' : 'پیامک ارجاع فاکتور در صف قرار گرفت'); });
      });
    }
    if (typeof renderDeals === 'function') renderDeals();
  };

  window.sfQcUpload = function (cd, qcCd) {
    var html = '<div class="md-b" style="display:grid;z-index:2600" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:460px"><h3>📎 پیوست رکورد QC</h3><div id="sfQcUp"></div><div style="text-align:left;margin-top:10px"><button class="bt" onclick="this.closest(\'.md-b\').remove();if(typeof renderDeals===\'function\')renderDeals()">تمام</button></div></div></div>';
    (document.getElementById('panels') || document.body).insertAdjacentHTML('beforeend', html);
    attachUploadWidget('sfQcUp', 'salesfiles-qc/' + cd, function (f) {
      var list = sfAll();
      var r = list.filter(function (x) { return x.cd === cd; })[0];
      if (!r) return;
      var ev = (r.qcEvents || []).filter(function (x) { return x.cd === qcCd; })[0];
      if (!ev) return;
      ev.files = ev.files || []; ev.files.push(f);
      r.docs = r.docs || [];
      if (f.key && !r.docs.some(function (d) { return d.key === f.key; })) r.docs.push({ name: 'QC — ' + f.name, key: f.key, size: f.size || 0, t: faDate(), by: curSession().name, note: 'سند کنترل کیفیت/بازرسی' });
      sfSave(list);
      if (typeof ptfToast === 'function') ptfToast('سند QC به پرونده پیوست شد', 'ok');
    });
  };

  /* ---------- پنل ---------- */
  window.buildDeals = function () {
    /* MOB-030: تب‌های پرونده/فرصت پیش‌تر buttonهای inline و متغیر بر پایهٔ طول
       متن بودند؛ در 320px عنوان مهم tab بریده می‌شد. ساختار زیر یک tablist
       معنایی با tileهای هم‌اندازه در موبایل و segmented-control پایدار در desktop است. */
    var tab = window._sfTab === 'oppo' ? 'oppo' : 'files';
    var nOppo = (typeof window.ptfOppoCount === 'function') ? window.ptfOppoCount() : 0;
    var oppoView = window._sfOppoView === 'customer' ? 'customer' : 'inq';
    var oppoCountText = nOppo ? (+nOppo).toLocaleString('fa-IR') : '';

    function tb(id, icon, title, meta) {
      var on = tab === id;
      var label = id === 'files'
        ? 'پرونده‌ها، ابلاغ سفارش'
        : 'فرصت‌های فعال، رهگیری پیش از ابلاغ' + (nOppo ? '، ' + oppoCountText + ' فرصت فعال' : '');
      return '<button id="sfTab-' + id + '" type="button" class="sf-tab sf-tab-' + id + (on ? ' is-active' : '') + '"' +
        ' role="tab" aria-selected="' + (on ? 'true' : 'false') + '" aria-controls="sfDealContent"' +
        ' aria-label="' + label + '" title="' + label + '" tabindex="' + (on ? '0' : '-1') + '"' +
        ' onclick="sfSetTab(\'' + id + '\')" onkeydown="sfTabKeydown(event,\'' + id + '\')">' +
        '<span class="sf-tab-icon" aria-hidden="true">' + icon + '</span>' +
        '<span class="sf-tab-copy"><span class="sf-tab-title">' + title + '</span><span class="sf-tab-meta">' + meta + '</span></span>' +
        (id === 'oppo' && nOppo ? '<span class="sf-tab-count" aria-hidden="true">' + oppoCountText + '</span>' : '') +
        '</button>';
    }
    function ov(id, icon, title, meta) {
      var on = oppoView === id;
      var label = title + '؛ ' + meta;
      return '<button id="sfOppoView-' + id + '" type="button" class="sf-oppo-view sf-oppo-view-' + id + (on ? ' is-active' : '') + '"' +
        ' role="tab" aria-selected="' + (on ? 'true' : 'false') + '" aria-controls="dealWrap"' +
        ' aria-label="' + label + '" title="' + label + '" tabindex="' + (on ? '0' : '-1') + '"' +
        ' onclick="sfSetOppoView(\'' + id + '\')" onkeydown="sfOppoViewKeydown(event,\'' + id + '\')">' +
        '<span class="sf-oppo-view-icon" aria-hidden="true">' + icon + '</span>' +
        '<span class="sf-oppo-view-copy"><span class="sf-oppo-view-title">' + title + '</span><span class="sf-oppo-view-meta">' + meta + '</span></span>' +
        '</button>';
    }

    return '<div class="ph sf-head"><h3>📁 پرونده‌های فروش</h3>' +
      '<div class="sb2 sf-search"><input type="text" id="sfSrch" placeholder="جستجو: شماره درخواست، کارفرما..." aria-label="جست‌وجو در پرونده‌ها و فرصت‌های فروش" oninput="renderDeals()" style="flex:1"></div></div>' +
      '<div class="sf-tabs" role="tablist" aria-label="بخش پرونده‌های فروش">' +
      tb('files', '📁', 'پرونده‌ها', 'ابلاغ سفارش') +
      tb('oppo', '🎯', 'فرصت‌های فعال', 'رهگیری پیش از برد') +
      '</div>' +
      '<section id="sfDealContent" class="sf-deal-content sf-deal-content-' + tab + '" role="tabpanel" aria-labelledby="sfTab-' + tab + '">' +
      (tab === 'files'
        ? '<div class="sf-context sf-context-files" role="note"><span class="sf-context-icon" aria-hidden="true">ℹ️</span><span>پرونده فروش فقط با ثبت «🏆 برنده» پیشنهاد مالی (ابلاغ سفارش) ساخته می‌شود؛ هر ابلاغ یک پرونده با همهٔ اسناد است و پس از مختومه/تسویه به بایگانی می‌رود.</span></div>'
        : '<div class="sf-context sf-context-oppo" role="note"><span class="sf-context-icon" aria-hidden="true">🎯</span><span>درخواست‌های دارای پیشنهادِ هنوز برنده‌نشده را برای مهلت و نتیجه رهگیری کنید؛ با برد CO خودکار پرونده می‌شوند و باخت با دلیل استاندارد به گزارش Win/Loss می‌رود.</span></div>' +
          '<div class="sf-oppo-switcher"><span id="sfOppoViewLabel" class="sf-oppo-switcher-label">نمای فرصت‌ها</span>' +
          '<div class="sf-oppo-views" role="tablist" aria-labelledby="sfOppoViewLabel">' +
          ov('inq', '📋', 'بر اساس درخواست', 'هر درخواست') +
          ov('customer', '🤝', 'بر اساس مشتری', 'تجمیع مشتری') +
          '</div></div>') +
      '<div id="dealWrap"></div></section>';
  };

  var sfRenderSeq = 0;
  function sfRenderPanel(focusId) {
    /* تغییر DOM را یک tick بعد از pointer/keyboard event انجام می‌دهیم؛ در غیر این
       صورت button در میانهٔ click از زیر انگشت حذف می‌شد. token نیز clickهای پشت‌سرهم
       را به آخرین مقصد coalesce می‌کند. */
    var token = ++sfRenderSeq;
    var redraw = function () {
      if (token !== sfRenderSeq) return;
      var p = document.getElementById('panels');
      /* اگر کاربر پیش از redraw به پنل دیگری رفته، نباید timer کوتاه، صفحهٔ تازه را
         با پرونده‌های فروش جایگزین کند. */
      if (!p || !p.querySelector('#sfDealContent')) return;
      p.innerHTML = buildDeals();
      renderDeals();
      if (!focusId) return;
      var restoreFocus = function () {
        if (token !== sfRenderSeq) return;
        var control = document.getElementById(focusId);
        if (control && typeof control.focus === 'function') control.focus();
      };
      if (window.requestAnimationFrame) window.requestAnimationFrame(restoreFocus);
      else setTimeout(restoreFocus, 0);
    };
    if (typeof window.setTimeout === 'function') window.setTimeout(redraw, 0);
    else redraw();
  }

  window.sfSetTab = function (t) {
    window._sfTab = t === 'oppo' ? 'oppo' : 'files';
    sfRenderPanel('sfTab-' + window._sfTab);
  };
  window.sfSetOppoView = function (v) {
    window._sfOppoView = v === 'customer' ? 'customer' : 'inq';
    sfRenderPanel('sfOppoView-' + window._sfOppoView);
  };

  /* Tab/Shift+Tab هنوز رفتار طبیعی button را دارند؛ فلش‌ها/Home/End بین tabهای
     هم‌سطح حرکت می‌کنند. در RTL، ArrowLeft به tile بعدیِ قابل‌مشاهده می‌رود. */
  function sfTabTarget(event, current, ids) {
    if (!event) return '';
    var key = event.key;
    var at = ids.indexOf(current);
    if (at < 0) return '';
    var next = at;
    if (key === 'ArrowLeft' || key === 'ArrowDown') next = (at + 1) % ids.length;
    else if (key === 'ArrowRight' || key === 'ArrowUp') next = (at - 1 + ids.length) % ids.length;
    else if (key === 'Home') next = 0;
    else if (key === 'End') next = ids.length - 1;
    else return '';
    event.preventDefault();
    return ids[next];
  }
  window.sfTabKeydown = function (event, current) {
    var next = sfTabTarget(event, current, ['files', 'oppo']);
    if (next) window.sfSetTab(next);
  };
  window.sfOppoViewKeydown = function (event, current) {
    var next = sfTabTarget(event, current, ['inq', 'customer']);
    if (next) window.sfSetOppoView(next);
  };

  window.renderDeals = function () {
    var el = document.getElementById('dealWrap');
    if (!el) return;
    var q = ((document.getElementById('sfSrch') || {}).value || '').trim().toLowerCase();
    /* v16.8 (US-404 فاز ۱) + US-435: تب فرصت‌ها با دو نمای درخواست/مشتری */
    if ((window._sfTab || 'files') === 'oppo') {
      if ((window._sfOppoView || 'inq') === 'customer' && typeof window.ptfOppoRenderByCustomer === 'function') { window.ptfOppoRenderByCustomer(el, q); return; }
      if (typeof window.ptfOppoRender === 'function') { window.ptfOppoRender(el, q); return; }
      el.innerHTML = '<div style="color:#94a3b8;text-align:center;padding:20px">ماژول فرصت‌ها بارگذاری نشده — یک بار رفرش کنید</div>';
      return;
    }
    var list = sfAll().filter(function (r) {
      if (r.st === 'archived') return false;
      /* v16.8 (US-404): پرونده = فقط ابلاغ‌شده (wonOffer) — رکوردهای قدیمی دارای فاکتور هم از باب احتیاط پرونده می‌مانند.
         رکوردهای قدیمی بدون برد حذف نمی‌شوند (مهاجرت نرم) — در تب فرصت‌ها نمایندگی می‌شوند و با برد، همین رکورد پرونده می‌شود. */
      if (!r.wonOffer && !(r.inqNo && sfHasInvoice(r))) return false;
      return !q || ((r.inqNo || '') + ' ' + (r.buyerCo || '') + ' ' + (r.offerNo || '')).toLowerCase().indexOf(q) > -1;
    });
    var h = '';
    list.forEach(function (r) {
      var inqKey = r.inqNo || r.offerNo || r.cd; // سازگاری با رکوردهای قدیمی (offerNo محور)
      var d = sfDocsOf(r.inqNo ? r : { inqNo: '', docs: r.docs || [] });
      var nDocs = d.offers.length + d.letters.length + d.invoices.length + d.misc.length + (d.supply || []).length; /* v17.1 US-404ف۲ */
      var hasInv = r.inqNo ? sfHasInvoice(r) : false;
      var lossBadge = (typeof ptfProjectLossBadge === 'function') ? ptfProjectLossBadge(r) : '';
      var open = window._sfOpen === r.cd;
      /* v14.8: بج تاریخ تحویل تعهدی — قرمز=گذشته/امروز، نارنجی=نزدیک */
      var dueSt = (typeof ptfSfDueState === 'function') ? ptfSfDueState(r) : null;
      /* v19.2: بج مرحله ۱۲گانه — مشتق از سیگنال‌های واقعی، منبع واحد sfStageOf */
      var stgN = (typeof sfStageOf === 'function') ? sfStageOf(r) : 0;
      var stgBadge = stgN ? ' | <span style="color:#0e7490;font-weight:800">' + escP((typeof sfStageLabel === 'function' ? sfStageLabel(r) : '')) + ' <small style="color:#94a3b8">(' + stgN + '/12)</small></span>' : '';
      var dueBadge = r.dueISO
        ? ' | <span style="color:' + (dueSt === 'red' ? '#dc2626;font-weight:800' : dueSt === 'orange' ? '#d97706;font-weight:800' : '#64748b') + '">' +
          (dueSt === 'red' ? '🚚⏰ تحویل تعهدی: ' + escP(r.dueISO) + ' — سررسید/تاخیر!' : dueSt === 'orange' ? '🚚⏳ تحویل تعهدی نزدیک: ' + escP(r.dueISO) : '🚚 تحویل تعهدی: ' + escP(r.dueISO)) + '</span>'
        : '';
      h += '<div style="background:var(--crd,#fff);border:1px solid var(--brd);border-radius:14px;margin-bottom:8px;overflow:hidden' + (dueSt === 'red' ? ';border-color:#fca5a5' : '') + '">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:12px 14px;cursor:pointer;flex-wrap:wrap' + (dueSt === 'red' ? ';background:#fef2f2' : dueSt === 'orange' ? ';background:#fffbeb' : '') + '" onclick="sfToggle(\'' + ptfOnClickArg(r.cd) + '\')">' +
        '<div style="font-size:13px"><b dir="ltr">' + escP(inqKey) + '</b> — ' + escP(r.buyerCo || '-') +
        '<div style="font-size:11px;color:#64748b;margin-top:2px">' + nDocs + ' سند منضم | ایجاد: ' + escP(r.t || '') + stgBadge + (hasInv ? ' | <span style="color:#059669">🧾 فاکتور ثبت شده</span>' : '') + dueBadge + (lossBadge ? ' | ' + lossBadge : '') + '</div>' +
        '<div style="margin-top:5px">' + (typeof window.ptfSalesFileMarginBadge === 'function' ? window.ptfSalesFileMarginBadge(r) : '') + '</div></div>' +
        '<span style="font-size:13px;color:#94a3b8">' + (open ? '▲' : '▼') + '</span></div>' +
        (open ? sfDrawerHtml(r, d, hasInv) : '') +
        '</div>';
    });
    el.innerHTML = h || '<div style="text-align:center;color:#94a3b8;padding:24px">پرونده‌ای نیست — با ثبت «🏆 برنده» روی پیشنهاد مالی (ابلاغ سفارش)، خودکار ساخته می‌شود. درخواست‌های در جریان را در تب «🎯 فرصت‌های فعال» ببینید.</div>';
  };

  window.sfToggle = function (cd) {
    window._sfOpen = window._sfOpen === cd ? null : cd;
    renderDeals();
  };

  /* ---------- کشوی اسناد ---------- */
  function sfFinancialStrip(r, d) {
    var advTxt = '—', advState = '#64748b';
    try {
      var wo = getData('ptf_crm_offers').filter(function (o) { return o.no === r.wonOffer; })[0];
      if (wo && typeof ptfAdvanceNormalize === 'function') {
        var a = ptfAdvanceNormalize(wo);
        if (a && a.mode && a.mode !== 'none') {
          advTxt = (typeof ptfAdvanceLabel === 'function' ? ptfAdvanceLabel(wo) : 'ثبت‌شده');
          advState = a.paid || a.cashFull ? '#059669' : '#b45309';
        }
      }
    } catch (e) {}
    var rb = (typeof ptfRealBuyStatus === 'function') ? ptfRealBuyStatus(r.inqNo) : { total: 0, done: 0, has: false };
    var costSum = (r.costEvents || []).reduce(function (s, x) { return s + (+x.amt || 0); }, 0);
    var invCount = (d.invoices || []).length;
    var openAmt = (d.invoices || []).reduce(function (s, i) {
      var paid = ((i.payments || []).concat(i.pays || [])).reduce(function (z, p) { return z + (+p.amt || 0); }, 0);
      return s + Math.max(0, (+i.amount || 0) - paid);
    }, 0);
    var au = (typeof sfCloseAudit === 'function') ? sfCloseAudit(r) : { blockers: [], warns: [] };
    var ready = !au.blockers.length && openAmt <= 0.5;
    var mg = (typeof window.ptfSalesFileMargin === 'function') ? window.ptfSalesFileMargin(r) : null;
    var mgHtml = (mg && (mg.ok || mg.profit != null))
      ? '<span style="background:#fff;border:1px solid #bbf7d0;border-radius:8px;padding:4px 8px;color:' + (mg.provisional ? '#b45309' : (mg.profit >= 0 ? '#047857' : '#b91c1c')) + '">📈 حاشیه سود' + (mg.provisional ? ' تقریبی' : ' واقعی') + ': <b>' + (mg.profit || 0).toLocaleString('fa-IR') + ' ریال</b> <span dir="ltr">(' + (mg.pct != null ? mg.pct.toLocaleString('fa-IR') + '٪' : '—') + ')</span><small style="display:block;font-weight:400;color:#64748b">فروش ' + (mg.sell || 0).toLocaleString('fa-IR') + ' − هزینه ' + (mg.cost || 0).toLocaleString('fa-IR') + (mg.sellSrc ? ' — ' + escP(mg.sellSrc) : '') + '</small></span>'
      : '<span style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:4px 8px;color:#64748b">📈 حاشیه سود: هنوز قابل محاسبه نیست</span>';
    return '<div style="background:#f8fafc;border:1px solid var(--brd);border-radius:12px;padding:10px 12px;margin:8px 0 10px;font-size:12px">' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
      mgHtml +
      '<span style="background:#fff;border:1px solid #dbeafe;border-radius:8px;padding:4px 8px;color:' + advState + '">💰 پیش‌پرداخت: <b>' + escP(advTxt) + '</b></span>' +
      '<span style="background:#fff;border:1px solid #bbf7d0;border-radius:8px;padding:4px 8px;color:#166534">🛒 خرید واقعی: <b>' + (rb.has ? ((rb.full || 0) + ' / ' + rb.total + ' قلم کامل' + (rb.partial ? ' — ' + rb.partial + ' قلم ناقص' : '')) : 'هنوز شروع نشده') + '</b></span>' +
      '<span style="background:#fff;border:1px solid #fde68a;border-radius:8px;padding:4px 8px;color:#92400e">➕ هزینه‌های مستقیم: <b>' + costSum.toLocaleString('fa-IR') + ' ریال</b></span>' +
      '<span style="background:#fff;border:1px solid #e9d5ff;border-radius:8px;padding:4px 8px;color:#6d28d9">🧾 فاکتورها: <b>' + invCount + '</b>' + (openAmt > 0 ? ' | باز: ' + openAmt.toLocaleString('fa-IR') + ' ریال' : ' | تسویه: کامل') + '</span>' +
      '<span style="background:' + (ready ? '#ecfdf5;color:#166534;border:1px solid #86efac' : '#fff7ed;color:#9a3412;border:1px solid #fdba74') + ';border-radius:8px;padding:4px 8px">🏁 آمادگی بایگانی: <b>' + (ready ? 'آماده' : 'نیازمند بررسی') + '</b></span>' +
      '</div></div>';
  }
  function sfDrawerHtml(r, d, hasInv) {
    function row(ic, tx, actions) {
      return '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:7px 0;border-bottom:1px dashed var(--brd);font-size:12.5px"><span>' + ic + ' ' + tx + '</span><span style="white-space:nowrap">' + (actions || '') + '</span></div>';
    }
    /* MOB-039: actionهای Post-Award به‌جای buttonهای رنگی/متغیر، یک contract
       مشخص icon + label + meta دارند. این helper فقط presentation را تغییر می‌دهد؛
       onclick و guardهای کسب‌وکار همان مسیر قبلی را حفظ می‌کنند. */
    function postAction(kind, icon, label, title, onClick, opt) {
      opt = opt || {};
      var extra = (opt.primary ? ' is-primary' : '') + (opt.wide ? ' is-wide' : '') + (opt.locked ? ' is-locked' : '');
      var meta = opt.meta ? '<span class="sf-post-award-meta">' + opt.meta + '</span>' : '';
      return '<button type="button" class="bt bt-o sf-post-award-action sf-post-award-' + kind + extra + '" data-sf-post-action="' + kind + '"' +
        ' title="' + escP(title || label) + '" aria-label="' + escP(title || label) + '" onclick="' + onClick + '">' +
        '<span class="sf-post-award-icon" aria-hidden="true">' + icon + '</span>' +
        '<span class="sf-post-award-copy"><span class="sf-post-award-label">' + label + '</span>' + meta + '</span></button>';
    }
    var h = '<div style="padding:4px 14px 12px;border-top:1px solid var(--brd)">' + sfFinancialStrip(r, d);
    var KINDS = { TO: 'پیشنهاد فنی', CO: 'پیشنهاد مالی', TC: 'پیشنهاد فنی-مالی' };
    d.offers.forEach(function (o) {
      h += row('📄', '<b dir="ltr">' + escP(o.no) + '</b> — ' + (KINDS[o.kind] || o.kind) + ((typeof window.ptfRialCompanionBadge === 'function') ? ' ' + window.ptfRialCompanionBadge(o) : '') + (o.rev ? ' <span style="color:#7c3aed">(آخرین رویژن: Rev.' + o.rev + ')</span>' : '') + ' — ' + escP(o.dt || o.dateFa || ''),
        '<button class="bt bt-o" style="padding:3px 9px;font-size:11.5px" onclick="event.stopPropagation();offerQuickPreview(\'' + ptfOnClickArg(o.no) + '\')">👁</button>');
    });
    /* v17.1 (US-404 فاز ۲): استعلام‌های تامین — رهگیری کشف قیمت داخل خود پرونده */
    (d.supply || []).forEach(function (q2) {
      var nT = (q2.targets || []).length;
      var nR = (q2.targets || []).filter(function (t2) { return t2.st === 'replied'; }).length;
      h += row('🤖', '<b dir="ltr">' + escP(q2.no) + '</b> — استعلام تامین (' + (q2.items || []).length + ' قلم | ' + nT + ' تامین‌کننده | ' + nR + ' پاسخ)',
        '<button class="bt bt-o" style="padding:3px 9px;font-size:11.5px" onclick="event.stopPropagation();if(typeof rfqsOpen===\'function\')rfqsOpen(\'' + ptfOnClickArg(q2.no) + '\')">👁 کارت رهگیری</button>');
    });
    d.letters.forEach(function (l) {
      h += row('✉️', escP(l.no || l.cd) + ' — ' + escP(l.subject || '-'),
        (l.st === 'signed' || l.st === 'registered' ? '<button class="bt bt-o" style="padding:3px 9px;font-size:11.5px" onclick="event.stopPropagation();letPrint(\'' + ptfOnClickArg(l.cd) + '\',false)">👁</button>' : '<span style="color:#94a3b8;font-size:11px">' + escP(l.st || '') + '</span>'));
    });
    d.invoices.forEach(function (i) {
      var act = '';
      if (i.isUnofficial) {
        act = '<button class="bt bt-o" style="padding:2px 7px;font-size:11px;color:#d97706;border-color:#f59e0b" onclick="event.stopPropagation();unofficialInvoicePrint(\'' + ptfOnClickArg(i.offerNo) + '\')">👁 نمایش/چاپ</button>';
      } else {
        act = (i.files || []).map(function (f) { return '<a href="javascript:void(0)" onclick="event.stopPropagation();openStoredFile(\'' + ptfOnClickArg(f.key || '') + '\')" style="color:#0e7490;font-size:11.5px">📎' + escP(f.name) + '</a>'; }).join(' ');
      }
      h += row('🧾', (i.isUnofficial ? 'فاکتور غیررسمی ' : 'فاکتور ') + escP(i.no) + ' — ' + (+i.amount).toLocaleString('fa-IR') + ' ریال — ' + escP(i.t || ''), act);
    });
    d.misc.forEach(function (m, mi) {
      h += row('📎', escP(m.name || '-') + ' <small style="color:#94a3b8">(' + escP(m.t || '') + ' — ' + escP(m.by || '') + ')</small>',
        (m.key ? '<a href="javascript:void(0)" onclick="event.stopPropagation();openStoredFile(\'' + ptfOnClickArg(m.key) + '\')" style="color:#0e7490;font-size:11.5px">مشاهده</a> ' : '') +
        '<button class="bt bt-o" style="padding:2px 7px;font-size:11px;color:#dc2626" onclick="event.stopPropagation();sfDelMisc(\'' + ptfOnClickArg(r.cd) + '\',' + mi + ')">✕</button>');
    });
    if (!d.offers.length && !d.letters.length && !d.invoices.length && !d.misc.length && !(d.supply || []).length)
      h += '<div style="color:#94a3b8;font-size:12px;padding:8px 0">سندی منضم نشده</div>';
    /* v19.2: استپر مراحل ۱۲گانه پرونده — فقط نمایش؛ منبع واحد sfStageOf */
    if (r.wonOffer && typeof sfStageOf === 'function') {
      var _stg = sfStageOf(r);
      h += '<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:8px 12px;margin-top:10px;font-size:11.5px" onclick="event.stopPropagation()"><b style="font-size:12.5px">🧭 مرحله پرونده: ' + escP(sfStageLabel(r)) + ' <small style="color:#64748b">(' + _stg + ' از 12 — US-433)</small></b>' +
        '<div style="display:flex;gap:3px;flex-wrap:wrap;margin-top:6px">' +
        (window.PTF_SF_STAGES || []).map(function (stg) {
          var on = stg.id <= _stg;
          return '<span title="' + escP(stg.lb) + '" style="flex:1;min-width:26px;text-align:center;border-radius:6px;padding:3px 2px;font-size:10px;font-weight:800;' + (stg.id === _stg ? 'background:#0e7490;color:#fff' : on ? 'background:#cffafe;color:#155e75' : 'background:#f1f5f9;color:#94a3b8') + '">' + stg.id + '</span>';
        }).join('') + '</div>' +
        '<div style="color:#64748b;margin-top:5px">مرحله از روی رویدادهای واقعی (خرید، تحویل تامین، پکینگ/بارنامه، تحویل کارفرما، فاکتور، وصول) محاسبه می‌شود — دستی و قابل عقب‌گرد نیست.</div></div>';
    }
    /* v19.2 (US-434 فاز ۲): سوابق ارسال/تحویل */
    if (r.shipEvents && r.shipEvents.length) {
      h += '<div style="background:#fef9c3;border:1px solid #fde047;border-radius:12px;padding:8px 12px;margin-top:8px;font-size:12.5px" onclick="event.stopPropagation()"><b>🚚 ارسال و تحویل</b>';
      r.shipEvents.forEach(function (se) {
        var tpS = (window.SF_SHIP_TYPES || []).filter(function (x) { return x.id === se.type; })[0] || {};
        h += '<div style="padding:5px 0;border-top:1px dashed #fde047">' + (tpS.lb || se.type) + (se.no ? ' — <b dir="ltr">' + escP(se.no) + '</b>' : '') + (se.carrier ? ' — ' + escP(se.carrier) : '') + (se.receiver ? ' — تحویل‌گیرنده: <b>' + escP(se.receiver) + '</b>' : '') + (se.dateISO ? ' — <span dir="ltr">' + escP(se.dateISO) + '</span>' : '') + (se.note ? ' — ' + escP(se.note) : '') +
          ' <small style="color:#94a3b8">(' + escP(se.t || '') + ' — ' + escP(se.by || '') + ')</small>' +
          (se.files || []).map(function (f) { return f.key ? ' <a href="javascript:void(0)" onclick="openStoredFile(\'' + ptfOnClickArg(f.key) + '\')" style="color:#0e7490;font-size:11.5px">📎' + escP(f.name) + '</a>' : ''; }).join('') + '</div>';
      });
      h += '</div>';
    }
    /* v19.1: باکس اسناد قطعی برد — snapshot لحظه ابلاغ سفارش */
    if (r.wonOffer) {
      var awd = (typeof sfAwardEnsure === 'function') ? sfAwardEnsure(r) : (r.awardDocs || []);
      if (awd && awd.length) {
        h += '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:8px 12px;margin-top:10px;font-size:12.5px" onclick="event.stopPropagation()">' +
          '<b>🏆 اسناد قطعی برد</b> <small style="color:#92400e">— نسخه لحظه ابلاغ سفارش (تغییرناپذیر) — مبنای فاکتور و ارجاع حسابدار</small>';
        awd.forEach(function (adoc) {
          h += '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:5px 0;border-top:1px dashed #fde68a;flex-wrap:wrap">' +
            '<span>' + (adoc.role === 'technical' ? '🔧 پیشنهاد فنی مرتبط' : '💰 پیشنهاد مالی برنده') + ' — <b dir="ltr">' + escP(adoc.no) + '</b>' + (adoc.rev ? ' (Rev.' + adoc.rev + ')' : '') + ' <small style="color:#94a3b8">' + escP(adoc.t || '') + (adoc.migrated ? ' — مهاجرت نرم' : '') + '</small></span>' +
            '<button class="bt bt-o" style="padding:3px 9px;font-size:11.5px" onclick="sfAwardPrint(\'' + ptfOnClickArg(r.cd) + '\',\'' + ptfOnClickArg(adoc.no) + '\')">🖨 PDF / چاپ سند برد</button></div>';
        });
        h += '</div>';
      }
    }
    /* v19.1 (US-434 فاز ۱): رکوردهای کنترل کیفیت/بازرسی داخل پرونده */
    if (r.qcEvents && r.qcEvents.length) {
      h += '<div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:12px;padding:8px 12px;margin-top:8px;font-size:12.5px" onclick="event.stopPropagation()"><b>🔬 کنترل کیفیت / بازرسی</b>';
      r.qcEvents.forEach(function (qe) {
        var tpQ = (window.SF_QC_TYPES || []).filter(function (x) { return x.id === qe.type; })[0] || {};
        var cfQ = (window.SF_QC_CONF || []).filter(function (x) { return x.id === qe.conf; })[0] || {};
        h += '<div style="padding:5px 0;border-top:1px dashed #99f6e4' + (qe.conf === 'nonconform' ? ';color:#b91c1c' : '') + '">' + (tpQ.lb || qe.type) + ' — <b>' + (cfQ.lb || qe.conf) + '</b> — ' + escP(qe.desc || '') +
          ' <small style="color:#94a3b8">(' + escP(qe.t || '') + ' — ' + escP(qe.by || '') + ')</small>' +
          (qe.files || []).map(function (f) { return f.key ? ' <a href="javascript:void(0)" onclick="openStoredFile(\'' + ptfOnClickArg(f.key) + '\')" style="color:#0e7490;font-size:11.5px">📎' + escP(f.name) + '</a>' : ''; }).join('') + '</div>';
      });
      h += '</div>';
    }
    /* v34.0.0-alpha (F4-5): نمایش متمایز هزینه‌های لینک‌شده از تنخواه
       - هزینهٔ مستقیم پرونده: دکمه‌های ✏️📎🗑 (همان قبل)
       - هزینهٔ لینک‌شده از تنخواه (fromPetty): فقط دکمهٔ 🏦 (رفتن به تنخواه) + 🗑 (حذف لینک) */
    var pjPettyLinkedCds = (r.costEvents || []).filter(function (x) { return x.pettyCd || x.fromPetty; }).map(function (x) { return x.pettyCd || x.cd; });
    /* v34.0.0-alpha (F4-5) FIX: هزینه‌های تنخواه لینک‌نشده به این پرونده
       = همهٔ هزینه‌های فعال (st !== 'void' && st !== 'settled'?) که dealRef خالی/متفاوت دارند
       و هنوز در costEvents این پرونده نیستند.
       الگو از petty.js#ptfPettyRelatedCosts گرفته شده ولی فیلتر معکوس شده. */
    var pjPettyUnlinkedAvailable = (getData('ptf_crm_petty') || []).filter(function (p) {
      if (p.st === 'void') return false;
      /* هزینه‌ای که dealRef دارد (به هر پرونده‌ای) → لینک‌شده → از لیست حذف */
      if (p.dealRef) return false;
      /* هزینه‌ای که قبلاً در costEvents این پرونده ثبت شده → تکراری نشود */
      return pjPettyLinkedCds.indexOf(p.cd) === -1;
    });
    h += '<div style="background:#fff7ed;border:1px solid #fdba74;border-radius:12px;padding:8px 12px;margin-top:8px;font-size:12.5px" onclick="event.stopPropagation()"><b>➕ هزینه‌های مستقیم پرونده</b>' +
      ((r.costEvents && r.costEvents.length)
        ? (r.costEvents.map(function (ce) {
            var files = (ce.files || []).map(function (f) { return f.key ? '<a href="javascript:void(0)" onclick="openStoredFile(\'' + ptfOnClickArg(f.key) + '\')" style="color:#0e7490;font-size:11.5px">📎' + escP(f.name) + '</a>' : ''; }).join(' ');
            var isPetty = ce.pettyCd || ce.fromPetty;
            var pettyCd = ce.pettyCd || ce.cd;
            var tagBtn = isPetty ? '<span style="background:#dbeafe;color:#1e40af;padding:2px 7px;border-radius:6px;font-size:10.5px;margin-left:6px">🔗 از تنخواه</span>' : '';
            /* هزینهٔ مستقیم: ✏️📎🗑 / هزینهٔ تنخواه: 🏦 (رفتن به ماژول تنخواه) + 🗑 (حذف لینک) */
            var actions = isPetty
              ? '<button class="bt bt-o" style="padding:3px 8px;font-size:11px;color:#0d9488" onclick="ptfDealGoPetty(\'' + ptfOnClickArg(pettyCd) + '\')" title="مشاهده در ماژول تنخواه">🏦</button> <button class="bt bt-o" style="padding:3px 8px;font-size:11px;color:#dc2626" onclick="ptfDealRemoveCost(\'' + ptfOnClickArg(r.cd) + '\',\'' + ptfOnClickArg(ce.cd) + '\',\'' + ptfOnClickArg(pettyCd) + '\')" title="حذف لینک از تنخواه">🗑️</button>'
              : '<button class="bt bt-o" style="padding:3px 8px;font-size:11px;color:#0e7490" onclick="ptfProjectCostOpen(\'' + ptfOnClickArg(r.inqNo || '') + '\',\'' + ptfOnClickArg(ce.cd) + '\')">✏️ اصلاح</button> <button class="bt bt-o" style="padding:3px 8px;font-size:11px;color:#7c3aed" onclick="ptfProjectCostUpload(\'' + ptfOnClickArg(r.cd) + '\',\'' + ptfOnClickArg(ce.cd) + '\')">📎</button> <button class="bt bt-o" style="padding:3px 8px;font-size:11px;color:#dc2626" onclick="ptfDealRemoveCost(\'' + ptfOnClickArg(r.cd) + '\',\'' + ptfOnClickArg(ce.cd) + '\',\'' + ptfOnClickArg(ce.pettyCd || '') + '\')" title="حذف هزینه">🗑️</button>';
            return '<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-top:1px dashed #fdba74;flex-wrap:wrap;align-items:center"><span><b>' + (+ce.amt || 0).toLocaleString('fa-IR') + ' ریال</b> ' + tagBtn + ' — ' + escP(ce.desc || '') + ' <small style="color:#94a3b8">(' + escP(ce.t || '') + ' — ' + escP(ce.by || '') + ')</small>' + (files ? '<br><small>' + files + '</small>' : '') + '</span><span style="white-space:nowrap">' + actions + '</span></div>';
          }).join(''))
        : '<div style="padding:6px 0;color:#94a3b8">هنوز هزینه مستقیمی برای این پرونده ثبت نشده است.</div>') +
      /* v34.0.0-alpha (F4-5): دکمهٔ «افزودن از تنخواه» — لیست هزینه‌های لینک‌نشده تنخواه به این پرونده */
      (pjPettyUnlinkedAvailable.length
        ? '<div style="margin-top:8px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:6px 0;border-top:1px dashed #fdba74">' +
          '<button class="bt bt-o" style="font-size:12px;background:#0d9488;color:#fff;border-color:#0d9488" onclick="ptfDealLinkFromPetty(\'' + ptfOnClickArg(r.cd) + '\',\'' + ptfOnClickArg(r.inqNo || '') + '\')">🔗 افزودن هزینهٔ تنخواه به پرونده (' + pjPettyUnlinkedAvailable.length + ' مورد لینک‌نشده)</button>' +
          '<span style="font-size:11px;color:#64748b">جلوگیری از ثبت تکراری</span>' +
          '</div>'
        : '') +
      '</div>';
    try {
      if (r.wonOffer && typeof ptfDocxCoverage === 'function') {
        var _plCov = ptfDocxCoverage(r, 'PL'), _inCov = ptfDocxCoverage(r, 'IN');
        if (_plCov.total) h += '<div style="background:#fff8f1;border:1px solid #fed7aa;border-radius:10px;padding:7px 11px;margin-top:8px;font-size:11.5px;color:#9a3412" onclick="event.stopPropagation()">🧰 پوشش پکینگ رسمی: <b>' + _plCov.used + ' / ' + _plCov.total + '</b>' + (_plCov.remain ? ' — باقیمانده: ' + _plCov.remain + ' قلم' : ' — کامل ✅') + '</div>';
        if (_inCov.total) h += '<div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:10px;padding:7px 11px;margin-top:6px;font-size:11.5px;color:#0f766e" onclick="event.stopPropagation()">🔬 پوشش نوت بازرسی رسمی: <b>' + _inCov.used + ' / ' + _inCov.total + '</b>' + (_inCov.remain ? ' — باقیمانده: ' + _inCov.remain + ' قلم' : ' — کامل ✅') + '</div>';
      }
    } catch (eCov) {}
    var postActions = '';
    if (r.wonOffer && r.inqNo && typeof ptfRealBuyOpen === 'function') {
      postActions += postAction(
        'real-buy', '🛍', 'خرید واقعی', 'ثبت یا پیگیری خرید واقعی اقلام این پرونده',
        'event.stopPropagation();ptfRealBuyOpen(\'' + ptfOnClickArg(r.inqNo) + '\')',
        { primary: true, meta: 'اقلام پروژه' }
      );
    }
    /* v14.8: ثبت/اصلاح تاریخ تحویل تعهدی ساختاریافته */
    postActions += postAction(
      'due', '🚚', 'تحویل تعهدی',
      r.dueISO ? 'اصلاح تاریخ تحویل تعهدی ' + r.dueISO : 'ثبت تاریخ تحویل تعهدی',
      'sfSetDue(\'' + ptfOnClickArg(r.cd) + '\')',
      { meta: r.dueISO ? escP(r.dueISO) : 'ثبت تاریخ' }
    );
    if (r.wonOffer) {
      postActions += postAction(
        'qc', '🔬', 'کنترل کیفیت', 'ثبت یا مشاهده نتیجهٔ QC / بازرسی',
        'sfQcOpen(\'' + ptfOnClickArg(r.cd) + '\')', { meta: 'QC / بازرسی' }
      );
      postActions += postAction(
        'inspection-note', '📄', 'نوت بازرسی', 'صدور یا مشاهده نوت بازرسی رسمی',
        'ptfDocxOpen(\'' + ptfOnClickArg(r.cd) + '\',\'IN\')', { meta: 'سند رسمی' }
      );
      postActions += postAction(
        'packing-list', '🧰', 'پکینگ‌لیست', 'صدور یا مشاهده پکینگ‌لیست رسمی',
        'ptfDocxOpen(\'' + ptfOnClickArg(r.cd) + '\',\'PL\')', { meta: 'سند رسمی' }
      );
      postActions += postAction(
        'shipment', '🚚', 'بارنامه / ارسال', 'ثبت بارنامه یا رویداد ارسال',
        'sfShipOpen(\'' + ptfOnClickArg(r.cd) + '\',\'shipdoc\')', { meta: 'ارسال کالا' }
      );
      postActions += postAction(
        'delivery', '🤝', 'تحویل کارفرما', 'ثبت تحویل موفق به کارفرما',
        'sfShipOpen(\'' + ptfOnClickArg(r.cd) + '\',\'delivered\')', { meta: 'تحویل نهایی' }
      );
    }
    /* v19.3: ارجاع فاکتور — فقط از پرونده؛ قفل تا تحویل کارفرما (مرحله ۷) */
    postActions += (function () {
      if (!r.wonOffer) return '';
      var _wo = getData('ptf_crm_offers').filter(function (x) { return x.no === r.wonOffer; })[0];
      var _hasInvD = r.inqNo ? sfHasInvoice(r) : false;
      if (_hasInvD) return '';
      if (_wo && _wo.invRef) return '<span class="bd sf-post-award-status sf-post-award-invoice-status" title="' + escP('ارجاع‌شده توسط ' + (_wo.invRef.by || '') + ' — ' + (_wo.invRef.t || '')) + '">🧾 ارجاع شد — در حال صدور فاکتور</span>';
      var _stg7 = (typeof sfStageOf === 'function') ? sfStageOf(r) : 0;
      return _stg7 >= 7
        ? postAction('invoice-ref', '🧾', 'ارجاع فاکتور', 'ارجاع فاکتور رسمی به حسابدار', 'sfInvoiceRef(\'' + ptfOnClickArg(r.cd) + '\')', { primary: true, meta: 'برای حسابدار' })
        : postAction('invoice-ref', '🔒', 'ارجاع فاکتور', 'ارجاع فاکتور تا ثبت تحویل کارفرما قفل است', 'sfInvoiceRef(\'' + ptfOnClickArg(r.cd) + '\')', { locked: true, meta: 'پس از تحویل' });
    })();
    /* v34.2.0: عملیات نسخهٔ ریالی فقط برای پیشنهاد ارزی برنده ظاهر می‌شود. */
    postActions += '<span class="sf-post-award-rial">' + ((typeof window.ptfOfferRialToolbarHtml === 'function') ? window.ptfOfferRialToolbarHtml(r) : '') + '</span>';
    postActions += postAction(
      'loss', '💥', 'ثبت زیان', 'ثبت زیان پروژه',
      'ptfLossOpen(\'deal\',\'' + ptfOnClickArg(r.cd) + '\')', { meta: 'زیان پروژه' }
    );
    postActions += postAction(
      'close', hasInv ? '🏁' : '🚫', 'مختومه‌سازی',
      hasInv ? 'مختومه‌سازی پرونده پس از تحویل و تسویه کامل' : 'مختومه‌سازی پروندهٔ بدون فاکتور با دلیل استاندارد',
      'sfClose(\'' + ptfOnClickArg(r.cd) + '\')',
      { wide: true, meta: hasInv ? 'پایان پروژه و تسویه' : 'بدون فاکتور / سایر' }
    );
    h += '<section class="sf-post-award-shell" onclick="event.stopPropagation()">' +
      '<div class="sf-post-award-heading"><span class="sf-post-award-heading-icon" aria-hidden="true">' + (r.wonOffer ? '🧰' : '📁') + '</span><span><b>' + (r.wonOffer ? 'عملیات پرونده' : 'عملیات پرونده') + '</b><small>' + (r.wonOffer ? 'پس از ابلاغ سفارش؛ همه عملیات از همین پرونده انجام می‌شود' : 'عملیات ثبت و پیگیری پرونده') + '</small></span></div>' +
      '<div class="sf-post-award-actions" role="group" aria-label="عملیات پرونده ' + escP(r.inqNo || r.cd || '') + '">' + postActions + '</div>' +
      '<div class="sf-post-award-extras"><div class="sf-post-award-upload"><div class="sf-post-award-upload-label"><span aria-hidden="true">📎</span><span>افزودن سند یا ضمیمهٔ پرونده</span></div><span id="sfUp_' + escP(r.cd) + '"></span></div></div>' +
      '</section></div>';
    setTimeout(function () {
      var w = document.getElementById('sfUp_' + r.cd);
      if (w && typeof attachUploadWidget === 'function' && !w.getAttribute('data-up')) {
        w.setAttribute('data-up', '1');
        attachUploadWidget('sfUp_' + r.cd, 'salesfiles', function (f) { sfAddMisc(r.cd, f); });
      }
    }, 60);
    return h;
  }

  /* ===== v14.8: تاریخ تحویل تعهدی ساختاریافته روی پرونده فروش ===== */
  window.sfSetDue = function (cd) {
    var r = sfAll().filter(function (x) { return x.cd === cd; })[0];
    if (!r) return;
    /* v18.5 BUG-027: ریشه باگ حذف تاریخ — هندلر قبلی ابتدا modal را remove می‌کرد و بعد
       document.getElementById('sfDueInp') را می‌خواند؛ بعد از remove مقدار null می‌شد و
       sfSetDueCommit با رشته خالی اجرا می‌گردید، بنابراین پیام «حذف تعهد» می‌آمد.
       راه‌حل ریشه‌ای: خواندن مقدار و بستن مودال در تابع مجزا؛ حذف هم مسیر جدا دارد. */
    var html = '<div class="md-b" id="sfDueDlg" style="display:grid;z-index:2400" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:440px">' +
      '<h3>🚚 تاریخ تحویل تعهدی — ' + escP(r.inqNo || cd) + '</h3>' +
      '<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:8px 12px;font-size:12px;color:#0c4a6e;margin-bottom:10px">تاریخی که به کارفرما «تعهد» داده‌اید. ۳ روز قبل یادآور خودکار می‌آید و از روز سررسید، پرونده قرمز و هشدار تاخیر صادر می‌شود.</div>' +
      '<div class="fld"><label>تاریخ تحویل تعهدی (شمسی) *</label>' + (typeof ptfDateInput==="function" ? ptfDateInput("sfDueJ", r.dueISO || "") : '<input type="text" id="sfDueJ" value="' + escP(r.dueISO || '') + '" style="direction:ltr;color:#0e7490">') + '</div>' +
      '<div class="fld"><label>یادداشت تعهد (اختیاری)</label><input type="text" id="sfDueNote" value="' + escP(r.dueNote || '') + '" placeholder="مثلا: طبق بند ۴ قرارداد / توافق تلفنی"></div>' +
      '<div style="display:flex;gap:8px;justify-content:space-between;margin-top:6px">' +
      (r.dueISO ? '<button class="bt bt-o" style="color:#dc2626;border-color:#fecaca" onclick="sfClearDue(\'' + ptfOnClickArg(cd) + '\')">🗑 حذف تعهد</button>' : '<span></span>') +
      '<span style="display:flex;gap:8px">' +
      '<button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">انصراف</button>' +
      '<button class="bt" onclick="sfDueSave(\'' + ptfOnClickArg(cd) + '\')">💾 ذخیره</button>' +
      '</span></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };

  window.sfDueSave = function (cd) {
    var iso = (typeof ptfJToISO === 'function') ? ptfJToISO(((document.getElementById('sfDueJ') || {}).value || '').trim()) : (((document.getElementById('sfDueInp') || {}).value || '').trim());
    var note = ((document.getElementById('sfDueNote') || {}).value || '').trim();
    if (!iso) { alert('⛔ تاریخ تحویل تعهدی را انتخاب کنید. برای حذف تعهد از دکمه «حذف تعهد» استفاده کنید.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) { alert('⛔ فرمت تاریخ نامعتبر است. تاریخ را شمسی مثل 1405/04/19 وارد کنید.'); return; }
    sfSetDueCommit(cd, iso, note, false);
    var dlg = document.getElementById('sfDueDlg');
    if (dlg) dlg.remove();
  };

  window.sfClearDue = function (cd) {
    if (!confirm('تاریخ تحویل تعهدی این پرونده حذف شود؟')) return;
    sfSetDueCommit(cd, '', '', true);
    var dlg = document.getElementById('sfDueDlg');
    if (dlg) dlg.remove();
  };

  window.sfSetDueCommit = function (cd, iso, note, explicitClear) {
    var list = sfAll();
    var r = list.filter(function (x) { return x.cd === cd; })[0];
    if (!r) return;
    iso = (iso || '').trim();
    note = (note || '').trim();
    if (!iso && !explicitClear && arguments.length >= 4) { alert('⛔ تاریخ خالی است؛ حذف تعهد فقط از مسیر دکمه حذف مجاز است.'); return; } /* سازگاری عقب‌رو: sfSetDueCommit(cd,'','') همچنان حذف برنامه‌ای است؛ UI ذخیره خالی با false می‌آید و بلاک می‌شود */
    var old = r.dueISO || '';
    r.dueISO = iso;
    r.dueNote = iso ? note : '';
    if (r.dueISO !== old) r.dueNotified = ''; /* ریست ضدتکرار یادآور با تغییر تاریخ */
    sfSave(list);
    try { audit('پرونده‌های فروش', r.dueISO ? 'ثبت/اصلاح تاریخ تحویل تعهدی ' + (r.inqNo || cd) + ' → ' + r.dueISO : 'حذف تاریخ تحویل تعهدی ' + (r.inqNo || cd), cd); } catch (e) {}
    if (typeof renderDeals === 'function') renderDeals();
    if (typeof ptfToast === 'function') ptfToast(r.dueISO ? 'تاریخ تحویل تعهدی ثبت شد 🚚' : 'تعهد تحویل حذف شد', 'ok');
  };

  window.sfAddMisc = function (cd, f) {
    var list = sfAll();
    var r = list.filter(function (x) { return x.cd === cd; })[0];
    if (!r) return;
    r.docs = r.docs || [];
    r.docs.push({ name: f.name, key: f.key || null, size: f.size || 0, t: faDate(), by: curSession().name });
    sfSave(list);
    try { audit('پرونده‌های فروش', 'افزودن سند به پرونده ' + (r.inqNo || cd) + ': ' + f.name, cd); } catch (e) {}
    renderDeals();
  };

  window.sfDelMisc = function (cd, mi) {
    if (!confirm('این سند از پرونده حذف شود؟')) return;
    var list = sfAll();
    var r = list.filter(function (x) { return x.cd === cd; })[0];
    if (!r || !r.docs || !r.docs[mi]) return;
    var doc = r.docs.splice(mi, 1)[0];
    sfSave(list);
    if (doc.key) sfDeleteCloud([doc.key]);
    renderDeals();
  };

  function sfDeleteCloud(keys) {
    keys = (keys || []).filter(Boolean);
    if (!keys.length) return;
    try {
      fetch((typeof STORAGE_API !== 'undefined' ? STORAGE_API : '../api/storage.php') + '?action=delete_batch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: keys })
      }).catch(function () {});
    } catch (e) {}
  }

  /* ---------- مختومه‌سازی ---------- */
  /* ===== v19.4: کنترل پیش از مختومه — تحویل موفق + تسویه کامل + کنترل اسناد =====
     هسته قابل تست: sfCloseAudit(r) → { blockers[], warns[], docs{} }
     - blocker «تحویل»: مرحله < ۷ (بدون ثبت تحویل کارفرما) → مختومه با فاکتور ممنوع (AC1).
     - مطالبات باز blocker نرم است: قابل رفع در همان مودال با تسویه خودکار (رفتار US-324 حفظ شد).
     - بدهی باز تامین‌کننده و QC عدم انطباق بدون رفع = هشدار (مانع نیست ولی ثبت و audit می‌شود).
     - کنترل اسناد (AC2): شمارش سند برد/فاکتور/ارسال/QC/متفرقه پیش از بایگانی نمایش داده می‌شود. */
  window.sfCloseAudit = function (r) {
    var out = { blockers: [], warns: [], docs: {}, openInvs: [], remainSum: 0, stage: 0 };
    if (!r) return out;
    var d = sfDocsOf(r.inqNo ? r : { inqNo: '', docs: r.docs || [] });
    out.stage = (typeof sfStageOf === 'function') ? sfStageOf(r) : 0;
    /* ① تحویل موفق (AC1) — عمدا مستقل از مرحله: فاکتور تسویه‌شده مرحله را به ۱۱ می‌برد،
       اما «مدرک تحویل» (رویداد تحویل کارفرما یا وضعیت st7 درخواست) جدا الزامی است تا
       پرونده بدون تحویل واقعی با پرداخت نقدی دور زده نشود (US-437 AC1). */
    var hasDelivery = (r.shipEvents || []).some(function (ev) { return ev.type === 'delivered'; });
    if (!hasDelivery) {
      try {
        var rfqD = getData('ptf_crm_rfqs').filter(function (x) { return x.cd === r.inqNo || x.inqNo === r.inqNo; })[0];
        if (rfqD && rfqD.st === 'st7') hasDelivery = true;
      } catch (eD) {}
    }
    /* UR-12 (ساده‌سازی مختومه): تحویل به‌صورت پیش‌فرض blocker است اما با تأیید صریح
       ثبت‌کننده (closeOverride.deliveryConfirmed + دلیل) قابل عبور است — تا مختومه‌کردن پرونده‌های
       واقعاً تحویل‌شده بدون ثبت رویداد، بی‌دردسر شود؛ مسئولیت در audit ثبت می‌شود. */
    if (!hasDelivery) {
      var ovr = r.closeOverride || {};
      if (ovr.deliveryConfirmed) out.warns.push({ id: 'delivery-override', lb: '🤝 تحویل با تأیید صریح ' + (ovr.by || '') + (ovr.reason ? ' — ' + ovr.reason : '') });
      else out.blockers.push({ id: 'delivery', lb: '🤝 تحویل به کارفرما ثبت نشده است — یا از دکمه «تحویل کارفرما» ثبت کنید یا در این مودال «تحویل انجام شده است» را با ذکر دلیل تأیید کنید' });
    }
    /* ② تسویه کامل (AC1) — blocker نرم: در مودال قابل رفع با تسویه خودکار */
    out.openInvs = d.invoices.filter(function (i) {
      var paid = ((i.payments || []).concat(i.pays || [])).reduce(function (s2, pp) { return s2 + (+pp.amt || 0); }, 0);
      return i.amount - paid > 0.5;
    });
    out.remainSum = out.openInvs.reduce(function (s2, i) { return s2 + (i.amount - ((i.payments || []).concat(i.pays || [])).reduce(function (s3, pp) { return s3 + (+pp.amt || 0); }, 0)); }, 0);
    if (out.openInvs.length) out.warns.push({ id: 'recv', lb: '💰 ' + out.openInvs.length + ' فاکتور با مانده وصول‌نشده ' + out.remainSum.toLocaleString('fa-IR') + ' ریال — در گام بعد انتخاب می‌کنید: تسویه‌شده ثبت شود یا باز بماند' });
    /* ③ پوشش خرید واقعی پرونده */
    try {
      if (typeof ptfRealBuyStatus === 'function' && r.inqNo) {
        var rb = ptfRealBuyStatus(r.inqNo);
        if (rb.total && rb.full < rb.total) out.warns.push({ id: 'realbuy', lb: '🛒 خرید واقعی برای ' + rb.full + ' از ' + rb.total + ' قلم کامل است' + (rb.partial ? ' و ' + rb.partial + ' قلم ناقص است' : '') + ' — سود پرونده ممکن است ناقص/بیش‌برآورد باشد.' });
        else if (!rb.has) out.warns.push({ id: 'realbuy-none', lb: '🛒 هنوز هیچ خرید واقعی برای این پرونده ثبت نشده است — سود واقعی قابل اتکا نیست.' });
      }
    } catch (eRB) {}
    /* ④ (UR-12): بدهی باز تامین‌کنندگان پرونده — طبق تصمیم کارفرما «بستن پرونده فروش لزوماً به معنای
       بستن حساب تامین‌کنندگان آن درخواست نیست» → حساب تامین‌کننده از مختومهٔ پرونده مستقل است و
       هیچ اثری در کنترل مختومه ندارد (نه blocker و نه هشدار). پیگیری بدهی در پنل تامین‌کنندگان انجام می‌شود. */
    /* ⑤ QC عدم انطباق بدون رویداد زیان/رفع بعدی */
    try {
      var ncs = (r.qcEvents || []).filter(function (q) { return q.conf === 'nonconform'; });
      if (ncs.length && !(r.lossEvents || []).length) out.warns.push({ id: 'qc', lb: '⛔ ' + ncs.length + ' رکورد «عدم انطباق» QC بدون ثبت زیان/رفع — پیش از بایگانی بررسی شود (کیس R9)' });
    } catch (eQ) {}
    /* ⑤ کنترل اسناد (AC2) */
    out.docs = { award: (r.awardDocs || []).length, offers: d.offers.length, invoices: d.invoices.length, ship: (r.shipEvents || []).length, qc: (r.qcEvents || []).length, costs: (r.costEvents || []).length, misc: (r.docs || []).length, letters: d.letters.length, supply: (d.supply || []).length };
    /* v33.7.0 (مصوب کارفرما): چک‌های ضمانت (پیش‌پرداخت/حسن انجام/مناقصه) اثر مالی ندارند،
       در پرونده فروش می‌نشینند و باید با پایان پروژه مسترد شوند → ضمانت باز = blocker،
       با تأیید صریح (closeOverride.guaranteeConfirmed) قابل عبور (الگوی UR-12 تحویل). */
    try {
      var guarChqs = (typeof window.ptfChequeIssued === 'function' ? window.ptfChequeIssued() : [])
        .filter(function (c) { return c && c.kind === 'guarantee' && c.dealCd === r.cd && c.st === 'open'; });
      if (guarChqs.length) {
        out.guarCheques = guarChqs;
        var ovrG = r.closeOverride || {};
        if (ovrG.guaranteeConfirmed) out.warns.push({ id: 'guarantee-override', lb: '🛡 ' + guarChqs.length + ' چک ضمانت باز با تأیید صریح ' + (ovrG.by || '') + (ovrG.reason ? ' — ' + ovrG.reason : '') + ' — پیگیری استرداد پس از مختومه بر عهدهٔ ثبت‌کننده است' });
        else out.blockers.push({ id: 'guarantee', lb: '🛡 ' + guarChqs.length + ' چک ضمانت باز برای این پرونده ثبت شده (' + guarChqs.map(function (g) { return g.sayad || g.no || ''; }).join('، ') + ') — ضمانت با پایان پروژه باید مسترد شود: یا از تب چک‌ها «🏆 استرداد ضمانت» بزنید یا در این مودال «استرداد پس از مختومه» را تأیید کنید' });
      }
    } catch (eG) {}
    if (!out.docs.award && r.wonOffer) out.warns.push({ id: 'award', lb: '🏆 سند قطعی برد ثبت نشده — یک بار کشوی پرونده را باز کنید تا مهاجرت نرم انجام شود' });
    try {
      if (r.wonOffer && typeof ptfDocxCoverage === 'function') {
        var covPL = ptfDocxCoverage(r, 'PL');
        var covIN = ptfDocxCoverage(r, 'IN');
        if (covPL.total && covPL.used > 0 && covPL.remain > 0) out.warns.push({ id: 'pl-partial', lb: '🧰 پکینگ لیست رسمی فقط برای ' + covPL.used + ' از ' + covPL.total + ' قلم صادر شده — ' + covPL.remain + ' قلم هنوز بدون پکینگ رسمی‌اند.' });
        if (covIN.total && covIN.used > 0 && covIN.remain > 0) out.warns.push({ id: 'in-partial', lb: '🔬 نوت بازرسی رسمی فقط برای ' + covIN.used + ' از ' + covIN.total + ' قلم صادر شده — ' + covIN.remain + ' قلم هنوز بدون نوت رسمی‌اند.' });
        if ((r.shipEvents || []).some(function (x) { return x.type === 'packing'; }) && covPL.total && covPL.used === 0) out.warns.push({ id: 'pl-missing', lb: '🧰 رویداد/وضعیت پکینگ ثبت شده ولی هنوز پکینگ لیست رسمی صادر نشده است.' });
        if ((r.qcEvents || []).length && covIN.total && covIN.used === 0) out.warns.push({ id: 'in-missing', lb: '🔬 QC/بازرسی ثبت شده ولی هنوز نوت بازرسی رسمی صادر نشده است.' });
      }
    } catch (eC) {}
    return out;
  };
  /* هسته اجرای مختومه با فاکتور — پس از عبور از کنترل (قابل تست) */
  window.sfCloseSettledCommit = function (cd, settleOpen, settleReason) {
    var list = sfAll();
    var r = list.filter(function (x) { return x.cd === cd; })[0];
    if (!r) return false;
    var au = sfCloseAudit(r);
    if (au.blockers.length) return false; /* سد برنامه‌ای — نه فقط UI (درس US-371) */
    if (au.openInvs.length && settleOpen) {
      var invsAll = getData('ptf_crm_invoices');
      var autoSettleReceipts = []; // v31.7.4 BUG-AUDIT-008: Track auto-settle receipts for reversal
      au.openInvs.forEach(function (i) {
        var iv = invsAll.filter(function (x) { return x.cd === i.cd; })[0];
        if (!iv) return;
        var paid = ((iv.payments || []).concat(iv.pays || [])).reduce(function (s2, pp) { return s2 + (+pp.amt || 0); }, 0);
        var receiptCd = genCode('RPAY');
        iv.payments = iv.payments || [];
        iv.payments.push({ 
          cd: receiptCd, 
          t: faDate(), 
          amt: iv.amount - paid, 
          how: 'تسویه هنگام مختومه شدن پرونده', 
          by: curSession().name, 
          status: 'posted', 
          autoSettle: true, 
          autoSettleProjectCd: cd, // v31.7.4: Link to project for reversal
          settleReason: settleReason || 'تسویه خودکار هنگام مختومه‌سازی' 
        });
        autoSettleReceipts.push({ invoiceCd: i.cd, receiptCd: receiptCd, amount: iv.amount - paid });
      });
      setData('ptf_crm_invoices', invsAll);
      // v31.7.4 BUG-AUDIT-008: Store auto-settle info in project for reversal
      r.autoSettleReceipts = autoSettleReceipts;
      r.autoSettleDate = faDateTime();
      r.autoSettleBy = curSession().name;
      /* AUD-07 (ممیزی ۱۴۰۵/۰۵/۰۷ — crm/AUDIT-FINANCIAL-SYSTEM-2026-07-29.md):
         کلید ذخیره‌سازی این ماژول همه‌جا 'ptf_crm_deals' است (var K، در ابتدای
         فایل)؛ اینجا به‌اشتباه به یک کلید دیگر ('ptf_crm_salesfiles') که هیچ‌جای
         دیگر این پروژه خوانده نمی‌شود نوشته می‌شد. اصلاح شد تا با sfSave/sfAll
         هم‌راستا باشد. */
      setData('ptf_crm_deals', list);
      try { audit('مطالبات', 'تسویه خودکار ' + au.openInvs.length + ' فاکتور هنگام مختومه شدن پرونده ' + (r.inqNo || cd) + ' — قابل برگشت', r.cd); } catch (e) {}
    }
    try { audit('پرونده‌های فروش', 'کنترل پیش از مختومه US-437 عبور کرد (' + au.warns.map(function (w) { return w.id; }).join('،') + (au.warns.length ? ' — با هشدار' : ' — بدون هشدار') + ') — ' + (r.inqNo || cd), cd); } catch (e2) {}
    sfArchive(r, 'settled', true);
    return true;
  };
  
  // v31.7.4 BUG-AUDIT-008: Reversal function for auto-settle receipts
  window.sfReverseAutoSettle = function (projectCd, reason) {
    /* AUD-07 (ممیزی ۱۴۰۵/۰۵/۰۷ — crm/AUDIT-FINANCIAL-SYSTEM-2026-07-29.md):
       تسویه‌ی خودکار همیشه بلافاصله پیش از بایگانی‌شدن پرونده اتفاق می‌افتد
       (sfCloseSettledCommit -> sfArchive در همان تابع)؛ یعنی وقتی کاربر
       متوجه اشتباه می‌شود، پرونده دیگر در ptf_crm_deals نیست، بلکه به‌صورت
       رکورد بایگانی‌شده در ptf_crm_projects است. قبلاً این تابع فقط
       ptf_crm_deals را می‌گشت و همیشه با «این پرونده تسویه خودکار ندارد»
       مواجه می‌شد (قابلیت برگشت هرگز در عمل در دسترس نبود). */
    var list = sfAll();
    var r = list.filter(function (x) { return x.cd === projectCd; })[0];
    var inArchive = false, archiveList = null;
    if (!r) {
      archiveList = getData('ptf_crm_projects');
      r = archiveList.filter(function (x) { return x.dealCd === projectCd || x.cd === projectCd; })[0];
      inArchive = !!r;
    }
    if (!r || !r.autoSettleReceipts || !r.autoSettleReceipts.length) {
      alert('ℹ️ این پرونده تسویه خودکار ندارد یا قبلاً برگشت داده شده');
      return false;
    }
    if (!reason || !reason.trim()) {
      alert('⛔ دلیل برگشت الزامی است');
      return false;
    }
    
    var invsAll = getData('ptf_crm_invoices');
    var reversedCount = 0;
    var totalAmount = 0;
    
    r.autoSettleReceipts.forEach(function (receipt) {
      var iv = invsAll.filter(function (x) { return x.cd === receipt.invoiceCd; })[0];
      if (!iv || !iv.payments) return;
      
      // Find and mark the auto-settle receipt as reversed
      var found = false;
      iv.payments.forEach(function (p) {
        if (p.cd === receipt.receiptCd && p.autoSettle) {
          p.status = 'reversal';
          p.reversedAt = faDateTime();
          p.reversedBy = curSession().name;
          p.reversalReason = reason;
          found = true;
        }
      });
      /* AUD-07 (ممیزی ۱۴۰۵/۰۵/۰۷ — crm/AUDIT-FINANCIAL-SYSTEM-2026-07-29.md):
         در مسیر found=true، فقط status رکورد اصلی به 'reversal' تغییر
         می‌کرد اما p.amt دست‌نخورده می‌ماند و هیچ رکورد جبرانی منفی اضافه
         نمی‌شد. چون تمام محاسبات مانده در کل سیستم (savePay، renderReceivables،
         fiscal.js، working-capital.js، customer-finance.js، commission.js)
         بدون فیلتر p.status جمع می‌زنند، این «برگشت» هیچ اثری روی مانده‌ی
         واقعی فاکتور نداشت. راه‌حل: دقیقاً مثل مسیر !found (که از قبل درست
         بود) و مثل الگوی rbac.js#ptfInvoicePayVoid، همیشه یک رکورد پرداخت
         جدید با مبلغ منفی اضافه می‌شود؛ رکورد اصلی فقط برای شفافیت نمایشی
         علامت‌گذاری می‌ماند. */
      iv.payments.push({
        cd: genCode('RPAY'),
        t: faDate(),
        amt: -receipt.amount,
        how: 'برگشت تسویه خودکار',
        by: curSession().name,
        status: 'reversal',
        autoSettleReversal: true,
        originalReceiptCd: receipt.receiptCd,
        originalReceiptFound: found,
        reversalReason: reason
      });
      reversedCount++;
      totalAmount += receipt.amount;
    });
    
    setData('ptf_crm_invoices', invsAll);
    
    // Clear auto-settle info from project
    r.autoSettleReceipts = [];
    r.autoSettleReversedAt = faDateTime();
    r.autoSettleReversedBy = curSession().name;
    r.autoSettleReversalReason = reason;
    /* AUD-07: رکورد باید در همان کلیدی ذخیره شود که از آن خوانده شده —
       اگر پرونده هنوز باز است در ptf_crm_deals، اگر بایگانی شده در
       ptf_crm_projects. نوشتن روی کلید اشتباه (که پیش‌تر 'ptf_crm_salesfiles'
       بود) باعث می‌شد این علامت‌گذاری هرگز پایدار نماند. */
    if (inArchive) setData('ptf_crm_projects', archiveList);
    else setData('ptf_crm_deals', list);
    
    try { 
      audit('مطالبات', 'برگشت ' + reversedCount + ' تسویه خودکار به مبلغ ' + totalAmount.toLocaleString('fa-IR') + ' ریال — دلیل: ' + reason, projectCd); 
    } catch (e) {}
    
    if (typeof ptfToast === 'function') {
      ptfToast('✅ ' + reversedCount + ' تسویه خودکار برگشت داده شد', 'ok');
    }
    
    return { count: reversedCount, amount: totalAmount };
  };
  window.sfClose = function (cd) {
    var list = sfAll();
    var r = list.filter(function (x) { return x.cd === cd; })[0];
    if (!r) return;
    /* v21.1 BUG-035 */
    var already = sfFindArchivedProject(r);
    if (already) {
      alert('ℹ️ این پرونده قبلاً بایگانی شده است\n(' + (already.no || '') + ')');
      try { renderDeals(); } catch (e) {}
      return;
    }
    var hasInv = r.inqNo ? sfHasInvoice(r) : false;

    if (hasInv) {
      /* مسیر ۲ (v19.4 — US-437): مودال کنترل پیش از مختومه به جای confirm ساده */
      sfCloseModal(cd);
      return;
    }

    /* مسیر ۱: بدون فاکتور — v14.8: دلیل باخت استاندارد به جای متن آزاد (AC4: محفوظ) */
    sfLostModal(cd);
  };
  /* v19.4: مودال کنترل نهایی — چک‌لیست تحویل/تسویه/اسناد */
  function sfCloseModal(cd) {
    var r = sfAll().filter(function (x) { return x.cd === cd; })[0];
    if (!r) return;
    if (typeof sfAwardEnsure === 'function') sfAwardEnsure(r); /* مهاجرت نرم سند برد قبل از کنترل */
    var au = sfCloseAudit(r);
    var dl = au.docs;
    var docsHtml = '<div style="display:flex;gap:6px;flex-wrap:wrap;font-size:11px;margin-top:6px">' +
      [['🏆 سند برد', dl.award], ['📄 پیشنهاد', dl.offers], ['🧾 فاکتور', dl.invoices], ['🚚 ارسال', dl.ship], ['🔬 QC', dl.qc], ['➕ هزینه', dl.costs], ['📎 متفرقه', dl.misc], ['✉️ نامه', dl.letters], ['🤖 استعلام', dl.supply]].map(function (x) {
        return '<span style="background:' + (x[1] ? '#ecfdf5;color:#065f46' : '#f1f5f9;color:#94a3b8') + ';border-radius:8px;padding:3px 8px">' + x[0] + ': ' + x[1] + '</span>';
      }).join('') + '</div>';
    var blocksHtml = au.blockers.map(function (b) { return '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:7px 11px;font-size:12px;color:#b91c1c;margin-bottom:6px">⛔ ' + b.lb + '</div>'; }).join('');
    var warnsHtml = au.warns.map(function (w) { return '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:7px 11px;font-size:12px;color:#92400e;margin-bottom:6px">' + w.lb + '</div>'; }).join('');
    var canClose = !au.blockers.length;
    /* UR-12: اگر تنها blocker «تحویل» است، مسیر تأیید صریح نمایش داده می‌شود */
    var deliveryOvr = '';
    if (au.blockers.some(function (b) { return b.id === 'delivery'; })) {
      deliveryOvr = '<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:8px 11px;margin-bottom:8px"><label style="display:flex;gap:7px;align-items:center;font-size:12.5px;cursor:pointer"><input type="checkbox" id="sfClsDeliv" onchange="sfClsCheckGo()"> تحویل به کارفرما انجام شده است (با مسئولیت ثبت‌کننده)</label><input id="sfClsDelivReason" type="text" placeholder="دلیل/توضیح (اختیاری)" style="width:100%;margin-top:6px;padding:6px;border:1px solid var(--brd);border-radius:8px;font-size:12px"></div>';
    }
    /* v33.7.0: چک ضمانت باز — مسیر تأیید صریح «استرداد پس از مختومه» */
    var guarOvr = '';
    if (au.blockers.some(function (b) { return b.id === 'guarantee'; }) && (au.guarCheques || []).length) {
      guarOvr = '<div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;padding:8px 11px;margin-bottom:8px">' +
        '<div style="font-size:12px;color:#5b21b6;margin-bottom:5px">🛡 ' + au.guarCheques.map(function (g) { return '<b dir="ltr">' + escP(g.sayad || g.no || '') + '</b> — ' + (+g.amt || 0).toLocaleString('fa-IR') + ' ریال (' + ({ advance: 'پیش‌پرداخت', performance: 'حسن انجام', bid: 'مناقصه', other: 'سایر' }[g.guarType] || 'ضمانت') + ')' + (g.st === 'retrieved' ? ' ✅ مسترد' : ' 🔴 باز'); }).join('<br>') + '</div>' +
        '<label style="display:flex;gap:7px;align-items:center;font-size:12.5px;cursor:pointer"><input type="checkbox" id="sfClsGuar" onchange="sfClsCheckGo()"> استرداد ضمانت پس از مختومه پیگیری می‌شود (با مسئولیت ثبت‌کننده)</label>' +
        '<input id="sfClsGuarReason" type="text" placeholder="دلیل/توضیح (اختیاری)" style="width:100%;margin-top:6px;padding:6px;border:1px solid var(--brd);border-radius:8px;font-size:12px"></div>';
    }
    window.sfClsCheckGo = function () {
      var go = document.getElementById('sfClsGoBtn'); if (!go) return;
      var delivOk = !document.getElementById('sfClsDeliv') || document.getElementById('sfClsDeliv').checked;
      var guarOk = !document.getElementById('sfClsGuar') || document.getElementById('sfClsGuar').checked;
      go.disabled = !(delivOk && guarOk);
    };
    var settleChk = au.openInvs.length
      ? '<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:8px 11px;margin-bottom:8px"><label style="display:flex;gap:7px;align-items:center;font-size:12.5px;cursor:pointer"><input type="checkbox" id="sfClsSettle" checked> مانده ' + au.remainSum.toLocaleString('fa-IR') + ' ریال مطالبات «تسویه‌شده» ثبت شود — بدون تیک: مطالبات باز می‌ماند</label><textarea id="sfClsSettleReason" rows="2" style="width:100%;margin-top:7px" placeholder="دلیل تسویه خودکار را وارد کنید — اجباری"></textarea></div>'
      : '';
    var html = '<div class="md-b" id="sfClsDlg" style="display:grid;z-index:2400" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:520px">' +
      '<h3>🏁 کنترل پیش از مختومه — ' + escP(r.inqNo || cd) + '</h3>' +
      '<div style="font-size:12px;color:#475569;margin-bottom:8px">US-437: مختومه فقط پس از <b>تحویل موفق</b> و <b>تسویه کامل</b> — همه اسناد پیش از بایگانی کنترل می‌شوند و کل پرونده (سند برد، QC، ارسال، هزینه‌ها، زیان‌ها) به بایگانی منتقل می‌شود.</div>' +
      '<div style="background:#f8fafc;border:1px solid var(--brd);border-radius:12px;padding:9px 12px;font-size:12.5px;margin-bottom:8px"><b>🧭 مرحله فعلی: ' + escP(typeof sfStageLabel === 'function' ? sfStageLabel(r) : '') + '</b> (' + au.stage + '/12)' + docsHtml + '</div>' +
      blocksHtml + warnsHtml + deliveryOvr + guarOvr + settleChk +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px">' +
      '<button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">انصراف</button>' +
      (canClose
        ? '<button class="bt" id="sfClsGoBtn" style="background:#b45309" onclick="sfCloseGo(\'' + ptfOnClickArg(cd) + '\')">🏁 مختومه و انتقال به بایگانی</button>'
        : (function () {
            var onlyOverride = au.blockers.every(function (b) { return b.id === 'delivery' || b.id === 'guarantee'; });
            return onlyOverride
              ? '<button class="bt" id="sfClsGoBtn" disabled style="background:#b45309" onclick="sfCloseGo(\'' + ptfOnClickArg(cd) + '\')">🏁 مختومه (پس از تأیید موارد بالا)</button>'
              : '<button class="bt" style="background:#94a3b8;cursor:not-allowed" onclick="alert(\'⛔ ابتدا موارد قرمز را رفع کنید — مختومه بدون تحویل موفق ممکن نیست\')">🔒 مختومه قفل است</button>';
          })()) +
      '</div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  }
  window.sfCloseGo = function (cd) {
    var settle = !!((document.getElementById('sfClsSettle') || {}).checked);
    var settleReason = ((document.getElementById('sfClsSettleReason') || {}).value || '').trim();
    if (settle && !settleReason) { alert('⛔ برای تسویه خودکار، دلیل الزامی است.'); return; }
    var r = sfAll().filter(function (x) { return x.cd === cd; })[0];
    if (!r) return;
    /* UR-12: تأیید صریح تحویل (در صورت وجود) روی رکورد ذخیره می‌شود تا audit بعدی blocker نداشته باشد */
    var delivChk = document.getElementById('sfClsDeliv');
    if (delivChk && delivChk.checked) {
      var list = sfAll(); var rr = list.filter(function (x) { return x.cd === cd; })[0];
      if (rr) {
        rr.closeOverride = rr.closeOverride || {};
        rr.closeOverride.deliveryConfirmed = true;
        rr.closeOverride.reason = ((document.getElementById('sfClsDelivReason') || {}).value || '').trim();
        rr.closeOverride.by = curSession().name;
        rr.closeOverride.t = faDateTime();
        sfSave(list);
        r = rr;
      }
    }
    /* v33.7.0: تأیید صریح «استرداد ضمانت پس از مختومه» */
    var guarChk = document.getElementById('sfClsGuar');
    if (guarChk && guarChk.checked) {
      var listG = sfAll(); var rrG = listG.filter(function (x) { return x.cd === cd; })[0];
      if (rrG) {
        rrG.closeOverride = rrG.closeOverride || {};
        rrG.closeOverride.guaranteeConfirmed = true;
        rrG.closeOverride.guaranteeReason = ((document.getElementById('sfClsGuarReason') || {}).value || '').trim();
        rrG.closeOverride.by = curSession().name;
        rrG.closeOverride.t = faDateTime();
        sfSave(listG);
        r = rrG;
      }
    }
    var au = sfCloseAudit(r);
    if (au.openInvs.length && !settle) { alert('⛔ با مطالبات باز نمی‌توان مختومه کرد — یا تیک تسویه را بزنید یا ابتدا وصولی‌ها را ثبت کنید.'); return; }
    if (!confirm('🏁 تایید نهایی مختومه پرونده «' + (r.inqNo || cd) + '»:\n\nپایان پروژه و تسویه کامل — کل پرونده با تمام اسناد به «بایگانی» منتقل می‌شود.\n\nادامه می‌دهید؟')) return;
    var ok = sfCloseSettledCommit(cd, settle, settleReason);
    var dlg = document.getElementById('sfClsDlg');
    if (dlg) dlg.remove();
    if (!ok) alert('⛔ کنترل مختومه رد شد — موارد قرمز را رفع کنید.');
  };

  /* v14.8: مودال انتخاب دلیل استاندارد باخت + توضیح اختیاری */
  function sfLostModal(cd) {
    var opts = SF_LOST_REASONS.map(function (x) {
      return '<option value="' + x.id + '">' + x.lb + '</option>';
    }).join('');
    var html = '<div class="md-b" style="display:grid;z-index:2400" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:460px">' +
      '<h3>🚫 مختومه بدون فاکتور — دلیل باخت</h3>' +
      '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:8px 12px;font-size:12px;color:#92400e;margin-bottom:10px">دلیل استاندارد انتخاب کنید — این داده مبنای گزارش مدیریتی Win/Loss است.</div>' +
      '<div class="fld"><label>دلیل باخت *</label><select id="sfLostReason">' + opts + '</select></div>' +
      '<div class="fld"><label>توضیح تکمیلی (اختیاری)</label><textarea id="sfLostNote" rows="2" placeholder="مثلا: قیمت رقیب ۱۲٪ پایین‌تر بود"></textarea></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px">' +
      '<button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">انصراف</button>' +
      '<button class="bt" style="background:#b45309" onclick="this.closest(\'.md-b\').remove();sfCloseLost(\'' + ptfOnClickArg(cd) + '\',(document.getElementById(\'sfLostReason\')||{}).value,((document.getElementById(\'sfLostNote\')||{}).value||\'\'))">🚫 مختومه شود</button>' +
      '</div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  }

  /* v14.8: ادامه مختومه‌سازی باخت با دلیل استاندارد (قابل فراخوانی برنامه‌ای/تست) */

  /* v21.1 BUG-035: یافتن بایگانی قبلی برای همین پرونده (دو-شناسه‌ای inqNo/cd) */
  function sfArchiveAliases(r) {
    var out = [];
    if (!r) return out;
    if (r.inqNo) out.push(String(r.inqNo));
    if (r.cd && out.indexOf(String(r.cd)) < 0) out.push(String(r.cd));
    try {
      var rfqs = getData('ptf_crm_rfqs') || [];
      rfqs.forEach(function (q) {
        var hit = (r.inqNo && (q.inqNo === r.inqNo || q.cd === r.inqNo)) ||
                  (r.cd && (q.cd === r.cd || q.inqNo === r.cd));
        if (!hit) return;
        if (q.cd && out.indexOf(String(q.cd)) < 0) out.push(String(q.cd));
        if (q.inqNo && out.indexOf(String(q.inqNo)) < 0) out.push(String(q.inqNo));
      });
    } catch (e) {}
    return out;
  }
  function sfFindArchivedProject(r) {
    var aliases = sfArchiveAliases(r);
    if (!aliases.length) return null;
    var prjs = getData('ptf_crm_projects') || [];
    for (var i = 0; i < prjs.length; i++) {
      var p = prjs[i];
      if (!p) continue;
      if (p.state !== 'archived' && p.origin !== 'salesfile') continue;
      var keys = [p.inqNo, p.cd, p.no ? String(p.no).replace(/^ARC-/, '') : ''];
      for (var k = 0; k < keys.length; k++) {
        if (keys[k] && aliases.indexOf(String(keys[k])) > -1) return p;
      }
    }
    return null;
  }
  /* v21.1 BUG-035: علامت‌گذاری پیشنهادها/درخواست مرتبط پس از باخت */
  function sfMarkLostRelated(r) {
    try {
      var aliases = sfArchiveAliases(r);
      var offers = getData('ptf_crm_offers') || [];
      var changed = false;
      offers.forEach(function (o) {
        if (!o || !o.inqNo) return;
        if (aliases.indexOf(String(o.inqNo)) < 0) return;
        if (o.st === 'won') return; /* برنده را دست نزن */
        if (o.st !== 'lost') { o.st = 'lost'; changed = true; }
        if (!o.lostAt) { o.lostAt = (typeof faDateTime === 'function' ? faDateTime() : ''); changed = true; }
      });
      if (changed) setData('ptf_crm_offers', offers);
    } catch (e) {}
    try {
      var aliases2 = sfArchiveAliases(r);
      var rfqs = getData('ptf_crm_rfqs') || [];
      var ch2 = false;
      rfqs.forEach(function (q) {
        if (!q) return;
        var hit = aliases2.indexOf(String(q.cd || '')) > -1 || aliases2.indexOf(String(q.inqNo || '')) > -1;
        if (!hit) return;
        if (q.st !== 'stX' && q.st !== 'st7') { q.st = 'stX'; ch2 = true; }
      });
      if (ch2) setData('ptf_crm_rfqs', rfqs);
    } catch (e2) {}
  }

  window.sfCloseLost = function (cd, reasonId, note) {
    var list = sfAll();
    var r = list.filter(function (x) { return x.cd === cd; })[0];
    if (!r) return;
    /* v21.1 BUG-035: جلوگیری از بایگانی تکراری */
    var alreadyLost = sfFindArchivedProject(r);
    if (alreadyLost) {
      alert('ℹ️ این پرونده قبلاً بایگانی شده است\n(' + (alreadyLost.no || '') + (alreadyLost.closeKind ? ' — ' + alreadyLost.closeKind : '') + ')');
      try { renderDeals(); } catch (e) {}
      return;
    }
    var rl = SF_LOST_REASONS.filter(function (x) { return x.id === reasonId; })[0] || SF_LOST_REASONS[SF_LOST_REASONS.length - 1];
    var why = rl.lb + (note && String(note).trim() ? ' — ' + String(note).trim() : '');
    var miscKeys = (r.docs || []).map(function (m) { return m.key; }).filter(Boolean);
    function proceed() {
      if (miscKeys.length && !confirm('⚠️ هشدار نهایی: ' + miscKeys.length + ' سند متفرقه این پرونده از فضای ابری «برای همیشه» پاک می‌شود.\nادامه می‌دهید؟')) return;
      sfDeleteCloud(miscKeys);
      r.docs = (r.docs || []).map(function (m) { return { name: m.name, t: m.t, by: m.by, purged: true }; }); // فقط متادیتا برای آمار
      sfArchive(r, 'lost', false, why, rl.id);
    }
    if (miscKeys.length) {
      /* پیشنهاد دانلود قبل از حذف */
      var dl = confirm('این پرونده ' + miscKeys.length + ' سند متفرقه در فضای ابری دارد که هنگام مختومه شدن پاک می‌شوند.\n\nآیا می‌خواهید قبل از حذف، اسناد را دانلود کنید؟\n(OK = نمایش اسناد برای دانلود | Cancel = ادامه بدون دانلود)');
      if (dl) {
        var links = (r.docs || []).filter(function (m) { return m.key; }).map(function (m, i2) {
          return '<div style="padding:6px 0;border-bottom:1px dashed var(--brd)"><a href="javascript:void(0)" onclick="openStoredFile(\'' + ptfOnClickArg(m.key) + '\')" style="color:#0e7490">⬇️ ' + escP(m.name) + '</a></div>';
        }).join('');
        var html = '<div class="md-b" style="display:grid;z-index:2500" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:480px">' +
          '<h3>⬇️ دانلود اسناد قبل از مختومه شدن</h3>' + links +
          '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">' +
          '<button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">انصراف از مختومه کردن</button>' +
          '<button class="bt" style="background:#b45309" onclick="this.closest(\'.md-b\').remove();window._sfProceedClose()">دانلود کردم — ادامه مختومه‌سازی</button></div></div></div>';
        document.getElementById('panels').insertAdjacentHTML('beforeend', html);
        window._sfProceedClose = proceed;
        return;
      }
    }
    proceed();
  };

  /* انتقال به بایگانی (ماژول projects با نام جدید) */
  function sfArchive(r, closeKind, keepDocs, why, reasonId) {
    /* v21.1 BUG-035: idempotent — اگر قبلاً بایگانی شده، رکورد تکراری نساز */
    var existing = sfFindArchivedProject(r);
    if (existing) {
      try { sfSave(sfAll().filter(function (x) { return x.cd !== r.cd; })); } catch (e) {}
      window._sfOpen = null;
      try { renderDeals(); } catch (e2) {}
      if (typeof ptfToast === 'function') ptfToast('این پرونده قبلاً بایگانی شده است', 'ok');
      return existing;
    }
    var d = r.inqNo ? sfDocsOf(r) : { offers: [], letters: [], invoices: [], misc: r.docs || [], supply: [] };
    var prjs = getData('ptf_crm_projects');
    /* BUG-ARCHIVE: snapshot کامل فهرست اسناد پرونده (پیشنهادها/نامه‌ها/فاکتورها/استعلام‌ها/متفرقه)
       همراه بایگانی ذخیره می‌شود تا «تمام اسناد پرونده» حتی اگر دادهٔ زنده بعداً تغییر کند،
       در بایگانی قابل مشاهده باشند. */
    var docSnap = {
      offers: d.offers.map(function (o) { return { no: o.no, kind: o.kind, rev: o.rev || 0, t: o.t || '', st: o.st || '' }; }),
      letters: d.letters.map(function (l) { return { no: l.no, subject: l.subject || '', kind: l.kind || '', t: l.t || '' }; }),
      invoices: d.invoices.map(function (i) { return { no: i.no, offerNo: i.offerNo, amount: +i.amount || 0, t: i.t || i.invDate || '' }; }),
      supply: d.supply.map(function (q) { return { no: q.no || q.cd || '', t: q.t || '' }; }),
      misc: (r.docs || []).map(function (m) { return { name: m.name, key: m.key || null, t: m.t, by: m.by }; })
    };
    var rec = {
      no: 'ARC-' + (r.inqNo || r.cd),
      dealCd: r.cd || '', /* AUD-07: مرجع پرونده‌ی اصلی برای یافتن بایگانی از روی cd سابق (sfReverseAutoSettle) */
      buyerCo: r.buyerCo || '',
      offerNo: r.wonOffer || (d.offers[0] || {}).no || r.offerNo || '',
      wonOffer: r.wonOffer || '',
      inqNo: r.inqNo || '',
      state: 'archived',
      origin: 'salesfile',
      closeKind: closeKind, /* lost | settled */
      closeWhy: why || '',
      closeReason: reasonId || (closeKind === 'settled' ? 'won' : ''), /* v14.8: کد دلیل استاندارد برای گزارش Win/Loss */
      lossEvents: (r.lossEvents || []).slice(), /* v18.0 US-421: زیان‌های ثبت‌شده همراه پرونده به بایگانی منتقل می‌شوند */
      awardDocs: (r.awardDocs || []).slice(), /* v19.1 US-432: snapshot اسناد قطعی برد همراه پرونده بایگانی می‌شود */
      qcEvents: (r.qcEvents || []).slice(), /* v19.1 US-434ف۱: سوابق QC/بازرسی حفظ می‌شود */
      shipEvents: (r.shipEvents || []).slice(), /* v19.2 US-434ف۲: سوابق ارسال/تحویل حفظ می‌شود */
      costEvents: (r.costEvents || []).slice(), /* v19.1: هزینه‌های مستقیم پرونده (v18.6) هم به بایگانی */
      closedAt: faDateTime(),
      closedBy: curSession().name,
      /* AUD-07 (ممیزی ۱۴۰۵/۰۵/۰۷ — crm/AUDIT-FINANCIAL-SYSTEM-2026-07-29.md):
         sfCloseSettledCommit درست همین قبل، r.autoSettleReceipts را برای
         تسویه‌ی خودکار فاکتور باز ست می‌کند و بلافاصله sfArchive را صدا
         می‌زند که r را برای همیشه از ptf_crm_deals حذف و به این رکورد
         بایگانی تبدیل می‌کند. بدون این سه خط، autoSettleReceipts هرگز به
         بایگانی منتقل نمی‌شد و sfReverseAutoSettle (که روی همین کلید
         cd جست‌وجو می‌کند) همیشه با «این پرونده تسویه خودکار ندارد» مواجه
         می‌شد — یعنی قابلیت برگشت عملاً هرگز در دسترس نبود. */
      autoSettleReceipts: (r.autoSettleReceipts || []).slice(),
      autoSettleDate: r.autoSettleDate || '',
      autoSettleBy: r.autoSettleBy || '',
      stats: { offers: d.offers.length, letters: d.letters.length, invoices: d.invoices.length, misc: (r.docs || []).length, supply: (d.supply || []).length, /* v17.1 */
               totalCO: d.offers.filter(function (o) { return o.kind !== 'TO'; }).reduce(function (s, o) { return s + (o.items || []).reduce(function (s2, it) { return s2 + (+it.qty || 0) * (+it.price || 0); }, 0); }, 0),
               totalCOCur: (d.offers.filter(function (o) { return o.kind !== 'TO' && o.currency && o.currency !== 'IRR'; })[0] || {}).currency || 'IRR', /* v17.4 US-416 */
               lossIrr: (typeof ptfProjectLossTotal === 'function' ? ptfProjectLossTotal(r) : (r.lossEvents || []).reduce(function(s,x){return s+(+x.amt||0);},0)) /* v18.0 US-421 */ },
      docs: keepDocs ? (r.docs || []).map(function (m) { return { folder: 'misc', name: m.name, key: m.key || null, t: m.t, by: m.by }; }) : [],
      docSnap: docSnap, /* BUG-ARCHIVE: فهرست کامل اسناد بایگانی‌شده */
      offerNos: d.offers.map(function (o) { return o.no; }),
      t: faDateTime(),
      timeline: [{ t: faDateTime(), by: curSession().name, tx: closeKind === 'settled' ? '🏁 مختومه — پایان پروژه و تسویه کامل (انتقال از پرونده‌های فروش)' : '🚫 مختومه بدون فاکتور — ' + (why || '') }]
    };
    prjs.unshift(rec);
    setData('ptf_crm_projects', prjs);
    /* v21.1 BUG-035: پیشنهادها/درخواست مرتبط را lost/stX کن تا فرصت دوباره نیاید */
    if (closeKind === 'lost') sfMarkLostRelated(r);
    /* حذف از پرونده‌های فروش */
    sfSave(sfAll().filter(function (x) { return x.cd !== r.cd; }));
    try { audit('پرونده‌های فروش', 'مختومه (' + (closeKind === 'settled' ? 'تسویه کامل' : 'بدون فاکتور') + ') و انتقال به بایگانی: ' + (r.inqNo || r.cd), r.cd); } catch (e) {}
    if (typeof notify === 'function') notify({ toRoles: ['admin', 'chairman', 'ceo'], title: '📦 پرونده فروش ' + (r.inqNo || r.cd) + ' مختومه و به بایگانی منتقل شد (' + (closeKind === 'settled' ? 'تسویه کامل' : 'بدون فاکتور: ' + (why || '')) + ')', kind: 'system', channels: ['cart'] });
    window._sfOpen = null;
    renderDeals();
    if (typeof ptfToast === 'function') ptfToast('پرونده مختومه و به بایگانی منتقل شد', 'ok');
  }

  /* ---------- اتصال نامه‌ها: گزینه پرونده‌های فروش در کشوی «لینک به پرونده» نامه ---------- */
  function hookLetterModal() {
    if (window._sfLetterHooked || typeof window.showLetterModal !== 'function') return false;
    window._sfLetterHooked = true;
    var _slm = window.showLetterModal;
    window.showLetterModal = function (cd) {
      _slm(cd);
      try {
        var sel = document.getElementById('ltPrj');
        if (!sel) return;
        sfAll().forEach(function (r) {
          if (r.st === 'archived' || !r.inqNo) return;
          var o = document.createElement('option');
          o.value = 'SF:' + r.inqNo;
          o.textContent = '📁 درخواست ' + r.inqNo + ' — ' + (r.buyerCo || '');
          var l = cd ? getData('ptf_crm_letters').filter(function (x) { return x.cd === cd; })[0] : null;
          if (l && l.prjNo === o.value) o.selected = true;
          sel.appendChild(o);
        });
      } catch (e) {}
    };
    return true;
  }
  /* v34.0.0-alpha (F4-5): توابع کمکی سمت پرونده برای لینک از پرونده ↔ تنخواه
     این توابع در کنار توابع ptfPettyRelatedCosts / ptfPettyUpdateDealLink در petty.js کار می‌کنند. */
  window.ptfDealGoPetty = function (pettyCd) {
    /* رفتن به ماژول تنخواه + هایلایت رکورد مربوطه */
    try { if (typeof goPanel === 'function') goPanel('petty'); } catch (e) {}
    setTimeout(function () {
      try {
        var el = document.getElementById('pty-' + (pettyCd || ''));
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          var prevOutline = el.style.outline || '';
          el.style.outline = '3px solid #fde68a';
          setTimeout(function () { el.style.outline = prevOutline; }, 2400);
          if (typeof ptfToast === 'function') ptfToast('رکورد تنخواه ' + pettyCd + ' در لیست پیدا شد ✨', 'ok');
        } else {
          if (typeof ptfDialog === 'function') ptfDialog({ title: '🏦 هزینهٔ تنخواه ' + pettyCd, body: 'به ماژول تنخواه بروید و رکورد ' + pettyCd + ' را در لیست پیدا کنید. (المنت مخصوص بعد از رندر کامل لیست ایجاد می‌شود.)' });
          else if (typeof ptfToast === 'function') ptfToast('به ماژول تنخواه بروید و رکورد ' + pettyCd + ' را پیدا کنید', 'info');
        }
      } catch (e2) { console.warn('ptfDealGoPetty:', e2); }
    }, 350);
  };

  /* v34.0.0-alpha (F4-5): دیالوگ انتخاب هزینهٔ تنخواه موجود + لینک به پروندهٔ فروش */
  window.ptfDealLinkFromPetty = function (dealCd, inqNo) {
    var ds = getData('ptf_crm_deals') || [];
    var deal = ds.filter(function (x) { return x.cd === dealCd; })[0];
    if (!deal) { alert('پرونده یافت نشد'); return; }
    var linkedCds = (deal.costEvents || []).filter(function (x) { return x.pettyCd || x.fromPetty; }).map(function (x) { return x.pettyCd || x.cd; });
    var available = (getData('ptf_crm_petty') || []).filter(function (p) {
      if (p.st === 'void') return false;
      /* هزینه‌ای که به این پرونده لینک شده → از لیست «افزودن» حذف */
      if (p.dealRef === dealCd) return false;
      /* هزینه‌ای که به پروندهٔ دیگری لینک شده → نباید اینجا بیاید */
      if (p.dealRef) return false;
      /* هزینه‌ای که قبلاً در costEvents این پرونده ثبت شده → تکراری نشود */
      return linkedCds.indexOf(p.cd) === -1;
    });
    if (!available.length) { if (typeof ptfToast === 'function') ptfToast('هیچ هزینهٔ تنخواه لینک‌نشدهٔ فعالی به این پرونده وجود ندارد', 'info'); return; }
    var options = available.map(function (p) {
      return '<option value="' + escP(p.cd) + '">' + escP(p.cd) + ' — ' + escP(p.cat || '') + ' — ' + (+p.amt || 0).toLocaleString('fa-IR') + ' ریال — ' + escP((p.desc || '').slice(0, 60)) + ' (' + escP((p.t || '').split(' ')[0] || '') + ' — ' + escP(p.by || '') + ')</option>';
    }).join('');
    ptfDialog({
      title: '🔗 افزودن هزینهٔ تنخواه به پرونده — ' + (deal.inqNo || dealCd),
      body: 'از لیست زیر، هزینهٔ تنخواه مورد نظر را انتخاب کنید. پس از تایید، در سود پروژه لحاظ می‌شود (بدون دوباره‌شماری با OPEX).',
      fields: [{ id: 'pcd', label: 'هزینهٔ تنخواه', type: 'select', optionsHtml: options, required: true }],
      okText: 'افزودن به پرونده',
      onOk: function (v) {
        var r = available.filter(function (x) { return x.cd === v.pcd; })[0];
        if (!r) return;
        /* به‌روزرسانی dealRef در رکورد تنخواه */
        try {
          var allP = getData('ptf_crm_petty') || [];
          var idx = allP.findIndex(function (x) { return x.cd === r.cd; });
          if (idx > -1) { allP[idx].dealRef = dealCd; setData('ptf_crm_petty', allP); }
        } catch (eP) { console.warn('set petty.dealRef:', eP); }
        /* فراخوانی helper مرکزی در petty.js — همان منطق لینک دوطرفه (ایجاد costEvent + timeline + audit) */
        try { if (typeof ptfPettyUpdateDealLink === 'function') ptfPettyUpdateDealLink(r, dealCd, ''); } catch (eU) { console.warn('ptfPettyUpdateDealLink:', eU); }
        if (typeof audit === 'function') audit('پرونده فروش', '➕ لینک هزینهٔ تنخواه ' + r.cd + ' (' + (+r.amt || 0).toLocaleString('fa-IR') + ' ریال) به پرونده ' + (deal.inqNo || dealCd), r.cd);
        if (typeof ptfToast === 'function') ptfToast('هزینهٔ تنخواه به پرونده لینک شد', 'ok');
        if (typeof renderDeals === 'function') renderDeals();
      }
    });
  };

  /* v34.0.0-alpha (F4-5): حذف هزینه از پرونده + در صورت fromPetty، حذف لینک از تنخواه نیز
     - برای هزینهٔ مستقیم پرونده: فقط از costEvents پاک می‌شود
     - برای هزینهٔ لینک‌شده از تنخواه: علاوه بر costEvents، فیلد dealRef در رکورد تنخواه خالی می‌شود
       (هزینهٔ اصلی در تنخواه باقی می‌ماند و تنها «لینک» قطع می‌شود — مطابق درخواست کارفرما) */
  window.ptfDealRemoveCost = function (dealCd, costCd, pettyCd) {
    var ds = getData('ptf_crm_deals') || [];
    var d = ds.filter(function (x) { return x.cd === dealCd; })[0];
    if (!d) return;
    if (!confirm('این هزینه از پرونده حذف شود؟' + (pettyCd ? '\n\n(لینک از تنخواه نیز حذف می‌شود ولی هزینهٔ اصلی در تنخواه باقی می‌ماند.)' : ''))) return;
    d.costEvents = (d.costEvents || []).filter(function (x) { if (x.cd === costCd) return false; return true; });
    d.timeline = d.timeline || [];
    d.timeline.push({ t: faDateTime(), by: curSession().name, tx: '🗑 حذف هزینهٔ پرونده ' + costCd + (pettyCd ? ' (لینک تنخواه ' + pettyCd + ')' : '') });
    setData('ptf_crm_deals', ds.map(function (x) { return x.cd === dealCd ? d : x; }));
    if (pettyCd) {
      try {
        var pt = (getData('ptf_crm_petty') || []).filter(function (x) { return x.cd === pettyCd; })[0];
        if (pt) {
          pt.dealRef = '';
          setData('ptf_crm_petty', (getData('ptf_crm_petty') || []).map(function (x) { return x.cd === pettyCd ? pt : x; }));
          if (typeof audit === 'function') audit('پرونده فروش', '🔗 حذف لینک هزینهٔ تنخواه ' + pettyCd + ' از پرونده ' + (d.inqNo || dealCd), pettyCd);
        }
      } catch (ePt) { console.warn('remove petty link:', ePt); }
    }
    if (typeof audit === 'function') audit('پرونده فروش', '🗑 حذف هزینهٔ پرونده ' + costCd + (pettyCd ? ' (لینک تنخواه ' + pettyCd + ')' : ''), costCd);
    if (typeof renderDeals === 'function') renderDeals();
  };

  var htr2 = 0;
  var ht2 = setInterval(function () { htr2++; if (hookLetterModal() || htr2 > 50) clearInterval(ht2); }, 400);
})();
