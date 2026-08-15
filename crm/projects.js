/* =====================================================================
   PTF CRM — Sprint 63
   US-118: پرونده پروژه (Project File) — مدارک متمرکز
   US-120: پکینگ لیست با تحویل جزئی و ردیابی باقیمانده
   ===================================================================== */

/* ============ US-118: پرونده پروژه ============ */
var PRJ_FOLDERS = [
  { id: 'req',   lb: 'اصل درخواست و ضمائم' },
  { id: 'fin',   lb: 'پیش‌فاکتور و اسناد مالی' },
  { id: 'cat',   lb: 'کاتالوگ و دیتاشیت' },
  { id: 'dwg',   lb: 'نقشه‌ها' },
  { id: 'insp',  lb: 'نوت‌های بازرسی (MTC/TPI/Release Note)' },
  { id: 'ship',  lb: 'پکینگ لیست و اسناد حمل' },
  { id: 'corr',  lb: 'مکاتبات' },
  { id: 'photo', lb: 'گالری تصاویر' },
  { id: 'other', lb: 'سایر' }
];
var PHOTO_TAGS = ['کالا', 'بازرسی', 'بارگیری', 'تحویل', 'سایت کارفرما'];

function prjSerial() {
  var list = getData('ptf_crm_projects');
  var max = 0;
  list.forEach(function (p) {
    var m = (p.no || '').match(new RegExp('^PTF-PRJ-' + faYear() + '-(\\d+)$'));
    if (m && +m[1] > max) max = +m[1];
  });
  return 'PTF-PRJ-' + faYear() + '-' + String(max + 1).padStart(3, '0');
}

function prjCostLabels() {
  return { warranty: 'گارانتی/خدمات پس از تحویل', service: 'خدمات/اعزام', repair: 'اصلاح/تعویض', logistics: 'حمل برگشتی/لجستیک', other: 'سایر' };
}
function prjAllCosts(p) {
  return ((p && p.costEvents) || []).concat((p && p.postArchiveCosts) || []);
}
function prjCostTotal(p) {
  return prjAllCosts(p).reduce(function (s, x) { return s + (+x.amt || 0); }, 0);
}
function prjDeleteCloudKeys(keys) {
  keys = (keys || []).filter(Boolean);
  if (!keys.length) return;
  try {
    fetch((typeof STORAGE_API !== 'undefined' ? STORAGE_API : '../api/storage.php') + '?action=delete_batch', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys: keys })
    }).catch(function () {});
  } catch (e) {}
}

/* v13.3 (US-323): چه کسی مجاز به تغییر اسناد پرونده بایگانی‌شده است */
window.ptfArcDocAllowed = function () {
  try { var r = curRole(); return ['admin', 'chairman', 'commercial', 'ceo'].indexOf(r) > -1; } catch (e) { return false; }
};
function buildProjects() {
  return '<div class="ph"><h3>🗄 بایگانی</h3>' +
    '<div class="sb2"><input type="text" id="prjSrch" placeholder="جستجو: شماره، کارفرما..." oninput="renderProjects2()"></div></div>' +
    /* v13.6 (US-322 تکمیلی): بایگانی = فقط مقصد پرونده‌های مختومه — تشکیل دستی حذف شد */
    '<div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:12px;padding:9px 14px;margin-bottom:12px;font-size:12px;color:#5b21b6">🗄 بایگانی مقصد پرونده‌های <b>مختومه</b> است (از «پرونده‌های فروش» با دکمه مختومه منتقل می‌شوند) — برای ثبت آماری و تحلیل‌های مدیریتی. پرونده در اینجا ساخته نمی‌شود.</div>' +
    '<div id="prjWrap"></div>';
}

function prjDeliveryPct(p) {
  // درصد پیشرفت تحویل از پکینگ لیست‌ها (AC4 US-118)
  var o = getData('ptf_crm_offers').filter(function (x) { return x.no === p.offerNo; })[0];
  if (!o || !o.items || !o.items.length) return 0;
  var totQty = 0, delQty = 0;
  var rem = plRemaining(p.offerNo);
  o.items.forEach(function (it, i) {
    var q = +it.qty || 0;
    totQty += q;
    delQty += q - (rem[i] != null ? rem[i] : q);
  });
  return totQty ? Math.round(delQty * 100 / totQty) : 0;
}

function renderProjects2() {
  var el = document.getElementById('prjWrap');
  if (!el) return;
  var q = ((document.getElementById('prjSrch') || {}).value || '').trim().toLowerCase();
  var list = getData('ptf_crm_projects').filter(function (p) {
    return !q || ((p.no || '') + ' ' + (p.buyerCo || '') + ' ' + (p.offerNo || '')).toLowerCase().indexOf(q) > -1;
  });
  var STATES = { open: 'باز', supply: 'در حال تامین', partial: 'تحویل جزئی', done: 'تحویل کامل', closed: 'بسته‌شده', archived: '🗄 بایگانی‌شده' };
  var h = '';
  list.forEach(function (p) {
    var pct = prjDeliveryPct(p);
    var docsCount = (p.docs || []).length;
    var lossBadge = (typeof ptfProjectLossBadge === 'function') ? ptfProjectLossBadge(p) : '';
    h += '<div style="background:#fff;border:1px solid var(--brd);border-radius:12px;padding:12px;margin-bottom:8px;cursor:pointer' + (lossBadge ? ';border-color:#fca5a5' : '') + '" onclick="openProject(\'' + p.no + '\')">' +
      '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;align-items:center">' +
      '<div style="font-size:13.5px"><b>' + escP(p.no) + '</b> — ' + escP(p.buyerCo || '-') +
      '<div style="font-size:11.5px;color:#64748b;margin-top:2px">CO: ' + escP(p.offerNo || '-') + ' | ایجاد: ' + escP(p.t) + ' | ' + docsCount + ' مدرک | وضعیت: <b>' + (STATES[p.state] || 'باز') + '</b>' + (lossBadge ? ' | ' + lossBadge : '') + '</div></div>' +
      '<div style="min-width:130px">' +
      '<div style="background:#f1f5f9;border-radius:8px;height:14px;position:relative;overflow:hidden">' +
      '<div style="position:absolute;right:0;top:0;bottom:0;width:' + pct + '%;background:linear-gradient(90deg,#0ea5e9,#38bdf8)"></div>' +
      '<span style="position:absolute;inset:0;display:grid;place-items:center;font-size:10px;font-weight:bold">تحویل ' + pct + '٪</span></div></div>' +
      '</div></div>';
  });
  el.innerHTML = h || '<div style="text-align:center;color:#94a3b8;padding:24px">پرونده‌ای نیست — از CO برنده پرونده بسازید</div>';
}

/* v13.6: تشکیل دستی پرونده در بایگانی حذف شد — بایگانی فقط مقصد مختومه‌سازی است (US-322) */
function showPrjCreate() {
  alert('🗄 بایگانی محل تشکیل پرونده نیست.\nپرونده فروش با ثبت پیشنهاد خودکار ساخته می‌شود و با «مختومه کردن» به بایگانی منتقل می‌گردد.');
}
function savePrj() { showPrjCreate(); }


/* ---- نمای داخل پرونده ---- */
var _curPrj = null;

/* حذف قطعی پرونده آزمایشی بایگانی‌شده — فقط admin/chairman و فقط با plan سرور.
   داده master مشترک (مشتری/کالا/تامین‌کننده) هرگز در graph حذف نیست. */
