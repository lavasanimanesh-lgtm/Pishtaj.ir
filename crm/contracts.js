/* =====================================================================
   PTF CRM — Sprint 66 — US-119
   دستیار تنظیم قرارداد خرید/فروش — موتور قالب rule-based (فا/EN)
   لایه LLM: آماده — فعال‌سازی با کلید API (همان پروکسی chat-llm.php)
   ===================================================================== */

var CT_CLAUSES = {
  fa: {
    intro: 'این قرارداد فی‌مابین {SELLER} به شماره ثبت {SELLER_REG} (که از این پس «فروشنده» نامیده می‌شود) و {BUYER} (که از این پس «خریدار» نامیده می‌شود) در تاریخ {DATE} منعقد گردید.',
    subject: 'ماده ۱ — موضوع قرارداد:\nتامین و تحویل کالاهای مشروحه در پیوست شماره ۱ (مطابق پیش‌فاکتور شماره {CO_NO}) شامل {ITEMS_SUMMARY} جمعاً به مبلغ {TOTAL} ریال.',
    price: 'ماده ۲ — مبلغ قرارداد:\nمبلغ کل قرارداد {TOTAL} ریال ({TOTAL_WORDS}) است که به‌صورت زیر پرداخت می‌گردد:\n- پیش‌پرداخت: {ADV}٪ همزمان با امضای قرارداد\n- مابقی: {REST}',
    delivery: 'ماده ۳ — زمان و محل تحویل:\nزمان تحویل {DLV_TIME} از تاریخ دریافت پیش‌پرداخت و محل تحویل {DLV_PLACE} می‌باشد.',
    quality: 'ماده ۴ — کیفیت و بازرسی:\nکالاها نو، اصلی و مطابق مشخصات فنی پیوست خواهند بود. فروشنده گواهی متریال (MTC) ارائه می‌نماید.{TPI}',
    warranty: 'ماده ۵ — گارانتی:\nکالاها به مدت {WRN} ماه از تاریخ تحویل در برابر عیوب ساخت گارانتی دارند.',
    penalty: 'ماده ۶ — جریمه تاخیر:\nدر صورت تاخیر غیرموجه در تحویل، به ازای هر هفته تاخیر {PEN}٪ از مبلغ قرارداد (حداکثر {PENMAX}٪) کسر می‌گردد.',
    force: 'ماده ۷ — فورس ماژور:\nدر شرایط قوه قاهره (جنگ، زلزله، سیل، تحریم‌های جدید، مصوبات دولتی) تعهدات طرفین به حالت تعلیق درآمده و طرفین ظرف ۱۵ روز نسبت به اعلام کتبی اقدام می‌نمایند.',
    dispute: 'ماده ۸ — حل اختلاف:\nکلیه اختلافات ابتدا از طریق مذاکره و در صورت عدم حصول نتیجه از طریق {DISPUTE} حل‌وفصل خواهد شد.',
    guarantee_clause: 'ماده ۹ — تضامین:\n{GUARANTEE}',
    final: 'ماده ۱۰ — نسخ قرارداد:\nاین قرارداد در {ARTICLES} ماده و دو نسخه واحدالاعتبار تنظیم و به امضای طرفین رسید.'
  },
  en: {
    intro: 'This Contract is made between {SELLER}, Reg. No. {SELLER_REG} (hereinafter the "Seller") and {BUYER} (hereinafter the "Buyer") on {DATE}.',
    subject: 'Article 1 — Subject:\nSupply and delivery of goods per Annex 1 (ref. Proforma {CO_NO}) including {ITEMS_SUMMARY}, for a total amount of {TOTAL} IRR.',
    price: 'Article 2 — Contract Price & Payment:\nTotal price is {TOTAL} IRR ({TOTAL_WORDS}), payable as:\n- Advance payment: {ADV}% upon signing\n- Balance: {REST}',
    delivery: 'Article 3 — Delivery:\nDelivery time is {DLV_TIME} from receipt of advance payment. Delivery term/place: {DLV_PLACE}{INCOTERM}.',
    quality: 'Article 4 — Quality & Inspection:\nGoods shall be new, genuine and per attached technical specifications. Seller shall provide Material Test Certificates (MTC).{TPI}',
    warranty: 'Article 5 — Warranty:\nGoods are warranted against manufacturing defects for {WRN} months from delivery.',
    penalty: 'Article 6 — Delay Penalty:\nFor unjustified delay, {PEN}% of contract value per week (max {PENMAX}%) shall be deducted.',
    force: 'Article 7 — Force Majeure:\nIn events of force majeure (war, earthquake, flood, new sanctions, governmental acts), obligations are suspended; written notice within 15 days.',
    dispute: 'Article 8 — Dispute Resolution:\nDisputes shall first be settled amicably, failing which through {DISPUTE}.',
    guarantee_clause: 'Article 9 — Guarantees:\n{GUARANTEE}',
    final: 'Article 10 — Copies:\nThis Contract comprises {ARTICLES} articles, executed in two equally valid counterparts.'
  }
};

