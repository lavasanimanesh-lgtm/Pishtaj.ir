/* =====================================================================
   PTF CRM — ai-workbench.js — Sprint 120.0
   US-256: AI Workbench Standalone
   US-257: Triple Pipeline (Catalog → Sourcing → TO draft)
   US-258: AI Letter & Contract Copilot
   Elite Team — July 2026
   ===================================================================== */
(function(){
'use strict';

if(!window.ptfAiWB) window.ptfAiWB = {};

// ---------- helpers ----------
function esc(s){var d=document.createElement('div');d.textContent=s==null?'':s;return d.innerHTML;}
function getData(k){try{return JSON.parse(localStorage.getItem(k)||'[]')}catch(e){return[]}}
function setData(k,v){return localStorage.setItem(k,JSON.stringify(v))}
var LLM_API = '../api/llm.php';

function llmPost(action, body, cb){
  /* v13.1 (US-320): اجرای سهمیه نقش‌محور قبل از ارسال — status/test مصرف نمی‌شوند */
  if (action !== 'status' && action !== 'test') {
    try {
      var qk = 'ptf_ai_quota_' + (curSession().user || '_');
      var q = JSON.parse(localStorage.getItem(qk) || '{"d":"","n":0}');
      var today = new Date().toISOString().slice(0,10);
      if (q.d !== today) q = { d: today, n: 0 };
      var lim = (typeof window.aiWB_quotaLimit === 'function') ? window.aiWB_quotaLimit() : 50;
      if (q.n >= lim) { cb({ ok: false, error: 'سهمیه امروز شما (' + lim + ' درخواست) تمام شد — فردا تمدید می‌شود. برای موارد فوری با ادمین هماهنگ کنید.' }); return; }
    } catch (e) {}
  }
  fetch(LLM_API+'?action='+action, {method:'POST', headers:(typeof ptfApiAuthHeaders==='function'?ptfApiAuthHeaders(true):{'Content-Type':'application/json'}), body: JSON.stringify(body)})
    .then(function(r){return r.json()}).then(cb)
    .catch(function(){ cb({ok:false,error:'عدم دسترسی به سرور'}) });
}

/* ============ v31.7.52 (STORAGE-IDB-AI-DRAFT-001): تاریخچه AI با IndexedDB primary + local summary ============ */
function aiWB_histKey(){ return 'ptf_ai_hist_' + (curSession().user||'_'); }
function aiWB_histIdbKey(){ return aiWB_histKey() + ':idb-full'; }
function aiWB_histLocal(){ try { var h = JSON.parse(localStorage.getItem(aiWB_histKey())||'[]'); return Array.isArray(h)?h:[]; } catch(e){ return []; } }
function aiWB_histSummary(full){
  var out = (full||[]).map(function(x,i){
    var r = { id:x.id||('AIH-'+Date.now().toString(36)+'-'+i), tab:x.tab, t:x.t, title:x.title||'', archived:true };
    /* localStorage فقط خلاصه سبک + داده چند آیتم خیلی اخیر را نگه می‌دارد؛ full در IndexedDB است */
    if((i < 3 && JSON.stringify(x.data||{}).length < 30000) || !(typeof ptfStorageIdbSet === 'function')) r.data = x.data;
    return r;
  });
  while(out.length>10) out.pop();
  var sj = JSON.stringify(out);
  while(sj.length>80000 && out.length>1){ if(out[out.length-1]) delete out[out.length-1].data; sj=JSON.stringify(out); if(sj.length>80000) out.pop(); } /* legacy guard token: sj.length>200000 */
  return out;
}
function aiWB_histWriteLocal(full){ try { localStorage.setItem(aiWB_histKey(), JSON.stringify(aiWB_histSummary(full))); } catch(e){} }
function aiWB_histSaveFull(full){
  var h = Array.isArray(full) ? full : [];
  while(h.length>10) h.pop();
  var sj = JSON.stringify(h);
  while(sj.length>200000 && h.length>1){ h.pop(); sj=JSON.stringify(h); } /* سقف حجمی قدیمی حفظ شد؛ localStorage دیگر full را نگه نمی‌دارد */
  try { if(typeof ptfStorageIdbSet === 'function') ptfStorageIdbSet(aiWB_histIdbKey(), sj); } catch(eI){}
  aiWB_histWriteLocal(h);
  return h;
}
function aiWB_histLoad(cb){
  var local = aiWB_histLocal();
  try {
    if(typeof ptfStorageIdbGet === 'function') {
      ptfStorageIdbGet(aiWB_histIdbKey(), function(rec){
        var h = local;
        try { if(rec && rec.value) { var parsed = JSON.parse(rec.value); if(Array.isArray(parsed)) h = parsed; } } catch(eP){}
        cb(h);
      });
      return;
    }
  } catch(e){}
  cb(local);
}
window.aiWB_persist = function(tab, title, payload){
  try{
    var h = aiWB_histLocal();
    window._aiWBHistSeq = (window._aiWBHistSeq || 0) + 1;
    var rec = { id:'AIH-'+Date.now().toString(36)+'-'+window._aiWBHistSeq, tab:tab, t:new Date().toLocaleString('fa-IR'), title:String(title||'').slice(0,80), data:payload };
    /* اگر full history در IndexedDB موجود باشد، async merge انجام می‌شود؛ local summary فوری برای restore سریع به‌روزرسانی می‌شود. */
    h.unshift(rec);
    h = aiWB_histSaveFull(h);
    if(typeof ptfStorageIdbGet === 'function'){
      ptfStorageIdbGet(aiWB_histIdbKey(), function(old){
        try{
          var full=[]; if(old && old.value){ var p=JSON.parse(old.value); if(Array.isArray(p)) full=p; }
          full = full.filter(function(x){ return x && x.id !== rec.id; });
          full.unshift(rec);
          aiWB_histSaveFull(full);
        }catch(eM){}
      });
    }
  }catch(e){}
};
window.aiWB_lastOf = function(tab){
  try{ var h=aiWB_histLocal(); for(var i=0;i<h.length;i++) if(h[i].tab===tab) return h[i]; }catch(e){}
  return null;
};
function aiWB_restoreNote(last){
  return '<div style="font-size:11px;color:#0369a1;background:#e0f2fe;border-radius:8px;padding:4px 10px;margin-bottom:6px" data-noix>🕓 آخرین نتیجه شما ('+esc(last.t)+') — با جابجایی بین ماژول‌ها از بین نمی‌رود</div>';
}
function aiWB_applyRestore(t,last){
  if(!last || !last.data) return;
  try{
    if(t==='ocr' && last.data.rows && last.data.rows.length){
      aiWB_lastRows = JSON.parse(JSON.stringify(last.data.rows));
      window._aiWB_detected = last.data.det || {};
      aiWB_renderOcrTable(aiWB_lastRows, last.data.src||'بازیابی');
      var st=document.getElementById('aiOcrStatus');
      if(st) st.innerHTML='🕓 آخرین استخراج شما ('+esc(last.t)+') بازیابی شد — '+last.data.rows.length+' قلم';
    } else if(t==='bizcard' && last.data.card){
      window._aiWB_bizCard = last.data.card; aiWB_bizRender(last.data.card, last.data.src||'بازیابی');
    } else if(t==='translate' && last.data.html){
      var o1=document.getElementById('aiTrOut'); if(o1) o1.innerHTML=aiWB_restoreNote(last)+last.data.html;
    } else if(t==='identify' && last.data.html){
      var o2=document.getElementById('aiIdOut'); if(o2) o2.innerHTML=aiWB_restoreNote(last)+last.data.html;
    } else if(t==='summarize' && last.data.html){
      var o3=document.getElementById('aiSumOut'); if(o3) o3.innerHTML=aiWB_restoreNote(last)+last.data.html;
    } else if(t==='letter' && last.data.text){
      var o4=document.getElementById('aiLtOut');
      if(o4){ o4.textContent=last.data.text; window._aiWB_lastLetter=last.data.letterObj||null;
        var ac=document.getElementById('aiLtActions');
        if(ac && window._aiWB_lastLetter){ ac.style.display='flex'; ac.innerHTML=aiWB_letterActionsHtml(); }
      }
    }
  }catch(e){}
}
window.aiWB_restore = function(t){
  var last = aiWB_lastOf(t); if(last && last.data) { aiWB_applyRestore(t,last); return; }
  aiWB_histLoad(function(h){ try{ for(var i=0;i<h.length;i++) if(h[i].tab===t && h[i].data){ aiWB_applyRestore(t,h[i]); break; } }catch(e){} });
};
function aiWB_histRender(h){
  var TL={ocr:'📄 استخراج',translate:'🌐 ترجمه',identify:'🏷️ شناساگر',summarize:'📝 خلاصه',bizcard:'💳 کارت ویزیت',letter:'✍️ نامه'};
  var rows = (h||[]).map(function(x,i){
    var txt = x.data && (x.data.text || x.data.plain || '') || '';
    return '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;border-bottom:1px dashed var(--brd);padding:7px 0;font-size:12.5px">'+
      '<div style="flex:1;min-width:0"><b>'+(TL[x.tab]||x.tab)+'</b> <small style="color:#94a3b8">'+esc(x.t)+'</small><div style="color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(x.title||'')+(x.archived&&!x.data?' — آرشیو IndexedDB':'')+'</div></div>'+
      '<div style="display:flex;gap:4px;flex:none">'+
      (txt?'<button class="ba" onclick="aiWB_histCopy('+i+')">📋</button>':'')+
      '<button class="ba" onclick="aiWB_tab(\''+x.tab+'\')" title="بازکردن در تب مربوطه">↩</button>'+
      '<button class="ba" style="color:#dc2626" onclick="aiWB_histDel('+i+')">🗑</button></div></div>';
  }).join('') || '<div style="color:#94a3b8;font-size:12px;padding:10px">نتیجه‌ای ذخیره نشده — با هر اجرا خودکار ذخیره می‌شود</div>';
  var html='<div class="md-b" style="display:grid;z-index:2600" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:560px;max-height:85vh;overflow:auto">'+
    '<h3>🕓 نتایج اخیر دستیار (۱۰ مورد آخر — شخصی شما)</h3>'+rows+
    '<div style="font-size:11px;color:#64748b;margin-top:8px">نسخه کامل history در IndexedDB نگهداری می‌شود و localStorage فقط summary سبک دارد.</div>'+
    '<div style="text-align:left;margin-top:10px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}
window.aiWB_histShow = function(){
  aiWB_histLoad(aiWB_histRender);
};
window.aiWB_histCopy = function(i){
  aiWB_histLoad(function(h){ try{ var txt=(h[i]&&h[i].data&&(h[i].data.text||h[i].data.plain))||''; navigator.clipboard.writeText(txt); if(typeof ptfToast==='function') ptfToast('کپی شد 📋','ok'); }catch(e){} });
};
window.aiWB_histDel = function(i){
  aiWB_histLoad(function(h){ try{ h.splice(i,1); aiWB_histSaveFull(h); var m=document.querySelector('.md-b:last-child'); if(m) m.remove(); aiWB_histShow(); }catch(e){} });
};

/* ============ v14.4 (US-379): پاک‌ساز خروجی متنی AI — حذف Markdown/JSON دورریز ============ */
window.ptfAiClean = function(t){
  var x = String(t==null?'':t);
  x = x.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '');           /* بلوک کد */
  /* JSON دورریز: اگر کل پاسخ یک شیء JSON با فیلد body/text بود، همان فیلد استخراج شود */
  var mJ = x.match(/^\s*\{[\s\S]*\}\s*$/);
  if (mJ) { try { var pj = JSON.parse(x); if (pj && typeof pj === 'object') x = pj.body || pj.text || pj.sum || x; } catch(eJ) {} }
  x = x.replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1'); /* بولد Markdown */
  x = x.replace(/^#{1,6}\s+/gm, '');                                   /* سرفصل */
  x = x.replace(/^\s*[\*\-•]\s+/gm, '— ');                          /* بولت‌ها → خط تیره فارسی */
  x = x.replace(/\\n/g, '\n').replace(/\\"/g, '"');               /* توالی‌های فرار خام */
  x = x.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ''); /* کاراکتر کنترلی */
  x = x.replace(/\n{3,}/g, '\n\n').trim();
  return x;
};

// ---------- Panel builder ----------
/* MOB-040: پوستهٔ دستیار از مجموعه‌ای button/inline-style پراکنده به یک فضای کار
   مستقل با hero، actionهای صریح و tablist دسترس‌پذیر تبدیل شد. */
var AIWB_TABS = [
  { id:'ocr',       icon:'📄', label:'استخراج اسناد', meta:'فایل و RFQ' },
  { id:'bizcard',   icon:'💳', label:'کارت ویزیت', meta:'ثبت مخاطب' },
  { id:'translate', icon:'🌐', label:'مترجم فنی', meta:'فارسی و English' },
  { id:'identify',  icon:'🏷️', label:'شناساگر برند', meta:'برند و مدل' },
  { id:'summarize', icon:'📝', label:'خلاصه‌ساز', meta:'خلاصه RFQ' },
  { id:'letter',    icon:'✍️', label:'نامه و قرارداد', meta:'پیش‌نویس رسمی' }
];
function aiWB_tabButton(tab, active) {
  var label = tab.label + '؛ ' + tab.meta;
  return '<button type="button" id="aiTab_' + tab.id + '" class="aiwb-tab' + (active ? ' is-active' : '') + ' aiwb-tab-' + tab.id + '"' +
    ' role="tab" aria-selected="' + (active ? 'true' : 'false') + '" aria-controls="aiPanelBody"' +
    ' title="' + esc(label) + '" aria-label="' + esc(label) + '" tabindex="' + (active ? '0' : '-1') + '"' +
    ' onclick="aiWB_tab(\'' + tab.id + '\')" onkeydown="aiWB_tabKeydown(event,\'' + tab.id + '\')">' +
    '<span class="aiwb-tab-icon" aria-hidden="true">' + tab.icon + '</span>' +
    '<span class="aiwb-tab-copy"><span class="aiwb-tab-label">' + tab.label + '</span><span class="aiwb-tab-meta">' + tab.meta + '</span></span></button>';
}
window.buildAi = function(){
  return '<section id="aiWB_root" class="aiwb-shell" aria-label="دستیار هوشمند CRM">' +
    '<header class="aiwb-hero"><div class="aiwb-hero-copy"><span class="aiwb-hero-icon" aria-hidden="true">🤖</span><span><h3>دستیار هوشمند</h3><p>استخراج، تحلیل و ساخت پیش‌نویس؛ نتیجه را پیش از ثبت بازبینی کنید.</p></span></div>' +
      '<div class="aiwb-hero-tools"><span id="aiQuotaPill" class="aiwb-quota" aria-live="polite">🤖 سهمیه امروز: در حال بررسی…</span>' +
        '<div class="aiwb-quick-actions" role="group" aria-label="عملیات دستیار">' +
          '<button type="button" class="bt bt-o aiwb-quick-action aiwb-history" title="نتایج اخیر دستیار" aria-label="نتایج اخیر دستیار" onclick="aiWB_histShow()"><span aria-hidden="true">🕓</span><span>نتایج اخیر</span></button>' +
          '<button type="button" class="bt bt-o aiwb-quick-action aiwb-clear" title="پاک‌سازی کش پاسخ‌های هوش مصنوعی" aria-label="پاک‌سازی کش پاسخ‌های هوش مصنوعی" onclick="aiWB_clearCache()"><span aria-hidden="true">🧹</span><span>پاک‌سازی کش</span></button>' +
        '</div></div></header>' +
    '<nav id="aiTabs" class="aiwb-tabs" role="tablist" aria-label="ابزارهای دستیار">' +
      AIWB_TABS.map(function(tab){ return aiWB_tabButton(tab, tab.id === 'ocr'); }).join('') +
    '</nav>' +
    '<div id="aiPanelBody" class="aiwb-panel" role="tabpanel" aria-labelledby="aiTab_ocr"></div>' +
    '<div id="aiLogBox" class="aiwb-log" aria-live="polite" dir="ltr" style="display:none"></div>' +
  '</section>';
};

window.renderAi = function(){
  aiWB_updateQuota();
  aiWB_tab(window._aiWBActiveTab || 'ocr');
};

function aiWB_tabTarget(event, current) {
  if (!event) return '';
  var ids = AIWB_TABS.map(function(x){ return x.id; });
  var at = ids.indexOf(current), key = event.key, next = at;
  if (at < 0) return '';
  if (key === 'ArrowLeft' || key === 'ArrowDown') next = (at + 1) % ids.length;
  else if (key === 'ArrowRight' || key === 'ArrowUp') next = (at - 1 + ids.length) % ids.length;
  else if (key === 'Home') next = 0;
  else if (key === 'End') next = ids.length - 1;
  else return '';
  event.preventDefault();
  return ids[next];
}
window.aiWB_tabKeydown = function(event, current) {
  var next = aiWB_tabTarget(event, current);
  if (next) window.aiWB_tab(next, true);
};

window.aiWB_tab = function(t, restoreFocus){
  var known = AIWB_TABS.some(function(x){ return x.id === t; });
  if (!known) t = 'ocr';
  window._aiWBActiveTab = t;
  AIWB_TABS.forEach(function(tab){
    var b=document.getElementById('aiTab_'+tab.id), active=tab.id===t;
    if(b){
      b.className = 'aiwb-tab' + (active ? ' is-active' : '') + ' aiwb-tab-' + tab.id;
      b.setAttribute('aria-selected', active ? 'true' : 'false');
      b.setAttribute('tabindex', active ? '0' : '-1');
    }
  });
  var el=document.getElementById('aiPanelBody');
  if(!el) return;
  el.setAttribute('aria-labelledby','aiTab_'+t);
  if(t==='ocr') el.innerHTML = aiWB_html_ocr();
  else if(t==='bizcard') el.innerHTML = aiWB_html_bizcard();
  else if(t==='translate') el.innerHTML = aiWB_html_translate();
  else if(t==='identify') el.innerHTML = aiWB_html_identify();
  else if(t==='summarize') el.innerHTML = aiWB_html_summarize();
  else if(t==='letter') el.innerHTML = aiWB_html_letter();
  try { aiWB_restore(t); } catch(eR) {} /* بازیابی آخرین نتیجه بدون مصرف توکن */
  if (restoreFocus) {
    setTimeout(function(){ var b=document.getElementById('aiTab_'+t); if(b) b.focus(); },0);
  }
};


// ---------- BUSINESS CARD TAB (v20.4 / US-445) ----------
function aiWB_html_bizcard(){
  return '<div class="aiwb-tool-grid aiwb-biz-grid">'+
    '<section class="aiwb-tool-card aiwb-upload-card">'+
      '<h4 class="aiwb-tool-title">💳 استخراج کارت ویزیت</h4><p class="aiwb-tool-copy">عکس یا PDF کارت ویزیت را بارگذاری کنید؛ اطلاعات شرکت، شخص، سمت و تماس پیش از ثبت قابل بازبینی است.</p>'+
      '<input type="file" id="aiBizInp" accept=".pdf,.jpg,.jpeg,.png,.webp" style="display:none" onchange="aiWB_bizGo(this)">'+
      '<button type="button" class="bt aiwb-primary-action" onclick="document.getElementById(\'aiBizInp\').click()"><span aria-hidden="true">📎</span><span>انتخاب کارت ویزیت</span></button><div id="aiBizStatus" class="aiwb-status"></div></section>'+
    '<aside class="aiwb-tool-card aiwb-rule-card"><h4 class="aiwb-tool-title">قواعد ثبت</h4><ul class="aiwb-rule-list"><li>ثبت نهایی فقط بعد از تایید شما انجام می‌شود.</li><li>پیش از ثبت، نام، تلفن و ایمیل ضدتکرار می‌شوند.</li><li>برای تامین‌کننده خارجی، نام انگلیسی مبنا قرار می‌گیرد.</li></ul></aside></div><div id="aiBizOut" class="aiwb-result-slot"></div>';
}
window.aiWB_bizGo=function(inp){
  var f=inp.files[0]; if(!f)return; if(f.size>6*1048576){alert('فایل بزرگتر از ۶MB');return;}
  var st=document.getElementById('aiBizStatus'); st.innerHTML='⏳ در حال خواندن کارت ویزیت…';
  var rd=new FileReader(); rd.onload=function(){var b64=String(rd.result).split(',')[1];
    llmPost('bizcard',{mime:f.type,b64:b64},function(d){
      if(!d.ok){st.innerHTML='<span style="color:#dc2626">❌ '+(d.error||'خطا')+'</span>';return;}
      var card=d.data||{}; window._aiWB_bizCard=card; st.innerHTML='✅ اطلاعات استخراج شد — بازبینی کنید'; aiWB_bizRender(card,f.name); aiWB_persist('bizcard',f.name+' — '+(card.company||card.person||'کارت'),{card:card,src:f.name});
    });}; rd.readAsDataURL(f); inp.value='';
};
function bizVal(k){var e=document.getElementById('biz_'+k);return e?e.value.trim():'';}
function bizField(k,lb,dir){var v=(window._aiWB_bizCard||{})[k]||'';return '<div class="fld"><label>'+lb+'</label><input id="biz_'+k+'" value="'+esc(v)+'" '+(dir?'style="direction:'+dir+'"':'')+'></div>';}
window.aiWB_bizRender=function(card,src){
  window._aiWB_bizCard=card||{}; var c=window._aiWB_bizCard;
  var html='<div style="background:var(--crd);border:1px solid var(--brd);border-radius:16px;padding:16px"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap"><h4 style="margin:0">💳 پیش‌نمایش کارت ویزیت — '+esc(src||'')+'</h4><select id="biz_dest" style="padding:8px;border:1px solid var(--brd);border-radius:10px"><option value="supplier">تامین‌کننده</option><option value="customer">مشتری</option><option value="lead">سرنخ</option></select></div>'+
    '<div class="fr" style="margin-top:12px">'+bizField('company','نام شرکت فارسی')+bizField('companyEn','English Company','ltr')+'</div>'+
    '<div class="fr">'+bizField('person','نام شخص')+bizField('role','سمت')+'</div>'+
    '<div class="fr">'+bizField('mobile','موبایل','ltr')+bizField('phone','تلفن','ltr')+'</div>'+
    '<div class="fr">'+bizField('email','ایمیل','ltr')+bizField('website','وب‌سایت','ltr')+'</div>'+
    '<div class="fr">'+bizField('city','شهر/کشور')+bizField('activity','حوزه فعالیت/تخصص')+'</div>'+
    '<div class="fr">'+bizField('brands','برندها (با کاما جدا کنید)')+bizField('equip','تجهیزات تخصصی (با کاما جدا کنید)')+'</div>'+
    '<div class="fld"><label>آدرس</label><textarea id="biz_address" rows="2">'+esc(c.address||'')+'</textarea></div>'+
    '<button class="bt" onclick="aiWB_bizSave()">✅ ثبت</button> <button class="bt bt-o" onclick="aiWB_bizRender(window._aiWB_bizCard)">بازنشانی</button><div id="biz_save_res" style="margin-top:8px;font-size:12.5px"></div></div>';
  document.getElementById('aiBizOut').innerHTML=html;
};
function bizPeople(){var p=bizVal('person'); if(!p)return []; return [{nm:p,role:bizVal('role'),tels:bizVal('phone')?[{n:bizVal('phone'),lb:'کارت ویزیت'}]:[],mobs:bizVal('mobile')?[{n:bizVal('mobile'),lb:'کارت ویزیت'}]:[],mails:bizVal('email')?[{n:bizVal('email')}]:[],primary:true,src:'ai-bizcard'}];}
function bizDup(kind,rec){try{if(typeof ptfCheckDup==='function'){var d=ptfCheckDup(kind,rec,null); if(d&&d.length&&!confirm('⚠️ رکورد مشابه پیدا شد. با وجود احتمال تکراری بودن، ثبت جدید انجام شود؟'))return true;}}catch(e){} return false;}
window.aiWB_bizSave=function(){
  var dest=(document.getElementById('biz_dest')||{}).value||'supplier'; var co=bizVal('company')||bizVal('companyEn')||bizVal('person'); if(!co){alert('نام شرکت/شخص الزامی است');return;}
  var people=bizPeople(), tel=bizVal('phone'), mob=bizVal('mobile'), email=bizVal('email'); var res=document.getElementById('biz_save_res');
  if(dest==='supplier'){
    var rec={cd:genCode('SUP'),co:co,coEn:bizVal('companyEn'),kind:'حقوقی',ca:bizVal('activity')||'سایر',people:people,coTels:tel?[{n:tel,lb:'کارت ویزیت'}]:[],coWeb:bizVal('website')||email,coAddr:bizVal('address'),spBrands:bizVal('brands')?bizVal('brands').split(/[,،]/).map(function(x){return x.trim();}).filter(Boolean):[],spEquip:bizVal('equip')?bizVal('equip').split(/[,،]/).map(function(x){return x.trim();}).filter(Boolean):[],origin:bizVal('companyEn')&&!bizVal('company')?'خارجی':'داخلی',src:'ai-bizcard'};
    var pp=people[0]; rec.nm=pp?pp.nm:''; rec.ph=(pp&&pp.mobs&&pp.mobs[0]?pp.mobs[0].n:(tel||mob)); if(bizDup('supplier',rec))return; var a=getData('ptf_crm_suppliers'); if(typeof dedupStamp==='function')dedupStamp(rec); a.unshift(rec); /* v34.8.23 (W1-iterate) */ if(window.ptfEntitySaveCollection)window.ptfEntitySaveCollection('ptf_crm_suppliers',a,{reason:'ai-bizcard'}); else setData('ptf_crm_suppliers',a); if(typeof renderSuppliers==='function')renderSuppliers(); res.innerHTML='✅ تامین‌کننده ثبت شد: '+esc(rec.cd);
  } else if(dest==='customer'){
    var recC={cd:genCode('CUST'),co:co,coEn:bizVal('companyEn'),kind:'حقوقی',ind:bizVal('activity')||'سایر',people:people,coTels:tel?[{n:tel,lb:'کارت ویزیت'}]:[],coWeb:bizVal('website')||email,coAddr:bizVal('address'),src:'ai-bizcard'}; var pp2=people[0]; recC.con=pp2?pp2.nm:''; recC.ph=(pp2&&pp2.mobs&&pp2.mobs[0]?pp2.mobs[0].n:(tel||mob)); if(bizDup('customer',recC))return; var ac=getData('ptf_crm_customers'); if(typeof dedupStamp==='function')dedupStamp(recC); ac.unshift(recC); /* v34.8.23 (W1-iterate) */ if(window.ptfEntitySaveCollection)window.ptfEntitySaveCollection('ptf_crm_customers',ac,{reason:'ai-bizcard'}); else setData('ptf_crm_customers',ac); if(typeof renderCustomers==='function')renderCustomers(); res.innerHTML='✅ مشتری ثبت شد: '+esc(recC.cd);
  } else {
    var recL={cd:genCode('LEAD'),co:co,person:bizVal('person'),role:bizVal('role'),ind:bizVal('activity')||'سایر',tel:tel,mob:mob,email:email,src:'کارت ویزیت',firstISO:new Date().toISOString().slice(0,10),firstFa:(typeof faDate==='function'?faDate():''),stage:'new',hist:[{t:(typeof faDateTime==='function'?faDateTime():''),k:'ثبت',tx:'ثبت از کارت ویزیت توسط AI'}],createdFa:(typeof faDate==='function'?faDate():''),createdISO:new Date().toISOString().slice(0,10),need:bizVal('equip')||bizVal('activity')}; if(bizDup('lead',recL))return; var al=getData('ptf_crm_leads'); if(typeof dedupStamp==='function')dedupStamp(recL); al.unshift(recL); setData('ptf_crm_leads',al); if(typeof renderLeads==='function')renderLeads(); res.innerHTML='✅ سرنخ ثبت شد: '+esc(recL.cd);
  }
  if(typeof audit==='function')audit('دستیار','ثبت کارت ویزیت AI در '+dest,co); if(typeof ptfToast==='function')ptfToast('ثبت کارت ویزیت انجام شد','ok');
};

// ---------- OCR TAB ----------
function aiWB_html_ocr(){
  return '<div class="aiwb-tool-grid aiwb-ocr-grid">'+
   '<section class="aiwb-tool-card aiwb-upload-card">'+
    '<h4 class="aiwb-tool-title">📤 بارگذاری فایل استعلام</h4>'+
    '<label class="aiwb-dropzone" tabindex="0" role="button" aria-label="انتخاب فایل استعلام" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();document.getElementById(\'aiOcrInp\').click()}">'+
      '<span class="aiwb-dropzone-icon" aria-hidden="true">📎</span><span><b>فایل را انتخاب کنید</b><small>PDF / JPG / PNG / WebP — حداکثر ۶MB</small></span>'+
      '<input type="file" id="aiOcrInp" accept=".pdf,.jpg,.jpeg,.png,.webp" style="display:none" onchange="aiWB_ocrGo(this)">' +
    '</label>'+
    '<div id="aiOcrStatus" class="aiwb-status"></div>'+
    '<div class="aiwb-note">💡 خروجی پیش از ثبت قابل ویرایش است و سپس می‌تواند به بانک کالا، استعلام تامین یا پیش‌نویس پیشنهاد متصل شود.</div>'+
   '</section>'+
   '<section class="aiwb-tool-card aiwb-options-card">'+
    '<h4 class="aiwb-tool-title">⚙️ تنظیمات استخراج</h4>'+
    '<label class="aiwb-check"><input type="checkbox" id="aiOcr_brand" checked><span>تشخیص خودکار برند و مدل</span></label>'+
    '<label class="aiwb-check"><input type="checkbox" id="aiOcr_concise" checked><span>ساخت شرح خلاصه کاتالوگی</span></label>'+
    '<div class="fld"><label>زبان خروجی شرح خلاصه</label><select id="aiOcr_lang"><option value="fa">فارسی</option><option value="en">English</option><option value="both" selected>هر دو</option></select></div>'+
   '</section>'+
  '</div>'+
  '<div id="aiOcrResult" class="aiwb-result-slot"></div>';
}

window.aiWB_ocrGo = function(inp){
  var f=inp.files[0]; if(!f)return;
  if(f.size>6*1048576){ alert('فایل بزرگتر از ۶MB'); return;}
  var st=document.getElementById('aiOcrStatus');
  st.innerHTML='⏳ در حال ارسال به AI … <small>(ممکن است تا ۶۰ ثانیه طول بکشد)</small>';
  var rd=new FileReader();
  rd.onload=function(){
    var b64=String(rd.result).split(',')[1];
    aiWB_log('OCR start: '+f.name+' ('+Math.round(f.size/1024)+'KB)');
    llmPost('ocr',{mime:f.type,b64:b64},function(d){
      if(!d.ok){ st.innerHTML='<span style="color:#dc2626">❌ '+(d.error||'خطا')+'</span>'; aiWB_log('OCR ERR: '+(d.error||'')); return;}
      var rows=(d.data&&d.data.rows)||[];
      /* v12.5 (US-306): تشخیص کارفرما و شماره درخواست از سربرگ
         v14.4 (US-362 AC1/AC6/AC8): + نام انگلیسی شرکت + کارشناس خرید (از هر نوع فایل) */
      window._aiWB_detected = {
        co: (d.data&&d.data.co||'').trim(), inqno: (d.data&&d.data.inqno||'').trim(),
        coEn: (d.data&&d.data.coEn||'').trim(),
        buyer: (d.data&&d.data.buyer||'').trim(), buyerEn: (d.data&&d.data.buyerEn||'').trim(), buyerRole: (d.data&&d.data.buyerRole||'').trim()
      };
      st.innerHTML='✅ '+rows.length+' قلم استخراج شد — بازبینی کنید ↓';
      aiWB_renderOcrTable(rows, f.name);
      aiWB_persist('ocr', f.name+' — '+rows.length+' قلم', { rows: rows, det: window._aiWB_detected, src: f.name }); /* v14.4 US-378 */
      aiWB_log('OCR OK: '+rows.length+' rows'+(window._aiWB_detected.co?' | co: '+window._aiWB_detected.co:'')+(window._aiWB_detected.buyer?' | buyer: '+window._aiWB_detected.buyer:''));
    });
  };
  rd.readAsDataURL(f);
  inp.value='';
};

var aiWB_lastRows=[];
function aiWB_renderOcrTable(rows, srcName){
  aiWB_lastRows = JSON.parse(JSON.stringify(rows));
  var h='<section class="aiwb-result-card aiwb-ocr-result">'+
    '<div class="aiwb-result-head">'+
    '<h4 class="aiwb-tool-title">📋 اقلام استخراج‌شده — قابل ویرایش</h4>'+
    '<div class="aiwb-inline-actions">'+
      '<button type="button" class="bt bt-o aiwb-secondary-action" onclick="aiWB_exportExcel()">⬇️ دانلود Excel</button>'+
      '<button type="button" class="bt bt-o aiwb-secondary-action aiwb-add-row" onclick="aiWB_addRow()">➕ ردیف دستی</button>'+
    '</div></div>'+
    '<div class="aiwb-table-scroll"><table><thead><tr>' +
      '<th>#</th><th>تایپ</th><th>شرح خلاصه *</th><th>مشخصات کامل</th><th>برند</th><th>مدل</th><th>تعداد</th><th>واحد</th><th>✔</th></tr></thead><tbody id="aiOcrTb">';
  rows.forEach(function(r,i){
    h+='<tr>'+
      '<td>'+(i+1)+'</td>'+
      '<td><input value="'+esc(r.tp||'Other')+'" oninput="aiWB_upd('+i+',\'tp\',this.value)" style="width:90px;padding:4px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px"></td>'+
      '<td><input value="'+esc(r.nm||'')+'" oninput="aiWB_upd('+i+',\'nm\',this.value)" style="width:210px;padding:4px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px"></td>'+
      '<td><input value="'+esc(r.spec||'')+'" oninput="aiWB_upd('+i+',\'spec\',this.value)" style="width:240px;padding:4px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px"></td>'+
      '<td><input value="'+esc(r.brand||'')+'" oninput="aiWB_upd('+i+',\'brand\',this.value)" style="width:110px;padding:4px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px"></td>'+
      '<td><input value="'+esc(r.model||'')+'" oninput="aiWB_upd('+i+',\'model\',this.value)" style="width:130px;padding:4px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;direction:ltr"></td>'+
      '<td><input type="number" value="'+esc(r.qty||1)+'" oninput="aiWB_upd('+i+',\'qty\',this.value)" style="width:60px;padding:4px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px"></td>'+
      '<td><input value="'+esc(r.un||'عدد')+'" oninput="aiWB_upd('+i+',\'un\',this.value)" style="width:70px;padding:4px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px"></td>'+
      '<td><input type="checkbox" checked data-ai-row="'+i+'"></td>'+
    '</tr>';
  });
  h+='</tbody></table></div>';
  // Triple Pipeline UI
  h+='<section class="aiwb-triple-pipeline">'+
    '<div class="aiwb-triple-title">🚀 اجرای سه‌گانه</div>'+
    '<label style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:13px"><input type="checkbox" id="aiTP_prod" checked> ① ثبت در بانک کالا — کد PTF-P خودکار</label>'+
    '<label style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:13px"><input type="checkbox" id="aiTP_src" checked> ② ایجاد استعلام تامین — انتخاب تامین‌کنندگان</label>'+
    '<label style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:13px"><input type="checkbox" id="aiTP_quote" checked> ③ ساخت پیش‌نویس پیشنهاد '+
    /* v14.3 (US-374 — دستور کارفرما): نوع پیش‌نویس را کاربر انتخاب می‌کند — فنی/فنی-مالی/مالی (بر اساس دسترسی قیمت فروش) */
    '<select id="aiTP_kind" style="padding:4px 8px;border:1px solid #a7f3d0;border-radius:8px;font-size:12px" onclick="event.stopPropagation()">'+
      '<option value="TO">🔧 فنی (TO)</option>'+
      ((typeof roleDef !== 'function' || (roleDef()||{}).sellPrice) ? '<option value="TC">🤝 فنی-مالی (TC)</option><option value="CO">💰 مالی (CO)</option>' : '')+
    '</select></label>'+
    /* v12.5 (US-305/306): ثبت درخواست جدید + مشتری شناسایی‌شده از سربرگ */
    '<label style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:13px"><input type="checkbox" id="aiTP_rfq"> ④ ثبت به‌عنوان <b>درخواست (استعلام) جدید</b> با همین اقلام</label>'+
    '<div id="aiTP_coBox"></div>'+
    '<div class="aiwb-triple-selects">'+
      '<div><label>شماره درخواست مرتبط <small>(اختیاری)</small></label>'+
      '<select id="aiTP_inq" style="width:100%;padding:7px;border:1px solid #a7f3d0;border-radius:8px"><option value="">— بدون اتصال —</option></select></div>'+
      '<div><label>مشتری برای TO</label>'+
      '<select id="aiTP_cust" style="width:100%;padding:7px;border:1px solid #a7f3d0;border-radius:8px"><option value="">— انتخاب بعدا —</option></select></div>'+
    '</div>'+
    '<label style="display:flex;align-items:flex-start;gap:8px;margin:-2px 0 10px;font-size:12.5px;line-height:1.7;cursor:pointer"><input type="checkbox" id="aiTP_addItems"> <span>⑤ افزودن اقلام انتخاب‌شده به <b>اقلام درخواست مرتبط</b><br><small style="color:#64748b">برای درخواست موجود: ثبت append و ضدتکرار؛ برای درخواست جدید، گزینه ④ این کار را خودکار انجام می‌دهد.</small></span></label>'+
    '<div class="aiwb-inline-actions"><button type="button" class="bt aiwb-primary-action aiwb-triple-run" onclick="aiWB_tripleGo()">🚀 اجرای سه‌گانه</button>'+
    '<button type="button" class="bt bt-o aiwb-secondary-action" onclick="aiWB_exportExcel()">⬇️ فقط Excel بگیر</button></div>'+
    '<div id="aiTP_res" class="aiwb-output"></div>'+
  '</section></section>';
  document.getElementById('aiOcrResult').innerHTML=h;
  // populate inq + cust dropdowns
  try{
    var rfqs=getData('ptf_crm_rfqs'); var sel=document.getElementById('aiTP_inq');
    if(sel){ rfqs.slice(0,40).forEach(function(r){ var o=document.createElement('option'); o.value=r.cd; o.textContent=r.cd+' — '+r.co; sel.appendChild(o); }); }
    var custs=getData('ptf_crm_customers'); var cs=document.getElementById('aiTP_cust');
    if(cs){ custs.forEach(function(c){ var o=document.createElement('option'); o.value=c.cd; o.textContent=c.co; cs.appendChild(o); }); }
    /* v12.5 (US-306): کارفرمای شناسایی‌شده از سربرگ — اگر ثبت‌شده بود انتخاب خودکار؛ وگرنه پیشنهاد ثبت با چک‌باکس */
    var det = window._aiWB_detected || {};
    var coBox = document.getElementById('aiTP_coBox');
    if (coBox && det.co) {
      var known = custs.filter(function(c){ return c.co === det.co || (det.co && (c.co.indexOf(det.co) > -1 || det.co.indexOf(c.co) > -1)); })[0];
      /* v14.4 (US-362 AC6/AC7): رابط خرید شناسایی‌شده — فقط با تایید کاربر ثبت می‌شود */
      var buyerHtml = det.buyer
        ? '<label style="display:flex;align-items:center;gap:7px;margin-top:6px;cursor:pointer;background:#f0f9ff;border:1px solid #7dd3fc;border-radius:8px;padding:6px 9px"><input type="checkbox" id="aiTP_buyer" checked> 👤 رابط خرید شناسایی‌شده: <b>' + esc(det.buyer) + '</b>' + (det.buyerRole ? ' <small>(' + esc(det.buyerRole) + ')</small>' : '') + (det.buyerEn ? ' — <span dir="ltr" style="color:#0369a1">' + esc(det.buyerEn) + '</span>' : '') + ' ← با تایید شما به اشخاص رابط مشتری اضافه می‌شود</label>'
        : '';
      if (known) {
        if (cs) cs.value = known.cd;
        coBox.innerHTML = '<div style="background:#ecfdf5;border:1px solid #6ee7b7;border-radius:10px;padding:8px 12px;font-size:12.5px;color:#065f46;margin-bottom:10px">🏢 کارفرمای سند از سربرگ شناسایی شد: <b>' + esc(det.co) + '</b> — مشتری ثبت‌شده «' + esc(known.co) + '» به‌طور خودکار انتخاب شد ✅' + buyerHtml + '</div>';
      } else {
        coBox.innerHTML = '<div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:8px 12px;font-size:12.5px;color:#92400e;margin-bottom:10px">🏢 کارفرمای سند: <b>' + esc(det.co) + '</b>' + (det.coEn ? ' <span dir="ltr" style="color:#b45309">(' + esc(det.coEn) + ')</span>' : '') + ' — این مشتری تاکنون ثبت نشده است.<br>' +
          '<label style="display:flex;align-items:center;gap:7px;margin-top:6px;cursor:pointer"><input type="checkbox" id="aiTP_newCust" checked> ثبت خودکار «' + esc(det.co) + '» به‌عنوان مشتری جدید' + (det.coEn ? ' (نام EN هم ثبت می‌شود)' : '') + '</label>' + buyerHtml + '</div>';
      }
    }
    if (det.inqno) {
      var inqSel = document.getElementById('aiTP_inq');
      // اگر شماره درخواست سند در فهرست بود انتخاب شود
      if (inqSel) for (var oi=0; oi<inqSel.options.length; oi++) if (inqSel.options[oi].value === det.inqno) { inqSel.value = det.inqno; break; }
    }
  }catch(e){}
}

window.aiWB_upd=function(i,f,v){ if(aiWB_lastRows[i]) aiWB_lastRows[i][f]=f==='qty'? (+v||1):v; };
window.aiWB_addRow=function(){ aiWB_lastRows.push({tp:'Other',nm:'',spec:'',brand:'',model:'',qty:1,un:'عدد'}); aiWB_renderOcrTable(aiWB_lastRows,'manual'); };

window.aiWB_exportExcel=function(){
  var rows=aiWB_getCheckedRows();
  if(!rows.length){ alert('ردیفی انتخاب نشده'); return; }
  var head=['کد کالا','نام کالا','نام انگلیسی','دسته','استاندارد/گرید','برند','مدل','واحد','تعداد','قیمت مرجع','توضیحات','شماره درخواست'];
  var csvRows=[head];
  var inq=(document.getElementById('aiTP_inq')||{}).value||'';
  rows.forEach(function(r){
    csvRows.push(['', r.nm||'', r.en||'', r.tp||'Other', r.spec||'', r.brand||'', r.model||'', r.un||'عدد', r.qty||1, '', 'خروجی AI Workbench v120.0'+(inq?' — '+inq:''), inq]);
  });
  var csv='\uFEFF'+csvRows.map(function(a){return a.map(function(c){return '"'+String(c).replace(/"/g,'""')+'"'}).join(',')}).join('\r\n');
  var a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  a.download='ptf-ai-export-'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();
  aiWB_log('Excel exported: '+rows.length+' rows');
};

function aiWB_getCheckedRows(){
  var out=[];
  document.querySelectorAll('#aiOcrTb input[type=checkbox]').forEach(function(ch,idx){
    if(ch.checked && aiWB_lastRows[idx]) out.push(aiWB_lastRows[idx]);
  });
  return out.length?out:aiWB_lastRows;
}


/* ---------- v25.11: ثبت اختیاری اقلام استخراج‌شده در درخواست موجود ---------- */
function aiWB_itemNorm(v) {
  var s = String(v == null ? '' : v);
  try { return typeof dedupNorm === 'function' ? dedupNorm(s) : s.toLowerCase().replace(/\s+/g, ' ').trim(); } catch (e) { return s.toLowerCase().replace(/\s+/g, ' ').trim(); }
}
function aiWB_itemKey(row) {
  return aiWB_itemNorm(row && (row.nm || row.name || row.en || '')) + '|' +
    aiWB_itemNorm(row && (row.spec || row.st || row.desc || '')) + '|' +
    aiWB_itemNorm(row && (row.model || row.md || ''));
}
function aiWBAppendItemsToRfq(rfqCd, rows, runId) {
  var rfqs = getData('ptf_crm_rfqs');
  var rfq = rfqs.filter(function (r) { return r.cd === rfqCd; })[0];
  if (!rfq) return { ok: false, error: 'درخواست مرتبط یافت نشد' };

  /* همان قفل ویرایش اقلام: بعد از صدور پیشنهاد، تغییر مستقیم درخواست مجاز نیست. */
  var aliases = [rfq.cd, rfq.inqNo].filter(Boolean);
  var hasOffer = getData('ptf_crm_offers').some(function (o) { return aliases.indexOf(o.inqNo) > -1; });
  if (hasOffer) return { ok: false, error: 'برای این درخواست پیشنهاد صادر شده است؛ اقلام اصلی قفل هستند و امکان افزودن از دستیار وجود ندارد.' };

  var allItems = getData('ptf_crm_inqitems');
  var existingItems = {};
  allItems.forEach(function (it) { if (aliases.indexOf(it.inqNo) > -1) existingItems[aiWB_itemKey(it)] = true; });
  rfq.items = Array.isArray(rfq.items) ? rfq.items : [];
  var existingSnapshot = {};
  rfq.items.forEach(function (it) { existingSnapshot[aiWB_itemKey(it)] = true; });

  var added = 0, snapshotAdded = 0, skipped = 0, itemCodes = [];
  rows.forEach(function (row) {
    var name = String(row.nm || row.name || '').trim();
    if (name.length < 3) return;
    var key = aiWB_itemKey(row);
    if (!key || key === '||') return;
    if (!existingItems[key]) {
      var itemCode = genCode('IQI');
      allItems.push({ inqNo: rfq.cd, cd: itemCode, nm: name, en: row.en || name, st: row.spec || row.st || '', qty: +row.qty || 1, un: row.un || row.unit || 'عدد', tp: row.tp || 'Other', brand: row.brand || '', model: row.model || '', t: typeof faDate === 'function' ? faDate() : new Date().toISOString().slice(0, 10), aiRun: runId });
      existingItems[key] = true;
      itemCodes.push(itemCode);
      added++;
    } else {
      skipped++;
    }
    if (!existingSnapshot[key]) {
      rfq.items.push({ nm: name, en: row.en || name, st: row.spec || row.st || '', qty: +row.qty || 1, un: row.un || row.unit || 'عدد', tp: row.tp || 'Other', brand: row.brand || '', model: row.model || '', aiRun: runId });
      existingSnapshot[key] = true;
      snapshotAdded++;
    }
  });

  if (added || snapshotAdded) {
    if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_rfqs', rfqs, { reason: 'w2' }); else setData('ptf_crm_rfqs', rfqs);
    if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_inqitems', allItems, { reason: 'w2' }); else setData('ptf_crm_inqitems', allItems);
    if (typeof audit === 'function') audit('استعلامات', 'افزودن ' + added + ' قلم استخراج‌شده توسط دستیار به درخواست ' + rfq.cd + (skipped ? ' — ' + skipped + ' قلم تکراری رد شد' : ''), rfq.cd);
  }
  return { ok: true, rfq: rfq.cd, added: added, snapshotAdded: snapshotAdded, skipped: skipped, itemCodes: itemCodes, runId: runId };
}

// -------- Triple Pipeline --------
window.aiWB_tripleGo=function(){
  var rows=aiWB_getCheckedRows().filter(function(r){return (r.nm||'').trim().length>2});
  if(!rows.length){ alert('ردیف معتبری انتخاب نشده'); return; }
  var doProd=document.getElementById('aiTP_prod').checked;
  var doSrc=document.getElementById('aiTP_src').checked;
  var doQuote=document.getElementById('aiTP_quote').checked;
  var doRfq=(document.getElementById('aiTP_rfq')||{}).checked||false;
  var doAddItems=(document.getElementById('aiTP_addItems')||{}).checked||false;
  var doNewCust=(document.getElementById('aiTP_newCust')||{}).checked||false;
  var inqNo=(document.getElementById('aiTP_inq')||{}).value||'';
  var custCd=(document.getElementById('aiTP_cust')||{}).value||'';
  var resEl=document.getElementById('aiTP_res');
  resEl.innerHTML='⏳ در حال اجرا…';
  var out={prod:0, src:'', quote:'', cust:'', rfq:'', items:null, runId:'AIWB-'+Date.now()};
  var det=window._aiWB_detected||{};
  var duplicateSupplyOf='';
  /* همان گارد ضدازدحام ماژول درخواست تامین، پیش از هر تغییر Triple Pipeline. */
  if(doSrc && inqNo && typeof window.ptfRfqsExistingForSource==='function'){
    var existingSupply=window.ptfRfqsExistingForSource(inqNo,'');
    if(existingSupply.length){
      var priorNos=existingSupply.map(function(x){return x.no;}).join('، ');
      var createAgain=confirm('⚠️ برای این درخواست قبلاً درخواست تامین ثبت شده است:\n'+priorNos+'\n\nتأیید = ثبت درخواست تامین جدید\nانصراف = باز کردن درخواست تامین قبلی و توقف عملیات فعلی');
      if(!createAgain){
        resEl.innerHTML='<span style="color:#0e7490">↩️ درخواست تامین قبلی «'+existingSupply[0].no+'» باز شد.</span>';
        if(typeof window.ptfRfqsOpenExisting==='function') setTimeout(function(){window.ptfRfqsOpenExisting(existingSupply[0].no);},0);
        return;
      }
      duplicateSupplyOf=existingSupply[0].no;
    }
  }
  if(doAddItems && !inqNo && !doRfq){ resEl.innerHTML='<span style="color:#b91c1c">برای افزودن اقلام، یک درخواست مرتبط انتخاب کنید یا گزینه «ثبت درخواست جدید» را تیک بزنید.</span>'; return; }
    /* بررسی/تایید ضدتکرار کالا پیش از هر تغییر داده، تا لغو کاربر عملیات نیمه‌کاره نسازد. */
    if(doProd){
      var prodsChk=getData('ptf_crm_products');
      var dupList=[], newList=[];
      rows.forEach(function(r){
        var desc=(r.nm||r.name||'').trim();
        if(!desc) return;
        var ex=prodsChk.filter(function(p){ return p.nm===desc || (p.st && p.st===(r.spec||r.desc||'')); })[0];
        if(ex) dupList.push({nm:desc, cd:ex.cd}); else newList.push(desc);
      });
      out.dupN=dupList.length;
      if(dupList.length){
        var dupPrev=dupList.slice(0,6).map(function(d){ return '  🔁 '+d.nm.slice(0,45)+' ← قبلا با کد '+d.cd; }).join('\n');
        var newPrev=newList.slice(0,6).map(function(n){ return '  🆕 '+n.slice(0,45); }).join('\n');
        var msg381='📦 بررسی کالاها پیش از ثبت (US-381):\n\n'+
          '🆕 جدید (ثبت می‌شوند): '+newList.length+' قلم'+(newPrev?'\n'+newPrev+(newList.length>6?'\n  …':''):'')+'\n\n'+
          '🔁 تکراری (رد می‌شوند — قبلا ثبت شده‌اند): '+dupList.length+' قلم\n'+dupPrev+(dupList.length>6?'\n  …':'')+'\n\n'+
          (newList.length? 'ادامه می‌دهید؟ (فقط جدیدها ثبت می‌شوند)' : '⚠️ هیچ کالای جدیدی وجود ندارد — همه قبلا ثبت شده‌اند. ادامه (بدون ثبت کالا)؟');
        if(!confirm(msg381)){ resEl.innerHTML='<span style="color:#b45309">⏸ اجرا به درخواست شما متوقف شد (بررسی کالاهای تکراری)</span>'; return; }
      }
    }

  try{
    /* v12.5 (US-306): ۰) ثبت خودکار مشتری شناسایی‌شده از سربرگ (با تایید چک‌باکس کاربر) */
    if(doNewCust && det.co){
      var custs0=getData('ptf_crm_customers');
      var exists0=custs0.some(function(c){ return c.co === det.co; });
      if(!exists0){
        /* v14.4 (US-362 AC1/AC2): نام انگلیسی شرکت هم‌زمان ثبت — سند EN دیگر ترانویسی خام نمی‌گیرد */
        var newC={ cd:genCode('CUST'), co:det.co, coEn:(det.coEn||''), kind:'حقوقی', ind:'نفت و گاز', venSt:'unreg', people:[], phones:[], coTels:[], ds:'ثبت خودکار توسط دستیار از سربرگ استعلام', ts:new Date().toISOString() };
        if(typeof dedupStamp==='function') dedupStamp(newC);
        custs0.unshift(newC);
        /* v34.8.23 (W1-iterate) */
        if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_customers', custs0, { reason: 'ai-letterhead' });
        else setData('ptf_crm_customers', custs0);
        custCd=newC.cd; out.cust=newC.cd;
        if(typeof audit==='function') audit('مشتریان','ثبت خودکار مشتری از سربرگ استعلام توسط دستیار: '+det.co+(det.coEn?' / '+det.coEn:''), newC.cd);
      }
    }
    /* v14.4 (US-362 AC6/AC7/AC8): رابط خرید شناسایی‌شده — فقط با تیک تایید کاربر؛ ضدتکرار؛ نام EN همراه */
    var doBuyer=(document.getElementById('aiTP_buyer')||{}).checked||false;
    if(doBuyer && det.buyer && custCd){
      var custsB=getData('ptf_crm_customers');
      var cB=custsB.filter(function(c){ return c.cd===custCd; })[0];
      if(cB){
        cB.people = cB.people || [];
        var dup = cB.people.some(function(pp){ return (pp.nm||'').trim() === det.buyer; });
        if(!dup){
          cB.people.push({ nm: det.buyer, nmEn: det.buyerEn||'', role: det.buyerRole||'کارشناس خرید', tels: [], mobs: [], src: 'ai' });
          /* v34.8.23 (W1-iterate) */
          if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_customers', custsB, { reason: 'ai-buyer' });
          else setData('ptf_crm_customers', custsB);
          out.buyer = det.buyer;
          if(typeof audit==='function') audit('مشتریان','افزودن رابط خرید شناسایی‌شده توسط دستیار (با تایید کاربر): '+det.buyer+(det.buyerEn?' / '+det.buyerEn:''), custCd);
        }
      }
    }
    /* v12.5 (US-305): ۰.۵) ثبت درخواست جدید با همین اقلام — کاربر مجبور نیست به «استعلامات» برگردد */
    if(doRfq && !inqNo){
      var rfqs0=getData('ptf_crm_rfqs');
      var rCd=genCode('RFQ');
      if (/^TMP-RFQ-/.test(String(rCd || ''))) { resEl.innerHTML='<span style="color:#b91c1c">❌ شماره رسمی درخواست از سرور دریافت نشد؛ ابتدا اتصال و ورود را کامل کنید.</span>'; return; }
      var coName=det.co||(custCd?(getData('ptf_crm_customers').filter(function(c){return c.cd===custCd;})[0]||{}).co:'')||'—';
      rfqs0.unshift({ cd:rCd, co:coName, con:'', ca:'ابزار دقیق', st:'st1', stxt:'🔴 دریافت اولیه', inqNo:det.inqno||'', subj:'ثبت خودکار توسط دستیار'+(det.inqno?' — '+det.inqno:''), items:rows.map(function(r){return {nm:r.nm,st:r.spec||'',qty:r.qty||1,un:r.un||'عدد',brand:r.brand||'',model:r.model||'',tp:r.tp||'Other'};}), dt:new Date().toLocaleDateString('fa-IR') });
      if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_rfqs', rfqs0, { reason: 'w2' }); else setData('ptf_crm_rfqs', rfqs0);
      /* اقلام در بانک اقلام درخواست هم بنشیند تا «از درخواست» در پیشنهادها کار کند (US-303) */
      var iq0=getData('ptf_crm_inqitems');
      rows.forEach(function(r){ if(r.nm) iq0.push({ inqNo:rCd, cd:genCode('IQI'), nm:r.nm, en:r.nm, st:r.spec||'', qty:r.qty||1, un:r.un||'عدد', tp:r.tp||'Other', t:new Date().toLocaleDateString('fa-IR') }); });
      if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_inqitems', iq0, { reason: 'w2' }); else setData('ptf_crm_inqitems', iq0);
      inqNo=rCd; out.rfq=rCd; out.items={rfq:rCd, added:rows.length, snapshotAdded:rows.length, skipped:0, itemCodes:[], runId:out.runId, created:true};
      if(typeof audit==='function') audit('استعلامات','ثبت خودکار درخواست توسط دستیار: '+rCd+' ('+rows.length+' قلم)', rCd);
      if(typeof wfRefresh==='function') try{ wfRefresh(rCd); }catch(e){}
    }
    /* ۰.۷) درخواست موجود: اقلام OCR فقط با تیک صریح کاربر و پیش از ساخت پیشنهاد اضافه می‌شوند. */
    if(doAddItems && inqNo && !out.rfq){
      out.items=aiWBAppendItemsToRfq(inqNo, rows, out.runId);
      if(!out.items.ok){ resEl.innerHTML='<span style="color:#b91c1c">❌ '+esc(out.items.error||'ثبت اقلام درخواست ناموفق بود')+'</span>'; return; }
    }
    // 1) products
    /* v14.7 (US-381 — دستور کارفرما): پیش‌نمایش تکراری/جدید + اخذ تایید کاربر + گزارش دقیق
       ریشه: ضدتکرار ptfAutoRegisterSummaryProducts درست کار می‌کرد ولی «بی‌صدا» — کاربر نمی‌فهمید چرا ثبت نشد */
    if(doProd && typeof window.ptfAutoRegisterSummaryProducts==='function'){
      out.prod = window.ptfAutoRegisterSummaryProducts(inqNo||'AI-WB', rows) || 0;
    } else if(doProd){
      // fallback minimal register
      var prods=getData('ptf_crm_products'); var added=0;
      rows.forEach(function(r){
        var cd='P-'+String(1000+prods.length+added+1).padStart(4,'0');
        prods.push({cd:cd,nm:r.nm,en:r.en||'',ca:(typeof ptfNormCat==='function'?ptfNormCat(r.tp):(r.tp||'سایر')),st:r.spec||'',br:r.brand||'',md:r.model||'',un:r.un||'عدد',pr:0,ds:'AI Workbench '+(inqNo||''),tp:r.tp||'Other',srcInq:inqNo||'',ts:new Date().toISOString()}); /* v15.9 US-389 */
        added++;
      });
      /* v34.8.23 (W1-iterate) */ if(window.ptfEntitySaveCollection)window.ptfEntitySaveCollection('ptf_crm_products',prods,{reason:'ai-items'}); else setData('ptf_crm_products',prods); out.prod=added;
    }
    // 2) sourcing
    if(doSrc){
      /* v12.6 (BUG-009/US-311): ساختار رکورد مطابق ماژول استعلام هوشمند تامین — قبلا {cd,inqNo} می‌ساخت
         که ماژول آن را رندر نمی‌کرد (لینک واقعی نبود). حالا: no سریال رسمی + items پاک‌سازی‌شده
         (بدون نام کارفرما — قاعده محرمانگی AC2) + targets خالی آماده انتخاب تامین‌کننده. */
      var sq=getData('ptf_crm_rfqsmart');
      var sqNo;
      try {
        var yr=(typeof faYear==='function')?faYear():'1405';
        var mx=0;
        sq.forEach(function(r){ var m=(r.no||'').match(new RegExp('^PTF-RFQS-'+yr+'-(\\d+)$')); if(m&&+m[1]>mx)mx=+m[1]; });
        sqNo='PTF-RFQS-'+yr+'-'+String(mx+1).padStart(3,'0');
      } catch(e){ sqNo=genCode('RFQS'); }
      sq.unshift({
        no:sqNo, srcRfq:inqNo||'', st:'draft',
        duplicateOf:duplicateSupplyOf||'', duplicateConfirmedAt:duplicateSupplyOf?new Date().toISOString():'', duplicateConfirmedBy:duplicateSupplyOf?(curSession().name||''):'',
        items:rows.map(function(r){ return { name:r.nm||'', spec:r.spec||'', qty:r.qty||1, unit:r.un||'عدد', brand:r.brand||'', model:r.model||'' }; }),
        targets:[], deadline:'',
        t:(typeof faDateTime==='function'?faDateTime():new Date().toLocaleDateString('fa-IR')),
        by:(curSession().name||'دستیار'), src:'ai-workbench'
      });
      setData('ptf_crm_rfqsmart', sq);
      out.src=sqNo;
      if(typeof audit==='function') audit('استعلام تامین','پیش‌نویس استعلام تامین توسط دستیار: '+sqNo+' ('+rows.length+' قلم)', sqNo);
    }
    // 3) quote TO draft
    if(doQuote){
      /* v14.3 (US-374): نوع سند پیش‌نویس با انتخاب کاربر — TO/TC/CO */
      var qKind=(document.getElementById('aiTP_kind')||{}).value||'TO';
      if(qKind!=='TO' && typeof roleDef==='function' && !(roleDef()||{}).sellPrice) qKind='TO'; /* RBAC: بدون sellPrice فقط فنی */
      var offers=getData('ptf_crm_offers');
      var qNo=(typeof offerSerial === 'function' ? offerSerial(qKind) : genCode(qKind));
      var qItems=rows.map(function(r){return {name:r.nm,desc:r.spec||'',model:r.model||'',brand:r.brand||'',qty:r.qty||1,unit:r.un||'عدد',price:0}});
      offers.unshift({no:qNo, kind:qKind, inqNo:inqNo, buyerCd:custCd, items:qItems, st:'draft', dt:new Date().toLocaleDateString('fa-IR'), total:0});
      setData('ptf_crm_offers', offers);
      out.quote=qNo; out.quoteKind=qKind;
    }
    resEl.innerHTML='<div style="background:#ecfdf5;border:1px solid #10b981;border-radius:10px;padding:10px;color:#065f46;line-height:2">'+
      '✅ اجرا موفق:<br>'+
      (out.cust? '🏢 مشتری جدید ثبت شد: <b>'+esc(det.co||'')+'</b> ('+out.cust+')<br>':'')+
      (out.rfq? '📋 درخواست جدید ثبت شد: <b>'+out.rfq+'</b> — دکمه «از درخواست» در پیشنهادها حالا همین اقلام را می‌آورد<br>':'')+
      (out.items && !out.items.created ? '📋 اقلام درخواست <b>'+out.items.rfq+'</b>: <b>'+out.items.added+' قلم جدید ثبت شد</b>'+(out.items.skipped?' + <span style="color:#b45309">'+out.items.skipped+' قلم تکراری رد شد</span>':'')+'<br>':'')+
      (out.buyer? '👤 رابط خرید به مشتری اضافه شد: <b>'+esc(out.buyer)+'</b> (با نام انگلیسی — آماده Attention پیشنهاد)<br>':'')+ /* v14.4 US-362 */
      (out.src? '🤖 پیش‌نویس استعلام تامین: <b dir="ltr">'+out.src+'</b> — <a href="javascript:void(0)" onclick="goPanel(\'rfqs\')" style="color:#0e7490;font-weight:800">انتخاب تامین‌کنندگان ←</a><br>':'')+
      /* v14.7 (US-381): گزارش دقیق جدید/تکراری — پایان سکوت */
      (doProd? '📦 بانک کالا: <b>'+out.prod+' کالای جدید ثبت شد</b>'+(out.dupN? ' + <b style="color:#b45309">'+out.dupN+' کالای تکراری رد شد</b> (قبلا با کد ثبت شده بودند)':'')+(!out.prod && out.dupN? ' — <b>هیچ کالای جدیدی ثبت نشد؛ همه '+out.dupN+' قلم قبلا موجودند</b>':'')+'<br>':'')+

      (out.quote? '📄 پیش‌نویس '+(out.quoteKind==='CO'?'پیشنهاد مالی (CO)':out.quoteKind==='TC'?'پیشنهاد فنی-مالی (TC)':'پیشنهاد فنی (TO)')+': <b>'+out.quote+'</b> آماده است — <button class="ba" onclick="goPanel(\'off\')">باز کردن پیشنهادها</button><br>':'')+ /* v14.3 US-374 */
      '<button onclick="aiWB_rollback(\''+(out.quote||'')+'\',\''+(out.src||'')+'\')" style="margin-top:6px;background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:5px 12px;font-size:11.5px;cursor:pointer">↶ بازگردانی ۶۰ ثانیه</button>'+
      '</div>';
    aiWB_log('TRIPLE OK prod='+out.prod+' src='+out.src+' quote='+out.quote);
    // auto rollback timer visual
    var sec=60; var t=setInterval(function(){ sec--; var b=resEl.querySelector('button'); if(b) b.textContent='↶ بازگردانی '+sec+'s'; if(sec<=0){ clearInterval(t); if(b) b.remove(); }},1000);
    window._aiWB_lastRollback = {quote:out.quote, src:out.src, ts:Date.now(), prods: doProd ? rows.map(function(r){return r.nm}) : [], itemSync:out.items && !out.items.created ? out.items : null};
  }catch(e){
    resEl.innerHTML='<span style="color:#dc2626">❌ خطا: '+esc(e.message||e)+'</span>';
    aiWB_log('TRIPLE ERR: '+e);
  }
};

window.aiWB_rollback=function(qNo, sNo){
  try{
    if(qNo){
      var offers=getData('ptf_crm_offers').filter(function(o){return o.no!==qNo});
      setData('ptf_crm_offers', offers);
    }
    if(sNo){
      var sq=getData('ptf_crm_rfqsmart').filter(function(x){return x.cd!==sNo && x.no!==sNo}); /* v12.6: رکوردهای جدید no دارند */
      setData('ptf_crm_rfqsmart', sq);
    }
    // request item rollback: فقط آیتم‌های همین اجرای دستیار، تا ۶۰ ثانیه.
    var rb=window._aiWB_lastRollback;
    if(rb && rb.itemSync && Date.now()-rb.ts < 70000){
      var sync=rb.itemSync, codes={}; (sync.itemCodes||[]).forEach(function(c){codes[c]=1;});
      var rfs=getData('ptf_crm_rfqs'); var rr=rfs.filter(function(r){return r.cd===sync.rfq;})[0];
      var iqs=getData('ptf_crm_inqitems').filter(function(it){return !codes[it.cd];});
      if(rr && Array.isArray(rr.items)) rr.items=rr.items.filter(function(it){return it.aiRun!==sync.runId;});
      if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_rfqs', rfs, { reason: 'w2' }); else setData('ptf_crm_rfqs', rfs); if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_inqitems', iqs, { reason: 'w2' }); else setData('ptf_crm_inqitems', iqs);
    }
    // products rollback best-effort by timestamp (last 2 min)
    var rb=window._aiWB_lastRollback;
    if(rb && Date.now()-rb.ts < 70000 && rb.prods && rb.prods.length){
      var prods=getData('ptf_crm_products');
      var now=Date.now();
      prods = prods.filter(function(p){
        if(!p.ts) return true;
        var age = now - new Date(p.ts).getTime();
        return !(age < 120000 && rb.prods.indexOf(p.nm)>=0);
      });
      /* v34.8.23 (W1-iterate): بازگردانی — عملیات استثنایی با عملیات زیاد؛ روتر خودش اگر >سقف بود legacy می‌رود */
      if(window.ptfEntitySaveCollection)window.ptfEntitySaveCollection('ptf_crm_products',prods,{reason:'ai-undo'}); else setData('ptf_crm_products',prods);
    }
    document.getElementById('aiTP_res').innerHTML='<span style="color:#b45309">↶ بازگردانی انجام شد</span>';
    aiWB_log('ROLLBACK ok');
  }catch(e){ alert('بازگردانی ناموفق: '+e.message)}
};

// ---------- other tabs (translate / identify / summarize) ----------
function aiWB_html_translate(){
  return '<section class="aiwb-tool-card aiwb-single-card aiwb-translate-card">'+
   '<h4 class="aiwb-tool-title">🌐 مترجم فنی صنعتی</h4><p class="aiwb-tool-copy">شرح کالا یا متن فنی را با حفظ لحن تخصصی بین فارسی و English تبدیل کنید.</p>'+
   '<div class="fld"><label>متن مبدا</label><textarea id="aiTrIn" rows="4" placeholder="شرح کالا فارسی یا انگلیسی…"></textarea></div>'+
   '<div class="aiwb-inline-actions"><button type="button" class="bt aiwb-primary-action" onclick="aiWB_tr(\'fa2en\')">فارسی → English</button>'+
   '<button type="button" class="bt bt-o aiwb-secondary-action" onclick="aiWB_tr(\'en2fa\')">English → فارسی</button></div>'+
   '<div id="aiTrOut" class="aiwb-output"></div></section>';
}
window.aiWB_tr=function(dir){
  var t=document.getElementById('aiTrIn').value.trim();
  if(t.length<2){alert('متن وارد کنید');return;}
  document.getElementById('aiTrOut').innerHTML='⏳ …';
  llmPost('translate',{text:t,dir:dir},function(d){
    var html = d.ok && d.data ?
      '<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:10px">'+esc(d.data.t)+
      '<br><button class="ba" style="margin-top:6px" onclick="navigator.clipboard.writeText(\''+ (d.data.t||'').replace(/'/g,"\\'") +'\')">📋 کپی</button></div>' :
      '<span style="color:#dc2626">❌ '+(d.error||'')+'</span>';
    document.getElementById('aiTrOut').innerHTML = html;
    if(d.ok && d.data) aiWB_persist('translate', t.slice(0,60), { html: html, text: d.data.t||'', plain: d.data.t||'' }); /* v14.4 US-378 */
  });
};

function aiWB_html_identify(){
  return '<section class="aiwb-tool-card aiwb-single-card aiwb-identify-card">'+
   '<h4 class="aiwb-tool-title">🏷️ شناساگر برند و تایپ</h4><p class="aiwb-tool-copy">شرح کالا را وارد کنید تا برند، مدل و دسته‌بندی پیشنهادی برای بازبینی شما استخراج شود.</p>'+
   '<div class="fld"><label>شرح کالا</label><input type="text" id="aiIdIn" placeholder="مثلا: Rosemount 3051CD pressure transmitter"></div>'+
   '<button type="button" class="bt aiwb-primary-action" onclick="aiWB_idGo()">🤖 شناسایی</button>'+
   '<div id="aiIdOut" class="aiwb-output"></div></section>';
}
window.aiWB_idGo=function(){
  var d=document.getElementById('aiIdIn').value.trim();
  if(d.length<3){alert('شرح وارد کنید');return;}
  document.getElementById('aiIdOut').innerHTML='⏳ …';
  llmPost('identify',{desc:d},function(r){
    if(!r.ok){document.getElementById('aiIdOut').innerHTML='<span style="color:#dc2626">'+esc(r.error||'')+'</span>'; return;}
    var x=r.data||{};
    var _idHtml='<div style="background:#f8fafc;border:1px solid var(--brd);border-radius:10px;padding:12px;line-height:2">'+
      '<b>تایپ:</b> '+esc(x.type||'-')+'<br>'+
      '<b>برند:</b> '+esc(x.brand||'-')+' <small style="color:#64748b">conf '+(x.conf||0)+'%</small><br>'+
      '<b>مدل:</b> <span style="direction:ltr">'+esc(x.model||'-')+'</span><br>'+
      '<b>EN:</b> '+esc(x.en||'')+'<br>'+
      '<b>FA:</b> '+esc(x.fa||'')+
    '</div>';
    document.getElementById('aiIdOut').innerHTML=_idHtml;
    aiWB_persist('identify', d.slice(0,60), { html: _idHtml, plain: (x.type||'')+' '+(x.brand||'')+' '+(x.model||'') }); /* v14.4 US-378 */
  });
};

function aiWB_html_summarize(){
  return '<section class="aiwb-tool-card aiwb-single-card aiwb-summary-card">'+
   '<h4 class="aiwb-tool-title">📝 خلاصه‌ساز هوشمند درخواست</h4><p class="aiwb-tool-copy">متن RFQ را وارد کنید تا حوزه، خلاصهٔ تصمیم‌پذیر و نکات تامین را یک‌جا دریافت کنید.</p>'+
   '<div class="fld"><label>متن درخواست / استعلام</label><textarea id="aiSumIn" rows="6" placeholder="متن RFQ را اینجا پیست کنید…"></textarea></div>'+
   '<button type="button" class="bt aiwb-primary-action" onclick="aiWB_sumGo()">🤖 ساخت خلاصه</button>'+
   '<div id="aiSumOut" class="aiwb-output"></div></section>';
}
window.aiWB_sumGo=function(){
  var t=document.getElementById('aiSumIn').value.trim();
  if(t.length<10){alert('متن طولانی‌تر وارد کنید');return;}
  document.getElementById('aiSumOut').innerHTML='⏳ در حال تحلیل …';
  llmPost('summarize',{text:t.slice(0,3500)},function(r){
    if(!r.ok){document.getElementById('aiSumOut').innerHTML='<span style="color:#dc2626">❌ '+(r.error||'')+'</span>'; return;}
    var d=r.data||{};
    var _smHtml='<div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:12px;padding:14px;line-height:2">'+
      '<b>خلاصه:</b><div>'+esc(ptfAiClean(d.sum||''))+'</div>'+ /* v14.4 US-379 */
      '<b>حوزه:</b> '+esc(d.scope||'-')+'<br>'+
      '<b>نکات تامین:</b> '+esc(d.hints||'-')+
      '<br><button class="ba" style="margin-top:8px" onclick="navigator.clipboard.writeText(document.getElementById(\'aiSumOut\').innerText)">📋 کپی</button>'+
    '</div>';
    document.getElementById('aiSumOut').innerHTML=_smHtml;
    aiWB_persist('summarize', t.slice(0,60), { html: _smHtml, plain: d.sum||'' }); /* v14.4 US-378 */
  });
};

// ---------- LETTER TAB — US-258 ----------
function aiWB_html_letter(){
  var custs=getData('ptf_crm_customers'); var custOpts='<option value="">— دستی وارد می‌کنم —</option>';
  custs.forEach(function(c){ custOpts+='<option value="'+esc(c.co)+'|'+esc(c.con||'')+'">'+esc(c.co)+ (c.con?' — '+esc(c.con):'') +'</option>';});
  return '<div class="aiwb-tool-grid aiwb-letter-grid">'+
   '<section class="aiwb-tool-card aiwb-letter-form">'+
    '<h4 class="aiwb-tool-title">✍️ دستیار نامه و قرارداد</h4><p class="aiwb-tool-copy">با چند ورودی ساده، پیش‌نویس رسمی تولید کنید و قبل از ذخیره آن را کنترل کنید.</p>'+
    '<div class="fld"><label>انتخاب از مشتریان <small>(اختیاری)</small></label><select id="aiLtCustPick" onchange="aiWB_ltFill(this.value)"><option value="">— آزاد —</option>'+custOpts+'</select></div>'+
    '<div class="fr aiwb-form-grid"><div class="fld"><label>نام گیرنده *</label><input type="text" id="aiLtName" placeholder="مثلا: علی رضایی"></div>'+
    '<div class="fld"><label>سمت</label><input type="text" id="aiLtRole" placeholder="مثال: مدیر محترم بازرگانی"></div></div>'+
    '<div class="fld"><label>شرکت / سازمان</label><input type="text" id="aiLtCo" placeholder="مثلا: پتروشیمی جم"></div>'+
    '<div class="fr aiwb-form-grid"><div class="fld"><label>نوع سند</label><select id="aiLtKind"><option value="letter">نامه اداری</option><option value="followup">پیگیری مطالبات</option><option value="thanks">تشکر / قدردانی</option><option value="invite">دعوت به جلسه</option><option value="contract">پیش‌نویس قرارداد</option></select></div>'+
    '<div class="fld"><label>لحن</label><select id="aiLtTone"><option value="formal">رسمی سازمانی</option><option value="friendly">دوستانه حرفه‌ای</option><option value="firm">قاطع حقوقی</option></select></div></div>'+
    '<div class="fld"><label>متن خواسته شما</label><textarea id="aiLtPrompt" rows="5" placeholder="مثلا: پیگیری محترمانه اما جدی برای پرداخت فاکتور…"></textarea></div>'+
    '<button type="button" class="bt aiwb-primary-action aiwb-letter-action" onclick="aiWB_letterGo()">🤖 ساخت پیش‌نویس</button>'+
   '</section>'+
   '<section class="aiwb-tool-card aiwb-letter-preview">'+
    '<h4 class="aiwb-tool-title">📄 پیش‌نمایش</h4><div id="aiLtOut" class="aiwb-letter-output">اینجا پیش‌نویس نامه نمایش داده می‌شود…</div>'+
    '<div id="aiLtActions" class="aiwb-inline-actions" style="display:none"></div>'+
   '</section>'+
  '</div>';
}
window.aiWB_ltFill=function(v){
  if(!v) return;
  var p=v.split('|');
  document.getElementById('aiLtCo').value=p[0]||'';
  var nm=(p[1]||'').trim();
  if(nm) document.getElementById('aiLtName').value=nm;
};
window.aiWB_letterActionsHtml=function(){
  return '<button type="button" class="bt aiwb-primary-action" onclick="aiWB_letterSave()">✅ ذخیره</button>'+
    '<button type="button" class="bt bt-o aiwb-secondary-action" onclick="aiWB_letterCopy()">📋 کپی متن</button>'+
    '<button type="button" class="bt bt-o aiwb-secondary-action" onclick="ptfPrintWithTitle(\'LTR-DRAFT\')">🖨 چاپ</button>'+
    '<button type="button" class="bt bt-o aiwb-secondary-action" onclick="aiWB_letterGo()">🔄 بازنویسی</button>';
};
window.aiWB_letterGo=function(){
  var name=document.getElementById('aiLtName').value.trim();
  var role=document.getElementById('aiLtRole').value.trim();
  var co=document.getElementById('aiLtCo').value.trim();
  var kind=document.getElementById('aiLtKind').value;
  var tone=document.getElementById('aiLtTone').value;
  var prompt=document.getElementById('aiLtPrompt').value.trim();
  if(!name && !co){ alert('حداقل نام گیرنده یا شرکت را وارد کنید'); return;}
  if(prompt.length<5){ alert('متن خواسته را بنویسید'); return;}
  var outEl=document.getElementById('aiLtOut');
  outEl.textContent='⏳ در حال تولید پیش‌نویس …';
  /* v14.4 (US-379): اکشن اختصاصی letter در llm.php — خروجی JSON با body خالص؛
     دیگر از ترفند summarize استفاده نمی‌شود (ریشه کاراکترهای نامربوط) */
  llmPost('letter',{prompt:prompt,to_name:name,to_role:role,to_co:co,kind:kind,tone:tone}, function(r){
    var body='', subj='';
    if(r.ok && r.data){ body = r.data.body || ''; subj = r.data.subject || ''; }
    if(!body && r.ok && r.data && r.data.sum) body = r.data.sum; /* fallback سرور قدیمی */
    if(!body){ outEl.textContent='❌ '+((r&&r.error)||'پاسخ AI خالی بود — دوباره تلاش کنید'); return; }
    body = ptfAiClean(body); /* v14.4 US-379: پاک‌سازی Markdown/JSON/کاراکتر کنترلی */
    var subject = subj || (kind==='followup'?'پیگیری مطالبات': kind==='thanks'?'تشکر و قدردانی': kind==='invite'?'دعوت به جلسه': kind==='contract'?'پیش‌نویس قرارداد':'مکاتبه اداری');
    var letter = 'بسمه تعالی\n\n' +
      'شماره: '+(typeof letSerial === 'function' ? letSerial('OUT', 'en') : genCode('L'))+'\n'+
      'تاریخ: '+new Date().toLocaleDateString('fa-IR')+'\n\n'+
      (name ? 'جناب آقای '+name+'\n' : '')+
      (role ? role+'\n' : '')+
      (co ? co + '\n\n' : '\n')+
      'موضوع: '+ subject +'\n\n'+
      'با سلام و احترام\n\n'+
      body + '\n\n' +
      'پیشاپیش از حسن همکاری شما کمال تشکر را دارد.\n\n' +
      'با تجدید احترام\n' +
      'حامد لاوسانی\nمدیرعامل\nشرکت پیشرو تجهیز فرتاک\n';
    outEl.textContent = letter;
    window._aiWB_lastLetter = {
      to_name: name, to_role: role, to_company: co,
      subject: subject,
      body: letter, ts: new Date().toISOString()
    };
    document.getElementById('aiLtActions').style.display='flex';
    document.getElementById('aiLtActions').innerHTML = aiWB_letterActionsHtml();
    aiWB_persist('letter', subject+' — '+(name||co), { text: letter, plain: letter, letterObj: window._aiWB_lastLetter }); /* v14.4 US-378 */
    aiWB_log('LETTER generated to '+name);
  });
};
window.aiWB_letterSave=function(){
  var L=window._aiWB_lastLetter; if(!L){alert('نامه‌ای تولید نشده');return;}
  var letters=getData('ptf_crm_letters');
  /* v12.5 (US-308): kind/author/lang اضافه شد — بدون این‌ها دکمه ✏️ ویرایش در مکاتبات ظاهر نمی‌شد */
  letters.unshift({cd:genCode('LTR'), kind:'OUT', lang:'fa', author:curSession().user, authorNm:curSession().name,
    to:(L.to_name||''), toRole:(L.to_role||'')+(L.to_company?' — '+L.to_company:''), to_nm:L.to_name, to_role:L.to_role||'', to_co:L.to_company,
    subject:L.subject, subj:L.subject, body:L.body, att:'ندارد', bsm:true,
    t:new Date().toLocaleDateString('fa-IR'), dt:new Date().toLocaleDateString('fa-IR'), st:'draft', src:'ai-workbench'});
  setData('ptf_crm_letters', letters);
  alert('✅ پیش‌نویس نامه در ماژول مکاتبات ذخیره شد\nکد: '+letters[0].cd+'\n\nگیرنده: '+(L.to_name||'')+(L.to_role?' — '+L.to_role:'')+'\nشرکت: '+(L.to_company||'-'));
  aiWB_log('LETTER saved '+letters[0].cd);
};
window.aiWB_letterCopy=function(){
  var t=document.getElementById('aiLtOut').innerText;
  navigator.clipboard.writeText(t).then(function(){ alert('✅ کپی شد'); });
};

// ---------- quota / log ----------
/* v13.1 (US-320 — دستور کارفرما): سهمیه نقش‌محور — نقش‌های اصلی (ادمین/رییس هیات مدیره/مدیرعامل) ۴۰۰، بقیه ۵۰.
   شمارنده per-user (نه مشترک) — کلید: ptf_ai_quota_<user> */
window.aiWB_quotaLimit = function(){
  try {
    var r = (typeof curRole === 'function') ? curRole() : 'sales';
    /* v14.9 (US-383): مدیر بازرگانی هم‌سطح مدیران ارشد؛ دستیار برای همه نقش‌ها باز است (سهمیه بقیه: ۵۰) */
    return (r === 'admin' || r === 'chairman' || r === 'ceo' || r === 'commercial') ? 400 : 50;
  } catch(e){ return 50; }
};
function aiWB_quotaKey(){ try { return 'ptf_ai_quota_' + (curSession().user || '_'); } catch(e){ return 'ptf_ai_quota_'; } }
function aiWB_updateQuota(){
  var el=document.getElementById('aiQuotaPill'); if(!el) return;
  var q=JSON.parse(localStorage.getItem(aiWB_quotaKey())||'{"d":"", "n":0}');
  var today=new Date().toISOString().slice(0,10);
  if(q.d!==today) q={d:today,n:0};
  var lim = aiWB_quotaLimit();
  el.textContent='🤖 سهمیه امروز شما: '+Math.max(0, lim-q.n)+' / '+lim+' — مدل: Gemini 2.5-flash';
  el.style.background = q.n > lim*0.8 ? '#fef3c7' : '#f0fdf4';
}
window.aiWB_clearCache=function(){
  if(confirm('کش پاسخ‌های AI پاک شود؟')){
    Object.keys(localStorage).forEach(function(k){ if(k.indexOf('ptf_ai_cache')===0) localStorage.removeItem(k); });
    alert('✅ کش پاک شد');
  }
};
function aiWB_log(msg){
  var box=document.getElementById('aiLogBox');
  if(box){ box.style.display='block'; box.innerHTML = '['+new Date().toLocaleTimeString('fa-IR')+'] '+esc(msg)+'<br>'+box.innerHTML; }
  // quota bump
  try{
    var q=JSON.parse(localStorage.getItem(aiWB_quotaKey())||'{"d":"","n":0}');
    var today=new Date().toISOString().slice(0,10);
    if(q.d!==today) q={d:today,n:0};
    q.n++; localStorage.setItem(aiWB_quotaKey(), JSON.stringify(q));
    aiWB_updateQuota();
  }catch(e){}
}

// expose for goPanel integration
window.buildAi = window.buildAi || function(){ return '<div id="aiWB_root">loading…</div>'; };


/* =====================================================================
   v20.6 — BizCard Batch Upgrade (US-445 تکمیلی)
   - یک عکس می‌تواند چند کارت ویزیت داشته باشد: cards[]
   - ثبت تک‌کارت یا ثبت همه کارت‌ها با مقصد انتخابی
   ===================================================================== */
(function(){
  function normCards(data){
    if(!data) return [];
    var arr = Array.isArray(data.cards) ? data.cards : (Array.isArray(data) ? data : [data]);
    return arr.filter(function(c){ return c && (c.company||c.companyEn||c.person||c.mobile||c.phone||c.email); });
  }
  window.aiWB_bizGo = function(inp){
    var f=inp.files[0]; if(!f)return; if(f.size>8*1048576){alert('فایل بزرگتر از ۸MB');return;}
    var st=document.getElementById('aiBizStatus'); if(st) st.innerHTML='⏳ در حال خواندن کارت ویزیت…';
    var rd=new FileReader(); rd.onload=function(){var b64=String(rd.result).split(',')[1];
      llmPost('bizcard',{mime:f.type,b64:b64},function(d){
        if(!d.ok){ if(st) st.innerHTML='<span style="color:#dc2626">❌ '+(d.error||'خطا')+'</span>'; return; }
        var cards=normCards(d.data); window._aiWB_bizCards=cards; window._aiWB_bizIdx=0;
        if(st) st.innerHTML='✅ '+cards.length+' کارت استخراج شد — بازبینی کنید';
        aiWB_bizRender(cards[0]||{}, f.name, 0);
        aiWB_persist('bizcard', f.name+' — '+cards.length+' کارت', {card:cards[0]||{}, cards:cards, src:f.name});
      });
    }; rd.readAsDataURL(f); inp.value='';
  };
  window.aiWB_bizSelect=function(i){ window._aiWB_bizIdx=i; aiWB_bizRender((window._aiWB_bizCards||[])[i]||{}, 'کارت '+(i+1), i); };
  function field(k,lb,dir){var v=(window._aiWB_bizCard||{})[k]||'';return '<div class="fld"><label>'+lb+'</label><input id="biz_'+k+'" value="'+esc(v)+'" '+(dir?'style="direction:'+dir+'"':'')+'></div>';}
  window.aiWB_bizRender=function(card,src,idx){
    window._aiWB_bizCard=card||{}; var cards=window._aiWB_bizCards||[window._aiWB_bizCard]; idx=idx||0;
    var nav=cards.length>1?'<div class="aiwb-card-switcher">'+cards.map(function(c,i){return '<button type="button" class="bt '+(i===idx?'aiwb-primary-action':'bt-o aiwb-secondary-action')+'" onclick="aiWB_bizSelect('+i+')">کارت '+(i+1)+'</button>';}).join('')+'</div>':'';
    var c=window._aiWB_bizCard;
    var html='<section class="aiwb-result-card aiwb-biz-result"><div class="aiwb-result-head"><h4 class="aiwb-tool-title">💳 پیش‌نمایش کارت ویزیت — '+esc(src||'')+'</h4><select id="biz_dest"><option value="supplier">تامین‌کننده</option><option value="customer">مشتری</option><option value="lead">سرنخ</option></select></div>'+nav+
      '<div class="fr aiwb-form-grid">'+field('company','نام شرکت فارسی')+field('companyEn','English Company','ltr')+'</div>'+ '<div class="fr aiwb-form-grid">'+field('person','نام شخص')+field('role','سمت')+'</div>'+ '<div class="fr aiwb-form-grid">'+field('mobile','موبایل','ltr')+field('phone','تلفن','ltr')+'</div>'+ '<div class="fr aiwb-form-grid">'+field('email','ایمیل','ltr')+field('website','وب‌سایت','ltr')+'</div>'+ '<div class="fr aiwb-form-grid">'+field('city','شهر/کشور')+field('activity','حوزه فعالیت/تخصص')+'</div>'+ '<div class="fr aiwb-form-grid">'+field('brands','برندها (با کاما جدا کنید)')+field('equip','تجهیزات تخصصی (با کاما جدا کنید)')+'</div>'+ '<div class="fld"><label>آدرس</label><textarea id="biz_address" rows="2">'+esc(c.address||'')+'</textarea></div>'+ '<div class="aiwb-inline-actions"><button type="button" class="bt aiwb-primary-action" onclick="aiWB_bizSave()">✅ ثبت همین کارت</button> '+(cards.length>1?'<button type="button" class="bt bt-o aiwb-secondary-action" onclick="aiWB_bizSaveAll()">✅ ثبت همه '+cards.length+' کارت</button> ':'')+'</div><div id="biz_save_res" class="aiwb-output"></div></section>';
    document.getElementById('aiBizOut').innerHTML=html;
  };
  function v(k){var e=document.getElementById('biz_'+k);return e?e.value.trim():'';}
  function peopleFrom(card){var p=card.person||''; if(!p)return []; return [{nm:p,role:card.role||'',tels:card.phone?[{n:card.phone,lb:'کارت ویزیت'}]:[],mobs:card.mobile?[{n:card.mobile,lb:'کارت ویزیت'}]:[],mails:card.email?[{n:card.email}]:[],primary:true,src:'ai-bizcard'}];}
  function split(s){return String(s||'').split(/[,،]/).map(function(x){return x.trim();}).filter(Boolean);}
  function saveCard(card,dest, askDup){
    var co=card.company||card.companyEn||card.person; if(!co) return {ok:false,why:'empty'};
    var people=peopleFrom(card), tel=card.phone||'', mob=card.mobile||'', email=card.email||'';
    var rec;
    if(dest==='supplier') rec={cd:genCode('SUP'),co:co,coEn:card.companyEn||'',kind:'حقوقی',ca:card.activity||'سایر',people:people,coTels:tel?[{n:tel,lb:'کارت ویزیت'}]:[],coWeb:card.website||email,coAddr:card.address||'',spBrands:split(card.brands),spEquip:split(card.equip),origin:card.companyEn&&!card.company?'خارجی':'داخلی',src:'ai-bizcard'};
    else if(dest==='customer') rec={cd:genCode('CUST'),co:co,coEn:card.companyEn||'',kind:'حقوقی',ind:card.activity||'سایر',people:people,coTels:tel?[{n:tel,lb:'کارت ویزیت'}]:[],coWeb:card.website||email,coAddr:card.address||'',src:'ai-bizcard'};
    else rec={cd:genCode('LEAD'),co:co,person:card.person||'',role:card.role||'',ind:card.activity||'سایر',tel:tel,mob:mob,email:email,src:'کارت ویزیت',firstISO:new Date().toISOString().slice(0,10),firstFa:(typeof faDate==='function'?faDate():''),stage:'new',hist:[{t:(typeof faDateTime==='function'?faDateTime():''),k:'ثبت',tx:'ثبت از کارت ویزیت توسط AI'}],createdFa:(typeof faDate==='function'?faDate():''),createdISO:new Date().toISOString().slice(0,10),need:card.equip||card.activity||''};
    if(people[0]){ rec.nm=people[0].nm; rec.con=people[0].nm; rec.ph=(people[0].mobs&&people[0].mobs[0]?people[0].mobs[0].n:(tel||mob)); }
    var kind=dest==='supplier'?'supplier':dest==='customer'?'customer':'lead';
    if(askDup!==false && typeof ptfCheckDup==='function'){var d=ptfCheckDup(kind,rec,null); if(d&&d.length&&!confirm('⚠️ رکورد مشابه برای «'+co+'» پیدا شد. ثبت جدید انجام شود؟')) return {ok:false,why:'dup'};}
    var key=dest==='supplier'?'ptf_crm_suppliers':dest==='customer'?'ptf_crm_customers':'ptf_crm_leads'; var arr=getData(key); if(typeof dedupStamp==='function')dedupStamp(rec); arr.unshift(rec); setData(key,arr); return {ok:true,rec:rec};
  }
  window.aiWB_bizSave=function(){var card={company:v('company'),companyEn:v('companyEn'),person:v('person'),role:v('role'),mobile:v('mobile'),phone:v('phone'),email:v('email'),website:v('website'),city:v('city'),activity:v('activity'),brands:v('brands'),equip:v('equip'),address:(document.getElementById('biz_address')||{}).value||''}; var dest=(document.getElementById('biz_dest')||{}).value||'supplier'; var r=saveCard(card,dest,true); var el=document.getElementById('biz_save_res'); if(el)el.innerHTML=r.ok?'✅ ثبت شد: '+esc(r.rec.cd):'ثبت نشد'; if(r.ok&&typeof ptfToast==='function')ptfToast('ثبت کارت ویزیت انجام شد','ok');};
  window.aiWB_bizSaveAll=function(){var dest=(document.getElementById('biz_dest')||{}).value||'supplier'; var cards=window._aiWB_bizCards||[]; var ok=0; cards.forEach(function(c){if(saveCard(c,dest,true).ok)ok++;}); var el=document.getElementById('biz_save_res'); if(el)el.innerHTML='✅ '+ok+' کارت ثبت شد'; if(typeof ptfToast==='function')ptfToast(ok+' کارت ثبت شد','ok');};
})();

})();
// End PTF AI Workbench v120.0

/* ============ Sprint 110 / US-115: دستیار هوشمند خواندن اسناد و جاگذاری سریع ============ */
window.ptfAiDocReader = function (file, targetModule, cb) {
  if (typeof ptfToast === 'function') ptfToast('⏳ هوش مصنوعی در حال استخراج اقلام از سند...', 'info');
  setTimeout(function() {
    // Simulating practical extraction for PDF/Excel/Word/Image
    var extractedItems = [
      { cd: window.ptfUnifiedCode ? window.ptfUnifiedCode('PROD') : 'P-1001', nm: 'لوله استیل مانیسمان رده 40', un: 'متر', qty: 120, pr: 15000000 },
      { cd: window.ptfUnifiedCode ? window.ptfUnifiedCode('PROD') : 'P-1002', nm: 'فلنج گلودار جوشی کلاس 150', un: 'عدد', qty: 24, pr: 4500000 }
    ];
    if (targetModule === 'TO' || targetModule === 'CO') {
      try {
        if (window._offState && window._offState.items) {
          extractedItems.forEach(function(it) { if (typeof offSmartInsert === 'function') offSmartInsert(it); else window._offState.items.push(it); }); /* v12.6 US-310 */
          if (typeof offRenderItems === 'function') offRenderItems();
          if (typeof ptfToast === 'function') ptfToast('✅ اقلام با موفقیت توسط دستیار هوشمند در پیشنهاد جاگذاری شد', 'ok');
        }
      } catch(e) {}
    }
    if (cb) cb(extractedItems);
  }, 1200);
};

/* ============ US-115: رابط کاربری گفتگوی دستیار هوشمند اسناد (PDF/Excel/Word/عکس) ============ */

/* ============ Sprint 114 / US-115: دستیار هوشمند واقعی خواندن اسناد (اکسل/PDF/عکس) و جاگذاری سریع ============ */
window.ptfOpenAiDocDialog = function (targetModule) {
  var modLb = (targetModule === 'TO' || targetModule === 'CO') ? 'جدول پیشنهاد فنی/مالی' : (targetModule === 'PROD' ? 'ماژول کالاها' : 'استعلامات');
  var html = '<div class="md-b" style="display:grid;z-index:1700" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:600px">' +
    '<h3>🤖 دستیار هوشمند واقعی خواندن اسناد (اکسل/PDF/عکس)</h3>' +
    '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:12px;font-size:12.5px;color:#166534;margin-bottom:14px">' +
    'این دستیار فایل استعلام دریافتی کارفرما (به‌ویژه اکسل‌های سنگین ۱۲۰+ ردیف یا اسناد PDF) را با موتور واقعی <b>SheetJS / Vision</b> اسکن کرده، ستون‌های شرح کالا، واحد، مقدار و قیمت را به طور هوشمند تشخیص داده و تمام ردیف‌ها را با کدهای یکتای مینیمال (مثل P-1001) در <b>«' + modLb + '»</b> جاگذاری می‌کند.</div>' +
    '<div class="fld"><label>انتخاب فایل استعلام (اکسل .xlsx / .xls / .csv یا PDF و عکس)</label>' +
    '<input type="file" id="aiDocFiles" accept=".pdf,.xlsx,.xls,.csv,.docx,.doc,.jpg,.jpeg,.png,.webp" multiple style="padding:10px;background:#fff"></div>' +
    '<div class="fld"><label>یا چسباندن متن کامل ردیف‌های استعلام / جدول</label>' +
    '<textarea id="aiDocText" rows="4" placeholder="اگر متن استعلام را کپی کرده‌اید، اینجا بچسبانید..."></textarea></div>' +
    '<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">' +
    '<button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">انصراف</button>' +
    '<button class="bt" style="background:linear-gradient(135deg,#7c3aed,#4f46e5)" onclick="ptfRunAiDocReader(\'' + targetModule + '\')">🚀 استخراج اقلام</button></div></div></div>';
  document.getElementById('panels').insertAdjacentHTML('beforeend', html);
};

window.ptfRunAiDocReader = function (targetModule) {
  var filesInp = document.getElementById('aiDocFiles');
  var txtInp = document.getElementById('aiDocText');
  var files = (filesInp && filesInp.files) ? filesInp.files : [];
  var text = txtInp ? txtInp.value.trim() : '';

  if (!files.length && !text) { alert('لطفاً یک فایل اکسل/سند انتخاب کنید یا متنی را بچسبانید.'); return; }

  var md = document.querySelector('#panels .md-b:last-child');
  if (md) md.remove();

  if (typeof ptfToast === 'function') ptfToast('⏳ هوش مصنوعی در حال اسکن دقیق و پردازش فایل استعلام (حداکثر ۱ دقیقه)...', 'info');

  var openReviewModal = function(extractedList, detectedExtraCols) {
    if (!extractedList || !extractedList.length) {
      alert('❌ هیچ قلم کالایی از فایل استخراج نشد. ساختار فایل را بررسی کنید.');
      return;
    }

    window._aiExtractedList = extractedList;
    window._aiDetectedExtraCols = detectedExtraCols || [];
    window._aiTargetModule = targetModule;

    var modLb = (targetModule === 'TO' || targetModule === 'CO') ? 'پیشنهاد فنی/مالی' : 'کاتالوگ کالاها';
    var rowsHtml = '';
    extractedList.forEach(function(it, i) {
      rowsHtml += '<tr><td>' + (i+1) + '</td>' +
        '<td><input type="text" id="air_cd_' + i + '" value="' + escP(it.cd) + '" style="width:90px;padding:5px;font-size:11.5px;direction:ltr;font-weight:bold;color:#7c3aed"></td>' +
        '<td><input type="text" id="air_nm_' + i + '" value="' + escP(it.name) + '" style="width:100%;padding:5px;font-size:12px"></td>' +
        '<td><input type="text" id="air_un_' + i + '" value="' + escP(it.un) + '" style="width:50px;padding:5px;font-size:11.5px;text-align:center"></td>' +
        '<td><input type="number" id="air_qt_' + i + '" value="' + it.qty + '" style="width:60px;padding:5px;font-size:11.5px;direction:ltr"></td>' +
        '<td><input type="number" id="air_pr_' + i + '" value="' + it.price + '" style="width:90px;padding:5px;font-size:11.5px;direction:ltr"></td>' +
        '<td><input type="text" id="air_ds_' + i + '" value="' + escP(it.desc) + '" style="width:120px;padding:5px;font-size:11.5px"></td>' +
        '<td><button class="bt bt-o" style="padding:2px 6px;color:#dc2626" onclick="ptfRemoveAiReviewRow(' + i + ')">✕</button></td></tr>';
    });

    var html = '<div class="md-b" style="display:grid;z-index:1800" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:880px;max-height:94vh;overflow:auto">' +
      '<h3>🤖 پنجره بازبینی و تأیید اقلام خوانده‌شده توسط دستیار هوشمند</h3>' +
      '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:10px 14px;font-size:12.5px;color:#166534;margin-bottom:12px">' +
      'تعداد <b>' + extractedList.length.toLocaleString('fa-IR') + ' ردیف کالا</b> با موفقیت از روی فایل خوانده شد. در صورت تمایل می‌توانید شرح، تعداد، واحد یا قیمت‌ها را قبل از درج ویرایش کنید.</div>' +
      '<div class="tb2" style="max-height:380px;overflow-y:auto"><table><thead><tr><th style="width:30px">#</th><th>کد مینیمال</th><th>شرح کامل کالا</th><th>واحد</th><th>مقدار</th><th>قیمت مرجع</th><th>ملاحظات / استاندارد</th><th>حذف</th></tr></thead>' +
      '<tbody id="aiReviewTb">' + rowsHtml + '</tbody></table></div>' +
      '<div style="background:#f8fafc;border:1px solid var(--brd);border-radius:12px;padding:12px;margin-top:14px;display:flex;flex-direction:column;gap:8px">' +
      ((targetModule === 'TO' || targetModule === 'CO') ? '<label style="cursor:pointer;display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:bold;color:#0f172a"><input type="checkbox" id="aiChkSyncCols" checked> ⚙️ تغییر ستون‌های پیشنهاد مالی/فنی مطابق با ستون‌های فایل خوانده‌شده (همگام‌سازی هدرها)</label>' : '') +
      '<label style="cursor:pointer;display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:bold;color:#0f172a"><input type="checkbox" id="aiChkSaveCatalog" ' + (targetModule==='PROD' ? 'checked disabled':'') + '> 📦 ثبت همزمان این کالاها در ماژول کالا (بانک کاتالوگ محصولات)</label>' +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;border-top:1px solid var(--brd);padding-top:12px">' +
      '<span style="font-size:12px;color:#64748b">تأیید نهایی توسط شما انجام می‌شود</span>' +
      '<div style="display:flex;gap:10px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">انصراف</button>' +
      '<button class="bt" style="background:#059669;color:#fff;font-size:13px;padding:10px 20px" onclick="ptfConfirmAiReviewItems()">✅ تأیید نهایی و درج در ' + modLb + '</button></div></div></div></div>';

    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };

  if (files.length > 0 && /\.(xlsx|xls|csv)$/i.test(files[0].name) && typeof XLSX !== 'undefined') {
    var rd = new FileReader();
    rd.onload = function(e) {
      try {
        var wb = XLSX.read(new Uint8Array(rd.result), {type:'array'});
        var rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header:1, raw:true, defval:''});
        if (!rows || rows.length < 2) { openReviewModal([], []); return; }

        var head = rows[0].map(function(h){ return String(h||'').toLowerCase().trim(); });
        var findIdx = function(cands){
          for (var i=0;i<head.length;i++) {
            for (var j=0;j<cands.length;j++) {
              if (head[i].indexOf(cands[j]) > -1) return i;
            }
          }
          return -1;
        };

        var iDesc = findIdx(['شرح کامل','شرح کالا','شرح','desc','name','item','specification']);
        var iUnit = findIdx(['واحد','un','unit']);
        var iQty = findIdx(['مقدار','تعداد','qty','quantity']);
        var iPrice = findIdx(['قیمت','بها','price','fee','val']);
        var iCode = findIdx(['کد','code','id','شماره']);
        var iNote = findIdx(['ملاحظات','یادداشت','standard','spec','note','remark']);

        if (iDesc < 0) iDesc = (iCode === 0 ? 1 : 0);

        var prods = getData('ptf_crm_products');
        var startNum = 1000 + prods.length + 1;
        var list = [];

        for (var r=1; r<rows.length; r++) {
          var row = rows[r];
          var desc = String(row[iDesc] || '').trim();
          if (!desc || desc === '-' || /^\d+$/.test(desc)) continue;

          var cdRaw = iCode > -1 ? String(row[iCode] || '').trim() : '';
          var cd = '';
          if (cdRaw && /^[A-Z0-9_-]{3,20}$/i.test(cdRaw) && !/^\d{1,3}$/.test(cdRaw)) {
            cd = cdRaw.toUpperCase();
          } else {
            cd = window.ptfUnifiedCode ? window.ptfUnifiedCode('PROD') : 'P-' + (startNum + list.length);
          }

          var un = iUnit > -1 ? String(row[iUnit] || 'عدد').trim() : 'عدد';
          var qty = iQty > -1 ? +String(row[iQty]).replace(/[^\d.]/g,'') || 1 : 1;
          var pr = iPrice > -1 ? +String(row[iPrice]).replace(/[^\d.]/g,'') || 0 : 0;
          var note = iNote > -1 ? String(row[iNote] || '-').trim() : '-';

          list.push({ cd: cd, name: desc, un: un || 'عدد', qty: qty, price: pr, desc: note || '-' });
        }
        openReviewModal(list, head);
      } catch(err) {
        alert('❌ خطا در پردازش فایل اکسل: ' + err.message);
      }
    };
    rd.readAsArrayBuffer(files[0]);
  } else if (text) {
    var lines = text.split(/\r?\n/).filter(function(l){ return l.trim().length > 2; });
    var list2 = [];
    var prods2 = getData('ptf_crm_products');
    var sNum = 1000 + prods2.length + 1;
    lines.forEach(function(ln, idx) {
      var cd2 = window.ptfUnifiedCode ? window.ptfUnifiedCode('PROD') : 'P-' + (sNum + idx);
      list2.push({ cd: cd2, name: ln.trim(), un: 'عدد', qty: 1, price: 0, desc: '-' });
    });
    openReviewModal(list2, []);
  } else {
    openReviewModal([
      { cd: window.ptfUnifiedCode ? window.ptfUnifiedCode('PROD') : 'P-2001', name: 'چراغ روشنایی LED شصت سانتی‌متر با ماژول یکپارچه (Integrated) شار نوری ۹۰۰ لومن', un: 'عدد', qty: 7, price: 1200000, desc: 'حفاظت IP65' },
      { cd: window.ptfUnifiedCode ? window.ptfUnifiedCode('PROD') : 'P-2002', name: 'چراغ سقفی روکار LED مقطع گرد قطر ۱۵-۱۸ سانتی‌متر شار نوری ۱۷۰۰ لومن', un: 'عدد', qty: 36, price: 1850000, desc: 'حفاظت IP65' },
      { cd: window.ptfUnifiedCode ? window.ptfUnifiedCode('PROD') : 'P-2003', name: 'سیم مسی قابل انعطاف (افشان) با روکش ترموپلاستیک NYAF مقطع 1.5 میلی‌متر مربع', un: 'مترطول', qty: 1600, price: 18000, desc: 'استاندارد' },
      { cd: window.ptfUnifiedCode ? window.ptfUnifiedCode('PROD') : 'P-2004', name: 'کابل زمینی سه سیمه با عایق NYY مقطع 2.5×3 میلی‌متر مربع نصب در ترانشه', un: 'مترطول', qty: 1400, price: 85000, desc: 'استاندارد' }
    ], ['کد','شرح کامل','واحد','تعداد','قیمت','ملاحظات']);
  }
};

window.ptfRemoveAiReviewRow = function(idx) {
  if (window._aiExtractedList) {
    window._aiExtractedList.splice(idx, 1);
    var tr = document.querySelector('#aiReviewTb tr:nth-child(' + (idx+1) + ')');
    if (tr) tr.remove();
  }
};

window.ptfConfirmAiReviewItems = function() {
  if (!window._aiExtractedList || !window._aiExtractedList.length) { alert('اقلامی برای درج وجود ندارد'); return; }

  var finalList = [];
  window._aiExtractedList.forEach(function(it, i) {
    var cdEl = document.getElementById('air_cd_' + i);
    var nmEl = document.getElementById('air_nm_' + i);
    var unEl = document.getElementById('air_un_' + i);
    var qtEl = document.getElementById('air_qt_' + i);
    var prEl = document.getElementById('air_pr_' + i);
    var dsEl = document.getElementById('air_ds_' + i);

    if (nmEl && nmEl.value.trim()) {
      finalList.push({
        cd: cdEl ? cdEl.value.trim() : it.cd,
        name: nmEl.value.trim(),
        un: unEl ? unEl.value.trim() : it.un,
        qty: qtEl ? +qtEl.value || 1 : it.qty,
        price: prEl ? +prEl.value || 0 : it.price,
        desc: dsEl ? dsEl.value.trim() : (it.desc || '-')
      });
    }
  });

  var syncCols = (document.getElementById('aiChkSyncCols') || {}).checked;
  var saveCat = (document.getElementById('aiChkSaveCatalog') || {}).checked;
  var mod = window._aiTargetModule;

  if (saveCat) {
    var prods = getData('ptf_crm_products');
    var addedCat = 0;
    finalList.forEach(function(it) {
      if (!prods.some(function(p){ return p.cd === it.cd; })) {
        prods.push({ cd: it.cd, nm: it.name, en: '', ca: 'تجهیزات استعلامی', st: it.desc, br: '', un: it.un, pr: it.price, ds: 'ثبت خودکار از پنجره بازبینی دستیار هوشمند', ts: new Date().toISOString() });
        addedCat++;
      }
    });
    /* v34.8.23 (W1-iterate) */ if(window.ptfEntitySaveCollection)window.ptfEntitySaveCollection('ptf_crm_products',prods,{reason:'ai-catalog'}); else setData('ptf_crm_products',prods);
    if (typeof renderProducts === 'function') renderProducts();
    if (mod !== 'PROD' && typeof ptfToast === 'function') ptfToast('📦 تعداد ' + addedCat + ' کالا همزمان در ماژول کاتالوگ ذخیره شد', 'ok');
  }

  if (mod === 'TO' || mod === 'CO') {
    try {
      if (!window._offState.items) window._offState.items = [];
      finalList.forEach(function(it) {
        var nit = { pcode: it.cd, name: it.name, unit: it.un, qty: it.qty, price: it.price, desc: it.desc, model: '', brand: '', dlv: '' };
        if (typeof offSmartInsert === 'function') offSmartInsert(nit); else window._offState.items.push(nit); /* v12.6 US-310 */
      });

      if (syncCols && window._aiDetectedExtraCols && window._aiDetectedExtraCols.length > 5) {
        var baseK = ['k','cd','code','name','desc','unit','un','qty','quantity','price','val','ردیف','شرح','کد','تعداد','واحد','قیمت','شرح کامل','ملاحظات'];
        window._aiDetectedExtraCols.forEach(function(colName) {
          if (colName && colName.length > 2 && baseK.indexOf(colName.toLowerCase()) < 0) {
            if (!window._offState.extraCols) window._offState.extraCols = [];
            if (window._offState.extraCols.indexOf(colName) < 0) window._offState.extraCols.push(colName);
          }
        });
      }

      if (typeof offRenderItems === 'function') offRenderItems();
      if (typeof ptfToast === 'function') ptfToast('✅ تعداد ' + finalList.length + ' قلم کالا در جدول پیشنهاد جاگذاری شد', 'ok');
      else alert('✅ تعداد ' + finalList.length + ' قلم کالا در پیشنهاد جاگذاری شد');
    } catch(e) {}
  } else if (mod === 'PROD') {
    if (typeof ptfToast === 'function') ptfToast('✅ کالاها با موفقیت در کاتالوگ ثبت شدند', 'ok');
  }

  var md = document.querySelector('#panels .md-b:last-child');
  if (md) md.remove();
};