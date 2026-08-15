/* =====================================================================
   PTF CRM — Sales-to-Cash Domain v35
   Command-driven offer award, unique sales cases, case receipts, financial
   attachment registry, deterministic integrity findings and repair actions.
   Financial cash is never inferred from offer.advance/paid/cashFull.
   ===================================================================== */
(function () {
  'use strict';
  window.PTF_SALES_DOMAIN_V2 = true;
  var API = '../api/sales-domain.php';
  var FIN_ROLES = ['admin', 'chairman', 'ceo', 'commercial', 'accountant'];
  var WIN_ROLES = ['admin', 'chairman', 'ceo', 'commercial', 'sales'];
  var OFFER_REPAIR_ROLES = ['admin', 'chairman'];

  function arr(v) { return Array.isArray(v) ? v : []; }
  function data(k) { try { var v = getData(k); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function role() { try { return String(curRole() || '').toLowerCase(); } catch (e) { return ''; } }
  function canFinance() { return FIN_ROLES.indexOf(role()) > -1; }
  function canWin() { return WIN_ROLES.indexOf(role()) > -1; }
  function canRepairOfferWin() { return OFFER_REPAIR_ROLES.indexOf(role()) > -1; }
  window.ptfCanRepairOfferWin = canRepairOfferWin;
  function esc(v) { return typeof escP === 'function' ? escP(v) : String(v == null ? '' : v).replace(/[&<>"']/g, function (x) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[x]; }); }
  function arg(v) { return typeof ptfOnClickArg === 'function' ? ptfOnClickArg(v) : String(v == null ? '' : v).replace(/[\\']/g, ''); }
  function num(v) { return typeof ptfNum === 'function' ? ptfNum(v) : (+String(v == null ? '' : v).replace(/[۰-۹]/g, function(d){return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d);}).replace(/[٠-٩]/g,function(d){return '٠١٢٣٤٥٦٧٨٩'.indexOf(d);}).replace(/[^\d.-]/g, '') || 0); }
  function money(v) { return (+v || 0).toLocaleString('fa-IR') + ' ریال'; }
  function nowId(prefix) { return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10); }
  function active(x) { var st = String((x && (x.status || x.st)) || '').toLowerCase(); return !!x && ['void','voided','deleted','cancelled','replaced','superseded'].indexOf(st) < 0 && !x.voided && !x.deleted; }
  function caseId(c) { return String((c && (c._id || c.cd)) || ''); }
  function receiptId(r) { return String((r && (r._id || r.cd)) || ''); }
  function invoiceId(i) { return String((i && (i._id || i.cd)) || ''); }
  function authHeaders() { var h = {'Content-Type':'application/json'}; try { var t = localStorage.getItem('ptf_crm_token'); if (t) h['X-CRM-Token'] = t; } catch (e) {} return h; }
  function toast(msg, kind) { if (typeof ptfToast === 'function') ptfToast(msg, kind || 'info'); else if (kind === 'warn') alert(msg); }
  function applyProjection(d, serverRev) {
    var touched = 0, expected = 0;
    Object.keys(d || {}).forEach(function (k) {
      if (k === 'ptf_crm_sales_commands') return; /* server journal is not a browser editing surface */
      expected++;
      try {
        var ok;
        if (typeof window.ptfSyncApplyServerProjection === 'function') ok = window.ptfSyncApplyServerProjection(k, d[k], serverRev);
        else { localStorage.setItem(k, JSON.stringify(d[k])); ok = true; }
        if (ok !== false) touched++;
      } catch (e) { console.error('sales-v2 projection', k, e); }
    });
    /* global rev فقط وقتی جلو می‌رود که هیچ کلید projection شکست نخورده باشد؛
       در شکست جزئی، pull با rev قبلی همان کلید را دوباره دریافت می‌کند. */
    if (expected > 0 && touched === expected && typeof window.ptfSyncAcceptServerRevision === 'function') {
      try { window.ptfSyncAcceptServerRevision(serverRev); } catch (eRev) {}
    }
    /* v34.7.14: projection با rev دقیق ابتدا روی cache فاز B اعمال می‌شود، سپس
       pull نهایی را واقعاً تا پایان انتظار می‌کشیم. handler موفقیت و renderها دیگر
       جلوتر از همگام‌سازی اجرا نمی‌شوند. شکست pull، commit موفق سرور را شکست‌خورده
       اعلام نمی‌کند؛ projection پاسخ همچنان منبع نمایش فوری است. */
    return new Promise(function (resolve) {
      if (!touched || typeof window.ptfSyncPullNow !== 'function') { resolve({ ok: true, skipped: true }); return; }
      try {
        window.ptfSyncPullNow(function (result) { resolve(result || { ok: true }); });
      } catch (eP) { resolve({ ok: false, reason: 'pull_exception' }); }
    });
  }
  function api(action, payload) {
    payload = payload || {};
    if (!payload.idempotencyKey) payload.idempotencyKey = nowId(action.toUpperCase());
    return fetch(API + '?action=' + encodeURIComponent(action), { method:'POST', headers:authHeaders(), body:JSON.stringify(payload) })
      .then(function (r) { return r.text().then(function (txt) { var d; try { d=JSON.parse(txt); } catch(e){ throw new Error('پاسخ نامعتبر سرور: ' + txt.slice(0,160)); } if (!r.ok || !d.ok) { var er = new Error(d.error || ('HTTP '+r.status)); er.payload=d; throw er; } return d; }); })
      .then(function (d) { return applyProjection(d.data || {}, d.rev).then(function () { return d; }); });
  }
  window.ptfSalesDomainApi = api;

  /* Official offer identity is acknowledged by the server. Legacy form rendering remains,
     but a rejected unique-number/write acknowledgement restores the pre-save projection. */
  var legacyOfferSave = window.offerSave;
  if (typeof legacyOfferSave === 'function') {
    window.offerSave = function () {
      var before = JSON.parse(JSON.stringify(data('ptf_crm_offers'))), ret = legacyOfferSave.apply(this, arguments);
      var st = window._offState || {}, saved = data('ptf_crm_offers').filter(function (o) { return o && o.no === st.no; })[0];
      if (!saved) return ret;
      api('register_offer', { offer:saved, idempotencyKey:'OFFER-SAVE|' + saved.no + '|' + (saved.updatedAtISO || Date.now()) })
        .then(function () { toast('پیشنهاد با شناسه یکتا توسط سرور تأیید شد', 'ok'); })
        .catch(function (e) {
          if (typeof window.ptfSyncApplyServerProjection === 'function') window.ptfSyncApplyServerProjection('ptf_crm_offers', before);
          else localStorage.setItem('ptf_crm_offers', JSON.stringify(before));
          alert('⛔ سرور ثبت پیشنهاد را نپذیرفت و تغییر محلی بازگردانده شد: ' + e.message);
          if (typeof renderOffers === 'function') renderOffers();
        });
      return ret;
    };
  }

  function findOffer(no) { return data('ptf_crm_offers').filter(function (o) { return o && o.no === no; })[0] || null; }
  function identity(v){return String(v||'').replace(/[\u200c\u200e\u200f\s]+/g,'').toUpperCase();}
  function caseBelongsToOffer(c,o){
    if(!c||!o||!active(c))return false;
    var oid=String(o._id||''),root=String(c.rootOfferId||'');
    if(oid&&root)return oid===root; /* شناسه ریشه مقدم است؛ fallback شماره حق غلبه ندارد. */
    var caseNo=String(c.wonOffer||c.offerNo||''),offerNo=String(o.no||'');
    if(!caseNo||!offerNo||caseNo!==offerNo)return false;
    var pairs=[['inqNo','inqNo'],['buyerCd','buyerCd'],['currency','currency']];
    for(var i=0;i<pairs.length;i++){var a=identity(c[pairs[i][0]]),b=identity(o[pairs[i][1]]);if(a&&b&&a!==b)return false;}
    if(!identity(c.buyerCd)&&!identity(o.buyerCd)){var cc=identity(c.buyerCo),oc=identity(o.buyerCo);if(cc&&oc&&cc!==oc)return false;}
    return true;
  }
  window.ptfCaseBelongsToOffer=caseBelongsToOffer;
  function casesForOffer(o) {
    if (!o) return [];
    return data('ptf_crm_deals').filter(function (c) { return caseBelongsToOffer(c,o); });
  }
  function findCase(id) { return data('ptf_crm_deals').filter(function (c) { return caseId(c) === String(id); })[0] || null; }
  function caseByOffer(no) { var o=findOffer(no); return casesForOffer(o)[0] || null; }

  /* ----- Atomic award override (loaded after every legacy wrapper). ----- */
  var legacySetStatus = window.offerSetSt;
  window.ptfSalesWinOffer = function (no, selEl) {
    if (!canWin()) { alert('⛔ نقش فعلی اجازه ثبت برد را ندارد.'); if(selEl)selEl.value=(findOffer(no)||{}).st||'sent'; return; }
    var same = data('ptf_crm_offers').filter(function (o) { return o && o.no === no; });
    if (same.length !== 1) { alert('⛔ شماره پیشنهاد یکتا نیست (' + same.length + ' رکورد). ابتدا از کیفیت داده تعیین تکلیف شود؛ هیچ رکوردی حدس زده نمی‌شود.'); if(selEl)selEl.value=(same[0]||{}).st||'sent'; return; }
    var o = same[0];
    if (o.rialOf) { alert('نسخه ریالی سند مستقل تجاری نیست و قابل برنده‌شدن نیست.'); if(selEl)selEl.value=o.st||'sent'; return; }
    var currentCases = casesForOffer(o);
    if (currentCases.length > 1) { alert('⛔ بیش از یک پرونده برای این پیشنهاد وجود دارد. برد/تغییر متوقف شد تا پرونده‌ها ادغام شوند.'); if(selEl)selEl.value=o.st||'sent'; return; }
    if (currentCases.length === 1 && o.st === 'won') { if (typeof ptfGoSalesFile === 'function') ptfGoSalesFile(caseId(currentCases[0])); return; }
    var attachCaseId = '';
    if (o.amendmentOf || o.isAmendment) {
      var parentNo = o.amendmentOf || o.altOf || o.srcToNo || '';
      var parentCase = parentNo ? caseByOffer(parentNo) : null;
      if (parentCase && confirm('این پیشنهاد به‌عنوان متمم برنده به پرونده «' + (parentCase.inqNo || parentCase.wonOffer || caseId(parentCase)) + '» متصل شود؟\n\nلغو = تشکیل پرونده مستقل')) attachCaseId = caseId(parentCase);
    }
    if (!confirm('🏆 ثبت قطعی برد پیشنهاد ' + no + '\n\nبرد و تشکیل/اتصال پرونده در یک فرمان سروری انجام می‌شود و پیشنهاد پس از آن قفل خواهد شد. ادامه می‌دهید؟')) { if(selEl)selEl.value=o.st||'sent'; return; }
    if (selEl) selEl.disabled = true;
    toast('در حال ثبت اتمیک برد و پرونده…', 'info');
    api('win_offer', { offerNo:no, offerId:o._id || '', attachCaseId:attachCaseId, idempotencyKey:'WIN|' + (o._id || no) })
      .then(function (d) {
        toast(d.result && d.result.amendment ? 'متمم به پرونده متصل شد' : 'پیشنهاد برنده و پرونده یکتا ثبت شد', 'ok');
        try { audit('فروش', 'ثبت اتمیک برد و پرونده ' + no, (d.result||{}).caseId || no); } catch(e) {}
        if (typeof renderOffers === 'function') renderOffers();
        if (typeof renderDeals === 'function') renderDeals();
      }).catch(function (e) {
        if (selEl) selEl.value = o.st || 'sent';
        var map={duplicate_offer_no:'شماره پیشنهاد تکراری است',duplicate_sales_cases:'پرونده فروش تکراری شناسایی شد',amendment_customer_or_currency_mismatch:'مشتری یا ارز متمم با پرونده مقصد یکسان نیست'};
        alert('⛔ برد ثبت نشد و وضعیت قبلی حفظ شد:\n' + (map[e.message] || e.message));
      }).then(function(){if(selEl)selEl.disabled=false;});
  };
  if (typeof legacySetStatus === 'function') {
    window.offerSetSt = function (no, st, selEl) {
      if (st === 'won') return window.ptfSalesWinOffer(no, selEl);
      return legacySetStatus.apply(this, arguments);
    };
  }

  window.ptfMarkOfferAmendment=function(no){var o=findOffer(no);if(!o)return;var parents=data('ptf_crm_offers').filter(function(x){return x&&x.no!==no&&x.st==='won'&&!x.rialOf&&x.buyerCd===o.buyerCd&&String(x.currency||'IRR')===String(o.currency||'IRR')&&casesForOffer(x).length===1;});if(!parents.length){alert('برای همین مشتری و ارز، پیشنهاد برنده دارای پرونده یافت نشد.');return;}var hint=parents.map(function(x){return x.no+' — '+(x.buyerCo||'');}).join('\n');var parent=prompt('شماره پیشنهاد پایه برنده را وارد کنید:\n'+hint,parents[0].no);if(parent===null)return;parent=parent.trim();if(!parents.some(function(x){return x.no===parent;})){alert('پیشنهاد پایه معتبر نیست');return;}api('mark_amendment',{offerNo:no,parentOfferNo:parent}).then(function(){toast('پیشنهاد به‌عنوان متمم مستقل علامت‌گذاری شد؛ هنگام برد اتصال یا پرونده مستقل انتخاب می‌شود','ok');if(typeof renderOffers==='function')renderOffers();}).catch(function(e){alert('⛔ '+e.message);});};

  window.ptfAdminHardDelete=function(type,id,onDone){if(role()!=='admin'){alert('فقط ادمین مجاز است');return;}api('admin_delete_plan',{entityType:type,entityId:id,idempotencyKey:'DELETE-PLAN|'+type+'|'+id+'|'+Date.now()}).then(function(d){var p=d.plan||{},deps=p.dependencies||[],lines=deps.map(function(x){return x.type+' '+(x.id||'')+(x.amount?' — '+money(x.amount):'');}).join('\n');if(!confirm('پیش‌بررسی حذف '+type+':\n'+(lines||'بدون وابستگی')+(p.periodLocked?'\n\n⚠️ دوره مالی قفل است و با حذف، Snapshot نامعتبر و دوره باز می‌شود.':'')+'\n\nادامه؟'))return;var reason=prompt('دلیل حذف قطعی ادمین:','اشتباه ثبت/رکورد تکراری');if(reason===null||!reason.trim())return;return api('admin_delete_commit',{entityType:type,entityId:id,cascade:deps.length>0,confirm:'PTF-ADMIN-HARD-DELETE',reason:reason.trim(),idempotencyKey:'HARD-DELETE|'+type+'|'+id}).then(function(r){toast('حذف اتمیک انجام و Tombstone ثبت شد'+((r.result||{}).invalidatedYear?'؛ دوره '+r.result.invalidatedYear+' باز شد':''),'warn');if(typeof onDone==='function')onDone(r);});}).catch(function(e){alert('⛔ حذف انجام نشد: '+e.message);});};

  /* ----- Case financial workspace ----- */
  function caseReceipts(id) { return data('ptf_crm_case_receipts').filter(function (r) { return r && r.caseId === id; }); }
  function caseInvoices(id) { return data('ptf_crm_invoices').filter(function (i) { return i && i.caseId === id; }); }
  function activeAllocations(id) { return data('ptf_crm_receipt_allocations').filter(function (a) { return a && a.caseId === id && active(a); }); }
  function caseTotals(c) {
    var rs=caseReceipts(caseId(c)).filter(function(r){return active(r)&&r.status==='posted';});
    var ins=caseInvoices(caseId(c)).filter(active);
    var received=rs.reduce(function(s,r){return s+(+r.amountIRR||+r.amt||0);},0);
    var allocated=rs.reduce(function(s,r){return s+(+r.allocatedIRR||0);},0);
    var open=ins.reduce(function(s,i){return s+(i.openAmountIRR!=null?+i.openAmountIRR:Math.max(0,(+i.amount||0)-(+i.allocatedBase||0)-(+i.allocatedVat||0)));},0);
    return {received:received,allocated:allocated,credit:Math.max(0,received-allocated),open:open,receipts:rs,invoices:ins};
  }
  window.ptfCaseFinanceOpen = function (id) {
    var c=findCase(id); if(!c){alert('پرونده یافت نشد');return;}
    var t=caseTotals(c), cid=caseId(c), cur=c.currency||'IRR';
    var receipts=t.receipts.map(function(r){
      var fx=(r.currency&&r.currency!=='IRR')?' <small style="color:#0e7490">('+(+r.coveredFxAmount||0).toLocaleString('en-US')+' '+esc(r.currency)+' @ '+(+r.fxRate||0).toLocaleString('fa-IR')+')</small>':'';
      var acts=canFinance()?'<button class="bt bt-o" style="font-size:11px" onclick="ptfReceiptCorrectOpen(\''+arg(receiptId(r))+'\')">اصلاح</button> <button class="bt bt-o" style="font-size:11px;color:#b91c1c" onclick="ptfReceiptVoid(\''+arg(receiptId(r))+'\')">ابطال</button> ':'';
      if(role()==='admin')acts+='<button class="bt bt-o" style="font-size:11px;color:#b91c1c" onclick="ptfAdminHardDelete(\'receipt\',\''+arg(receiptId(r))+'\',function(){document.querySelectorAll(\'#ptfCaseFinanceDlg\').forEach(function(x){x.remove();});ptfCaseFinanceOpen(\''+arg(cid)+'\');})">حذف قطعی</button> ';
      acts+='<button class="bt bt-o" style="font-size:11px" onclick="ptfFinAttachOpen(\'receipt\',\''+arg(receiptId(r))+'\')">📎 اسناد</button>';
      return '<tr><td>'+esc(r.receivedAt||r.dateISO||'')+'</td><td>'+esc(r.method||r.how||'')+'</td><td>'+money(r.amountIRR||r.amt)+fx+'</td><td>'+money(r.creditRemainIRR||0)+'</td><td>'+acts+'</td></tr>';
    }).join('')||'<tr><td colspan="5">دریافتی قطعی ثبت نشده است.</td></tr>';
    var invoices=t.invoices.map(function(i){return '<tr><td>'+esc(i.no||i.cd)+'</td><td>'+esc(i.invDate||'')+'</td><td>'+money(i.base||0)+'</td><td>'+money(i.vat||0)+'</td><td>'+money(i.openAmountIRR!=null?i.openAmountIRR:i.amount||0)+'</td></tr>';}).join('')||'<tr><td colspan="5">فاکتور فعالی ثبت نشده است.</td></tr>';
    document.querySelectorAll('#ptfCaseFinanceDlg').forEach(function(x){x.remove();});
    var html='<div class="md-b" id="ptfCaseFinanceDlg" style="display:grid;z-index:2900" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:980px;max-height:92vh;overflow:auto">'+
      '<h3>💳 دریافت و حساب پرونده — '+esc(c.inqNo||c.wonOffer||cid)+'</h3><div style="font-size:12px;color:#64748b">مشتری: <b>'+esc(c.buyerCo||'')+'</b> | ارز قرارداد: <b>'+esc(cur)+'</b> | دریافت فقط رویداد قطعی مالی است؛ شرایط پیشنهاد اثر خزانه ندارد.</div>'+
      '<div class="sr" style="margin:10px 0"><div class="sc"><b>'+money(t.received)+'</b><span>کل دریافت قطعی</span></div><div class="sc"><b>'+money(t.allocated)+'</b><span>تخصیص به فاکتور</span></div><div class="sc"><b>'+money(t.credit)+'</b><span>بستانکاری پرونده</span></div><div class="sc"><b>'+money(t.open)+'</b><span>مطالبات باز</span></div></div>'+
      (canFinance()?'<button class="bt" onclick="ptfReceiptOpen(\''+arg(cid)+'\')">+ ثبت دریافت قطعی</button> ':'')+(role()==='admin'?'<button class="bt bt-o" style="color:#b91c1c" onclick="ptfAdminHardDelete(\'case\',\''+arg(cid)+'\',function(){document.querySelectorAll(\'#ptfCaseFinanceDlg\').forEach(function(x){x.remove();});if(typeof renderDeals===\'function\')renderDeals();})">حذف قطعی پرونده</button> ':'')+'<button class="bt bt-o" onclick="ptfFinAttachOpen(\'sales_case\',\''+arg(cid)+'\')">📎 اسناد مالی پرونده</button>'+
      '<h4>دریافت‌ها</h4><div class="tb2"><table><thead><tr><th>تاریخ</th><th>روش</th><th>مبلغ</th><th>بستانکاری باقیمانده</th><th>عملیات</th></tr></thead><tbody>'+receipts+'</tbody></table></div>'+
      '<h4>فاکتورهای رسمی فعال</h4><div class="tb2"><table><thead><tr><th>شماره</th><th>تاریخ</th><th>پایه</th><th>ارزش افزوده</th><th>مطالبه باز</th></tr></thead><tbody>'+invoices+'</tbody></table></div>'+
      '<div style="text-align:left;margin-top:12px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend',html);
  };
  window.ptfReceiptOpen = function (cid, existing) {
    if(!canFinance()){alert('⛔ فقط کاربران مالی مجازند');return;}
    var c=findCase(cid);if(!c)return;var fx=(c.currency||'IRR')!=='IRR';
    ptfDialog({title:(existing?'اصلاح':'ثبت')+' دریافت قطعی — '+(c.inqNo||c.wonOffer||''),body:'همه مبالغ به ریال هستند. چک از ماژول چک ثبت و فقط پس از وصول به دریافت قطعی تبدیل می‌شود.',fields:[
      {id:'amt',label:'مبلغ دریافتی (ریال) *',type:'number',required:true,dir:'ltr',value:existing?existing.amountIRR:''},
      {id:'date',label:'تاریخ دریافت *',value:existing?existing.receivedAt:(typeof faDate==='function'?faDate():'')},
      {id:'method',label:'روش دریافت *',type:'select',value:existing?existing.method:'bank_transfer',options:[{v:'bank_transfer',lb:'حواله بانکی'},{v:'cash',lb:'نقد'}]},
      {id:'account',label:'حساب/صندوق مقصد *',required:true,value:existing?existing.destinationAccount:''},
      {id:'ref',label:'شماره مرجع/پیگیری',value:existing?existing.referenceNo:''},
      {id:'rate',label:fx?'نرخ ارز روز دریافت (ریال per '+c.currency+') *':'نرخ ارز (برای پرونده ریالی خالی)',type:'number',dir:'ltr',value:existing?existing.fxRate:''},
      {id:'rateSource',label:fx?'منبع/توضیح نرخ *':'منبع نرخ',value:existing?existing.fxRateSource:''},
      {id:'note',label:'توضیح',type:'textarea',rows:2,value:existing?existing.note:''}
    ].concat(existing?[{id:'reason',label:'دلیل اصلاح *',type:'textarea',required:true,rows:2}]:[]),okText:existing?'ثبت اصلاحیه':'ثبت دریافت',onOk:function(v){
      var payload={caseId:caseId(c),amountIRR:num(v.amt),receivedAt:v.date,method:v.method,destinationAccount:v.account,referenceNo:v.ref,note:v.note,fxRate:num(v.rate),fxRateSource:v.rateSource};
      if(existing){payload.receiptId=receiptId(existing);payload.reason=v.reason;}
      api(existing?'correct_receipt':'post_receipt',payload).then(function(){toast(existing?'دریافت با سند معکوس اصلاح شد':'دریافت قطعی ثبت شد','ok');document.querySelectorAll('#ptfCaseFinanceDlg').forEach(function(x){x.remove();});window.ptfCaseFinanceOpen(caseId(c));if(typeof ptfTreasuryRender==='function')ptfTreasuryRender();}).catch(function(e){var map={fiscal_period_locked:'دوره مالی قفل است',fx_rate_and_source_required:'نرخ و منبع نرخ الزامی است',cheque_requires_collection:'چک باید ابتدا در ماژول چک وصول شود'};alert('⛔ '+(map[e.message]||e.message));});
    }});
  };
  window.ptfReceiptCorrectOpen = function (id) { var r=data('ptf_crm_case_receipts').filter(function(x){return receiptId(x)===String(id);})[0];if(r)window.ptfReceiptOpen(r.caseId,r); };
  window.ptfReceiptVoid = function (id) { var r=data('ptf_crm_case_receipts').filter(function(x){return receiptId(x)===String(id);})[0];if(!r)return;var reason=prompt('دلیل ابطال دریافت:', 'اشتباه ثبت');if(reason===null||!reason.trim())return;api('void_receipt',{receiptId:id,reason:reason.trim()}).then(function(){toast('دریافت ابطال و اثر خزانه/تخصیص بازسازی شد','ok');document.querySelectorAll('#ptfCaseFinanceDlg').forEach(function(x){x.remove();});window.ptfCaseFinanceOpen(r.caseId);if(typeof ptfTreasuryRender==='function')ptfTreasuryRender();}).catch(function(e){alert('⛔ '+e.message);}); };

  /* ----- Universal financial attachment manager for non-mandatory records. ----- */
  function ownerAttachments(type,id){return data('ptf_crm_fin_attachments').filter(function(a){return a&&a.ownerType===type&&a.ownerId===id&&active(a);});}
  window.ptfFinAttachOpen=function(type,id){
    if(!id)return;document.querySelectorAll('#ptfFinAttachDlg').forEach(function(x){x.remove();});var rows=ownerAttachments(type,id).map(function(a){return '<div style="display:flex;justify-content:space-between;gap:8px;padding:7px 0;border-bottom:1px dashed var(--brd)"><span>📎 '+esc(a.name||a.objectKey)+'<br><small>'+esc(a.category||'سند مالی')+' — '+esc(a.uploadedAt||'')+'</small></span><span><button class="bt bt-o" style="font-size:11px" onclick="openStoredFile(\''+arg(a.objectKey)+'\',\''+arg(a.name||'')+'\')">مشاهده</button> '+(canFinance()?'<button class="bt bt-o" style="font-size:11px" onclick="ptfFinAttachReplace(\''+arg(a._id)+'\',\''+arg(type)+'\',\''+arg(id)+'\')">اصلاح/جایگزینی</button> <button class="bt bt-o" style="font-size:11px;color:#b91c1c" onclick="ptfFinAttachDelete(\''+arg(a._id)+'\',\''+arg(type)+'\',\''+arg(id)+'\')">حذف</button>':'')+'</span></div>';}).join('')||'<div style="color:#94a3b8">سندی ثبت نشده است.</div>';
    var html='<div class="md-b" id="ptfFinAttachDlg" style="display:grid;z-index:3100" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:620px"><h3>📎 اسناد مالی رکورد</h3>'+rows+(canFinance()?'<div class="fld"><label>نوع/شرح سند</label><input id="ptfFinAttCat" value="supporting_document"></div><div id="ptfFinAttUp" style="border:1px dashed var(--brd);border-radius:10px;padding:8px"></div>':'')+'<div style="text-align:left;margin-top:10px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';document.getElementById('panels').insertAdjacentHTML('beforeend',html);
    if(canFinance()&&typeof attachUploadWidget==='function')attachUploadWidget('ptfFinAttUp','financial/'+type+'/'+id,function(f){var cat=((document.getElementById('ptfFinAttCat')||{}).value||'supporting_document').trim();api('attachment_add',{ownerType:type,ownerId:id,category:cat,file:f}).then(function(){toast('سند به خود رکورد متصل شد','ok');window.ptfFinAttachOpen(type,id);}).catch(function(e){deleteFinancialObject(f.key,function(){});alert('⛔ اتصال سند ناموفق بود و فایل موقت پاک شد: '+e.message);});});
  };
  window.ptfFinAttachReplace=function(attId,type,id){var reason=prompt('دلیل اصلاح/جایگزینی سند:','فایل صحیح جایگزین می‌شود');if(reason===null||!reason.trim())return;document.querySelectorAll('#ptfFinReplaceDlg').forEach(function(x){x.remove();});var html='<div class="md-b" id="ptfFinReplaceDlg" style="display:grid;z-index:3400" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:480px"><h3>جایگزینی نسخه‌دار سند مالی</h3><div id="ptfFinReplaceUp" style="border:1px dashed var(--brd);border-radius:9px;padding:8px"></div><button class="bt bt-o" style="margin-top:8px" onclick="this.closest(\'.md-b\').remove()">انصراف</button></div></div>';document.getElementById('panels').insertAdjacentHTML('beforeend',html);if(typeof attachUploadWidget==='function')attachUploadWidget('ptfFinReplaceUp','financial/'+type+'/'+id+'/replacements',function(f){api('attachment_replace',{attachmentId:attId,ownerType:type,ownerId:id,reason:reason.trim(),file:f}).then(function(){toast('نسخه جدید فعال و نسخه قبل در تاریخچه نگهداری شد','ok');document.querySelectorAll('#ptfFinReplaceDlg').forEach(function(x){x.remove();});window.ptfFinAttachOpen(type,id);}).catch(function(e){deleteFinancialObject(f.key,function(){});alert('⛔ جایگزینی انجام نشد؛ نسخه قبلی فعال ماند و فایل موقت پاک شد: '+e.message);});});};
  function deleteFinancialObject(key,cb){fetch('../api/storage.php?action=delete_financial',{method:'POST',headers:authHeaders(),body:JSON.stringify({key:key})}).then(function(r){return r.json().then(function(d){if(!r.ok||!d.ok)throw new Error(d.error||('HTTP '+r.status));return d;});}).then(function(d){cb({ok:true,data:d});}).catch(function(e){cb({ok:false,error:e.message||'حذف ابری ناموفق'});});}
  window.ptfFinAttachDelete=function(attId,type,id){var reason=prompt('دلیل حذف سند مالی:','فایل اشتباه');if(reason===null||!reason.trim())return;var a=data('ptf_crm_fin_attachments').filter(function(x){return x&&x._id===attId;})[0];if(!a)return;if(!confirm('فایل از فضای ابری و رکورد مالی حذف شود؟ Metadata حسابرسی باقی می‌ماند.'))return;deleteFinancialObject(a.objectKey,function(res){if(!res.ok){alert('⛔ فایل ابری حذف نشد و رکورد دست‌نخورده ماند: '+res.error);return;}api('attachment_delete',{attachmentId:attId,ownerType:type,ownerId:id,reason:reason.trim()}).then(function(){toast('فایل ابری حذف و Tombstone مالی ثبت شد','warn');window.ptfFinAttachOpen(type,id);}).catch(function(e){alert('⛔ فایل ابری حذف شد ولی ثبت Tombstone خطا داد؛ فوراً کیفیت داده را بررسی کنید: '+e.message);});});};

  /* ----- Read-only deterministic integrity engine + reviewed repair. ----- */
  window.ptfSalesIntegrityScan=function(){
    var out=[],offers=data('ptf_crm_offers'),cases=data('ptf_crm_deals'),invs=data('ptf_crm_invoices'),rs=data('ptf_crm_case_receipts'),als=data('ptf_crm_receipt_allocations');
    var byNo={};offers.forEach(function(o){if(o&&o.no)(byNo[o.no]=byNo[o.no]||[]).push(o);});Object.keys(byNo).forEach(function(no){if(byNo[no].length>1)out.push({id:'duplicate-offer:'+no,severity:'critical',type:'duplicate_offer',label:'شماره پیشنهاد تکراری '+no,evidence:byNo[no]});});
    offers.forEach(function(o){if(!o||o.st!=='won'||o.rialOf)return;var cs=casesForOffer(o);if(!cs.length)out.push({id:'orphan-won:'+o.no,severity:'critical',type:'orphan_won',offerNo:o.no,label:'پیشنهاد برنده بدون پرونده: '+o.no});else if(cs.length>1)out.push({id:'duplicate-case:'+o.no,severity:'critical',type:'duplicate_case',offerNo:o.no,label:cs.length+' پرونده برای پیشنهاد '+o.no});if(o.advance&&(o.advance.cashFull||o.advance.paid)&&!arr(o.advance.payments).length)out.push({id:'synthetic-advance:'+o.no,severity:'critical',type:'synthetic_advance',offerNo:o.no,label:'اثر استنتاجی paid/cashFull بدون رویداد وصول: '+o.no});});
    invs.forEach(function(i){if(!i||i.isUnofficial||!active(i))return;var fs=arr(i.files).filter(function(f){return active(f)&&['accounting_official_invoice','modian_tax_invoice'].indexOf(f.category)>-1;});if(!fs.length)out.push({id:'invoice-file:'+invoiceId(i),severity:'high',type:'missing_invoice_attachment',invoiceId:invoiceId(i),label:'فاکتور رسمی بدون مدرک اجباری: '+(i.no||i.cd)});});
    als.forEach(function(a){if(!a||!active(a))return;var receipt=rs.filter(function(r){return receiptId(r)===a.receiptId;})[0],inv=invs.filter(function(i){return invoiceId(i)===a.invoiceId;})[0];if(!receipt||!active(receipt)||!inv||!active(inv))out.push({id:'orphan-allocation:'+String(a._id||a.cd),severity:'critical',type:'orphan_allocation',label:'تخصیص فعال با مبدأ ابطال/مفقود'});});
    return out;
  };

  /* راهنمای گام‌به‌گام یافته‌ها: هر ردیف باید هم «چرا» را توضیح دهد، هم شواهد
     واقعی را نشان دهد و فقط در پایان یک فرمان کنترل‌شدهٔ سرور پیشنهاد کند. */
  function findingById(id){return window.ptfSalesIntegrityScan().filter(function(x){return x.id===id;})[0]||null;}
  function localCaseByCandidate(c){return data('ptf_crm_deals').filter(function(x){return x&&[String(x._id||''),String(x.cd||'')].indexOf(String(c.id||c.cd||''))>-1;})[0]||null;}
  function caseStageInfo(c){var local=localCaseByCandidate(c),n=0,label='مرحله نامشخص';try{if(local&&typeof window.sfStageOf==='function')n=window.sfStageOf(local);if(local&&typeof window.sfStageLabel==='function')label=window.sfStageLabel(local)||label;}catch(e){}return{record:local,stage:n,label:label};}
  function evidenceText(c){
    var labels={docs:'مدارک',shipEvents:'رویدادهای ارسال/تحویل',timeline:'تاریخچه',awardDocs:'مدارک ابلاغ',files:'فایل‌ها',invoices:'فاکتور',receipts:'دریافت قطعی',allocations:'تخصیص',attachments:'ضمیمه مالی',petty:'تنخواه مرتبط',opex:'هزینه جاری مرتبط',issuedCheques:'چک صادره مرتبط',receivedCheques:'چک وارده مرتبط',salesReturns:'مرجوعی فروش مرتبط'};
    var parts=[];Object.keys(c.evidence||{}).forEach(function(k){parts.push((labels[k]||k)+': '+c.evidence[k]);});
    Object.keys(c.related||{}).forEach(function(k){if(+c.related[k])parts.push((labels[k]||k)+': '+c.related[k]);});
    return parts.length?parts.join('، '):'هیچ شاهد آرایه‌ای یا وابستگی مالی ثبت نشده';
  }
  function closeFindingGuide(){document.querySelectorAll('#ptfSalesFindingGuide').forEach(function(x){x.remove();});}
  function insertFindingGuide(body,title){
    closeFindingGuide();
    var html='<div class="md-b" id="ptfSalesFindingGuide" style="display:grid;z-index:3600" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:980px;max-height:94vh;overflow:auto"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><h3 style="margin:0">🧭 '+esc(title)+'</h3><button class="bt bt-o" onclick="closeFindingGuide()">✕</button></div>'+body+'</div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend',html);
  }
  window.closeFindingGuide=closeFindingGuide;
  function genericFindingGuide(f){
    var defs={
      orphan_won:['پیشنهاد برنده است اما هیچ پرونده فعالی به آن متصل نیست.','شماره پیشنهاد و مشتری را کنترل کنید.','مطمئن شوید پرونده در بایگانی یا دستگاه دیگر وجود ندارد.','اگر واقعاً پرونده‌ای تشکیل نشده، «بازگرداندن کنترل‌شده» را بزنید؛ پیشنهاد حذف نمی‌شود.'],
      duplicate_offer:['بیش از یک رکورد با یک شماره پیشنهاد وجود دارد؛ سیستم اجازه حدس‌زدن رکورد صحیح را ندارد.','تاریخ، مشتری، اقلام و شناسه داخلی هر نسخه را مقایسه کنید.','رکورد دارای پرونده/فاکتور/دریافت را بدون بررسی حذف نکنید.','پس از تعیین رکورد اصلی، حذف یا ادغام باید با پیش‌بررسی وابستگی و ثبت دلیل انجام شود.'],
      synthetic_advance:['علامت paid/cashFull بدون رویداد دریافت واقعی پیدا شده است.','رسید بانکی و پرونده فروش را بررسی کنید.','اگر دریافت واقعی بوده، آن را از «دریافت و حساب پرونده» ثبت کنید.','اگر فقط شرط پرداخت بوده، هیچ اثر مالی نسازید؛ این هشدار یادآور پاک‌سازی metadata قدیمی است.'],
      missing_invoice_attachment:['فاکتور رسمی فعال حداقل یک فایل معتبر حسابداری یا مودیان ندارد.','فاکتور را در ماژول فاکتورها باز کنید.','تصویر یا PDF معتبر را مشاهده و بارگذاری کنید.','در صورت جایگزینی، دلیل را ثبت کنید؛ ضمیمه رسمی مستقل حذف نمی‌شود.'],
      orphan_allocation:['یک تخصیص مالی به دریافت یا فاکتور فعال متصل نیست.','شناسه دریافت و فاکتور را در گردش حساب بررسی کنید.','هیچ مبلغی را دستی تکرار نکنید.','اصلاح باید با بازسازی تخصیص‌های همان پرونده و حفظ سابقه انجام شود.']
    };
    var steps=defs[f.type]||['این یافته نیازمند بررسی داده‌های مبدأ است.','رکوردهای مرتبط را باز و شناسه‌ها را مقایسه کنید.','قبل از هر اقدام از وابستگی مالی/عملیاتی مطمئن شوید.','فقط از اقدام کنترل‌شده همان ردیف استفاده کنید.'];
    var action=f.type==='orphan_won'&&canRepairOfferWin()?'<button class="bt" onclick="closeFindingGuide();ptfRevokeOfferWin(\''+arg(f.offerNo)+'\')">بازگرداندن کنترل‌شده پیشنهاد</button>':'';
    return '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:10px;margin-top:12px"><b>یافته:</b> '+esc(f.label)+'</div><ol style="line-height:2.1;margin:12px 20px">'+steps.map(function(s){return'<li>'+esc(s)+'</li>';}).join('')+'</ol><div style="display:flex;justify-content:flex-end;gap:8px"><button class="bt bt-o" onclick="closeFindingGuide()">فعلاً فقط بررسی می‌کنم</button>'+action+'</div>';
  }
  function duplicateCaseGuide(f,plan){
    var candidates=plan.candidates||[],localStages=candidates.map(caseStageInfo);
    var visible=candidates.filter(function(c,i){return String(c.status||'').toLowerCase()!=='archived'&&localStages[i].stage!==12;});
    var reviewHint='سیستم به‌جای شما پرونده اصلی را حدس نمی‌زند.';
    if(plan.recommendedKeepId)reviewHint='یک پرونده فاقد هرگونه شاهد است؛ پرونده پیشنهادی برای نگهداری: '+plan.recommendedKeepId;
    else if(visible.length===1)reviewHint='فقط یک پرونده فعال دیده می‌شود؛ پرونده دیگر احتمالاً بایگانی/پنهان است. معمولاً پرونده فعال گزینه نگهداری است، اما جزئیات هر دو را بازبینی کنید.';
    else {var ranked=candidates.map(function(c,i){return{id:c.id,stage:localStages[i].stage,status:c.status};}).filter(function(x){return x.stage>0&&x.stage<12;}).sort(function(a,b){return b.stage-a.stage;});if(ranked.length>1&&ranked[0].stage>ranked[1].stage)reviewHint='برای بررسی اولیه، پرونده مرحله بالاتر ('+ranked[0].stage+') با شناسه '+ranked[0].id+' گزینه منطقی‌تری برای نگهداری است؛ ادغام، شواهد یکتای پرونده دیگر را نیز منتقل می‌کند.';}
    var cards=candidates.map(function(c,i){var si=localStages[i],hidden=String(c.status||'').toLowerCase()==='archived'||si.stage===12,open=si.record&&si.record.cd?'<button class="bt bt-o" style="font-size:11px" onclick="closeFindingGuide();ptfGoSalesFile(\''+arg(si.record.cd)+'\')">بازکردن پرونده</button>':'';return '<div style="border:2px solid '+(hidden?'#cbd5e1':'#93c5fd')+';border-radius:12px;padding:10px;background:'+(hidden?'#f8fafc':'#fff')+'"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b dir="ltr">'+esc(c.id||c.cd)+'</b>'+open+'</div><div style="margin-top:6px"><b>'+esc(si.label)+'</b>'+(si.stage?' ('+si.stage+'/12)':'')+(hidden?' — <span style="color:#b45309">بایگانی/پنهان</span>':'')+'</div><div style="font-size:12px;color:#475569;line-height:1.9">درخواست: '+esc(c.inqNo||'—')+'<br>مشتری: '+esc(c.buyerCo||'—')+'<br>وضعیت ذخیره‌شده: '+esc(c.status||'—')+'<br>تاریخ: '+esc(c.createdAt||'—')+'<br>شواهد: '+esc(evidenceText(c))+'</div></div>';}).join('');
    if(candidates.length<2)return '<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:12px;padding:12px;margin-top:12px"><b>سرور اکنون فقط '+candidates.length+' پرونده مرتبط می‌بیند.</b><br>این حالت معمولاً از کش محلی قدیمی ناشی می‌شود. ابتدا داده سرور را دریافت و دوباره بررسی کنید.</div><div style="margin-top:10px;text-align:left"><button class="bt" onclick="closeFindingGuide();ptfSyncPullNow(function(){if(typeof renderOffers===\'function\')renderOffers();})">دریافت مجدد داده سرور</button></div>';
    var opts='<option value="">— انتخاب کنید —</option>'+candidates.map(function(c){return'<option value="'+esc(c.id)+'"'+(plan.recommendedKeepId===c.id?' selected':'')+'>'+esc(c.id)+' — '+esc(c.inqNo||'')+'</option>';}).join('');
    return '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:10px;margin-top:12px"><b>چرا این هشدار آمده؟</b><br>در داده سرور '+candidates.length+' رکورد فعال از طریق شماره پیشنهاد یا شناسه ریشه به <span dir="ltr">'+esc(f.offerNo)+'</span> متصل‌اند. حتی پرونده بایگانی‌شده یا پنهان نیز برای جلوگیری از دوباره‌کاری شمرده می‌شود.</div><h4>گام ۱ — هر دو پرونده را مقایسه کنید</h4><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px">'+cards+'</div><div style="background:#fff7ed;border:1px solid #fdba74;border-radius:10px;padding:9px;margin-top:10px"><b>راهنمای انتخاب:</b> '+esc(reviewHint)+'</div><h4>گام ۲ — پرونده اصلی و پرونده تکراری را صریح انتخاب کنید</h4><div class="fr"><div class="fld"><label>پرونده‌ای که باقی می‌ماند *</label><select id="dupKeep" onchange="ptfDuplicateCaseKeepChanged()">'+opts+'</select></div><div class="fld"><label>پرونده‌ای که داخل پرونده اصلی ادغام می‌شود *</label><select id="dupRemove">'+opts.replace(' selected','')+'</select></div></div><div style="background:#ecfdf5;border:1px solid #86efac;border-radius:10px;padding:9px;font-size:12px;line-height:1.9"><b>این عملیات حذف خام نیست:</b> رویدادها، مدارک و تاریخچه یکتا با هم ادغام می‌شوند؛ فاکتور، دریافت، تخصیص، ضمیمه مالی، تنخواه، هزینه جاری، چک و مرجوعی به پرونده اصلی منتقل می‌شوند؛ snapshot کامل پرونده ادغام‌شده در بایگانی حسابرسی باقی می‌ماند. در تعارض فیلدهای متنی، مقدار پرونده‌ای که نگه می‌دارید مقدم است.</div><h4>گام ۳ — دلیل و تایید نهایی</h4><div class="fld"><label>دلیل ادغام *</label><textarea id="dupReason" rows="2" placeholder="مثلاً: پرونده تکراری ناشی از ثبت دوباره برد؛ پرونده مرحله ۶ نگهداری شد"></textarea></div><div class="fld"><label>برای تایید، کلمه «ادغام» را وارد کنید *</label><input id="dupConfirm" autocomplete="off"></div><div style="display:flex;justify-content:flex-end;gap:8px"><button class="bt bt-o" onclick="closeFindingGuide()">انصراف بدون تغییر</button><button class="bt" id="dupMergeBtn" onclick="ptfDuplicateCaseMergeCommit(\''+arg(f.offerNo)+'\',\''+arg(plan.planHash)+'\')">پیش‌بررسی نهایی و ادغام کنترل‌شده</button></div>';
  }
  window.ptfDuplicateCaseKeepChanged=function(){var k=(document.getElementById('dupKeep')||{}).value,r=document.getElementById('dupRemove');if(!r)return;var opts=Array.prototype.slice.call(r.options).filter(function(o){return o.value&&o.value!==k;});if(opts.length===1)r.value=opts[0].value;};
  window.ptfDuplicateCaseMergeCommit=function(no,planHash){
    if(!canRepairOfferWin()){alert('فقط ادمین یا رئیس هیئت‌مدیره مجاز است');return;}
    var keep=(document.getElementById('dupKeep')||{}).value||'',remove=(document.getElementById('dupRemove')||{}).value||'',reason=((document.getElementById('dupReason')||{}).value||'').trim(),confirmWord=((document.getElementById('dupConfirm')||{}).value||'').trim();
    if(!keep||!remove||keep===remove){alert('پرونده اصلی و پرونده تکراری را جداگانه انتخاب کنید');return;}if(!reason){alert('دلیل ادغام الزامی است');return;}if(confirmWord!=='ادغام'){alert('برای جلوگیری از اشتباه، کلمه «ادغام» را دقیق وارد کنید');return;}
    var btn=document.getElementById('dupMergeBtn');if(btn){btn.disabled=true;btn.textContent='در حال پیش‌بررسی و ثبت اتمیک…';}
    api('duplicate_case_merge',{offerNo:no,keepCaseId:keep,removeCaseId:remove,reason:reason,planHash:planHash,confirm:'PTF-DUPLICATE-CASE-MERGE',idempotencyKey:'MERGE-DUP-CASE|'+no+'|'+keep+'|'+remove+'|'+String(planHash).slice(0,16)})
      .then(function(d){var r=d.result||{},m=r.movedReferences||{};closeFindingGuide();toast('پرونده‌ها بدون حذف شواهد ادغام شدند؛ '+Object.keys(m).reduce(function(s,k){return s+(+m[k]||0);},0)+' ارجاع مرتبط منتقل شد','ok');if(typeof renderOffers==='function')renderOffers();if(typeof renderDeals==='function')renderDeals();if(typeof ptfDataQualityRender==='function')ptfDataQualityRender();})
      .catch(function(e){var map={duplicate_case_plan_stale:'داده از زمان بازکردن راهنما تغییر کرده است؛ راهنما را ببندید و دوباره باز کنید.',case_identity_conflict:'هویت دو پرونده متفاوت است؛ ادغام خودکار متوقف شد تا پرونده اشتباه ترکیب نشود.',duplicate_case_not_found:'سرور دیگر دو پرونده مرتبط نمی‌بیند؛ ابتدا همگام‌سازی کنید.'};alert('⛔ '+(map[e.message]||e.message));if(btn){btn.disabled=false;btn.textContent='پیش‌بررسی نهایی و ادغام کنترل‌شده';}});
  };
  window.ptfSalesFindingGuideOpen=function(id){
    var f=findingById(id);if(!f){alert('این یافته پس از تازه‌سازی دیگر وجود ندارد');return;}
    if(f.type!=='duplicate_case'){insertFindingGuide(genericFindingGuide(f),'راهنمای بررسی و رفع یافته');return;}
    if(!canRepairOfferWin()){insertFindingGuide(genericFindingGuide(f)+'<div style="color:#b45309;margin-top:8px">نمایش جزئیات و ادغام پرونده فقط برای ادمین یا رئیس هیئت‌مدیره مجاز است.</div>','راهنمای پرونده تکراری');return;}
    insertFindingGuide('<div style="padding:24px;text-align:center">در حال دریافت پیش‌بررسی بدون تغییر از سرور…</div>','راهنمای پرونده تکراری');
    api('duplicate_case_plan',{offerNo:f.offerNo}).then(function(d){insertFindingGuide(duplicateCaseGuide(f,d.plan||{}),'رفع گام‌به‌گام پرونده‌های تکراری — '+f.offerNo);}).catch(function(e){insertFindingGuide('<div style="background:#fee2e2;color:#991b1b;border-radius:10px;padding:12px;margin-top:12px">پیش‌بررسی سرور دریافت نشد: '+esc(e.message)+'</div>','راهنمای پرونده تکراری');});
  };

  /* اصلاح برد فقط از مرز فرمان سرور انجام می‌شود؛ مسیر قدیمی backup.js که localStorage
     و projects قدیمی را مستقیم تغییر می‌داد، در داده واقعی می‌توانست deal را یتیم کند. */
  window.ptfRevokeOfferWin=function(no){
    if(!canRepairOfferWin()){alert('فقط ادمین یا رئیس هیئت‌مدیره مجاز به بازگرداندن برد است');return;}
    var reason=prompt('دلیل بازگرداندن پیشنهاد برنده به وضعیت قبل:','برد اشتباه / نیاز به اصلاح پیشنهاد');
    if(reason===null||!reason.trim())return;
    if(!confirm('⚠️ سرور ابتدا پرونده، فاکتور و سایر وابستگی‌ها را بررسی می‌کند. فقط برد بدون وابستگی بازگردانده می‌شود. ادامه می‌دهید؟'))return;
    api('revoke_orphan_delete',{offerNo:no,delete:false,reason:reason.trim(),idempotencyKey:'REVOKE-WIN|'+no+'|'+Date.now()})
      .then(function(){toast('برد کنترل‌شده لغو و پیشنهاد به وضعیت قبل بازگردانده شد','ok');if(typeof renderOffers==='function')renderOffers();if(typeof ptfDataQualityRender==='function')ptfDataQualityRender();})
      .catch(function(e){
        if(e.payload&&e.payload.dependencies)alert('⛔ این پیشنهاد وابستگی عملیاتی دارد و بازگشت خودکار متوقف شد:\n'+e.payload.dependencies.map(function(x){return x.type+' '+x.id;}).join('\n')+'\n\nابتدا وابستگی‌ها را از پرونده مربوط بررسی و اصلاح کنید.');
        else alert('⛔ '+e.message);
      });
  };
  window.ptfRepairOrphanOffer=function(no){if(role()!=='admin'){alert('حذف پیشنهاد فقط برای ادمین مجاز است');return;}var reason=prompt('برد این پیشنهاد لغو و خود پیشنهاد حذف شود. دلیل:','برد اشتباه و پرونده تشکیل نشده');if(reason===null||!reason.trim())return;if(!confirm('⚠️ پس از پیش‌بررسی سرور، برد لغو و پیشنهاد با Tombstone حذف شود؟'))return;api('revoke_orphan_delete',{offerNo:no,delete:true,reason:reason.trim()}).then(function(){toast('برد یتیم لغو و پیشنهاد حذف شد','ok');if(typeof renderOffers==='function')renderOffers();if(typeof ptfDataQualityRender==='function')ptfDataQualityRender();}).catch(function(e){if(e.payload&&e.payload.dependencies)alert('⛔ وابستگی وجود دارد:\n'+e.payload.dependencies.map(function(x){return x.type+' '+x.id;}).join('\n'));else alert('⛔ '+e.message);});};
  window.ptfSalesMigrationOpen=function(){
    if(role()!=='admin'){alert('فقط ادمین مجاز است');return;}
    api('migration_dry_run',{idempotencyKey:'DRYRUN|'+Date.now()}).then(function(d){var r=d.report||{},issues=r.issues||[],safe=r.safeReceiptCandidates||[];document.querySelectorAll('#ptfSalesMigrationDlg').forEach(function(x){x.remove();});var html='<div class="md-b" id="ptfSalesMigrationDlg" style="display:grid;z-index:3500" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:900px;max-height:94vh;overflow:auto"><h3>مهاجرت کنترل‌شده فروش تا وصول v35</h3><div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:9px;font-size:12px">فقط payments[] واقعی، غیرچکی و دارای پرونده یکتا منتقل می‌شود. paid/cashFull بدون رویداد و همه موارد مبهم هیچ اثر مالی نمی‌گیرند.</div><div class="sr" style="margin:9px 0"><div class="sc"><b>'+safe.length+'</b><span>وصول قابل مهاجرت امن</span></div><div class="sc"><b>'+issues.length+'</b><span>مورد مبهم/نیازمند بررسی</span></div></div><h4>موارد مبهم</h4><div style="font-size:12px">'+(issues.map(function(x){return'<div style="padding:4px;border-bottom:1px dashed var(--brd)">'+esc(x.type)+' — '+esc(x.ref||'')+(x.amount?' — '+money(x.amount):'')+'</div>';}).join('')||'موردی نیست')+'</div><h4>وصول‌های امن پیشنهادی</h4><div style="font-size:12px">'+(safe.map(function(x){return'<div style="padding:4px;border-bottom:1px dashed var(--brd)">'+esc(x.offerNo)+' — '+money(x.amount)+' — '+esc(x.paymentRef||'')+'</div>';}).join('')||'موردی نیست')+'</div><div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">انصراف</button><button class="bt" '+(safe.length?'':'disabled')+' onclick="ptfSalesMigrationCommit()">بک‌آپ را تأیید می‌کنم — اجرای موارد امن</button></div></div></div>';document.getElementById('panels').insertAdjacentHTML('beforeend',html);}).catch(function(e){alert('⛔ گزارش مهاجرت دریافت نشد: '+e.message);});
  };
  window.ptfSalesMigrationCommit=function(){if(!confirm('فقط موارد بدون ابهام مهاجرت شوند؟ موارد مشکوک دست‌نخورده و در کیفیت داده باقی می‌مانند.'))return;api('migration_apply_safe',{confirm:'PTF-SALES-V35-MIGRATE',idempotencyKey:'MIGRATE-SALES-V35'}).then(function(d){toast((d.result||{}).migratedReceipts+' وصول واقعی مهاجرت شد؛ موارد مبهم دست‌نخورده ماند','ok');document.querySelectorAll('#ptfSalesMigrationDlg').forEach(function(x){x.remove();});if(typeof ptfDataQualityRender==='function')ptfDataQualityRender();}).catch(function(e){alert('⛔ مهاجرت متوقف شد: '+e.message);});};
  window.ptfSalesIntegrityHtml=function(){
    var f=window.ptfSalesIntegrityScan();
    var adminAction=role()==='admin'?'<button class="bt bt-o" style="font-size:11px;margin-right:6px" onclick="ptfSalesMigrationOpen()">گزارش و مهاجرت کنترل‌شده</button>':'';
    if(!f.length)return '<div style="background:#ecfdf5;border:1px solid #bbf7d0;border-radius:10px;padding:8px;margin:8px 0;color:#065f46">✅ یکپارچگی فروش تا وصول تأیید شد.'+adminAction+'</div>';
    var roleNote=!canRepairOfferWin()?'<div style="font-size:11px;color:#9a3412;margin-top:5px">اصلاح برد فقط برای ادمین یا رئیس هیئت‌مدیره فعال است؛ نقش فعلی: '+esc(role()||'نامشخص')+'</div>':'';
    return '<div style="background:#fff7ed;border:1px solid #fdba74;border-radius:10px;padding:9px;margin:8px 0"><b style="color:#9a3412">⚠️ '+f.length+' یافته فروش تا وصول</b>'+adminAction+roleNote+f.map(function(x){
      var guide=' <button class="bt bt-o" style="font-size:11px;color:#1d4ed8;border-color:#93c5fd" onclick="ptfSalesFindingGuideOpen(\''+arg(x.id)+'\')">🧭 راهنمای بررسی و رفع</button>';
      var revoke=x.type==='orphan_won'&&canRepairOfferWin()?' <button class="bt bt-o" style="font-size:11px;color:#b45309" onclick="ptfRevokeOfferWin(\''+arg(x.offerNo)+'\')">بازگرداندن کنترل‌شده به وضعیت قبل</button>':'';
      var remove=x.type==='orphan_won'&&role()==='admin'?' <button class="bt bt-o" style="font-size:11px;color:#b91c1c" onclick="ptfRepairOrphanOffer(\''+arg(x.offerNo)+'\')">لغو برد و حذف پیشنهاد</button>':'';
      return '<div style="padding:7px 0;border-bottom:1px dashed #fed7aa;display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span style="margin-left:auto">'+esc(x.label)+'</span>'+guide+revoke+remove+'</div>';
    }).join('')+'</div>';
  };

  function hookQuality(){if(window._salesV2QualityHook||typeof window.ptfDataQualityHtml!=='function')return false;window._salesV2QualityHook=true;var old=window.ptfDataQualityHtml;window.ptfDataQualityHtml=function(){return old()+'<div id="salesIntegrityQuality">'+window.ptfSalesIntegrityHtml()+'</div>';};var oldRender=window.ptfDataQualityRender;if(typeof oldRender==='function')window.ptfDataQualityRender=function(){oldRender.apply(this,arguments);var el=document.getElementById('salesIntegrityQuality');if(el)el.innerHTML=window.ptfSalesIntegrityHtml();};return true;}
  function hookOfferRender(){if(window._salesV2OfferRenderHook||typeof window.renderOffers!=='function')return false;window._salesV2OfferRenderHook=true;var old=window.renderOffers;window.renderOffers=function(){old.apply(this,arguments);var host=document.getElementById('oTb');if(!host)return;var findings=window.ptfSalesIntegrityScan().filter(function(x){return x.type==='orphan_won'||x.type==='duplicate_offer'||x.type==='duplicate_case';});var oldBox=document.getElementById('ptfOfferIntegrity');if(oldBox)oldBox.remove();if(findings.length)host.insertAdjacentHTML('beforebegin','<div id="ptfOfferIntegrity">'+window.ptfSalesIntegrityHtml()+'</div>');};return true;}
  hookQuality();hookOfferRender();var hookTry=0,hookTimer=setInterval(function(){hookTry++;var a=hookQuality(),b=hookOfferRender();if((window._salesV2QualityHook&&window._salesV2OfferRenderHook)||hookTry>30)clearInterval(hookTimer);},300);
})();