function ctSerial() {
  var cts = getData('ptf_crm_contracts');
  var max = 0;
  var yr = faYear();
  cts.forEach(function (c) { var m = (c.no || '').match(new RegExp('^PTF-CNT-' + yr + '-(\\d+)$')); if (m && +m[1] > max) max = +m[1]; });
  return 'PTF-CNT-' + yr + '-' + String(max + 1).padStart(3, '0');
}

/* ---------- پنل ---------- */
function buildContracts() {
  return '<div class="ph"><h3>📜 قراردادها</h3>' +
    '<div class="sb2"><button class="bt" onclick="showCtWizard()">+ قرارداد جدید از CO</button></div></div>' +
    '<div id="ctWrap"></div>';
}

function renderContracts() {
  var el = document.getElementById('ctWrap');
  if (!el) return;
  var cts = getData('ptf_crm_contracts');
  el.innerHTML = cts.map(function (c) {
    return '<div style="background:#fff;border:1px solid var(--brd);border-radius:12px;padding:12px;margin-bottom:8px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;align-items:center">' +
      '<div style="font-size:13px"><b dir="ltr">' + escP(c.no) + '</b> — ' + escP(c.buyerCo || '') +
      '<div style="font-size:11.5px;color:#64748b">' + (c.kind === 'sale' ? 'فروش' : 'خرید') + ' | مبنا: <b dir="ltr">' + escP(c.rfqsNo || c.coNo || '—') + '</b> | ' + (c.intl ? 'خارجی' : 'داخلی') + ' | زبان: ' + (c.lang === 'both' ? 'دوزبانه' : c.lang === 'en' ? 'EN' : 'فارسی') + ' | ' + escP(c.t) + ' | نسخه ' + (c.rev || 1) + '</div></div>' +
      '<div style="display:flex;gap:5px">' +
      '<button class="bt bt-o" style="padding:4px 9px;font-size:12px" onclick="ctEdit(\'' + c.no + '\')">✏️ ویرایش متن</button>' +
      '<button class="bt bt-o" style="padding:4px 9px;font-size:12px" onclick="ctPrint(\'' + c.no + '\')">🖨️ PDF</button>' +
      '<button class="bt bt-o" style="padding:4px 9px;font-size:12px;color:#dc2626" onclick="ctDel(\'' + c.no + '\')">🗑️</button>' +
      '</div></div>';
  }).join('') || '<div style="text-align:center;color:#94a3b8;padding:24px">قراردادی تنظیم نشده — از CO شروع کنید</div>';
}