function ptfArchivePurgeAllowed(){try{return['admin','chairman'].indexOf(curRole())>-1;}catch(e){return false;}}
window.ptfArchivePurgeAllowed=ptfArchivePurgeAllowed;
function ptfArchivePurgeClose(){document.querySelectorAll('#ptfArchivePurgeDlg').forEach(function(x){x.remove();});}
window.ptfArchivePurgeClose=ptfArchivePurgeClose;
function ptfArchivePurgeApi(action,payload){if(typeof window.ptfSalesDomainApi!=='function')return Promise.reject(new Error('موتور فرمان سرور بارگذاری نشده است'));return window.ptfSalesDomainApi(action,payload||{});}
window.ptfArchivePurgeOpen=function(no){
  if(!ptfArchivePurgeAllowed()){alert('فقط ادمین یا رئیس هیئت‌مدیره مجاز است');return;}
  ptfArchivePurgeClose();
  var wait='<div class="md-b" id="ptfArchivePurgeDlg" style="display:grid;z-index:3700"><div class="md" style="max-width:900px"><h3>🧹 پیش‌بررسی حذف قطعی پرونده آزمایشی</h3><div style="padding:25px;text-align:center">در حال ساخت فهرست کامل وابستگی‌ها بدون تغییر داده…</div></div></div>';
  document.getElementById('panels').insertAdjacentHTML('beforeend',wait);
  ptfArchivePurgeApi('archived_case_purge_plan',{projectNo:no}).then(function(d){
    var p=d.plan||{},labels={ptf_crm_projects:'پرونده بایگانی',ptf_crm_deals:'پرونده فروش',ptf_crm_offers:'پیشنهاد',ptf_crm_rfqs:'درخواست',ptf_crm_surplus:'موجودی انبار مرتبط',ptf_crm_invoices:'فاکتور',ptf_crm_case_receipts:'دریافت قطعی',ptf_crm_receipt_allocations:'تخصیص',ptf_crm_fin_attachments:'ضمیمه مالی',ptf_crm_petty:'تنخواه',ptf_crm_opex:'هزینه جاری',ptf_crm_cheques_issued:'چک صادره',ptf_crm_cheques_received:'چک وارده',ptf_crm_sales_returns:'مرجوعی فروش',ptf_crm_packinglists:'پکینگ‌لیست',ptf_crm_letters:'نامه',ptf_crm_contracts:'قرارداد',ptf_crm_rfqsmart:'استعلام تامین',ptf_crm_buycmp:'مقایسه/خرید واقعی',ptf_crm_inqreads:'خوانش درخواست',ptf_crm_inqitems:'اقلام درخواست',ptf_crm_payables:'بدهی تامین',ptf_crm_supplier_finance_invoices:'فاکتور خرید تامین‌کننده',ptf_crm_supplier_finance_payments:'پرداخت تامین‌کننده',ptf_crm_supplier_finance_allocations:'تخصیص پرداخت تامین‌کننده',ptf_crm_buyquotes:'قیمت خرید',ptf_crm_reminders:'یادآور',ptf_crm_notifs:'اعلان',ptf_crm_audit:'لاگ تفصیلی'};
    if(p.error){throw new Error({project_not_archived:'پرونده هنوز بایگانی‌شده نیست',archived_project_not_found:'پرونده بایگانی یافت نشد',duplicate_archived_project:'شماره پرونده بایگانی یکتا نیست',shared_inventory_dependency:'بخشی از موجودی این پرونده به پیشنهاد واقعی دیگری رزرو/فروخته شده است؛ ابتدا وابستگی موجودی را تعیین تکلیف کنید. شناسه: '+((p.blockers||[]).map(function(x){return x.id;}).join('، ')||'نامشخص')}[p.error]||p.error);}
    var rows=Object.keys(p.counts||{}).filter(function(k){return+p.counts[k]>0;}).map(function(k){return'<tr><td>'+escP(labels[k]||k)+'</td><td><b>'+(+p.counts[k]).toLocaleString('fa-IR')+'</b></td><td dir="ltr">'+escP(((p.samples||{})[k]||[]).join('، ')||'—')+'</td></tr>';}).join('');
    var body='<div style="background:#fee2e2;border:2px solid #ef4444;border-radius:12px;padding:11px;margin-top:10px;color:#991b1b"><b>⚠️ عملیات غیرقابل‌بازگشت مخصوص داده آزمایشی/اشتباهی</b><br>تمام رکوردهای عملیاتی و مالی متصل و '+(+p.cloudCount||0)+' فایل ابری حذف می‌شوند. مشتریان، کالاها و تامین‌کنندگان مشترک حذف نمی‌شوند. فقط tombstone حداقلی شناسه‌ها برای جلوگیری از بازگشت داده از دستگاه قدیمی باقی می‌ماند و در گزارش سال مالی وارد نمی‌شود.</div><h4>گام ۱ — دامنه حذف را بررسی کنید</h4><div class="tb2"><table><thead><tr><th>مجموعه</th><th>تعداد</th><th>نمونه شناسه</th></tr></thead><tbody>'+rows+'</tbody></table></div><div style="margin-top:8px;font-size:12px;color:#475569">جمع رکورد: <b>'+(+p.recordCount||0).toLocaleString('fa-IR')+'</b> | فایل ابری: <b>'+(+p.cloudCount||0).toLocaleString('fa-IR')+'</b> | سال‌های مالی متاثر: <b>'+escP((p.years||[]).join('، ')||'—')+'</b></div><h4>گام ۲ — تایید ماهیت آزمایشی</h4><label style="display:block;padding:7px"><input type="checkbox" id="arcPurgeTest"> تایید می‌کنم این پرونده و داده‌های متصل به آن آزمایشی/اشتباهی هستند.</label><label style="display:block;padding:7px"><input type="checkbox" id="arcPurgeNoRecovery"> می‌دانم اطلاعات و فایل‌ها پس از حذف قابل بازیابی از CRM نیستند.</label><div class="fld"><label>دلیل حذف قطعی *</label><textarea id="arcPurgeReason" rows="2" placeholder="مثلاً: پرونده آزمایشی قبل از بهره‌برداری واقعی"></textarea></div><div class="fld"><label>برای تایید، شماره پرونده را دقیق وارد کنید: <b dir="ltr">'+escP(no)+'</b></label><input id="arcPurgeTyped" autocomplete="off" dir="ltr"></div><div style="display:flex;justify-content:flex-end;gap:8px"><button class="bt bt-o" onclick="ptfArchivePurgeClose()">انصراف بدون تغییر</button><button class="bt" id="arcPurgeCommit" style="background:#b91c1c" onclick="ptfArchivePurgeCommit(\''+ptfOnClickArg(no)+'\',\''+ptfOnClickArg(p.planHash)+'\',\''+ptfOnClickArg(p.keysDigest)+'\')">حذف قطعی تمام داده‌های این پرونده</button></div>';
    var dlg=document.getElementById('ptfArchivePurgeDlg');if(dlg)dlg.innerHTML='<div class="md" style="max-width:900px;max-height:94vh;overflow:auto"><div style="display:flex;justify-content:space-between;gap:8px"><h3 style="margin:0">🧹 حذف کامل پرونده بایگانی — '+escP(no)+'</h3><button class="bt bt-o" onclick="ptfArchivePurgeClose()">✕</button></div>'+body+'</div>';
    window._ptfArchivePurgePlan=p;
  }).catch(function(e){ptfArchivePurgeClose();alert('⛔ پیش‌بررسی حذف دریافت نشد: '+e.message);});
};
window.ptfArchivePurgeCommit=function(no,planHash,keysDigest){
  var test=!!((document.getElementById('arcPurgeTest')||{}).checked),risk=!!((document.getElementById('arcPurgeNoRecovery')||{}).checked),reason=((document.getElementById('arcPurgeReason')||{}).value||'').trim(),typed=((document.getElementById('arcPurgeTyped')||{}).value||'').trim();
  if(!test||!risk){alert('هر دو تایید ایمنی باید علامت زده شوند');return;}if(!reason){alert('دلیل حذف قطعی الزامی است');return;}if(typed!==no){alert('شماره پرونده با مقدار مورد انتظار یکسان نیست');return;}
  var btn=document.getElementById('arcPurgeCommit');if(btn){btn.disabled=true;btn.textContent='در حال بازبینی نهایی…';}
  /* plan را درست پیش از حذف فایل دوباره می‌گیریم تا هیچ تغییر همزمانی نادیده نماند. */
  ptfArchivePurgeApi('archived_case_purge_plan',{projectNo:no}).then(function(d){var latest=d.plan||{};if(latest.planHash!==planHash)throw new Error('داده‌ها پس از بازشدن پنجره تغییر کرده‌اند؛ پنجره را ببندید و دوباره پیش‌بررسی کنید.');var keys=latest.cloudKeys||[];if(!keys.length)return{ok:true,skip:true};var h={'Content-Type':'application/json'};try{var t=localStorage.getItem('ptf_crm_token');if(t)h['X-CRM-Token']=t;}catch(e){}return fetch('../api/storage.php?action=delete_batch',{method:'POST',headers:h,body:JSON.stringify({keys:keys,purpose:'archived_case_purge',planHash:planHash,keysDigest:keysDigest})}).then(function(r){return r.json();}).then(function(x){if(!x.ok||x.failed||!x.purgeReceipt)throw new Error('حذف فایل‌های ابری کامل نشد؛ هیچ metadataای حذف نشد. دوباره تلاش کنید.');return x;});}).then(function(){if(btn)btn.textContent='در حال حذف اتمیک رکوردها…';return ptfArchivePurgeApi('archived_case_purge_commit',{projectNo:no,typedProjectNo:typed,reason:reason,planHash:planHash,testDataConfirmed:true,confirm:'PTF-PURGE-ARCHIVED-TEST-CASE',idempotencyKey:'PURGE-ARCHIVE|'+no+'|'+planHash.slice(0,16)});}).then(function(d){var r=d.result||{};ptfArchivePurgeClose();try{hideModal();}catch(e){}if(typeof renderProjects2==='function')renderProjects2();if(typeof ptfFiscalRender==='function')ptfFiscalRender();if(typeof ptfToast==='function')ptfToast('پرونده آزمایشی و '+(+r.recordCount||0)+' رکورد مرتبط به‌طور قطعی حذف شد','warn');}).catch(function(e){alert('⛔ حذف قطعی متوقف شد: '+e.message);if(btn){btn.disabled=false;btn.textContent='حذف قطعی تمام داده‌های این پرونده';}});
};

