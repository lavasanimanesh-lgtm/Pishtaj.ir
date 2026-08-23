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
    var projectionComplete = expected > 0 && touched === expected;
    /* v34.7.39: global rev پیش از catch-up pull جلو نمی‌رود. اگر دستگاه تغییر یک
       کلید دیگر را ندیده باشد، پذیرش زودهنگام rev فرمان باعث fresh کاذب و حذف آن
       تغییر بین‌دستگاهی می‌شود. per-key revهای projection همین حالا ثبت شده‌اند. */
    /* v34.7.14: projection با rev دقیق ابتدا روی cache فاز B اعمال می‌شود، سپس
       pull نهایی را واقعاً تا پایان انتظار می‌کشیم. handler موفقیت و renderها دیگر
       جلوتر از همگام‌سازی اجرا نمی‌شوند. شکست pull، commit موفق سرور را شکست‌خورده
       اعلام نمی‌کند؛ projection پاسخ همچنان منبع نمایش فوری است. */
    /* v34.7.18: هر پروجکشن تازه، کش محاسبهٔ مطالبات را باطل می‌کند تا نماها بلافاصله هم‌خوان شوند. */
    try { if (window.PTF && window.PTF.ar && typeof window.PTF.ar.invalidate === 'function') window.PTF.ar.invalidate(); } catch (eArInv) {}
    return new Promise(function (resolve) {
      if (!touched || typeof window.ptfSyncPullNow !== 'function') {
        if (projectionComplete && typeof window.ptfSyncAcceptServerRevision === 'function') try { window.ptfSyncAcceptServerRevision(serverRev); } catch (eRevNoPull) {}
        resolve({ ok: true, skipped: true }); return;
      }
      try {
        window.ptfSyncPullNow(function (result) {
          result=result||{ok:true};
          if (result.ok!==false&&projectionComplete&&typeof window.ptfSyncAcceptServerRevision==='function') try { window.ptfSyncAcceptServerRevision(serverRev); } catch (eRev) {}
          resolve(result);
        });
      } catch (eP) { resolve({ ok: false, reason: 'pull_exception' }); }
    });
  }
  function apiAttempt(action, payload) {
    return fetch(API + '?action=' + encodeURIComponent(action), { method:'POST', headers:authHeaders(), body:JSON.stringify(payload) })
      .then(function (r) { return r.text().then(function (txt) {
        var d;
        try { d=JSON.parse(txt); }
        catch(e){ var invalid = new Error('پاسخ نامعتبر سرور: ' + txt.slice(0,160)); invalid.status = r.status; invalid.responseInvalid = true; throw invalid; }
        if (!r.ok || !d.ok) { var er = new Error(d.error || ('HTTP '+r.status)); er.payload=d; er.status=r.status; throw er; }
        return d;
      }); })
      .then(function (d) { return applyProjection(d.data || {}, d.rev).then(function () { return d; }); });
  }
  function commandErrorIsAmbiguous(e) {
    var s=+(e&&e.status||0);
    if(s>=400&&s<500&&s!==408&&s!==425&&s!==429)return false;
    return !s || s===408 || s===425 || s===429 || s>=500 || !!(e&&e.responseInvalid);
  }
  function actionIsReadOnly(action){return['snapshot','health','migration_dry_run','duplicate_case_plan','archived_case_purge_plan','admin_delete_plan','command_status'].indexOf(action)>-1;}
  /* v34.7.45: after two ambiguous mutation responses, query the durable command
     journal through a compact endpoint. This avoids a false `uncertain` when the
     mutation committed but its large full-projection response was lost twice. */
  function compactCommandStatus(action,payload) {
    var operationId=String((payload&&payload.idempotencyKey)||'');
    return fetch(API+'?action=command_status',{method:'POST',headers:authHeaders(),body:JSON.stringify({operationId:operationId,commandAction:action})})
      .then(function(r){return r.text().then(function(txt){
        var d;try{d=JSON.parse(txt);}catch(e){var invalid=new Error('پاسخ نامعتبر بازیابی رسید');invalid.status=r.status;invalid.responseInvalid=true;throw invalid;}
        if(!r.ok||!d.ok){var er=new Error(d.error||('HTTP '+r.status));er.status=r.status;er.payload=d;throw er;}
        return d;
      });});
  }
  function syncAfterCompactReceipt(receipt) {
    receipt=receipt||{};receipt.reconciled=true;receipt.compactReceipt=true;
    return new Promise(function(resolve){
      if(typeof window.ptfSyncPullNow!=='function'){resolve(receipt);return;}
      var done=false,timer=null;
      function finish(result){if(done)return;done=true;if(timer)try{clearTimeout(timer);}catch(ignore){}receipt.syncResult=result||{ok:true};resolve(receipt);}
      try{timer=setTimeout(function(){finish({ok:false,reason:'pull_timeout_after_compact_receipt'});},5000);window.ptfSyncPullNow(function(result){finish(result);});}
      catch(e){finish({ok:false,reason:'pull_exception_after_compact_receipt'});}
    });
  }
  function recoverCommandReceipt(action,payload,lastError) {
    return compactCommandStatus(action,payload).then(function(status){
      if(status&&status.committed===true)return syncAfterCompactReceipt(status);
      /* command_status زیر lock و بعد از WAL recovery پاسخ داده است؛ «یافت نشد»
         در این نقطه عدم commit قطعی است، نه outcome نامشخص. */
      var notCommitted=new Error('command_not_committed');notCommitted.status=409;notCommitted.definitiveNoCommit=true;notCommitted.operationId=payload&&payload.idempotencyKey;notCommitted.commandAction=action;throw notCommitted;
    },function(statusError){
      try{lastError.commandStatusError=String((statusError&&statusError.message)||statusError||'');}catch(ignore){}
      throw lastError;
    });
  }
  function persistCommandDiagnostic(kind,action,payload,e) {
    var op=String((payload&&payload.idempotencyKey)||'unknown'),key='ptf_sales_command_'+kind+'_'+op.replace(/[^A-Za-z0-9_.|:-]/g,'_').slice(0,160);
    try { localStorage.setItem(key,JSON.stringify({kind:kind,action:action,operationId:op,message:String((e&&e.message)||e||''),at:new Date().toISOString()})); } catch(ignore){}
    return key;
  }
  function api(action, payload, options) {
    payload = payload || {}; options=options||{};
    if (!payload.idempotencyKey) payload.idempotencyKey = nowId(action.toUpperCase());
    var first=apiAttempt(action,payload);
    if(options.autoReplay===false)return first;
    return first.then(null,function(e){
      if(!commandErrorIsAmbiguous(e))throw e;
      return apiAttempt(action,payload).then(null,function(replayError){
        if(commandErrorIsAmbiguous(replayError)&&!actionIsReadOnly(action)){
          return recoverCommandReceipt(action,payload,replayError).then(null,function(finalError){
            if(finalError&&finalError.definitiveNoCommit)throw finalError;
            finalError.commitOutcome='uncertain';finalError.operationId=payload.idempotencyKey;finalError.commandAction=action;
            persistCommandDiagnostic('uncertain',action,payload,finalError);
            throw finalError;
          });
        }
        throw replayError;
      });
    });
  }
  function postAckWarning(action,payload,e) {
    persistCommandDiagnostic('post_ack_warning',action,payload,e);
    try { console.error('sales command post-ACK effect',action,payload&&payload.idempotencyKey,e); } catch(ignore){}
    try { toast('ثبت سرور قطعی است؛ فقط تازه‌سازی نمایش کامل نشد. صفحه را تازه‌سازی کنید.','warn'); } catch(ignoreToast){}
  }
  function lifecycleEffectWarning(action,payload,phase,e){
    if(phase==='acked')return postAckWarning(action,payload,e);
    persistCommandDiagnostic(phase+'_handler_warning',action,payload,e);
    try{console.error('sales command lifecycle effect',phase,action,payload&&payload.idempotencyKey,e);}catch(ignore){}
  }
  function safeCommandEffect(action,payload,fn,arg,phase) {
    if(typeof fn!=='function')return;
    try {
      var out=fn(arg);
      if(out&&typeof out.then==='function')out.then(null,function(e){lifecycleEffectWarning(action,payload,phase,e);});
    } catch(e){lifecycleEffectWarning(action,payload,phase,e);}
  }
  /* v34.7.43: one command lifecycle for every mutating sales/finance action.
     Rejection is delivered only for a definitive server response. Two ambiguous
     responses preserve intent as `uncertain`; ACK effects are isolated and can never
     trigger rollback, cloud-file deletion, or a false «ثبت نشد» message. */
  function command(action,payload,handlers) {
    payload=payload||{};handlers=handlers||{};
    if(!payload.idempotencyKey)payload.idempotencyKey=nowId(action.toUpperCase());
    return api(action,payload,handlers.apiOptions).then(function(d){
      safeCommandEffect(action,payload,handlers.onAck,d,'acked');
      safeCommandEffect(action,payload,handlers.onFinally,{state:'acked',response:d},'acked');
      return{state:'acked',response:d,operationId:payload.idempotencyKey};
    },function(e){
      if(e&&e.commitOutcome==='uncertain'){
        if(typeof handlers.onUncertain==='function')safeCommandEffect(action,payload,handlers.onUncertain,e,'uncertain');
        else try{alert('⚠️ پاسخ سرور دریافت نشد و نتیجه هنوز نامشخص است. عملیات را دوباره از مسیر دیگری ثبت نکنید؛ شناسه پیگیری: '+payload.idempotencyKey);}catch(ignoreAlert){}
        safeCommandEffect(action,payload,handlers.onFinally,{state:'uncertain',error:e},'uncertain');
        return{state:'uncertain',error:e,operationId:payload.idempotencyKey};
      }
      safeCommandEffect(action,payload,handlers.onReject,e,'rejected');
      safeCommandEffect(action,payload,handlers.onFinally,{state:'rejected',error:e},'rejected');
      return{state:'rejected',error:e,operationId:payload.idempotencyKey};
    });
  }
  window.ptfSalesDomainApi = api;
  window.ptfSalesDomainCommand = command;
  window.ptfSalesCommandErrorIsAmbiguous = commandErrorIsAmbiguous;
  window.ptfSalesDomainCommandStatus = function(action,operationId){
    return compactCommandStatus(action,{idempotencyKey:operationId}).then(function(status){return status&&status.committed===true?syncAfterCompactReceipt(status):status;});
  };
  /* Persisted uncertain diagnostics survive refresh. After authenticated CRM boot this
     helper checks only the durable journal (never resubmits a mutation), pulls the
     committed projection, and clears the warning if its ACK is authoritative. */
  window.ptfRecoverUncertainSalesCommands = function(){
    var rows=[];
    try{for(var i=0;i<localStorage.length;i++){var key=localStorage.key(i);if(String(key||'').indexOf('ptf_sales_command_uncertain_')!==0)continue;var d=JSON.parse(localStorage.getItem(key)||'{}');if(d&&d.action&&d.operationId)rows.push({key:key,d:d});}}catch(e){return Promise.resolve([]);}
    return Promise.all(rows.slice(-12).map(function(row){
      return window.ptfSalesDomainCommandStatus(row.d.action,row.d.operationId).then(function(status){
        if(!status||status.committed!==true){
          try{localStorage.removeItem(row.key);localStorage.setItem('ptf_sales_command_not_committed_'+String(row.d.operationId).replace(/[^A-Za-z0-9_.|:-]/g,'_'),JSON.stringify({action:row.d.action,operationId:row.d.operationId,at:new Date().toISOString()}));}catch(ignoreMissing){}
          try{toast('⚠️ رسید سرور تأیید کرد فرمان '+row.d.operationId+' ثبت نشده است؛ فرم را دوباره باز و ثبت کنید.','warn');}catch(ignoreMissingToast){}
          return{committed:false,definitive:true,operationId:row.d.operationId};
        }
        try{localStorage.removeItem(row.key);localStorage.setItem('ptf_sales_command_recovered_'+String(row.d.operationId).replace(/[^A-Za-z0-9_.|:-]/g,'_'),JSON.stringify({action:row.d.action,operationId:row.d.operationId,at:new Date().toISOString(),result:status.result||{}}));}catch(ignore){}
        try{toast('✅ نتیجه قطعی فرمان '+row.d.operationId+' از رسید سرور بازیابی شد.','ok');}catch(ignoreToast){}
        return{committed:true,operationId:row.d.operationId,result:status.result||{}};
      },function(){return{committed:false,operationId:row.d.operationId};});
    }));
  };

  /* v34.7.39 — ثبت پیشنهاد یک command واقعی است، نه local save + دو push موازی.
     تا پایان ACK، همه projectionهای درگیر از data_push عمومی hold می‌شوند و هیچ
     وضعیت/ارجاع/SMS «صادر شد» تولید نمی‌شود. */
  var OFFER_COMMAND_KEYS = ['ptf_crm_offers','ptf_crm_rfqs','ptf_crm_products','ptf_crm_inqitems','ptf_crm_notifs'];
  function clone(v) { try { return JSON.parse(JSON.stringify(v)); } catch (e) { return v; } }
  function keySnapshot(k) { try { return clone(getData(k)); } catch (e) { return []; } }
  function sameValue(a,b) { try { return JSON.stringify(a) === JSON.stringify(b); } catch (e) { return false; } }
  function offerButtonBusy(busy) {
    try {
      var b=document.getElementById('offSaveBtn'); if(!b)return;
      b.disabled=!!busy; b.textContent=busy?'⏳ در حال تأیید سرور…':'💾 ذخیره';
    } catch(e){}
  }
  function holdOfferCommand() { if(typeof window.ptfSyncHoldCommandKeys==='function')window.ptfSyncHoldCommandKeys(OFFER_COMMAND_KEYS); }
  function releaseOfferCommand() { if(typeof window.ptfSyncReleaseCommandKeys==='function')window.ptfSyncReleaseCommandKeys(OFFER_COMMAND_KEYS); }
  function applyLocalProjection(k,v) {
    if(typeof window.ptfSyncApplyServerProjection==='function')return window.ptfSyncApplyServerProjection(k,v);
    try{localStorage.setItem(k,JSON.stringify(v));return true;}catch(e){return false;}
  }
  function commandRecordId(k,r) {
    if(!r||typeof r!=='object')return'';
    if(k==='ptf_crm_offers')return r.no?String(r.no):String(r._id||'');
    if(k==='ptf_crm_rfqs')return String(r._id||r.cd||r.inqNo||'');
    if(k==='ptf_crm_products')return String(r._id||r.cd||'');
    if(k==='ptf_crm_inqitems'){var parent=String(r.inqNo||r.rfqNo||''),item=String(r.pcode||r.prodCd||r.name||'');return String(r._id||r.cd||r.lineId||(parent||item?parent+'|'+item:''));}
    return String(r._id||r.cd||r.id||r.dkey||'');
  }
  function rollbackChangedFields(beforeRec,afterRec,currentRec) {
    var out=clone(currentRec),keys={};
    Object.keys(beforeRec||{}).concat(Object.keys(afterRec||{})).forEach(function(x){keys[x]=1;});
    Object.keys(keys).forEach(function(field){
      var had=Object.prototype.hasOwnProperty.call(beforeRec||{},field);
      if(!sameValue((beforeRec||{})[field],(afterRec||{})[field])&&sameValue((currentRec||{})[field],(afterRec||{})[field])) {
        if(had)out[field]=clone(beforeRec[field]);else delete out[field];
      }
    });
    return out;
  }
  function compensateCollection(k,beforeRows,afterRows,currentRows) {
    if(!Array.isArray(beforeRows)||!Array.isArray(afterRows)||!Array.isArray(currentRows))return currentRows;
    var bm={},am={},cm={};
    beforeRows.forEach(function(r){var id=commandRecordId(k,r);if(id)bm[id]=r;});
    afterRows.forEach(function(r){var id=commandRecordId(k,r);if(id)am[id]=r;});
    currentRows.forEach(function(r){var id=commandRecordId(k,r);if(id)cm[id]=r;});
    var out=[];
    currentRows.forEach(function(cur){
      var id=commandRecordId(k,cur),b=id?bm[id]:null,a=id?am[id]:null;
      if(!id||!a||sameValue(b,a)){out.push(cur);return;}
      if(!b){
        /* رکورد کاملاً ساختهٔ command است. offer بدون ACK حذف می‌شود؛ canonical
           سرور در پاسخ گم‌شده/دستگاه دیگر با serverRegisteredAt حفظ می‌شود. */
        if(k==='ptf_crm_offers') { if(cur.serverRegisteredAt&&!cur._serverState)out.push(cur); }
        else if(!sameValue(cur,a))out.push(cur);
        return;
      }
      /* projection clean سرور را هرگز با snapshot قدیمی rollback نکن. */
      if(k==='ptf_crm_offers'&&cur.serverRegisteredAt&&!cur._serverState&&(!a.serverRegisteredAt||cur.serverRegisteredAt!==a.serverRegisteredAt)){out.push(cur);return;}
      out.push(sameValue(cur,a)?clone(b):rollbackChangedFields(b,a,cur));
    });
    /* اگر command رکوردی را حذف کرده بود و تغییر هم‌زمانی جایگزینش نکرده، برگردان. */
    beforeRows.forEach(function(b){var id=commandRecordId(k,b);if(id&&!am[id]&&!cm[id])out.push(clone(b));});
    return out;
  }
  function restoreOfferSnapshots(before,after) {
    OFFER_COMMAND_KEYS.forEach(function(k){
      var cur=keySnapshot(k);
      /* fast path + جبران سه‌طرفهٔ رکورد/فیلد: پاسخ دیررس نه کل collection
         تغییرکردهٔ تب دیگر را پاک می‌کند و نه projection خود command را جا می‌گذارد. */
      if(sameValue(cur,after[k]))applyLocalProjection(k,before[k]);
      else {
        var repaired=compensateCollection(k,before[k],after[k],cur);
        if(!sameValue(repaired,cur))applyLocalProjection(k,repaired);
      }
    });
  }
  function rfqForOffer(o) {
    if(!o||!o.inqNo)return null;
    return data('ptf_crm_rfqs').filter(function(r){return r&&(r.cd===o.inqNo||r.inqNo===o.inqNo);})[0]||null;
  }
  function markChangedSideEffects(before,after) {
    ['ptf_crm_products','ptf_crm_inqitems','ptf_crm_notifs'].forEach(function(k){
      /* فقط delta خود command dirty می‌شود؛ catch-up دستگاه دیگر نباید echo شود. */
      if(!sameValue(before[k],after[k])&&typeof window.ptfSyncNotifyDirty==='function')window.ptfSyncNotifyDirty(k);
    });
  }
  /* v34.7.42 — مرز ACK و post-ACK باید در promise هم مرز واقعی باشد. در نسخهٔ قبل
     هر exception رندر/توست/side-effect وارد catch شبکه می‌شد، projection قطعی را
     rollback می‌کرد و پیام کاذب «سرور نپذیرفت» می‌داد؛ بعد pull همان رکورد را برمی‌گرداند. */
  function offerSafeStep(warnings,label,fn) {
    try { return fn(); }
    catch (e) {
      warnings.push(label+': '+String((e&&e.message)||e||'unknown'));
      try { console.error('offer post-ACK '+label,e); } catch (ignore) {}
      return undefined;
    }
  }
  function offerErrorIsDefinitive(e) {
    var status=+(e&&e.status)||0,msg=String((e&&e.message)||'');
    /* payload mismatch با همان operationId معمولاً یعنی تلاش قبلی commit شده و کاربر
       پیش از reconciliation فرم را تغییر داده؛ ابتدا receipt همان عملیات را پیدا کن. */
    if(msg==='idempotency_key_payload_mismatch')return false;
    return status>=400&&status<500&&status!==408;
  }
  function offerServerReceipt(payloadOffer,operationId) {
    function inspect() {
      var canonical=data('ptf_crm_offers').filter(function(o){
        return o&&o.no===payloadOffer.no&&String(o.serverOperationId||'')===String(operationId||'');
      })[0]||null;
      if(!canonical)return null;
      var rfq=rfqForOffer(canonical),workflowOk=!canonical.inqNo||!!rfq;
      if(workflowOk&&rfq&&typeof window.wfCompute==='function') {
        try { workflowOk=String(rfq.wf||'')===String(window.wfCompute(rfq)||''); } catch(eWf) { workflowOk=false; }
      }
      return workflowOk?canonical:null;
    }
    return new Promise(function(resolve){
      if(typeof window.ptfSyncPullNow!=='function'){resolve(inspect());return;}
      var done=false,timer=null;
      function finish(){if(done)return;done=true;if(timer)try{clearTimeout(timer);}catch(eT){}resolve(inspect());}
      try {
        timer=setTimeout(finish,5000);
        window.ptfSyncPullNow(function(){finish();});
      } catch(ePull) { finish(); }
    });
  }
  function saveOfferAckWarning(no,operationId,warnings) {
    if(!warnings.length)return;
    try { localStorage.setItem('ptf_offer_post_ack_warning_'+String(no||''),JSON.stringify({operationId:operationId,at:new Date().toISOString(),warnings:warnings})); } catch(e) {}
  }
  var legacyOfferSave = window.offerSave;
  if (typeof legacyOfferSave === 'function') {
    window.offerSave = function () {
      if (window._ptfOfferCommandInFlight) { toast('ثبت پیشنهاد قبلی هنوز در انتظار پاسخ سرور است.', 'warn'); return {ok:false,busy:true}; }
      var pending = typeof window.ptfSyncPendingKeys==='function' ? window.ptfSyncPendingKeys() : [];
      var blockers = pending.filter(function(k){return OFFER_COMMAND_KEYS.indexOf(k)>-1;});
      if (blockers.length) {
        toast('ابتدا همگام‌سازی تغییرات قبلی کامل شود؛ سپس دوباره ذخیره را بزنید.', 'warn');
        if(typeof window.ptfSyncFlushNow==='function')window.ptfSyncFlushNow(function(){});
        return {ok:false,pendingSync:true};
      }
      var before={}; OFFER_COMMAND_KEYS.forEach(function(k){before[k]=keySnapshot(k);});
      var st=window._offState||{}, previousOpId=st._serverOpId||'';
      st._serverState='sending'; st._serverOpId=previousOpId||nowId('OFFER-SAVE');
      window._ptfOfferCommandInFlight=true;
      window.PTF_OFFER_COMMAND_SAVE_ACTIVE=true;
      offerButtonBusy(true); holdOfferCommand();
      var ret;
      try { ret=legacyOfferSave.apply(this,arguments); }
      finally { window.PTF_OFFER_COMMAND_SAVE_ACTIVE=false; }
      if(!ret||!ret.ok){
        var failedAfter={}; OFFER_COMMAND_KEYS.forEach(function(k){failedAfter[k]=keySnapshot(k);});
        restoreOfferSnapshots(before,failedAfter);
        delete st._serverState; if(!previousOpId)delete st._serverOpId;
        releaseOfferCommand(); window._ptfOfferCommandInFlight=false; offerButtonBusy(false);
        return ret;
      }
      var saved=data('ptf_crm_offers').filter(function(o){return o&&o.no===ret.offerNo&&o.updatedAtISO===ret.updatedAtISO;})[0];
      if(!saved){
        var missingAfter={}; OFFER_COMMAND_KEYS.forEach(function(k){missingAfter[k]=keySnapshot(k);});
        restoreOfferSnapshots(before,missingAfter);
        delete st._serverState; if(!previousOpId)delete st._serverOpId;
        releaseOfferCommand(); window._ptfOfferCommandInFlight=false; offerButtonBusy(false);
        alert('⛔ نسخه‌ای که باید برای سرور ارسال شود پیدا نشد؛ فرم باز مانده است و هیچ وضعیت صدوری ثبت نشد.');
        return {ok:false,reason:'saved_offer_not_found'};
      }
      var after={}; OFFER_COMMAND_KEYS.forEach(function(k){after[k]=keySnapshot(k);});
      var payloadOffer=clone(saved); delete payloadOffer._serverState; delete payloadOffer._serverOpId; delete payloadOffer._serverError;
      /* operation id از لحظهٔ اولین تلاش در state/autodraft پایدار می‌ماند؛ timestamp
         در retry تغییر می‌کند و هرگز نباید کلید reconciliation پاسخ گم‌شده باشد. */
      var idem=st._serverOpId;
      var registerPayload={offer:payloadOffer,rfq:clone(rfqForOffer(saved)),createIntent:ret.idx<0,idempotencyKey:idem};
      /* register_offer has its richer receipt/pull reconciliation below; suppress the
         generic replay so this operation still performs exactly one controlled replay. */
      function registerAttempt(){return api('register_offer',registerPayload,{autoReplay:false});}
      /* خطای 4xx پاسخ قطعی رد است. خطای transport/5xx نتیجهٔ نامعلوم دارد: همان
         operationId یک بار خودکار replay می‌شود؛ اگر پاسخ دوم هم گم شد، pull با
         serverOperationId دقیق بررسی می‌کند. at-least-once transport + exactly-once command. */
      var receipt=registerAttempt().catch(function(firstError){
        if(offerErrorIsDefinitive(firstError)){firstError._ptfDefinitive=true;throw firstError;}
        return registerAttempt().catch(function(retryError){
          return offerServerReceipt(payloadOffer,idem).then(function(canonicalReceipt){
            if(canonicalReceipt)return{ok:true,reconciled:true,result:{offerId:canonicalReceipt._id||'',wf:(rfqForOffer(canonicalReceipt)||{}).wf||''},data:{}};
            if(offerErrorIsDefinitive(retryError)){retryError._ptfDefinitive=true;throw retryError;}
            retryError._ptfOutcomeUnknown=true;retryError._ptfFirstError=firstError;throw retryError;
          });
        });
      });
      /* onRejected آرگومان دومِ then است، نه catch بعد از onAck. بنابراین هیچ خطای
         UI/post-ACK هرگز به‌عنوان «رد سرور» طبقه‌بندی یا rollback نمی‌شود. */
      var command=receipt.then(function(d){
          var warnings=[];
          offerSafeStep(warnings,'ack-sync',function(){if(typeof window.ptfSyncAcknowledgeCommandKeys==='function')window.ptfSyncAcknowledgeCommandKeys(['ptf_crm_offers','ptf_crm_rfqs']);});
          offerSafeStep(warnings,'release-hold',function(){releaseOfferCommand();});
          offerSafeStep(warnings,'side-projection-dirty',function(){markChangedSideEffects(before,after);});
          window._ptfOfferCommandInFlight=false; delete st._serverState; delete st._serverOpId; delete st._serverError;
          var canonical=data('ptf_crm_offers').filter(function(o){return o&&o.no===payloadOffer.no;})[0]||payloadOffer;
          offerSafeStep(warnings,'post-commit-effects',function(){if(typeof window.ptfOfferAfterServerCommit==='function')window.ptfOfferAfterServerCommit(canonical,{idx:ret.idx,madeRevision:ret.madeRevision,productSyncNotes:ret.productSyncNotes||[],toCatalog:!!ret.toCatalog,serverConfirmed:true,operationId:idem});});
          offerSafeStep(warnings,'button-ready',function(){offerButtonBusy(false);});
          offerSafeStep(warnings,'success-toast',function(){toast('پیشنهاد «'+payloadOffer.no+'» و وضعیت درخواست در یک تراکنش سرور تأیید شد'+(d&&d.reconciled?' (بازیابی پاسخ)':'')+'.', 'ok');});
          offerSafeStep(warnings,'render',function(){if(typeof renderOffers==='function')renderOffers();if(typeof renderRfq==='function')renderRfq();});
          saveOfferAckWarning(payloadOffer.no,idem,warnings);
          if(warnings.length)offerSafeStep([], 'warning-toast',function(){toast('ثبت سرور قطعی است؛ فقط '+warnings.length+' اثر نمایشی/جانبی نیازمند تازه‌سازی صفحه است.','warn');});
          return d;
        },function(e){
          var uncertain=!!(e&&e._ptfOutcomeUnknown),warnings=[];
          offerSafeStep(warnings,'rollback-local',function(){restoreOfferSnapshots(before,after);});
          offerSafeStep(warnings,'release-hold',function(){releaseOfferCommand();});
          window._ptfOfferCommandInFlight=false; st._serverState=uncertain?'uncertain':'rejected'; st._serverError=e.message||'register_offer_failed';
          try{localStorage.setItem('ptf_autodraft_offer_'+(st.kind||'CO'),JSON.stringify(st));}catch(eD){}
          offerSafeStep(warnings,'button-ready',function(){offerButtonBusy(false);});
          if(uncertain)offerSafeStep(warnings,'uncertain-alert',function(){alert('⚠️ پاسخ قطعی ثبت از سرور دریافت نشد. سیستم همان operationId را دوباره بررسی کرد اما نتیجه هنوز نامشخص است.\n\nوضعیت درخواست محلی جلو نرفت و پیش‌نویس محفوظ است. پس از برقراری ارتباط دوباره «ذخیره» را بزنید؛ اگر سرور قبلاً ثبت کرده باشد، همان نتیجه بازیابی می‌شود و رکورد تکراری ساخته نمی‌شود.');});
          else offerSafeStep(warnings,'reject-alert',function(){alert('⛔ سرور ثبت پیشنهاد را نپذیرفت؛ وضعیت درخواست تغییر نکرد و متن فرم به‌عنوان پیش‌نویس حفظ شد.\n\nعلت: '+(e.message||'خطای ثبت'))});
          offerSafeStep(warnings,'render',function(){if(typeof renderOffers==='function')renderOffers();if(typeof renderRfq==='function')renderRfq();});
          throw e;
        });
      /* inline handler Promise را مصرف نمی‌کند؛ catch نهایی مانع unhandled rejection است. */
      command.catch(function(){});
      return {ok:true,pendingServer:true,offerNo:payloadOffer.no,promise:command};
    };
  }

  function findOffer(no) { return data('ptf_crm_offers').filter(function (o) { return o && o.no === no; })[0] || null; }
  function identity(v){return String(v||'').replace(/[\u200c\u200e\u200f\s]+/g,'').toUpperCase();}
  function caseBelongsToOffer(c,o){
    if(!c||!o||!active(c))return false;
    var oid=String(o._id||''),root=String(c.rootOfferId||'');
    if(oid&&root){
      if(oid===root)return true;
      /* v34.7.15: rootOfferId کهنه/بازتولیدشده به wonOffer/offerNo fallback می‌کند تا با سرور
         (sd_case_offer_linked) هم‌خوان بماند؛ ایمنی با بررسی هویت پایین حفظ می‌شود. */
    }
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
    /* AW-02 (v34.7.22): هشدار پروندهٔ موازی.
       ریشه: سرور فقط پرونده‌ای را «مرتبط» می‌داند که rootOfferId/wonOffer/offerNo آن با همین
       پیشنهاد بخورد. اگر کاربر یک CO جایگزین/موازی برای همان استعلام و همان مشتری بسازد و
       آن را بدون علامت متمم برنده کند، سرور بی‌صدا پروندهٔ دوم مستقل می‌ساخت و از آن پس
       مطالبات/وصولی/آمار روی دو پرونده پخش می‌شد. دیالوگ اتصال قبلاً فقط برای پیشنهادهای
       علامت‌خوردهٔ متمم ظاهر می‌شد. اکنون قبل از ساخت پروندهٔ دوم، انتخاب صریح گرفته می‌شود.
       مرجع: بررسی مستقل N5 | گام D2 نقشهٔ فازبندی */
    if (!attachCaseId) {
      var _sibs = data('ptf_crm_deals').filter(function (c) {
        if (!c || !active(c)) return false;
        if (caseBelongsToOffer(c, o)) return false;                       /* پروندهٔ خودِ همین پیشنهاد */
        var sameInq = identity(c.inqNo) && identity(o.inqNo) && identity(c.inqNo) === identity(o.inqNo);
        if (!sameInq) return false;
        var cb = identity(c.buyerCd), ob = identity(o.buyerCd);
        if (cb && ob && cb !== ob) return false;
        if (!cb && !ob) { var cc = identity(c.buyerCo), oc = identity(o.buyerCo); if (cc && oc && cc !== oc) return false; }
        var cCur = String(c.currency || 'IRR').toUpperCase(), oCur = String(o.currency || 'IRR').toUpperCase();
        return cCur === oCur;
      });
      if (_sibs.length === 1) {
        var _sib = _sibs[0];
        var _lbl = (_sib.inqNo || _sib.wonOffer || caseId(_sib)) + (_sib.buyerCo ? ' — ' + _sib.buyerCo : '');
        var _ans = confirm('⚠️ برای همین درخواست و همین مشتری، پروندهٔ فعال «' + _lbl + '» وجود دارد.\n\n' +
          'تأیید = اتصال این پیشنهاد به همان پرونده به‌عنوان متمم (مبلغ به قرارداد همان پرونده اضافه می‌شود)\n' +
          'لغو = ادامه با تشکیل پروندهٔ دوم مستقل');
        if (_ans) attachCaseId = caseId(_sib);
        else if (!confirm('🔀 پروندهٔ دوم مستقل برای همان درخواست ساخته می‌شود.\n\n' +
          'از این پس مطالبات، وصولی و آمار روی دو پرونده پخش می‌شود و ادغام بعدی نیازمند مسیر «پروندهٔ تکراری» است.\n\nمطمئن هستید؟')) {
          if (selEl) selEl.value = o.st || 'sent';
          return;
        }
      } else if (_sibs.length > 1) {
        alert('⛔ بیش از یک پروندهٔ فعال برای همین درخواست و مشتری وجود دارد. ابتدا از مسیر «پروندهٔ تکراری» تعیین‌تکلیف شود؛ هیچ پروندهٔ جدیدی حدس زده نمی‌شود.');
        if (selEl) selEl.value = o.st || 'sent';
        return;
      }
    }
    if (!confirm('🏆 ثبت قطعی برد پیشنهاد ' + no + '\n\nبرد و تشکیل/اتصال پرونده در یک فرمان سروری انجام می‌شود و پیشنهاد پس از آن قفل خواهد شد. ادامه می‌دهید؟')) { if(selEl)selEl.value=o.st||'sent'; return; }
    if (selEl) selEl.disabled = true;
    toast('در حال ثبت اتمیک برد و پرونده…', 'info');
    command('win_offer', { offerNo:no, offerId:o._id || '', attachCaseId:attachCaseId, idempotencyKey:'WIN|' + (o._id || no) }, {
      onAck:function (d) {
        toast(d.result && d.result.amendment ? 'متمم به پرونده متصل شد' : 'پیشنهاد برنده و پرونده یکتا ثبت شد', 'ok');
        try { audit('فروش', 'ثبت اتمیک برد و پرونده ' + no, (d.result||{}).caseId || no); } catch(e) {}
        if (typeof renderOffers === 'function') renderOffers();
        if (typeof renderDeals === 'function') renderDeals();
      },onReject:function (e) {
        if (selEl) selEl.value = o.st || 'sent';
        var map={duplicate_offer_no:'شماره پیشنهاد تکراری است',duplicate_sales_cases:'پرونده فروش تکراری شناسایی شد',amendment_customer_or_currency_mismatch:'مشتری یا ارز متمم با پرونده مقصد یکسان نیست'};
        alert('⛔ برد ثبت نشد و وضعیت قبلی حفظ شد:\n' + (map[e.message] || e.message));
      },onUncertain:function(e){alert('⚠️ نتیجه ثبت برد هنوز نامشخص است. وضعیت قبلی را انتخاب نکنید؛ داده را همگام کنید. شناسه پیگیری: '+e.operationId);},
      onFinally:function(){if(selEl)selEl.disabled=false;}
    });
  };
  if (typeof legacySetStatus === 'function') {
    window.offerSetSt = function (no, st, selEl) {
      if (st === 'won') return window.ptfSalesWinOffer(no, selEl);
      return legacySetStatus.apply(this, arguments);
    };
  }

  window.ptfMarkOfferAmendment=function(no){var o=findOffer(no);if(!o)return;var parents=data('ptf_crm_offers').filter(function(x){return x&&x.no!==no&&x.st==='won'&&!x.rialOf&&identity(o.buyerCd)!==''&&identity(x.buyerCd)===identity(o.buyerCd)&&String(x.currency||'IRR')===String(o.currency||'IRR')&&casesForOffer(x).length===1;});if(!parents.length){alert('برای همین مشتری و ارز، پیشنهاد برنده دارای پرونده یافت نشد.');return;}var hint=parents.map(function(x){return x.no+' — '+(x.buyerCo||'');}).join('\n');var parent=prompt('شماره پیشنهاد پایه برنده را وارد کنید:\n'+hint,parents[0].no);if(parent===null)return;parent=parent.trim();if(!parents.some(function(x){return parent!==''&&String(x.no||'')===parent;})){alert('پیشنهاد پایه معتبر نیست');return;}command('mark_amendment',{offerNo:no,parentOfferNo:parent},{onAck:function(){toast('پیشنهاد به‌عنوان متمم مستقل علامت‌گذاری شد؛ هنگام برد اتصال یا پرونده مستقل انتخاب می‌شود','ok');if(typeof renderOffers==='function')renderOffers();},onReject:function(e){alert('⛔ '+e.message);}});};

  window.ptfAdminHardDelete=function(type,id,onDone){
    if(role()!=='admin'){alert('فقط ادمین مجاز است');return;}
    api('admin_delete_plan',{entityType:type,entityId:id,idempotencyKey:'DELETE-PLAN|'+type+'|'+id+'|'+Date.now()}).then(function(d){
      var p=d.plan||{},deps=p.dependencies||[],lines=deps.map(function(x){return x.type+' '+(x.id||'')+(x.amount?' — '+money(x.amount):'');}).join('\n');
      /* AW-03: وابستگی‌های خارج از دامنه فقط اطلاع‌رسانی می‌شوند. */
      var adv=p.advisoryDependencies||[],advTxt=adv.length?('\n\n⚠️ اقلام مرتبط که با این حذف پاک نمی‌شوند و ممکن است یتیم بمانند ('+adv.length+' مورد):\n'+adv.slice(0,12).map(function(x){return '• '+x.type+' '+(x.id||'')+(x.amount?' — '+money(x.amount):'');}).join('\n')+(adv.length>12?'\n… و '+(adv.length-12)+' مورد دیگر':'')):'';
      if(!confirm('پیش‌بررسی حذف '+type+':\n'+(lines||'بدون وابستگی')+advTxt+(p.periodLocked?'\n\n⚠️ دوره مالی قفل است و با حذف، Snapshot نامعتبر و دوره باز می‌شود.':'')+'\n\nادامه؟'))return;
      var reason=prompt('دلیل حذف قطعی ادمین:','اشتباه ثبت/رکورد تکراری');if(reason===null||!reason.trim())return;
      command('admin_delete_commit',{entityType:type,entityId:id,cascade:deps.length>0,confirm:'PTF-ADMIN-HARD-DELETE',reason:reason.trim(),idempotencyKey:'HARD-DELETE|'+type+'|'+id},{
        onAck:function(r){toast('حذف اتمیک انجام و Tombstone ثبت شد'+((r.result||{}).invalidatedYear?'؛ دوره '+r.result.invalidatedYear+' باز شد':''),'warn');if(typeof onDone==='function')onDone(r);},
        onReject:function(e){alert('⛔ حذف انجام نشد: '+e.message);}
      });
    },function(e){alert('⛔ پیش‌بررسی حذف دریافت نشد: '+e.message);});
  };

  /* ----- Case financial workspace ----- */
  /* ممیزی v34.7.26: رکوردهای قدیمی ممکن است caseId را با `cd` پرونده ذخیره کرده باشند در
     حالی که کلید نمایش `_id||cd` است؛ نتیجه «ناپدید شدن» رسید/فاکتور در پنجرهٔ پرونده بود.
     نام‌های مستعار فقط از خود رکورد پرونده گرفته می‌شوند (بدون حدس). */
  function caseAliases(id) {
    var out = {}; var key = String(id || ''); if (key) out[key] = true;
    var c = data('ptf_crm_deals').filter(function (x) { return x && (String(x._id || '') === key || String(x.cd || '') === key); })[0];
    if (c) { [c._id, c.cd].forEach(function (a) { var k = String(a || ''); if (k) out[k] = true; }); }
    return out;
  }
  function caseReceipts(id) { var al = caseAliases(id); return data('ptf_crm_case_receipts').filter(function (r) { return r && al[String(r.caseId || '')]; }); }
  function caseInvoices(id) { var al = caseAliases(id); return data('ptf_crm_invoices').filter(function (i) { return i && al[String(i.caseId || '')]; }); }
  function activeAllocations(id) { var al = caseAliases(id); return data('ptf_crm_receipt_allocations').filter(function (a) { return a && al[String(a.caseId || '')] && active(a); }); }
  function caseTotals(c) {
    var rs=caseReceipts(caseId(c)).filter(function(r){return active(r)&&r.status==='posted';});
    var ins=caseInvoices(caseId(c)).filter(active);
    var received=rs.reduce(function(s,r){return s+(+r.amountIRR||+r.amt||0);},0);
    var allocated=rs.reduce(function(s,r){return s+(+r.allocatedIRR||0);},0);
    /* v34.7.18 (AR-INTEGRITY فاز ۳): مانده از منبع واحد PTF.ar خوانده می‌شود تا پنجرهٔ پرونده،
       پنل مطالبات و حساب مشتری همیشه یک عدد بدهند (قبلاً فقط openAmountIRR سرور ملاک بود و اگر
       تخصیص انجام/همگام نشده بود، پرونده و مطالبات دو رقم متفاوت نشان می‌دادند). */
    var arCore=(window.PTF||{}).ar;
    var open=ins.reduce(function(s,i){
      if(arCore&&typeof arCore.invoiceState==='function'){try{return s+arCore.invoiceState(i).open;}catch(eAr){}}
      return s+(i.openAmountIRR!=null?+i.openAmountIRR:Math.max(0,(+i.amount||0)-(+i.allocatedBase||0)-(+i.allocatedVat||0)));
    },0);
    if(arCore&&typeof arCore.caseState==='function'){
      try{var st=arCore.caseState(c);return {received:st.received,allocated:st.allocated,credit:st.credit,open:st.open,receipts:rs,invoices:st.invoices.length?st.invoices:ins};}catch(eSt){}
    }
    return {received:received,allocated:allocated,credit:Math.max(0,received-allocated),open:open,receipts:rs,invoices:ins};
  }
  window.ptfCaseFinanceOpen = function (id) {
    var c=findCase(id); if(!c){alert('پرونده یافت نشد');return;}
    var t=caseTotals(c), cid=caseId(c);
    var receipts=t.receipts.map(function(r){
      var acts=canFinance()?'<button class="bt bt-o" style="font-size:11px" onclick="ptfReceiptCorrectOpen(\''+arg(receiptId(r))+'\')">اصلاح</button> <button class="bt bt-o" style="font-size:11px;color:#b91c1c" onclick="ptfReceiptVoid(\''+arg(receiptId(r))+'\')">ابطال</button> ':'';
      if(role()==='admin')acts+='<button class="bt bt-o" style="font-size:11px;color:#b91c1c" onclick="ptfAdminHardDelete(\'receipt\',\''+arg(receiptId(r))+'\',function(){document.querySelectorAll(\'#ptfCaseFinanceDlg\').forEach(function(x){x.remove();});ptfCaseFinanceOpen(\''+arg(cid)+'\');})">حذف قطعی</button> ';
      acts+='<button class="bt bt-o" style="font-size:11px" onclick="ptfFinAttachOpen(\'receipt\',\''+arg(receiptId(r))+'\')">📎 اسناد</button>';
      return '<tr><td>'+esc(r.receivedAt||r.dateISO||'')+'</td><td>'+esc(r.method||r.how||'')+'</td><td>'+money(r.amountIRR||r.amt)+'</td><td>'+money(r.creditRemainIRR||0)+'</td><td>'+acts+'</td></tr>';
    }).join('')||'<tr><td colspan="5">دریافتی قطعی ثبت نشده است.</td></tr>';
    var invoices=t.invoices.map(function(i){return '<tr><td>'+esc(i.no||i.cd)+'</td><td>'+esc(i.invDate||'')+'</td><td>'+money(i.base||0)+'</td><td>'+money(i.vat||0)+'</td><td>'+money(i.openAmountIRR!=null?i.openAmountIRR:i.amount||0)+'</td></tr>';}).join('')||'<tr><td colspan="5">فاکتور فعالی ثبت نشده است.</td></tr>';
    document.querySelectorAll('#ptfCaseFinanceDlg').forEach(function(x){x.remove();});
    var html='<div class="md-b" id="ptfCaseFinanceDlg" style="display:grid;z-index:2900" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:980px;max-height:92vh;overflow:auto">'+
      '<h3>💳 دریافت و حساب پرونده — '+esc(c.inqNo||c.wonOffer||cid)+'</h3><div style="font-size:12px;color:#64748b">مشتری: <b>'+esc(c.buyerCo||'')+'</b> | مبنای مطالبات و تمام دریافت‌ها: <b>مبلغ ریالی فاکتور</b>.</div>'+
      '<div class="sr" style="margin:10px 0"><div class="sc"><b>'+money(t.received)+'</b><span>کل دریافت قطعی</span></div><div class="sc"><b>'+money(t.allocated)+'</b><span>تخصیص به فاکتور</span></div><div class="sc"><b>'+money(t.credit)+'</b><span>بستانکاری پرونده</span></div><div class="sc"><b>'+money(t.open)+'</b><span>مطالبات باز</span></div></div>'+
      (canFinance()?'<button class="bt" onclick="ptfReceiptOpen(\''+arg(cid)+'\')">+ ثبت دریافت قطعی</button> ':'')+(role()==='admin'?'<button class="bt bt-o" style="color:#b91c1c" onclick="ptfAdminHardDelete(\'case\',\''+arg(cid)+'\',function(){document.querySelectorAll(\'#ptfCaseFinanceDlg\').forEach(function(x){x.remove();});if(typeof renderDeals===\'function\')renderDeals();})">حذف قطعی پرونده</button> ':'')+'<button class="bt bt-o" onclick="ptfFinAttachOpen(\'sales_case\',\''+arg(cid)+'\')">📎 اسناد مالی پرونده</button>'+
      '<h4>دریافت‌ها</h4><div class="tb2"><table><thead><tr><th>تاریخ</th><th>روش</th><th>مبلغ</th><th>بستانکاری باقیمانده</th><th>عملیات</th></tr></thead><tbody>'+receipts+'</tbody></table></div>'+
      '<h4>فاکتورهای رسمی فعال</h4><div class="tb2"><table><thead><tr><th>شماره</th><th>تاریخ</th><th>پایه</th><th>ارزش افزوده</th><th>مطالبه باز</th></tr></thead><tbody>'+invoices+'</tbody></table></div>'+
      '<div style="text-align:left;margin-top:12px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend',html);
  };
  function customerCaseOptions(c,currentId){
    var cd=String((c&&c.buyerCd)||'');
    var all=data('ptf_crm_deals').filter(function(x){return x&&active(x)&&(String(x.buyerCd||'')===cd||caseId(x)===currentId);});
    if(!all.length)all=[c];
    return all.map(function(x){var id=caseId(x);return '<option value="'+esc(id)+'"'+(id===currentId?' selected':'')+'>'+esc((x.inqNo||x.wonOffer||id)+(x.buyerCo?' — '+x.buyerCo:''))+'</option>';}).join('');
  }
  window.ptfReceiptOpen = function (cid, existing) {
    if(!canFinance()){alert('⛔ فقط کاربران مالی مجازند');return;}
    var c=findCase(cid);if(!c)return;
    ptfDialog({title:(existing?'اصلاح':'ثبت')+' دریافت قطعی ریالی — '+(c.inqNo||c.wonOffer||''),body:'مبنای مطالبات مبلغ ریالی فاکتور است و تمام دریافت‌ها فقط به ریال ثبت می‌شوند. چک از ماژول چک ثبت و فقط پس از وصول به دریافت قطعی تبدیل می‌شود.',fields:[
      {id:'amt',label:'مبلغ دریافتی (ریال) *',type:'number',required:true,dir:'ltr',value:existing?existing.amountIRR:''},
      {id:'date',label:'تاریخ دریافت (شمسی) *',datePicker:true,value:existing?existing.receivedAt:(typeof faDate==='function'?faDate():'')},
      {id:'method',label:'روش دریافت *',type:'select',value:existing?existing.method:'bank_transfer',options:[{v:'bank_transfer',lb:'حواله بانکی'},{v:'cash',lb:'نقد'}]},
      {id:'account',label:'حساب/صندوق مقصد *',required:true,value:existing?existing.destinationAccount:''},
      {id:'ref',label:'شماره مرجع/پیگیری',value:existing?existing.referenceNo:''},
      {id:'note',label:'توضیح',type:'textarea',rows:2,value:existing?existing.note:''}
    ].concat(existing?[
      /* v34.7.18 (AR-INTEGRITY فاز ۲ / R7): انتقال بستانکاری به پروندهٔ دیگرِ همان مشتری.
         مسیر رسمی «اصلاح» استفاده می‌شود (سند ابطال + سند جدید)؛ هیچ رکورد پولی حذف نمی‌شود. */
      {id:'targetCase',label:'پروندهٔ مقصد (برای انتقال بستانکاری)',type:'select',value:caseId(c),optionsHtml:customerCaseOptions(c,caseId(c))},
      {id:'reason',label:'دلیل اصلاح *',type:'textarea',required:true,rows:2}
    ]:[]),okText:existing?'ثبت اصلاحیه':'ثبت دریافت',onOk:function(v){
      var payload={caseId:caseId(c),amountIRR:num(v.amt),receivedAt:v.date,method:v.method,destinationAccount:v.account,referenceNo:v.ref,note:v.note};
      if(existing){payload.receiptId=receiptId(existing);payload.reason=v.reason;if(v.targetCase&&v.targetCase!==caseId(c))payload.caseId=v.targetCase;}
      command(existing?'correct_receipt':'post_receipt',payload,{onAck:function(){toast(existing?'دریافت با سند معکوس اصلاح شد':'دریافت قطعی ریالی ثبت شد','ok');document.querySelectorAll('#ptfCaseFinanceDlg').forEach(function(x){x.remove();});window.ptfCaseFinanceOpen(caseId(c));if(typeof ptfTreasuryRender==='function')ptfTreasuryRender();},onReject:function(e){var map={fiscal_period_locked:'دوره مالی قفل است',cheque_requires_collection:'چک باید ابتدا در ماژول چک وصول شود'};alert('⛔ '+(map[e.message]||e.message));}});
    }});
  };
  window.ptfReceiptCorrectOpen = function (id) { var r=data('ptf_crm_case_receipts').filter(function(x){return receiptId(x)===String(id);})[0];if(r)window.ptfReceiptOpen(r.caseId,r); };
  window.ptfReceiptVoid = function (id) { var r=data('ptf_crm_case_receipts').filter(function(x){return receiptId(x)===String(id);})[0];if(!r)return;var reason=prompt('دلیل ابطال دریافت:', 'اشتباه ثبت');if(reason===null||!reason.trim())return;command('void_receipt',{receiptId:id,reason:reason.trim()},{onAck:function(){toast('دریافت ابطال و اثر خزانه/تخصیص بازسازی شد','ok');document.querySelectorAll('#ptfCaseFinanceDlg').forEach(function(x){x.remove();});window.ptfCaseFinanceOpen(r.caseId);if(typeof ptfTreasuryRender==='function')ptfTreasuryRender();},onReject:function(e){alert('⛔ '+e.message);}}); };

  /* ----- INV-01 (v34.7.23 / فاز E): ابطال سروری صورتحساب غیررسمی -----
     مسیر واحد و اتمیک: سرور سند را void می‌کند، تخصیص‌های همان پرونده را با قواعد قطعی
     بازسازی می‌کند و مبلغ آزادشده به بستانکاری همان پرونده برمی‌گردد. رسید هرگز حذف نمی‌شود.
     آثار غیرمالیِ محلی (ابطال مرجوعی‌های متصل، جداکردن ضمیمه از پرونده، timeline) پس از
     تأیید سرور و توسط ماژول غیررسمی انجام می‌شوند. */
  window.ptfUnofficialInvoiceVoidServer = function (invoiceId, reason) {
    if (!canFinance()) return Promise.reject(new Error('permission_denied'));
    return api('void_unofficial_invoice', {
      invoiceId: String(invoiceId || ''),
      reason: String(reason || ''),
      idempotencyKey: 'VOID-UNOFFICIAL|' + String(invoiceId || '') + '|' + String(reason || '').slice(0, 40)
    }).then(function (d) { return (d && d.result) || {}; });
  };

  /* ----- Universal financial attachment manager for non-mandatory records. ----- */
  function ownerAttachments(type,id){return data('ptf_crm_fin_attachments').filter(function(a){return a&&a.ownerType===type&&a.ownerId===id&&active(a);});}
  window.ptfFinAttachOpen=function(type,id){
    if(!id)return;document.querySelectorAll('#ptfFinAttachDlg').forEach(function(x){x.remove();});var rows=ownerAttachments(type,id).map(function(a){return '<div style="display:flex;justify-content:space-between;gap:8px;padding:7px 0;border-bottom:1px dashed var(--brd)"><span>📎 '+esc(a.name||a.objectKey)+'<br><small>'+esc(a.category||'سند مالی')+' — '+esc(a.uploadedAt||'')+'</small></span><span><button class="bt bt-o" style="font-size:11px" onclick="openStoredFile(\''+arg(a.objectKey)+'\',\''+arg(a.name||'')+'\')">مشاهده</button> '+(canFinance()?'<button class="bt bt-o" style="font-size:11px" onclick="ptfFinAttachReplace(\''+arg(a._id)+'\',\''+arg(type)+'\',\''+arg(id)+'\')">اصلاح/جایگزینی</button> <button class="bt bt-o" style="font-size:11px;color:#b91c1c" onclick="ptfFinAttachDelete(\''+arg(a._id)+'\',\''+arg(type)+'\',\''+arg(id)+'\')">حذف</button>':'')+'</span></div>';}).join('')||'<div style="color:#94a3b8">سندی ثبت نشده است.</div>';
    var html='<div class="md-b" id="ptfFinAttachDlg" style="display:grid;z-index:3100" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:620px"><h3>📎 اسناد مالی رکورد</h3>'+rows+(canFinance()?'<div class="fld"><label>نوع/شرح سند</label><input id="ptfFinAttCat" value="supporting_document"></div><div id="ptfFinAttUp" style="border:1px dashed var(--brd);border-radius:10px;padding:8px"></div>':'')+'<div style="text-align:left;margin-top:10px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';document.getElementById('panels').insertAdjacentHTML('beforeend',html);
    if(canFinance()&&typeof attachUploadWidget==='function')attachUploadWidget('ptfFinAttUp','financial/'+type+'/'+id,function(f){var cat=((document.getElementById('ptfFinAttCat')||{}).value||'supporting_document').trim();command('attachment_add',{ownerType:type,ownerId:id,category:cat,file:f},{onAck:function(){toast('سند به خود رکورد متصل شد','ok');window.ptfFinAttachOpen(type,id);},onReject:function(e){deleteFinancialObject(f.key,function(){});alert('⛔ اتصال سند رد شد و فایل موقت پاک شد: '+e.message);},onUncertain:function(e){alert('⚠️ نتیجه اتصال سند نامشخص است؛ فایل برای بازیابی پاک نشد. شناسه پیگیری: '+e.operationId);}});});
  };
  window.ptfFinAttachReplace=function(attId,type,id){var reason=prompt('دلیل اصلاح/جایگزینی سند:','فایل صحیح جایگزین می‌شود');if(reason===null||!reason.trim())return;document.querySelectorAll('#ptfFinReplaceDlg').forEach(function(x){x.remove();});var html='<div class="md-b" id="ptfFinReplaceDlg" style="display:grid;z-index:3400" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:480px"><h3>جایگزینی نسخه‌دار سند مالی</h3><div id="ptfFinReplaceUp" style="border:1px dashed var(--brd);border-radius:9px;padding:8px"></div><button class="bt bt-o" style="margin-top:8px" onclick="this.closest(\'.md-b\').remove()">انصراف</button></div></div>';document.getElementById('panels').insertAdjacentHTML('beforeend',html);if(typeof attachUploadWidget==='function')attachUploadWidget('ptfFinReplaceUp','financial/'+type+'/'+id+'/replacements',function(f){command('attachment_replace',{attachmentId:attId,ownerType:type,ownerId:id,reason:reason.trim(),file:f},{onAck:function(){toast('نسخه جدید فعال و نسخه قبل در تاریخچه نگهداری شد','ok');document.querySelectorAll('#ptfFinReplaceDlg').forEach(function(x){x.remove();});window.ptfFinAttachOpen(type,id);},onReject:function(e){deleteFinancialObject(f.key,function(){});alert('⛔ جایگزینی رد شد؛ نسخه قبلی فعال ماند و فایل موقت پاک شد: '+e.message);},onUncertain:function(e){alert('⚠️ نتیجه جایگزینی نامشخص است؛ فایل جدید برای reconciliation پاک نشد. شناسه پیگیری: '+e.operationId);}});});};
  function deleteFinancialObject(key,cb){fetch('../api/storage.php?action=delete_financial',{method:'POST',headers:authHeaders(),body:JSON.stringify({key:key})}).then(function(r){return r.json().then(function(d){if(!r.ok||!d.ok)throw new Error(d.error||('HTTP '+r.status));return d;});}).then(function(d){cb({ok:true,data:d});}).catch(function(e){cb({ok:false,error:e.message||'حذف ابری ناموفق'});});}
  window.ptfFinAttachDelete=function(attId,type,id){var reason=prompt('دلیل حذف سند مالی:','فایل اشتباه');if(reason===null||!reason.trim())return;var a=data('ptf_crm_fin_attachments').filter(function(x){return x&&x._id===attId;})[0];if(!a)return;if(!confirm('ابتدا حذف رکورد مالی روی سرور قطعی و سپس فایل ابری پاک شود؟ Metadata حسابرسی باقی می‌ماند.'))return;command('attachment_delete',{attachmentId:attId,ownerType:type,ownerId:id,reason:reason.trim()},{onAck:function(){deleteFinancialObject(a.objectKey,function(res){toast(res.ok?'Tombstone مالی ثبت و فایل ابری حذف شد':'Tombstone مالی ثبت شد؛ پاک‌سازی فایل ابری نیاز به بررسی دارد: '+res.error,res.ok?'warn':'warn');window.ptfFinAttachOpen(type,id);});},onReject:function(e){alert('⛔ حذف سند رد شد و فایل ابری دست‌نخورده ماند: '+e.message);},onUncertain:function(e){alert('⚠️ نتیجه حذف سند نامشخص است؛ فایل ابری عمداً پاک نشد. شناسه پیگیری: '+e.operationId);}});};

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
  /* v34.7.16: وقتی سرور در plan اعلام کند که هویت دو پرونده ناسازگار است، به‌جای اینکه
     کاربر فقط هنگام commit با case_identity_conflict مواجه شود، دکمه را مسدود و علت را
     صریح نشان می‌دهیم. commit همچنان با گارد سرور fail-closed محافظت می‌شود. */
  window.ptfDuplicateCaseMergeBlocked=function(field){
    var btn=document.getElementById('dupMergeBtn');
    var fieldLabel={inqNo:'درخواست',buyerCd:'کد مشتری',buyerCo:'نام مشتری',currency:'ارز'}[field]||field||'هویت';
    if(btn){btn.disabled=true;btn.textContent='ادغام مسدود است';}
    var guide=document.getElementById('ptfSalesFindingGuide');
    if(guide){
      var slot=document.createElement('div');
      slot.style.cssText='background:#fee2e2;color:#991b1b;border-radius:10px;padding:10px;margin-top:12px;font-size:12px;line-height:1.9';
      slot.textContent='⛔ این دو پرونده از نظر '+fieldLabel+' یکسان نیستند؛ ادغام خودکار برای جلوگیری از ترکیب پروندهٔ اشتباه مسدود شد. ابتدا دادهٔ '+fieldLabel+' را در پرونده‌ها اصلاح کنید، سپس دوباره بررسی کنید.';
      guide.insertBefore(slot,guide.firstChild);
    }
  };
  window.ptfDuplicateCaseKeepChanged=function(){var k=(document.getElementById('dupKeep')||{}).value,r=document.getElementById('dupRemove');if(!r)return;var opts=Array.prototype.slice.call(r.options).filter(function(o){return o.value&&o.value!==k;});if(opts.length===1)r.value=opts[0].value;};
  window.ptfDuplicateCaseMergeCommit=function(no,planHash){
    if(!canRepairOfferWin()){alert('فقط ادمین یا رئیس هیئت‌مدیره مجاز است');return;}
    var _dupBtn=document.getElementById('dupMergeBtn');if(_dupBtn&&_dupBtn.disabled){alert('⛔ ادغام این دو پرونده به دلیل ناسازگاری هویت مسدود است.');return;}
    var keep=(document.getElementById('dupKeep')||{}).value||'',remove=(document.getElementById('dupRemove')||{}).value||'',reason=((document.getElementById('dupReason')||{}).value||'').trim(),confirmWord=((document.getElementById('dupConfirm')||{}).value||'').trim();
    if(!keep||!remove||keep===remove){alert('پرونده اصلی و پرونده تکراری را جداگانه انتخاب کنید');return;}if(!reason){alert('دلیل ادغام الزامی است');return;}if(confirmWord!=='ادغام'){alert('برای جلوگیری از اشتباه، کلمه «ادغام» را دقیق وارد کنید');return;}
    var btn=document.getElementById('dupMergeBtn');if(btn){btn.disabled=true;btn.textContent='در حال پیش‌بررسی و ثبت اتمیک…';}
    command('duplicate_case_merge',{offerNo:no,keepCaseId:keep,removeCaseId:remove,reason:reason,planHash:planHash,confirm:'PTF-DUPLICATE-CASE-MERGE',idempotencyKey:'MERGE-DUP-CASE|'+no+'|'+keep+'|'+remove+'|'+String(planHash).slice(0,16)},{
      onAck:function(d){var r=d.result||{},m=r.movedReferences||{};closeFindingGuide();toast('پرونده‌ها بدون حذف شواهد ادغام شدند؛ '+Object.keys(m).reduce(function(s,k){return s+(+m[k]||0);},0)+' ارجاع مرتبط منتقل شد','ok');if(typeof renderOffers==='function')renderOffers();if(typeof renderDeals==='function')renderDeals();if(typeof ptfDataQualityRender==='function')ptfDataQualityRender();},
      onReject:function(e){var map={duplicate_case_plan_stale:'داده از زمان بازکردن راهنما تغییر کرده است؛ راهنما را ببندید و دوباره باز کنید.',case_identity_conflict:'هویت دو پرونده متفاوت است؛ ادغام خودکار متوقف شد تا پرونده اشتباه ترکیب نشود.',duplicate_case_not_found:'سرور دیگر دو پرونده مرتبط نمی‌بیند؛ ابتدا همگام‌سازی کنید.'};alert('⛔ '+(map[e.message]||e.message));},
      onFinally:function(outcome){if(outcome.state!=='acked'&&btn){btn.disabled=false;btn.textContent='پیش‌بررسی نهایی و ادغام کنترل‌شده';}}
    });
  };
  window.ptfSalesFindingGuideOpen=function(id){
    var f=findingById(id);if(!f){alert('این یافته پس از تازه‌سازی دیگر وجود ندارد');return;}
    if(f.type!=='duplicate_case'){insertFindingGuide(genericFindingGuide(f),'راهنمای بررسی و رفع یافته');return;}
    if(!canRepairOfferWin()){insertFindingGuide(genericFindingGuide(f)+'<div style="color:#b45309;margin-top:8px">نمایش جزئیات و ادغام پرونده فقط برای ادمین یا رئیس هیئت‌مدیره مجاز است.</div>','راهنمای پرونده تکراری');return;}
    insertFindingGuide('<div style="padding:24px;text-align:center">در حال دریافت پیش‌بررسی بدون تغییر از سرور…</div>','راهنمای پرونده تکراری');
    var openPlan=function(){
      api('duplicate_case_plan',{offerNo:f.offerNo}).then(function(d){
        var plan=d.plan||{};
        insertFindingGuide(duplicateCaseGuide(f,plan),'رفع گام‌به‌گام پرونده‌های تکراری — '+f.offerNo);
        /* v34.7.16: اگر سرور دو پرونده را از نظر هویت ناسازگار اعلام کرد، پیش از commit
           دکمه را مسدود و علت را صریح نشان می‌دهیم؛ گارد سرور همچنان fail-closed می‌ماند. */
        if(plan.mergeable===false)window.ptfDuplicateCaseMergeBlocked(plan.conflictField||'');
      }).catch(function(e){insertFindingGuide('<div style="background:#fee2e2;color:#991b1b;border-radius:10px;padding:12px;margin-top:12px">پیش‌بررسی سرور دریافت نشد: '+esc(e.message)+'</div>','راهنمای پرونده تکراری');});
    };
    /* v34.7.16: پیش از plan، یک pull فقط‌خواندنی می‌زنیم تا یافته/کش محلی با دادهٔ سرور هم‌راستا
       شود؛ در غیر این صورت ممکن است ادغام روی داده‌ای که سرور دیگر آن را ندارد اجرا شود. */
    if(typeof window.ptfSyncPullNow==='function')window.ptfSyncPullNow(function(){openPlan();});
    else openPlan();
  };

  /* اصلاح برد فقط از مرز فرمان سرور انجام می‌شود؛ مسیر قدیمی backup.js که localStorage
     و projects قدیمی را مستقیم تغییر می‌داد، در داده واقعی می‌توانست deal را یتیم کند. */
  window.ptfRevokeOfferWin=function(no){
    if(!canRepairOfferWin()){alert('فقط ادمین یا رئیس هیئت‌مدیره مجاز به بازگرداندن برد است');return;}
    var reason=prompt('دلیل بازگرداندن پیشنهاد برنده به وضعیت قبل:','برد اشتباه / نیاز به اصلاح پیشنهاد');
    if(reason===null||!reason.trim())return;
    if(!confirm('⚠️ سرور ابتدا پرونده، فاکتور و سایر وابستگی‌ها را بررسی می‌کند. فقط برد بدون وابستگی بازگردانده می‌شود. ادامه می‌دهید؟'))return;
    command('revoke_orphan_delete',{offerNo:no,delete:false,reason:reason.trim(),idempotencyKey:'REVOKE-WIN|'+no+'|'+Date.now()},{
      onAck:function(){toast('برد کنترل‌شده لغو و پیشنهاد به وضعیت قبل بازگردانده شد','ok');if(typeof renderOffers==='function')renderOffers();if(typeof ptfDataQualityRender==='function')ptfDataQualityRender();},
      onReject:function(e){if(e.payload&&e.payload.dependencies)alert('⛔ این پیشنهاد وابستگی عملیاتی دارد و بازگشت خودکار متوقف شد:\n'+e.payload.dependencies.map(function(x){return x.type+' '+x.id;}).join('\n')+'\n\nابتدا وابستگی‌ها را از پرونده مربوط بررسی و اصلاح کنید.');else alert('⛔ '+e.message);}
    });
  };
  window.ptfRepairOrphanOffer=function(no){if(role()!=='admin'){alert('حذف پیشنهاد فقط برای ادمین مجاز است');return;}var reason=prompt('برد این پیشنهاد لغو و خود پیشنهاد حذف شود. دلیل:','برد اشتباه و پرونده تشکیل نشده');if(reason===null||!reason.trim())return;if(!confirm('⚠️ پس از پیش‌بررسی سرور، برد لغو و پیشنهاد با Tombstone حذف شود؟'))return;command('revoke_orphan_delete',{offerNo:no,delete:true,reason:reason.trim()},{onAck:function(){toast('برد یتیم لغو و پیشنهاد حذف شد','ok');if(typeof renderOffers==='function')renderOffers();if(typeof ptfDataQualityRender==='function')ptfDataQualityRender();},onReject:function(e){if(e.payload&&e.payload.dependencies)alert('⛔ وابستگی وجود دارد:\n'+e.payload.dependencies.map(function(x){return x.type+' '+x.id;}).join('\n'));else alert('⛔ '+e.message);}});};
  window.ptfSalesMigrationOpen=function(){
    if(role()!=='admin'){alert('فقط ادمین مجاز است');return;}
    api('migration_dry_run',{idempotencyKey:'DRYRUN|'+Date.now()}).then(function(d){var r=d.report||{},issues=r.issues||[],safe=r.safeReceiptCandidates||[];document.querySelectorAll('#ptfSalesMigrationDlg').forEach(function(x){x.remove();});var html='<div class="md-b" id="ptfSalesMigrationDlg" style="display:grid;z-index:3500" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:900px;max-height:94vh;overflow:auto"><h3>مهاجرت کنترل‌شده فروش تا وصول v35</h3><div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:9px;font-size:12px">فقط payments[] واقعی، غیرچکی و دارای پرونده یکتا منتقل می‌شود. paid/cashFull بدون رویداد و همه موارد مبهم هیچ اثر مالی نمی‌گیرند.</div><div class="sr" style="margin:9px 0"><div class="sc"><b>'+safe.length+'</b><span>وصول قابل مهاجرت امن</span></div><div class="sc"><b>'+issues.length+'</b><span>مورد مبهم/نیازمند بررسی</span></div></div><h4>موارد مبهم</h4><div style="font-size:12px">'+(issues.map(function(x){return'<div style="padding:4px;border-bottom:1px dashed var(--brd)">'+esc(x.type)+' — '+esc(x.ref||'')+(x.amount?' — '+money(x.amount):'')+'</div>';}).join('')||'موردی نیست')+'</div><h4>وصول‌های امن پیشنهادی</h4><div style="font-size:12px">'+(safe.map(function(x){return'<div style="padding:4px;border-bottom:1px dashed var(--brd)">'+esc(x.offerNo)+' — '+money(x.amount)+' — '+esc(x.paymentRef||'')+'</div>';}).join('')||'موردی نیست')+'</div><div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">انصراف</button><button class="bt" '+(safe.length?'':'disabled')+' onclick="ptfSalesMigrationCommit()">بک‌آپ را تأیید می‌کنم — اجرای موارد امن</button></div></div></div>';document.getElementById('panels').insertAdjacentHTML('beforeend',html);}).catch(function(e){alert('⛔ گزارش مهاجرت دریافت نشد: '+e.message);});
  };
  window.ptfSalesMigrationCommit=function(){if(!confirm('فقط موارد بدون ابهام مهاجرت شوند؟ موارد مشکوک دست‌نخورده و در کیفیت داده باقی می‌مانند.'))return;command('migration_apply_safe',{confirm:'PTF-SALES-V35-MIGRATE',idempotencyKey:'MIGRATE-SALES-V35'},{onAck:function(d){toast((d.result||{}).migratedReceipts+' وصول واقعی مهاجرت شد؛ موارد مبهم دست‌نخورده ماند','ok');document.querySelectorAll('#ptfSalesMigrationDlg').forEach(function(x){x.remove();});if(typeof ptfDataQualityRender==='function')ptfDataQualityRender();},onReject:function(e){alert('⛔ مهاجرت متوقف شد: '+e.message);}});};
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