/* ---------- ویزارد (AC1) ---------- */
function showCtWizard() {
  var cos = getData('ptf_crm_offers').filter(function (o) { return o.kind === 'CO' || o.kind === 'TC'; });
  var rfqs = getData('ptf_crm_rfqsmart');
  if (!cos.length && !rfqs.length) { alert('ابتدا یک پیشنهاد مالی (CO) یا درخواست تامین ثبت کنید'); return; }
  var opts = cos.map(function (o) { return '<option value="' + escP(o.no) + '">' + escP(o.no) + ' — ' + escP(o.buyerCo || '') + '</option>'; }).join('');
  /* v13.9 (US-345): قرارداد خرید → لینک به درخواست تامین (استعلامی که به تامین‌کننده فرستادیم)، نه CO */
  var rfqOpts = rfqs.map(function (r) {
    var sup = ((r.targets || []).filter(function (t) { return t.st === 'replied'; })[0] || (r.targets || [])[0] || {}).co || '';
    return '<option value="' + escP(r.no) + '">' + escP(r.no) + (sup ? ' — ' + escP(sup) : '') + ' (' + (r.items || []).length + ' قلم)</option>';
  }).join('');
  var html = '<div class="md-b" style="display:grid" onclick="if(event.target===this)hideModal()"><div class="md" style="max-width:640px;max-height:94vh;overflow:auto">' +
    '<h3>📜 تنظیم قرارداد — پرسشنامه شرایط</h3>' +
    '<div class="fr"><div class="fld"><label>نوع قرارداد *</label><select id="ctKind" onchange="ctKindSwitch()"><option value="sale">فروش (ما فروشنده‌ایم)</option><option value="buy">خرید (ما خریداریم)</option></select></div>' +
    '<div class="fld" id="ctBaseSale"><label>پیش‌فاکتور مبنا (CO/TC) *</label><select id="ctCo">' + (opts || '<option value="">— CO ثبت نشده —</option>') + '</select></div>' +
    '<div class="fld" id="ctBaseBuy" style="display:none"><label>درخواست تامین مبنا *</label><select id="ctRfqs">' + (rfqOpts || '<option value="">— درخواست تامین ثبت نشده —</option>') + '</select></div></div>' +
    '<div class="fr"><div class="fld"><label>داخلی/خارجی</label><select id="ctIntl" onchange="document.getElementById(\'ctIncW\').style.display=this.value==\'1\'?\'\':\'none\'"><option value="0">داخلی</option><option value="1">خارجی (بین‌المللی)</option></select></div>' +
    '<div class="fld"><label>زبان قرارداد</label><select id="ctLang"><option value="fa">فارسی</option><option value="en">English</option><option value="both">دوزبانه</option></select></div></div>' +
    '<div class="fr" id="ctIncW" style="display:none"><div class="fld"><label>اینکوترمز</label><select id="ctInc"><option>EXW</option><option>FCA</option><option>CPT</option><option>CIF</option><option>DAP</option><option selected>DDP</option></select></div><div class="fld"></div></div>' +
    '<div class="fr"><div class="fld"><label>پیش‌پرداخت ٪</label><input type="number" id="ctAdv" value="30" min="0" max="100"></div>' +
    '<div class="fld"><label>نحوه تسویه مابقی</label><input type="text" id="ctRest" value="قبل از تحویل کالا"></div></div>' +
    '<div class="fr"><div class="fld"><label>زمان تحویل</label><input type="text" id="ctDlv" value="۴ هفته کاری"></div>' +
    '<div class="fld"><label>محل تحویل</label><input type="text" id="ctPlace" value="انبار خریدار - تهران"></div></div>' +
    '<div class="fr"><div class="fld"><label>گارانتی (ماه)</label><input type="number" id="ctWrn" value="12"></div>' +
    '<div class="fld"><label>جریمه تاخیر ٪/هفته (سقف ٪)</label><div style="display:flex;gap:6px"><input type="number" id="ctPen" value="0.5" step="0.1" style="width:50%"><input type="number" id="ctPenMax" value="5" style="width:50%"></div></div></div>' +
    '<div class="fr"><div class="fld"><label>تضامین</label><select id="ctGrt"><option value="none">بدون تضمین</option><option value="cheque">چک تضمین حسن انجام تعهدات</option><option value="bg10">ضمانت‌نامه بانکی ۱۰٪ حسن انجام کار</option></select></div>' +
    '<div class="fld"><label>مرجع حل اختلاف</label><select id="ctDsp"><option value="court">محاکم دادگستری تهران</option><option value="arb">داوری اتاق بازرگانی ایران</option><option value="icc">داوری ICC (بین‌المللی)</option></select></div></div>' +
    '<div class="fld"><label style="font-size:12px">بازرسی شخص ثالث (TPI) الزامی <input type="checkbox" id="ctTpi"></label></div>' +
    /* v13.9 (US-345): متن پیش‌نویس/شرایط خاص برای بررسی و پیشنهاد متن نهایی توسط هوش مصنوعی */
    '<details style="margin:8px 0"><summary style="cursor:pointer;font-size:12.5px;color:#7c3aed;font-weight:800">🤖 بررسی متن با هوش مصنوعی (اختیاری)</summary>' +
    '<div class="fld" style="margin-top:8px"><label>متن پیش‌نویس یا شرایط خاص شما (متن قرارداد طرف مقابل، بندهای مورد نظر...)</label>' +
    '<textarea id="ctAiTxt" rows="5" style="font-size:12.5px" placeholder="متن را اینجا بچسبانید — هوش مصنوعی بررسی و متن نهایی پیشنهادی را ارائه می‌دهد"></textarea></div>' +
    '<button type="button" class="bt" style="background:#7c3aed;font-size:12px" onclick="ctAiReview()">🤖 بررسی و پیشنهاد متن نهایی</button>' +
    '<div id="ctAiOut" style="margin-top:8px"></div></details>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end"><button class="bt bt-o" onclick="hideModal()">انصراف</button>' +
    '<button class="bt" onclick="ctGenerate()">تولید پیش‌نویس</button></div></div></div>';
  document.getElementById('panels').insertAdjacentHTML('beforeend', html);
}