/* BUG-ARCHIVE: نمایش «تمام اسناد پرونده» در بایگانی (پیشنهادها/فاکتورها/نامه‌ها/استعلام‌ها/متفرقه)
   — از docSnap ذخیره‌شده هنگام بایگانی؛ اگر در دسترس نبود از دادهٔ زنده (sfDocsOf) خوانده می‌شود. */
function prjArchivedDocsHtml(p) {
  var snap = p.docSnap || {};
  var allOffers = getData('ptf_crm_offers') || [];
  function offerBtn(no) {
    var live = allOffers.filter(function (o) { return o.no === no; })[0];
    if (live && typeof offerPrint === 'function') return '<button class="bt bt-o" style="font-size:11px" onclick="offerPrint(\'' + no + '\')">⬇ ' + no + '</button>';
    return '<span style="font-size:11px;color:#64748b">' + no + '</span>';
  }
  var offers = (snap.offers || []).map(function (o) { return '<div style="padding:3px 0">' + offerBtn(o.no) + ' <small style="color:#94a3b8">' + escP(o.kind || '') + (o.rev ? ' rev ' + o.rev : '') + '</small></div>'; }).join('') || '—';
  var invoices = (snap.invoices || []).map(function (i) { return '<div style="padding:3px 0">🧾 <b>' + escP(i.no) + '</b> <small style="color:#94a3b8">' + (+i.amount || 0).toLocaleString('fa-IR') + ' ریال' + (i.offerNo ? ' (CO ' + escP(i.offerNo) + ')' : '') + '</small></div>'; }).join('') || '—';
  var letters = (snap.letters || []).map(function (l) { return '<div style="padding:3px 0">✉️ <b>' + escP(l.no) + '</b> <small style="color:#94a3b8">' + escP(l.subject || '') + '</small></div>'; }).join('') || '—';
  var supply = (snap.supply || []).map(function (q) { return '<div style="padding:3px 0">🤖 ' + escP(q.no) + '</div>'; }).join('') || '—';
  var misc = (snap.misc || []).map(function (m) { return '<div style="padding:3px 0">📎 ' + (m.key ? '<a href="javascript:void(0)" onclick="openStoredFile(\'' + ptfOnClickArg(m.key) + '\')">' + escP(m.name) + '</a>' : escP(m.name)) + '</div>'; }).join('') || '—';
  function col(t, body) {
    return '<div style="flex:1;min-width:150px;background:#f8fafc;border:1px solid var(--brd);border-radius:10px;padding:8px 10px"><b style="font-size:12px">' + t + '</b><div style="margin-top:5px;font-size:11.5px">' + body + '</div></div>';
  }
  return '<h4 style="margin:14px 0 6px">📎 اسناد کامل پرونده (بایگانی)</h4>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
    col('🏆 پیشنهادها (' + (snap.offers || []).length + ')', offers) +
    col('🧾 فاکتورها (' + (snap.invoices || []).length + ')', invoices) +
    col('✉️ نامه‌ها (' + (snap.letters || []).length + ')', letters) +
    col('🤖 استعلام تامین (' + (snap.supply || []).length + ')', supply) +
    col('📎 متفرقه (' + (snap.misc || []).length + ')', misc) +
    '</div>';
}

/* v33.7.0: چک‌های ضمانت پرونده (از ماژول چک — dealCd) — با پایان پروژه باید مسترد شوند */
function prjGuaranteeChequesHtml(p) {
  try {
    var chqs = (typeof window.ptfChequeIssued === 'function' ? window.ptfChequeIssued() : []).filter(function (c) {
      return c && c.kind === 'guarantee' && (c.dealCd === p.cd || c.dealCd === p.offerNo || c.dealCd === p.inqNo || c.dealCd === p.no);
    });
    if (!chqs.length) return '';
    var rows = chqs.map(function (c) {
      var st = c.st === 'retrieved'
        ? '<span style="color:#047857">✅ مسترد شد</span>'
        : c.st === 'void' ? '<span style="color:#dc2626">ابطال‌شده</span>' : '<span style="color:#b45309">🔴 در جریان</span>';
      return '<div style="padding:4px 0;font-size:12px;border-bottom:1px dashed var(--brd)">' +
        '🛡 <b dir="ltr">' + escP(c.sayad || c.no || '') + '</b> — ' + (+c.amt || 0).toLocaleString('fa-IR') + ' ریال — ' +
        ({ advance: 'ضمانت پیش‌پرداخت', performance: 'ضمانت حسن انجام کار', bid: 'ضمانت مناقصه', other: 'سایر' }[c.guarType] || 'ضمانت') +
        ' — سررسید: ' + escP(c.dueFa || c.dueISO || '—') + ' — ' + st + '</div>';
    }).join('');
    return '<h4 style="margin:12px 0 6px">🛡 چک‌های ضمانت پرونده</h4><div style="background:#faf5ff;border:1px solid #ddd6fe;border-radius:12px;padding:8px 12px;margin-bottom:8px">' + rows + '</div>';
  } catch (e) { return ''; }
}

