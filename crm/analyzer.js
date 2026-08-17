/* =====================================================================
   PTF CRM — Sprint 65 — US-111
   تحلیلگر هوشمند: قیف فروش، گلوگاه، پیش‌بینی درآمد، Lead Scoring،
   پیشنهادات عملیاتی — موتور قواعد محلی (بدون وابستگی خارجی)
   ===================================================================== */

var ANL_STAGES = [
  { id: 'st1', lb: 'دریافت اولیه' }, { id: 'st2', lb: 'بررسی فنی' }, { id: 'st3', lb: 'استعلام تامین' },
  { id: 'st4', lb: 'ارسال پیشنهاد' }, { id: 'st5', lb: 'مذاکره' }, { id: 'st6', lb: 'سفارش' }, { id: 'st7', lb: 'تحویل' }
];

function _daysBetween(iso1, iso2) {
  try { return Math.max(0, Math.round((new Date(iso2) - new Date(iso1)) / 864e5)); } catch (e) { return 0; }
}

/* ---------- ۱. تحلیل قیف پیشنهادها (TO/CO) ----------
   v34.7.17 (F-01/F-04/F-06 — گزارش ARENA-DECISION-SUPPORT-ANALYZER-DEEP-REVIEW-2026-08-15):
   • مخرج نرخ برد دیگر «فقط بسته‌شده‌ها» نیست. سه سنجهٔ صریح برمی‌گردد:
       winRateAll     = برد / کل پیشنهادهای صادرشده   ← عدد اصلی داشبورد
       winRateDecided = برد / (برد+باخت)               ← عدد کمکی، با برچسب صریح
       coverage       = (برد+باخت) / کل                ← پوشش تعیین تکلیف
   • ارزش بردها به ریال نرمال می‌شود؛ اسناد ارزی بدون نرخ مرجع کنار گذاشته و شمرده می‌شوند.
   • TC (فنی-مالی) مانند تصمیم‌یار و نمودار حاشیه در قیف مالی لحاظ می‌شود (رفع ناسازگاری تعریف).
   • winRate قدیمی برای سازگاری عقب‌رو حفظ شده اما دیگر مبنای هیچ تصمیمی نیست. */
function anlOfferFunnel() {
  var offers = getData('ptf_crm_offers');
  var M = (window.PTF || {}).metrics;
  /* US-FX2RIAL: «نسخه همراه ریالی» (rialOf) سند ارائه به کارفرماست، نه فرصت مستقل —
     در قیف/آمار به‌عنوان پیشنهاد در جریان شمرده نشود تا بردِ قبلی دوشمار نشود. */
  var cos = offers.filter(function (o) { return M ? M.isCommercial(o) : ((o.kind === 'CO' || o.kind === 'TC') && !o.rialOf); });
  var s = M ? M.winStats(cos) : _anlWinStatsFallback(cos);
  return {
    total: s.issued, draft: s.draft, sent: s.sent, won: s.won, lost: s.lost,
    open: s.open, expired: s.expired, decided: s.decided,
    winRateAll: s.winRateAll, winRateDecided: s.winRateDecided, coverage: s.coverage,
    reliable: s.reliable, sample: s.sample, fxGaps: s.fxGaps,
    wonValue: s.wonValueIRR, openValue: s.openValueIRR,
    /* سازگاری عقب‌رو (فقط برای مصرف‌کنندگان قدیمی) */
    winRate: s.winRateDecided,
    tos: offers.filter(function (o) { return o.kind === 'TO'; }).length
  };
}

/* ---------- v31.7.13 US-OFF-MARGIN-ANL: احتمال برد بر حسب حاشیه سود کلی ----------
   یادگیری تدریجی از سوابق: هر CO/TC بسته‌شده (برنده/بازنده) با حاشیه کل محاسبه‌پذیر
   در بازه حاشیه خودش می‌نشیند؛ نرخ برد هر بازه = برآورد احتمال برد با آن حاشیه.
   اعتماد (confidence) با حجم نمونه هر بازه گزارش می‌شود تا تصمیم کور گرفته نشود. */