/* v13.9 (US-345): سوییچ مبنای قرارداد بر اساس نوع */
window.ctKindSwitch = function () {
  var buy = (document.getElementById('ctKind') || {}).value === 'buy';
  var bs = document.getElementById('ctBaseSale'), bb = document.getElementById('ctBaseBuy');
  if (bs) bs.style.display = buy ? 'none' : '';
  if (bb) bb.style.display = buy ? '' : 'none';
};

/* v13.9 (US-345): بررسی متن قرارداد با هوش مصنوعی — از موتور llm.php موجود */
window.ctAiReview = function () {
  var txt = ((document.getElementById('ctAiTxt') || {}).value || '').trim();
  if (!txt) { alert('ابتدا متن را وارد کنید'); return; }
  var out = document.getElementById('ctAiOut');
  out.innerHTML = '<div style="color:#7c3aed;font-size:12px">⏳ در حال بررسی توسط هوش مصنوعی…</div>';
  var kind = (document.getElementById('ctKind') || {}).value === 'buy' ? 'خرید' : 'فروش';
  fetch('../api/llm.php?action=contract', {
    method: 'POST', headers: (typeof ptfApiAuthHeaders==='function'?ptfApiAuthHeaders(true):{ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ text: txt.slice(0, 5500), kind: (document.getElementById('ctKind') || {}).value })
  }).then(function (r) { return r.json(); }).then(function (d) {
    if (d.ok && d.data && d.data.final) {
      if (typeof ptfAiClean === 'function') d.data.final = ptfAiClean(d.data.final); /* v14.4 US-379 */
      var risks = (d.data.risks || []).map(function (r2) { return '<li>' + escP(typeof ptfAiClean === 'function' ? ptfAiClean(r2) : r2) + '</li>'; }).join('');
      out.innerHTML =
        (risks ? '<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:10px 14px;font-size:12px;margin-bottom:8px"><b style="color:#b45309">⚠️ ریسک‌ها و بندهای مبهم:</b><ul style="margin:6px 0 0;padding-right:18px;line-height:2">' + risks + '</ul></div>' : '') +
        '<div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:12px;padding:12px;font-size:12.5px;line-height:2;white-space:pre-wrap"><b style="color:#6d28d9">📝 متن نهایی پیشنهادی:</b>\n' + escP(d.data.final) + '</div>' +
        '<div style="display:flex;gap:6px;margin-top:6px">' +
        '<button type="button" class="bt bt-o" style="font-size:12px" onclick="navigator.clipboard.writeText(document.getElementById(\'ctAiFinal\').value);ptfToast&&ptfToast(\'کپی شد\',\'ok\')">📋 کپی متن</button>' +
        '<button type="button" class="bt" style="font-size:12px;background:#059669" onclick="document.getElementById(\'ctAiTxt\').value=document.getElementById(\'ctAiFinal\').value;ptfToast&&ptfToast(\'متن پیشنهادی جایگزین شد\',\'ok\')">✅ استفاده از این متن</button></div>' +
        '<textarea id="ctAiFinal" style="display:none">' + escP(d.data.final) + '</textarea>';
      try { audit('قرارداد', 'بررسی متن قرارداد با هوش مصنوعی', ''); } catch (e) {}
    } else {
      out.innerHTML = '<div style="color:#dc2626;font-size:12px">❌ ' + escP(d.error || 'هوش مصنوعی در دسترس نیست — بعدا تلاش کنید') + '</div>';
    }
  }).catch(function () { out.innerHTML = '<div style="color:#dc2626;font-size:12px">❌ خطای اتصال</div>'; });
};

