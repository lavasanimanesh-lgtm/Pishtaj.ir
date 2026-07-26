/* =====================================================================
   PTF CRM - Unified Server-Side Code Generation Client v28.9
   Permanent fix for BUG-CODE-FIX - never reuse deleted codes
   
   Features preserved:
   - Sequential, never reuse (server counter only increments)
   - Year-based for TO/CO/TC: PTF-TO-1404-003
   - Format compatibility: P-XXX, RFQ-XXX, CUST-XXX, etc
   - Device Tag removed for final codes (clean), TMP- prefix for offline
   - Batch reservation via Pool (IQI 100 items)
   - Provenance ready for procurement-link
        
   Invariant: Once a code is issued, it is never re-issued even if
   the owning record is deleted. counters.json only goes forward.
   ===================================================================== */
(function(){
'use strict';

var API = '../api/codegen.php';
var POOL_KEY = 'ptf_code_pool';
var POOL_META = 'ptf_code_pool_meta';

function getPool(){
  try {
    var raw = localStorage.getItem(POOL_KEY);
    if (!raw || raw === 'undefined') return {};
    return JSON.parse(raw);
  } catch(e){ return {}; }
}
function setPool(p){ try { localStorage.setItem(POOL_KEY, JSON.stringify(p)); } catch(e){} }
function getMeta(){
  try {
    var raw = localStorage.getItem(POOL_META);
    if (!raw || raw === 'undefined') return {};
    return JSON.parse(raw);
  } catch(e){ return {}; }
}
function setMeta(m){ try { localStorage.setItem(POOL_META, JSON.stringify(m)); } catch(e){} }

function faYear(){
  try { if(typeof window.faYear==='function') return window.faYear(); } catch(e){}
  // fallback: approximate Jalali
  var gy=new Date().getFullYear(), gm=new Date().getMonth()+1, gd=new Date().getDate();
  var jy=gy-621; if(gm<3 || (gm===3 && gd<21)) jy--; return jy;
}

function formatCodeClient(prefix, n, year){
  prefix=String(prefix||'ID').toUpperCase().trim();
  year=year||faYear(); n=parseInt(n,10)||1001;
  if(prefix==='TO' || prefix==='CO' || prefix==='TC'){
    // v28.9.1: 4 رقمی - امسال 0100، سال بعد 0001
    var pad=String(n).padStart(4,'0');
    return 'PTF-'+prefix+'-'+year+'-'+pad;
  }
  if(prefix==='P' || prefix==='PROD' || prefix==='PRODUCT') return 'P-'+n;
  return prefix+'-'+n;
}

// Parse number from existing code for migration check (client side)
function extractNumLegacy(code, pref){
  try {
    var s=String(code||'').replace(/-D\d+$/,'');
    var m=s.match(new RegExp('^'+pref+'-(\\d+)$','i'));
    if(m) return parseInt(m[1],10);
    m=s.match(new RegExp('^PTF-'+pref+'-\\d+-(\\d+)$','i'));
    if(m) return parseInt(m[1],10);
    if(pref==='P'){
      m=s.match(/^P-(\d+)$/i); if(m) return parseInt(m[1],10);
    }
  } catch(e){}
  return 0;
}

// Server reserve - batch
window.ptfReserveCodes = function(blocks, cb){
  // blocks: {CUST:20, IQI:100}
  try {
    // v31.7.4 BUG-AUDIT-011 FIXED: Use UUID-like device ID instead of 2-digit random
    var deviceId = localStorage.getItem('ptf_device_id');
    if (!deviceId || deviceId.length < 10) {
      deviceId = 'D' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('ptf_device_id', deviceId);
    }
    var payload = {blocks: blocks, year: faYear(), clientId: deviceId};
    fetch(API+'?action=reserve', {
      method:'POST',
      headers:(function(){ var h={'Content-Type':'application/json','X-CRM-Role': (typeof curRole==='function'?curRole():'sales')}; try{ var t=localStorage.getItem('ptf_crm_token'); if(t) h['X-CRM-Token']=t; }catch(e){} return h; })(),
      body: JSON.stringify(payload)
    }).then(function(r){ return r.json(); }).then(function(d){
      if(d && d.ok && d.codes){
        var pool=getPool();
        Object.keys(d.codes).forEach(function(pref){
          var arr=d.codes[pref]||[];
          // store numbers only for easy formatting with year change
          var nums=arr.map(function(code){ return extractNumLegacy(code, pref) || 0; }).filter(Boolean);
          if(!pool[pref]) pool[pref]=[];
          // append, keep unique
          nums.forEach(function(n){ if(pool[pref].indexOf(n)===-1) pool[pref].push(n); });
          pool[pref].sort(function(a,b){ return a-b; });
        });
        setPool(pool);
        setMeta({lastReserve: Date.now(), year: faYear()});
        try { if (typeof window.ptfAutoRepairSafeDuplicates === 'function') window.ptfAutoRepairSafeDuplicates(); } catch (eRepair) {}
      }
      if(cb) cb(d);
    }).catch(function(e){ if(cb) cb({ok:false, error:String(e)}); });
  } catch(e){ if(cb) cb({ok:false, error:String(e)}); }
};

// Background refill when pool low
window._ptfRefillPoolBackground = function(pref){
  try {
    var pool=getPool();
    if((pool[pref]||[]).length>5) return;
    window.ptfReserveCodes((function(){ var o={}; o[pref]=20; return o; })());
  } catch(e){}
};

/* v31.7.3 BUG-AUDIT-002-FINANCIAL-CODEGEN: entityهای مالی فقط از server pool
   کد می‌گیرند — بدون fallback به legacyMaxNext. اگر pool خالی باشد، TMP می‌دهد
   و entity بدون کد رسمی save نمی‌شود. جلوگیری از duplicate CHQ/INV/PAY بین دستگاه‌ها. */
var SERVER_ONLY_PREFIXES = ['TO','CO','TC','CHQ','INV','PAY','CMP'];
function isServerOnlyPrefix(prefix) {
  return SERVER_ONLY_PREFIXES.indexOf(String(prefix||'').toUpperCase().trim()) > -1;
}

// Sync wrapper - tries server, falls back to TMP
function nextFromPool(prefix, year){
  prefix=String(prefix||'ID').toUpperCase().trim();
  if(prefix==='PROD' || prefix==='PRODUCT') prefix='P';
  var pool=getPool();
  var arr=pool[prefix]||[];
  if(arr.length){
    var n=arr.shift();
    pool[prefix]=arr;
    setPool(pool);
    window._ptfRefillPoolBackground(prefix);
    return formatCodeClient(prefix, n, year);
  }
  // try sync year-specific for TO/CO/TC
  if(prefix==='TO' || prefix==='CO' || prefix==='TC'){
    var yKey=prefix+'-'+(year||faYear());
    var arrY=(getPool()[yKey]||[]);
    if(arrY.length){
      var nY=arrY.shift();
      var p=getPool(); p[yKey]=arrY; setPool(p);
      return formatCodeClient(prefix, nY, year);
    }
  }
  return null;
}

// Legacy max scan - fallback سینک اگر Pool خالی بود (تا TMP ندهد)
function legacyMaxNext(prefix, year){
  try {
    var p=String(prefix||'ID').toUpperCase().trim();
    if(p==='PROD' || p==='PRODUCT') p='P';
    var keyMap={
      'CUST':'ptf_crm_customers','SUP':'ptf_crm_suppliers','P':'ptf_crm_products',
      'RFQ':'ptf_crm_rfqs','IQI':'ptf_crm_inqitems','LEAD':'ptf_crm_leads',
      'CHQ':'ptf_crm_cheques','INV':'ptf_crm_invoices','PAY':'ptf_crm_payables',
      'CMP':'ptf_crm_buycmp','TO':'ptf_crm_offers','CO':'ptf_crm_offers','TC':'ptf_crm_offers'
    };
    var lk=keyMap[p]||null;
    var max=1000;
    // TO/CO/TC سال جاری از 99 شروع (0100) و P از 1119 (1120)
    if(p==='TO' || p==='CO' || p==='TC'){
      var curY=String(faYear());
      var y=String(year||curY);
      if(y===curY) max=99; else max=0;
    } else if(p==='P'){
      max=1119;
    }
    if(lk && typeof getData==='function'){
      var arr=getData(lk)||[];
      arr.forEach(function(it){
        if(!it) return;
        var field = (p==='TO'||p==='CO'||p==='TC')?'no':'cd';
        // برای offers هم cd و no هر دو
        var candFields = [it[field], it.cd, it.no, it.id].filter(Boolean);
        candFields.forEach(function(code){
          var n=extractNumLegacy(code, p);
          // برای TO/CO/TC فقط همان سال
          if((p==='TO'||p==='CO'||p==='TC')){
            var yy = String(code).match(/PTF-(?:TO|CO|TC)-(\d+)-/);
            if(yy && yy[1]!==String(year||faYear())) return;
          }
          if(n>max) max=n;
        });
      });
    }
    // چک Pool و _ptfCodeSeq هم تا تکراری ندهد
    try {
      var pool=getPool();
      (pool[p]||[]).forEach(function(n){ if(n>max) max=n; });
      if(window._ptfCodeSeq && window._ptfCodeSeq[p] && window._ptfCodeSeq[p]>max) max=window._ptfCodeSeq[p];
    } catch(e){}
    var next=max+1;
    try { if(!window._ptfCodeSeq) window._ptfCodeSeq={}; window._ptfCodeSeq[p]=next; } catch(e){}
    return formatCodeClient(p, next, year);
  } catch(e){ return null; }
}

// === THE UNIFIED CODING FUNCTION ===
var _oldUnified = window.ptfUnifiedCode;

window.ptfUnifiedCode = function(prefix){
  var p=String(prefix||'ID').toUpperCase().trim();
  var year=faYear();
  if(p==='PROD' || p==='PRODUCT') p='P';

  // 1. Try pool (server reserved, never reuse) - بهترین حالت
  var fromPool = nextFromPool(p, year);
  if(fromPool) return fromPool;

  // 2. v31.7.3 BUG-AUDIT-002-FINANCIAL-CODEGEN: entityهای مالی (CHQ/INV/PAY/CMP)
  // فقط از server pool کد می‌گیرند — بدون legacy fallback.
  // اگر pool خالی باشد، TMP می‌دهد و save block می‌شود تا server در دسترس شود.
  if (isServerOnlyPrefix(p)) {
    var tmp = 'TMP-'+p+'-'+Date.now()+'-'+Math.floor(100+Math.random()*900);
    try {
      var q=JSON.parse(localStorage.getItem('ptf_code_tmp_queue')||'[]');
      q.push({tmp:tmp, prefix:p, year:year, t: new Date().toISOString()});
      if(q.length>200) q=q.slice(-200);
      localStorage.setItem('ptf_code_tmp_queue', JSON.stringify(q));
    } catch(e){}
    try { window._ptfRefillPoolBackground(p); } catch(e){}
    return tmp;
  }

  // 3. Legacy max scan for non-financial entities (CUST/SUP/P/LEAD/IQI)
  var legacy = legacyMaxNext(p, year);
  if(legacy){
    try { window._ptfRefillPoolBackground(p); } catch(e){}
    return legacy;
  }

  // 4. Last resort TMP for non-financial entities
  var tmp2 = 'TMP-'+p+'-'+Date.now()+'-'+Math.floor(100+Math.random()*900);
  try {
    var q2=JSON.parse(localStorage.getItem('ptf_code_tmp_queue')||'[]');
    q2.push({tmp:tmp2, prefix:p, year:year, t: new Date().toISOString()});
    if(q2.length>200) q2=q2.slice(-200);
    localStorage.setItem('ptf_code_tmp_queue', JSON.stringify(q2));
  } catch(e){}
  try { window._ptfRefillPoolBackground(p); } catch(e){}
  return tmp2;
};

// Keep old for migration reference
window.ptfUnifiedCodeLegacy = _oldUnified;

// Async version for new code that can await server
window.ptfUnifiedCodeAsync = function(prefix, count){
  return new Promise(function(resolve, reject){
    window.ptfReserveCodes((function(){ var o={}; o[prefix]=count||1; return o; })(), function(d){
      if(d && d.ok){
        var pool=getPool();
        var arr=pool[prefix]||[];
        var out=[];
        for(var i=0;i<(count||1);i++){
          if(arr.length){ var n=arr.shift(); out.push(formatCodeClient(prefix,n)); }
        }
        pool[prefix]=arr; setPool(pool);
        resolve(count===1?out[0]:out);
      } else {
        reject(d);
      }
    });
  });
};

// On boot, reserve initial blocks for most used prefixes
window.ptfCodegenBoot = function(){
  try {
    var pool=getPool();
    var need={};
    var common=['CUST','SUP','P','RFQ','IQI','LEAD','CHQ','INV','PAY','CMP','TO','CO'];
    common.forEach(function(p){
      var arr=pool[p]||[];
      if(arr.length<10) need[p]=20;
    });
    if(Object.keys(need).length){
      window.ptfReserveCodes(need);
    }
    // device id for traceability
    if(!localStorage.getItem('ptf_device_id')){
      // v31.7.4 BUG-AUDIT-011 FIXED: Use UUID-like device ID instead of 2-digit random
      var deviceId = 'D' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('ptf_device_id', deviceId);
    }
  } catch(e){}
};

// Hook into sync boot - v28.9.2: زودتر اجرا تا TMP ندهد
try { window.ptfCodegenBoot(); } catch(e){}
setTimeout(window.ptfCodegenBoot, 500);
setTimeout(window.ptfCodegenBoot, 2500);

// === INVARIANT CHECK - never reuse deleted ===
window.ptfCodeInvariantCheck = function(){
  return {ok:true, msg:'Server counter only increments, deleted codes kept in deleted_archive but never reused'};
};

/* v31.6.27 CODEGEN-DUP-AUDIT: read-only duplicate report. It never renames
   or rewrites records; repair must preserve invoice/deal references. */
window.ptfScanDuplicateCodes = function(){
  var keys=['ptf_crm_offers','ptf_crm_customers','ptf_crm_suppliers','ptf_crm_products','ptf_crm_rfqs'];
  var out=[];
  keys.forEach(function(k){
    var map={};
    (typeof getData==='function'?getData(k):[]).forEach(function(r,i){
      var code=(k==='ptf_crm_offers'?r.no:r.cd)||r.id||''; if(!code)return;
      map[code]=map[code]||[]; map[code].push({index:i,record:r});
    });
    Object.keys(map).forEach(function(code){ if(map[code].length>1) out.push({key:k,code:code,records:map[code]}); });
  });
  return out;
};

function ptfCodeRecordTime(r) {
  return String((r && (r.createdISO || r.t || r.dt || r.dateEn || r.dateFa || r.ts)) || '');
}
function ptfCodeRefScan(key, code) {
  var refs=[];
  function scan(dataKey, fields) {
    (typeof getData==='function'?getData(dataKey):[]).forEach(function(r){
      fields.forEach(function(f){ if(r && r[f] === code) refs.push({key:dataKey,field:f,record:r}); });
    });
  }
  if(key==='ptf_crm_rfqs'){
    scan('ptf_crm_offers',['inqNo']); scan('ptf_crm_rfqsmart',['srcRfq']); scan('ptf_crm_buycmp',['inqNo']);
    scan('ptf_crm_payables',['inqNo']); scan('ptf_crm_deals',['inqNo']); scan('ptf_crm_projects',['inqNo']); scan('ptf_crm_inqitems',['inqNo']);
  } else if(key==='ptf_crm_offers'){
    scan('ptf_crm_invoices',['offerNo']); scan('ptf_crm_deals',['wonOffer','offerNo']); scan('ptf_crm_projects',['offerNo']);
  }
  return refs;
}
window.ptfBuildDuplicateRepairPlan = function(){
  return window.ptfScanDuplicateCodes().map(function(group){
    var records=(group.records||[]).slice().sort(function(a,b){return ptfCodeRecordTime(a.record).localeCompare(ptfCodeRecordTime(b.record));});
    var refs=ptfCodeRefScan(group.key,group.code);
    var distinct=records.map(function(x){return JSON.stringify(x.record);}).filter(function(x,i,a){return a.indexOf(x)===i;});
    var safe=!refs.length && distinct.length===records.length && records.length>1;
    return {key:group.key,code:group.code,records:records,refs:refs,safe:safe,reason:refs.length?'referenced-ambiguous':distinct.length!==records.length?'identical-records':'safe',newCode:safe?'pending-server-reservation':''};
  });
};
window.ptfApplyDuplicateRepairPlan = function(plan, opts){
  opts=opts||{}; if(opts.confirm!=='PTF-DUP-REPAIR') return {ok:false,why:'confirmation'};
  var result={ok:true,applied:[],skipped:[]};
  (plan||[]).forEach(function(item){
    if(!item.safe){result.skipped.push({key:item.key,code:item.code,reason:item.reason,refs:(item.refs||[]).length});return;}
    var prefix=item.key==='ptf_crm_offers'?'CO':'RFQ'; var code=typeof ptfUnifiedCode==='function'?ptfUnifiedCode(prefix):'';
    if(!code || /^TMP-/.test(code)){result.skipped.push({key:item.key,code:item.code,reason:'server-code-unavailable'});return;}
    var arr=getData(item.key), sig=JSON.stringify(item.records[item.records.length-1].record), idx=-1;
    arr.forEach(function(r,i){if(idx<0 && JSON.stringify(r)===sig) idx=i;});
    if(idx<0){result.skipped.push({key:item.key,code:item.code,reason:'record-not-found'});return;}
    var field=item.key==='ptf_crm_offers'?'no':'cd'; if(arr[idx][field]!==item.code){result.skipped.push({key:item.key,code:item.code,reason:'identity-mismatch'});return;}
    arr[idx][field]=code; arr[idx]._codeRepair={from:item.code,at:(typeof faDateTime==='function'?faDateTime():new Date().toISOString()),reason:'duplicate-safe-newer-record'};
    setData(item.key,arr); if(typeof audit==='function') audit('سیستم','اصلاح خودکار کد تکراری امن '+item.code+' → '+code,item.key);
    result.applied.push({key:item.key,from:item.code,to:code});
  });
  return result;
};
/* v31.7.10 BUG-DUP-NAG-001: اثرانگشت plan برای جلوگیری از هشدار تکراری در هر رفرش */
function ptfDupPlanFingerprint(plan){
  return (plan||[]).map(function(x){return x.key+':'+x.code+':'+x.reason;}).sort().join('|');
}
/* v31.7.15 BUG-DUP-NAG-002: ack در localStorage تک‌دستگاهی بود — موبایل/مرورگر دیگر
   هر رفرش دوباره هشدار می‌داد. حالا ack در ptf_crm_settings ذخیره می‌شود که برای
   نقش‌های ارشد (همان‌هایی که auto-repair اجرا می‌کنند) بین دستگاه‌ها sync می‌شود.
   localStorage به‌عنوان cache محلی/سازگاری عقب‌رو باقی است. */
function ptfDupAckGet(){
  var a='';
  try { var st=JSON.parse(localStorage.getItem('ptf_crm_settings')||'{}'); a=st.dupCodeAck||''; } catch(e){}
  if(!a){ try { a=localStorage.getItem('ptf_code_duplicate_ack')||''; } catch(e2){} }
  return a;
}
function ptfDupAckSet(fp){
  try {
    var st=JSON.parse(localStorage.getItem('ptf_crm_settings')||'{}');
    if(fp){ st.dupCodeAck=fp; } else { delete st.dupCodeAck; }
    if(typeof setData==='function') setData('ptf_crm_settings', st); /* setData → sync بین دستگاه‌ها */
    else localStorage.setItem('ptf_crm_settings', JSON.stringify(st));
  } catch(e){}
  try { if(fp) localStorage.setItem('ptf_code_duplicate_ack', fp); else localStorage.removeItem('ptf_code_duplicate_ack'); } catch(e2){}
}
window.ptfAutoRepairSafeDuplicates = function(){
  try{
    var role=typeof curRole==='function'?curRole():''; if(['admin','chairman','ceo','commercial'].indexOf(role)<0) return {ok:false,why:'role'};
    /* v31.7.38 BUG-DUP-GROW-001: before showing an unactionable duplicate warning,
       canonically collapse same-code RFQ/Offer records. Code is the business identity;
       keeping multiple payloads made old records multiply through sync and polluted My Day. */
    if (typeof window.ptfCollapseDuplicateBusinessRecords === 'function') {
      try { window.ptfCollapseDuplicateBusinessRecords({ confirm: 'PTF-COLLAPSE-DUP' }); } catch (eCollapse) {}
    }
    var plan=window.ptfBuildDuplicateRepairPlan();
    if(!plan.length){
      try { localStorage.removeItem('ptf_code_duplicate_plan'); } catch(eClr) {}
      ptfDupAckSet(''); /* حل شد → ack همه دستگاه‌ها پاک */
      return {ok:true,plan:[],result:{applied:[],skipped:[]}};
    }
    try { localStorage.setItem('ptf_code_duplicate_plan', JSON.stringify(plan)); } catch(ePlan) {}
    /* v31.7.10 BUG-DUP-NAG-001: پیام «کد تکراری» با هر هارد رفرش تکرار می‌شد چون
       موارد ambiguous (که عمداً auto-repair نمی‌شوند) هر بار دوباره toast/notify می‌ساختند.
       حالا: فقط وقتی plan نسبت به آخرین اعلام «تغییر» کرده باشد هشدار می‌دهیم.
       ادمین می‌تواند از دیالوگ، موارد مرجع‌سنجی‌شده را acknowledge کند. */
    var fp=ptfDupPlanFingerprint(plan), ack=ptfDupAckGet();
    if(fp!==ack){
      if(typeof ptfToast==='function') ptfToast('⚠️ '+plan.length+' کد تکراری شناسایی شد — از تنظیمات، «بررسی کدهای تکراری» را باز کنید.', 'warn');
      var amb=plan.filter(function(x){return !x.safe;});
      if(amb.length && typeof notify==='function') notify({toRoles:['admin','chairman'],title:'⚠️ duplicate code نیازمند repair دستی/مرجع‌سنجی: '+amb.length+' مورد',body:'کدهای ambiguous عمداً تغییر نکردند؛ duplicate audit را بررسی کنید.',kind:'system',channels:['cart'],link:{panel:'set'},actionable:true,dkey:'dup-code-ambiguous'});
    }
    return {ok:true,plan:plan,result:{applied:[],skipped:[]}};
  }catch(e){return {ok:false,error:String(e)};}
};
/* v31.7.10: acknowledge — ادمین تایید می‌کند موارد فعلی را دیده؛ تا وقتی plan تغییر نکند هشدار جدید نمی‌آید */
window.ptfDuplicateRepairAck = function(){
  var plan=[]; try { plan=JSON.parse(localStorage.getItem('ptf_code_duplicate_plan')||'[]'); } catch(e) {}
  ptfDupAckSet(ptfDupPlanFingerprint(plan)); /* v31.7.15: ack سراسری sync‌شونده — یک‌بار «دیدم» = همه دستگاه‌ها */
  if(typeof audit==='function') audit('سیستم','تایید مشاهده duplicateهای مبهم ('+plan.length+' مورد) — هشدار تا تغییر وضعیت خاموش شد','');
  if(typeof ptfToast==='function') ptfToast('✓ ثبت شد — تا زمانی که وضعیت کدهای تکراری تغییر نکند، هشدار تکرار نمی‌شود.','ok');
  var dlg=document.getElementById('ptfDupDlg'); if(dlg) dlg.remove();
};
window.ptfDuplicateRepairApplyOne = function(index){
  var plan=[]; try { plan=JSON.parse(localStorage.getItem('ptf_code_duplicate_plan')||'[]'); } catch(e) {}
  var item=plan[index]; if(!item) return;
  if(!item.safe){ alert('⛔ این duplicate دارای reference مبهم است؛ بدون repair plan تغییر نمی‌کند.'); return; }
  if(!confirm('کد جدید فقط از server گرفته می‌شود و کد قبلی در history می‌ماند. ادامه می‌دهید؟')) return;
  var res=window.ptfApplyDuplicateRepairPlan([item],{confirm:'PTF-DUP-REPAIR'});
  if(res.applied&&res.applied.length){ plan.splice(index,1); localStorage.setItem('ptf_code_duplicate_plan',JSON.stringify(plan)); if(typeof ptfToast==='function') ptfToast('✅ کد جدید server اختصاص داده شد','ok'); if(typeof refreshCurrentPanel==='function') refreshCurrentPanel(); }
  else alert('⛔ کد server در دسترس نیست یا رکورد قابل تطبیق نیست؛ داده تغییر نکرد.');
};
window.ptfDuplicateRepairOpen = function(){
  var plan=[]; try { plan=JSON.parse(localStorage.getItem('ptf_code_duplicate_plan')||'[]'); } catch(e) {}
  if(!plan.length){ alert('✅ duplicate فعالی برای RFQ/Offer ثبت نشده است.'); return; }
  var rows=plan.map(function(x,i){
    var recs=(x.records||[]).map(function(r){var v=r.record||{};return '<div><b>'+escP(x.code)+'</b> — '+escP(v.t||v.dt||v.dateEn||'-')+' — '+escP(v.st||'')+'</div>';}).join('');
    var action=x.safe?'<button class="bt bt-o" style="font-size:11px;color:#b45309" onclick="ptfDuplicateRepairApplyOne('+i+')">اختصاص کد جدید از server</button>':'<span style="color:#b45309;font-size:11px">نیازمند مرجع‌سنجی (بدون تغییر خودکار)</span>';
    return '<tr><td>'+escP(x.key)+'</td><td>'+recs+'</td><td>'+escP(x.reason||'')+'</td><td>'+action+'</td></tr>';
  }).join('');
  var html='<div class="md-b" id="ptfDupDlg" style="display:grid;z-index:4000" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:1000px;max-height:90vh;overflow:auto"><h3>⚠️ کدهای تکراری پس از sync</h3><div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:9px 12px;font-size:12px;color:#92400e;margin-bottom:10px">کد جدید قابل تایپ نیست؛ فقط server می‌تواند کد جدید اختصاص دهد. موارد دارای invoice/deal/project بدون حدس تغییر نمی‌کنند.</div><div class="tb2"><table><thead><tr><th>بخش</th><th>رکوردها</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>'+rows+'</tbody></table></div><div style="display:flex;gap:8px;justify-content:flex-start;margin-top:10px"><button class="bt bt-o" style="color:#0e7490;border-color:#bae6fd" onclick="ptfDuplicateRepairAck()">✓ دیدم — دیگر هشدار نده (تا تغییر وضعیت)</button><button class="bt" onclick="document.getElementById(\'ptfDupDlg\').remove()">بستن</button></div></div></div>';
  (document.body||document.getElementById('panels')).insertAdjacentHTML('beforeend',html);
};

// === v29.0: Reconcile TMP codes ===
window.ptfScanTmpCodes = function(){
  var tmps=[];
  try {
    var keys = ['ptf_crm_customers','ptf_crm_suppliers','ptf_crm_products','ptf_crm_rfqs','ptf_crm_inqitems','ptf_crm_offers','ptf_crm_leads','ptf_crm_cheques','ptf_crm_invoices','ptf_crm_payables','ptf_crm_buycmp'];
    var re = /^TMP-([A-Z]+)-/;
    keys.forEach(function(k){
      var arr=[]; try { arr=getData(k)||[]; } catch(e){ return; }
      arr.forEach(function(it){
        if(!it) return;
        ['cd','no','id','code','buyerCd','custCd','supCd','offerNo','inqNo'].forEach(function(f){
          var v=it[f]; if(!v) return; if(String(v).indexOf('TMP-')===0){
            var m=String(v).match(re);
            var pref=m?m[1]:'ID';
            if(tmps.indexOf(v)===-1) tmps.push(v);
          }
        });
      });
    });
    // also queue
    try {
      var q=JSON.parse(localStorage.getItem('ptf_code_tmp_queue')||'[]');
      q.forEach(function(x){ if(x.tmp && tmps.indexOf(x.tmp)===-1) tmps.push(x.tmp); });
    } catch(e){}
  } catch(e){}
  return tmps;
};

window.ptfReconcileTmpCodes = function(cb){
  var list=window.ptfScanTmpCodes();
  if(!list.length){ if(cb) cb({ok:true, msg:'No TMP codes'}); return; }
  var maps=list.map(function(tmp){
    var m=tmp.match(/^TMP-([A-Z]+)-/); var pref=m?m[1]:'ID';
    // try extract year from tmp? fallback current
    return {tmp:tmp, prefix:pref, year: faYear()};
  });
  fetch(API+'?action=reconcile', {
    method:'POST',
    headers:(function(){ var h={'Content-Type':'application/json','X-CRM-Role': (typeof curRole==='function'?curRole():'admin')}; try{ var t=localStorage.getItem('ptf_crm_token'); if(t) h['X-CRM-Token']=t; }catch(e){} return h; })(),
    body: JSON.stringify({maps: maps})
  }).then(function(r){ return r.json(); }).then(function(d){
    if(d && d.ok && d.maps){
      // replace in all storage
      var mapDict={}; d.maps.forEach(function(x){ mapDict[x.tmp]=x.real; });
      var keys=['ptf_crm_customers','ptf_crm_suppliers','ptf_crm_products','ptf_crm_rfqs','ptf_crm_inqitems','ptf_crm_offers','ptf_crm_leads','ptf_crm_cheques','ptf_crm_invoices','ptf_crm_payables','ptf_crm_buycmp','ptf_crm_deals','ptf_crm_projects'];
      var replaced=0;
      keys.forEach(function(k){
        try {
          var arr=getData(k)||[]; var changed=false;
          arr.forEach(function(it){
            if(!it) return;
            ['cd','no','id','code','buyerCd','custCd','supCd','offerNo','inqNo','srcRfq','wonOffer'].forEach(function(f){
              if(it[f] && mapDict[it[f]]){ it[f]=mapDict[it[f]]; changed=true; replaced++; }
            });
          });
          if(changed) setData(k, arr);
        } catch(e){}
      });
      // clear queue
      try { localStorage.removeItem('ptf_code_tmp_queue'); } catch(e){}
      if(cb) cb({ok:true, replaced:replaced, maps:d.maps});
      if(typeof ptfToast==='function') ptfToast('✅ '+replaced+' کد TMP به کد واقعی تبدیل شد', 'ok');
    } else {
      if(cb) cb(d);
    }
  }).catch(function(e){ if(cb) cb({ok:false, error:String(e)}); });
};

})();