var ANL_MARGIN_BUCKETS = [
  { lb: 'زیر ۰٪ (زیان)', min: -Infinity, max: 0 },
  { lb: '۰ تا ۵٪', min: 0, max: 5 },
  { lb: '۵ تا ۱۰٪', min: 5, max: 10 },
  { lb: '۱۰ تا ۱۵٪', min: 10, max: 15 },
  { lb: '۱۵ تا ۲۰٪', min: 15, max: 20 },
  { lb: '۲۰ تا ۳۰٪', min: 20, max: 30 },
  { lb: 'بالای ۳۰٪', min: 30, max: Infinity }
];
function anlMarginWinCurve() {
  var offers = getData('ptf_crm_offers');
  var closed = offers.filter(function (o) { return (o.kind === 'CO' || o.kind === 'TC') && (o.st === 'won' || o.st === 'lost'); });
  var buckets = ANL_MARGIN_BUCKETS.map(function (b) { return { lb: b.lb, min: b.min, max: b.max, won: 0, lost: 0, n: 0 }; });
  var usable = 0, skipped = 0;
  closed.forEach(function (o) {
    /* snapshot لحظه بسته‌شدن مقدم است؛ سوابق قدیمی بدون snapshot از محاسبه زنده استفاده می‌کنند */
    var om = (o.marginAtClose && o.marginAtClose.marginPct != null) ? o.marginAtClose
      : ((typeof window.ptfOfferOverallMargin === 'function') ? window.ptfOfferOverallMargin(o) : null);
    var m = om && om.marginPct != null ? om.marginPct : null;
    if (m == null) { skipped++; return; }
    usable++;
    for (var i = 0; i < buckets.length; i++) {
      if (m > buckets[i].min - 1e-9 && m <= buckets[i].max) {
        if (o.st === 'won') buckets[i].won++; else buckets[i].lost++;
        buckets[i].n++;
        break;
      }
    }
  });
  buckets.forEach(function (b) {
    b.winPct = b.n ? Math.round(b.won * 100 / b.n) : null;
    /* اعتماد ساده مبتنی بر حجم نمونه: <3 کم | 3-9 متوسط | >=10 بالا */
    b.conf = b.n >= 10 ? 'بالا' : b.n >= 3 ? 'متوسط' : b.n >= 1 ? 'کم' : null;
  });
  /* بهترین بازه: بیشینه winPct در میان بازه‌های دارای حداقل ۳ نمونه */
  var best = null;
  buckets.forEach(function (b) { if (b.n >= 3 && b.winPct != null && (!best || b.winPct > best.winPct)) best = b; });
  return { buckets: buckets, usable: usable, skipped: skipped, closedTotal: closed.length, best: best };
}
window.anlMarginWinCurve = anlMarginWinCurve;

/* fallback هم‌رفتار با crm/metrics-shared.js — اگر لایهٔ سنجه بارگذاری نشده باشد،
   تحلیلگر نباید صفر یا عدد متورم بدهد. تعریف‌ها دقیقاً همان قرارداد v34.7.17 است. */
function _anlWinStatsFallback(cos) {
  var today = new Date().toISOString().slice(0, 10);
  var s = { issued: 0, won: 0, lost: 0, decided: 0, open: 0, expired: 0, draft: 0, sent: 0,
    wonValueIRR: 0, openValueIRR: 0, fxGaps: 0 };
  (cos || []).forEach(function (o) {
    s.issued++;
    var raw = (o.items || []).reduce(function (a, it) { return a + (+it.qty || 0) * (+it.price || 0); }, 0);
    var rate = (!o.currency || o.currency === 'IRR') ? 1 : (+o.fxRateRef || (o.fxConvert && +o.fxConvert.rate) || 0);
    var irr = rate ? Math.round(raw * rate) : 0;
    if (!rate) s.fxGaps++;
    if (o.st === 'draft') s.draft++;
    if (o.st === 'sent') s.sent++;
    if (o.st === 'won') { s.won++; s.wonValueIRR += irr; }
    else if (o.st === 'lost') { s.lost++; }
    else {
      s.open++; s.openValueIRR += irr;
      var v = String(o.validUntil || '').slice(0, 10);
      if (v && v < today) s.expired++;
    }
  });
  s.decided = s.won + s.lost;
  s.winRateAll = s.issued >= 3 ? Math.round(s.won * 1000 / s.issued) / 10 : null;
  s.winRateDecided = s.decided >= 3 ? Math.round(s.won * 1000 / s.decided) / 10 : null;
  s.coverage = s.issued ? Math.round(s.decided * 1000 / s.issued) / 10 : null;
  s.sample = s.issued;
  s.reliable = s.issued >= 3 && s.coverage != null && s.coverage >= 60;
  return s;
}

/* ---------- ۲. تحلیل لیدها ---------- */
function anlLeads() {
  var leads = getData('ptf_crm_leads');
  var open_ = leads.filter(function (l) { return l.stage !== 'won' && l.stage !== 'lost'; });
  var won = leads.filter(function (l) { return l.stage === 'won'; });
  var lost = leads.filter(function (l) { return l.stage === 'lost'; });
  var rate = leads.length ? Math.round(won.length * 100 / leads.length) : null;
  var days = won.filter(function (l) { return l.firstISO && l.convISO; })
    .map(function (l) { return _daysBetween(l.firstISO, l.convISO); });
  var avgDays = days.length ? Math.round(days.reduce(function (a, b) { return a + b; }, 0) / days.length) : null;
  // بهترین منبع
  var bySrc = {};
  leads.forEach(function (l) {
    var s = l.src || '?';
    bySrc[s] = bySrc[s] || { t: 0, w: 0 };
    bySrc[s].t++;
    if (l.stage === 'won') bySrc[s].w++;
  });
  var bestSrc = null, bestRate = -1;
  Object.keys(bySrc).forEach(function (k) {
    if (bySrc[k].t >= 2) {
      var r = bySrc[k].w / bySrc[k].t;
      if (r > bestRate) { bestRate = r; bestSrc = k; }
    }
  });
  return { total: leads.length, open: open_.length, won: won.length, lost: lost.length,
    rate: rate, avgDays: avgDays, bestSrc: bestSrc, bySrc: bySrc, openList: open_ };
}