/* ---------- تولید (AC2 — rule-based) ---------- */
/* v13.9 (US-345): تولید قرارداد خرید از درخواست تامین */
function ctGenerateBuy(rq, supName) {
  var kind = 'buy', intl = document.getElementById('ctIntl').value === '1';
  var lang = document.getElementById('ctLang').value;
  var adv = +document.getElementById('ctAdv').value || 0;
  var items = (rq.items || []).map(function (it, i2) { return (i2 + 1) + '. ' + (it.name || '') + (it.spec ? ' — ' + it.spec : '') + ' | ' + (it.qty || 1) + ' ' + (it.unit || ''); }).join('\n');
  var body = 'قرارداد خرید\n\n' +
    'خریدار: شرکت پیشرو تجهیز فرتاک (شناسه ملی 14010077558)\n' +
    'فروشنده: ' + supName + '\n' +
    'مبنا: درخواست تامین ' + rq.no + '\n' +
    'تاریخ: ' + faDate() + '\n\n' +
    'ماده ۱ — موضوع قرارداد: تامین اقلام زیر مطابق مشخصات فنی درخواست ' + rq.no + ':\n' + items + '\n\n' +
    'ماده ۲ — شرایط پرداخت: ' + adv + '٪ پیش‌پرداخت؛ مابقی ' + (document.getElementById('ctRest').value || 'قبل از تحویل') + '.\n' +
    'ماده ۳ — زمان تحویل: ' + (document.getElementById('ctDlv').value || '—') + ' | محل تحویل: ' + (document.getElementById('ctPlace').value || '—') + '\n' +
    'ماده ۴ — گارانتی: ' + (+document.getElementById('ctWrn').value || 12) + ' ماه از تاریخ تحویل.\n' +
    'ماده ۵ — جریمه تاخیر: ' + (document.getElementById('ctPen').value || '0.5') + '٪ به ازای هر هفته تا سقف ' + (document.getElementById('ctPenMax').value || '5') + '٪.\n' +
    (document.getElementById('ctTpi').checked ? 'ماده ۶ — بازرسی: بازرسی شخص ثالث (TPI) پیش از حمل الزامی است.\n' : '') +
    (intl ? 'اینکوترمز: ' + document.getElementById('ctInc').value + '\n' : '') +
    'حل اختلاف: ' + (document.getElementById('ctDsp').selectedOptions[0] || {}).textContent + '\n';
  var c = { no: ctSerial(), rfqsNo: rq.no, supplierCo: supName, buyerCo: supName /* نمایش فهرست */, kind: kind, intl: intl, lang: lang,
    body: body, warns: [], t: faDate(), by: curSession().name, rev: 1 };
  var cts = getData('ptf_crm_contracts');
  cts.unshift(c);
  if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_contracts', cts, { reason: 'w4' }); else setData('ptf_crm_contracts', cts);
  hideModal(); renderContracts();
  audit('قرارداد', 'تولید پیش‌نویس قرارداد خرید ' + c.no + ' از درخواست تامین ' + rq.no, c.no);
  if (typeof ptfToast === 'function') ptfToast('قرارداد خرید از ' + rq.no + ' ساخته شد', 'ok');
}

