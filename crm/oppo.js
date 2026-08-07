/* =====================================================================
   PTF CRM — oppo.js — v31.7.97 — US-404 + BUG-OPPO-LOST-FINANCIAL-001
   لایه ۱: «🎯 فرصت‌های فعال» — درخواست‌های دارای پیشنهادِ هنوز برنده‌نشده.
   اصول (شرط کارفرما: بدون وصله‌پینه/چابکی/سهولت):
   - هیچ موجودیت داده جدیدی ندارد — نمای خواندنی روی rfqs/offers/deals/projects.
   - «ثبت باخت» = بازمصرف عین مسیر موجود: ptfSF_ensure → sfClose (مودال دلیل
     استاندارد US-349) → بایگانی → گزارش Win/Loss — هیچ منطق موازی ساخته نشد.
   - v21.1 BUG-035: فرصت‌هایی که در ptf_crm_projects بایگانی lost/settled شده‌اند
     (با تطبیق دو-شناسه‌ای inqNo/cd) از لیست فرصت‌ها حذف می‌شوند.
   ===================================================================== */
(function () {
  'use strict';

  /* شناسه‌های هم‌ارز درخواست (US-386): کد سیستمی + شماره کارفرما */
  function aliasesOf(r) {
    var out = [];
    if (r.cd) out.push(r.cd);
    if (r.inqNo && out.indexOf(r.inqNo) < 0) out.push(r.inqNo);
    return out;
  }

  /* v21.1 BUG-035: مجموعه شناسه‌های بایگانی‌شده (lost/settled) از projects — export برای تسترها */
  window.ptfOppoArchivedInqSet = function () {
    var set = {};
    try {
      (getData('ptf_crm_projects') || []).forEach(function (p) {
        if (!p) return;
        if (p.state !== 'archived' && p.origin !== 'salesfile') return;
        if (p.origin === 'salesfile' || p.closeKind === 'lost' || p.closeKind === 'settled' || p.state === 'archived') {
          if (p.inqNo) set[p.inqNo] = 1;
          if (p.cd) set[p.cd] = 1;
          if (p.no && String(p.no).indexOf('ARC-') === 0) {
            var raw = String(p.no).slice(4);
            if (raw) set[raw] = 1;
          }
        }
      });
    } catch (e) {}
    return set;
  };

  window.ptfOppoIsArchivedInq = function (inq, rfq, archSet) {
    if (!inq) return false;
    archSet = archSet || (typeof ptfOppoArchivedInqSet === 'function' ? ptfOppoArchivedInqSet() : {});
    if (archSet[inq]) return true;
    if (rfq) {
      var als = aliasesOf(rfq);
      for (var i = 0; i < als.length; i++) if (archSet[als[i]]) return true;
    }
    return false;
  };

  /* گردآوری فرصت‌ها: گروه‌بندی پیشنهادها بر اساس inqNo — بدون CO/TC برنده */
  window.ptfOppoList = function () {
    var offers = getData('ptf_crm_offers');
    var rfqs = getData('ptf_crm_rfqs');
    var deals = getData('ptf_crm_deals');
    var archSet = (typeof ptfOppoArchivedInqSet === 'function' ? ptfOppoArchivedInqSet() : {}); /* v21.1 BUG-035 */
    var wonInq = {};
    var dealByInq = {};
    deals.forEach(function (d) {
      if (d.inqNo) dealByInq[d.inqNo] = d;
      if (d.wonOffer && d.inqNo) wonInq[d.inqNo] = 1;
    });
    offers.forEach(function (o) {
      if (o.st === 'won' && (o.kind === 'CO' || o.kind === 'TC') && o.inqNo) wonInq[o.inqNo] = 1;
    });
    /* v31.7.29 BUG-OPPO-DUP-001: dedup هم‌شماره‌ها در نمای درخواست هم */
    var ST_RANK2 = { won: 6, lost: 5, sent: 4, approved: 4, revise: 3, registered: 2, draft: 1 };
    var byNo2 = {};
    offers.forEach(function (o) {
      if (!o || !o.no) return;
      var ex = byNo2[o.no];
      if (!ex) { byNo2[o.no] = o; return; }
      var ra = ST_RANK2[ex.st] || 0, rb = ST_RANK2[o.st] || 0;
      if (rb > ra || (rb === ra && String(o.dateEn || o.t || '') >= String(ex.dateEn || ex.t || ''))) byNo2[o.no] = o;
    });
    var offers2 = Object.keys(byNo2).map(function (n) { return byNo2[n]; });
    var byInq = {};
    offers2.forEach(function (o) {
      if (!o.inqNo) return;
      if (!byInq[o.inqNo]) byInq[o.inqNo] = { inqNo: o.inqNo, offers: [], buyerCo: o.buyerCo || '' };
      byInq[o.inqNo].offers.push(o);
      if (!byInq[o.inqNo].buyerCo && o.buyerCo) byInq[o.inqNo].buyerCo = o.buyerCo;
    });
    var out = [];
    Object.keys(byInq).forEach(function (inq) {
      var g = byInq[inq];
      /* برنده یا بایگانی‌شده (باخت ثبت‌شده) → فرصت نیست */
      if (wonInq[inq]) return;
      var rfq = rfqs.filter(function (r) { return aliasesOf(r).indexOf(inq) > -1; })[0];
      if (rfq && wonInq[rfq.cd]) return;
      if (rfq && (rfq.st === 'stX' || rfq.st === 'st7')) return; /* لغو/تحویل‌شده = بسته */
      /* v21.1 BUG-035: بایگانی lost/settled در projects → دیگر فرصت نیست */
      if (typeof ptfOppoIsArchivedInq === 'function' && ptfOppoIsArchivedInq(inq, rfq, archSet)) return;
      var finOffers = g.offers.filter(function (o) { return o.kind === 'CO' || o.kind === 'TC'; });
      if (finOffers.length && finOffers.every(function (o) { return o.st === 'lost' || o.st === 'archived'; })) return; /* v31.7.97: همه پیشنهادهای مالی بازنده‌اند → فرصت فعال نیست */
      g.rfq = rfq || null;
      g.deal = dealByInq[inq] || (rfq ? dealByInq[rfq.cd] : null) || null;
      out.push(g);
    });
    /* پوشش مهاجرت نرم (US-404): رکوردهای قدیمی deals بدون برد که پیشنهاد زنده‌ای ندارند
       (مثلا پیشنهاد حذف شده) — نباید در هیچ تبی گم شوند؛ به‌عنوان فرصت نمایندگی می‌شوند */
    deals.forEach(function (d) {
      if (d.st === 'archived' || d.wonOffer || !d.inqNo) return;
      if (byInq[d.inqNo]) return; /* قبلا از مسیر پیشنهادها آمده */
      if (wonInq[d.inqNo]) return;
      var rfq2 = rfqs.filter(function (r) { return aliasesOf(r).indexOf(d.inqNo) > -1; })[0];
      if (rfq2 && (rfq2.st === 'stX' || rfq2.st === 'st7')) return;
      if (typeof ptfOppoIsArchivedInq === 'function' && ptfOppoIsArchivedInq(d.inqNo, rfq2, archSet)) return; /* v21.1 BUG-035 */
      out.push({ inqNo: d.inqNo, offers: [], buyerCo: d.buyerCo || (rfq2 ? rfq2.co : ''), rfq: rfq2 || null, deal: d, legacy: true });
    });
    /* مرتب‌سازی: مهلت‌دارهای فوری اول */
    out.sort(function (a, b) {
      function w(g) {
        var d = (g.rfq && typeof ptfRfqDueState === 'function') ? ptfRfqDueState(g.rfq) : null;
        return d ? (d.over ? 0 : 1) : 2;
      }
      return w(a) - w(b);
    });
    return out;
  };

  window.ptfOppoCount = function () {
    try { return ptfOppoList().length; } catch (e) { return 0; }
  };

  /* MOB-039: actionهای فرصت تا اینجا buttonهای inline با طول متن متغیر بودند.
     markup ساخت‌یافته، label و metadata را از layout جدا می‌کند تا در کارت موبایل
     tileهای هم‌اندازه، قابل‌لمس و قابل‌فهم ساخته شوند. */
  function oppoCardAction(kind, icon, label, meta, title, onClick) {
    return '<button type="button" class="bt bt-o sf-oppo-card-action sf-oppo-card-action-' + kind + '" data-sf-oppo-action="' + kind + '"' +
      ' title="' + escP(title || label) + '" aria-label="' + escP(title || label) + '" onclick="' + onClick + '">' +
      '<span class="sf-oppo-card-action-icon" aria-hidden="true">' + icon + '</span>' +
      '<span class="sf-oppo-card-action-copy"><span class="sf-oppo-card-action-label">' + label + '</span>' +
      (meta ? '<span class="sf-oppo-card-action-meta">' + meta + '</span>' : '') + '</span></button>';
  }
  function oppoCustomerAction(kind, icon, label, title, onClick) {
    return '<button type="button" class="bt bt-o sf-oppo-customer-action sf-oppo-customer-action-' + kind + '" data-sf-oppo-customer-action="' + kind + '"' +
      ' title="' + escP(title || label) + '" aria-label="' + escP(title || label) + '" onclick="' + onClick + '">' +
      '<span class="sf-oppo-customer-action-icon" aria-hidden="true">' + icon + '</span><span class="sf-oppo-customer-action-label">' + label + '</span></button>';
  }
  window.ptfOppoCustomerToggle = function (btn) {
    var detail = btn && btn.nextElementSibling;
    if (!detail) return;
    var open = detail.style.display === 'none';
    detail.style.display = open ? '' : 'none';
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    var hint = btn.querySelector('.sf-oppo-customer-toggle-text');
    if (hint) hint.textContent = open ? 'بستن ▲' : 'نمایش ▼';
  };

  /* رندر تب فرصت‌ها (صدازده‌شده از renderDeals — salesfiles v16.8) */
  window.ptfOppoRender = function (el, q) {
    var list = ptfOppoList().filter(function (g) {
      if (!q) return true;
      return ((g.inqNo || '') + ' ' + (g.buyerCo || '')).toLowerCase().indexOf(q) > -1;
    });
    var ST = { draft: '📝 پیش‌نویس', registered: '📋 ثبت‌شده', sent: '📤 ارسال‌شده', approved: '✅ تایید', rejected: '⛔ عدم تایید', revise: '✏️ اصلاح', lost: '❌ بازنده' };
    var h = '';
    list.forEach(function (g) {
      var due = (g.rfq && typeof ptfRfqDueState === 'function') ? ptfRfqDueState(g.rfq) : null;
      var dueB = due ? '<span class="bd" style="background:' + (due.bg || '#f1f5f9') + ';color:' + due.cl + '">' + due.lb + '</span> ' : '';
      var waitB = (g.rfq && typeof ptfRfqWaitBadge === 'function') ? ptfRfqWaitBadge(g.rfq, g.offers) : '';
      var chips = g.offers.map(function (o) {
        var st = o.kind === 'TO' ? ((o.st === 'won' ? 'approved' : o.st === 'lost' ? 'rejected' : o.st) || 'draft') : (o.st || 'draft');
        var kindIc = o.kind === 'TO' ? '🔧' : o.kind === 'TC' ? '🤝' : '💰';
        return '<span class="bd" style="background:#f8fafc;border:1px solid var(--brd);font-size:10.5px" dir="ltr">' + kindIc + ' ' + escP(o.no) + (o.rev ? ' R' + o.rev : '') + ' — ' + (ST[st] || st) + '</span>';
      }).join(' ');
      var hasLiveCO = g.offers.some(function (o) { return (o.kind === 'CO' || o.kind === 'TC') && o.st !== 'lost'; });
      if (g.legacy && !chips) chips = '<span class="bd" style="background:#fef3c7;color:#b45309;font-size:10.5px">📂 رکورد قدیمی بدون پیشنهاد زنده — نتیجه را ثبت کنید</span>';
      var offerAction = oppoCardAction(
        'offers', '📄', 'پیشنهادها', 'مدیریت و ثبت برد',
        'مدیریت پیشنهادها — برنده شدن CO از همان‌جا ثبت می‌شود',
        'if(typeof goPanelByName===\'function\')goPanelByName(\'off\');else if(typeof goPanel===\'function\')goPanel(\'off\')'
      );
      var requestAction = g.rfq ? oppoCardAction(
        'request', '✏️', 'درخواست', 'ویرایش درخواست',
        'ویرایش درخواست مرتبط با این فرصت',
        'editRfq(\'' + ptfOnClickArg(g.rfq.cd) + '\')'
      ) : '';
      var loseAction = oppoCardAction(
        'loss', '🚫', 'ثبت باخت', 'دلیل استاندارد',
        'ثبت باخت با دلیل استاندارد — مستقیم به گزارش Win/Loss',
        'ptfOppoLose(\'' + ptfOnClickArg(g.inqNo) + '\',\'' + ptfOnClickArg((g.buyerCo || '').replace(/'/g, '')) + '\')'
      );
      h += '<article class="sf-oppo-card' + (due && due.over ? ' is-overdue' : '') + '">' +
        '<div class="sf-oppo-card-head">' +
        '<div class="sf-oppo-card-summary"><b dir="ltr">' + escP(g.inqNo) + '</b> — ' + escP(g.buyerCo || (g.rfq ? g.rfq.co : '') || '-') +
        '<div class="sf-oppo-card-chips">' + dueB + waitB + ' ' + chips + '</div></div>' +
        '<div class="sf-oppo-card-actions' + (g.rfq ? ' has-rfq' : ' no-rfq') + '" role="group" aria-label="عملیات فرصت ' + escP(g.inqNo) + '">' +
        offerAction + requestAction + loseAction +
        '</div></div>' +
        (hasLiveCO ? '<div class="sf-oppo-card-hint">💡 با ثبت «🏆 برنده» روی پیشنهاد مالی، این فرصت خودکار به «📁 پرونده‌ها (ابلاغ سفارش)» منتقل می‌شود.</div>' : '') +
        '</article>';
    });
    el.innerHTML = h || '<div style="text-align:center;color:#94a3b8;padding:24px">فرصت فعالی نیست — با ثبت پیشنهاد برای یک درخواست، اینجا رهگیری می‌شود 🎯</div>';
  };

  /* ثبت باخت فرصت = عین مسیر موجود پرونده (بدون منطق موازی):
     ptfSF_ensure (رکورد موقت) → sfClose (بدون فاکتور → مودال دلیل استاندارد US-349 → بایگانی lost → Win/Loss) */
  window.ptfOppoLose = function (inqNo, buyerCo) {
    if (typeof ptfSF_ensure !== 'function' || typeof window.sfClose !== 'function') { alert('ماژول پرونده فروش بارگذاری نشده'); return; }
    var r = ptfSF_ensure(inqNo, buyerCo || '');
    if (!r) return;
    window.sfClose(r.cd);
  };


  // US-435: گروه‌بندی پیشنهادهای مالی فعال بر اساس مشتری (برای فرصت‌های فروش)
  window.ptfOppoListByCustomer = function(){
    var offers = getData('ptf_crm_offers');
    var deals = getData('ptf_crm_deals');
    var customers = {};
    try { customers = {}; (getData('ptf_crm_customers')||[]).forEach(function(c){ customers[c.cd]=c.co||c.cd; }); } catch(e){}
    var archived = (typeof window.ptfOppoArchivedInqSet === 'function') ? window.ptfOppoArchivedInqSet() : {};
    var wonInq = {};
    deals.forEach(function(d){ if(d && d.wonOffer && d.inqNo) wonInq[d.inqNo] = true; });
    offers.forEach(function(o){
      if(o && o.inqNo && (o.kind === 'CO' || o.kind === 'TC') && o.st === 'won') wonInq[o.inqNo] = true;
    });
    function dateKey(o){ return String(o.dateEn || o.dateISO || o.ofDate || o.t || o.dt || ''); }
    /* v31.7.29 BUG-OPPO-DUP-001 (گزارش کارفرما با اسکرین‌شات): یک پیشنهاد (مثل PTF-CO-1405-0441)
       چند بار در فرصت‌های فعال — رکوردهای هم‌شماره میراث دوران BUG-CODE-DUP-003.
       dedup نمایشی بر اساس شماره سند: جدیدترین وضعیت (پیشرفته‌ترین st، سپس تاریخ جدیدتر) نماینده است. */
    var ST_RANK = { won: 6, lost: 5, sent: 4, approved: 4, revise: 3, registered: 2, draft: 1 };
    function pickOffer(a, b) {
      var ra = ST_RANK[a.st] || 0, rb = ST_RANK[b.st] || 0;
      if (ra !== rb) return ra > rb ? a : b;
      return dateKey(a) >= dateKey(b) ? a : b;
    }
    var byNo = {};
    offers.forEach(function (o) {
      if (!o || !o.no) return;
      byNo[o.no] = byNo[o.no] ? pickOffer(byNo[o.no], o) : o;
    });
    var uniqOffers = Object.keys(byNo).map(function (n) { return byNo[n]; });
    window._oppoDupNos = Object.keys(byNo).filter(function (n) {
      return offers.filter(function (o) { return o && o.no === n; }).length > 1;
    });
    var byBuyer = {};
    uniqOffers.forEach(function(o){
      if(!o || !o.buyerCd) return;
      if(o.kind !== 'CO' && o.kind !== 'TC') return; // فقط پیشنهاد مالی
      if(o.st === 'won' || o.st === 'lost' || o.st === 'archived') return;
      if(o.inqNo && wonInq[o.inqNo]) return; // هر ابلاغ برنده، کل فرصت همان درخواست را می‌بندد
      if(o.inqNo && typeof window.ptfOppoIsArchivedInq === 'function' && window.ptfOppoIsArchivedInq(o.inqNo, null, archived)) return;
      if(!byBuyer[o.buyerCd]) byBuyer[o.buyerCd]={buyerCd:o.buyerCd, buyerCo:o.buyerCo||customers[o.buyerCd]||o.buyerCd, offers:[]};
      byBuyer[o.buyerCd].offers.push(o);
    });
    var out=[];
    Object.keys(byBuyer).forEach(function(cd){
      var g=byBuyer[cd];
      g.offers.sort(function(a,b){ return dateKey(b).localeCompare(dateKey(a)); });
      out.push(g);
    });
    out.sort(function(a,b){ return b.offers.length - a.offers.length || String(a.buyerCo||a.buyerCd).localeCompare(String(b.buyerCo||b.buyerCd)); });
    return out;
  };

  window.ptfOppoRenderByCustomer = function(el, q){
    var list = ptfOppoListByCustomer().filter(function(g){
      if(!q) return true;
      return ((g.buyerCo||'')+' '+g.buyerCd).toLowerCase().indexOf(q.toLowerCase())>-1;
    });
    var h='';
    list.forEach(function(g, gi){
      var detailId = 'sfOppoCustDetail_' + gi;
      var offersHtml = g.offers.map(function(o){
        var total = (o.items||[]).reduce(function(s,it){ return s+(+it.qty||0)*(+it.price||0); },0);
        var editAction = oppoCustomerAction('edit', '✏️', 'ویرایش', 'ویرایش پیشنهاد ' + (o.no || ''), 'offerEdit(\'' + ptfOnClickArg(o.no) + '\')');
        var previewAction = oppoCustomerAction('preview', '👁️', 'نمایش', 'پیش‌نمایش پیشنهاد ' + (o.no || ''), 'offerQuickPreview(\'' + ptfOnClickArg(o.no) + '\')');
        return '<div class="sf-oppo-customer-offer">'
          + '<div class="sf-oppo-customer-offer-main"><b dir="ltr">'+escP(o.no)+'</b> — '+escP(o.dateFa||o.dateEn||'')+' — '+ (typeof ptfMoney==='function'?ptfMoney(total,o.currency):total.toLocaleString('fa-IR')+' ریال')
          + ' — <span class="bd sf-oppo-customer-offer-state">'+escP(o.st||'')+'</span></div>'
          + '<div class="sf-oppo-customer-offer-actions" role="group" aria-label="عملیات پیشنهاد '+escP(o.no)+'">'+editAction+previewAction+'</div>'
          + '</div>';
      }).join('');
      h+='<article class="sf-oppo-customer-card">'
        +'<button type="button" class="sf-oppo-customer-head" aria-expanded="false" aria-controls="'+detailId+'" onclick="ptfOppoCustomerToggle(this)">'
        +'<span class="sf-oppo-customer-head-copy"><b>'+escP(g.buyerCo||g.buyerCd)+'</b> <span dir="ltr" class="sf-oppo-customer-code">'+escP(g.buyerCd)+'</span> <span class="bd sf-oppo-customer-count">'+g.offers.length+' پیشنهاد مالی</span></span>'
        +'<span class="sf-oppo-customer-toggle-text">نمایش ▼</span></button>'
        +'<div id="'+detailId+'" class="sf-oppo-customer-detail" style="display:none">'+offersHtml+'</div>'
        +'</article>';
    });
    var dupWarn = '';
    try {
      if ((window._oppoDupNos || []).length) {
        dupWarn = '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:8px 12px;margin-bottom:8px;font-size:12px;color:#92400e">⚠️ ' + window._oppoDupNos.length + ' شماره پیشنهاد دارای رکورد تکراری در داده است (' + window._oppoDupNos.slice(0, 3).join('، ') + (window._oppoDupNos.length > 3 ? '…' : '') + ') — اینجا یکتا نمایش داده شد؛ برای پاکسازی ریشه‌ای از تنظیمات → «بررسی کدهای تکراری» اقدام کنید.</div>';
      }
    } catch (eDW) {}
    el.innerHTML = dupWarn + (h || '<div style="text-align:center;color:#94a3b8;padding:24px">فرصت مالی فعالی نیست</div>');
  };


  /* پس از بایگانی/تغییر، شمارنده تب تازه شود — hook سبک روی renderDeals قبلا در salesfiles است؛
     اینجا فقط بج شمارنده روی خود دکمه تب (اگر پنل باز است) به‌روزرسانی دوره‌ای نمی‌خواهد چون
     buildDeals هر بار شمار تازه می‌گیرد. */
})();