/* ---------- ۳. Lead Scoring (AC4) ---------- */
function anlScoreLead(l) {
  var score = 0;
  // ارزش برآوردی
  var v = +l.val || 0;
  if (v >= 5e9) score += 30; else if (v >= 1e9) score += 22; else if (v >= 2e8) score += 14; else if (v > 0) score += 7;
  // صنعت هدف
  if (['نفت و گاز', 'پتروشیمی', 'نیروگاه', 'فولاد'].indexOf(l.ind) > -1) score += 15;
  // منبع (معرفی و نمایشگاه گرم‌ترند)
  if (l.src === 'معرفی') score += 15; else if (l.src === 'نمایشگاه') score += 10; else if (l.src === 'وب‌سایت') score += 8; else score += 4;
  // فعالیت: تعداد پیگیری‌ها
  var fu = (l.hist || []).filter(function (h) { return h.k !== 'ثبت' && h.k !== 'وضعیت'; }).length;
  score += Math.min(20, fu * 5);
  // پیشرفت مرحله
  var stagePts = { new: 0, call1: 5, nego: 12, offer: 20 };
  score += stagePts[l.stage] || 0;
  // تازگی: اگر آخرین رویداد قدیمی است، کسر
  return Math.min(100, score);
}

/* ---------- ۴. پیش‌بینی درآمد (AC1 — میانگین متحرک ساده) ----------
   v34.7.17 (F-02/F-05): ضریب احتمال دیگر از نرخ بردِ متورم گرفته نمی‌شود؛ برآورد هموارشدهٔ
   بیزی روی «کل پیشنهادهای صادرشده» با سقف محافظه‌کارانه. وصول از منبع واحد مالی خوانده می‌شود. */
function anlForecast() {
  // از فاکتورها (وصولی‌ها) و CO های برنده
  var M = (window.PTF || {}).metrics;
  var invs = getData('ptf_crm_invoices');
  var totalInvoiced = 0, totalPaid = 0;
  invs.forEach(function (i) {
    if (M) { totalInvoiced += M.invoiceBilledIRR(i); totalPaid += M.invoiceCollectedIRR(i); return; }
    totalInvoiced += (+i.amount || 0);
    ((i.payments || []).concat(i.pays || [])).forEach(function (p) { totalPaid += +p.amt || 0; });
  });
  var openRecv = Math.max(0, totalInvoiced - totalPaid);
  var f = anlOfferFunnel();
  // پایپ‌لاین وزنی: ارزش پیشنهادهای باز (ارسالی) × احتمال برد هموارشده — بدون نسخه همراه ریالی (US-FX2RIAL)
  var sentValue = 0, sentFxGaps = 0;
  getData('ptf_crm_offers').filter(function (o) {
    return o.st === 'sent' && (M ? M.isCommercial(o) : ((o.kind === 'CO' || o.kind === 'TC') && !o.rialOf));
  }).forEach(function (o) {
    if (M) { var t = M.offerTotalIRR(o); if (t.ok) sentValue += t.irr; else sentFxGaps++; return; }
    sentValue += (o.items || []).reduce(function (s, it) { return s + (+it.qty || 0) * (+it.price || 0); }, 0);
  });
  var p = M ? M.pWin(f.won, f.total) : ((f.won + 1.5) / (f.total + 5));
  return { invoiced: totalInvoiced, paid: totalPaid, openRecv: openRecv,
    pipeline: sentValue, pipelineFxGaps: sentFxGaps,
    weighted: Math.round(sentValue * p), winP: Math.round(p * 1000) / 10 };
}