function ctGenerate() {
  var isBuy = (document.getElementById('ctKind') || {}).value === 'buy';
  /* v13.9 (US-345): قرارداد خرید → مبنا = درخواست تامین */
  if (isBuy) {
    var rfqsNo = (document.getElementById('ctRfqs') || {}).value;
    if (!rfqsNo) { alert('درخواست تامین مبنا را انتخاب کنید'); return; }
    var rq = getData('ptf_crm_rfqsmart').filter(function (x) { return x.no === rfqsNo; })[0];
    if (!rq) return;
    var supName = ((rq.targets || []).filter(function (t) { return t.st === 'replied'; })[0] || (rq.targets || [])[0] || {}).co || '—';
    return ctGenerateBuy(rq, supName);
  }
  var coNo = document.getElementById('ctCo').value;
  if (!coNo) { alert('پیش‌فاکتور مبنا را انتخاب کنید'); return; }
  var o = getData('ptf_crm_offers').filter(function (x) { return x.no === coNo; })[0];
  var total = (o.items || []).reduce(function (s, it) { return s + (+it.qty || 0) * (+it.price || 0); }, 0);
  var lang = document.getElementById('ctLang').value;
  var intl = document.getElementById('ctIntl').value === '1';
  var kind = document.getElementById('ctKind').value;
  var adv = +document.getElementById('ctAdv').value || 0;
  var grt = document.getElementById('ctGrt').value;
  var dsp = document.getElementById('ctDsp').value;

  // بررسی تناقض (AC3-ساده): پیش‌پرداخت ۱۰۰٪ + ضمانت‌نامه
  var warns = [];
  if (adv >= 100 && grt !== 'none') warns.push('⚠️ تناقض: پیش‌پرداخت ۱۰۰٪ همراه با تضمین حسن انجام غیرمعمول است — بازبینی کنید');
  if (intl && dsp === 'court') warns.push('⚠️ برای قرارداد خارجی، داوری (ICC) به‌جای محاکم داخلی توصیه می‌شود');
  if (!intl && dsp === 'icc') warns.push('⚠️ داوری ICC برای قرارداد داخلی پرهزینه است — داوری اتاق ایران پیشنهاد می‌شود');

  var vars = {
    SELLER: kind === 'sale' ? 'شرکت پیشرو تجهیز فرتاک (سهامی خاص)' : (o.buyerCo || '................'),
    SELLER_REG: kind === 'sale' ? '14010077558' : '................',
    BUYER: kind === 'sale' ? (o.buyerCo || '................') : 'شرکت پیشرو تجهیز فرتاک (سهامی خاص)',
    DATE: faDate(), CO_NO: coNo,
    ITEMS_SUMMARY: (o.items || []).slice(0, 3).map(function (it) { return it.name || it.desc; }).join('، ') + ((o.items || []).length > 3 ? ' و ' + ((o.items || []).length - 3) + ' قلم دیگر' : ''),
    TOTAL: total.toLocaleString('fa-IR'),
    TOTAL_WORDS: typeof numToWords === 'function' ? numToWords(total) + ' Rials' : '',
    ADV: adv, REST: document.getElementById('ctRest').value,
    DLV_TIME: document.getElementById('ctDlv').value,
    DLV_PLACE: document.getElementById('ctPlace').value,
    INCOTERM: intl ? ' (' + document.getElementById('ctInc').value + ' — Incoterms 2020)' : '',
    TPI: document.getElementById('ctTpi').checked ? '\nبازرسی شخص ثالث (TPI) توسط شرکت بازرسی مورد تایید طرفین پیش از حمل انجام می‌شود و هزینه آن بر عهده خریدار است.' : '',
    WRN: document.getElementById('ctWrn').value,
    PEN: document.getElementById('ctPen').value, PENMAX: document.getElementById('ctPenMax').value,
    DISPUTE: dsp === 'court' ? 'محاکم صالحه دادگستری تهران' : dsp === 'arb' ? 'داوری مرکز داوری اتاق بازرگانی ایران' : 'داوری اتاق بازرگانی بین‌المللی (ICC)',
    GUARANTEE: grt === 'none' ? 'این قرارداد فاقد تضمین جداگانه است.' : grt === 'cheque' ? 'فروشنده یک فقره چک به مبلغ ۱۰٪ ارزش قرارداد بابت حسن انجام تعهدات نزد خریدار تودیع می‌نماید که پس از تحویل کامل مسترد می‌گردد.' : 'فروشنده ضمانت‌نامه بانکی معادل ۱۰٪ مبلغ قرارداد بابت حسن انجام کار ارائه می‌نماید.',
    ARTICLES: '۱۰'
  };

  function render(langKey) {
    var C = CT_CLAUSES[langKey];
    var order = ['intro', 'subject', 'price', 'delivery', 'quality', 'warranty', 'penalty', 'force', 'dispute', 'guarantee_clause', 'final'];
    return order.map(function (k) {
      var txt = C[k];
      Object.keys(vars).forEach(function (v) { txt = txt.split('{' + v + '}').join(vars[v]); });
      return txt;
    }).join('\n\n');
  }

  var body = lang === 'both' ? render('fa') + '\n\n========================================\n\n' + render('en') : render(lang);

  var c = { no: ctSerial(), coNo: coNo, buyerCo: o.buyerCo, kind: kind, intl: intl, lang: lang,
    body: body, warns: warns, t: faDate(), by: curSession().name, rev: 1 };
  var cts = getData('ptf_crm_contracts');
  cts.unshift(c);
  if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_contracts', cts, { reason: 'w4' }); else setData('ptf_crm_contracts', cts);
  hideModal(); renderContracts();
  audit('قرارداد', 'تولید پیش‌نویس ' + c.no + ' از ' + coNo, c.no);
  if (warns.length) alert('پیش‌نویس تولید شد.\n\n' + warns.join('\n'));
  ctEdit(c.no);
}