function openProject(no) {
  var p = getData('ptf_crm_projects').filter(function (x) { return x.no === no; })[0];
  if (!p) return;
  _curPrj = no;
  var folderTabs = PRJ_FOLDERS.map(function (f) {
    var n = (p.docs || []).filter(function (d) { return d.folder === f.id; }).length;
    return '<button class="bt bt-o" style="font-size:11.5px;padding:5px 10px" onclick="prjShowFolder(\'' + f.id + '\')">' + f.lb + (n ? ' (' + n + ')' : '') + '</button>';
  }).join(' ');
  var STATES = { open: 'باز', supply: 'در حال تامین', partial: 'تحویل جزئی', done: 'تحویل کامل', closed: 'بسته‌شده', archived: '🗄 بایگانی‌شده' };
  var stOpts = Object.keys(STATES).map(function (k) { return '<option value="' + k + '"' + (p.state === k ? ' selected' : '') + '>' + STATES[k] + '</option>'; }).join('');
  var tl = (p.timeline || []).slice().reverse().map(function (e) {
    return '<div style="border-right:2px solid var(--brd);padding:3px 10px 3px 0;margin-bottom:4px;font-size:11.5px"><span style="color:#94a3b8">' + escP(e.t) + ' — ' + escP(e.by || '') + '</span> ' + e.tx + '</div>';
  }).join('');
  /* v13.3 (US-323): رد تغییر اسناد بایگانی — چه کسی چه سندی را اضافه/حذف کرد */
  var chlog = (p.changeLog || []).slice().reverse().map(function (e) {
    return '<div style="border-right:2px solid ' + (e.act === 'del' ? '#fca5a5' : '#86efac') + ';padding:3px 10px 3px 0;margin-bottom:4px;font-size:11.5px">' +
      '<span style="color:#94a3b8">' + escP(e.t) + '</span> <b>' + escP(e.by) + '</b> (' + escP(e.user || '') + ') سند «' + escP(e.doc) + '» را ' + (e.act === 'del' ? '<span style="color:#dc2626">حذف کرد</span>' : '<span style="color:#059669">اضافه کرد</span>') + '</div>';
  }).join('');
  var chlogHtml = (p.state === 'archived') ? '<h4 style="margin:12px 0 6px;font-size:13px">📋 رد تغییر اسناد (پس از بایگانی)</h4>' + (chlog || '<div style="color:#94a3b8;font-size:11.5px">تغییری ثبت نشده</div>') : '';
  var html = '<div class="md-b" style="display:grid" onclick="if(event.target===this)hideModal()"><div class="md" style="max-width:840px;max-height:94vh;overflow:auto">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
    '<h3 style="margin:0">📁 ' + escP(p.no) + ' — ' + escP(p.buyerCo || '') + '</h3>' +
    '<div style="display:flex;gap:6px;align-items:center">' +
    '<select onchange="prjSetState(\'' + no + '\',this.value)" style="padding:6px;border:1px solid var(--brd);border-radius:9px;font-size:12px">' + stOpts + '</select>' +
    '<button class="bt bt-o" style="font-size:12px" onclick="offerPrint(\'' + ptfOnClickArg(p.offerNo) + '\')">⬇️ CO مبدا</button>' +
    '<button class="bt" style="font-size:12px;background:#0e7490" onclick="hideModal();plCreate(\'' + ptfOnClickArg(p.offerNo) + '\')">📦 پکینگ لیست جدید</button>' +
    '</div></div>' +
    // US-178: چرخه فایل‌های پرونده — دانلود کامل / بایگانی فشرده / آزادسازی فضا
    '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0">' +
    '<button class="bt bt-o" style="font-size:12px" onclick="prjDownloadAll(\'' + ptfOnClickArg(no) + '\')">⬇️ دانلود کل پرونده' + (p.dlAt ? ' ✅' : '') + '</button>' +
    /* v121.1: اتصال توابع مرده US-110/111 v120 به UI پرونده */
    '<button class="bt bt-o" style="font-size:12px;color:#0e7490" onclick="ptfOpenProjectBinder(\'' + ptfOnClickArg(no) + '\')">🗄️ زونکن دیجیتال</button>' +
    /* v34.5.8: نمایش سود پرونده از بایگانی/پرونده فروش حذف شد — موتور سال مالی دست‌نخورده */
    (typeof ptfLossOpen === 'function' && ['admin','chairman','ceo','commercial'].indexOf(curRole()) > -1 ? '<button class="bt bt-o" style="font-size:12px;color:#dc2626;border-color:#fecaca" onclick="ptfLossOpen(\'project\',\'' + ptfOnClickArg(no) + '\')">💥 ثبت زیان پروژه</button>' : '') +
    (p.state === 'archived' && ptfArchivePurgeAllowed() ? '<button class="bt" style="font-size:12px;background:#991b1b;color:#fff" onclick="ptfArchivePurgeOpen(\'' + ptfOnClickArg(no) + '\')">🧹 حذف قطعی داده آزمایشی</button>' : '') +
    (p.archiveKey
      ? '<button class="bt bt-o" style="font-size:12px;color:#7c3aed" onclick="openStoredFile(\'' + ptfOnClickArg(p.archiveKey) + '\')">🗄 دانلود zip بایگانی</button>' +
        '<button class="bt bt-o" style="font-size:12px;color:#dc2626" onclick="prjFreeCloud(\'' + ptfOnClickArg(no) + '\')">☁️🗑 آزادسازی فضای ابری</button>'
      : (p.archivePurged
        ? '<span style="font-size:11.5px;color:#7c3aed;padding:6px 4px">🗄 بایگانی‌شده — فایل‌ها روی فضای محلی (' + escP(p.dlBy || '') + ')</span>'
        : '<button class="bt" style="font-size:12px;background:#7c3aed" onclick="prjArchiveWizard(\'' + ptfOnClickArg(no) + '\')">🗄 بایگانی و فشرده‌سازی</button>')) +
    '</div>' +
    (p.dlAt ? '<div style="font-size:11px;color:#059669;margin-bottom:4px">✅ آخرین دانلود کامل: ' + escP(p.dlAt) + ' توسط ' + escP(p.dlBy || '') + '</div>'
      : (p.archiveMetaOnly || p.archivePurged ? '<div style="font-size:11px;color:#7c3aed;margin-bottom:4px">🗄 بایگانی متادیتایی/بدون فایل ابری — دانلود الزامی نیست (BUG-036)</div>'
      : '<div style="font-size:11px;color:#d97706;margin-bottom:4px">🔒 حذف/فشرده‌سازی فایل‌های ابری فقط پس از حداقل یک بار «دانلود کل پرونده» (اگر فایل ابری داشته باشد)</div>')) +
    '<div style="font-size:11.5px;color:#64748b;margin:6px 0">CO: ' + escP(p.offerNo) + (p.inqNo ? ' | Inquiry: ' + escP(p.inqNo) : '') + ' | تحویل: ' + prjDeliveryPct(p) + '٪ | جمع هزینه‌های پرونده: ' + prjCostTotal(p).toLocaleString('fa-IR') + ' ریال</div>' +
    ((p.origin === 'salesfile' && p.docSnap) ? prjArchivedDocsHtml(p) : '') +
    prjGuaranteeChequesHtml(p) +
    ((typeof ptfProjectLossBadge === 'function' && ptfProjectLossBadge(p)) ? '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:8px 12px;font-size:12px;color:#991b1b;margin-bottom:8px">' + ptfProjectLossBadge(p) + '</div>' : '') +
    '<div id="prjCostBox"></div>' +
    '<h4 style="margin:12px 0 6px">پوشه‌های مدارک</h4>' +
    '<div style="display:flex;flex-wrap:wrap;gap:5px">' + folderTabs + '</div>' +
    '<div id="prjFolderView" style="margin-top:10px"></div>' +
    '<h4 style="margin:14px 0 6px">📦 پکینگ لیست‌های این پرونده</h4><div id="prjPlList"></div>' +
    '<h4 style="margin:14px 0 6px">🕓 تایم‌لاین</h4>' + (tl || '<span style="color:#94a3b8;font-size:12px">—</span>') + chlogHtml +
    '<div style="display:flex;justify-content:flex-end;margin-top:10px"><button class="bt bt-o" onclick="hideModal()">بستن</button></div></div></div>';
  document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  prjRenderCosts(no);
  prjShowFolder('fin');
  prjRenderPls(p.offerNo);
}

function prjRenderCosts(no) {
  var el = document.getElementById('prjCostBox');
  if (!el) return;
  var p = getData('ptf_crm_projects').filter(function (x) { return x.no === no; })[0];
  if (!p) return;
  var labels = prjCostLabels();
  var rows = prjAllCosts(p).map(function (c) {
    var post = !!c.postArchive;
    var files = (c.files || []).map(function (f) { return f.key ? '<a href="javascript:void(0)" onclick="event.stopPropagation();openStoredFile(\'' + ptfOnClickArg(f.key) + '\')" style="color:#0e7490">📎' + escP(f.name) + '</a>' : ''; }).join(' ');
    var acts = '';
    if (p.state === 'archived' && ptfArcDocAllowed() && p.closeKind !== 'lost') {
      acts = '<button class="bt bt-o" style="padding:3px 8px;font-size:11px;color:#0e7490" onclick="prjPostCostOpen(\'' + ptfOnClickArg(no) + '\',\'' + ptfOnClickArg(c.cd) + '\')">✏️ اصلاح</button> ' +
             '<button class="bt bt-o" style="padding:3px 8px;font-size:11px;color:#7c3aed" onclick="prjPostCostUpload(\'' + ptfOnClickArg(no) + '\',\'' + ptfOnClickArg(c.cd) + '\')">📎</button> ' +
             '<button class="bt bt-o" style="padding:3px 8px;font-size:11px;color:#dc2626" onclick="prjPostCostDel(\'' + ptfOnClickArg(no) + '\',\'' + ptfOnClickArg(c.cd) + '\')">🗑️</button>';
    }
    return '<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-top:1px dashed #fdba74;flex-wrap:wrap"><span><b>' + (+c.amt || 0).toLocaleString('fa-IR') + ' ریال</b> — ' + escP(labels[c.cat] || c.cat || 'هزینه') + ' — ' + escP(c.desc || '') + (post ? ' <span class="bd" style="background:#ede9fe;color:#6d28d9">پسابایگانی</span>' : '') + (c.refInvoiceCd ? ' <span class="bd" style="background:#ecfdf5;color:#065f46" title="این هزینه به فاکتور خرید لینک است و از سود مجدد کسر نمی‌شود">🔗 لینک به فاکتور خرید ' + escP(c.refInvoiceCd) + '</span>' : '') + ' <small style="color:#94a3b8">(' + escP(c.t || '') + ' — ' + escP(c.by || '') + ')</small>' + (files ? '<br><small>' + files + '</small>' : '') + '</span><span style="white-space:nowrap">' + acts + '</span></div>';
  }).join('');
  var tools = '';
  if (p.state === 'archived' && ptfArcDocAllowed() && p.closeKind !== 'lost') {
    tools = '<button class="bt bt-o" style="font-size:12px;color:#b45309" onclick="prjPostCostOpen(\'' + ptfOnClickArg(no) + '\')">➕ هزینه گارانتی/پسابایگانی</button>';
  }
  if (!rows && !tools) { el.innerHTML = ''; return; }
  el.innerHTML = '<div style="background:#fff7ed;border:1px solid #fdba74;border-radius:12px;padding:8px 12px;margin-bottom:10px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><b>💰 هزینه‌های پرونده</b>' + tools + '</div>' + (rows || '<div style="padding:6px 0;color:#94a3b8">هزینه‌ای ثبت نشده است.</div>') + '</div>';
}