/* ---------- ۵. پیشنهادات عملیاتی (AC2) ---------- */
function anlSuggestions() {
  var out = [];
  var today = new Date().toISOString().slice(0, 10);

  // لیدهای بدون پیگیری > ۷ روز
  getData('ptf_crm_leads').forEach(function (l) {
    if (l.stage === 'won' || l.stage === 'lost') return;
    var last = l.firstISO;
    (l.hist || []).forEach(function (h) { if (h.nextISO) last = h.nextISO; });
    if (last && _daysBetween(last, today) > 7)
      out.push({ p: 1, icon: '🔔', tx: 'لید «' + l.co + '» بیش از ۷ روز بدون پیگیری است', act: { panel: 'leads' } });
  });

  // CO های sent قدیمی (نسخه همراه ریالی فرصت مستقل نیست — US-FX2RIAL)
  getData('ptf_crm_offers').forEach(function (o) {
    if (o.kind === 'CO' && o.st === 'sent' && !o.rialOf && o.dateEn && _daysBetween(o.dateEn, today) > 10)
      out.push({ p: 1, icon: '📄', tx: 'پیشنهاد ' + o.no + ' (' + (o.buyerCo || '') + ') ' + _daysBetween(o.dateEn, today) + ' روز بدون تعیین تکلیف — پیگیری کنید', act: { panel: 'off' } });
  });

  // فاکتورهای وصول‌نشده (v34.7.17 — F-05: از منبع واحد مالی و بدون فاکتور ابطالی)
  var _M = (window.PTF || {}).metrics;
  getData('ptf_crm_invoices').forEach(function (i) {
    if (_M && !_M.invoiceActive(i)) return;
    var paid = _M ? _M.invoiceCollectedIRR(i) : ((i.payments || []).concat(i.pays || [])).reduce(function (s, p) { return s + (+p.amt || 0); }, 0);
    if (paid < i.amount)
      out.push({ p: 2, icon: '💰', tx: 'فاکتور ' + i.no + ': ' + Math.round((i.amount - paid)).toLocaleString('fa-IR') + ' ریال وصول‌نشده', act: { panel: 'recv' } });
  });

  // درخواست‌های بدون پیشنهاد
  var iq = {};
  getData('ptf_crm_inqitems').forEach(function (r) { iq[r.inqNo] = 1; });
  var offers = getData('ptf_crm_offers');
  Object.keys(iq).forEach(function (k) {
    if (!offers.filter(function (o) { return o.inqNo === k; }).length)
      out.push({ p: 1, icon: '📋', tx: 'درخواست ' + k + ' اقلام دارد ولی هنوز پیشنهادی صادر نشده', act: { panel: 'inqs' } });
  });

  // یادآورهای عقب‌افتاده (فقط موارد مربوط به کاربر جاری)
  var over = getData('ptf_crm_reminders').filter(function (r) {
    if (!(r.st === 'open' && r.dueISO < today)) return false;
    if (typeof remIsMine === 'function') return remIsMine(r);
    return true;
  }).length;
  if (over) out.push({ p: 1, icon: '⏰', tx: over + ' یادآور عقب‌افتاده دارید', act: { panel: 'rem' } });

  // پرونده‌های تحویل جزئی
  getData('ptf_crm_projects').forEach(function (p) {
    if (p.state === 'partial')
      out.push({ p: 3, icon: '📦', tx: 'پرونده ' + p.no + ' در وضعیت تحویل جزئی — اقلام باقیمانده را برنامه‌ریزی کنید', act: { panel: 'prj' } });
  });

  // نامه‌های در انتظار امضا
  var pend = getData('ptf_crm_letters').filter(function (l) { return l.st === 'pending'; }).length;
  if (pend) out.push({ p: 2, icon: '✍️', tx: pend + ' نامه در انتظار امضاست', act: { panel: 'let' } });

  /* v34.7.17 (F-01): پوشش پایین تعیین تکلیف، اتکاپذیری نرخ برد را از بین می‌برد */
  try {
    var _f = anlOfferFunnel();
    if (_f.open >= 3 && _f.coverage != null && _f.coverage < 60)
      out.push({ p: 1, icon: '📊', tx: _f.open + ' پیشنهاد بدون ثبت برد/باخت' + (_f.expired ? ' (' + _f.expired + ' مورد منقضی)' : '') +
        ' — تا تعیین تکلیف نشوند، نرخ برد و پیش‌بینی درآمد قابل استناد نیست', act: { panel: 'off' } });
  } catch (eCov) {}

  out.sort(function (a, b) { return a.p - b.p; });
  return out.slice(0, 12);
}
/* ---------- UI پنل تحلیلگر ---------- */
function buildAnalyzer() {
  return '<div class="ph"><h3>📊 تحلیلگر هوشمند</h3>' +
    '<div class="sb2"><button class="bt" style="background:#0e7490" onclick="ptfManagementInsightsOpen()">🧠 تصمیم‌یار مدیریت</button><button class="bt bt-o" onclick="anlExportReport()">🖨️ گزارش PDF</button></div></div>' +
    '<div id="anlWrap"></div>';
}

function _bar(pct, color) {
  return '<div style="background:#f1f5f9;border-radius:7px;height:12px;position:relative;overflow:hidden;min-width:80px">' +
    '<div style="position:absolute;right:0;top:0;bottom:0;width:' + Math.min(100, pct) + '%;background:' + color + '"></div></div>';
}