/* ---------- ویرایش (AC4) ---------- */
function ctEdit(no) {
  var c = getData('ptf_crm_contracts').filter(function (x) { return x.no === no; })[0];
  if (!c) return;
  var html = '<div class="md-b" style="display:grid" onclick="if(event.target===this)hideModal()"><div class="md" style="max-width:820px;max-height:94vh;overflow:auto">' +
    '<h3>✏️ ویرایش قرارداد ' + escP(c.no) + ' <small style="color:#94a3b8">(نسخه ' + (c.rev || 1) + ')</small></h3>' +
    (c.warns && c.warns.length ? '<div style="background:#fffbeb;border:1px solid #f59e0b;border-radius:10px;padding:8px 12px;font-size:12px;margin-bottom:8px">' + c.warns.map(escP).join('<br>') + '</div>' : '') +
    '<textarea id="ctBody" rows="20" style="width:100%;font-size:13px;line-height:2;padding:12px;border:1px solid var(--brd);border-radius:12px;font-family:inherit">' + escP(c.body) + '</textarea>' +
    // US-148 AC2: درج مهر و امضای کاربر در محل امضای فروشنده
    '<label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-top:8px;cursor:pointer">' +
    '<input type="checkbox" id="ctUseSig"' + (c.useSig ? ' checked' : '') + (ctSigReady() ? '' : ' disabled') + '> درج مهر و امضای من در محل امضای ' + (c.kind === 'sale' ? 'فروشنده' : 'خریدار') +
    (ctSigReady() ? '' : ' <small style="color:#d97706">(ابتدا در مکاتبات → «✍️ امضای من» ثبت کنید)</small>') + '</label>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px">' +
    '<button class="bt bt-o" onclick="hideModal()">بستن</button>' +
    '<button class="bt bt-o" onclick="ctPrint(\'' + no + '\')">🖨️ PDF</button>' +
    '<button class="bt" onclick="ctSave(\'' + no + '\')">💾 ذخیره نسخه جدید</button></div></div></div>';
  document.getElementById('panels').insertAdjacentHTML('beforeend', html);
}

// US-148: پروفایل امضای کاربر جاری برای قرارداد
function ctSigReady() {
  try {
    var p = typeof window.ptfSigProfileFor === 'function' ? window.ptfSigProfileFor(curSession().user) : ((getData('ptf_crm_sigprofiles') || {})[curSession().user]);
    return !!(p && (p.sig || p.stamp));
  } catch (e) { return false; }
}

function ctSave(no) {
  var cts = getData('ptf_crm_contracts');
  var c = cts.filter(function (x) { return x.no === no; })[0];
  if (!c) return;
  c.body = document.getElementById('ctBody').value;
  c.useSig = !!(document.getElementById('ctUseSig') || {}).checked;
  c.sigUser = curSession().user;
  c.rev = (c.rev || 1) + 1;
  if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_contracts', cts, { reason: 'w4' }); else setData('ptf_crm_contracts', cts);
  hideModal(); renderContracts();
  audit('قرارداد', 'ویرایش ' + no + ' → نسخه ' + c.rev, no);
}

function ctDel(no) {
  if (!confirm('قرارداد ' + no + ' حذف شود؟')) return;
  if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_contracts', getData('ptf_crm_contracts').filter(function (x) { return x.no !== no; }), { reason: 'w4' }); else setData('ptf_crm_contracts', getData('ptf_crm_contracts').filter(function (x) { return x.no !== no; }));
  renderContracts();
  audit('قرارداد', 'حذف', no);
}

/* ---------- PDF با سربرگ (AC4) ---------- */
// US-148 AC3: بلوک امضای قرارداد — در صورت تیک، مهر+امضای کاربر در محل فروشنده/خریدار (طرف ما)
function ctSigBlock(c, isEn) {
  var mySide = c.kind === 'sale' ? 0 : 1; // فروش: ما فروشنده‌ایم | خرید: ما خریداریم
  var imgs = '';
  if (c.useSig) {
    try {
      var sigUser = c.sigUser || curSession().user;
      var sp = typeof window.ptfSigProfileFor === 'function' ? (window.ptfSigProfileFor(sigUser) || {}) : ((getData('ptf_crm_sigprofiles') || {})[sigUser] || {});
      if (sp.sig) imgs += '<img src="' + sp.sig + '" style="max-height:16mm;max-width:40mm;margin:0 1mm">';
      if (sp.stamp) imgs += '<img src="' + sp.stamp + '" style="max-height:20mm;max-width:30mm;margin:0 1mm;opacity:.92">';
    } catch (e) {}
  }
  var stamped = '<div style="min-height:22mm;display:flex;align-items:flex-end;justify-content:center">' + imgs + '</div>';
  var empty = '<div style="min-height:22mm"></div>';
  var seller = (isEn ? 'Seller' : 'فروشنده') + '<br>مهر و امضا';
  var buyer = (isEn ? 'Buyer' : 'خریدار') + '<br>مهر و امضا';
  return '<div class="sig">' +
    '<div>' + (mySide === 0 && imgs ? stamped : empty) + seller + '</div>' +
    '<div>' + (mySide === 1 && imgs ? stamped : empty) + buyer + '</div></div>';
}