function prjSetState(no, st) {
  var prjs = getData('ptf_crm_projects');
  // 🐞 رفع باگ انجماد: پرونده‌های قدیمی بدون timeline باعث کرش می‌شدند
  prjs.forEach(function (p) { if (p.no === no) { p.state = st; p.timeline = p.timeline || []; p.timeline.push({ t: faDateTime(), by: curSession().name, tx: 'وضعیت → ' + st }); } });
  setData('ptf_crm_projects', prjs);
  audit('پرونده پروژه', 'تغییر وضعیت ' + no + ' → ' + st, no);
}

/* v34.5.38 ضد دوباره‌شماری: فاکتورهای خرید تأمین‌کنندهٔ لینک‌شده به این پرونده
   (همان ملاک موتور سود fx.js: legacyPayableCds→payable.inqNo، itemLinks، یا inqNo/offerNo مستقیم). */
function prjSupplierInvoices(p) {
  if (!p) return [];
  var projKeys = [p.inqNo, p.offerNo, p.wonOffer, p.no, p.cd].concat(p.offerNos || []).filter(Boolean);
  var sf = {};
  try { sf = JSON.parse(localStorage.getItem('ptf_crm_supplier_finance') || '{}'); if (!sf || Array.isArray(sf)) sf = {}; } catch (e) { sf = {}; }
  var payables = getData('ptf_crm_payables') || [];
  return (sf.invoices || []).filter(function (i) {
    if (!i || i.status === 'void' || i.isCover === true) return false;
    var viaLegacy = (i.legacyPayableCds || []).some(function (cd) { var p2 = payables.filter(function (x) { return x.cd === cd; })[0]; return p2 && projKeys.indexOf(p2.inqNo) > -1; });
    var viaItems = (i.itemLinks || []).some(function (l) { return projKeys.indexOf(l.offerNo) > -1 || projKeys.indexOf(l.inqNo) > -1; });
    var viaDirect = projKeys.indexOf(i.inqNo) > -1 || projKeys.indexOf(i.offerNo) > -1;
    return viaLegacy || viaItems || viaDirect;
  });
}
window.prjPostCostOpen = function (no, costCd) {
  var p = getData('ptf_crm_projects').filter(function (x) { return x.no === no; })[0];
  if (!p) return;
  if (p.state !== 'archived' || p.closeKind === 'lost' || !ptfArcDocAllowed()) { alert('⛔ ثبت/اصلاح هزینه پسابایگانی فقط برای پرونده بایگانی‌شده مجاز است'); return; }
  var all = prjAllCosts(p);
  var old = costCd ? (all.filter(function (x) { return x.cd === costCd; })[0] || null) : null;
  var labels = prjCostLabels();
  /* v34.5.38 ضد دوباره‌شماری: فاکتورهای خریدِ لینک‌شده به همین پرونده — اگر هزینهٔ
     پسابایگانی همان تأمین مجددِ ثبت‌شده به‌صورت فاکتور خرید باشد، باید به آن لینک شود
     تا موتور سود آن را دوباره کسر نکند. */
  var supInvs = prjSupplierInvoices(p);
  var prevRef = old ? (old.refInvoiceCd || '') : '';
  var invOpts = '<option value="">— هزینهٔ غیرخرید (بدون فاکتور خرید) —</option>' + supInvs.map(function (i) {
    return '<option value="' + escP(i.cd) + '"' + (i.cd === prevRef ? ' selected' : '') + '>' + escP(i.no || i.cd) + ' — ' + (+i.amount || 0).toLocaleString('fa-IR') + ' ' + escP(i.cur || 'IRR') + '</option>';
  }).join('');
  ptfDialog({ title: (old ? '✏️ اصلاح' : '➕ ثبت') + ' هزینه گارانتی/پسابایگانی', body: 'برای هزینه‌های گارانتی، خدمات پس از تحویل، اصلاح، تعویض و سایر هزینه‌های پسابایگانی استفاده می‌شود. همه تغییرات در رد تغییرات پرونده ثبت می‌گردد.' + (supInvs.length ? '<br><b style="color:#b45309">⚠️ اگر این هزینه همان «تأمین مجدد کالا» است که قبلاً به‌صورت فاکتور خرید ثبت شده، حتماً آن را در «فاکتور خرید مرتبط» انتخاب کنید تا دوباره‌شماری نشود؛ در غیر این صورت تأمین مجدد را به‌جای اینجا به‌صورت فاکتور خرید تأمین‌کننده ثبت کنید.</b>' : ''), fields: [
    { id: 'amt', label: 'مبلغ هزینه (ریال)', type: 'number', required: true, dir: 'ltr', value: old ? old.amt : '' },
    { id: 'cat', label: 'نوع هزینه', type: 'select', value: old ? old.cat : 'warranty', options: [{v:'warranty',lb:labels.warranty},{v:'service',lb:labels.service},{v:'repair',lb:labels.repair},{v:'logistics',lb:labels.logistics},{v:'other',lb:labels.other}] },
    { id: 'refInvoiceCd', label: 'فاکتور خرید مرتبط (ضد دوباره‌شماری)', type: 'select', optionsHtml: invOpts, value: old ? (old.refInvoiceCd || '') : '' },
    { id: 'desc', label: 'شرح هزینه', type: 'textarea', rows: 2, required: true, value: old ? old.desc : '' }
  ], okText: (old ? 'ذخیره اصلاح' : 'ثبت هزینه'), onOk: function (v) {
    if (v.cat === 'repair' && supInvs.length && !v.refInvoiceCd && !confirm('⚠️ «اصلاح/تعویض» با وجود فاکتور خریدِ لینک‌شده ثبت می‌شود اما به هیچ فاکتوری لینک نشده است.\n\nاگر این هزینه همان تأمین مجدد کالا (دارای فاکتور خرید) است، «لغو» کنید و فاکتور خرید مرتبط را انتخاب کنید؛ در غیر این صورت همان مبلغ هم از فاکتور خرید و هم اینجا از سود کسر می‌شود (دوباره‌شماری).\n\nادامه می‌دهید؟')) return;
    var prjs = getData('ptf_crm_projects');
    var pp = prjs.filter(function (x) { return x.no === no; })[0]; if (!pp) return;
    pp.postArchiveCosts = pp.postArchiveCosts || [];
    var ev = old || { cd: genCode('PAC'), postArchive: true, by: curSession().name, t: faDateTime(), files: [] };
    var prevAmt = +ev.amt || 0;
    ev.amt = +v.amt || 0; ev.cat = v.cat; ev.desc = v.desc; ev.postArchive = true; ev.refInvoiceCd = v.refInvoiceCd || ''; ev.updatedBy = curSession().name; ev.updatedT = faDateTime();
    if (old) {
      var replaced = false;
      pp.postArchiveCosts = pp.postArchiveCosts.map(function (x) { if (x.cd === ev.cd) { replaced = true; return ev; } return x; });
      if (!replaced) {
        pp.costEvents = (pp.costEvents || []).map(function (x) { return x.cd === ev.cd ? ev : x; });
      }
    } else {
      pp.postArchiveCosts.unshift(ev);
    }
    pp.timeline = pp.timeline || [];
    pp.timeline.push({ t: faDateTime(), by: curSession().name, tx: (old ? '✏️ اصلاح' : '➕ ثبت') + ' هزینه پسابایگانی: ' + (+ev.amt || 0).toLocaleString('fa-IR') + ' ریال — ' + (labels[v.cat] || v.cat) + ' — ' + v.desc + (old ? ' (قبلی: ' + prevAmt.toLocaleString('fa-IR') + ')' : '') });
    pp.changeLog = pp.changeLog || [];
    pp.changeLog.push({ t: faDateTime(), by: curSession().name, user: curSession().user, act: old ? 'cost-edit' : 'cost-add', doc: v.desc, folder: 'fin' });
    setData('ptf_crm_projects', prjs);
    audit('بایگانی', (old ? 'اصلاح' : 'ثبت') + ' هزینه پسابایگانی ' + no, ev.cd);
    prjRenderCosts(no);
    if (typeof ptfToast === 'function') ptfToast(old ? 'هزینه پسابایگانی اصلاح شد' : 'هزینه پسابایگانی ثبت شد', 'ok');
  }});
};
window.prjPostCostUpload = function (no, costCd) {
  var p = getData('ptf_crm_projects').filter(function (x) { return x.no === no; })[0];
  if (!p || p.state !== 'archived' || p.closeKind === 'lost' || !ptfArcDocAllowed() || typeof attachUploadWidget !== 'function') return;
  var html = '<div class="md-b" style="display:grid;z-index:2600" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:460px"><h3>📎 پیوست هزینه پسابایگانی</h3><div id="prjArcCostUp"></div><div style="text-align:left;margin-top:10px"><button class="bt" onclick="this.closest(\'.md-b\').remove()">تمام</button></div></div></div>';
  (document.getElementById('panels') || document.body).insertAdjacentHTML('beforeend', html);
  attachUploadWidget('prjArcCostUp', 'projects/' + no + '/post-cost/' + costCd, function (fileRec) {
    var prjs = getData('ptf_crm_projects');
    var pp = prjs.filter(function (x) { return x.no === no; })[0]; if (!pp) return;
    var all = prjAllCosts(pp); var ev = all.filter(function (x) { return x.cd === costCd; })[0]; if (!ev) return;
    ev.files = ev.files || []; ev.files.push(fileRec);
    pp.docs = pp.docs || []; pp.docs.push({ folder: 'fin', name: 'رسید هزینه پسابایگانی — ' + (ev.desc || ''), key: fileRec.key, size: fileRec.size, t: faDate(), by: curSession().name, note: 'هزینه پسابایگانی', costCd: ev.cd });
    pp.changeLog = pp.changeLog || [];
    pp.changeLog.push({ t: faDateTime(), by: curSession().name, user: curSession().user, act: 'cost-file', doc: fileRec.name, folder: 'fin' });
    setData('ptf_crm_projects', prjs);
    prjRenderCosts(no);
  });
};
window.prjPostCostDel = function (no, costCd) {
  var prjs = getData('ptf_crm_projects');
  var pp = prjs.filter(function (x) { return x.no === no; })[0];
  if (!pp || pp.state !== 'archived' || pp.closeKind === 'lost' || !ptfArcDocAllowed()) return;
  var old = prjAllCosts(pp).filter(function (x) { return x.cd === costCd; })[0];
  if (!old) return;
  if (!confirm('این هزینه از پرونده بایگانی حذف شود؟')) return;
  var deadKeys = (pp.docs || []).filter(function (x) { return x.costCd === costCd && x.key; }).map(function (x) { return x.key; });
  pp.postArchiveCosts = (pp.postArchiveCosts || []).filter(function (x) { return x.cd !== costCd; });
  pp.costEvents = (pp.costEvents || []).filter(function (x) { return x.cd !== costCd; });
  pp.docs = (pp.docs || []).filter(function (x) { return x.costCd !== costCd; });
  pp.timeline = pp.timeline || [];
  pp.timeline.push({ t: faDateTime(), by: curSession().name, tx: '🗑 حذف هزینه از پرونده بایگانی: ' + (old.desc || '') + ' — ' + (+old.amt || 0).toLocaleString('fa-IR') + ' ریال' });
  pp.changeLog = pp.changeLog || [];
  pp.changeLog.push({ t: faDateTime(), by: curSession().name, user: curSession().user, act: 'cost-del', doc: old.desc || costCd, folder: 'fin' });
  setData('ptf_crm_projects', prjs);
  prjDeleteCloudKeys(deadKeys);
  audit('بایگانی', 'حذف هزینه پسابایگانی ' + no, costCd);
  prjRenderCosts(no);
  if (typeof ptfToast === 'function') ptfToast('هزینه از پرونده بایگانی حذف شد', 'warn');
};

