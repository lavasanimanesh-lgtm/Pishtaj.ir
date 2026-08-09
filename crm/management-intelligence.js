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
  function offerTotal(o) { return (o.items || []).reduce(function (s, it) { return s + n(it.qty) * n(it.price); }, 0); }
  function keyOf(o) { return String(o.buyerCd || o.buyerCo || o.co || o.custCd || 'نامشخص').trim() || 'نامشخص'; }
  function labelOf(o) { return o.buyerCo || o.co || o.buyerCd || o.custCd || 'نامشخص'; }

  /* خروجی تنها از داده‌های قطعی CRM ساخته می‌شود؛ هیچ توصیه‌ای بدون شواهد عددی نیست. */
  window.ptfManagementIntelligence = function () {
    var offers = list('ptf_crm_offers').filter(function (o) { return o && (o.kind === 'CO' || o.kind === 'TC') && !o.rialOf; });
    var rfqs = list('ptf_crm_rfqs'), invoices = list('ptf_crm_invoices'), buyquotes = list('ptf_crm_buyquotes');
    var customers = {}, products = {}, suppliers = {}, projects = [];

    offers.forEach(function (o) {
      var k = keyOf(o), c = customers[k] || (customers[k] = { key:k, name:labelOf(o), rfqs:0, offers:0, won:0, lost:0, offered:0, wonValue:0, invoices:0, billed:0, paid:0 });
      c.offers++; c.offered += offerTotal(o);
      if (o.st === 'won') { c.won++; c.wonValue += offerTotal(o); }
      if (o.st === 'lost') c.lost++;
      (o.items || []).forEach(function (it) {
        var pk = String(it.pcode || it.prodCd || it.name || it.desc || 'نامشخص').trim(), p = products[pk] || (products[pk] = { key:pk, name:it.name || it.desc || pk, quotes:0, won:0, qty:0, value:0, wonValue:0 });
        p.quotes++; p.qty += n(it.qty); p.value += n(it.qty) * n(it.price);
        if (o.st === 'won') { p.won++; p.wonValue += n(it.qty) * n(it.price); }
      });
    });
    rfqs.forEach(function (r) {
      var k = String(r.custCd || r.co || r.company || 'نامشخص').trim() || 'نامشخص', c = customers[k] || (customers[k] = { key:k, name:r.co || r.company || k, rfqs:0, offers:0, won:0, lost:0, offered:0, wonValue:0, invoices:0, billed:0, paid:0 });
      c.rfqs++;
    });
    invoices.forEach(function (i) {
      var k = String(i.buyerCd || i.buyerCo || 'نامشخص').trim() || 'نامشخص', c = customers[k] || (customers[k] = { key:k, name:i.buyerCo || k, rfqs:0, offers:0, won:0, lost:0, offered:0, wonValue:0, invoices:0, billed:0, paid:0 });
      var paid = ((i.payments || []).concat(i.pays || [])).reduce(function (s, p) { return s + n(p.amt); }, 0);
      c.invoices++; c.billed += n(i.amount); c.paid += paid;
    });
    buyquotes.forEach(function (b) {
      var k = String(b.sup || b.supplier || 'نامشخص').trim() || 'نامشخص', s = suppliers[k] || (suppliers[k] = { key:k, name:k, quotes:0, purchases:0, value:0 });
      s.quotes++; s.value += n(b.price);
      if (/خرید واقعی/.test(String(b.note || ''))) s.purchases++;
    });
    list('ptf_crm_deals').forEach(function (d) {
      if (!d || d.st === 'archived') return;
      var overdue = d.dueISO && d.dueISO < new Date().toISOString().slice(0,10);
      var qcBad = (d.qcEvents || []).some(function (q) { return q.conf === 'nonconform'; });
      if (overdue || qcBad || !(d.wonOffer)) projects.push({ cd:d.cd, no:d.inqNo || d.cd, customer:d.buyerCo || '', overdue:!!overdue, qcBad:!!qcBad, due:d.dueISO || '' });
    });

    var customerRows = Object.keys(customers).map(function (k) {
      var c = customers[k], closed = c.won + c.lost;
      c.winRate = closed ? Math.round(c.won * 1000 / closed) / 10 : null;
      c.collectionRate = c.billed ? Math.round(c.paid * 1000 / c.billed) / 10 : null;
      c.control = c.rfqs >= 3 && c.offers >= 2 && c.won === 0;
      c.strategic = c.wonValue > 0 || c.paid > 0;
      return c;
    }).sort(function (a,b) { return (b.wonValue + b.paid + b.offered) - (a.wonValue + a.paid + a.offered); });
    var productRows = Object.keys(products).map(function (k) { return products[k]; }).sort(function(a,b){return b.wonValue-a.wonValue || b.value-a.value;});
    var supplierRows = Object.keys(suppliers).map(function(k){return suppliers[k];}).sort(function(a,b){return b.purchases-a.purchases || b.quotes-a.quotes;});
    var insights = [];
    var highEffort = customerRows.filter(function(c){return c.control;});
    var strategic = customerRows.filter(function(c){return c.strategic;}).slice(0,3);
    if (strategic.length) insights.push({ level:'good', title:'مشتریان دارای ارزش ثبت‌شده', text: strategic.map(function(c){return c.name;}).join('، ') + ' در داده‌های فروش/وصول یا برد، ارزش ثبت‌شده دارند. برای این مشتریان برنامه حساب کلیدی پیشنهاد می‌شود.' });
    if (highEffort.length) insights.push({ level:'warn', title:'مشتریان نیازمند کنترل هزینه فروش', text: highEffort.slice(0,3).map(function(c){return c.name + ' (' + c.rfqs + ' درخواست، ' + c.offers + ' پیشنهاد، بدون برد)';}).join('، ') + ' — پیشنهاد: بررسی کامل بودن RFQ، حداقل ارزش فرصت و سیاست Revision.' });
    if (productRows[0]) insights.push({ level:'info', title:'کالای/گروه پیشرو', text: productRows[0].name + ' با ارزش برد ' + money(productRows[0].wonValue) + ' در صدر داده‌های ثبت‌شده است.' });
    if (supplierRows[0]) insights.push({ level:'info', title:'تأمین‌کننده فعال', text: supplierRows[0].name + ' با ' + supplierRows[0].quotes + ' رکورد قیمت و ' + supplierRows[0].purchases + ' خرید واقعی ثبت‌شده، فعال‌ترین منبع داده است.' });
    if (projects.length) insights.push({ level:'risk', title:'ریسک‌های عملیاتی پرونده', text: projects.slice(0,3).map(function(p){return p.no + (p.overdue ? ' (تاخیر تحویل)' : '') + (p.qcBad ? ' (عدم انطباق QC)' : '');}).join('، ') + ' نیازمند بازبینی مدیریتی هستند.' });
    if (!insights.length) insights.push({ level:'info', title:'داده کافی نیست', text:'برای تصمیم‌یار مدیریت، ثبت وضعیت برد/باخت، خرید واقعی، فاکتور و وصول را کامل‌تر کنید.' });
    return { at:new Date().toISOString(), customers:customerRows, products:productRows, suppliers:supplierRows, risks:projects, insights:insights,
      totals:{ customers:customerRows.length, products:productRows.length, suppliers:supplierRows.length, projectsAtRisk:projects.length } };
  };

  function insightHtml(i) { var c=i.level==='risk'?'#dc2626':i.level==='warn'?'#b45309':i.level==='good'?'#047857':'#0369a1'; return '<div style="border-right:4px solid '+c+';background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:9px 11px;margin-bottom:7px"><b style="color:'+c+'">'+esc(i.title)+'</b><div style="font-size:12px;color:#475569;margin-top:3px">'+esc(i.text)+'</div></div>'; }
  function miniRows(rows, type) {
    return rows.slice(0,8).map(function(r){
      if(type==='customer') return '<tr><td>'+esc(r.name)+'</td><td>'+r.rfqs+'</td><td>'+r.offers+'</td><td>'+r.won+'</td><td>'+ (r.winRate==null?'—':r.winRate+'٪')+'</td><td>'+money(r.wonValue)+'</td><td>'+ (r.collectionRate==null?'—':r.collectionRate+'٪')+'</td></tr>';
      if(type==='product') return '<tr><td>'+esc(r.name)+'</td><td>'+r.quotes+'</td><td>'+r.won+'</td><td>'+money(r.wonValue)+'</td></tr>';
      return '<tr><td>'+esc(r.name)+'</td><td>'+r.quotes+'</td><td>'+r.purchases+'</td><td>'+money(r.value)+'</td></tr>';
    }).join('') || '<tr><td colspan="7">داده کافی نیست</td></tr>';
  }
  /* حداقل داده لازم برای AI: فقط top rows و KPI؛ نه متن آزاد، اطلاعات تماس یا فایل‌ها. */
  window.ptfManagementAiSnapshot = function () {
    var d = window.ptfManagementIntelligence();
    function customer(c) { return { name:c.name, rfqs:c.rfqs, offers:c.offers, won:c.won, lost:c.lost, winRate:c.winRate, wonValue:c.wonValue, billed:c.billed, paid:c.paid, collectionRate:c.collectionRate, control:c.control }; }
    function product(p) { return { name:p.name, quotes:p.quotes, won:p.won, qty:p.qty, wonValue:p.wonValue }; }
    function supplier(x) { return { name:x.name, quotes:x.quotes, purchases:x.purchases, value:x.value }; }
    return { generatedAt:d.at, totals:d.totals, insights:d.insights, customers:d.customers.slice(0,12).map(customer), products:d.products.slice(0,12).map(product), suppliers:d.suppliers.slice(0,12).map(supplier), risks:d.risks.slice(0,10) };
  };
  function aiCard(row, color) { return '<div style="border-right:4px solid '+color+';background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:9px 11px;margin:7px 0"><b>'+esc(row.title||'—')+'</b><div style="font-size:12px;color:#475569;margin-top:3px">'+esc(row.why||row.evidence||'')+'</div>'+(row.action||row.mitigation?'<div style="font-size:12px;color:#0f766e;margin-top:4px"><b>اقدام انسانی:</b> '+esc(row.action||row.mitigation)+'</div>':'')+(row.priority?'<small style="color:#64748b">اولویت: '+esc(row.priority)+' | اطمینان: '+esc(row.confidence||'—')+'</small>':'')+'</div>'; }
  window.ptfManagementAiInterpret = function () {
    var out=document.getElementById('mgmtAiOut'), btn=document.getElementById('mgmtAiBtn');
    if (!out) return;
    if (btn) { btn.disabled=true; btn.textContent='⏳ در حال تحلیل...'; }
    out.innerHTML='<div style="color:#64748b;font-size:12px">در حال ارسال snapshot خلاصه و قابل ممیزی به AI…</div>';
    var headers=typeof ptfApiAuthHeaders==='function' ? ptfApiAuthHeaders(true) : {'Content-Type':'application/json'};
    fetch('../api/llm.php?action=management_insight',{method:'POST',headers:headers,body:JSON.stringify({snapshot:window.ptfManagementAiSnapshot()})})
      .then(function(r){return r.json();}).then(function(r){
        if(!r.ok || !r.data){ out.innerHTML='<div style="color:#b91c1c">❌ '+esc(r.error||'تحلیل AI ناموفق بود')+'</div>'; return; }
        var a=r.data, h='<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:10px;font-size:12.5px;line-height:1.9"><b>خلاصه مدیریتی:</b> '+esc(a.executive_summary||'—')+'</div>';
        if((a.priorities||[]).length) h+='<h4>اولویت‌های پیشنهادی</h4>'+(a.priorities||[]).map(function(x){return aiCard(x,'#dc2626');}).join('');
        if((a.opportunities||[]).length) h+='<h4>فرصت‌ها</h4>'+(a.opportunities||[]).map(function(x){return aiCard(x,'#047857');}).join('');
        if((a.risks||[]).length) h+='<h4>ریسک‌ها</h4>'+(a.risks||[]).map(function(x){return aiCard(x,'#b45309');}).join('');
        if((a.data_gaps||[]).length) h+='<h4>شکاف داده</h4><ul style="font-size:12px;color:#475569">'+a.data_gaps.map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul>';
        h+='<small style="color:#64748b">'+esc(a.governance_note||'این توصیه‌ها نیازمند بازبینی و تایید مدیریت هستند.')+'</small>';
        out.innerHTML=h;
        try { if(typeof audit==='function') audit('تصمیم‌یار مدیریت','تولید تفسیر AI مدیریت',''); } catch(e) {}
      }).catch(function(){out.innerHTML='<div style="color:#b91c1c">❌ عدم دسترسی به سرویس AI</div>';})
      .finally(function(){if(btn){btn.disabled=false;btn.textContent='✨ تفسیر AI';}});
  };

  window.ptfManagementInsightsOpen = function () {
    /* مشتری/سود/وصول دادهٔ مدیریتی است؛ فقط نقش‌های ارشد یا مالی. */
    try { if (typeof isSenior === 'function' && !isSenior() && !((roleDef() || {}).finance)) { alert('⛔ گزارش تصمیم‌یار مدیریت فقط برای نقش‌های ارشد و مالی مجاز است.'); return; } } catch (eRole) {}
    var d = window.ptfManagementIntelligence();
    var html='<div class="md-b" id="mgmtInsightDlg" style="display:grid;z-index:3000" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:1100px;width:96vw;max-height:92vh;overflow:auto"><h3>🧠 تصمیم‌یار مدیریت فروش — فاز داده‌محور</h3><div style="font-size:11.5px;color:#64748b;margin-bottom:10px">این گزارش از داده‌های ثبت‌شده CRM ساخته شده و هنوز اقدام خودکار انجام نمی‌دهد. هر توصیه نیازمند تایید مدیر است.</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px"><div class="sc"><b>'+d.totals.customers+'</b><span>مشتری دارای داده</span></div><div class="sc"><b>'+d.totals.products+'</b><span>کالا/قلم</span></div><div class="sc"><b>'+d.totals.suppliers+'</b><span>تأمین‌کننده دارای قیمت</span></div><div class="sc"><b style="color:#dc2626">'+d.totals.projectsAtRisk+'</b><span>پرونده نیازمند بررسی</span></div></div><h4>اقدامات و بینش‌های مدیریتی</h4>'+d.insights.map(insightHtml).join('')+'<h4>مشتریان</h4><div class="tb2"><table><thead><tr><th>مشتری</th><th>RFQ</th><th>CO</th><th>برد</th><th>نرخ برد</th><th>ارزش برد</th><th>وصول</th></tr></thead><tbody>'+miniRows(d.customers,'customer')+'</tbody></table></div><h4>کالاهای پرارزش</h4><div class="tb2"><table><thead><tr><th>کالا</th><th>پیشنهاد</th><th>برد</th><th>ارزش برد</th></tr></thead><tbody>'+miniRows(d.products,'product')+'</tbody></table></div><h4>تأمین‌کنندگان</h4><div class="tb2"><table><thead><tr><th>تأمین‌کننده</th><th>رکورد قیمت</th><th>خرید واقعی</th><th>ارزش قیمت ثبت‌شده</th></tr></thead><tbody>'+miniRows(d.suppliers,'supplier')+'</tbody></table></div><div id="mgmtAiOut" style="margin-top:14px"></div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap"><button class="bt" id="mgmtAiBtn" style="background:#7c3aed" onclick="ptfManagementAiInterpret()">✨ تفسیر AI</button><button class="bt bt-o" onclick="ptfManagementInsightsPdf()">🖨️ PDF مدیریتی</button><button class="bt bt-o" onclick="navigator.clipboard.writeText(JSON.stringify(ptfManagementAiSnapshot()))">📋 کپی دادهٔ خلاصه</button><button class="bt" onclick="document.getElementById(\'mgmtInsightDlg\').remove()">بستن</button></div></div></div>';
    (document.getElementById('panels')||document.body).insertAdjacentHTML('beforeend',html);
  };
  window.ptfManagementInsightsPdf = function () {
    var d=window.ptfManagementIntelligence(), rows=function(a){return a.map(function(i){return '<li><b>'+esc(i.title)+':</b> '+esc(i.text)+'</li>';}).join('');};
    var html='<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>@page{size:A4;margin:14mm}body{font-family:Vazirmatn,Tahoma,sans-serif;color:#1e293b;font-size:12px}h1{color:#0e7490;border-bottom:2px solid #0e7490;padding-bottom:7px}h2{font-size:15px;margin-top:18px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #cbd5e1;padding:6px;text-align:right}th{background:#f1f5f9}</style></head><body><h1>گزارش تصمیم‌یار مدیریت فروش</h1><p>تاریخ: '+esc(typeof faDateTime==='function'?faDateTime():d.at)+' | تهیه‌کننده: '+esc((typeof curSession==='function'?curSession().name:''))+'</p><h2>بینش‌ها و اقدامات پیشنهادی</h2><ol>'+rows(d.insights)+'</ol><h2>مشتریان</h2><table><thead><tr><th>مشتری</th><th>RFQ</th><th>CO</th><th>برد</th><th>نرخ برد</th><th>ارزش برد</th><th>وصول</th></tr></thead><tbody>'+miniRows(d.customers,'customer')+'</tbody></table><h2>کالاهای پرارزش</h2><table><thead><tr><th>کالا</th><th>پیشنهاد</th><th>برد</th><th>ارزش برد</th></tr></thead><tbody>'+miniRows(d.products,'product')+'</tbody></table><h2>تأمین‌کنندگان</h2><table><thead><tr><th>تأمین‌کننده</th><th>رکورد قیمت</th><th>خرید واقعی</th><th>ارزش قیمت</th></tr></thead><tbody>'+miniRows(d.suppliers,'supplier')+'</tbody></table><p style="margin-top:20px;color:#64748b">محدودیت: این گزارش فقط از داده‌های ثبت‌شده CRM استفاده می‌کند و جایگزین تایید مدیریتی، مالی یا فنی نیست.</p></body></html>';
    if(typeof ptfPreviewPrintableDoc==='function') ptfPreviewPrintableDoc('گزارش تصمیم‌یار مدیریت',html,'management-intelligence'); else {var w=window.open('','_blank');w.document.write(html);w.document.close();}
    try{audit('تصمیم‌یار مدیریت','تولید PDF گزارش مدیریت','');}catch(e){}
  };
})();
