/* =====================================================================
   PTF CRM — Management Intelligence (phase 1)
   موتور تصمیم‌یار مدیریت: محاسبات قطعی از دادهٔ CRM، بدون ارسال داده به AI.
   لایهٔ AI در فاز بعد فقط همین snapshot کمینه و قابل ممیزی را تفسیر خواهد کرد.
   ===================================================================== */
(function () {
  'use strict';
  function list(k) { try { return getData(k) || []; } catch (e) { return []; } }
  function n(v) { return +v || 0; }
  function esc(v) { return typeof escP === 'function' ? escP(v == null ? '' : v) : String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function money(v) { return n(v).toLocaleString('fa-IR') + ' ریال'; }
  /* v34.7.17 — لایهٔ سنجهٔ مشترک (crm/metrics-shared.js):
     F-03 هویت واحد مشتری | F-04 نرمال‌سازی ارز | F-05 وصول از منبع واحد مالی */
  function MX() { return (window.PTF || {}).metrics || null; }
  function offerTotalIRR(o) {
    var M = MX();
    if (M) return M.offerTotalIRR(o);
    var raw = (o.items || []).reduce(function (s, it) { return s + n(it.qty) * n(it.price); }, 0);
    return { irr: raw, ok: !o.currency || o.currency === 'IRR', raw: raw, currency: o.currency || 'IRR' };
  }
  function idOf(rec) {
    var M = MX();
    if (M) return M.resolveCustomer(rec);
    var cd = String(rec.buyerCd || rec.custCd || '').trim();
    var label = String(rec.buyerCo || rec.co || rec.company || '').trim();
    return { key: cd || label || 'نامشخص', label: label || cd || 'نامشخص', resolved: !!cd };
  }
  function newCustomer(id) {
    return { key:id.key, name:id.label || id.key, resolved:id.resolved, rfqs:0, offers:0, won:0, lost:0, open:0, expired:0,
      offered:0, wonValue:0, fxGaps:0, invoices:0, billed:0, paid:0 };
  }
  function pct1(a, b) { return b ? Math.round(a * 1000 / b) / 10 : null; }

  /* ---------- AN-01/AN-08 (v34.7.24): بازهٔ زمانی و تقویم شمسی ----------
     پیش از این، «گزارش هفتگی» و «گزارش ماهانه» هر دو یک snapshot مادام‌العمر چاپ می‌کردند
     (هیچ فیلتر تاریخی وجود نداشت) و دوره هم با تقویم میلادی ساخته می‌شد؛ یعنی روند قابل
     پیگیری نبود و عنوان گزارش با محتوایش نمی‌خواند. */
  function todayISO() { return new Date().toISOString().slice(0, 10); }
  function toISO(v) {
    var s0 = String(v == null ? '' : v).trim();
    if (!s0) return '';
    var m = s0.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[0];
    if (typeof window.ptfJToISO === 'function') { try { var r = window.ptfJToISO(s0); if (r) return String(r).slice(0, 10); } catch (e) {} }
    return '';
  }
  /* تاریخ مؤثر هر رکورد برای فیلتر بازه: مبنای «صدور» یا «بسته‌شدن» */
  function offerDateISO(o, basis) {
    if (!o) return '';
    if (basis === 'close') return toISO(o.wonAt || o.lostAt || o.stAt || o.dateEn || o.dateFa || o.t);
    return toISO(o.dateEn || o.dateFa || o.t || o.wonAt);
  }
  function inRange(iso, from, to) {
    if (!from && !to) return true;
    if (!iso) return false;           /* رکورد بدون تاریخ در گزارش دوره‌ای شمرده نمی‌شود */
    if (from && iso < from) return false;
    if (to && iso > to) return false;
    return true;
  }
  function jToday() {
    if (typeof window.ptfTodayJ === 'function') { try { return String(window.ptfTodayJ()); } catch (e) {} }
    if (typeof faDate === 'function') { try { return String(faDate()); } catch (e) {} }
    return '';
  }
  function jParts(jstr) {
    var m = String(jstr || '').match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
    return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
  }
  /* بازهٔ شمسی: هفتگی = شنبه تا امروز | ماهانه = اول ماه شمسی تا امروز */
  function jalaliRange(kind) {
    var jt = jParts(jToday());
    var toIsoNow = todayISO();
    if (!jt) {
      var d0 = new Date();
      if (kind === 'monthly') { d0.setDate(1); return { fromISO: d0.toISOString().slice(0, 10), toISO: toIsoNow, label: toIsoNow.slice(0, 7), calendar: 'gregorian-fallback' }; }
      d0.setDate(d0.getDate() - 6);
      return { fromISO: d0.toISOString().slice(0, 10), toISO: toIsoNow, label: d0.toISOString().slice(0, 10), calendar: 'gregorian-fallback' };
    }
    if (kind === 'monthly') {
      var firstJ = jt.y + '/' + String(jt.m).padStart(2, '0') + '/01';
      return { fromISO: toISO(firstJ) || toIsoNow, toISO: toIsoNow, label: jt.y + '/' + String(jt.m).padStart(2, '0'), calendar: 'jalali' };
    }
    /* هفتهٔ شمسی از شنبه شروع می‌شود: getDay() → ۶=شنبه */
    var back = (new Date().getDay() + 1) % 7;
    var st = new Date(); st.setDate(st.getDate() - back);
    var stISO = st.toISOString().slice(0, 10);
    var stJ = (typeof window.ptfISOToJ === 'function') ? (function () { try { return window.ptfISOToJ(stISO); } catch (e) { return ''; } })() : '';
    return { fromISO: stISO, toISO: toIsoNow, label: (stJ || stISO) + ' تا ' + (jToday() || toIsoNow), calendar: 'jalali' };
  }

  /* خروجی تنها از داده‌های قطعی CRM ساخته می‌شود؛ هیچ توصیه‌ای بدون شواهد عددی نیست. */
  window.ptfManagementIntelligence = function (opts) {
    /* AN-01: پارامتر بازه. بدون آرگومان، رفتار قبلی (کل تاریخچه) حفظ می‌شود تا هیچ
       مصرف‌کنندهٔ فعلی نشکند؛ گزارش‌های دوره‌ای بازه را صریح می‌فرستند. */
    opts = opts || {};
    var fromISO = toISO(opts.fromISO || opts.from || ''), toISOv = toISO(opts.toISO || opts.to || '');
    var basis = opts.basis === 'close' ? 'close' : 'issue';
    var periodOn = !!(fromISO || toISOv);
    var M = MX();
    var offers = list('ptf_crm_offers').filter(function (o) {
      if (!(M ? M.isCommercial(o) : (o && (o.kind === 'CO' || o.kind === 'TC') && !o.rialOf))) return false;
      return periodOn ? inRange(offerDateISO(o, basis), fromISO, toISOv) : true;
    });
    var rfqs = list('ptf_crm_rfqs').filter(function (r) { return periodOn ? inRange(toISO(r && (r.dt || r.t || r.dateISO)), fromISO, toISOv) : true; });
    var invoices = list('ptf_crm_invoices').filter(function (i) { return periodOn ? inRange(toISO(i && (i.invDate || i.t)), fromISO, toISOv) : true; });
    var buyquotes = list('ptf_crm_buyquotes'), smartRfqs = list('ptf_crm_rfqsmart');
    var customers = {}, products = {}, suppliers = {}, projects = [];

    offers.forEach(function (o) {
      var id = idOf(o), c = customers[id.key] || (customers[id.key] = newCustomer(id));
      if (!c.resolved && id.resolved) { c.resolved = true; }
      if (!c.name || c.name === 'نامشخص') c.name = id.label || c.name;
      var t = offerTotalIRR(o);
      c.offers++;
      if (t.ok) c.offered += t.irr; else c.fxGaps++;
      if (o.st === 'won') { c.won++; if (t.ok) c.wonValue += t.irr; }
      else if (o.st === 'lost') c.lost++;
      else { c.open++; if (M && M.isExpired(o)) c.expired++; }
      /* سهم ریالی هر قلم با همان نرخ سند (اگر نرخ مرجع نداشت، فقط تعداد شمرده می‌شود) */
      var rate = t.raw ? (t.ok ? t.irr / t.raw : 0) : 0;
      (o.items || []).forEach(function (it) {
        var pk = String(it.pcode || it.prodCd || it.name || it.desc || 'نامشخص').trim(), p = products[pk] || (products[pk] = { key:pk, name:it.name || it.desc || pk, quotes:0, won:0, qty:0, value:0, wonValue:0 });
        var lineIRR = Math.round(n(it.qty) * n(it.price) * rate);
        p.quotes++; p.qty += n(it.qty); p.value += lineIRR;
        if (o.st === 'won') { p.won++; p.wonValue += lineIRR; }
      });
    });
    rfqs.forEach(function (r) {
      var id = idOf(r), c = customers[id.key] || (customers[id.key] = newCustomer(id));
      c.rfqs++;
    });
    /* AN-07: اگر نقش جاری اجازهٔ دفتر غیررسمی ندارد، اسناد غیررسمی وارد تجمیع نمی‌شوند
       (همان قاعده‌ای که حساب مشتری از v33 اعمال می‌کرد). */
    var _seeUnofficial = true;
    try { if (typeof ptfCanSeeLedger === 'function') _seeUnofficial = !!ptfCanSeeLedger('unofficial'); } catch (eLg0) {}
    invoices.forEach(function (i) {
      if (M && !M.invoiceActive(i)) return; /* F-05: فاکتور ابطال‌شده در «فاکتورشده» نمی‌نشیند */
      if (!_seeUnofficial && i && i.isUnofficial) return;
      var id = idOf(i), c = customers[id.key] || (customers[id.key] = newCustomer(id));
      c.invoices++;
      c.billed += M ? M.invoiceBilledIRR(i) : n(i.amount);
      c.paid += M ? M.invoiceCollectedIRR(i) : ((i.payments || []).concat(i.pays || [])).reduce(function (s, p) { return s + n(p.amt); }, 0);
    });
    /* AN-06 (v34.7.24): «خرید واقعی» از منبع ساختاریافته خوانده می‌شود، نه از Regex روی
       متن آزاد یادداشت. مبنا: ردیف‌های purchases در ptf_crm_buycmp (همان جایی که خرید واقعی
       ثبت می‌شود). یادداشت متنی فقط به‌عنوان fallback رکوردهای قدیمی باقی مانده است. */
    var realPurchaseBySupplier = {};
    list('ptf_crm_buycmp').forEach(function (c) {
      if (!c || !Array.isArray(c.purchases)) return;
      c.purchases.forEach(function (pu) {
        if (!pu) return;
        var sk = String(pu.sup || pu.supplier || pu.supplierCd || '').trim();
        if (!sk) return;
        realPurchaseBySupplier[sk] = (realPurchaseBySupplier[sk] || 0) + 1;
      });
    });
    buyquotes.forEach(function (b) {
      var k = String(b.sup || b.supplier || 'نامشخص').trim() || 'نامشخص', s = suppliers[k] || (suppliers[k] = { key:k, name:k, quotes:0, purchases:0, value:0, purchasesLegacyNote:0 });
      s.quotes++; s.value += n(b.price);
      if (/خرید واقعی/.test(String(b.note || ''))) s.purchasesLegacyNote = (s.purchasesLegacyNote || 0) + 1;
    });
    Object.keys(realPurchaseBySupplier).forEach(function (k) {
      var s = suppliers[k] || (suppliers[k] = { key:k, name:k, quotes:0, purchases:0, value:0, purchasesLegacyNote:0 });
      s.purchases = realPurchaseBySupplier[k];
    });
    Object.keys(suppliers).forEach(function (k) {
      var s = suppliers[k];
      if (!s.purchases && s.purchasesLegacyNote) { s.purchases = s.purchasesLegacyNote; s.purchaseSource = 'legacy-note'; }
      else if (s.purchases) s.purchaseSource = 'buycmp';
    });
    /* پاسخ استعلام‌های تامین: شاخصی مستقل از خرید واقعی و مفید برای کیفیت تامین‌کننده. */
    smartRfqs.forEach(function (r) {
      (r.targets || []).forEach(function (t) {
        var k=String(t.co || t.cd || 'نامشخص').trim() || 'نامشخص', sp=suppliers[k] || (suppliers[k]={key:k,name:t.co||t.cd||k,quotes:0,purchases:0,value:0,invited:0,replied:0});
        sp.invited=(sp.invited||0)+1;
        if(t.st==='replied') sp.replied=(sp.replied||0)+1;
      });
    });

    /* AN-05 (v34.7.24): بازتعریف «پروندهٔ نیازمند بررسی». پیش از این هر پروندهٔ بدون
       پیشنهاد برنده ریسک شمرده می‌شد و کارت قرمز عملاً شمارندهٔ پرونده‌های باز بود.
       اکنون سه دستهٔ معنادار: تأخیر تحویل | عدم انطباق QC | رکود (بدون رویداد در ۳۰ روز). */
    var _todayISO = todayISO();
    var STALE_DAYS = 30;
    list('ptf_crm_deals').forEach(function (d) {
      if (!d || d.st === 'archived') return;
      var overdue = !!(d.dueISO && d.dueISO < _todayISO);
      var qcBad = (d.qcEvents || []).some(function (q) { return q.conf === 'nonconform'; });
      var lastISO = '';
      ((d.timeline || []).concat(d.docs || [])).forEach(function (e) {
        var iso = toISO(e && (e.t || e.at || e.date));
        if (iso && iso > lastISO) lastISO = iso;
      });
      if (!lastISO) lastISO = toISO(d.wonAt || d.t || d.createdAt || '');
      var idleDays = lastISO ? Math.round((new Date(_todayISO) - new Date(lastISO)) / 864e5) : null;
      var stalled = !!(idleDays !== null && idleDays > STALE_DAYS && !d.closedAt && d.st !== 'done');
      if (!overdue && !qcBad && !stalled) return;
      projects.push({ cd:d.cd, no:d.inqNo || d.cd, customer:d.buyerCo || '',
        overdue:overdue, qcBad:qcBad, stalled:stalled, idleDays:idleDays, due:d.dueISO || '',
        kind: overdue ? 'overdue' : (qcBad ? 'qc' : 'stalled') });
    });

    var customerRows = Object.keys(customers).map(function (k) {
      var c = customers[k], decided = c.won + c.lost;
      /* v34.7.17 (F-01/F-08): سه سنجهٔ صریح به‌جای یک نرخ بردِ متورم.
         winRate = برد از کل پیشنهادهای صادرشده (عدد اصلی، مصوب کارفرما)
         winRateDecided = برد در بین نتایج ثبت‌شده (کمکی)
         coverage = پوشش تعیین تکلیف؛ زیر ۳ نمونه هیچ درصدی نمایش داده نمی‌شود. */
      c.decided = decided;
      c.winRate = c.offers >= 3 ? pct1(c.won, c.offers) : null;
      c.winRateDecided = decided >= 3 ? pct1(c.won, decided) : null;
      c.coverage = pct1(decided, c.offers);
      c.collectionRate = c.billed ? pct1(c.paid, c.billed) : null;
      c.control = c.rfqs >= 3 && c.offers >= 2 && c.won === 0;
      c.strategic = c.wonValue > 0 || c.paid > 0;
      /* سلامت مشتری رتبه‌بندی کمکی است. AN-04 (v34.7.33 — مصوب کارفرما):
         پایه ۴۵ تا مشتری متوسط «سالم» دیده نشود؛ برد تا +۲۵؛ وصول حول ۵۵٪ متقارن ±۲۰؛
         جریمهٔ کنترل ۲۲ و پوشش ناقص ۸. آستانه: ۷۲ مناسب / ۴۸ پیگیری. */
      var hs=45;
      if(c.winRate != null) hs += Math.min(25, c.winRate*0.25);
      if(c.collectionRate != null) hs += Math.max(-20, Math.min(20,(c.collectionRate-55)/2));
      if(c.control) hs -= 22;
      if(c.coverage != null && c.coverage < 40 && c.offers >= 3) hs -= 8;
      c.healthScore=Math.max(0,Math.min(100,Math.round(hs)));
      c.healthLabel=(!c.control&&c.offers<3&&c.invoices===0)?'دادهٔ ناکافی':c.healthScore>=72?'مناسب':c.healthScore>=48?'نیازمند پیگیری':'نیازمند کنترل';
      return c;
    }).sort(function (a,b) { return (b.wonValue + b.paid + b.offered) - (a.wonValue + a.paid + a.offered); });
    var productRows = Object.keys(products).map(function (k) { return products[k]; }).sort(function(a,b){return b.wonValue-a.wonValue || b.value-a.value;});
    var supplierRows = Object.keys(suppliers).map(function(k){var sp=suppliers[k];sp.responseRate=sp.invited?Math.round(sp.replied*1000/sp.invited)/10:null;sp.healthScore=Math.max(0,Math.min(100,Math.round((sp.responseRate==null?45:sp.responseRate*.6)+Math.min(35,sp.purchases*12)+Math.min(15,sp.quotes*2))));return sp;}).sort(function(a,b){return b.purchases-a.purchases || b.quotes-a.quotes;});
    var totalOpen=0, totalExpired=0, totalIssued=0, totalWon=0, totalFxGaps=0;
    customerRows.forEach(function(c){ totalOpen+=c.open; totalExpired+=c.expired; totalIssued+=c.offers; totalWon+=c.won; totalFxGaps+=c.fxGaps; });
    /* AN-03 (v34.7.24): واحد تحلیل «فرصت». تا امروز فقط سند شمرده می‌شد؛ چند پیشنهاد
       موازی برای یک استعلام، مخرج را متورم می‌کرد. فرصت = یک inqNo؛ برنده اگر حداقل یک
       سند برنده داشته باشد. سنجهٔ سند برای سازگاری و مقایسه حفظ شده است. */
    var oppMap = {};
    offers.forEach(function (o) {
      var key = String((o && (o.inqNo || o.no)) || '').trim() || 'نامشخص';
      var x = oppMap[key] || (oppMap[key] = { key: key, offers: 0, won: 0, lost: 0, open: 0 });
      x.offers++;
      if (o.st === 'won') x.won++;
      else if (o.st === 'lost') x.lost++;
      else x.open++;
    });
    var oppKeys = Object.keys(oppMap);
    var oppWon = 0, oppDecided = 0, oppOpen = 0;
    oppKeys.forEach(function (k) {
      var x = oppMap[k];
      if (x.won > 0) { oppWon++; oppDecided++; }
      else if (x.open === 0 && x.lost > 0) { oppDecided++; }
      else oppOpen++;
    });
    var opportunities = { total: oppKeys.length, won: oppWon, decided: oppDecided, open: oppOpen,
      winRateAll: oppKeys.length >= 3 ? pct1(oppWon, oppKeys.length) : null,
      coverage: pct1(oppDecided, oppKeys.length) };
    var portfolio={ issued:totalIssued, won:totalWon, open:totalOpen, expired:totalExpired,
      winRateAll:totalIssued>=3?pct1(totalWon,totalIssued):null, coverage:pct1(totalIssued-totalOpen,totalIssued),
      opportunities: opportunities };
    var dataQuality={
      offersMissingBuyer:offers.filter(function(o){return !o.buyerCd&&!o.buyerCo;}).length,
      lostWithoutReason:offers.filter(function(o){return o.st==='lost'&&!String(o.lostWhy||'').trim();}).length,
      rfqWithoutOwner:rfqs.filter(function(r){return r && !r.assignee && !r.owner && r.st!=='st7';}).length,
      supplierNoResponse:supplierRows.filter(function(sp){return sp.invited>=3 && sp.responseRate!=null && sp.responseRate<30;}).length,
      /* v34.7.17 */
      offersUndecided:totalOpen,
      offersExpiredUndecided:totalExpired,
      offersFxNoRate:totalFxGaps,
      customersUnresolved:customerRows.filter(function(c){return !c.resolved;}).length
    };
    var insights = [];
    var highEffort = customerRows.filter(function(c){return c.control;});
    var strategic = customerRows.filter(function(c){return c.strategic;}).slice(0,3);
    if (strategic.length) insights.push({ level:'good', title:'مشتریان دارای ارزش ثبت‌شده', text: strategic.map(function(c){return c.name;}).join('، ') + ' در داده‌های فروش/وصول یا برد، ارزش ثبت‌شده دارند. برای این مشتریان برنامه حساب کلیدی پیشنهاد می‌شود.' });
    if (highEffort.length) insights.push({ level:'warn', title:'مشتریان نیازمند کنترل هزینه فروش', text: highEffort.slice(0,3).map(function(c){return c.name + ' (' + c.rfqs + ' درخواست، ' + c.offers + ' پیشنهاد، بدون برد)';}).join('، ') + ' — پیشنهاد: بررسی کامل بودن RFQ، حداقل ارزش فرصت و سیاست Revision.' });
    if (productRows[0]) insights.push({ level:'info', title:'کالای/گروه پیشرو', text: productRows[0].name + ' با ارزش برد ' + money(productRows[0].wonValue) + ' در صدر داده‌های ثبت‌شده است.' });
    if (supplierRows[0]) insights.push({ level:'info', title:'تأمین‌کننده فعال', text: supplierRows[0].name + ' با ' + supplierRows[0].quotes + ' رکورد قیمت و ' + supplierRows[0].purchases + ' خرید واقعی ثبت‌شده، فعال‌ترین منبع داده است.' });
    if (projects.length) insights.push({ level:'risk', title:'ریسک‌های عملیاتی پرونده', text: projects.slice(0,3).map(function(p){return p.no + (p.overdue ? ' (تاخیر تحویل)' : '') + (p.qcBad ? ' (عدم انطباق QC)' : '');}).join('، ') + ' نیازمند بازبینی مدیریتی هستند.' });
    if(dataQuality.lostWithoutReason||dataQuality.offersMissingBuyer||dataQuality.rfqWithoutOwner) insights.push({level:'warn',title:'شکاف کیفیت داده',text:'پیشنهاد بی‌مشتری: '+dataQuality.offersMissingBuyer+' | باخت بدون دلیل: '+dataQuality.lostWithoutReason+' | RFQ بدون مسئول: '+dataQuality.rfqWithoutOwner+' — تکمیل این موارد دقت تصمیم‌یار را افزایش می‌دهد.'});
    /* v34.7.17 (F-01/F-04): اتکاپذیری سنجه‌ها صریح گزارش می‌شود */
    if(portfolio.coverage!=null && portfolio.coverage<60 && portfolio.open>=3) insights.push({level:'warn',title:'نرخ برد هنوز قابل استناد نیست',text:portfolio.open+' پیشنهاد بدون ثبت برد/باخت باقی مانده'+(portfolio.expired?' که '+portfolio.expired+' مورد از تاریخ اعتبار گذشته است':'')+' (پوشش تعیین تکلیف: '+portfolio.coverage+'٪). نرخ برد سازمان بر مبنای کل پیشنهادها '+(portfolio.winRateAll==null?'—':portfolio.winRateAll+'٪')+' است؛ عددی که فقط نتایج ثبت‌شده را ببیند به‌شدت خوش‌بینانه می‌شود.'});
    if(dataQuality.offersFxNoRate) insights.push({level:'warn',title:'اسناد ارزی بدون نرخ مرجع',text:dataQuality.offersFxNoRate+' پیشنهاد ارزی نرخ مرجع تبدیل ندارد؛ مبلغ آن‌ها در جمع‌های ریالی این گزارش وارد نشده است تا ارز و ریال با هم جمع نشوند.'});
    if(dataQuality.customersUnresolved) insights.push({level:'info',title:'مشتری بدون کد یکتا',text:dataQuality.customersUnresolved+' مشتری فقط با نام ثبت شده و به کد مشتری نگاشت نشد؛ تا زمان تخصیص کد، آمار آن‌ها ممکن است کامل نباشد.'});
    if (!insights.length) insights.push({ level:'info', title:'داده کافی نیست', text:'برای تصمیم‌یار مدیریت، ثبت وضعیت برد/باخت، خرید واقعی، فاکتور و وصول را کامل‌تر کنید.' });
    /* AN-05: تفکیک شمارش ریسک بر حسب نوع، برای کارت مدیریتی و گزارش */
    var riskCounts = { overdue:0, qc:0, stalled:0 };
    projects.forEach(function (x) { if (x.overdue) riskCounts.overdue++; else if (x.qcBad) riskCounts.qc++; else if (x.stalled) riskCounts.stalled++; });
    return { at:new Date().toISOString(), period:{ fromISO:fromISO||'', toISO:toISOv||'', basis:basis, active:periodOn, label:opts.periodLabel||'' },
      customers:customerRows, products:productRows, suppliers:supplierRows, risks:projects, riskCounts:riskCounts,
      insights:insights, dataQuality:dataQuality, portfolio:portfolio,
      /* AN-04: فرمول امتیاز سلامت صریح گزارش می‌شود تا «عدد جادویی» نماند (وزن‌ها تغییر نکرده‌اند). */
      healthModel:{ version:'v34.7.33', calibrated:true, base:45, winRateWeight:'min(25, نرخ برد × ۰٫۲۵)', collectionWeight:'کران‌دار (نرخ وصول − ۵۵) ÷ ۲ در بازهٔ −۲۰ تا +۲۰', controlPenalty:-22, lowCoveragePenalty:-8, bands:{good:72,watch:48}, note:'رتبه‌بندی کمکی است، نه قضاوت قطعی. وزن‌ها مصوب کارفرما (۱۴۰۵/۰۵/۲۶) با پایهٔ پایین‌تر تا امتیاز پیش‌فرض خوش‌بینانه نباشد.' },
      totals:{ customers:customerRows.length, products:productRows.length, suppliers:supplierRows.length, projectsAtRisk:projects.length } };
  };

  function insightHtml(i) { var c=i.level==='risk'?'#dc2626':i.level==='warn'?'#b45309':i.level==='good'?'#047857':'#0369a1'; return '<div style="border-right:4px solid '+c+';background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:9px 11px;margin-bottom:7px"><b style="color:'+c+'">'+esc(i.title)+'</b><div style="font-size:12px;color:#475569;margin-top:3px">'+esc(i.text)+'</div></div>'; }
  function winCell(r) {
    /* v34.7.17: درصد بدون مخرج نمایش داده نمی‌شود؛ نرخ نتایج ثبت‌شده فقط به‌عنوان عدد کمکی */
    if (r.winRate == null && r.winRateDecided == null) return '<span title="نمونه کمتر از ۳ پیشنهاد">—</span>';
    var main = r.winRate == null ? '—' : r.winRate + '٪';
    var sub = r.won + '/' + r.offers + (r.open ? ' | ' + r.open + ' بی‌تکلیف' : '');
    return '<b>' + main + '</b><div style="font-size:10px;color:#64748b">' + sub + '</div>';
  }
  function miniRows(rows, type) {
    return rows.slice(0,8).map(function(r){
      if(type==='customer') return '<tr><td>'+esc(r.name)+(r.resolved===false?' <small style="color:#b45309" title="بدون کد مشتری">⚠</small>':'')+'</td><td>'+r.rfqs+'</td><td>'+r.offers+'</td><td>'+r.won+'</td><td>'+winCell(r)+'</td><td>'+money(r.wonValue)+'</td><td>'+ (r.collectionRate==null?'—':r.collectionRate+'٪')+'</td><td>'+r.healthScore+' / '+esc(r.healthLabel||'—')+'</td></tr>';
      if(type==='product') return '<tr><td>'+esc(r.name)+'</td><td>'+r.quotes+'</td><td>'+r.won+'</td><td>'+money(r.wonValue)+'</td></tr>';
      return '<tr><td>'+esc(r.name)+'</td><td>'+r.quotes+'</td><td>'+r.purchases+'</td><td>'+ (r.responseRate==null?'—':r.responseRate+'٪')+'</td><td>'+money(r.value)+'</td></tr>';
    }).join('') || '<tr><td colspan="8">داده کافی نیست</td></tr>';
  }
  var ACTION_KEY = 'ptf_crm_management_actions';
  function actions() { return list(ACTION_KEY); }
  function canManage() { try { return typeof isSenior !== 'function' || isSenior() || !!((roleDef() || {}).finance); } catch (e) { return false; } }
  function jsArg(v) { return typeof ptfOnClickArg === 'function' ? ptfOnClickArg(v) : String(v || '').replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }
  function actionRows(openOnly) {
    var a=actions().filter(function(x){return !openOnly || x.status==='open' || x.status==='postponed';});
    return a.sort(function(x,y){return String(x.dueISO||'9999').localeCompare(String(y.dueISO||'9999'));});
  }
  function actionListHtml(openOnly) {
    var a=actionRows(openOnly);
    return a.map(function(x){ var mine=(typeof curSession==='function' && x.owner===curSession().user); return '<div style="border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;margin:6px 0;background:'+(x.status==='done'?'#f8fafc':'#fff')+'"><b>'+esc(x.title)+'</b><div style="font-size:11.5px;color:#64748b">مسئول: '+esc(x.ownerName||x.owner||'—')+' | موعد: '+esc(x.dueISO||'—')+' | وضعیت: '+esc(x.status||'open')+'</div>'+(x.note?'<div style="font-size:11.5px;color:#475569">'+esc(x.note)+'</div>':'')+((x.status==='open'||x.status==='postponed')&&canManage()?'<button class="bt bt-o" style="font-size:11px;padding:3px 8px;margin-top:5px" onclick="ptfManagementActionDone(\''+jsArg(x.cd)+'\')">✅ انجام شد</button> ':'')+'</div>'; }).join('') || '<div style="font-size:12px;color:#94a3b8">اقدام مدیریتی بازی ثبت نشده است.</div>';
  }
  window.ptfManagementActionOpen = function(title, evidence, recommendation) {
    if (!canManage()) { alert('⛔ ثبت اقدام مدیریتی فقط برای نقش‌های ارشد و مالی مجاز است.'); return; }
    var users=list('ptf_crm_users').filter(function(u){return u && u.username;});
    var opts=users.map(function(u){return '<option value="'+esc(u.username)+'">'+esc(u.name||u.username)+' — '+esc(u.role||u.roleId||'')+'</option>';}).join('');
    ptfDialog({title:'📌 تبدیل توصیه به اقدام مدیریتی',body:'این اقدام فقط پس از تایید شما ثبت می‌شود و به مسئول منتخب در کارتابل ارسال خواهد شد.',fields:[
      {id:'owner',label:'مسئول اقدام *',type:'select',optionsHtml:opts},
      {id:'due',label:'موعد اقدام (میلادی، اختیاری)',type:'date',gregorian:true,value:new Date(Date.now()+7*86400000).toISOString().slice(0,10)},
      {id:'note',label:'یادداشت/تصمیم مدیریت',type:'textarea',rows:3,value:recommendation||''}
    ],okText:'ثبت و ارجاع اقدام',onOk:function(v){
      if(!v.owner){alert('مسئول را انتخاب کنید');return;}
      var u=users.filter(function(x){return x.username===v.owner;})[0]||{};
      var rec={cd:genCode('MGA'),title:String(title||'اقدام مدیریتی'),evidence:String(evidence||''),recommendation:String(recommendation||''),note:String(v.note||''),owner:v.owner,ownerName:u.name||v.owner,dueISO:String(v.due||''),status:'open',createdAt:new Date().toISOString(),createdBy:(curSession()||{}).user||'',createdByName:(curSession()||{}).name||''};
      var all=actions(); all.unshift(rec); setData(ACTION_KEY,all);
      try { if(typeof notify==='function') notify({toUsers:[rec.owner],title:'📌 اقدام مدیریتی: '+rec.title,body:(rec.dueISO?'موعد: '+rec.dueISO+' — ':'')+rec.note,kind:'management_action',channels:['cart'],link:{panel:'anl'},actionable:true,refCd:rec.cd,taskType:'management_action',dkey:'management-action|'+rec.cd}); } catch(eN){}
      try { if(typeof audit==='function') audit('تصمیم‌یار مدیریت','ثبت و ارجاع اقدام مدیریتی: '+rec.title,rec.cd); } catch(eA){}
      if(typeof ptfToast==='function')ptfToast('✅ اقدام مدیریتی ثبت و ارجاع شد','ok');
      var box=document.getElementById('mgmtActionsBox');if(box)box.innerHTML=actionListHtml(true);
    }});
  };
  window.ptfManagementActionDone = function(cd) {
    var all=actions(), rec=all.filter(function(x){return x.cd===cd;})[0]; if(!rec)return;
    var me=(curSession()||{}).user||'';
    if(!canManage() && rec.owner!==me){alert('⛔ فقط مسئول اقدام یا مدیر می‌تواند آن را ببندد.');return;}
    var result=prompt('نتیجه/توضیح انجام اقدام (اختیاری):','')||'';
    rec.status='done';rec.doneAt=new Date().toISOString();rec.doneBy=me;rec.result=result;setData(ACTION_KEY,all);
    try {if(typeof ntfResolveByRef==='function')ntfResolveByRef(cd);}catch(eR){}
    try {if(typeof audit==='function')audit('تصمیم‌یار مدیریت','تکمیل اقدام مدیریتی: '+rec.title,cd);}catch(eA){}
    var box=document.getElementById('mgmtActionsBox');if(box)box.innerHTML=actionListHtml(true);
  };
  window.ptfManagementActionCenterOpen = function(){
    if(!canManage()){alert('⛔ دسترسی ندارید');return;}
    var h='<div class="md-b" style="display:grid;z-index:3100" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:720px;max-height:88vh;overflow:auto"><h3>📌 مرکز اقدام‌های مدیریتی</h3><div id="mgmtActionCenterList">'+actionListHtml(false)+'</div><div style="text-align:left;margin-top:10px"><button class="bt" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';
    (document.getElementById('panels')||document.body).insertAdjacentHTML('beforeend',h);
  };

  var REPORT_KEY = 'ptf_crm_management_reports';
  function reports() { return list(REPORT_KEY); }
  function settingsObj() { var x=list('ptf_crm_settings'); return x && !Array.isArray(x) ? x : {}; }
  function saveSettingsObj(x) { setData('ptf_crm_settings',x); }
  /* AN-08 (v34.7.24): دوره با تقویم شمسی ساخته می‌شود (هفته از شنبه، ماه از اول ماه شمسی)
     — پیش از این برچسب دوره میلادی بود و با تقویم عملیاتی سیستم نمی‌خواند. */
  function reportPeriod(kind) { return jalaliRange(kind === 'monthly' ? 'monthly' : 'weekly').label; }
  function reportSchedule() { var s=settingsObj(); return s.managementReportSchedule || {weekly:true,monthly:true}; }
  function reportHistoryHtml() { return reports().slice(0,8).map(function(r){var open=r.fileKey&&typeof openStoredFile==='function'?"openStoredFile('"+jsArg(r.fileKey)+"')":"ptfManagementReportPdf('"+jsArg(r.cd)+"')";return '<div style="padding:6px 0;border-bottom:1px dashed #e2e8f0;font-size:12px"><b>'+esc(r.kind==='monthly'?'ماهانه':r.kind==='quarterly'?'فصلی':r.kind==='annual'?'سالانه':'هفتگی')+'</b> — دوره '+esc(r.period||'')+' <small style="color:#64748b">('+esc(r.t||'')+' — '+esc(r.by||'')+')</small> <button class="bt bt-o" style="font-size:10px;padding:2px 6px" onclick="'+open+'">🖨️</button></div>';}).join('') || '<small style="color:#94a3b8">گزارش ذخیره‌شده‌ای نیست.</small>'; }
  window.ptfManagementReportGenerate = function(kind) {
    if(!canManage()) { alert('⛔ دسترسی ندارید'); return; }
    kind=kind==='monthly'?'monthly':'weekly';
    /* AN-01 (v34.7.24): گزارش دوره‌ای واقعاً دوره‌ای شد — snapshot با بازهٔ همان دوره ساخته
       می‌شود، نه از کل تاریخچه. مبنای تاریخ: صدور سند (issue). */
    var rng=jalaliRange(kind);
    var rec={cd:genCode('MGR'),kind:kind,period:rng.label,periodFromISO:rng.fromISO,periodToISO:rng.toISO,calendar:rng.calendar,
      snapshot:window.ptfManagementAiSnapshot({fromISO:rng.fromISO,toISO:rng.toISO,basis:'issue',periodLabel:rng.label}),
      t:(typeof faDateTime==='function'?faDateTime():new Date().toISOString()),by:(curSession()||{}).name||'',createdAt:new Date().toISOString()};
    var all=reports(); all.unshift(rec); if(all.length>60)all=all.slice(0,60); setData(REPORT_KEY,all);
    try { if(typeof ntfResolveByRef==='function')ntfResolveByRef('MGRPT-'+kind+'-'+rec.period); }catch(eR){}
    try {if(typeof audit==='function')audit('تصمیم‌یار مدیریت','تولید گزارش '+(kind==='monthly'?'ماهانه':'هفتگی'),rec.cd);}catch(eA){}
    window.ptfManagementReportPdf(rec.cd);
    var h=document.getElementById('mgmtReportHistory');if(h)h.innerHTML=reportHistoryHtml();
  };
  window.ptfManagementReportPdf = function(cd) {
    var r=cd?reports().filter(function(x){return x.cd===cd;})[0]:null, d=(r&&r.snapshot)?r.snapshot:window.ptfManagementAiSnapshot();
    var customers=(d.customers||[]).slice(0,10).map(function(c){return '<tr><td>'+esc(c.name)+'</td><td>'+c.rfqs+'</td><td>'+c.offers+'</td><td>'+c.won+'</td><td>'+n(c.open)+'</td><td>'+(c.winRate==null?'—':c.winRate+'٪ ('+c.won+'/'+c.offers+')')+'</td><td>'+money(c.wonValue)+'</td></tr>';}).join('')||'<tr><td colspan="7">داده کافی نیست</td></tr>';
    var insights=(d.insights||[]).map(function(i){return '<li><b>'+esc(i.title)+':</b> '+esc(i.text)+'</li>';}).join('');
    var html='<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>@page{size:A4;margin:14mm}body{font-family:Vazirmatn,Tahoma,sans-serif;color:#1e293b;font-size:12px}h1{color:#0e7490;border-bottom:2px solid #0e7490;padding-bottom:7px}h2{font-size:15px;margin-top:18px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #cbd5e1;padding:6px;text-align:right}th{background:#f1f5f9}</style></head><body><h1>گزارش مدیریتی '+(r&&r.kind==='monthly'?'ماهانه':'هفتگی')+'</h1><p>دوره: '+esc((r&&r.period)||reportPeriod('weekly'))+((r&&r.periodFromISO)?' ('+esc(r.periodFromISO)+' تا '+esc(r.periodToISO||'')+' — مبنا: تاریخ صدور سند)':'')+' | تاریخ تولید: '+esc((r&&r.t)||(typeof faDateTime==='function'?faDateTime():''))+'</p><p style="font-size:11px;color:#64748b">این گزارش فقط رکوردهای همان دوره را می‌شمارد'+((d.portfolio&&d.portfolio.opportunities)?(' | نرخ برد سطح فرصت: '+(d.portfolio.opportunities.winRateAll==null?'—':d.portfolio.opportunities.winRateAll+'٪')+' ('+d.portfolio.opportunities.won+' از '+d.portfolio.opportunities.total+' استعلام)'):'')+((d.riskCounts)?(' | ریسک: تأخیر '+d.riskCounts.overdue+'، QC '+d.riskCounts.qc+'، رکود '+d.riskCounts.stalled):'')+'</p><h2>خلاصه و اقدام‌های پیشنهادی</h2><ol>'+insights+'</ol><h2>مشتریان کلیدی</h2><table><thead><tr><th>مشتری</th><th>RFQ</th><th>CO</th><th>برد</th><th>بی‌تکلیف</th><th>نرخ برد (از کل)</th><th>ارزش برد</th></tr></thead><tbody>'+customers+'</tbody></table><h2>کیفیت داده</h2><p>پیشنهاد بی‌مشتری: '+n((d.dataQuality||{}).offersMissingBuyer)+' | باخت بدون دلیل: '+n((d.dataQuality||{}).lostWithoutReason)+' | RFQ بدون مسئول: '+n((d.dataQuality||{}).rfqWithoutOwner)+' | پیشنهاد بی‌تکلیف: '+n((d.dataQuality||{}).offersUndecided)+' | ارزی بدون نرخ مرجع: '+n((d.dataQuality||{}).offersFxNoRate)+'</p><p style="font-size:11px;color:#64748b">تعریف سنجه: «نرخ برد» = برد تقسیم بر کل پیشنهادهای صادرشده. مبالغ به ریال نرمال شده‌اند و اسناد ارزی بدون نرخ مرجع در جمع‌ها وارد نشده‌اند. وصول از منبع واحد مالی خوانده می‌شود.</p><p style="color:#64748b">این گزارش مبتنی بر snapshot داده‌های ثبت‌شده CRM است و هر تصمیم نیازمند تایید مدیریت است.</p></body></html>';
    if(typeof ptfPreviewPrintableDoc==='function')ptfPreviewPrintableDoc('گزارش مدیریتی',html,'management-'+((r&&r.kind)||'weekly'));else{var w=window.open('','_blank');w.document.write(html);w.document.close();}
  };
  window.ptfManagementReportScheduleOpen = function() {
    if(!canManage()){alert('⛔ دسترسی ندارید');return;}
    var q=reportSchedule();
    ptfDialog({title:'🗓️ برنامه گزارش‌های مدیریتی',body:'هشدار گزارش در اولین بازدید CRM در روز مقرر به کارتابل مدیران می‌آید. تولید PDF و تایید محتوا همچنان دستی است.',fields:[
      {id:'weekly',label:'گزارش هفتگی',type:'select',optionsHtml:'<option value="yes"'+(q.weekly?' selected':'')+'>فعال — دوشنبه‌ها</option><option value="no"'+(!q.weekly?' selected':'')+'>غیرفعال</option>'},
      {id:'monthly',label:'گزارش ماهانه',type:'select',optionsHtml:'<option value="yes"'+(q.monthly?' selected':'')+'>فعال — روز اول ماه میلادی</option><option value="no"'+(!q.monthly?' selected':'')+'>غیرفعال</option>'}
    ],okText:'ذخیره برنامه',onOk:function(v){var st=settingsObj();st.managementReportSchedule={weekly:v.weekly==='yes',monthly:v.monthly==='yes'};saveSettingsObj(st);if(typeof ptfToast==='function')ptfToast('✅ برنامه گزارش مدیریتی ذخیره شد','ok');}});
  };
  window.ptfManagementReportCheck = function() {
    if(!canManage())return;
    var q=reportSchedule(), now=new Date(), st=settingsObj(), changed=false;
    [['weekly',q.weekly&&now.getDay()===1],['monthly',q.monthly&&now.getDate()===1]].forEach(function(x){
      if(!x[1])return;var kind=x[0],period=reportPeriod(kind), key='MGRPT-'+kind+'-'+period;
      st.managementReportNotified=st.managementReportNotified||{};if(st.managementReportNotified[key])return;st.managementReportNotified[key]=new Date().toISOString();changed=true;
      try{if(typeof notify==='function')notify({toRoles:['admin','chairman','ceo','commercial'],title:'📊 گزارش مدیریتی '+(kind==='monthly'?'ماهانه':'هفتگی')+' آماده تولید است',body:'دوره '+period+' — از تصمیم‌یار مدیریت PDF را تولید و بررسی کنید.',kind:'management_report',channels:['cart'],link:{panel:'anl'},actionable:true,refCd:key,taskType:'management_report',dkey:key});}catch(e){}
    });
    if(changed)saveSettingsObj(st);
  };

  /* حداقل داده لازم برای AI: فقط top rows و KPI؛ نه متن آزاد، اطلاعات تماس یا فایل‌ها. */
  window.ptfManagementAiSnapshot = function (opts) {
    var d = window.ptfManagementIntelligence(opts || {});
    function customer(c) { return { name:c.name, rfqs:c.rfqs, offers:c.offers, won:c.won, lost:c.lost, open:c.open, expired:c.expired, winRate:c.winRate, winRateBasis:'won/issued', winRateDecided:c.winRateDecided, coverage:c.coverage, wonValue:c.wonValue, wonValueCurrency:'IRR', billed:c.billed, paid:c.paid, collectionRate:c.collectionRate, healthScore:c.healthScore, healthLabel:c.healthLabel, control:c.control, identityResolved:c.resolved!==false }; }
    function product(p) { return { name:p.name, quotes:p.quotes, won:p.won, qty:p.qty, wonValue:p.wonValue }; }
    function supplier(x) { return { name:x.name, quotes:x.quotes, purchases:x.purchases, invited:x.invited||0, replied:x.replied||0, responseRate:x.responseRate, healthScore:x.healthScore, value:x.value }; }
    /* AN-07 (v34.7.24): گیت دفتر رسمی/غیررسمی روی snapshot ارسالی به AI.
       تا امروز هر کاربر دارای پرچم مالی، ارقام تجمیعی هر دو دفتر را می‌دید و همان را با
       دکمهٔ «تفسیر AI» بیرون می‌فرستاد. اکنون دفتر مجاز صریح تعیین و در snapshot و audit ثبت می‌شود. */
    var ledgerScope = 'all';
    try { if (typeof ptfCanSeeLedger === 'function' && !ptfCanSeeLedger('unofficial')) ledgerScope = 'official'; } catch (eLg) {}
    return { generatedAt:d.at, period:d.period, ledgerScope:ledgerScope, riskCounts:d.riskCounts, healthModel:d.healthModel,
      totals:d.totals, portfolio:d.portfolio, metricContract:{ winRate:'won/issued (کل پیشنهادهای صادرشده)', winRateDecided:'won/(won+lost)', currency:'IRR normalized; اسناد ارزی بدون نرخ مرجع کنار گذاشته شده‌اند', collected:'PTF.invPaidSum (بدون فاکتور/پرداخت ابطالی و بدون دوباره‌شماری Receipt)' }, insights:d.insights, dataQuality:d.dataQuality, customers:d.customers.slice(0,12).map(customer), products:d.products.slice(0,12).map(product), suppliers:d.suppliers.slice(0,12).map(supplier), risks:d.risks.slice(0,10) };
  };
  function aiCard(row, color) { return '<div style="border-right:4px solid '+color+';background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:9px 11px;margin:7px 0"><b>'+esc(row.title||'—')+'</b><div style="font-size:12px;color:#475569;margin-top:3px">'+esc(row.why||row.evidence||'')+'</div>'+(row.action||row.mitigation?'<div style="font-size:12px;color:#0f766e;margin-top:4px"><b>اقدام انسانی:</b> '+esc(row.action||row.mitigation)+'</div>':'')+(row.priority?'<small style="color:#64748b">اولویت: '+esc(row.priority)+' | اطمینان: '+esc(row.confidence||'—')+'</small>':'')+'</div>'; }
  window.ptfManagementAiInterpret = function () {
    var out=document.getElementById('mgmtAiOut'), btn=document.getElementById('mgmtAiBtn');
    if (!out) return;
    if (btn) { btn.disabled=true; btn.textContent='⏳ در حال تحلیل...'; }
    out.innerHTML='<div style="color:#64748b;font-size:12px">در حال ارسال snapshot خلاصه و قابل ممیزی به AI…</div>';
    var headers=typeof ptfApiAuthHeaders==='function' ? ptfApiAuthHeaders(true) : {'Content-Type':'application/json'};
    var _snap = window.ptfManagementAiSnapshot(window._ptfMgmtPeriodOpts || {});
    fetch('../api/llm.php?action=management_insight',{method:'POST',headers:headers,body:JSON.stringify({snapshot:_snap})})
      .then(function(r){return r.json();}).then(function(r){
        if(!r.ok || !r.data){ out.innerHTML='<div style="color:#b91c1c">❌ '+esc(r.error||'تحلیل AI ناموفق بود')+'</div>'; return; }
        var a=r.data, h='<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:10px;font-size:12.5px;line-height:1.9"><b>خلاصه مدیریتی:</b> '+esc(a.executive_summary||'—')+'</div>';
        if((a.priorities||[]).length) h+='<h4>اولویت‌های پیشنهادی</h4>'+(a.priorities||[]).map(function(x){return aiCard(x,'#dc2626');}).join('');
        if((a.opportunities||[]).length) h+='<h4>فرصت‌ها</h4>'+(a.opportunities||[]).map(function(x){return aiCard(x,'#047857');}).join('');
        if((a.risks||[]).length) h+='<h4>ریسک‌ها</h4>'+(a.risks||[]).map(function(x){return aiCard(x,'#b45309');}).join('');
        if((a.data_gaps||[]).length) h+='<h4>شکاف داده</h4><ul style="font-size:12px;color:#475569">'+a.data_gaps.map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul>';
        h+='<small style="color:#64748b">'+esc(a.governance_note||'این توصیه‌ها نیازمند بازبینی و تایید مدیریت هستند.')+'</small>';
        out.innerHTML=h;
        try { if(typeof audit==='function') audit('تصمیم‌یار مدیریت','تولید تفسیر AI مدیریت — دفتر: '+(_snap.ledgerScope||'all')+(_snap.period&&_snap.period.active?(' | دوره: '+(_snap.period.label||_snap.period.fromISO+'..'+_snap.period.toISO)):' | دوره: کل تاریخچه'),''); } catch(e) {}
      }).catch(function(){out.innerHTML='<div style="color:#b91c1c">❌ عدم دسترسی به سرویس AI</div>';})
      .finally(function(){if(btn){btn.disabled=false;btn.textContent='✨ تفسیر AI';}});
  };

  /* AN-01 (v34.7.24): انتخاب بازه در خود پنجرهٔ تصمیم‌یار — «کل تاریخچه» پیش‌فرض است تا
     رفتار قبلی تغییر نکند؛ دو گزینهٔ دیگر همان بازه‌های شمسی گزارش‌های دوره‌ای‌اند. */
  window.ptfManagementPeriodSet = function (mode) {
    if (mode === 'weekly' || mode === 'monthly') {
      var r = jalaliRange(mode);
      window._ptfMgmtPeriodOpts = { fromISO: r.fromISO, toISO: r.toISO, basis: 'issue', periodLabel: r.label, mode: mode };
    } else window._ptfMgmtPeriodOpts = null;
    document.querySelectorAll('#mgmtInsightDlg').forEach(function (x) { x.remove(); });
    window.ptfManagementInsightsOpen();
  };
  window.ptfManagementInsightsOpen = function () {
    /* مشتری/سود/وصول دادهٔ مدیریتی است؛ فقط نقش‌های ارشد یا مالی. */
    try { if (typeof isSenior === 'function' && !isSenior() && !((roleDef() || {}).finance)) { alert('⛔ گزارش تصمیم‌یار مدیریت فقط برای نقش‌های ارشد و مالی مجاز است.'); return; } } catch (eRole) {}
    var _pOpts = window._ptfMgmtPeriodOpts || {};
    var d = window.ptfManagementIntelligence(_pOpts);
    var html='<div class="md-b" id="mgmtInsightDlg" style="display:grid;z-index:3000" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:1100px;width:96vw;max-height:92vh;overflow:auto"><h3>🧠 تصمیم‌یار مدیریت فروش — فاز داده‌محور</h3><div style="font-size:11.5px;color:#64748b;margin-bottom:6px">این گزارش از داده‌های ثبت‌شده CRM ساخته شده و هنوز اقدام خودکار انجام نمی‌دهد. هر توصیه نیازمند تایید مدیر است.</div><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:10px;font-size:11.5px"><span style="color:#475569">بازه:</span><button class="bt bt-o" style="font-size:11px;padding:2px 8px'+(!d.period.active?';border-color:#0e7490;color:#0e7490;font-weight:800':'')+'" onclick="ptfManagementPeriodSet(&quot;all&quot;)">کل تاریخچه</button><button class="bt bt-o" style="font-size:11px;padding:2px 8px'+((_pOpts.mode==="weekly")?';border-color:#0e7490;color:#0e7490;font-weight:800':'')+'" onclick="ptfManagementPeriodSet(&quot;weekly&quot;)">هفتهٔ جاری (شمسی)</button><button class="bt bt-o" style="font-size:11px;padding:2px 8px'+((_pOpts.mode==="monthly")?';border-color:#0e7490;color:#0e7490;font-weight:800':'')+'" onclick="ptfManagementPeriodSet(&quot;monthly&quot;)">ماه جاری (شمسی)</button>'+(d.period.active?'<span style="color:#0e7490">دوره: '+esc(d.period.label||(d.period.fromISO+' تا '+d.period.toISO))+' — مبنا: تاریخ صدور سند</span>':'<span style="color:#94a3b8">بدون فیلتر دوره</span>')+'</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px"><div class="sc"><b>'+d.totals.customers+'</b><span>مشتری دارای داده</span></div><div class="sc"><b>'+d.totals.products+'</b><span>کالا/قلم</span></div><div class="sc"><b>'+d.totals.suppliers+'</b><span>تأمین‌کننده دارای قیمت</span></div><div class="sc"><b style="color:#dc2626">'+d.totals.projectsAtRisk+'</b><span>پرونده نیازمند بررسی — تأخیر '+d.riskCounts.overdue+' | QC '+d.riskCounts.qc+' | رکود '+d.riskCounts.stalled+'</span></div></div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px"><div class="sc"><b>'+(d.portfolio.winRateAll==null?'—':d.portfolio.winRateAll+'٪')+'</b><span>نرخ برد سازمان (از کل '+d.portfolio.issued+' پیشنهاد)</span></div><div class="sc"><b'+(d.portfolio.coverage!=null&&d.portfolio.coverage<60?' style="color:#b45309"':'')+'>'+(d.portfolio.coverage==null?'—':d.portfolio.coverage+'٪')+'</b><span>پوشش تعیین تکلیف</span></div><div class="sc"><b'+(d.portfolio.open?' style="color:#b45309"':'')+'>'+d.portfolio.open+'</b><span>پیشنهاد بی‌تکلیف'+(d.portfolio.expired?' ('+d.portfolio.expired+' منقضی)':'')+'</span></div><div class="sc"><b>'+(d.portfolio.opportunities.winRateAll==null?'—':d.portfolio.opportunities.winRateAll+'٪')+'</b><span>نرخ برد در سطح فرصت ('+d.portfolio.opportunities.won+' از '+d.portfolio.opportunities.total+' استعلام)</span></div></div>'+(d.portfolio.coverage!=null&&d.portfolio.coverage<60&&d.portfolio.open>=3?'<div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:8px 11px;margin-bottom:10px;font-size:12px;color:#92400e">⚠️ ستون «نرخ برد» بر مبنای <b>کل پیشنهادهای صادرشده</b> است. عددی که فقط نتایج ثبت‌شده را می‌دید (روش قبل از v34.7.17) با این پوشش به‌شدت خوش‌بینانه می‌شد.</div>':'')+'<h4>اقدامات و بینش‌های مدیریتی</h4>'+d.insights.map(function(i){return insightHtml(i)+'<button class="bt bt-o" style="font-size:11px;padding:3px 8px;margin:-4px 0 7px" onclick="ptfManagementActionOpen(\''+jsArg(i.title)+'\',\''+jsArg(i.text)+'\',\''+jsArg(i.text)+'\')">📌 تبدیل به اقدام</button>';}).join('')+'<h4>مشتریان</h4><div class="tb2"><table><thead><tr><th>مشتری</th><th>RFQ</th><th>CO</th><th>برد</th><th>نرخ برد (از کل)</th><th>ارزش برد</th><th>وصول</th><th>سلامت</th></tr></thead><tbody>'+miniRows(d.customers,'customer')+'</tbody></table></div><h4>کالاهای پرارزش</h4><div class="tb2"><table><thead><tr><th>کالا</th><th>پیشنهاد</th><th>برد</th><th>ارزش برد</th></tr></thead><tbody>'+miniRows(d.products,'product')+'</tbody></table></div><h4>تأمین‌کنندگان</h4><div class="tb2"><table><thead><tr><th>تأمین‌کننده</th><th>رکورد قیمت</th><th>خرید واقعی</th><th>پاسخ</th><th>ارزش قیمت ثبت‌شده</th></tr></thead><tbody>'+miniRows(d.suppliers,'supplier')+'</tbody></table></div><h4 style="margin-top:16px">اقدام‌های مدیریتی باز</h4><div id="mgmtActionsBox">'+actionListHtml(true)+'</div><h4 style="margin-top:16px">گزارش‌های دوره‌ای</h4><div id="mgmtReportHistory">'+reportHistoryHtml()+'</div><div id="mgmtAiOut" style="margin-top:14px"></div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap"><button class="bt bt-o" onclick="ptfManagementReportGenerate(&quot;weekly&quot;)">🗓️ گزارش هفتگی</button><button class="bt bt-o" onclick="ptfManagementReportGenerate(&quot;monthly&quot;)">📅 گزارش ماهانه</button><button class="bt bt-o" onclick="ptfManagementReportScheduleOpen()">⚙️ برنامه گزارش</button><button class="bt bt-o" onclick="ptfManagementActionCenterOpen()">📌 مرکز اقدام‌ها</button><button class="bt" id="mgmtAiBtn" style="background:#7c3aed" onclick="ptfManagementAiInterpret()">✨ تفسیر AI</button><button class="bt bt-o" onclick="ptfManagementInsightsPdf()">🖨️ PDF مدیریتی</button><button class="bt bt-o" onclick="navigator.clipboard.writeText(JSON.stringify(ptfManagementAiSnapshot()))">📋 کپی دادهٔ خلاصه</button><button class="bt" onclick="document.getElementById(\'mgmtInsightDlg\').remove()">بستن</button></div></div></div>';
    (document.getElementById('panels')||document.body).insertAdjacentHTML('beforeend',html);
  };
  window.ptfManagementInsightsPdf = function () {
    var d=window.ptfManagementIntelligence(), rows=function(a){return a.map(function(i){return '<li><b>'+esc(i.title)+':</b> '+esc(i.text)+'</li>';}).join('');};
    var html='<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>@page{size:A4;margin:14mm}body{font-family:Vazirmatn,Tahoma,sans-serif;color:#1e293b;font-size:12px}h1{color:#0e7490;border-bottom:2px solid #0e7490;padding-bottom:7px}h2{font-size:15px;margin-top:18px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #cbd5e1;padding:6px;text-align:right}th{background:#f1f5f9}</style></head><body><h1>گزارش تصمیم‌یار مدیریت فروش</h1><p>تاریخ: '+esc(typeof faDateTime==='function'?faDateTime():d.at)+' | تهیه‌کننده: '+esc((typeof curSession==='function'?curSession().name:''))+'</p><h2>بینش‌ها و اقدامات پیشنهادی</h2><ol>'+rows(d.insights)+'</ol><h2>مشتریان</h2><table><thead><tr><th>مشتری</th><th>RFQ</th><th>CO</th><th>برد</th><th>نرخ برد (از کل)</th><th>ارزش برد</th><th>وصول</th><th>سلامت</th></tr></thead><tbody>'+miniRows(d.customers,'customer')+'</tbody></table><h2>کالاهای پرارزش</h2><table><thead><tr><th>کالا</th><th>پیشنهاد</th><th>برد</th><th>ارزش برد</th></tr></thead><tbody>'+miniRows(d.products,'product')+'</tbody></table><h2>تأمین‌کنندگان</h2><table><thead><tr><th>تأمین‌کننده</th><th>رکورد قیمت</th><th>خرید واقعی</th><th>ارزش قیمت</th></tr></thead><tbody>'+miniRows(d.suppliers,'supplier')+'</tbody></table><p style="margin-top:20px;color:#64748b">محدودیت: این گزارش فقط از داده‌های ثبت‌شده CRM استفاده می‌کند و جایگزین تایید مدیریتی، مالی یا فنی نیست.</p></body></html>';
    if(typeof ptfPreviewPrintableDoc==='function') ptfPreviewPrintableDoc('گزارش تصمیم‌یار مدیریت',html,'management-intelligence'); else {var w=window.open('','_blank');w.document.write(html);w.document.close();}
    try{audit('تصمیم‌یار مدیریت','تولید PDF گزارش مدیریت','');}catch(e){}
  };
  /* بررسی برنامه هنگام load؛ فقط در صورت باز بودن CRM و نقش مجاز اعلان می‌سازد. */
  setTimeout(function(){ try{ window.ptfManagementReportCheck(); }catch(e){} },2500);
})();