function prjShowFolder(fid) {
  var el = document.getElementById('prjFolderView');
  if (!el || !_curPrj) return;
  var p = getData('ptf_crm_projects').filter(function (x) { return x.no === _curPrj; })[0];
  var f = PRJ_FOLDERS.filter(function (x) { return x.id === fid; })[0];
  var docs = (p.docs || []).filter(function (d) { return d.folder === fid; });
  var isPhoto = fid === 'photo';
  var listHtml = '';
  if (isPhoto) {
    // گالری (AC2b)
    listHtml = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px">' +
      docs.map(function (d, i) {
        return '<div style="border:1px solid var(--brd);border-radius:10px;overflow:hidden;text-align:center;font-size:10.5px">' +
          '<div style="height:80px;background:#f1f5f9;display:grid;place-items:center;cursor:pointer" onclick="event.stopPropagation();openStoredFile(\'' + ptfOnClickArg(d.key || '') + '\')">🖼️</div>' +
          '<div style="padding:4px">' + escP(d.tag || '') + '<br><span style="color:#94a3b8">' + escP(d.caption || d.name) + '</span></div></div>';
      }).join('') + '</div>';
  } else {
    listHtml = docs.map(function (d) {
      var gi = (p.docs || []).indexOf(d); // ایندکس سراسری برای حذف
      // US-141: مدارک سیستمی (PDF پیشنهاد/درخواست از خود سیستم باز می‌شوند)
      var act;
      if (d.sysOffer) act = '<a href="javascript:void(0)" onclick="offerPrint(\'' + ptfOnClickArg(d.sysOffer) + '\')" style="color:#7c3aed">🖨️ PDF سیستمی</a>';
      else if (d.sysRfq) act = '<small style="color:#0e7490">سیستمی (استعلام)</small>';
      // US-178: متادیتای فایل‌های حذف/بایگانی‌شده — روند پروژه گم نمی‌شود
      else if (d.purged) act = '<small style="color:#94a3b8" title="' + escP((d.purgedAt || '') + ' ' + (d.purgedBy || '')) + '">🗑 حذف‌شده از ابر (متادیتا)</small>';
      else if (d.archived) act = '<small style="color:#7c3aed">🗄 در zip بایگانی</small>';
      else if (d.key) act = '<a href="javascript:void(0)" onclick="event.stopPropagation();openStoredFile(\'' + ptfOnClickArg(d.key) + '\')" style="color:#0e7490">👁 مشاهده</a>' +
        ' <a href="javascript:void(0)" onclick="event.stopPropagation();openStoredFile(\'' + ptfOnClickArg(d.key) + '\')" style="color:#0e7490">⬇️</a>' +
        ' <a href="javascript:void(0)" onclick="event.stopPropagation();prjDocDel(\'' + ptfOnClickArg(_curPrj) + '\',' + gi + ')" style="color:#dc2626" title="حذف از فضای ابری (متادیتا می‌ماند)">🗑</a>';
      else act = '<small style="color:#d97706">در صف ابری</small>';
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;border:1px solid var(--brd);border-radius:9px;margin-bottom:5px;font-size:12px' + (d.purged ? ';opacity:.6' : '') + '">' +
        '<span>📄 ' + escP(d.name) + ' <small style="color:#94a3b8">' + escP(d.t || '') + (d.note ? ' — ' + escP(d.note) : '') + '</small></span>' +
        '<span>' + act + '</span></div>';
    }).join('') || '<div style="color:#94a3b8;font-size:12px;padding:8px">مدرکی نیست</div>';
  }
  el.innerHTML = '<div style="border:1px solid var(--brd);border-radius:12px;padding:12px;background:#fafbfc">' +
    '<b style="font-size:12.5px">' + escP(f.lb) + '</b>' +
    (isPhoto ? '<div style="margin:6px 0"><select id="prjPhotoTag" style="padding:6px;border:1px solid var(--brd);border-radius:8px;font-size:12px">' +
      PHOTO_TAGS.map(function (t) { return '<option>' + t + '</option>'; }).join('') + '</select></div>' : '') +
    '<div style="margin:8px 0">' + listHtml + '</div>' +
    '<div id="prjUpZone"></div></div>';
  /* v13.3 (US-323): پرونده بایگانی‌شده — افزودن/حذف سند فقط برای admin/chairman/commercial/ceo + ثبت رد تغییر
     v14.5 (US-371 — دستور کارفرما): پرونده مختومه «بدون فاکتور» (closeKind=lost) → افزودن فایل برای همه بسته */
  var _prjArchived = p.state === 'archived';
  var _prjLostLocked = _prjArchived && p.closeKind === 'lost';
  if (_prjLostLocked) {
    var uzL = document.getElementById('prjUpZone');
    if (uzL) uzL.innerHTML = '<div style="font-size:12px;color:#b91c1c;border:1.5px dashed #fecaca;border-radius:10px;padding:10px;text-align:center;background:#fef2f2">⛔ پرونده مختومه بدون فاکتور — طبق فرآیند مصوب، افزودن سند برای <b>همه کاربران</b> غیرفعال است (US-371)</div>';
  } else if (_prjArchived && !ptfArcDocAllowed()) {
    var uz = document.getElementById('prjUpZone');
    if (uz) uz.innerHTML = '<div style="font-size:12px;color:#94a3b8;border:1px dashed var(--brd);border-radius:10px;padding:10px;text-align:center">🔒 این پرونده بایگانی شده — افزودن/حذف سند فقط توسط ادمین، رییس هیات مدیره، مدیر بازرگانی و مدیرعامل مجاز است</div>';
  } else if (typeof attachUploadWidget === 'function') {
    attachUploadWidget('prjUpZone', 'projects/' + _curPrj + '/' + fid, function (fileRec) {
      var prjs = getData('ptf_crm_projects');
      var pp = prjs.filter(function (x) { return x.no === _curPrj; })[0];
      /* v14.5 (US-371): سد برنامه‌ای — نه فقط UI؛ پرونده lost حتی از مسیر کد سند نمی‌گیرد */
      if (pp && pp.state === 'archived' && pp.closeKind === 'lost') {
        alert('⛔ پرونده مختومه بدون فاکتور — افزودن سند برای همه غیرفعال است.');
        return;
      }
      var doc = { folder: fid, name: fileRec.name, key: fileRec.key, size: fileRec.size, t: faDate(), by: curSession().name };
      if (isPhoto) { doc.tag = (document.getElementById('prjPhotoTag') || {}).value || 'کالا'; doc.caption = ''; }
      pp.docs = pp.docs || [];
      pp.docs.push(doc);
      pp.timeline = pp.timeline || [];
      pp.timeline.push({ t: faDateTime(), by: curSession().name, tx: 'مدرک «' + fileRec.name + '» به پوشه ' + f.lb + ' افزوده شد' });
      /* v13.3 (US-323): رد تغییر روی پرونده بایگانی‌شده */
      if (pp.state === 'archived') {
        pp.changeLog = pp.changeLog || [];
        pp.changeLog.push({ t: faDateTime(), by: curSession().name, user: curSession().user, act: 'add', doc: fileRec.name, folder: fid });
        try { audit('بایگانی', 'افزودن سند به پرونده بایگانی‌شده ' + _curPrj + ': ' + fileRec.name, _curPrj); } catch (e) {}
      }
      setData('ptf_crm_projects', prjs);
      prjShowFolder(fid);
      audit('پرونده پروژه', 'افزودن مدرک به ' + _curPrj + '/' + fid, fileRec.name);
    });
  }
}

