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
    var out = { offers: [], letters: [], invoices: [], misc: [], supply: [] };
    var offers = typeof window.ptfSalesFileOffers === 'function' ? window.ptfSalesFileOffers(r) : getData('ptf_crm_offers').filter(function (o) { return o.inqNo === r.inqNo; });
    out.offers = offers; // نمایش زنده = همیشه آخرین رویژن (o.rev)
    out.letters = getData('ptf_crm_letters').filter(function (l) {
      return l.prjNo === 'SF:' + r.inqNo || l.inqNo === r.inqNo;
    });
    var offNos = offers.map(function (o) { return o.no; });
    out.invoices = getData('ptf_crm_invoices').filter(function (i) { return offNos.indexOf(i.offerNo) > -1 && i.status !== 'void' && i.st !== 'void' && i.status !== 'superseded' && i.void !== true; });
    /* فایل‌هایی که در بخش تخصصی فاکتور/حمل/QC/هزینه مدیریت می‌شوند دوباره به‌عنوان
       «متفرقه» ظاهر نمی‌شوند؛ این کار مانع دورزدن قفل سند رسمی یا metadata مبدا است. */
    var ownedKeys = {};
    out.invoices.forEach(function (i) { (i.files || []).forEach(function (f) { if (f && f.key) ownedKeys[f.key] = true; }); });
    ['shipEvents', 'qcEvents', 'costEvents'].forEach(function (ek) { (r[ek] || []).forEach(function (ev) { (ev.files || []).forEach(function (f) { if (f && f.key) ownedKeys[f.key] = true; }); }); });
    out.misc = (r.docs || []).filter(function (doc) { return !doc.key || !ownedKeys[doc.key]; });
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
  // ARENA-2026-08-17 / گام ۲: دسترسی به دیالوگ صدور فاکتور غیررسمی (تک + تجمیعی)
  // مسیریابی فرایندی و چکید دسترسی به سایر پیشنهادهای متصل به پرونده
  window.sfUnofficialInvoiceNew = function (dealCd) {
    if (typeof window.unofficialInvoiceBuilderOpen !== 'function') {
      if (typeof alert === 'function') alert('⛔ ماژول صدور فاکتور غیررسمی بارگذاری نشده است (crm/unofficial-invoice.js).');
      return;
    }
    // گارد نقش: فقط senior یا accountant
    var _role = (typeof curRole === 'function') ? curRole() : '';
    var _isSnr = (typeof isSenior === 'function') && isSenior();
    if (!_isSnr && _role !== 'accountant') {
      if (typeof alert === 'function') alert('⛔ صدور صورتحساب غیررسمی فقط برای مدیران ارشد یا حسابدار مجاز است');
      return;
    }
    window.unofficialInvoiceBuilderOpen(dealCd);
  };


  /* v34.5.4: نمایش سود/حاشیه پرونده فروش حذف شد.
     عدد قبلی گمراه‌کننده بود (خرید لینک‌نشده = سود متورم). موتور سال مالی دست نخورده می‌ماند. */

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
      try { notify({ toRoles: SENIOR_ROLES, title: '⛔ عدم انطباق کالا در پرونده ' + (r.inqNo || cd) + ' — بررسی فوری (ریسک زیان)', kind: 'qc_ncr', channels: ['cart'], link: { panel: 'deals' }, actionable: true, refCd: cd, dkey: 'qc-ncr-' + cd }); } catch (e3) {}
    }
    return ev;
  };
  window.sfQcUpdate = function (cd, eventCd, typeId, confId, desc) {
    var list = sfAll();
    var r = list.filter(function (x) { return x.cd === cd; })[0];
    var ev = r && (r.qcEvents || []).filter(function (x) { return x.cd === eventCd; })[0];
    if (!r || !ev) return null;
    var tp = SF_QC_TYPES.filter(function (x) { return x.id === typeId; })[0] || SF_QC_TYPES[0];
    var cf = SF_QC_CONF.filter(function (x) { return x.id === confId; })[0] || SF_QC_CONF[0];
    var before = JSON.parse(JSON.stringify(ev));
    ev.type = tp.id; ev.conf = cf.id; ev.desc = (desc || '').trim(); ev.updatedAt = faDateTime(); ev.updatedBy = curSession().name;
    r.documentAudit = r.documentAudit || [];
    r.documentAudit.push({ t: faDateTime(), by: curSession().name, action: 'edit', kind: 'qcEvent', ref: eventCd, before: before, after: JSON.parse(JSON.stringify(ev)) });
    r.timeline = r.timeline || []; r.timeline.push({ t: faDateTime(), by: curSession().name, tx: '✏️ اصلاح رکورد QC ' + eventCd + ' — ' + tp.lb + ' / ' + cf.lb });
    sfSave(list);
    try { audit('پرونده‌های فروش', 'اصلاح رکورد QC ' + eventCd + ' در پرونده ' + (r.inqNo || cd), cd); } catch (e) {}
    return ev;
  };

  window.sfQcDeleteCommit = function (cd, eventCd, reason) {
    var list = sfAll();
    var r = list.filter(function (x) { return x.cd === cd; })[0];
    var idx = r ? (r.qcEvents || []).findIndex(function (x) { return x.cd === eventCd; }) : -1;
    if (!r || idx < 0) return null;
    var ev = r.qcEvents.splice(idx, 1)[0];
    var keys = (ev.files || []).map(function (f) { return f.key; }).filter(Boolean);
    r.docs = (r.docs || []).filter(function (d) { return !d.key || keys.indexOf(d.key) < 0; });
    r.documentAudit = r.documentAudit || [];
    r.documentAudit.push({ t: faDateTime(), by: curSession().name, action: 'delete', kind: 'qcEvent', ref: eventCd, reason: reason, before: JSON.parse(JSON.stringify(ev)) });
    r.timeline = r.timeline || []; r.timeline.push({ t: faDateTime(), by: curSession().name, tx: '🗑 حذف رکورد QC ' + eventCd + ' — دلیل: ' + reason });
    sfSave(list);
    try { audit('پرونده‌های فروش', 'حذف کنترل‌شده رکورد QC ' + eventCd + ' — ' + reason, cd); } catch (e) {}
    if (typeof renderDeals === 'function') renderDeals();
    if (typeof ptfToast === 'function') ptfToast('رکورد QC حذف شد و سابقه حسابرسی حفظ شد.', 'warn');
    return ev;
  };

  window.sfQcDelete = function (cd, eventCd) {
    var reason = prompt('دلیل حذف رکورد QC را وارد کنید (الزامی):', 'ثبت یا مدرک اشتباه');
    if (reason === null) return;
    reason = reason.trim(); if (!reason) { alert('دلیل حذف الزامی است.'); return; }
    var r = sfAll().filter(function (x) { return x.cd === cd; })[0];
    var ev = r && (r.qcEvents || []).filter(function (x) { return x.cd === eventCd; })[0];
    if (!ev) return;
    sfDeleteCloudThen((ev.files || []).map(function (f) { return f.key; }).filter(Boolean), function () { sfQcDeleteCommit(cd, eventCd, reason); });
  };

  window.sfQcOpen = function (cd, eventCd) {
    var r = sfAll().filter(function (x) { return x.cd === cd; })[0];
    if (!r) return;
    var current = eventCd ? (r.qcEvents || []).filter(function (x) { return x.cd === eventCd; })[0] : null;
    ptfDialog({
      title: (current ? '✏️ اصلاح ' : '') + '🔬 کنترل کیفیت / بازرسی — ' + (r.inqNo || cd),
      body: current ? 'ویرایش با نگهداری تصویر قبل/بعد در سابقه حسابرسی پرونده انجام می‌شود.' : 'نوت بازرسی رسمی از بخش «اسناد رسمی قالب شرکت» و با قالب انگلیسی Inspection Notice صادر می‌شود و نتیجه ندارد. این بخش فقط برای ثبت/پیوست نتایج آزمایش، گزارش بازرسی صادره توسط بازرس و گواهی‌هاست. در صورت «عدم انطباق»، ثبت زیان پروژه پیشنهاد می‌شود.',
      fields: [
        { id: 'type', label: 'نوع رکورد', type: 'select', value: current ? current.type : '', options: SF_QC_TYPES.map(function (x) { return { v: x.id, lb: x.lb }; }) },
        { id: 'conf', label: 'وضعیت انطباق', type: 'select', value: current ? current.conf : '', options: SF_QC_CONF.map(function (x) { return { v: x.id, lb: x.lb }; }) },
        { id: 'desc', label: 'شرح', type: 'textarea', rows: 3, required: true, value: current ? current.desc || '' : '', placeholder: 'مثلا: گزارش بازرسی بازرس پیوست شد / نتیجه آزمایش ضمیمه شد' }
      ],
      okText: current ? 'ذخیره اصلاح' : 'ثبت در پرونده',
      onOk: function (v) {
        if (current) { var ev = sfQcUpdate(cd, current.cd, v.type, v.conf, v.desc); }
        else { var ev = sfQcCommit(cd, v.type, v.conf, v.desc); }
        if (!ev) return;
        if (typeof ptfToast === 'function') ptfToast(current ? 'رکورد QC اصلاح شد' : 'رکورد QC در پرونده ثبت شد 🔬', 'ok');
        if (!current && v.conf === 'nonconform' && confirm('⛔ عدم انطباق ثبت شد.\n\nاگر این عدم انطباق هزینه ازدست‌رفته دارد، همین حالا «ثبت زیان پروژه» باز شود؟')) {
          if (typeof ptfLossOpen === 'function') ptfLossOpen('deal', cd);
        }
        if (!current && confirm('برای این رکورد QC مدرک/گزارش پیوست می‌کنید؟') && typeof attachUploadWidget === 'function') sfQcUpload(cd, ev.cd);
        if (typeof renderDeals === 'function') renderDeals();
      }
    });
  };

  /* ===== v19.2: وضعیت‌های مرحله‌ای ۱۲گانه پرونده فروش پس از برد =====
     اصل معماری: وضعیت پرونده «مشتق» است نه فیلد آزاد — تابع واحد sfStageOf از روی
     سیگنال‌های واقعی (وضعیت درخواست، رویدادهای ارسال، ارجاع/صدور فاکتور، وصول) محاسبه
     می‌کند. حذف/اصلاح کنترل‌شدهٔ شاهد، مرحله را به آخرین شاهد معتبر بازمی‌گرداند؛ اما
     وجود شاهد مرحلهٔ بعدی مانع عقب‌گرد است. پرونده/درخواست/کانبان هم‌راستا نگه داشته می‌شوند. */
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
        var managedEvidence = !!r.stageEvidenceManaged;
        var hasPrepEvidence = (r.shipEvents || []).some(function (e) { return e.type === 'packing' || e.type === 'shipdoc'; });
        var hasDeliveryEvidence = (r.shipEvents || []).some(function (e) { return e.type === 'delivered'; });
        if (rfq.st === 'st8') up(3);
        else if (rfq.st === 'st9') up(4);
        else if (rfq.st === 'st6' && (!managedEvidence || hasPrepEvidence)) up(5);
        else if (rfq.st === 'st7' && (!managedEvidence || hasDeliveryEvidence)) up(7);
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
          var paid = (window.PTF && PTF.invPaidSum) ? PTF.invPaidSum(i) : ((i.payments || []).concat(i.pays || [])).reduce(function (s3, pp) { return s3 + (+pp.amt || 0); }, 0);
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

  /* راهنمای اجرایی مرحله از همان شماره مشتق‌شده sfStageOf ساخته می‌شود؛ بنابراین UI
     یک «وضعیت دستی» دوم ایجاد نمی‌کند و همیشه دقیقاً می‌گوید کدام شاهد مرحله بعد را می‌سازد. */
  window.sfStageGuidance = function (r) {
    var n = sfStageOf(r);
    var defs = {
      1: { next: 2, task: 'یک استعلام تامین مرحله دوم برای همین درخواست ثبت کنید.', button: '🤖 ثبت استعلام تامین', onclick: "ptfRealBuyNewInquiry('" + ptfOnClickArg(r.inqNo || '') + "')", evidence: 'کارت استعلام تامین متصل به درخواست' },
      2: { next: 3, task: 'تامین‌کننده را انتخاب و خرید واقعی اقلام پرونده را ثبت کنید.', button: '🛍 ثبت خرید واقعی', onclick: "ptfRealBuyOpen('" + ptfOnClickArg(r.inqNo || '') + "')", evidence: 'حداقل یک خرید واقعی متصل به پرونده' },
      3: { next: 4, task: 'پس از دریافت کالا از تامین‌کننده، نتیجه تحویل تامین را در امتیازدهی تامین‌کننده ثبت کنید.', button: '', onclick: '', evidence: 'وضعیت «تحویل تامین‌کننده» درخواست' },
      4: { next: 5, task: 'پکینگ‌لیست را صادر و رویداد آماده‌سازی ارسال را در پرونده ثبت کنید.', button: '🧰 ثبت پکینگ‌لیست', onclick: "sfShipOpen('" + ptfOnClickArg(r.cd) + "','packing')", evidence: 'رویداد پکینگ‌لیست پرونده' },
      5: { next: 6, task: 'بارنامه، بیجک یا سند ارسال را با شماره و شرکت حمل ثبت کنید.', button: '🚚 ثبت بارنامه / بیجک', onclick: "sfShipOpen('" + ptfOnClickArg(r.cd) + "','shipdoc')", evidence: 'رویداد سند ارسال پرونده' },
      6: { next: 7, task: 'تحویل کالا به کارفرما و نام تحویل‌گیرنده را ثبت کنید.', button: '🤝 ثبت تحویل کارفرما', onclick: "sfShipOpen('" + ptfOnClickArg(r.cd) + "','delivered')", evidence: 'رویداد تحویل به کارفرما' },
      7: { next: 8, task: 'پرونده تحویل‌شده را برای صدور فاکتور رسمی به حسابدار ارجاع دهید.', button: '🧾 ارجاع فاکتور', onclick: "sfInvoiceRef('" + ptfOnClickArg(r.cd) + "')", evidence: 'ارجاع فاکتور روی پیشنهاد قطعی برد' },
      8: { next: 9, task: 'حسابدار باید فاکتور صادرشده خارج از CRM را همراه فایل معتبر حسابداری/مودیان ثبت کند.', button: '🧾 رفتن به فاکتورها', onclick: "goPanel('inv')", evidence: 'فاکتور رسمی دارای ضمیمه معتبر' },
      9: { next: 10, task: 'دریافت واقعی مشتری را فقط از حساب همین پرونده ثبت کنید.', button: '💳 دریافت و حساب پرونده', onclick: "ptfCaseFinanceOpen('" + ptfOnClickArg(r._id || r.cd) + "')", evidence: 'Receipt قطعی متصل به شناسه پرونده' },
      10: { next: 11, task: 'دریافت‌های قطعی را تا تسویه کامل مانده فاکتورها ثبت و کنترل کنید.', button: '💳 تکمیل تسویه', onclick: "ptfCaseFinanceOpen('" + ptfOnClickArg(r._id || r.cd) + "')", evidence: 'مانده همه فاکتورهای فعال برابر صفر' },
      11: { next: 12, task: 'کنترل نهایی اسناد را انجام دهید و پرونده تسویه‌شده را بایگانی کنید.', button: '🏁 کنترل و بایگانی', onclick: "sfClose('" + ptfOnClickArg(r.cd) + "')", evidence: 'تایید کنترل مختومه‌سازی' },
      12: { next: 0, task: 'پرونده بایگانی شده و اقدام مرحله‌ای بازی ندارد.', button: '', onclick: '', evidence: 'بایگانی قطعی پرونده' }
    };
    return defs[n] || { next: 0, task: 'برای این پرونده مرحله عملیاتی فعالی محاسبه نشد.', button: '', onclick: '', evidence: '' };
  };

  /* هم‌راستاسازی درخواست با مرحله پرونده — هنگام ثبت شاهد فقط رو به جلو؛ هنگام حذف
     اشتباه، تابع sfRfqRecomputeAfterEvidenceChange وضعیت را از شواهد باقیمانده بازسازی می‌کند.
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

  function sfRfqStatusText(st) {
    var d = (window.PTF_RFQ_STATUSES || []).filter(function (x) { return x.v === st; })[0];
    return d ? d.t : st;
  }

  /* حذف شاهد پرونده نباید status آینه‌ای درخواست را چسبنده نگه دارد. این تابع فقط
     وضعیت‌هایی را بازمی‌گرداند که خود رویدادهای پرونده به st6/st7 برده‌اند؛ اگر شاهد
     مرحله بعدی (ارجاع/فاکتور) موجود باشد، عمداً هیچ عقب‌گردی انجام نمی‌دهد. */
  window.sfRfqRecomputeAfterEvidenceChange = function (r, reason) {
    if (!r || !r.inqNo) return { changed: false, stage: sfStageOf(r) };
    var docs = sfDocsOf(r);
    var wo = getData('ptf_crm_offers').filter(function (o) { return o.no === r.wonOffer; })[0];
    var laterEvidence = !!((wo && wo.invRef) || (docs.invoices || []).length || r.st === 'archived');
    if (laterEvidence) return { changed: false, preservedByLaterEvidence: true, stage: sfStageOf(r) };
    var evs = r.shipEvents || [];
    var target = '';
    if (evs.some(function (e) { return e.type === 'delivered'; })) target = 'st7';
    else if (evs.some(function (e) { return e.type === 'shipdoc' || e.type === 'packing'; })) target = 'st6';
    else {
      target = r.rfqBeforeShipping || '';
      /* st6/st7 در snapshot قدیمی خود محصول شاهد حمل بوده‌اند و پس از حذف آخرین
         شاهد معتبر نیستند؛ در پرونده‌های قدیمی از خرید واقعی/ابلاغ fallback می‌گیریم. */
      if (!target || ['st6', 'st7', 'stX'].indexOf(target) > -1) {
        var rb = (typeof ptfRealBuyStatus === 'function') ? ptfRealBuyStatus(r.inqNo) : { has: false, done: 0 };
        target = rb && rb.has && rb.done > 0 ? 'st8' : 'st5';
      }
    }
    var rfqs = getData('ptf_crm_rfqs');
    var rfq = rfqs.filter(function (x) { return x.cd === r.inqNo || x.inqNo === r.inqNo; })[0];
    if (!rfq) return { changed: false, stage: sfStageOf(r) };
    if (rfq.st === target) return { changed: false, stage: sfStageOf(r) };
    var before = rfq.st;
    rfq.st = target; rfq.stxt = sfRfqStatusText(target); rfq.waiting = null;
    rfq.evidenceRecomputedAt = new Date().toISOString();
    rfq.evidenceRecomputedReason = reason || 'اصلاح شواهد پرونده';
    setData('ptf_crm_rfqs', rfqs);
    try { audit('استعلامات', 'بازمحاسبه وضعیت از شواهد پرونده: ' + before + ' ← ' + target + ' — ' + (reason || ''), rfq.cd); } catch (e) {}
    return { changed: true, before: before, after: target, stage: sfStageOf(r) };
  };

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
    var excludeCd = arguments[3]; /* در اصلاح، خود رویداد از مقایسه زمانی کنار گذاشته می‌شود */
    if (!r || !dateISO) return null; /* بدون تاریخ صریح = چک زمانی ندارد (توالی مرحله‌ای سر جای خود) */
    var evs = (r.shipEvents || []).filter(function (e) { return !excludeCd || e.cd !== excludeCd; });
    function dates(t) { return evs.filter(function (e) { return e.type === t && e.dateISO; }).map(function (e) { return e.dateISO; }).sort(); }
    function lastDate(t) { var ds = dates(t); return ds.length ? ds[ds.length - 1] : ''; }
    function firstDate(t) { var ds = dates(t); return ds.length ? ds[0] : ''; }
    if (typeId === 'delivered') {
      var ship = lastDate('shipdoc');
      if (ship && dateISO < ship) return { ok: false, why: 'seq', lb: 'تاریخ تحویل به کارفرما (' + dateISO + ') نمی‌تواند قبل از تاریخ ارسال/بارنامه (' + ship + ') باشد', prev: ship };
    }
    if (typeId === 'shipdoc') {
      var pk = lastDate('packing');
      if (pk && dateISO < pk) return { ok: false, why: 'seq', lb: 'تاریخ بارنامه (' + dateISO + ') نمی‌تواند قبل از تاریخ پکینگ لیست (' + pk + ') باشد', prev: pk };
      var delivery = firstDate('delivered');
      if (delivery && dateISO > delivery) return { ok: false, why: 'seq', lb: 'تاریخ بارنامه (' + dateISO + ') نمی‌تواند بعد از تاریخ تحویل کارفرما (' + delivery + ') باشد', next: delivery };
    }
    if (typeId === 'packing') {
      var nextShip = firstDate('shipdoc');
      if (nextShip && dateISO > nextShip) return { ok: false, why: 'seq', lb: 'تاریخ پکینگ (' + dateISO + ') نمی‌تواند بعد از تاریخ بارنامه (' + nextShip + ') باشد', next: nextShip };
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
    r.shipEvents = r.shipEvents || [];
    /* وضعیت قبل از نخستین سند حمل برای عقب‌گرد کنترل‌شده حفظ می‌شود. */
    if (!r.shipEvents.length && !r.rfqBeforeShipping) {
      try {
        var preRfq = getData('ptf_crm_rfqs').filter(function (x) { return x.cd === r.inqNo || x.inqNo === r.inqNo; })[0];
        if (preRfq) r.rfqBeforeShipping = preRfq.st || 'st5';
      } catch (ePre) {}
    }
    var ev = { cd: genCode('SHP'), type: tp.id, no: (v.no || '').trim(), carrier: (v.carrier || '').trim(), dateISO: (v.dateISO || '').trim(), receiver: (v.receiver || '').trim(), note: (v.note || '').trim(), t: faDateTime(), by: curSession().name, files: [] };
    r.shipEvents.unshift(ev);
    r.stageEvidenceManaged = true;
    r.timeline = r.timeline || []; r.timeline.push({ t: faDateTime(), by: curSession().name, tx: tp.lb + (ev.no ? ' — ' + ev.no : '') + (ev.receiver ? ' — تحویل‌گیرنده: ' + ev.receiver : '') + (ev.note ? ' — ' + ev.note : '') });
    sfSave(list);
    try { audit('پرونده‌های فروش', 'ثبت ' + tp.lb + (ev.no ? ' (' + ev.no + ')' : '') + ' برای پرونده ' + (r.inqNo || cd), cd); } catch (e) {}
    /* گذار خودکار وضعیت درخواست — فقط رو به جلو، از مسیر واحد (AC2/AC4) */
    if (r.inqNo) sfRfqAlign(r.inqNo, tp.rfq, tp.rfqTxt);
    if (typeId === 'delivered' && typeof notify === 'function') {
      try { notify({ toRoles: SENIOR_ROLES, title: '🤝 کالای پرونده ' + (r.inqNo || cd) + ' به کارفرما تحویل شد — گام بعد: ارجاع فاکتور از پرونده', kind: 'delivery_next', channels: ['cart'], link: { panel: 'deals' }, actionable: true, refCd: cd, dkey: 'delivery-next-' + cd }); } catch (e2) {}
    }
    return ev;
  };

  window.sfShipUpdate = function (cd, eventCd, v) {
    v = v || {};
    var list = sfAll();
    var r = list.filter(function (x) { return x.cd === cd; })[0];
    var ev = r && (r.shipEvents || []).filter(function (x) { return x.cd === eventCd; })[0];
    if (!r || !ev) return null;
    var seq = sfShipSeqCheck(r, ev.type, (v.dateISO || '').trim(), eventCd);
    if (seq && !seq.ok) return seq;
    var before = JSON.parse(JSON.stringify(ev));
    ['no', 'carrier', 'dateISO', 'receiver', 'note'].forEach(function (k) { ev[k] = (v[k] || '').trim(); });
    ev.updatedAt = faDateTime(); ev.updatedBy = curSession().name;
    r.documentAudit = r.documentAudit || [];
    r.documentAudit.push({ t: faDateTime(), by: curSession().name, action: 'edit', kind: 'shipEvent', ref: eventCd, before: before, after: JSON.parse(JSON.stringify(ev)) });
    r.timeline = r.timeline || []; r.timeline.push({ t: faDateTime(), by: curSession().name, tx: '✏️ اصلاح مدرک ارسال/تحویل ' + eventCd });
    sfSave(list);
    sfRfqRecomputeAfterEvidenceChange(r, 'اصلاح مدرک ارسال/تحویل ' + eventCd);
    try { audit('پرونده‌های فروش', 'اصلاح مدرک ارسال/تحویل ' + eventCd + ' در پرونده ' + (r.inqNo || cd), cd); } catch (e) {}
    return ev;
  };

  window.sfShipDeleteCommit = function (cd, eventCd, reason) {
    var list = sfAll();
    var r = list.filter(function (x) { return x.cd === cd; })[0];
    var idx = r ? (r.shipEvents || []).findIndex(function (x) { return x.cd === eventCd; }) : -1;
    if (!r || idx < 0) return null;
    var beforeStage = sfStageOf(r);
    var ev = r.shipEvents.splice(idx, 1)[0];
    r.stageEvidenceManaged = true;
    var keys = (ev.files || []).map(function (f) { return f.key; }).filter(Boolean);
    r.docs = (r.docs || []).filter(function (d) { return !d.key || keys.indexOf(d.key) < 0; });
    r.documentAudit = r.documentAudit || [];
    r.documentAudit.push({ t: faDateTime(), by: curSession().name, action: 'delete', kind: 'shipEvent', ref: eventCd, reason: reason, before: JSON.parse(JSON.stringify(ev)) });
    r.timeline = r.timeline || []; r.timeline.push({ t: faDateTime(), by: curSession().name, tx: '🗑 حذف رویداد ارسال/تحویل ' + eventCd + ' — دلیل: ' + reason });
    sfSave(list);
    var recalc = sfRfqRecomputeAfterEvidenceChange(r, 'حذف ' + eventCd + ': ' + reason);
    var afterStage = sfStageOf(r);
    try { audit('پرونده‌های فروش', 'حذف کنترل‌شده مدرک ارسال/تحویل ' + eventCd + ' — مرحله ' + beforeStage + ' ← ' + afterStage + ' — ' + reason, cd); } catch (e) {}
    if (typeof renderDeals === 'function') renderDeals();
    if (typeof ptfToast === 'function') ptfToast(afterStage < beforeStage ? 'مدرک حذف شد؛ پرونده به مرحله معتبر ' + afterStage + ' بازگشت.' : (recalc.preservedByLaterEvidence ? 'مدرک حذف شد؛ به دلیل تکمیل مرحله بعدی، مرحله پرونده حفظ شد.' : 'مدرک حذف شد و مرحله دوباره محاسبه شد.'), 'warn');
    return { event: ev, beforeStage: beforeStage, afterStage: afterStage, recalc: recalc };
  };

  window.sfShipDelete = function (cd, eventCd) {
    var reason = prompt('دلیل حذف این رویداد/مدرک را وارد کنید (برای سابقه حسابرسی الزامی است):', 'ثبت یا مدرک اشتباه');
    if (reason === null) return;
    reason = reason.trim(); if (!reason) { alert('دلیل حذف الزامی است.'); return; }
    var r = sfAll().filter(function (x) { return x.cd === cd; })[0];
    var ev = r && (r.shipEvents || []).filter(function (x) { return x.cd === eventCd; })[0];
    if (!ev) return;
    var keys = (ev.files || []).map(function (f) { return f.key; }).filter(Boolean);
    sfDeleteCloudThen(keys, function () { sfShipDeleteCommit(cd, eventCd, reason); });
  };

  window.sfShipOpen = function (cd, typeId, eventCd) {
    var r = sfAll().filter(function (x) { return x.cd === cd; })[0];
    if (!r) return;
    var current = eventCd ? (r.shipEvents || []).filter(function (x) { return x.cd === eventCd; })[0] : null;
    if (current) typeId = current.type;
    var tp = SF_SHIP_TYPES.filter(function (x) { return x.id === typeId; })[0] || SF_SHIP_TYPES[0];
    var flds = [];
    if (typeId === 'packing') flds = [
      { id: 'no', label: 'شماره پکینگ لیست', type: 'text', dir: 'ltr', placeholder: 'PL-1405-001', value: current ? current.no || '' : '' },
      { id: 'dateISO', label: 'تاریخ پکینگ (میلادی)', type: 'date', dir: 'ltr', value: current ? current.dateISO || '' : '' },
      { id: 'note', label: 'شرح بسته‌بندی / تعداد نگله', type: 'textarea', rows: 2, required: true, placeholder: 'مثلا: ۳ پالت چوبی — ۴۵۰ کیلوگرم', value: current ? current.note || '' : '' }
    ];
    else if (typeId === 'shipdoc') flds = [
      { id: 'no', label: 'شماره بارنامه / بیجک', type: 'text', dir: 'ltr', required: true, value: current ? current.no || '' : '' },
      { id: 'carrier', label: 'شرکت حمل / راننده', type: 'text', required: true, value: current ? current.carrier || '' : '' },
      { id: 'dateISO', label: 'تاریخ ارسال (میلادی)', type: 'date', dir: 'ltr', value: current ? current.dateISO || '' : '' },
      { id: 'note', label: 'توضیح (اختیاری)', type: 'textarea', rows: 2, value: current ? current.note || '' : '' }
    ];
    else flds = [
      { id: 'receiver', label: 'نام تحویل‌گیرنده کارفرما', type: 'text', required: true, value: current ? current.receiver || '' : '' },
      { id: 'dateISO', label: 'تاریخ تحویل (میلادی)', type: 'date', dir: 'ltr', value: current ? current.dateISO || '' : '' },
      { id: 'note', label: 'توضیح / شماره رسید تحویل (اختیاری)', type: 'textarea', rows: 2, value: current ? current.note || '' : '' }
    ];
    ptfDialog({
      title: (current ? '✏️ اصلاح ' : '') + tp.lb + ' — ' + (r.inqNo || cd),
      body: current
        ? 'اصلاح با نگهداری تصویر قبل/بعد در سابقه پرونده انجام می‌شود. مرحله پرونده پس از ذخیره دوباره از شواهد واقعی محاسبه می‌شود.'
        : (typeId === 'delivered' ? 'با ثبت تحویل، وضعیت درخواست به «✅ تحویل شده» می‌رود و مرحله پرونده «تحویل‌شده به کارفرما» می‌شود — پیش‌نیاز ارجاع فاکتور.' : 'سند در پرونده ثبت و وضعیت درخواست (در صورت عقب‌تر بودن) به «🟠 آماده‌سازی» می‌رود.'),
      fields: flds,
      okText: current ? 'ذخیره اصلاح' : 'ثبت در پرونده',
      onOk: function (v) {
        if (current) { var ev = sfShipUpdate(cd, current.cd, v); }
        else { var ev = sfShipCommit(cd, typeId, v); }
        if (ev && ev.ok === false && ev.why === 'seq') { alert('⛔ نقض توالی رویدادها:\n' + ev.lb); return; }
        if (!ev) return;
        if (typeof ptfToast === 'function') ptfToast(tp.lb + (current ? ' اصلاح شد' : ' ثبت شد'), 'ok');
        if (!current && confirm('برای این رکورد، سند/اسکن پیوست می‌کنید؟') && typeof attachUploadWidget === 'function') sfShipUpload(cd, ev.cd);
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
      f._id = f._id || genCode('DOC');
      ev.files = ev.files || []; ev.files.push(f);
      r.docs = r.docs || [];
      if (f.key && !r.docs.some(function (d) { return d.key === f.key; })) r.docs.push({ _id: f._id, name: 'ارسال — ' + f.name, key: f.key, size: f.size || 0, t: faDate(), by: curSession().name, note: 'سند ارسال/تحویل', sourceKind: 'ship', sourceCd: shpCd });
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
      f._id = f._id || genCode('DOC');
      ev.files = ev.files || []; ev.files.push(f);
      r.docs = r.docs || [];
      if (f.key && !r.docs.some(function (d) { return d.key === f.key; })) r.docs.push({ _id: f._id, name: 'QC — ' + f.name, key: f.key, size: f.size || 0, t: faDate(), by: curSession().name, note: 'سند کنترل کیفیت/بازرسی', sourceKind: 'qc', sourceCd: qcCd });
      sfSave(list);
      if (typeof ptfToast === 'function') ptfToast('سند QC به پرونده پیوست شد', 'ok');
    });
  };

  function sfEventByKind(r, kind, eventCd) {
    var key = kind === 'ship' ? 'shipEvents' : 'qcEvents';
    return (r[key] || []).filter(function (x) { return x.cd === eventCd; })[0];
  }

  window.sfEventFileDeleteCommit = function (cd, kind, eventCd, fileIdx, reason) {
    var list = sfAll(); var r = list.filter(function (x) { return x.cd === cd; })[0];
    var ev = r && sfEventByKind(r, kind, eventCd); var f = ev && (ev.files || [])[fileIdx];
    if (!r || !ev || !f) return null;
    ev.files.splice(fileIdx, 1);
    r.docs = (r.docs || []).filter(function (d) { return !f.key || d.key !== f.key; });
    r.documentAudit = r.documentAudit || [];
    r.documentAudit.push({ t: faDateTime(), by: curSession().name, action: 'delete-file', kind: kind, ref: eventCd, reason: reason, before: JSON.parse(JSON.stringify(f)) });
    r.timeline = r.timeline || []; r.timeline.push({ t: faDateTime(), by: curSession().name, tx: '🗑 حذف فایل ' + (f.name || '') + ' از ' + eventCd + ' — ' + reason });
    sfSave(list);
    try { audit('پرونده‌های فروش', 'حذف فایل ' + (f.name || '') + ' از ' + eventCd + ' — ' + reason, cd); } catch (e) {}
    if (typeof renderDeals === 'function') renderDeals();
    return f;
  };

  window.sfEventFileDelete = function (cd, kind, eventCd, fileIdx) {
    var reason = prompt('دلیل حذف فایل را وارد کنید (الزامی):', 'فایل اشتباه');
    if (reason === null) return;
    reason = reason.trim(); if (!reason) { alert('دلیل حذف الزامی است.'); return; }
    var r = sfAll().filter(function (x) { return x.cd === cd; })[0];
    var ev = r && sfEventByKind(r, kind, eventCd); var f = ev && (ev.files || [])[fileIdx];
    if (!f) return;
    sfDeleteCloudThen([f.key], function () { sfEventFileDeleteCommit(cd, kind, eventCd, fileIdx, reason); });
  };

  window.sfEventFileReplace = function (cd, kind, eventCd, fileIdx) {
    if (typeof attachUploadWidget !== 'function') return;
    var folder = kind === 'ship' ? 'salesfiles-ship/' + cd : 'salesfiles-qc/' + cd;
    var html = '<div class="md-b" id="sfReplaceDlg" style="display:grid;z-index:2700" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:460px"><h3>♻️ جایگزینی نسخه مدرک</h3><p style="font-size:12px;color:#475569">نسخه قبلی در سابقه حسابرسی ثبت و فایل فعال با نسخه جدید جایگزین می‌شود.</p><div id="sfReplaceUp"></div><div style="text-align:left;margin-top:10px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">انصراف</button></div></div></div>';
    (document.getElementById('panels') || document.body).insertAdjacentHTML('beforeend', html);
    attachUploadWidget('sfReplaceUp', folder, function (newFile) {
      var list = sfAll(); var r = list.filter(function (x) { return x.cd === cd; })[0];
      var ev = r && sfEventByKind(r, kind, eventCd); var oldFile = ev && (ev.files || [])[fileIdx];
      if (!r || !ev || !oldFile) { sfDeleteCloud([newFile.key]); return; }
      newFile._id = genCode('DOC'); newFile.version = (+oldFile.version || 1) + 1; newFile.replaces = oldFile._id || oldFile.key || '';
      ev.files[fileIdx] = newFile;
      (r.docs || []).forEach(function (d) { if (oldFile.key && d.key === oldFile.key) { d.key = newFile.key; d.name = (kind === 'ship' ? 'ارسال — ' : 'QC — ') + newFile.name; d.size = newFile.size || 0; d._id = newFile._id; d.version = newFile.version; } });
      r.documentAudit = r.documentAudit || [];
      r.documentAudit.push({ t: faDateTime(), by: curSession().name, action: 'replace-file', kind: kind, ref: eventCd, before: JSON.parse(JSON.stringify(oldFile)), after: JSON.parse(JSON.stringify(newFile)) });
      r.timeline = r.timeline || []; r.timeline.push({ t: faDateTime(), by: curSession().name, tx: '♻️ جایگزینی فایل ' + (oldFile.name || '') + ' در ' + eventCd });
      sfSave(list);
      sfDeleteCloud([oldFile.key]).then(function (results) {
        var cleaned = !(results || []).some(function (x) { return !x || x.ok === false; });
        if (typeof ptfToast === 'function') ptfToast(cleaned ? 'نسخه مدرک جایگزین و فایل قدیمی پاک شد' : '⚠️ نسخه جدید فعال شد؛ پاک‌سازی فایل قدیمی نیاز به بررسی دارد.', cleaned ? 'ok' : 'warn');
      });
      var dlg = document.getElementById('sfReplaceDlg'); if (dlg) dlg.remove();
      try { audit('پرونده‌های فروش', 'جایگزینی نسخه مدرک ' + eventCd + ': ' + (oldFile.name || '') + ' ← ' + (newFile.name || ''), cd); } catch (e) {}
      if (typeof renderDeals === 'function') renderDeals();
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
      var nDocs = d.offers.length + d.letters.length + d.invoices.length + d.misc.length + (d.supply || []).length + (r.shipEvents || []).length + (r.qcEvents || []).length; /* رویداد تخصصی یک‌بار شمرده می‌شود */
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
      h += '<div id="sfDeal-' + escP(r.cd) + '" data-ptf-nav="deal:' + escP(r.cd) + '" style="background:var(--crd,#fff);border:1px solid var(--brd);border-radius:14px;margin-bottom:8px;overflow:hidden' + (dueSt === 'red' ? ';border-color:#fca5a5' : '') + '">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:12px 14px;cursor:pointer;flex-wrap:wrap' + (dueSt === 'red' ? ';background:#fef2f2' : dueSt === 'orange' ? ';background:#fffbeb' : '') + '" onclick="sfToggle(\'' + ptfOnClickArg(r.cd) + '\')">' +
        '<div style="font-size:13px"><b dir="ltr">' + escP(inqKey) + '</b> — ' + escP(r.buyerCo || '-') +
        '<div style="font-size:11px;color:#64748b;margin-top:2px">' + nDocs + ' سند منضم | ایجاد: ' + escP(r.t || '') + stgBadge + (hasInv ? ' | <span style="color:#059669">🧾 فاکتور ثبت شده</span>' : '') + dueBadge + (lossBadge ? ' | ' + lossBadge : '') + '</div></div>' +
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
    var advTxt = 'هنوز دریافت قطعی ثبت نشده', advState = '#b45309';
    try {
      /* v35: فقط Receipt قطعیِ متصل به شناسه پرونده؛ advance پیشنهاد منبع پول نیست. */
      var _caseId = String(r._id || r.cd || '');
      var _receipts = (getData('ptf_crm_case_receipts') || []).filter(function (x) {
        return x && x.caseId === _caseId && x.status === 'posted' && !x.voided;
      });
      var recv = _receipts.reduce(function (s, x) { return s + (+x.amountIRR || +x.amt || 0); }, 0);
      var credit = _receipts.reduce(function (s, x) { return s + (+x.creditRemainIRR || 0); }, 0);
      if (recv > 0) {
        advTxt = recv.toLocaleString('fa-IR') + ' ریال دریافت قطعی' + (credit > 0 ? ' — بستانکاری: ' + credit.toLocaleString('fa-IR') : '');
        advState = '#059669';
      }
    } catch (e) {}
    var rb = (typeof ptfRealBuyStatus === 'function') ? ptfRealBuyStatus(r.inqNo) : { total: 0, done: 0, has: false };
    var costSum = (r.costEvents || []).filter(function (x) {
      return !(x && (x.fromAdvance || x.cat === 'advance' || /پیش.?پرداخت|prepay|advance/.test(String(x.desc || x.cat || ''))));
    }).reduce(function (s, x) { return s + (+x.amt || 0); }, 0);
    var invCount = (d.invoices || []).length;
    var openAmt = (d.invoices || []).reduce(function (s, i) {
      var paid = (window.PTF && PTF.invPaidSum) ? PTF.invPaidSum(i) : ((i.payments || []).concat(i.pays || [])).reduce(function (z, p) { return z + (+p.amt || 0); }, 0);
      return s + Math.max(0, (+i.amount || 0) - paid);
    }, 0);
    var au = (typeof sfCloseAudit === 'function') ? sfCloseAudit(r) : { blockers: [], warns: [] };
    var ready = !au.blockers.length && openAmt <= 0.5;
    return '<div style="background:#f8fafc;border:1px solid var(--brd);border-radius:12px;padding:10px 12px;margin:8px 0 10px;font-size:12px">' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
      '<span style="background:#fff;border:1px solid #dbeafe;border-radius:8px;padding:4px 8px;color:' + advState + '">💰 دریافت قطعی مشتری: <b>' + escP(advTxt) + '</b></span>' +
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
      var offerLocked = o.no === r.wonOffer || o.st === 'won';
      h += row('📄', '<b dir="ltr">' + escP(o.no) + '</b> — ' + (KINDS[o.kind] || o.kind) + ((typeof window.ptfRialCompanionBadge === 'function') ? ' ' + window.ptfRialCompanionBadge(o) : '') + (o.rev ? ' <span style="color:#7c3aed">(آخرین رویژن: Rev.' + o.rev + ')</span>' : '') + ' — ' + escP(o.dt || o.dateFa || '') + (offerLocked ? ' <small style="color:#92400e">🔒 سند قطعی برد</small>' : ''),
        '<button class="bt bt-o" style="padding:3px 9px;font-size:11.5px" onclick="event.stopPropagation();offerQuickPreview(\'' + ptfOnClickArg(o.no) + '\')">👁</button> ' +
        (offerLocked ? '<span title="سند قطعی برد تغییرناپذیر است؛ اصلاح تجاری با رویژن/متمم انجام می‌شود" style="font-size:10.5px;color:#92400e">اصلاح با رویژن/متمم</span>' : '<button class="bt bt-o" style="padding:3px 9px;font-size:11.5px;color:#0e7490" onclick="event.stopPropagation();offerEdit(\'' + ptfOnClickArg(o.no) + '\')">✏️ اصلاح</button> <button class="bt bt-o" style="padding:3px 9px;font-size:11.5px;color:#dc2626" onclick="event.stopPropagation();offerDel(\'' + ptfOnClickArg(o.no) + '\')">🗑 حذف</button>'));
    });
    /* v17.1 (US-404 فاز ۲): استعلام‌های تامین — رهگیری کشف قیمت داخل خود پرونده */
    (d.supply || []).forEach(function (q2) {
      var nT = (q2.targets || []).length;
      var nR = (q2.targets || []).filter(function (t2) { return t2.st === 'replied'; }).length;
      h += row('🤖', '<b dir="ltr">' + escP(q2.no) + '</b> — استعلام تامین (' + (q2.items || []).length + ' قلم | ' + nT + ' تامین‌کننده | ' + nR + ' پاسخ)',
        '<button class="bt bt-o" style="padding:3px 9px;font-size:11.5px" onclick="event.stopPropagation();if(typeof rfqsOpen===\'function\')rfqsOpen(\'' + ptfOnClickArg(q2.no) + '\')">👁 مشاهده / اصلاح</button> <button class="bt bt-o" style="padding:3px 9px;font-size:11.5px;color:#dc2626" onclick="event.stopPropagation();if(typeof rfqsDel===\'function\')rfqsDel(\'' + ptfOnClickArg(q2.no) + '\')">🗑 حذف</button>');
    });
    d.letters.forEach(function (l) {
      var letterEdit = (l.kind === 'OUT' && (l.st === 'draft' || l.st === 'rejected')) ? '<button class="bt bt-o" style="padding:3px 9px;font-size:11.5px;color:#0e7490" onclick="event.stopPropagation();showLetterModal(\'' + ptfOnClickArg(l.cd) + '\')">✏️ اصلاح</button> ' : '';
      h += row('✉️', escP(l.no || l.cd) + ' — ' + escP(l.subject || '-') + ' <small style="color:#64748b">(' + escP(l.st || '') + ')</small>',
        (l.st === 'signed' ? '<button class="bt bt-o" style="padding:3px 9px;font-size:11.5px;color:#059669" onclick="event.stopPropagation();letPrint(\'' + ptfOnClickArg(l.cd) + '\',false,true)">با امضا</button> <button class="bt bt-o" style="padding:3px 9px;font-size:11.5px;color:#7c3aed" onclick="event.stopPropagation();letPrint(\'' + ptfOnClickArg(l.cd) + '\',false,false)">بدون امضا</button> ' : (l.st === 'registered' ? '<button class="bt bt-o" style="padding:3px 9px;font-size:11.5px" onclick="event.stopPropagation();letPrint(\'' + ptfOnClickArg(l.cd) + '\',false,false)">👁</button> ' : '')) + letterEdit + '<button class="bt bt-o" style="padding:3px 9px;font-size:11.5px;color:#dc2626" onclick="event.stopPropagation();letDel(\'' + ptfOnClickArg(l.cd) + '\')">🗑 حذف</button>');
    });
    d.invoices.forEach(function (i) {
      var act = '';
      if (i.isUnofficial) {
        // ARENA-2026-08-17 / گام ۱ (فاز ابطال ریشه‌کن): ابطال غیررسمی از مسیر ریشه‌کن جدید (نه مسیر سرور-محور رسمی).
        act = '<button class="bt bt-o" style="padding:2px 7px;font-size:11px;color:#d97706;border-color:#f59e0b" onclick="event.stopPropagation();unofficialInvoicePrint(\'' + ptfOnClickArg(i.offerNo) + '\')">👁 نمایش/چاپ</button> <button class="bt bt-o" style="padding:2px 7px;font-size:11px;color:#0e7490" onclick="event.stopPropagation();sfUnofficialInvoiceNew(\'' + ptfOnClickArg(r._id || r.cd) + '\')">✏️ اصلاح</button> <button class="bt bt-o" style="padding:2px 7px;font-size:11px;color:#dc2626" onclick="event.stopPropagation();ptfUnofficialInvoiceVoid(\'' + ptfOnClickArg(i._id || i.cd) + '\')">🗑 ابطال ریشه‌کن</button>';
      } else {
        act = (i.files || []).map(function (f) { return '<a href="javascript:void(0)" onclick="event.stopPropagation();openStoredFile(\'' + ptfOnClickArg(f.key || '') + '\')" style="color:#0e7490;font-size:11.5px">📎' + escP(f.name) + '</a>'; }).join(' ') + ' <button class="bt bt-o" style="padding:2px 7px;font-size:11px;color:#0e7490" onclick="event.stopPropagation();showInvModal(\'' + ptfOnClickArg(i.offerNo) + '\',\'' + ptfOnClickArg(i._id || i.cd) + '\')">✏️ اصلاح سندی</button> <button class="bt bt-o" style="padding:2px 7px;font-size:11px;color:#dc2626" onclick="event.stopPropagation();ptfInvoiceVoid(\'' + ptfOnClickArg(i._id || i.cd) + '\')">🗑 ابطال کنترل‌شده</button><small style="display:block;color:#64748b">ضمیمه رسمی حذف مستقل ندارد؛ فقط جایگزینی نسخه‌دار در اصلاح فاکتور.</small>';
      }
      h += row('🧾', (i.isUnofficial ? 'فاکتور غیررسمی ' : 'فاکتور ') + escP(i.no) + ' — ' + (+i.amount).toLocaleString('fa-IR') + ' ریال — ' + escP(i.t || ''), act);
    });
    d.misc.forEach(function (m, mi) {
      var sourceMi = (r.docs || []).indexOf(m); if (sourceMi < 0) sourceMi = mi;
      h += row('📎', escP(m.name || '-') + ' <small style="color:#94a3b8">(' + escP(m.t || '') + ' — ' + escP(m.by || '') + ')</small>',
        (m.key ? '<a href="javascript:void(0)" onclick="event.stopPropagation();openStoredFile(\'' + ptfOnClickArg(m.key) + '\')" style="color:#0e7490;font-size:11.5px">مشاهده</a> ' : '') +
        '<button class="bt bt-o" style="padding:2px 7px;font-size:11px;color:#0e7490" onclick="event.stopPropagation();sfEditMisc(\'' + ptfOnClickArg(r.cd) + '\',' + sourceMi + ')">✏️ نام/شرح</button> ' +
        '<button class="bt bt-o" style="padding:2px 7px;font-size:11px;color:#7c3aed" onclick="event.stopPropagation();sfReplaceMisc(\'' + ptfOnClickArg(r.cd) + '\',' + sourceMi + ')">♻️ جایگزینی</button> ' +
        '<button class="bt bt-o" style="padding:2px 7px;font-size:11px;color:#dc2626" onclick="event.stopPropagation();sfDelMisc(\'' + ptfOnClickArg(r.cd) + '\',' + sourceMi + ')">✕ حذف</button>');
    });
    if (!d.offers.length && !d.letters.length && !d.invoices.length && !d.misc.length && !(d.supply || []).length)
      h += '<div style="color:#94a3b8;font-size:12px;padding:8px 0">سندی منضم نشده</div>';
    /* v19.2: استپر مراحل ۱۲گانه پرونده — فقط نمایش؛ منبع واحد sfStageOf */
    if (r.wonOffer && typeof sfStageOf === 'function') {
      var _stg = sfStageOf(r);
      var _guide = typeof sfStageGuidance === 'function' ? sfStageGuidance(r) : null;
      var _nextLb = _guide && _guide.next ? ((window.PTF_SF_STAGES || []).filter(function (x) { return x.id === _guide.next; })[0] || {}).lb : '';
      h += '<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:10px 12px;margin-top:10px;font-size:11.5px" onclick="event.stopPropagation()"><b style="font-size:12.5px">🧭 مرحله پرونده: ' + escP(sfStageLabel(r)) + ' <small style="color:#64748b">(' + _stg + ' از 12)</small></b>' +
        '<div style="display:flex;gap:3px;flex-wrap:wrap;margin-top:6px">' +
        (window.PTF_SF_STAGES || []).map(function (stg) {
          var on = stg.id <= _stg;
          return '<span title="' + escP(stg.lb) + '" style="flex:1;min-width:26px;text-align:center;border-radius:6px;padding:3px 2px;font-size:10px;font-weight:800;' + (stg.id === _stg ? 'background:#0e7490;color:#fff' : on ? 'background:#cffafe;color:#155e75' : 'background:#f1f5f9;color:#94a3b8') + '">' + stg.id + '</span>';
        }).join('') + '</div>' +
        (_guide ? '<div style="background:#fff;border:1px solid #7dd3fc;border-radius:10px;padding:8px 10px;margin-top:8px;color:#0c4a6e"><b>🎯 کار لازم برای مرحله بعد' + (_nextLb ? ' — ' + escP(_nextLb) : '') + ':</b><div style="margin-top:3px;font-size:12px">' + escP(_guide.task) + '</div>' + (_guide.evidence ? '<small style="display:block;margin-top:3px;color:#64748b">شاهد لازم: ' + escP(_guide.evidence) + '</small>' : '') + (_guide.button && _guide.onclick ? '<button class="bt" style="margin-top:7px;padding:5px 11px;font-size:11.5px" onclick="event.stopPropagation();' + _guide.onclick + '">' + _guide.button + '</button>' : '') + '</div>' : '') +
        '<div style="color:#64748b;margin-top:6px">مرحله از شواهد واقعی محاسبه می‌شود. اصلاح/حذف شاهد، مرحله را دوباره محاسبه می‌کند؛ وجود شاهد تکمیل‌شدهٔ بعدی مانع عقب‌گرد است.</div></div>';
    }
    /* v19.2 (US-434 فاز ۲): سوابق ارسال/تحویل */
    if (r.shipEvents && r.shipEvents.length) {
      h += '<div style="background:#fef9c3;border:1px solid #fde047;border-radius:12px;padding:8px 12px;margin-top:8px;font-size:12.5px" onclick="event.stopPropagation()"><b>🚚 ارسال و تحویل</b>';
      r.shipEvents.forEach(function (se) {
        var tpS = (window.SF_SHIP_TYPES || []).filter(function (x) { return x.id === se.type; })[0] || {};
        var shipFiles = (se.files || []).map(function (f, fi) { return f.key ? '<span style="display:inline-flex;align-items:center;gap:3px;margin:2px 3px"><a href="javascript:void(0)" onclick="openStoredFile(\'' + ptfOnClickArg(f.key) + '\')" style="color:#0e7490;font-size:11.5px">📎' + escP(f.name) + (f.version > 1 ? ' (نسخه ' + f.version + ')' : '') + '</a><button class="bt bt-o" style="padding:1px 5px;font-size:10px;color:#7c3aed" onclick="sfEventFileReplace(\'' + ptfOnClickArg(r.cd) + '\',\'ship\',\'' + ptfOnClickArg(se.cd) + '\',' + fi + ')">♻️</button><button class="bt bt-o" style="padding:1px 5px;font-size:10px;color:#dc2626" onclick="sfEventFileDelete(\'' + ptfOnClickArg(r.cd) + '\',\'ship\',\'' + ptfOnClickArg(se.cd) + '\',' + fi + ')">✕</button></span>' : ''; }).join('');
        h += '<div style="padding:6px 0;border-top:1px dashed #fde047"><div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;flex-wrap:wrap"><span>' + (tpS.lb || se.type) + (se.no ? ' — <b dir="ltr">' + escP(se.no) + '</b>' : '') + (se.carrier ? ' — ' + escP(se.carrier) : '') + (se.receiver ? ' — تحویل‌گیرنده: <b>' + escP(se.receiver) + '</b>' : '') + (se.dateISO ? ' — <span dir="ltr">' + escP(se.dateISO) + '</span>' : '') + (se.note ? ' — ' + escP(se.note) : '') +
          ' <small style="color:#94a3b8">(' + escP(se.t || '') + ' — ' + escP(se.by || '') + ')</small></span><span style="white-space:nowrap"><button class="bt bt-o" style="padding:2px 7px;font-size:10.5px;color:#0e7490" onclick="sfShipOpen(\'' + ptfOnClickArg(r.cd) + '\',\'' + ptfOnClickArg(se.type) + '\',\'' + ptfOnClickArg(se.cd) + '\')">✏️ اصلاح</button> <button class="bt bt-o" style="padding:2px 7px;font-size:10.5px;color:#7c3aed" onclick="sfShipUpload(\'' + ptfOnClickArg(r.cd) + '\',\'' + ptfOnClickArg(se.cd) + '\')">📎 افزودن فایل</button> <button class="bt bt-o" style="padding:2px 7px;font-size:10.5px;color:#dc2626" onclick="sfShipDelete(\'' + ptfOnClickArg(r.cd) + '\',\'' + ptfOnClickArg(se.cd) + '\')">🗑 حذف رویداد</button></span></div>' +
          (shipFiles ? '<div style="margin-top:4px">' + shipFiles + '</div>' : '<small style="color:#94a3b8">بدون فایل پیوست</small>') + '</div>';
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
        var qcFiles = (qe.files || []).map(function (f, fi) { return f.key ? '<span style="display:inline-flex;align-items:center;gap:3px;margin:2px 3px"><a href="javascript:void(0)" onclick="openStoredFile(\'' + ptfOnClickArg(f.key) + '\')" style="color:#0e7490;font-size:11.5px">📎' + escP(f.name) + (f.version > 1 ? ' (نسخه ' + f.version + ')' : '') + '</a><button class="bt bt-o" style="padding:1px 5px;font-size:10px;color:#7c3aed" onclick="sfEventFileReplace(\'' + ptfOnClickArg(r.cd) + '\',\'qc\',\'' + ptfOnClickArg(qe.cd) + '\',' + fi + ')">♻️</button><button class="bt bt-o" style="padding:1px 5px;font-size:10px;color:#dc2626" onclick="sfEventFileDelete(\'' + ptfOnClickArg(r.cd) + '\',\'qc\',\'' + ptfOnClickArg(qe.cd) + '\',' + fi + ')">✕</button></span>' : ''; }).join('');
        h += '<div style="padding:6px 0;border-top:1px dashed #99f6e4' + (qe.conf === 'nonconform' ? ';color:#b91c1c' : '') + '"><div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;flex-wrap:wrap"><span>' + (tpQ.lb || qe.type) + ' — <b>' + (cfQ.lb || qe.conf) + '</b> — ' + escP(qe.desc || '') +
          ' <small style="color:#94a3b8">(' + escP(qe.t || '') + ' — ' + escP(qe.by || '') + ')</small></span><span style="white-space:nowrap"><button class="bt bt-o" style="padding:2px 7px;font-size:10.5px;color:#0e7490" onclick="sfQcOpen(\'' + ptfOnClickArg(r.cd) + '\',\'' + ptfOnClickArg(qe.cd) + '\')">✏️ اصلاح</button> <button class="bt bt-o" style="padding:2px 7px;font-size:10.5px;color:#7c3aed" onclick="sfQcUpload(\'' + ptfOnClickArg(r.cd) + '\',\'' + ptfOnClickArg(qe.cd) + '\')">📎 افزودن فایل</button> <button class="bt bt-o" style="padding:2px 7px;font-size:10.5px;color:#dc2626" onclick="sfQcDelete(\'' + ptfOnClickArg(r.cd) + '\',\'' + ptfOnClickArg(qe.cd) + '\')">🗑 حذف</button></span></div>' +
          (qcFiles ? '<div style="margin-top:4px">' + qcFiles + '</div>' : '<small style="color:#94a3b8">بدون فایل پیوست</small>') + '</div>';
      });
      h += '</div>';
    }
    /* v34.0.0-alpha (F4-5): نمایش متمایز هزینه‌های لینک‌شده از تنخواه
       - هزینهٔ مستقیم پرونده: دکمه‌های ✏️📎🗑 (همان قبل)
       - هزینهٔ لینک‌شده از تنخواه (fromPetty): فقط دکمهٔ 🏦 (رفتن به تنخواه) + 🗑 (حذف لینک) */
    /* سند هزینه لینک‌شده snapshot نیست: هر بار از رکورد زنده تنخواه خوانده می‌شود تا
       فایلی که بعداً در تنخواه افزوده/حذف شده فوراً در پرونده هم دیده شود. رکوردهای
       قدیمی دارای dealRef که costEvent آن‌ها جا افتاده نیز به‌صورت projection نمایش داده می‌شوند. */
    var pjPettyByCd = {}, pjPettyAll = getData('ptf_crm_petty') || [];
    pjPettyAll.forEach(function (p) { if (p && p.cd) pjPettyByCd[p.cd] = p; });
    var pjCostEvents = (r.costEvents || []).slice();
    pjPettyAll.forEach(function (p) {
      if (!p || p.st === 'void' || p.dealRef !== r.cd) return;
      if (pjCostEvents.some(function (ce) { return (ce.pettyCd || (ce.fromPetty && ce.cd)) === p.cd; })) return;
      pjCostEvents.push({ cd: p.cd, pettyCd: p.cd, fromPetty: true, amt: p.amt, desc: '[تنخواه] ' + (p.desc || p.cat || ''), t: p.t, by: p.by, files: [] });
    });
    var pjPettyLinkedCds = pjCostEvents.filter(function (x) { return x.pettyCd || x.fromPetty; }).map(function (x) { return x.pettyCd || x.cd; });
    /* v34.0.0-alpha (F4-5) FIX: هزینه‌های تنخواه لینک‌نشده به این پرونده
       = همهٔ هزینه‌های فعال (st !== 'void' && st !== 'settled'?) که dealRef خالی/متفاوت دارند
       و هنوز در costEvents این پرونده نیستند.
       الگو از petty.js#ptfPettyRelatedCosts گرفته شده ولی فیلتر معکوس شده. */
    var pjPettyUnlinkedAvailable = pjPettyAll.filter(function (p) {
      if (p.st === 'void') return false;
      /* هزینه‌ای که dealRef دارد (به هر پرونده‌ای) → لینک‌شده → از لیست حذف */
      if (p.dealRef) return false;
      /* هزینه‌ای که قبلاً در costEvents این پرونده ثبت شده → تکراری نشود */
      return pjPettyLinkedCds.indexOf(p.cd) === -1;
    });
    h += '<div style="background:#fff7ed;border:1px solid #fdba74;border-radius:12px;padding:8px 12px;margin-top:8px;font-size:12.5px" onclick="event.stopPropagation()"><b>➕ هزینه‌های مستقیم پرونده</b>' +
      (pjCostEvents.length
        ? (pjCostEvents.map(function (ce) {
            var isPetty = ce.pettyCd || ce.fromPetty;
            var pettyCd = ce.pettyCd || ce.cd;
            var livePetty = isPetty ? pjPettyByCd[pettyCd] : null;
            var fileRows = livePetty && typeof window.ptfPettyRecordFiles === 'function' ? window.ptfPettyRecordFiles(livePetty) : ((livePetty && livePetty.files) || ce.files || []);
            var files = fileRows.map(function (f) {
              if (f.key) return '<a href="javascript:void(0)" onclick="openStoredFile(\'' + ptfOnClickArg(f.key) + '\')" style="color:#0e7490;font-size:11.5px">📎' + escP(f.name || 'سند') + '</a>';
              if (f.url && typeof window.ptfPettyOpenLegacyUrl === 'function') return '<a href="javascript:void(0)" onclick="ptfPettyOpenLegacyUrl(\'' + ptfOnClickArg(f.url) + '\')" style="color:#0e7490;font-size:11.5px">📎' + escP(f.name || 'سند قدیمی') + '</a>';
              return '';
            }).filter(Boolean).join(' ');
            var viewAmt = +(livePetty ? livePetty.amt : ce.amt) || 0;
            var viewDesc = livePetty ? ('[تنخواه] ' + (livePetty.desc || livePetty.cat || '')) : (ce.desc || '');
            var viewT = livePetty ? (livePetty.t || ce.t || '') : (ce.t || '');
            var viewBy = livePetty ? (livePetty.by || ce.by || '') : (ce.by || '');
            var tagBtn = isPetty ? '<span style="background:#dbeafe;color:#1e40af;padding:2px 7px;border-radius:6px;font-size:10.5px;margin-left:6px">🔗 از تنخواه</span>' : '';
            /* هزینهٔ مستقیم: ✏️📎🗑 / هزینهٔ تنخواه: 🏦 (رفتن به ماژول تنخواه) + 🗑 (حذف لینک) */
            var actions = isPetty
              ? '<button class="bt bt-o" style="padding:3px 8px;font-size:11px;color:#0d9488" onclick="ptfDealGoPetty(\'' + ptfOnClickArg(pettyCd) + '\')" title="مشاهده در ماژول تنخواه">🏦</button> <button class="bt bt-o" style="padding:3px 8px;font-size:11px;color:#7c3aed" onclick="if(typeof ptfPettyFilesUi===\'function\')ptfPettyFilesUi(\'' + ptfOnClickArg(pettyCd) + '\')" title="مشاهده/افزودن اسناد زنده تنخواه">📎 اسناد (' + fileRows.length + ')</button> <button class="bt bt-o" style="padding:3px 8px;font-size:11px;color:#dc2626" onclick="ptfDealRemoveCost(\'' + ptfOnClickArg(r.cd) + '\',\'' + ptfOnClickArg(ce.cd) + '\',\'' + ptfOnClickArg(pettyCd) + '\')" title="حذف لینک از تنخواه">🗑️</button>'
              : '<button class="bt bt-o" style="padding:3px 8px;font-size:11px;color:#0e7490" onclick="ptfProjectCostOpen(\'' + ptfOnClickArg(r.inqNo || '') + '\',\'' + ptfOnClickArg(ce.cd) + '\')">✏️ اصلاح</button> <button class="bt bt-o" style="padding:3px 8px;font-size:11px;color:#7c3aed" onclick="ptfProjectCostUpload(\'' + ptfOnClickArg(r.cd) + '\',\'' + ptfOnClickArg(ce.cd) + '\')">📎</button> <button class="bt bt-o" style="padding:3px 8px;font-size:11px;color:#dc2626" onclick="ptfDealRemoveCost(\'' + ptfOnClickArg(r.cd) + '\',\'' + ptfOnClickArg(ce.cd) + '\',\'' + ptfOnClickArg(ce.pettyCd || '') + '\')" title="حذف هزینه">🗑️</button>';
            return '<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-top:1px dashed #fdba74;flex-wrap:wrap;align-items:center"><span><b>' + viewAmt.toLocaleString('fa-IR') + ' ریال</b> ' + tagBtn + ' — ' + escP(viewDesc) + ' <small style="color:#94a3b8">(' + escP(viewT) + ' — ' + escP(viewBy) + ')</small>' + (files ? '<br><small>' + files + '</small>' : (isPetty ? '<br><small style="color:#94a3b8">هنوز سندی برای این هزینه ثبت نشده است.</small>' : '')) + '</span><span style="white-space:nowrap">' + actions + '</span></div>';
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
    /* v34.7.26 (S5 — یک اکشن = یک محل): «خرید واقعی» مالک واحد دارد = بلوک تخصصی
       «🛒 خرید واقعی اقلام» که buycompare.js داخل همین کشو تزریق می‌کند و علاوه بر دکمه،
       وضعیت اقلام و مبالغ را هم نشان می‌دهد. این کاشی فقط به‌عنوان fallback می‌ماند: اگر آن
       ماژول بارگذاری/هوک نشده باشد، کاربر بدون مسیر نماند.
       مرجع: ASSESSMENT-SALESFILE-3ISSUES-2026-08-17.md §۲-۳ (تصمیم کارفرما: بلوک‌های تخصصی مالک باشند) */
    if (r.wonOffer && r.inqNo && typeof ptfRealBuyOpen === 'function' && !window._rbDealsHooked) {
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
      /* v34.7.26 (S5): اسناد رسمی قالب شرکت (PL/IN/IB/MOM) مالک واحد دارند = بلوک
         «📄 اسناد رسمی قالب شرکت» (docsx.js) که هم ایجاد و هم نمایش/اصلاح را دارد.
         این دو کاشی فقط زمانی رندر می‌شوند که آن بلوک در دسترس نباشد (fallback). */
      if (!window._dxDealsHooked) {
        postActions += postAction(
          'inspection-note', '📄', 'نوت بازرسی', 'صدور یا مشاهده نوت بازرسی رسمی',
          'ptfDocxOpen(\'' + ptfOnClickArg(r.cd) + '\',\'IN\')', { meta: 'سند رسمی' }
        );
        postActions += postAction(
          'packing-list', '🧰', 'پکینگ‌لیست رسمی', 'صدور یا مشاهده پکینگ‌لیست رسمی',
          'ptfDocxOpen(\'' + ptfOnClickArg(r.cd) + '\',\'PL\')', { meta: 'سند رسمی' }
        );
      }
      postActions += postAction(
        'packing-event', '📦', 'رویداد پکینگ (گردش‌کار)', 'ثبت شماره/تاریخ پکینگ و پیوست مدرک در گردش پرونده — با «پکینگ‌لیست رسمی» که سند قالب شرکت است اشتباه نشود',
        'sfShipOpen(\'' + ptfOnClickArg(r.cd) + '\',\'packing\')', { meta: 'شاهد مرحله ارسال' }
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
    /* v35: دریافت و حساب مشتری فقط روی شناسهٔ پرونده انجام می‌شود؛ شمارهٔ پیشنهاد
       دیگر کلید اتصال مالی نیست. این action هاب یکپارچه دریافت/بستانکاری/فاکتور را باز می‌کند. */
    if (r.wonOffer) {
      postActions += postAction(
        'case-finance', '💳', 'دریافت و حساب پرونده', 'ثبت دریافت قطعی و مشاهده بستانکاری/مطالبات همین پرونده',
        'ptfCaseFinanceOpen(\'' + ptfOnClickArg(r._id || r.cd) + '\')', { primary: true, meta: 'خزانه و مشتری' }
      );
    }
    // ARENA-2026-08-17 / گام ۲: دکمهٔ صدور فاکتور غیررسمی (تک‌پیشنهاد + تجمیعی) — برای تمام پیشنهادهای متصل
    postActions += postAction(
      'unofficial-invoice', '🧾', 'صورتحساب غیررسمی',
      'صدور صورتحساب پرداخت غیررسمی برای هر پیشنهاد متصل (تک یا تجمیعی). پیش‌فرض قیمت = CO.',
      /* UI-01 (v34.7.20): شناسهٔ سروری پرونده اولویت دارد؛ گیرنده هر دو شناسه را می‌پذیرد. */
      'sfUnofficialInvoiceNew(\'' + ptfOnClickArg(r._id || r.cd) + '\')', { meta: 'پرونده' }
    );
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
    r.docs.push({ _id: f._id || genCode('DOC'), name: f.name, key: f.key || null, size: f.size || 0, t: faDate(), by: curSession().name, version: 1 });
    r.timeline = r.timeline || []; r.timeline.push({ t: faDateTime(), by: curSession().name, tx: '📎 افزودن سند متفرقه ' + (f.name || '') });
    sfSave(list);
    try { audit('پرونده‌های فروش', 'افزودن سند به پرونده ' + (r.inqNo || cd) + ': ' + f.name, cd); } catch (e) {}
    renderDeals();
  };

  window.sfEditMisc = function (cd, mi) {
    var r = sfAll().filter(function (x) { return x.cd === cd; })[0];
    var doc = r && (r.docs || [])[mi]; if (!doc) return;
    ptfDialog({
      title: '✏️ اصلاح مشخصات سند — ' + (r.inqNo || cd),
      body: 'فایل تغییر نمی‌کند؛ برای تغییر فایل از «جایگزینی» استفاده کنید. تصویر قبل/بعد در سابقه پرونده می‌ماند.',
      fields: [
        { id: 'name', label: 'نام سند', type: 'text', required: true, value: doc.name || '' },
        { id: 'note', label: 'شرح', type: 'textarea', rows: 2, value: doc.note || '' }
      ],
      okText: 'ذخیره اصلاح',
      onOk: function (v) {
        var list = sfAll(); var rr = list.filter(function (x) { return x.cd === cd; })[0]; var d = rr && (rr.docs || [])[mi]; if (!d) return;
        var before = JSON.parse(JSON.stringify(d)); d.name = (v.name || '').trim(); d.note = (v.note || '').trim(); d.updatedAt = faDateTime(); d.updatedBy = curSession().name;
        rr.documentAudit = rr.documentAudit || []; rr.documentAudit.push({ t: faDateTime(), by: curSession().name, action: 'edit', kind: 'misc', ref: d._id || d.key || '', before: before, after: JSON.parse(JSON.stringify(d)) });
        rr.timeline = rr.timeline || []; rr.timeline.push({ t: faDateTime(), by: curSession().name, tx: '✏️ اصلاح مشخصات سند ' + (d.name || '') });
        sfSave(list); try { audit('پرونده‌های فروش', 'اصلاح مشخصات سند ' + (d.name || '') + ' در پرونده ' + (rr.inqNo || cd), cd); } catch (e) {}
        if (typeof renderDeals === 'function') renderDeals();
      }
    });
  };

  window.sfReplaceMisc = function (cd, mi) {
    if (typeof attachUploadWidget !== 'function') return;
    var html = '<div class="md-b" id="sfMiscReplaceDlg" style="display:grid;z-index:2700" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:460px"><h3>♻️ جایگزینی سند پرونده</h3><p style="font-size:12px;color:#475569">نسخه قبلی در سابقه حسابرسی نگه‌داری و فایل فعال با نسخه جدید جایگزین می‌شود.</p><div id="sfMiscReplaceUp"></div><div style="text-align:left;margin-top:10px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">انصراف</button></div></div></div>';
    (document.getElementById('panels') || document.body).insertAdjacentHTML('beforeend', html);
    attachUploadWidget('sfMiscReplaceUp', 'salesfiles/' + cd, function (newFile) {
      var list = sfAll(); var r = list.filter(function (x) { return x.cd === cd; })[0]; var doc = r && (r.docs || [])[mi];
      if (!r || !doc) { sfDeleteCloud([newFile.key]); return; }
      var before = JSON.parse(JSON.stringify(doc)); var oldKey = doc.key || '';
      doc.key = newFile.key || null; doc.name = newFile.name || doc.name; doc.size = newFile.size || 0; doc._id = genCode('DOC'); doc.version = (+before.version || 1) + 1; doc.replaces = before._id || before.key || ''; doc.updatedAt = faDateTime(); doc.updatedBy = curSession().name;
      ['shipEvents', 'qcEvents', 'costEvents'].forEach(function (ek) { (r[ek] || []).forEach(function (ev) { (ev.files || []).forEach(function (f, fi) { if (oldKey && f.key === oldKey) ev.files[fi] = { _id: doc._id, key: doc.key, name: newFile.name, size: newFile.size || 0, version: doc.version, replaces: doc.replaces }; }); }); });
      r.documentAudit = r.documentAudit || []; r.documentAudit.push({ t: faDateTime(), by: curSession().name, action: 'replace-file', kind: 'misc', ref: doc._id, before: before, after: JSON.parse(JSON.stringify(doc)) });
      r.timeline = r.timeline || []; r.timeline.push({ t: faDateTime(), by: curSession().name, tx: '♻️ جایگزینی سند ' + (before.name || '') + ' با ' + (doc.name || '') });
      sfSave(list);
      sfDeleteCloud([oldKey]).then(function (results) {
        var cleaned = !(results || []).some(function (x) { return !x || x.ok === false; });
        if (typeof ptfToast === 'function') ptfToast(cleaned ? 'سند جایگزین و فایل قدیمی پاک شد' : '⚠️ سند جایگزین شد؛ پاک‌سازی فایل قدیمی نیاز به بررسی دارد.', cleaned ? 'ok' : 'warn');
      });
      var dlg = document.getElementById('sfMiscReplaceDlg'); if (dlg) dlg.remove();
      try { audit('پرونده‌های فروش', 'جایگزینی سند پرونده: ' + (before.name || '') + ' ← ' + (doc.name || ''), cd); } catch (e) {}
      if (typeof renderDeals === 'function') renderDeals();
    });
  };

  window.sfDelMiscCommit = function (cd, mi, reason) {
    var list = sfAll();
    var r = list.filter(function (x) { return x.cd === cd; })[0];
    if (!r || !r.docs || !r.docs[mi]) return null;
    var doc = r.docs.splice(mi, 1)[0];
    /* اگر این ردیف همان فایل نمایش‌داده‌شده زیر رویداد حمل/QC است، پیوند فعال آن
       نیز حذف می‌شود؛ خود رویداد (شاهد مرحله) فقط از دکمه «حذف رویداد» حذف می‌شود. */
    ['shipEvents', 'qcEvents', 'costEvents'].forEach(function (ek) { (r[ek] || []).forEach(function (ev) { ev.files = (ev.files || []).filter(function (f) { return !doc.key || f.key !== doc.key; }); }); });
    r.documentAudit = r.documentAudit || []; r.documentAudit.push({ t: faDateTime(), by: curSession().name, action: 'delete', kind: 'misc', ref: doc._id || doc.key || '', reason: reason, before: JSON.parse(JSON.stringify(doc)) });
    r.timeline = r.timeline || []; r.timeline.push({ t: faDateTime(), by: curSession().name, tx: '🗑 حذف سند ' + (doc.name || '') + ' — دلیل: ' + reason });
    sfSave(list);
    try { audit('پرونده‌های فروش', 'حذف کنترل‌شده سند ' + (doc.name || '') + ' — ' + reason, cd); } catch (e) {}
    renderDeals();
    return doc;
  };

  window.sfDelMisc = function (cd, mi) {
    var reason = prompt('دلیل حذف این سند را وارد کنید (برای سابقه حسابرسی الزامی است):', 'فایل یا مدرک اشتباه');
    if (reason === null) return;
    reason = reason.trim(); if (!reason) { alert('دلیل حذف الزامی است.'); return; }
    var r = sfAll().filter(function (x) { return x.cd === cd; })[0];
    var doc = r && (r.docs || [])[mi]; if (!doc) return;
    sfDeleteCloudThen([doc.key], function () { sfDelMiscCommit(cd, mi, reason); });
  };

  function sfDeleteCloud(keys) {
    keys = (keys || []).filter(Boolean);
    if (!keys.length) return Promise.resolve([]);
    var api = (typeof STORAGE_API !== 'undefined' ? STORAGE_API : '../api/storage.php');
    var headers = typeof ptfStorageAuthHeaders === 'function' ? ptfStorageAuthHeaders(true) : (function () { var h = { 'Content-Type': 'application/json' }; try { var t = localStorage.getItem('ptf_crm_token'); if (t) h['X-CRM-Token'] = t; } catch (e) {} return h; })();
    return Promise.all(keys.map(function (key) {
      return fetch(api + '?action=delete_case_document', { method: 'POST', headers: headers, body: JSON.stringify({ key: key }) })
        .then(function (r) { return r.text().then(function (txt) { var d = {}; try { d = JSON.parse(txt); } catch (e) {} if (!r.ok || !d.ok) throw new Error(d.error || ('HTTP ' + r.status)); return d; }); })
        .catch(function (err) { return { ok: false, key: key, error: err.message }; });
    }));
  }

  /* حذف امن: تا زمانی که فضای ابری حذف را تأیید نکرده، metadata و مرحله پرونده
     دست‌نخورده می‌ماند. برای فایل‌های بدون key عملیات محلی بلافاصله ادامه می‌یابد. */
  function sfDeleteCloudThen(keys, onOk) {
    sfDeleteCloud(keys).then(function (results) {
      var failed = (results || []).filter(function (x) { return !x || x.ok === false; });
      if (failed.length) {
        if (typeof ptfToast === 'function') ptfToast('⛔ حذف انجام نشد؛ فایل ابری در دسترس نبود و رکورد پرونده بدون تغییر ماند: ' + failed.map(function (x) { return x.key || ''; }).join('، '), 'err');
        return;
      }
      onOk();
    }).catch(function (err) {
      if (typeof ptfToast === 'function') ptfToast('⛔ حذف انجام نشد و رکورد پرونده بدون تغییر ماند: ' + err.message, 'err');
    });
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
      var paid = (window.PTF && PTF.invPaidSum) ? PTF.invPaidSum(i) : ((i.payments || []).concat(i.pays || [])).reduce(function (s2, pp) { return s2 + (+pp.amt || 0); }, 0);
      return i.amount - paid > 0.5;
    });
    out.remainSum = out.openInvs.reduce(function (s2, i) { var paid = (window.PTF && PTF.invPaidSum) ? PTF.invPaidSum(i) : ((i.payments || []).concat(i.pays || [])).reduce(function (s3, pp) { return s3 + (+pp.amt || 0); }, 0); return s2 + (i.amount - paid); }, 0);
    if (out.openInvs.length) out.warns.push({ id: 'recv', lb: '💰 ' + out.openInvs.length + ' فاکتور با مانده وصول‌نشده ' + out.remainSum.toLocaleString('fa-IR') + ' ریال — در گام بعد انتخاب می‌کنید: تسویه‌شده ثبت شود یا باز بماند' });
    /* ③ پوشش خرید واقعی پرونده */
    try {
      if (typeof ptfRealBuyStatus === 'function' && r.inqNo) {
        var rb = ptfRealBuyStatus(r.inqNo);
        if (rb.total && rb.full < rb.total) out.warns.push({ id: 'realbuy', lb: '🛒 خرید واقعی برای ' + rb.full + ' از ' + rb.total + ' قلم کامل است' + (rb.partial ? ' و ' + rb.partial + ' قلم ناقص است' : '') + '.' });
        else if (!rb.has) out.warns.push({ id: 'realbuy-none', lb: '🛒 هنوز هیچ خرید واقعی برای این پرونده ثبت نشده است.' });
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
        var paid = (window.PTF && PTF.invPaidSum) ? PTF.invPaidSum(iv) : ((iv.payments || []).concat(iv.pays || [])).reduce(function (s2, pp) { return s2 + (+pp.amt || 0); }, 0);
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
    if (window.PTF_SALES_DOMAIN_V2 && au.openInvs.length) { alert('⛔ پرونده دارای مطالبات باز است. معماری یکپارچه اجازه ساخت وصولی مصنوعی هنگام مختومه را نمی‌دهد؛ ابتدا دریافت واقعی را از «دریافت و حساب پرونده» ثبت کنید.'); return; }
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
    if (typeof window.ptfNavGoto === 'function') {
      window.ptfNavGoto('petty', { kind: 'petty', id: pettyCd, open: true });
      return;
    }
    try { if (typeof goPanel === 'function') goPanel('petty'); } catch (e) {}
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
      body: 'از لیست زیر، هزینهٔ تنخواه مورد نظر را انتخاب کنید. پس از تایید به هزینه‌های مستقیم همین پرونده اضافه می‌شود (بدون دوباره‌شماری با OPEX).',
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