function renderAnalyzer() {
  var el = document.getElementById('anlWrap');
  if (!el) return;
  var f = anlOfferFunnel();
  var ld = anlLeads();
  var fc = anlForecast();
  var sugg = anlSuggestions();

  // کارت‌های کلیدی (v34.7.17 — F-01/F-08: عدد اصلی = نرخ برد از کل آفرها + حجم نمونه و پوشش)
  var wrPrimary = f.winRateAll != null ? f.winRateAll + '٪' : '—';
  var wrSub = 'نرخ برد (از کل ' + f.total + ' پیشنهاد)';
  var covWarn = (f.coverage != null && f.coverage < 60 && f.open > 0);
  var h = '<div class="sr" style="grid-template-columns:repeat(4,1fr)">' +
    '<div class="sc"><b>' + wrPrimary + '</b><span>' + wrSub + (f.sample < 3 ? ' — نمونه ناکافی' : ' — ' + f.won + ' از ' + f.total) + '</span></div>' +
    '<div class="sc"><b>' + (f.winRateDecided != null ? f.winRateDecided + '٪' : '—') + '</b><span>نرخ برد در بین نتایج ثبت‌شده (' + f.won + '/' + f.decided + ')</span></div>' +
    '<div class="sc"><b' + (covWarn ? ' style="color:#b45309"' : '') + '>' + (f.coverage != null ? f.coverage + '٪' : '—') + '</b><span>پوشش تعیین تکلیف — ' + f.open + ' پیشنهاد بی‌تکلیف</span></div>' +
    '<div class="sc"><b style="color:#dc2626">' + fc.openRecv.toLocaleString('fa-IR') + '</b><span>مطالبات باز (ریال)</span></div>' +
    '</div>';
  if (covWarn) {
    h += '<div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:12px;padding:9px 12px;margin-bottom:12px;font-size:12.5px;color:#92400e">' +
      '⚠️ <b>هشدار اتکاپذیری:</b> ' + f.open + ' پیشنهاد هنوز برد/باخت آن ثبت نشده' + (f.expired ? ' (' + f.expired + ' مورد از تاریخ اعتبار گذشته)' : '') +
      ' — «نرخ برد در بین نتایج ثبت‌شده» با این پوشش (' + f.coverage + '٪) قابل استناد نیست. مبنای تصمیم، عدد کارت اول است.</div>';
  }
  if (f.fxGaps) {
    h += '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:9px 12px;margin-bottom:12px;font-size:12.5px;color:#1e40af">' +
      'ℹ️ ' + f.fxGaps + ' پیشنهاد ارزی نرخ مرجع تبدیل ندارد و مبلغ آن در جمع‌های ریالی <b>وارد نشده</b> است (به‌جای جمع‌شدن خام با ریال). برای کامل‌شدن ارقام، نرخ مرجع سند را ثبت کنید.</div>';
  }
  /* کارت‌های لید (پیش از v34.7.17 در ردیف اول بودند؛ جای آن‌ها را سنجه‌های اتکاپذیری نرخ برد گرفت) */
  h += '<div class="sr" style="grid-template-columns:repeat(3,1fr)">' +
    '<div class="sc"><b>' + (ld.rate != null ? ld.rate + '٪' : '—') + '</b><span>نرخ تبدیل لیدها (' + ld.won + '/' + ld.total + ')</span></div>' +
    '<div class="sc"><b>' + (ld.avgDays != null ? ld.avgDays + ' روز' : '—') + '</b><span>میانگین زمان تبدیل لید</span></div>' +
    '<div class="sc"><b style="color:#047857">' + f.wonValue.toLocaleString('fa-IR') + '</b><span>ارزش بردها (ریال نرمال‌شده)</span></div>' +
    '</div>';

  /* AN-03 (v34.7.24): سنجهٔ سطح فرصت کنار سنجهٔ سند — چند پیشنهاد موازی برای یک استعلام
     نباید مخرج را متورم کند. سنجهٔ سند برای مقایسه و سازگاری حفظ شده است. */
  try {
    var _M = (window.PTF || {}).metrics;
    if (_M && typeof _M.opportunityStats === 'function') {
      var op = _M.opportunityStats(getData('ptf_crm_offers'));
      h += '<div style="background:#fff;border:1px solid var(--brd);border-radius:14px;padding:12px;margin-bottom:12px">' +
        '<h4 style="margin:0 0 8px;font-size:13.5px">🎯 نرخ برد در سطح «فرصت» (هر استعلام = یک فرصت)</h4>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;font-size:12.5px">' +
        '<div style="background:#f8fafc;border-radius:10px;padding:9px"><b style="display:block;font-size:15px">' + (op.winRateAll == null ? '—' : op.winRateAll + '٪') + '</b>نرخ برد فرصت‌ها (' + op.won + ' از ' + op.total + ')</div>' +
        '<div style="background:#f8fafc;border-radius:10px;padding:9px"><b style="display:block;font-size:15px">' + op.open + '</b>فرصت باز</div>' +
        '<div style="background:#f8fafc;border-radius:10px;padding:9px"><b style="display:block;font-size:15px">' + (op.coverage == null ? '—' : op.coverage + '٪') + '</b>پوشش تعیین تکلیف فرصت‌ها</div>' +
        '</div><div style="font-size:11px;color:#64748b;margin-top:7px">اختلاف این عدد با نرخ برد سطح سند یعنی برای بعضی استعلام‌ها بیش از یک پیشنهاد صادر شده است.</div></div>';
    }
  } catch (eOp) {}

  // قیف پیشنهادها
  var maxF = Math.max(f.draft, f.sent, f.won, f.lost, 1);
  h += '<div style="background:#fff;border:1px solid var(--brd);border-radius:14px;padding:14px;margin-bottom:12px">' +
    '<h4 style="margin:0 0 10px;font-size:13.5px">📄 قیف پیشنهادهای مالی (CO/TC) — کل: ' + f.total + ' | TO: ' + f.tos + '</h4>' +
    [['پیش‌نویس', f.draft, '#94a3b8'], ['ارسال‌شده', f.sent, '#0ea5e9'], ['برنده 🏆', f.won, '#10b981'], ['بازنده', f.lost, '#ef4444']].map(function (r) {
      return '<div style="display:grid;grid-template-columns:80px 1fr 40px;gap:8px;align-items:center;margin-bottom:6px;font-size:12.5px">' +
        '<span>' + r[0] + '</span>' + _bar(r[1] * 100 / maxF, r[2]) + '<b>' + r[1] + '</b></div>';
    }).join('') +
    '<div style="font-size:12px;color:#64748b;margin-top:6px">بی‌تکلیف (بدون برد/باخت): <b>' + f.open + '</b>' +
      (f.expired ? ' — از این تعداد <b style="color:#b45309">' + f.expired + '</b> مورد از تاریخ اعتبار گذشته است' : '') + '</div>' +
    (f.won ? '<div style="font-size:12px;color:#047857;margin-top:6px">ارزش کل بردها (نرمال‌شده به ریال): ' + f.wonValue.toLocaleString('fa-IR') + ' ریال</div>' : '') +
    '</div>';

  /* v31.7.13 US-OFF-MARGIN-ANL: نمودار احتمال برد بر حسب حاشیه سود کلی */
  try {
    var mw = anlMarginWinCurve();
    var mwRows = mw.buckets.map(function (b) {
      if (!b.n) return '<div style="display:grid;grid-template-columns:110px 1fr 120px;gap:8px;align-items:center;margin-bottom:6px;font-size:12px;color:#cbd5e1"><span>' + b.lb + '</span>' + _bar(0, '#e2e8f0') + '<span>بدون سابقه</span></div>';
      var col = b.winPct >= 60 ? '#10b981' : b.winPct >= 35 ? '#f59e0b' : '#ef4444';
      return '<div style="display:grid;grid-template-columns:110px 1fr 120px;gap:8px;align-items:center;margin-bottom:6px;font-size:12px">' +
        '<span>' + b.lb + '</span>' + _bar(b.winPct, col) +
        '<span title="' + b.won + ' برد از ' + b.n + ' پیشنهاد بسته‌شده"><b>' + b.winPct + '٪</b> <small style="color:#64748b">(' + b.won + '/' + b.n + ' | اعتماد ' + b.conf + ')</small></span></div>';
    }).join('');
    h += '<div style="background:#fff;border:1px solid var(--brd);border-radius:14px;padding:14px;margin-bottom:12px">' +
      '<h4 style="margin:0 0 4px;font-size:13.5px">📈 احتمال برد بر حسب حاشیه سود کلی صورت</h4>' +
      '<div style="font-size:11px;color:#64748b;margin-bottom:10px">مبنا: ' + mw.usable + ' پیشنهاد بسته‌شده دارای نرخ مرجع خرید' + (mw.skipped ? ' — ' + mw.skipped + ' پیشنهاد بدون نرخ مرجع از تحلیل خارج شد (برای دقت بیشتر، نرخ مرجع اقلام را کامل کنید)' : '') + '</div>' +
      (mw.usable ? mwRows : '<div style="text-align:center;color:#94a3b8;padding:14px;font-size:12.5px">هنوز پیشنهاد بسته‌شده‌ای با نرخ مرجع ثبت نشده — با برنده/بازنده شدن پیشنهادها، این نمودار به‌مرور شکل می‌گیرد.</div>') +
      (mw.best ? '<div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:8px 12px;margin-top:8px;font-size:12.5px;color:#047857">💡 <b>پیشنهاد سیستم:</b> بازه «' + mw.best.lb + '» تاکنون بالاترین نرخ برد را داشته (' + mw.best.winPct + '٪ از ' + mw.best.n + ' مورد — اعتماد ' + mw.best.conf + ').' + (mw.usable < 10 ? ' <span style="color:#b45309">حجم نمونه هنوز کم است؛ با بسته‌شدن پیشنهادهای بیشتر، اتکاپذیری بالا می‌رود.</span>' : '') + '</div>' : '') +
      '</div>';
  } catch (eMW) {}

  // پیش‌بینی درآمد
  h += '<div style="background:#fff;border:1px solid var(--brd);border-radius:14px;padding:14px;margin-bottom:12px">' +
    '<h4 style="margin:0 0 10px;font-size:13.5px">🔮 پیش‌بینی و جریان مالی</h4>' +
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;font-size:12.5px">' +
    '<div style="background:#f8fafc;border-radius:10px;padding:10px"><b style="display:block;font-size:15px">' + fc.invoiced.toLocaleString('fa-IR') + '</b>فاکتور شده</div>' +
    '<div style="background:#ecfdf5;border-radius:10px;padding:10px"><b style="display:block;font-size:15px;color:#047857">' + fc.paid.toLocaleString('fa-IR') + '</b>وصول شده</div>' +
    '<div style="background:#eff6ff;border-radius:10px;padding:10px"><b style="display:block;font-size:15px;color:#1d4ed8">' + fc.pipeline.toLocaleString('fa-IR') + '</b>پایپ‌لاین (COهای ارسالی)</div>' +
    '<div style="background:#fdf4ff;border-radius:10px;padding:10px"><b style="display:block;font-size:15px;color:#a21caf">' + fc.weighted.toLocaleString('fa-IR') + '</b>پیش‌بینی وزنی (احتمال ' + fc.winP + '٪)</div>' +
    '</div>' +
    '<div style="font-size:11px;color:#64748b;margin-top:8px">ضریب احتمال از برآورد هموارشده روی کل پیشنهادهای صادرشده به‌دست می‌آید (نه از نرخ بردِ نتایج ثبت‌شده) و سقف محافظه‌کارانهٔ ۷۰٪ دارد؛ به همین دلیل با نمونهٔ کم به ۱۰۰٪ نمی‌رسد.' +
    (fc.pipelineFxGaps ? ' — ' + fc.pipelineFxGaps + ' پیشنهاد ارزی بدون نرخ مرجع از پایپ‌لاین کنار گذاشته شد.' : '') + '</div></div>';

  // منابع لید
  if (ld.total) {
    h += '<div style="background:#fff;border:1px solid var(--brd);border-radius:14px;padding:14px;margin-bottom:12px">' +
      '<h4 style="margin:0 0 10px;font-size:13.5px">🎯 عملکرد منابع لید' + (ld.bestSrc ? ' — بهترین: <b style="color:#0e7490">' + escP(ld.bestSrc) + '</b>' : '') + '</h4>' +
      Object.keys(ld.bySrc).map(function (k) {
        var v = ld.bySrc[k];
        var r = v.t ? Math.round(v.w * 100 / v.t) : 0;
        return '<div style="display:grid;grid-template-columns:90px 1fr 90px;gap:8px;align-items:center;margin-bottom:6px;font-size:12.5px">' +
          '<span>' + escP(k) + '</span>' + _bar(r, '#f79400') + '<span>' + v.w + '/' + v.t + ' (' + r + '٪)</span></div>';
      }).join('') + '</div>';
  }

  // Lead Scoring
  var scored = ld.openList.map(function (l) { return { l: l, s: anlScoreLead(l) }; })
    .sort(function (a, b) { return b.s - a.s; }).slice(0, 8);
  if (scored.length) {
    h += '<div style="background:#fff;border:1px solid var(--brd);border-radius:14px;padding:14px;margin-bottom:12px">' +
      '<h4 style="margin:0 0 10px;font-size:13.5px">🏅 اولویت‌بندی لیدهای باز (Lead Scoring)</h4>' +
      '<div class="tb2"><table><thead><tr><th>امتیاز</th><th>شرکت</th><th>مرحله</th><th>ارزش</th><th>منبع</th></tr></thead><tbody>' +
      scored.map(function (x) {
        var cl = x.s >= 60 ? '#10b981' : x.s >= 35 ? '#f59e0b' : '#94a3b8';
        return '<tr style="cursor:pointer" onclick="goPanelByName(\'leads\')"><td><b style="color:' + cl + '">' + x.s + '</b></td>' +
          '<td>' + escP(x.l.co) + '</td><td>' + escP((typeof stageOf === 'function' ? stageOf(x.l.stage).lb : x.l.stage)) + '</td>' +
          '<td>' + (x.l.val ? (+x.l.val).toLocaleString('fa-IR') : '-') + '</td><td>' + escP(x.l.src || '-') + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';
  }

  // پیشنهادات عملیاتی
  h += '<div style="background:#fff8f5;border:1px solid #fecaca;border-radius:14px;padding:14px">' +
    '<h4 style="margin:0 0 10px;font-size:13.5px;color:#b91c1c">💡 پیشنهادات عملیاتی (' + sugg.length + ')</h4>' +
    (sugg.length ? sugg.map(function (s) {
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px dashed #fecaca;font-size:12.5px">' +
        '<span>' + s.icon + ' ' + escP(s.tx) + '</span>' +
        '<button class="bt bt-o" style="padding:3px 10px;font-size:11px" onclick="goPanelByName(\'' + s.act.panel + '\')">برو ↗</button></div>';
    }).join('') : '<div style="color:#94a3b8;font-size:12px">فعلاً موردی نیست — همه چیز به‌روز است 👌</div>') +
    '</div>';

  el.innerHTML = h;
}

/* ---------- گزارش PDF (AC6) ---------- */
function anlExportReport() {
  var f = anlOfferFunnel(), ld = anlLeads(), fc = anlForecast(), sugg = anlSuggestions();
  var row = function (a, b) { return '<tr><td style="border:1px solid #999;padding:6px 10px">' + a + '</td><td style="border:1px solid #999;padding:6px 10px;text-align:center"><b>' + b + '</b></td></tr>'; };
  var fullHtml = '<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>ANL-' + (typeof faDate==='function'?faDate().replace(/\//g,'-'):'') + ' گزارش تحلیلی</title><style>' +
    '@page{size:A4 portrait;margin:14mm}body{font-family:Vazirmatn,Tahoma,sans-serif;font-size:12px;color:#222}' +
    'h1{font-size:17px;color:#ef4b1a;border-bottom:2px solid #f79400;padding-bottom:6px}h2{font-size:13.5px;margin:14px 0 6px}' +
    'table{border-collapse:collapse;width:100%;font-size:11.5px}</style></head><body>' +
    '<h1>گزارش تحلیلی CRM — پیشرو تجهیز فرتاک</h1>' +
    '<div style="color:#666;font-size:11px">تاریخ گزارش: ' + faDateTime() + ' | تهیه: ' + escP(curSession().name || '') + '</div>' +
    '<h2>قیف پیشنهادها</h2><table>' +
    row('کل پیشنهادهای مالی (CO/TC)', f.total) + row('برنده', f.won) + row('بازنده', f.lost) +
    row('بی‌تکلیف (بدون برد/باخت)', f.open + (f.expired ? ' (از این تعداد ' + f.expired + ' منقضی)' : '')) +
    row('نرخ برد — از کل پیشنهادها', f.winRateAll != null ? f.winRateAll + '٪ (' + f.won + ' از ' + f.total + ')' : '— (نمونه ناکافی)') +
    row('نرخ برد — در بین نتایج ثبت‌شده', f.winRateDecided != null ? f.winRateDecided + '٪ (' + f.won + ' از ' + f.decided + ')' : '— (نمونه ناکافی)') +
    row('پوشش تعیین تکلیف', f.coverage != null ? f.coverage + '٪' : '—') +
    row('ارزش بردها (ریال نرمال‌شده)', f.wonValue.toLocaleString('fa-IR')) + '</table>' +
    (f.coverage != null && f.coverage < 60 && f.open ? '<div style="color:#92400e;font-size:11px;margin-top:5px">⚠️ با پوشش ' + f.coverage + '٪، «نرخ برد در بین نتایج ثبت‌شده» قابل استناد نیست؛ مبنای گزارش، نرخ برد از کل پیشنهادهاست.</div>' : '') +
    (f.fxGaps ? '<div style="color:#1e40af;font-size:11px;margin-top:4px">ℹ️ ' + f.fxGaps + ' پیشنهاد ارزی بدون نرخ مرجع، از جمع‌های ریالی کنار گذاشته شد.</div>' : '') +
    '<h2>لیدها</h2><table>' +
    row('کل لیدها', ld.total) + row('تبدیل‌شده', ld.won) + row('نرخ تبدیل', ld.rate != null ? ld.rate + '٪' : '—') +
    row('میانگین زمان تبدیل', ld.avgDays != null ? ld.avgDays + ' روز' : '—') + row('بهترین منبع', ld.bestSrc || '—') + '</table>' +
    '<h2>مالی</h2><table>' +
    row('فاکتور شده', fc.invoiced.toLocaleString('fa-IR')) + row('وصول شده', fc.paid.toLocaleString('fa-IR')) +
    row('مطالبات باز', fc.openRecv.toLocaleString('fa-IR')) + row('پایپ‌لاین', fc.pipeline.toLocaleString('fa-IR')) +
    row('پیش‌بینی وزنی', fc.weighted.toLocaleString('fa-IR') + ' (احتمال ' + fc.winP + '٪)') + '</table>' +
    '<h2>اقدامات پیشنهادی</h2><ol>' + sugg.map(function (s) { return '<li>' + escP(s.tx) + '</li>'; }).join('') + '</ol>' +
    '</body></html>';
  if (typeof ptfPreviewPrintableDoc === 'function') ptfPreviewPrintableDoc('گزارش تحلیلی CRM', fullHtml, 'analysis-report');
  else {
    var w = window.open('', '_blank');
    w.document.write(fullHtml);
    w.document.close();
  }
  audit('تحلیلگر', 'تولید گزارش تحلیلی PDF', '');
}

/* ---------- روتینگ ---------- */
(function () {
  var _go = window.goPanel;
  window.goPanel = function (id, btn) {
    if (id === 'anl') {
      var r = roleDef();
      // تحلیلگر شامل داده مالی است → فقط نقش‌های دارای finance یا مدیر بازرگانی (بدون بخش مالی؟ نه — طبق ماتریس فقط finance)
      if (!r.finance) { alert('⛔ تحلیلگر شامل گزارش‌های مالی است — مخصوص نقش‌های ارشد دارای دسترسی مالی'); return; }
      var btns = document.querySelectorAll('.sb-i');
      for (var i = 0; i < btns.length; i++) btns[i].classList.remove('act');
      if (btn) btn.classList.add('act');
      document.getElementById('pgTitle').textContent = '📊 تحلیلگر هوشمند';
      document.getElementById('panels').innerHTML = buildAnalyzer();
      renderAnalyzer();
      return;
    }
    _go(id, btn);
  };
})();