/* ============ US-120: پکینگ لیست ============ */
function plSerial() {
  var pls = getData('ptf_crm_packinglists');
  var max = 0;
  pls.forEach(function (p) {
    var m = (p.no || '').match(new RegExp('^PTF-PL-' + faYear() + '-(\\d+)$'));
    if (m && +m[1] > max) max = +m[1];
  });
  return 'PTF-PL-' + faYear() + '-' + String(max + 1).padStart(3, '0');
}

// باقیمانده هر قلم CO بر اساس PL های معتبر قبلی (AC4)
function plRemaining(offerNo) {
  var o = getData('ptf_crm_offers').filter(function (x) { return x.no === offerNo; })[0];
  if (!o) return [];
  var rem = (o.items || []).map(function (it) { return +it.qty || 0; });
  getData('ptf_crm_packinglists').forEach(function (pl) {
    if (pl.offerNo !== offerNo || pl.voided) return;
    (pl.lines || []).forEach(function (ln) {
      if (rem[ln.idx] != null) rem[ln.idx] = Math.max(0, rem[ln.idx] - (+ln.qty || 0));
    });
  });
  return rem;
}

var _plState = null;

function plCreate(offerNo) {
  var o = getData('ptf_crm_offers').filter(function (x) { return x.no === offerNo; })[0];
  if (!o) { alert('CO یافت نشد'); return; }
  var rem = plRemaining(offerNo);
  if (!rem.some(function (r) { return r > 0; })) { alert('همه اقلام این CO قبلاً تحویل شده است ✅'); return; }
  _plState = { no: plSerial(), offerNo: offerNo, buyerCo: o.buyerCo, buyerContact: o.buyerContact, buyerTel: o.buyerTel,
    dateEn: new Date().toISOString().slice(0, 10), lines: [] };
  var rows = (o.items || []).map(function (it, i) {
    var r = rem[i];
    var done = r === 0;
    return '<tr' + (done ? ' style="opacity:.5"' : '') + '><td>' + (i + 1) + '</td><td style="text-align:right">' + escP(it.name || it.desc || '') + '</td>' +
      '<td>' + (it.qty || 0) + '</td><td>' + (((+it.qty || 0) - r)) + '</td><td><b>' + r + '</b></td>' +
      '<td>' + (done ? '<span style="color:#10b981">✔ کامل</span>' :
        '<input type="number" id="plq' + i + '" min="0" max="' + r + '" value="0" style="width:64px;padding:5px;border:1px solid var(--brd);border-radius:7px;direction:ltr">') + '</td>' +
      '<td><select id="plp' + i + '" style="padding:5px;border:1px solid var(--brd);border-radius:7px;font-size:11.5px"' + (done ? ' disabled' : '') + '><option>Carton</option><option>Pallet</option><option>Bundle</option><option>Wooden Case</option><option>Loose</option></select></td>' +
      '<td><input type="number" id="pln' + i + '" min="1" value="1" style="width:52px;padding:5px;border:1px solid var(--brd);border-radius:7px;direction:ltr"' + (done ? ' disabled' : '') + '></td>' +
      '<td><input type="text" id="plw' + i + '" placeholder="kg" style="width:58px;padding:5px;border:1px solid var(--brd);border-radius:7px;direction:ltr"' + (done ? ' disabled' : '') + '></td></tr>';
  }).join('');
  var html = '<div class="md-b" style="display:grid" onclick="if(event.target===this)hideModal()"><div class="md" style="max-width:880px;max-height:94vh;overflow:auto">' +
    '<h3>📦 پکینگ لیست جدید — <span style="direction:ltr;display:inline-block">' + _plState.no + '</span> <small style="color:#94a3b8">(از ' + escP(offerNo) + ')</small></h3>' +
    '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead style="background:#f1f5f9">' +
    '<tr><th>#</th><th>Item</th><th>کل</th><th>تحویل‌شده</th><th>باقیمانده</th><th>این محموله</th><th>Package</th><th>تعداد بسته</th><th>وزن</th></tr></thead>' +
    '<tbody>' + rows + '</tbody></table></div>' +
    '<div class="fld" style="margin-top:10px"><label>Remarks (اختیاری)</label><input type="text" id="plRemarks" style="direction:ltr"></div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">' +
    '<button class="bt bt-o" onclick="hideModal()">انصراف</button>' +
    '<button class="bt" onclick="plSave()">صدور پکینگ لیست</button></div></div></div>';
  document.getElementById('panels').insertAdjacentHTML('beforeend', html);
}

function plSave() {
  var o = getData('ptf_crm_offers').filter(function (x) { return x.no === _plState.offerNo; })[0];
  var rem = plRemaining(_plState.offerNo);
  var lines = [];
  (o.items || []).forEach(function (it, i) {
    var qEl = document.getElementById('plq' + i);
    if (!qEl) return;
    var q = +qEl.value || 0;
    if (q <= 0) return;
    if (q > rem[i]) { alert('ردیف ' + (i + 1) + ': بیش از باقیمانده (' + rem[i] + ')'); throw new Error('overqty'); }
    lines.push({ idx: i, name: it.name || it.desc || '', model: it.model || '', brand: it.brand || '',
      qty: q, unit: it.unit || 'NO',
      pkg: (document.getElementById('plp' + i) || {}).value || 'Carton',
      pkgN: +((document.getElementById('pln' + i) || {}).value) || 1,
      wt: (document.getElementById('plw' + i) || {}).value || '' });
  });
  if (!lines.length) { alert('حداقل یک قلم با تعداد بیشتر از صفر انتخاب کنید'); return; }
  _plState.lines = lines;
  _plState.remarks = (document.getElementById('plRemarks') || {}).value || '';
  _plState.t = faDate();
  _plState.by = curSession().name;
  var pls = getData('ptf_crm_packinglists');
  pls.unshift(_plState);
  setData('ptf_crm_packinglists', pls);
  // ثبت در پرونده + تایم‌لاین (AC5)
  var prjs = getData('ptf_crm_projects');
  var p = prjs.filter(function (x) { return x.offerNo === _plState.offerNo; })[0];
  if (p) {
    p.docs = p.docs || [];
    p.docs.push({ folder: 'ship', name: _plState.no + '.pdf (سیستمی)', key: null, plNo: _plState.no, t: faDate(), by: curSession().name, note: lines.length + ' قلم' });
    p.timeline.push({ t: faDateTime(), by: curSession().name, tx: 'پکینگ لیست ' + _plState.no + ' صادر شد (' + lines.length + ' قلم)' });
    var pct = prjDeliveryPct(p);
    p.state = pct >= 100 ? 'done' : 'partial';
    setData('ptf_crm_projects', prjs);
  }
  audit('پکینگ لیست', 'صدور ' + _plState.no + ' برای ' + _plState.offerNo, _plState.no);
  var savedNo = _plState.no;
  hideModal();
  if (confirm('✅ ' + savedNo + ' صادر شد.\nخروجی PDF باز شود؟')) plPrint(savedNo);
  if (typeof renderProjects2 === 'function') renderProjects2();
}

