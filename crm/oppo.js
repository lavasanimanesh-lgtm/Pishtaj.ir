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
      h += '<div style="background:var(--crd,#fff);border:1px solid var(--brd);border-radius:14px;margin-bottom:8px;padding:12px 14px' + (due && due.over ? ';border-color:#fca5a5;background:#fef2f2' : '') + '">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap">' +
        '<div style="font-size:13px"><b dir="ltr">' + escP(g.inqNo) + '</b> — ' + escP(g.buyerCo || (g.rfq ? g.rfq.co : '') || '-') +
        '<div style="margin-top:5px;line-height:2.2">' + dueB + waitB + ' ' + chips + '</div></div>' +
        '<div style="display:flex;gap:5px;flex-wrap:wrap;white-space:nowrap">' +
        '<button class="bt bt-o" style="padding:4px 11px;font-size:12px;color:#0e7490" onclick="if(typeof goPanelByName===\'function\')goPanelByName(\'off\');else if(typeof goPanel===\'function\')goPanel(\'off\')" title="مدیریت پیشنهادها — برنده شدن CO از همان‌جا ثبت می‌شود">📄 پیشنهادها</button>' +
        (g.rfq ? '<button class="bt bt-o" style="padding:4px 11px;font-size:12px" onclick="editRfq(\'' + ptfOnClickArg(g.rfq.cd) + '\')">✏️ درخواست</button>' : '') +
        '<button class="bt bt-o" style="padding:4px 11px;font-size:12px;color:#b45309;border-color:#fcd34d" onclick="ptfOppoLose(\'' + ptfOnClickArg(g.inqNo) + '\',\'' + ptfOnClickArg((g.buyerCo || '').replace(/'/g, '')) + '\')" title="باخت با دلیل استاندارد — مستقیم به گزارش Win/Loss">🚫 ثبت باخت</button>' +
        '</div></div>' +
        (hasLiveCO ? '<div style="font-size:11px;color:#64748b;margin-top:6px">💡 با ثبت «🏆 برنده» روی پیشنهاد مالی، این فرصت خودکار به «📁 پرونده‌ها (ابلاغ سفارش)» منتقل می‌شود.</div>' : '') +
        '</div>';
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
    list.forEach(function(g){
      var offersHtml = g.offers.map(function(o){
        var total = (o.items||[]).reduce(function(s,it){ return s+(+it.qty||0)*(+it.price||0); },0);
        return '<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 8px;border-bottom:1px dashed var(--brd);font-size:12px;align-items:center">'
          + '<span><b dir="ltr">'+escP(o.no)+'</b> - '+escP(o.dateFa||o.dateEn||'')+' - '+ (typeof ptfMoney==='function'?ptfMoney(total,o.currency):total.toLocaleString('fa-IR')+' ریال') 
          + ' - <span class="bd" style="font-size:10px">'+escP(o.st||'')+'</span></span>'
          + '<span><button class="bt bt-o" style="padding:3px 8px;font-size:11px" onclick="offerEdit(\''+ptfOnClickArg(o.no)+'\')">✏️</button> <button class="bt bt-o" style="padding:3px 8px;font-size:11px" onclick="offerQuickPreview(\''+ptfOnClickArg(o.no)+'\')">👁️</button></span>'
          + '</div>';
      }).join('');
      h+='<div style="background:var(--crd,#fff);border:1px solid var(--brd);border-radius:14px;margin-bottom:8px;padding:12px 14px">'
        +'<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;cursor:pointer" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display===\'none\'?\'\':\'none\'">'
        +'<div style="font-size:13px"><b>'+escP(g.buyerCo||g.buyerCd)+'</b> <span dir="ltr" style="background:#eef2ff;color:#3730a3;border-radius:999px;padding:1px 8px;font-size:11px">'+escP(g.buyerCd)+'</span> <span class="bd" style="background:#fef3c7;color:#b45309">'+g.offers.length+' پیشنهاد مالی</span></div>'
        +'<span style="font-size:11px;color:#64748b">کلیک برای نمایش ▼</span></div>'
        +'<div style="display:none;margin-top:8px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">'+offersHtml+'</div>'
        +'</div>';
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