function ctPrint(no) {
  var c = getData('ptf_crm_contracts').filter(function (x) { return x.no === no; })[0];
  if (!c) return;
  var isEn = c.lang === 'en';
  var fullHtml = '<!doctype html><html lang="fa" dir="' + (isEn ? 'ltr' : 'rtl') + '"><head><meta charset="utf-8"><title>' + c.no + '</title><style>' +
    '@page{size:A4 portrait;margin:0}*{box-sizing:border-box;margin:0;padding:0}' +
    'body{font-family:' + (isEn ? "\'Segoe UI\',Arial,sans-serif" : "\'Yaghut\',Vazirmatn,Tahoma,sans-serif") + ';color:#26282c}' +
    '.bar-top{position:fixed;top:0;left:0;right:0;height:6.2mm;background:linear-gradient(90deg,#e87200,#ee8100 35%,#ecb003 70%,#ecc506)}' +
    '.bar-bot{position:fixed;bottom:0;left:0;right:0;height:6.2mm;background:linear-gradient(90deg,#ecc506,#ecb003 30%,#ee8100 65%,#e87200)}' +
    '.hd{padding:12mm 14mm 4mm;display:flex;justify-content:space-between;align-items:center;direction:rtl}' +
    '.hd img{height:20mm}.hd .m{font-size:10.5pt;color:#4b5057;line-height:2;text-align:left}' +
    '.tt{text-align:center;font-weight:700;font-size:16pt;margin:4mm 0 8mm}' +
    '.body{padding:0 16mm;font-size:12.5pt;line-height:2.1;white-space:pre-wrap;text-align:' + (isEn ? 'left' : 'justify') + '}' +
    '.sig{display:flex;justify-content:space-around;margin:14mm 16mm 20mm;text-align:center;font-size:12pt;font-weight:700}' +
    '.sig div{border-top:1px solid #999;padding-top:3mm;min-width:50mm}' +
    '.disc{padding:4mm 16mm;font-size:9pt;color:#b45309}' +
    '</style></head><body><div class="bar-top"></div>' +
    '<div class="hd"><img src="../assets/images/ptf-logo-full.png" alt="PTF"><div class="m">شماره: <b dir="ltr">' + escP(c.no) + '</b><br>تاریخ: <b>' + escP(c.t) + '</b><br>نسخه: ' + (c.rev || 1) + '</div></div>' +
    '<div class="tt">' + (isEn ? 'SUPPLY CONTRACT' : 'قرارداد ' + (c.kind === 'sale' ? 'فروش' : 'خرید') + ' تجهیزات') + '</div>' +
    '<div class="body">' + escP(c.body) + '</div>' +
    '<div class="disc">⚠️ این پیش‌نویس توسط سیستم تولید شده و پیش از امضا نیازمند بازبینی حقوقی است.</div>' +
    ctSigBlock(c, isEn) +
    '<div class="bar-bot"></div></body></html>';
  if (typeof ptfPreviewPrintableDoc === 'function') ptfPreviewPrintableDoc('قرارداد — ' + escP(c.no), fullHtml, c.no);
  else {
    var w = window.open('', '_blank');
    w.document.write(fullHtml);
    w.document.close();
  }
}

/* ---------- روتینگ ---------- */
(function () {
  var _go = window.goPanel;
  window.goPanel = function (id, btn) {
    if (id === 'cnt') {
      if (!isSenior()) { alert('⛔ تنظیم قرارداد مخصوص نقش‌های ارشد است'); return; }
      var btns = document.querySelectorAll('.sb-i');
      for (var i = 0; i < btns.length; i++) btns[i].classList.remove('act');
      if (btn) btn.classList.add('act');
      document.getElementById('pgTitle').textContent = '📜 قراردادها';
      document.getElementById('panels').innerHTML = buildContracts();
      renderContracts();
      return;
    }
    _go(id, btn);
  };
})();