function prjRenderPls(offerNo) {
  var el = document.getElementById('prjPlList');
  if (!el) return;
  var pls = getData('ptf_crm_packinglists').filter(function (p) { return p.offerNo === offerNo; });
  el.innerHTML = pls.map(function (pl) {
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;border:1px solid var(--brd);border-radius:9px;margin-bottom:5px;font-size:12px' + (pl.voided ? ';opacity:.5' : '') + '">' +
      '<span><b>' + escP(pl.no) + '</b> — ' + (pl.lines || []).length + ' قلم — ' + escP(pl.t || '') + (pl.voided ? ' <span style="color:#dc2626">[باطل]</span>' : '') + '</span>' +
      '<span style="display:flex;gap:5px">' +
      '<button class="bt bt-o" style="padding:3px 8px;font-size:11.5px" onclick="plPrint(\'' + pl.no + '\')">🖨️ PDF</button>' +
      (!pl.voided ? '<button class="bt bt-o" style="padding:3px 8px;font-size:11.5px;color:#dc2626" onclick="plVoid(\'' + pl.no + '\')">ابطال</button>' : '') +
      '</span></div>';
  }).join('') || '<span style="color:#94a3b8;font-size:12px">پکینگ لیستی صادر نشده</span>';
}

function plVoid(no) {
  var why = prompt('دلیل ابطال ' + no + '؟ (الزامی)');
  if (!why || !why.trim()) return;
  var pls = getData('ptf_crm_packinglists');
  pls.forEach(function (p) { if (p.no === no) { p.voided = true; p.voidWhy = why.trim(); p.voidBy = curSession().name; p.voidT = faDate(); } });
  setData('ptf_crm_packinglists', pls);
  var pl = pls.filter(function (p) { return p.no === no; })[0];
  var prjs = getData('ptf_crm_projects');
  var p = prjs.filter(function (x) { return x.offerNo === pl.offerNo; })[0];
  if (p) {
    p.timeline.push({ t: faDateTime(), by: curSession().name, tx: '⚠️ پکینگ لیست ' + no + ' باطل شد — ' + why + ' (تعدادها به باقیمانده برگشت)' });
    var pct = prjDeliveryPct(p);
    p.state = pct >= 100 ? 'done' : pct > 0 ? 'partial' : 'supply';
    setData('ptf_crm_projects', prjs);
  }
  audit('پکینگ لیست', 'ابطال ' + no + ': ' + why, no);
  if (typeof prjRenderPls === 'function' && pl) prjRenderPls(pl.offerNo);
}

/* ---- چاپ PL — قالب هم‌خانواده TO/CO (AC1) ---- */
function plPrint(no) {
  var pl = getData('ptf_crm_packinglists').filter(function (p) { return p.no === no; })[0];
  if (!pl) return;
  var tbody = (pl.lines || []).map(function (ln, i) {
    return '<tr><td>' + (i + 1) + '</td><td class="lft"><b>' + escP(ln.name) + '</b></td><td>' + escP(ln.model || '—') + '</td><td>' + escP(ln.brand || '—') + '</td>' +
      '<td>' + ln.qty + '</td><td>' + escP(ln.unit) + '</td><td>' + escP(ln.pkg) + '</td><td>' + ln.pkgN + '</td><td>' + escP(ln.wt || '—') + '</td></tr>';
  }).join('');
  var totalPkgs = (pl.lines || []).reduce(function (s, l) { return s + (+l.pkgN || 0); }, 0);
  var w = window.open('', '_blank');
  w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + pl.no + '</title><style>' +
    '@page{size:A4 landscape;margin:10mm 12mm 16mm 12mm}' +
    'body{font-family:"Segoe UI",Arial,sans-serif;font-size:10.5px;color:#1f2328;margin:0;padding-bottom:40px;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
    '.hdr{display:grid;grid-template-columns:120px 1fr 190px;align-items:start;gap:10px;padding-bottom:6px;border-bottom:2.5px solid #ef4b1a;margin-bottom:10px}' +
    '.hdr img{height:64px}.hdr .mid{text-align:center;padding-top:2px}' +
    '.hdr .co{font-size:21px;font-weight:700;color:#ef4b1a;font-family:Georgia,serif}' +
    '.hdr .sub{font-size:13px;color:#f79400;font-weight:600;margin-top:6px;letter-spacing:1.2px;text-transform:uppercase}' +
    '.hdr .meta{text-align:right;font-size:10px;line-height:1.9}.hdr .meta .no{font-weight:700;color:#c0392b}' +
    '.parties{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:10px}' +
    '.party{border:1px solid #e3e5e8;border-radius:6px;padding:8px 12px;font-size:10px;line-height:1.9;background:#fcfcfc}' +
    '.party .pt{font-size:12.5px;font-weight:700;color:#f79400;font-family:Georgia,serif}' +
    '.party b{color:#f79400;font-weight:600}' +
    'table{width:100%;border-collapse:collapse;font-size:10px}th{background:#f79400;color:#fff;border:1px solid #d98700;padding:5px 6px}' +
    'td{border:1px solid #9aa0a6;padding:5px 6px;text-align:center}td.lft{text-align:left}' +
    'tr.sum td{background:#fdf1e7;font-weight:700}thead{display:table-header-group}' +
    '.rm{margin-top:10px;font-size:10px}.sig{margin-top:18px;margin-bottom:34px;display:flex;justify-content:space-between}' +
    '.sig .box{width:220px;text-align:center;font-size:9.5px;color:#555}.sig .line{border-top:1px solid #999;margin-top:52px;padding-top:4px}' +
    '.ftr{position:fixed;bottom:0;left:0;right:0;text-align:center;font-size:9px;color:#f79400;border-top:1px solid #f0d9b8;padding-top:3px;background:#fff}' +
    '</style></head><body>' +
    '<div class="ftr">Address: ' + SELLER_INFO.address + '<br>Tel: ' + SELLER_INFO.tel + ' | ' + SELLER_INFO.email + ' | www.pishtaj.ir</div>' +
    '<div class="hdr"><img src="' + SELLER_INFO.logo + '"><div class="mid"><div class="co">Pishro Tajhiz Fartak Co.</div><div class="sub">Packing List</div></div>' +
    '<div class="meta"><span class="no">PL No.: ' + escP(pl.no) + '</span><br><b>Date:</b> ' + escP(pl.dateEn || pl.t) + '<br><b>Ref. CO:</b> ' + escP(pl.offerNo) + '</div></div>' +
    '<div class="parties">' +
    '<div class="party"><div class="pt">Shipper</div><b>Name:</b> ' + SELLER_INFO.company + '<br><b>Tel:</b> ' + SELLER_INFO.tel + '</div>' +
    '<div class="party"><div class="pt">Consignee</div><b>Name:</b> ' + escP(pl.buyerCo || '—') + '<br><b>Attention:</b> ' + escP(pl.buyerContact || '—') + '<br><b>Tel:</b> ' + escP(pl.buyerTel || '—') + '</div></div>' +
    '<table><thead><tr><th style="width:5%">Sr. No.</th><th>Item Name</th><th style="width:10%">Model</th><th style="width:10%">Brand</th><th style="width:7%">Qty</th><th style="width:6%">Unit</th><th style="width:10%">Package</th><th style="width:8%">No. of Pkgs</th><th style="width:9%">G.W.</th></tr></thead>' +
    '<tbody>' + tbody +
    '<tr class="sum"><td colspan="7" class="lft">TOTAL PACKAGES</td><td>' + totalPkgs + '</td><td></td></tr></tbody></table>' +
    (pl.remarks ? '<div class="rm"><b>Remarks:</b> ' + escP(pl.remarks) + '</div>' : '') +
    (pl.voided ? '<div style="color:#dc2626;font-weight:700;font-size:14px;margin-top:8px">*** VOID / باطل شده ***</div>' : '') +
    '<div class="sig"><div class="box"><div class="line">Prepared by<br>' + escP(pl.by || '') + '</div></div>' +
    '<div class="box"><div class="line">Received by (Consignee)<br>Name / Date / Sign</div></div></div>' +
    '<script>window.onload=function(){setTimeout(function(){window.print()},450)}<\/script></body></html>');
  w.document.close();
}

/* ============ روتینگ ============ */
(function () {
  var _go = window.goPanel;
  window.goPanel = function (id, btn) {
    if (id === 'prj') {
      var r = roleDef();
      if (!(r.panels === '*' || r.panels.indexOf('deals') > -1)) { alert('⛔ دسترسی ندارید'); return; }
      var btns = document.querySelectorAll('.sb-i');
      for (var i = 0; i < btns.length; i++) btns[i].classList.remove('act');
      if (btn) btn.classList.add('act');
      document.getElementById('pgTitle').textContent = '🗄 بایگانی';
      document.getElementById('panels').innerHTML = buildProjects();
      renderProjects2();
      return;
    }
    _go(id, btn);
  };
})();
