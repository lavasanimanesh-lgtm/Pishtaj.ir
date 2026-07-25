/* PARKED v24.5: AI Technical Assistant از UI/لود خارج شد (فاز ثبات + پیچیدگی اجرایی/وابستگی LLM). فایل نگه داشته شده. */
/* =====================================================================
   PTF CRM — ai-tech-assistant.js — v22.4 runtime
   AI Technical Assistant — Request Bundle + Persian Technical Analysis
   Stage 1 preserved + calc adapter + proposal composer integration
   ===================================================================== */
(function(){
'use strict';

var KEY = 'ptf_crm_techcases';
var STORAGE_API = '../api/storage.php';
var ATTACH_READ_API = '../api/attachment-read.php';

function esc(s){var d=document.createElement('div');d.textContent=s==null?'':String(s);return d.innerHTML;}
function getData(k){try{return JSON.parse(localStorage.getItem(k)||'[]')}catch(e){return[]}}
function setData(k,v){localStorage.setItem(k, JSON.stringify(v));}
function curUser(){ try{return (curSession().user||'system');}catch(e){return 'system';} }
function curName(){ try{return (curSession().name||'سیستم');}catch(e){return 'سیستم';} }
function nowIso(){ return new Date().toISOString(); }
function nowFa(){ try{return typeof faDateTime==='function' ? faDateTime() : new Date().toLocaleString('fa-IR');}catch(e){return new Date().toLocaleString('fa-IR');} }
function jalaliYear(){ try{return String(new Date().toLocaleDateString('fa-IR-u-nu-latn')).split('/')[0]||'1405';}catch(e){return '1405';} }
function arr(v){ return Array.isArray(v) ? v : []; }
function uniq(a){ var o={},out=[]; arr(a).forEach(function(x){ var k=String(x||'').trim(); if(k && !o[k]){o[k]=1; out.push(k);} }); return out; }
function norm(s){ return String(s==null?'':s).replace(/[\u200c\u200f\u202a-\u202e]/g,' ').replace(/\s+/g,' ').trim(); }
function hashStr(s){ s=String(s||''); var h=0,i,chr; for(i=0;i<s.length;i++){ chr=s.charCodeAt(i); h=((h<<5)-h)+chr; h|=0; } return 'H'+Math.abs(h); }
function moneySize(n){ n=+n||0; if(n>=1048576) return (n/1048576).toFixed(1)+' MB'; if(n>=1024) return Math.round(n/1024)+' KB'; return n+' B'; }
function extOf(name){ var m=String(name||'').toLowerCase().split(/[?#]/)[0].match(/\.([a-z0-9]+)$/); return m?m[1]:''; }
function tcases(){ return getData(KEY); }
function saveCases(v){ setData(KEY, v); }
function quotaKey(){ return 'ptf_ai_quota_' + curUser(); }
function quotaLimit(){ try{return (typeof window.aiWB_quotaLimit==='function') ? window.aiWB_quotaLimit() : 50;}catch(e){return 50;} }
function quotaCheck(){
  try{
    var q = JSON.parse(localStorage.getItem(quotaKey()) || '{"d":"","n":0}');
    var today = new Date().toISOString().slice(0,10);
    if(q.d !== today) q = {d:today,n:0};
    if(q.n >= quotaLimit()) return false;
  }catch(e){}
  return true;
}
function quotaBump(){
  try{
    var q = JSON.parse(localStorage.getItem(quotaKey()) || '{"d":"","n":0}');
    var today = new Date().toISOString().slice(0,10);
    if(q.d !== today) q = {d:today,n:0};
    q.n++;
    localStorage.setItem(quotaKey(), JSON.stringify(q));
  }catch(e){}
}
function caseByRfq(rfqCd){ return tcases().filter(function(x){ return x.srcRfq===rfqCd; })[0] || null; }
function caseByNo(no){ return tcases().filter(function(x){ return x.caseNo===no; })[0] || null; }
function findRfq(cd){ return getData('ptf_crm_rfqs').filter(function(x){ return x.cd===cd; })[0] || null; }
function nextCaseNo(){
  var y = jalaliYear();
  var max = 0;
  tcases().forEach(function(c){
    var m = String(c.caseNo||'').match(new RegExp('^TCA-'+y+'-(\\d+)$'));
    if(m && +m[1] > max) max = +m[1];
  });
  return 'TCA-' + y + '-' + String(max + 1).padStart(3,'0');
}
function patchCase(rec){
  var list = tcases();
  var done = false;
  for(var i=0;i<list.length;i++) if(list[i].caseNo===rec.caseNo){ list[i]=rec; done=true; break; }
  if(!done) list.unshift(rec);
  saveCases(list);
}
function catFa(k){ return ({inq:'فایل اولیه استعلام', ds:'دیتاشیت', img:'تصویر', dwg:'نقشه', oth:'سایر', cat:'کاتالوگ'})[k] || k; }
function flattenAttachments(r){
  var out=[]; var files=(r&&r.files)||{};
  Object.keys(files).forEach(function(k){
    arr(files[k]).forEach(function(f,idx){
      out.push({
        cat:k,
        catFa:catFa(k),
        name:f && f.name ? f.name : ('file-'+(idx+1)),
        key:f && f.key ? f.key : '',
        size:+(f && f.size || 0),
        uploadedAt:f && f.t ? f.t : ''
      });
    });
  });
  return out;
}
function collectReadRows(r){
  var reads = getData('ptf_crm_inqreads');
  var hit = reads.filter(function(x){ return x.cd===r.cd || x.inqNo===r.cd || (r.inqNo && x.inqNo===r.inqNo); })[0];
  return arr(hit && hit.rows);
}
function collectInqItems(r){
  return getData('ptf_crm_inqitems').filter(function(x){
    return x.inqNo===r.cd || x.inqNo===r.inqNo || x.cd===r.cd;
  });
}
function itemKey(it){
  return [norm(it.tp||''), norm(it.nm||it.name||''), norm(it.spec||it.st||it.desc||''), String(it.qty||1), norm(it.un||it.unit||'عدد'), norm(it.brand||it.br||''), norm(it.model||it.md||'')].join('|');
}
function collectItems(r){
  var src = 'rfq';
  var list = [];
  var reads = collectReadRows(r);
  if(reads.length){
    src = 'inqreads';
    list = reads.map(function(x){ return {tp:x.tp||'', nm:x.nm||x.name||'', spec:x.spec||x.st||'', qty:+x.qty||1, un:x.un||x.unit||'عدد', brand:x.brand||x.br||'', model:x.model||x.md||''}; });
  } else {
    var iq = collectInqItems(r);
    if(iq.length){
      src = 'inqitems';
      list = iq.map(function(x){ return {tp:x.tp||'', nm:x.nm||x.name||'', spec:x.st||x.spec||x.desc||'', qty:+x.qty||1, un:x.un||x.unit||'عدد', brand:x.brand||x.br||'', model:x.model||x.md||''}; });
    } else if(arr(r.items).length){
      src = 'rfq.items';
      list = arr(r.items).map(function(x){ return {tp:x.tp||'', nm:x.nm||x.name||'', spec:x.st||x.spec||x.desc||'', qty:+x.qty||1, un:x.un||x.unit||'عدد', brand:x.brand||x.br||'', model:x.model||x.md||''}; });
    }
  }
  var seen={}, out=[];
  list.forEach(function(x){
    var k = itemKey(x);
    if(!seen[k]){ seen[k]=1; out.push(x); }
  });
  return {items:out, source:src, readRows:reads.length, inqItems:collectInqItems(r).length};
}
function bundleText(b){
  var itemTxt = arr(b.items).map(function(it,idx){
    return (idx+1)+') type='+(it.tp||'-')+' | name='+(it.nm||'-')+' | spec='+(it.spec||'-')+' | qty='+(it.qty||1)+' | unit='+(it.un||'-')+' | brand='+(it.brand||'-')+' | model='+(it.model||'-');
  }).join('\n');
  var attTxt = arr(b.attachments).map(function(f,idx){
    return (idx+1)+') '+(f.catFa||f.cat||'')+' | '+(f.name||'')+' | '+(f.uploadedAt||'');
  }).join('\n');
  var parsedTxt = arr(b.parsedAttachments).map(function(p,idx){
    return (idx+1)+') '+(p.name||'')+' | status='+(p.status||'')+' | method='+(p.method||'')+'\n'+(p.text||'');
  }).join('\n\n');
  return [
    'Request Code: '+(b.meta.rfqCd||''),
    'Inquiry No: '+(b.meta.inqNo||''),
    'Customer: '+(b.meta.customer||''),
    'Category: '+(b.meta.category||''),
    'Subject: '+(b.meta.subject||''),
    'Status: '+(b.meta.statusText||''),
    'Contact: '+(b.meta.contact||''),
    'Bundle Version: '+(b.bundleVersion||1),
    'Manual Note: '+(b.manualNote||''),
    'Line Items:\n'+itemTxt,
    'Attachments Inventory:\n'+attTxt,
    'Parsed Attachment Content:\n'+parsedTxt
  ].join('\n\n');
}
function fetchPresignedBlob(att, cb){
  if(!att || !att.key) { cb({ ok:false, error:'no-key' }); return; }
  fetch(STORAGE_API + '?action=presign_get', {
    method:'POST', headers:(typeof ptfApiAuthHeaders==='function'?ptfApiAuthHeaders(true):{'Content-Type':'application/json'}), body: JSON.stringify({ key: att.key })
  }).then(function(r){ return r.json(); })
    .then(function(d){
      if(!d.ok || !d.url) { cb({ ok:false, error:'presign-failed' }); return; }
      return fetch(d.url).then(function(r){ return r.blob(); }).then(function(blob){ cb({ ok:true, blob:blob, url:d.url }); });
    })
    .catch(function(){ cb({ ok:false, error:'blob-fetch-failed' }); });
}
function readTextAttachment(att, cb){
  fetch(ATTACH_READ_API, {
    method:'POST', headers:(typeof ptfApiAuthHeaders==='function'?ptfApiAuthHeaders(true):{'Content-Type':'application/json'}), body: JSON.stringify({ key: att.key, name: att.name })
  }).then(function(r){ return r.json(); })
    .then(function(d){ cb(d); })
    .catch(function(){ cb({ ok:false, error:'text-read-failed' }); });
}
function readOcrAttachment(att, cb){
  fetchPresignedBlob(att, function(res){
    if(!res.ok || !res.blob) { cb({ ok:false, error:res.error||'blob' }); return; }
    if (res.blob.size > 8 * 1048576) { cb({ ok:false, error:'too-large' }); return; }
    var fr = new FileReader();
    fr.onload = function(){
      var b64 = String(fr.result || '').split(',')[1] || '';
      fetch('../api/llm.php?action=ocr', {
        method:'POST', headers:(typeof ptfApiAuthHeaders==='function'?ptfApiAuthHeaders(true):{'Content-Type':'application/json'}),
        body: JSON.stringify({ mime: res.blob.type || ((extOf(att.name)==='pdf') ? 'application/pdf' : 'image/png'), b64:b64 })
      }).then(function(r){ return r.json(); })
        .then(function(d){ cb(d); })
        .catch(function(){ cb({ ok:false, error:'ocr-failed' }); });
    };
    fr.readAsDataURL(res.blob);
  });
}
function parseAttachment(att, cb){
  var ext = extOf(att && att.name);
  if(!att) { cb({ ok:false, status:'missing', text:'' }); return; }
  if(!att.key) { cb({ ok:false, status:'no-key', text:'', method:'inventory-only' }); return; }
  if(['txt','md','csv','json','xml','html','htm','docx','xlsx'].indexOf(ext) > -1) {
    readTextAttachment(att, function(d){
      if(d && d.ok && d.text){ cb({ ok:true, status:'parsed', method:'text-extract', text:d.text.slice(0, 3500) }); }
      else cb({ ok:false, status:d && d.error || 'unreadable', method:'text-extract', text:'' });
    });
    return;
  }
  if(['pdf','jpg','jpeg','png','webp'].indexOf(ext) > -1) {
    readOcrAttachment(att, function(d){
      if(d && d.ok && d.data){
        var tx = [];
        if(d.data.co) tx.push('Company: ' + d.data.co);
        if(d.data.coEn) tx.push('Company EN: ' + d.data.coEn);
        if(d.data.inqno) tx.push('Inquiry: ' + d.data.inqno);
        if(d.data.buyer) tx.push('Buyer: ' + d.data.buyer + (d.data.buyerRole ? ' (' + d.data.buyerRole + ')' : ''));
        arr(d.data.rows).slice(0,20).forEach(function(r, i){ tx.push((i+1)+') ' + [r.nm||'', r.spec||'', r.brand||'', r.model||'', r.qty||'', r.un||''].join(' | ')); });
        cb({ ok:true, status:'parsed', method:'ocr', text:tx.join('\n') });
      } else cb({ ok:false, status:d && d.error || 'ocr-failed', method:'ocr', text:'' });
    });
    return;
  }
  cb({ ok:false, status:'unsupported', method:'none', text:'' });
}
function resolveAttachmentsForCase(rec, done){
  if(!rec || !rec.bundle) { done && done(rec); return; }
  var atts = arr(rec.bundle.attachments);
  if(!atts.length) {
    rec.bundle.parsedAttachments = [];
    patchCase(rec);
    done && done(rec);
    return;
  }
  var out = [];
  var i = 0;
  var progress = document.getElementById('aiTaOut');
  (function next(){
    if(i >= atts.length){
      rec.bundle.parsedAttachments = out;
      rec.bundle.parsedAt = nowIso();
      rec.bundle.parsedFa = nowFa();
      patchCase(rec);
      done && done(rec);
      return;
    }
    var att = atts[i++];
    if(progress) progress.innerHTML = '<div style="background:#eff6ff;border:1px solid #93c5fd;border-radius:14px;padding:18px;color:#1d4ed8">⏳ در حال خواندن ضمیمه ' + i + ' از ' + atts.length + ': ' + esc(att.name||'') + '</div>';
    parseAttachment(att, function(r){
      out.push({
        name: att.name || '', key: att.key || '', cat: att.cat || '', catFa: att.catFa || '',
        status: r && r.status || (r && r.ok ? 'parsed' : 'error'),
        method: r && r.method || '',
        text: (r && r.text ? String(r.text).slice(0, 3500) : ''),
        size: att.size || 0
      });
      next();
    });
  })();
}

function detectScope(text){
  text = String(text||'');
  var rules = [
    {code:'control_valve', fa:'شیر کنترلی', rx:/(control\s*valve|شیر\s*کنترلی|fisher|samson|masoneilan|positioner)/i},
    {code:'flow_meter', fa:'فلومتر / دبی‌سنج', rx:/(flow\s*meter|flowmeter|orifice|rotameter|magnetic flow|vortex|فلومتر|اوریفیس|دبی\s*سنج)/i},
    {code:'psv', fa:'شیر اطمینان / PSV', rx:/(\bpsv\b|\bprv\b|relief\s*valve|safety\s*valve|شیر\s*اطمینان|سوپاپ\s*اطمینان)/i},
    {code:'heat_exchanger', fa:'مبدل حرارتی', rx:/(heat\s*exchanger|shell\s*&\s*tube|plate\s*heat|مبدل\s*حرارتی)/i},
    {code:'pump', fa:'پمپ', rx:/(\bpump\b|پمپ)/i},
    {code:'instrumentation', fa:'ابزار دقیق', rx:/(transmitter|pressure\s*gauge|temperature|level\s*switch|instrument|ترانسمیتر|فشارسنج|دماسنج|لول\s*سوئیچ|ابزار\s*دقیق)/i},
    {code:'valves', fa:'شیرآلات', rx:/(\bvalve\b|gate\s*valve|ball\s*valve|globe\s*valve|butterfly\s*valve|check\s*valve|شیر|ولو)/i},
    {code:'piping', fa:'پایپینگ و اتصالات', rx:/(\bpipe\b|\bflange\b|\belbow\b|\btee\b|\breducer\b|\bfitting\b|لوله|فلنج|زانو|سه\s*راه|تبدیل|اتصال)/i}
  ];
  for(var i=0;i<rules.length;i++) if(rules[i].rx.test(text)) return rules[i];
  return {code:'general', fa:'عمومی / نیازمند تشخیص دقیق‌تر', rx:/.*/};
}
function firstMatches(text, rx, limit){
  var out=[], m, seen={}; limit=limit||6;
  while((m=rx.exec(text)) && out.length<limit){
    var v = norm(m[0]);
    if(v && !seen[v]){ seen[v]=1; out.push(v); }
  }
  return out;
}
function extractStandards(text){
  var out=[];
  [
    /\b(?:API\s*[- ]?\d{2,4}[A-Z]?)\b/gi,
    /\b(?:ASME\s*[A-Z]?\d+(?:\.\d+)?(?:\.\d+)?)\b/gi,
    /\b(?:ASTM\s*[A-Z]?\d+[A-Z0-9\/-]*)\b/gi,
    /\b(?:IEC\s*\d+(?:-\d+)*)\b/gi,
    /\b(?:DIN\s*\d+[A-Z0-9\/-]*)\b/gi,
    /\b(?:NACE\s*[A-Z0-9\/-]+)\b/gi,
    /\b(?:ANSI\s*[A-Z0-9\.-]+)\b/gi,
    /\b(?:ISA\s*[A-Z0-9\.-]+)\b/gi,
    /\b(?:ATEX)\b/gi,
    /\b(?:IP\s*\d{2})\b/gi,
    /\b(?:SIL\s*[1-4])\b/gi
  ].forEach(function(rx){ out = out.concat(firstMatches(text, new RegExp(rx.source, rx.flags), 20)); });
  return uniq(out).slice(0,10);
}
function extractKeyData(text, bundle){
  var out=[];
  function push(label, arr){ if(arr && arr.length) out.push({k:label, v:uniq(arr).slice(0,5).join('، ')}); }
  push('سایز / قطر', firstMatches(text, /\b(?:DN\s*\d+|NPS\s*\d+|\d+(?:\.\d+)?\s*(?:inch|in\.?|"|اینچ))\b/gi));
  push('کلاس / ریتینگ / اسکجول', firstMatches(text, /\b(?:CL(?:ASS)?\s*\d+|PN\s*\d+|SCH(?:EDULE)?\s*\d+|#\s*\d+)\b/gi));
  push('متریال', firstMatches(text, /\b(?:A105|A106(?:\s*GR\.?\s*[A-Z])?|A234(?:\s*WPB)?|A182\s*F\d+|SS\s*316L?|SS\s*304L?|316L|304L|CS|CARBON\s*STEEL|STAINLESS\s*STEEL|PTFE|PEEK|MONEL|INCONEL|DUPLEX)\b/gi));
  push('فشار', firstMatches(text, /\b(?:\d+(?:\.\d+)?\s*(?:barg?|barg|psi|psig|mpa))\b/gi));
  push('دما', firstMatches(text, /\b(?:-?\d+(?:\.\d+)?\s*(?:°\s*c|deg\s*c|c))\b/gi));
  push('دبی / ظرفیت', firstMatches(text, /\b(?:\d+(?:\.\d+)?\s*(?:m3\/h|nm3\/h|kg\/h|l\/min|gpm|tph))\b/gi));
  push('سیگنال / پروتکل', firstMatches(text, /\b(?:4-20\s*mA|HART|MODBUS|PROFIBUS|PROFINET|FOUNDATION\s*FIELD(?:BUS)?)\b/gi));
  var brands = uniq(arr(bundle.items).map(function(it){ return it.brand; }).filter(Boolean));
  var models = uniq(arr(bundle.items).map(function(it){ return it.model; }).filter(Boolean));
  push('برند ذکرشده', brands);
  push('مدل / پارت‌نامبر', models);
  return out.slice(0,8);
}
function reqMap(scope){
  var M = {
    control_valve:[
      ['سیال / سرویس فرایندی', /(fluid|service|سیال|سرویس)/i],
      ['دبی / ظرفیت', /(m3\/h|nm3\/h|kg\/h|l\/min|gpm|flow|دبی|جریان)/i],
      ['فشار ورودی / خروجی یا ΔP', /(inlet|outlet|delta\s*p|dp|pressure|فشار|bar|psi)/i],
      ['دما', /(temperature|temp|°\s*c|دما)/i],
      ['سایز و کلاس', /(dn\s*\d+|nps\s*\d+|inch|اینچ|cl\s*\d+|pn\s*\d+)/i],
      ['متریال بدنه / Trim', /(material|body|trim|ss316|a105|متریال)/i],
      ['عملگر / Fail Action', /(actuator|fail\s*open|fail\s*close|spring|عملگر|فیل\s*اکشن)/i]
    ],
    flow_meter:[
      ['نوع فلومتر', /(orifice|magnetic|vortex|coriolis|ultrasonic|rotameter|فلومتر|اوریفیس)/i],
      ['سیال / سرویس', /(fluid|service|سیال|سرویس)/i],
      ['سایز لاین', /(dn\s*\d+|nps\s*\d+|inch|اینچ)/i],
      ['دبی و شرایط کاری', /(flow|دبی|m3\/h|nm3\/h|kg\/h|pressure|temperature|فشار|دما)/i],
      ['متریال', /(material|ss316|a105|ptfe|متریال)/i],
      ['خروجی / پروتکل', /(4-20\s*mA|hart|modbus|profibus|output|خروجی)/i]
    ],
    instrumentation:[
      ['نوع تجهیز / تگ', /(transmitter|gauge|switch|indicator|instrument|ترانسمیتر|فشارسنج|گیج|سوئیچ|تگ)/i],
      ['سرویس / سیال', /(service|fluid|process|سیال|سرویس|فرایند)/i],
      ['رنج / شرایط کاری', /(range|span|bar|psi|temperature|°\s*c|flow|رنج|فشار|دما)/i],
      ['اتصال فرایندی', /(npt|bsp|thread|flange|connection|اتصال)/i],
      ['متریال قسمت ترشونده', /(wetted|material|ss316|hastelloy|متریال)/i],
      ['خروجی / پروتکل', /(4-20\s*mA|hart|modbus|profibus|output|signal|خروجی)/i]
    ],
    valves:[
      ['نوع شیر', /(gate|globe|ball|butterfly|check|plug|knife|gate\s*valve|شیر)/i],
      ['سایز', /(dn\s*\d+|nps\s*\d+|inch|اینچ)/i],
      ['کلاس / فشار', /(cl\s*\d+|pn\s*\d+|pressure|فشار)/i],
      ['متریال', /(a105|a182|ss316|trim|seat|body|material|متریال)/i],
      ['نوع عملگر', /(gear|lever|electric|pneumatic|actuator|عملگر)/i],
      ['اتصال', /(rf|ff|bw|sw|npt|thread|flange|end\s*connection|اتصال)/i]
    ],
    pump:[
      ['دبی', /(flow|دبی|m3\/h|gpm|kg\/h)/i],
      ['هد / فشار', /(head|tdh|pressure|فشار|bar|psi)/i],
      ['سیال و دما', /(fluid|service|سیال|temperature|دما)/i],
      ['متریال', /(material|ss316|duplex|bronze|متریال)/i],
      ['آب‌بندی / سیل', /(seal|mechanical\s*seal|packing|سیل)/i],
      ['الکتروموتور / توان', /(kw|hp|motor|توان|الکتروموتور)/i]
    ],
    psv:[
      ['سیال Relief', /(fluid|service|سیال|سرویس)/i],
      ['Set Pressure', /(set\s*pressure|setpoint|فشار\s*تنظیم|bar|psi)/i],
      ['ظرفیت / Relief Load', /(relief|capacity|kg\/h|nm3\/h|m3\/h|ظرفیت)/i],
      ['Back Pressure', /(back\s*pressure|فشار\s*پشت)/i],
      ['دما', /(temperature|دما|°\s*c)/i],
      ['کد / استاندارد', /(api\s*520|api\s*526|api\s*527|استاندارد)/i]
    ],
    heat_exchanger:[
      ['Duty / بار حرارتی', /(duty|kw|kcal|بار\s*حرارتی)/i],
      ['دمای ورودی / خروجی', /(inlet|outlet|temperature|دمای\s*ورودی|دمای\s*خروجی)/i],
      ['دبی هر دو سیال', /(flow|m3\/h|kg\/h|دبی)/i],
      ['محدودیت افت فشار', /(pressure\s*drop|dp|افت\s*فشار)/i],
      ['متریال', /(material|ss316|cs|tube|shell|متریال)/i],
      ['کد طراحی', /(tema|asme|code|استاندارد)/i]
    ],
    piping:[
      ['نوع قلم / Item Type', /(pipe|flange|elbow|tee|reducer|fitting|لوله|فلنج|زانو|اتصال)/i],
      ['سایز', /(dn\s*\d+|nps\s*\d+|inch|اینچ)/i],
      ['Schedule / Class', /(sch\s*\d+|cl\s*\d+|pn\s*\d+)/i],
      ['متریال', /(a106|a234|a105|ss316|متریال)/i],
      ['استاندارد', /(asme|astm|api|din|استاندارد)/i],
      ['تعداد / طول', /(qty|quantity|meter|متر|تعداد)/i]
    ],
    general:[
      ['نوع تجهیز', /(valve|pump|transmitter|pipe|heat\s*exchanger|psv|شیر|پمپ|ترانسمیتر|لوله|مبدل)/i],
      ['مشخصات فنی اصلی', /(spec|standard|pressure|temperature|size|متریال|فشار|دما|سایز)/i],
      ['تعداد / واحد', /(qty|quantity|عدد|متر|set|pcs)/i]
    ]
  };
  return M[scope] || M.general;
}
function detectMissing(scope, text, bundle){
  var miss=[];
  if(!arr(bundle.items).length) miss.push('اقلام ساختاریافته درخواست هنوز در پرونده تکمیل نشده‌اند');
  reqMap(scope).forEach(function(it){ if(!it[1].test(text)) miss.push(it[0]); });
  return uniq(miss);
}
function detectContradictions(text, bundle){
  var issues=[];
  var cls = firstMatches(text, /\b(?:CL(?:ASS)?\s*\d+|PN\s*\d+)\b/gi, 12);
  var revs = uniq(arr(bundle.attachments).map(function(f){ var m=String(f.name||'').match(/(?:rev(?:ision)?[- _]?)([A-Z0-9]+)/i); return m ? ('Rev '+m[1]) : ''; }).filter(Boolean));
  if(arr(bundle.items).length<=1 && cls.length>1) issues.push('در متن یک قلم، بیش از یک Class/PN دیده شد؛ بازبینی تضاد احتمالی لازم است.');
  if(revs.length>1) issues.push('چند Revision مختلف در نام فایل‌ها دیده شد ('+revs.join('، ')+')؛ آخرین بازنگری مرجع مشخص شود.');
  return uniq(issues);
}
function supplyHints(scope, bundle){
  var base = {
    control_valve:{brands:['Fisher','Samson','Masoneilan','Valtek'], manufacturers:['Emerson / Fisher','Samson AG','Baker Hughes / Masoneilan'], alternatives:['در صورت محدودیت بودجه، معادل تاییدشده با Positioner سازگار بررسی شود']},
    flow_meter:{brands:['KROHNE','Endress+Hauser','Yokogawa','Rosemount'], manufacturers:['KROHNE','Endress+Hauser','Yokogawa'], alternatives:['نوع فلومتر باید با سیال، رسانایی، رنج دبی و افت فشار مجاز تطبیق داده شود']},
    instrumentation:{brands:['Rosemount','Yokogawa','Endress+Hauser','WIKA','Siemens'], manufacturers:['Emerson','Yokogawa','Endress+Hauser','WIKA'], alternatives:['در محیط‌های Hazardous Area، گواهی Ex و SIL قبل از پیشنهاد نهایی کنترل شود']},
    valves:{brands:['Velan','Neway','KITZ','Bray','Cameron'], manufacturers:['Velan','Neway','KITZ','Bray'], alternatives:['نوع Seat/Trim و متریال دقیق پیش از نهایی‌سازی باید با سرویس فرایندی تطبیق شود']},
    pump:{brands:['KSB','Sulzer','Flowserve','Ebara'], manufacturers:['KSB','Sulzer','Flowserve'], alternatives:['قبل از پیشنهاد نهایی، منحنی عملکرد و NPSH بررسی شود']},
    psv:{brands:['Leser','Crosby','Consolidated'], manufacturers:['Leser','Crosby'], alternatives:['کد API 520/526/527 و Back Pressure باید قبل از انتخاب نهایی تایید شود']},
    heat_exchanger:{brands:['Alfa Laval','Kelvion','API Basco'], manufacturers:['Alfa Laval','Kelvion'], alternatives:['TEMA / افت فشار / متریال Tube و Shell قبل از انتخاب نهایی تکمیل شود']},
    piping:{brands:['Benkan','Erne','Bonney Forge'], manufacturers:['Benkan','Erne','Bonney Forge'], alternatives:['برای اتصالات، استاندارد ساخت و Heat No./MTC موردنیاز از ابتدا روشن شود']},
    general:{brands:[], manufacturers:[], alternatives:['پرونده هنوز برای پیشنهاد رسمی نیازمند تکمیل اطلاعات فنی کلیدی است']}
  }[scope] || {brands:[], manufacturers:[], alternatives:[]};
  var notes=[];
  var atts = arr(bundle.attachments);
  var names = atts.map(function(x){ return String(x.name||''); }).join(' | ');
  if(!atts.length) notes.push('هیچ پیوست فنی در پرونده ثبت نشده؛ Datasheet / RFQ رسمی بارگذاری شود.');
  if(!atts.some(function(x){ return x.cat==='ds'; })) notes.push('دیتاشیت رسمی هنوز در پرونده دیده نشد؛ برای تحلیل دقیق‌تر اضافه شود.');
  if(atts.some(function(x){ return x.cat==='dwg'; })) notes.push('Revision نقشه و تطابق آن با اقلام درخواست قبل از پیشنهاد نهایی کنترل شود.');
  if(/vendor\s*list|approved\s*vendor|AVL|maker\s*list|وندور|وندر/i.test(names)) notes.push('فایل‌های Vendor List / AVL باید در انتخاب برندها رعایت شوند.');
  if(!arr(bundle.items).some(function(it){ return norm(it.brand||'').length; })) notes.push('برندهای مجاز/ممنوع کارفرما هنوز شفاف نیست؛ قبل از صدور Proposal مشخص شود.');
  return {brands:base.brands, manufacturers:base.manufacturers, alternatives:base.alternatives, rfqNotes:uniq(notes)};
}
function heuristicAnalysis(bundle){
  var text = bundleText(bundle);
  var scope = detectScope(text);
  var standards = extractStandards(text);
  var keyData = extractKeyData(text, bundle);
  var missing = detectMissing(scope.code, text, bundle);
  var contradictions = detectContradictions(text, bundle);
  var supply = supplyHints(scope.code, bundle);
  var critical = missing.filter(function(x){ return /سیال|دبی|فشار|دما|سایز|متریال|نوع تجهیز|اقلام ساختاریافته|Set Pressure|Duty|اتصال|خروجی|رنج/.test(x); }).slice(0,8);
  var summary = 'این پرونده در حوزه «'+scope.fa+'» قرار می‌گیرد. ' +
    (bundle.meta.customer ? 'درخواست از مشتری «'+bundle.meta.customer+'» ثبت شده' : 'مشتری در پرونده ثبت شده') +
    ' و در حال حاضر ' + bundle.items.length + ' قلم ساختاریافته و ' + bundle.attachments.length + ' پیوست برای بازبینی موجود است. ' +
    (critical.length ? 'برای ورود به مرحله پروپوزال هنوز برخی داده‌های حیاتی کامل نیست و باید ابتدا تکمیل شوند.' : 'از نظر اطلاعات پایه، پرونده به مرحله Gate تحلیل نزدیک است ولی هنوز بازبینی انسانی الزامی است.');
  return {
    scope:scope.fa,
    scopeCode:scope.code,
    equipment:{
      type:scope.fa,
      application:bundle.meta.category || 'بر اساس متن درخواست باید توسط کارشناس تکمیل شود',
      serviceContext:bundle.meta.subject || bundle.meta.statusText || 'از روی پرونده فعلی',
      standards:standards
    },
    keyData:keyData,
    missing:missing,
    criticalMissing:critical,
    contradictions:contradictions,
    supply:supply,
    summaryFa:summary,
    readiness:critical.length ? 'need_more_data' : 'ready'
  };
}
function normalizeList(v){
  if(Array.isArray(v)) return v.map(function(x){ return typeof x==='string' ? x : (x && (x.k||x.key||x.name||x.title||x.v||x.value) ? JSON.stringify(x) : String(x||'')); }).map(norm).filter(Boolean);
  return [];
}
function normalizeKeyData(v){
  if(!Array.isArray(v)) return [];
  return v.map(function(x){
    if(typeof x === 'string') return {k:'داده', v:x};
    return {k:norm(x.k||x.key||x.label||'داده'), v:norm(x.v||x.value||x.val||x.text||'')};
  }).filter(function(x){ return x.k || x.v; });
}
function normalizeTechcaseResponse(d, bundle){
  var h = heuristicAnalysis(bundle);
  d = d || {};
  var eq = d.equipment || d.equipmentIntro || {};
  var supply = d.supply || {};
  return {
    scope: norm(d.scope || d.scopeFa || h.scope),
    scopeCode: norm(d.scopeCode || h.scopeCode),
    equipment:{
      type: norm(eq.type || eq.equipmentType || h.equipment.type),
      application: norm(eq.application || h.equipment.application),
      serviceContext: norm(eq.serviceContext || eq.context || h.equipment.serviceContext),
      standards: uniq([].concat(normalizeList(eq.standards), h.equipment.standards||[])).slice(0,10)
    },
    keyData: (normalizeKeyData(d.keyData).length ? normalizeKeyData(d.keyData) : h.keyData),
    missing: (normalizeList(d.missing).length ? normalizeList(d.missing) : h.missing),
    criticalMissing: (normalizeList(d.criticalMissing).length ? normalizeList(d.criticalMissing) : h.criticalMissing),
    contradictions: normalizeList(d.contradictions),
    supply:{
      brands: normalizeList(supply.brands),
      manufacturers: normalizeList(supply.manufacturers),
      alternatives: normalizeList(supply.alternatives),
      rfqNotes: normalizeList(supply.rfqNotes)
    },
    summaryFa: norm((typeof ptfAiClean==='function' ? ptfAiClean(d.summaryFa || d.summary || '') : (d.summaryFa || d.summary || '')) || h.summaryFa),
    readiness: norm(d.readiness || (normalizeList(d.criticalMissing).length ? 'need_more_data' : h.readiness) || 'need_more_data')
  };
}
function llmAnalyze(bundle, cb){
  if(!quotaCheck()) { cb({ok:false, error:'سهمیه امروز شما برای درخواست‌های AI تکمیل شده است.'}); return; }
  fetch('../api/llm.php?action=techcase', {
    method:'POST',
    headers:(typeof ptfApiAuthHeaders==='function'?ptfApiAuthHeaders(true):{'Content-Type':'application/json'}),
    body: JSON.stringify({ text: bundleText(bundle).slice(0, 12000) })
  }).then(function(r){ return r.json(); })
    .then(function(d){ quotaBump(); cb(d); })
    .catch(function(){ cb({ok:false, error:'عدم دسترسی به سرور تحلیل فنی'}); });
}
function saveBundleForRfq(rfqCd){
  var r = findRfq(rfqCd);
  if(!r) throw new Error('درخواست انتخاب‌شده یافت نشد');
  var rec = caseByRfq(rfqCd) || {
    caseNo: nextCaseNo(),
    srcRfq: rfqCd,
    createdAt: nowIso(),
    createdFa: nowFa(),
    createdBy: curUser(),
    createdByName: curName(),
    analyses: [],
    gate: { approved:false, approvedAt:'', approvedFa:'', approvedBy:'', approvedByName:'', analysisVer:0 },
    stage: 'draft'
  };
  var pack = collectItems(r);
  var noteEl = document.getElementById('aiTaNote');
  var note = noteEl ? noteEl.value.trim() : (rec.bundle && rec.bundle.manualNote) || '';
  var keepParsed = arr(rec.bundle && rec.bundle.parsedAttachments);
  var bundle = {
    bundleVersion: (rec.bundleVersion || 0) + 1,
    meta: {
      rfqCd: r.cd,
      inqNo: r.inqNo || r.cd,
      customer: r.co || '',
      category: r.ca || '',
      subject: r.subj || '',
      contact: r.con || '',
      status: r.st || '',
      statusText: r.stxt || '',
      dateFa: r.dt || '',
      sourceItems: pack.source
    },
    items: pack.items,
    attachments: flattenAttachments(r),
    sourceInventory: {
      rfqItems: arr(r.items).length,
      inqItems: pack.inqItems,
      inqReadRows: pack.readRows,
      totalItems: pack.items.length,
      totalAttachments: flattenAttachments(r).length
    },
    parsingShell: {
      attachmentInventoryResolved: true,
      structuredLineItemsResolved: pack.items.length > 0,
      extractedFactsSource: pack.source,
      extractedFactsCount: pack.items.length,
      fileParsingStage: keepParsed.length ? 'attachments-parsed' : 'shell-ready'
    },
    parsedAttachments: keepParsed,
    manualNote: note
  };
  bundle.fingerprint = hashStr(JSON.stringify({m:bundle.meta,i:bundle.items,a:bundle.attachments.map(function(x){return [x.cat,x.name,x.size];}),n:bundle.manualNote}));
  rec.bundleVersion = bundle.bundleVersion;
  rec.bundle = bundle;
  rec.updatedAt = nowIso();
  rec.updatedFa = nowFa();
  rec.updatedBy = curUser();
  rec.updatedByName = curName();
  rec.stage = 'bundle_ready';
  patchCase(rec);
  if(typeof audit==='function') audit('AI Technical Assistant','ساخت/به‌روزرسانی بسته فنی '+rec.caseNo+' برای '+rfqCd, rec.caseNo);
  return rec;
}
function saveAnalysis(rec, analysis, source){
  rec.analyses = arr(rec.analyses);
  var ver = rec.analyses.length + 1;
  rec.analyses.unshift({
    ver: ver,
    at: nowIso(),
    atFa: nowFa(),
    by: curUser(),
    byName: curName(),
    source: source || 'heuristic',
    bundleVersion: rec.bundleVersion || 1,
    summaryFa: analysis.summaryFa || '',
    scope: analysis.scope || '',
    scopeCode: analysis.scopeCode || '',
    equipment: analysis.equipment || {type:'',application:'',serviceContext:'',standards:[]},
    keyData: arr(analysis.keyData),
    missing: arr(analysis.missing),
    criticalMissing: arr(analysis.criticalMissing),
    contradictions: arr(analysis.contradictions),
    supply: analysis.supply || {brands:[],manufacturers:[],alternatives:[],rfqNotes:[]},
    readiness: analysis.readiness || 'need_more_data'
  });
  rec.latestAnalysisVer = ver;
  rec.stage = arr(analysis.criticalMissing).length ? 'need_more_data' : 'analyzed';
  rec.updatedAt = nowIso();
  rec.updatedFa = nowFa();
  rec.updatedBy = curUser();
  rec.updatedByName = curName();
  patchCase(rec);
  if(typeof audit==='function') audit('AI Technical Assistant','تحلیل فنی فارسی '+rec.caseNo+' نسخه '+ver, rec.caseNo);
  return rec;
}
function selectedRfq(){ var el=document.getElementById('aiTaRfq'); return el ? el.value : ''; }
function selectedCase(){ return caseByRfq(selectedRfq()); }
function currentViewVer(rec){
  if(!rec || !arr(rec.analyses).length) return 0;
  var v = window._aiTA_viewVer && window._aiTA_viewVer[rec.caseNo];
  return v || rec.analyses[0].ver;
}
function findAnalysis(rec, ver){
  return arr(rec && rec.analyses).filter(function(x){ return x.ver===ver; })[0] || null;
}
function badge(txt,bg,fg,bd){ return '<span style="background:'+bg+';color:'+fg+';border:1px solid '+(bd||bg)+';border-radius:999px;padding:4px 10px;font-size:11px;font-weight:800">'+esc(txt)+'</span>'; }
function listHtml(list, empty){
  list = arr(list).filter(Boolean);
  if(!list.length) return '<div style="color:#94a3b8;font-size:12px">'+esc(empty||'موردی ثبت نشده')+'</div>';
  return '<ul style="margin:0;padding:0 18px;line-height:2">'+list.map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('')+'</ul>';
}
function keyTable(rows){
  rows = arr(rows);
  if(!rows.length) return '<div style="color:#94a3b8;font-size:12px">داده ساختاریافته کلیدی هنوز استخراج نشده است.</div>';
  return '<div class="tb2" style="margin-top:6px"><table style="font-size:12px"><thead><tr><th>کلید</th><th>مقدار</th></tr></thead><tbody>'+
    rows.map(function(r){ return '<tr><td>'+esc(r.k||'')+'</td><td>'+esc(r.v||'')+'</td></tr>'; }).join('')+
    '</tbody></table></div>';
}
function recentCasesHtml(){
  var rows = tcases().slice(0,6).map(function(c){
    var status = c.gate && c.gate.approved ? 'Gate تایید شده' : (c.stage==='need_more_data' ? 'نیازمند تکمیل' : c.stage==='analyzed' ? 'تحلیل‌شده' : c.stage==='bundle_ready' ? 'بسته آماده' : 'پیش‌نویس');
    return '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;border-bottom:1px dashed var(--brd);padding:7px 0">'+
      '<div style="min-width:0"><div style="font-weight:800">'+esc(c.caseNo)+'</div><div style="font-size:11.5px;color:#64748b">'+esc(c.srcRfq)+' — '+esc((c.bundle&&c.bundle.meta&&c.bundle.meta.customer)||'')+'</div></div>'+
      '<div style="display:flex;gap:6px;align-items:center;flex:none">'+
      '<span style="font-size:11px;color:#475569">'+esc(status)+'</span>'+
      '<button class="ba" onclick="aiTA_pickRfq(\''+esc(c.srcRfq)+'\')">باز</button></div></div>';
  }).join('');
  return rows || '<div style="color:#94a3b8;font-size:12px">هنوز کیس فنی ثبت نشده است.</div>';
}
function renderRecent(){ var el=document.getElementById('aiTaRecent'); if(el) el.innerHTML = recentCasesHtml(); }
function renderCase(rfqCd, ver){
  var out = document.getElementById('aiTaOut');
  if(!out) return;
  var rec = caseByRfq(rfqCd);
  if(!rec){
    out.innerHTML = '<div style="background:#f8fafc;border:1px dashed var(--brd);border-radius:16px;padding:22px;color:#64748b;line-height:2">'+
      '<b>نسخه v22.4 — پشته یکپارچه دستیار فنی</b><br>ابتدا یک درخواست را انتخاب کنید و دکمه «ساخت/به‌روزرسانی بسته» را بزنید. در این مرحله سیستم:<br>• اقلام و پیوست‌ها را یکپارچه می‌کند<br>• نسخه‌بندی تحلیل را نگه می‌دارد<br>• خلاصه فارسی + لیست کمبودها را می‌سازد<br>• آداپتر محاسبات deterministic را برای خانواده‌های پشتیبانی‌شده فعال می‌کند<br>• پیش‌نویس انگلیسی Proposal، نسخه‌بندی و ثبت رسمی را نیز پشتیبانی می‌کند</div>';
    return;
  }
  var a = findAnalysis(rec, ver || currentViewVer(rec));
  var b = rec.bundle || {};
  var attByCat = {};
  arr(b.attachments).forEach(function(f){ attByCat[f.catFa||f.cat] = (attByCat[f.catFa||f.cat]||0)+1; });
  var attStr = Object.keys(attByCat).map(function(k){ return k+': '+attByCat[k]; }).join(' | ') || 'بدون پیوست';
  var gateHtml = rec.gate && rec.gate.approved
    ? '<div style="background:#ecfdf5;border:1px solid #10b981;border-radius:12px;padding:10px 12px;color:#065f46;font-size:12.5px;line-height:2">✅ این پرونده برای مرحله بعدی (مرحله پروپوزال) گیت شده است.<br><b>تحلیل مرجع:</b> نسخه '+esc(rec.gate.analysisVer)+' | <b>تاییدکننده:</b> '+esc(rec.gate.approvedByName||rec.gate.approvedBy)+' | <b>زمان:</b> '+esc(rec.gate.approvedFa||'')+'<br><small>یادآوری: تولید Proposal رسمی و خروجی DOCX/PDF در اسپرینت‌های بعدی فعال می‌شود.</small></div>'
    : '<div style="background:#fff7ed;border:1px solid #fdba74;border-radius:12px;padding:10px 12px;color:#9a3412;font-size:12.5px">⛔ گیت مرحله پروپوزال هنوز تایید نشده است.</div>';
  var versions = arr(rec.analyses).map(function(x){
    var active = a && x.ver===a.ver;
    return '<button class="ba" style="'+(active?'background:#1d4ed8;color:#fff;border-color:#1d4ed8;':'')+'" onclick="aiTA_viewAnalysis(\''+esc(rec.caseNo)+'\','+x.ver+')">نسخه '+x.ver+'</button>';
  }).join(' ');
  var hdr = '<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;margin-bottom:12px">'+
    '<div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">'+
      badge(rec.caseNo,'#eff6ff','#1d4ed8','#bfdbfe')+
      badge('بسته v'+(rec.bundleVersion||1),'#f8fafc','#475569','#cbd5e1')+
      (a ? badge((a.readiness==='ready'?'آماده Gate':'نیازمند تکمیل'), a.readiness==='ready'?'#ecfdf5':'#fff7ed', a.readiness==='ready'?'#065f46':'#9a3412', a.readiness==='ready'?'#86efac':'#fdba74') : badge('بدون تحلیل','#f8fafc','#64748b','#cbd5e1'))+
      (rec.gate && rec.gate.approved ? badge('Gate تایید شده','#dcfce7','#166534','#86efac') : '')+
    '</div><div style="font-size:12px;color:#475569;line-height:1.8">'+
      '<b>درخواست:</b> '+esc(rec.srcRfq)+' | <b>مشتری:</b> '+esc((b.meta&&b.meta.customer)||'—')+' | <b>پیوست‌ها:</b> '+esc(attStr)+'<br>'+
      '<b>اقلام:</b> '+esc((b.items&&b.items.length)||0)+' | <b>منبع اقلام:</b> '+esc((b.meta&&b.meta.sourceItems)||'—')+' | <b>آخرین به‌روزرسانی:</b> '+esc(rec.updatedFa||rec.createdFa||'')+
    '</div></div>'+
    '<div style="display:flex;gap:6px;flex-wrap:wrap">'+versions+'</div></div>';
  var parsedOk = arr(b.parsedAttachments).filter(function(x){ return x.status==='parsed'; }).length;
  var parsedFail = arr(b.parsedAttachments).filter(function(x){ return x.status!=='parsed'; }).length;
  var parsedLine = arr(b.parsedAttachments).length
    ? ('<b>خوانش ضمایم:</b> ' + parsedOk + ' موفق / ' + parsedFail + ' ناموفق' + (b.parsedFa ? ' | ' + esc(b.parsedFa) : '') + '<br>')
    : '';
  var bundleBox = '<div style="background:#f8fafc;border:1px solid var(--brd);border-radius:14px;padding:14px;margin-bottom:12px">'+
      '<div style="font-weight:900;margin-bottom:6px">📦 Snapshot بسته فنی</div>'+
      '<div style="font-size:12.5px;color:#475569;line-height:2">'+
      '<b>موضوع:</b> '+esc((b.meta&&b.meta.subject)||'—')+'<br>'+
      '<b>یادداشت کارشناس:</b> '+esc(b.manualNote||'—')+'<br>'+
      '<b>فهرست ضمایم:</b> '+esc(attStr)+'<br>'+
      parsedLine +
      '<b>وضعیت خوانش ضمایم:</b> '+esc(((b.parsingShell&&b.parsingShell.fileParsingStage)||'shell-ready'))+' | <b>Fingerprint:</b> '+esc(b.fingerprint||'—')+
      '</div>'+
      '<div style="margin-top:8px;font-size:12px;color:#64748b">'+arr(b.items).slice(0,5).map(function(it,idx){ return (idx+1)+'. '+esc(it.nm||'-')+' — '+esc(it.spec||'-'); }).join('<br>')+(arr(b.items).length>5?'<br>…':'')+'</div>'+
      (arr(b.parsedAttachments).length ? '<div style="margin-top:10px;font-size:11.5px;color:#475569;background:#fff;border:1px dashed #cbd5e1;border-radius:10px;padding:8px">'+arr(b.parsedAttachments).slice(0,4).map(function(p){ return '• ' + esc(p.name) + ' — ' + esc(p.status) + (p.method ? ' ('+esc(p.method)+')' : ''); }).join('<br>') + (arr(b.parsedAttachments).length>4?'<br>…':'') + '</div>' : '') +
    '</div>';
  if(!a){ out.innerHTML = hdr + bundleBox + gateHtml + '<div style="background:#fff7ed;border:1px dashed #fdba74;border-radius:14px;padding:16px;color:#9a3412">برای این پرونده هنوز تحلیل فارسی ثبت نشده است. دکمه «تحلیل فارسی» را اجرا کنید.</div>'; return; }
  var supply = a.supply || {brands:[], manufacturers:[], alternatives:[], rfqNotes:[]};
  var calcHtml = (typeof ptfCalcPanelHtml==='function') ? ptfCalcPanelHtml(rec, a) : '';
  var proposalHtml = (typeof ptfProposalPanelHtml==='function') ? ptfProposalPanelHtml(rec, a) : '';
  out.innerHTML = hdr + bundleBox +
    '<div style="background:#fff;border:1px solid var(--brd);border-radius:16px;padding:16px">'+
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px">'+
        '<div style="background:#f8fafc;border:1px solid var(--brd);border-radius:12px;padding:12px">'+
          '<div style="font-weight:900;margin-bottom:6px">🧾 خلاصه فارسی</div><div style="font-size:13px;line-height:2;color:#334155">'+esc(a.summaryFa||'')+'</div></div>'+
        '<div style="background:#f8fafc;border:1px solid var(--brd);border-radius:12px;padding:12px">'+
          '<div style="font-weight:900;margin-bottom:6px">🏷️ معرفی تجهیز / پرونده</div><div style="font-size:12.5px;line-height:2;color:#334155">'+
          '<b>حوزه:</b> '+esc(a.scope||'—')+'<br><b>نوع/خانواده:</b> '+esc((a.equipment&&a.equipment.type)||'—')+'<br><b>کاربری:</b> '+esc((a.equipment&&a.equipment.application)||'—')+'<br><b>کانتکست سرویس:</b> '+esc((a.equipment&&a.equipment.serviceContext)||'—')+'<br><b>استانداردها:</b> '+esc(arr(a.equipment&&a.equipment.standards).join('، ')||'—')+
          '</div></div>'+
      '</div>'+
      '<div style="margin-top:14px"><div style="font-weight:900;margin-bottom:6px">📌 داده‌های کلیدی استخراج‌شده</div>'+keyTable(a.keyData)+'</div>'+
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-top:14px">'+
        '<div style="background:#fff7ed;border:1px solid #fdba74;border-radius:12px;padding:12px"><div style="font-weight:900;color:#9a3412;margin-bottom:6px">⚠️ داده‌های ناقص / مبهم</div>'+listHtml(a.missing,'مورد ناقصی ثبت نشده است')+'</div>'+
        '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:12px"><div style="font-weight:900;color:#b91c1c;margin-bottom:6px">⛔ کمبودهای حیاتی</div>'+listHtml(a.criticalMissing,'کمبود حیاتی شناسایی نشد')+'</div>'+
      '</div>'+
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-top:14px">'+
        '<div style="background:#f8fafc;border:1px solid var(--brd);border-radius:12px;padding:12px"><div style="font-weight:900;margin-bottom:6px">🧭 توصیه مسیر تامین</div>'+listHtml(supply.brands,'برند پیشنهادی ندارد')+'<div style="margin-top:8px;font-size:12px;color:#64748b"><b>سازندگان / manufacturers:</b> '+esc(arr(supply.manufacturers).join('، ')||'—')+'</div><div style="margin-top:8px">'+listHtml(supply.alternatives,'آلترناتیو خاصی ثبت نشده')+'</div></div>'+
        '<div style="background:#f8fafc;border:1px solid var(--brd);border-radius:12px;padding:12px"><div style="font-weight:900;margin-bottom:6px">🔎 تناقض‌ها / RFQ Notes</div>'+listHtml(a.contradictions,'تناقض مشخصی در این نسخه ثبت نشده')+'<div style="margin-top:10px">'+listHtml(supply.rfqNotes,'نکته خاص RFQ ثبت نشده')+'</div></div>'+
      '</div>'+
      '<div style="margin-top:14px;font-size:11.5px;color:#64748b">منبع تحلیل: '+esc(a.source||'heuristic')+' | نسخه تحلیل: '+esc(a.ver)+' | بسته مرجع: v'+esc(a.bundleVersion)+' | زمان: '+esc(a.atFa||'')+'</div>'+
    '</div><div style="margin-top:12px">'+gateHtml+'</div>' + calcHtml + proposalHtml;
}

window.aiTA_html = function(){
  var rfqs = getData('ptf_crm_rfqs');
  var opts = '<option value="">— انتخاب درخواست —</option>' + rfqs.map(function(r){
    return '<option value="'+esc(r.cd)+'">'+esc(r.cd)+' — '+esc(r.co||'')+'</option>';
  }).join('');
  return '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:18px">'+
    '<div style="background:var(--crd);border:1px solid var(--brd);border-radius:16px;padding:16px">'+
      '<h3 style="margin:0 0 8px">🧠 دستیار فنی — v22.4 runtime</h3>'+
      '<div style="font-size:12.5px;color:#64748b;line-height:2;margin-bottom:12px">زیرساخت بسته فنی و تحلیل فارسی از v22.1 حفظ شده، هسته محاسبات deterministic از v22.2 فعال است، composer نسخه‌بندی‌شده پروپوزال انگلیسی از v22.3 اضافه شده و در v22.4 لیدیاب کنار این جریان در دسترس است. <b>هیچ LLM‌ای محاسبه مهندسی انجام نمی‌دهد.</b></div>'+
      '<div class="fld"><label>درخواست / RFQ</label><select id="aiTaRfq" onchange="aiTA_onPick(this.value)">'+opts+'</select><small style="color:#64748b">در این مرحله هنوز برچسب RFQ در UI باقی مانده چون مدل داده فعلی CRM بر همان مبناست.</small></div>'+
      '<div class="fld"><label>یادداشت کارشناس (اختیاری)</label><textarea id="aiTaNote" rows="4" placeholder="مثلا: فقط برندهای مورد تایید Vendor List بررسی شوند / این پرونده برای کنترل‌والو است و دیتا ناقص است..."></textarea></div>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap">'+
        '<button class="bt" onclick="aiTA_build()">📦 ساخت / به‌روزرسانی بسته</button>'+
        '<button class="bt bt-o" style="color:#0e7490" onclick="aiTA_analyze()">🤖 تحلیل فارسی</button>'+
        '<button class="bt bt-o" style="color:#059669" onclick="aiTA_gate()">✅ تایید Gate</button>'+
      '</div>'+
      '<div style="margin-top:12px;background:#f8fafc;border:1px solid var(--brd);border-radius:12px;padding:12px">'+
        '<div style="font-weight:900;margin-bottom:6px">🗂️ آخرین کیس‌های فنی</div><div id="aiTaRecent">'+recentCasesHtml()+'</div></div>'+
    '</div>'+
    '<div id="aiTaOut"></div>'+
  '</div>';
};
window.aiTA_afterRender = function(){
  var sel = window._aiTA_selRfq || '';
  var el = document.getElementById('aiTaRfq');
  if(el && sel) el.value = sel;
  var rec = sel ? caseByRfq(sel) : null;
  var note = rec && rec.bundle ? (rec.bundle.manualNote||'') : '';
  var nEl = document.getElementById('aiTaNote');
  if(nEl) nEl.value = note;
  renderRecent();
  renderCase(sel);
};
window.aiTA_pickRfq = function(rfqCd){
  window._aiTA_selRfq = rfqCd;
  var el = document.getElementById('aiTaRfq');
  if(el) el.value = rfqCd;
  var rec = caseByRfq(rfqCd);
  var nEl = document.getElementById('aiTaNote');
  if(nEl) nEl.value = rec && rec.bundle ? (rec.bundle.manualNote||'') : '';
  renderCase(rfqCd);
};
window.aiTA_onPick = function(rfqCd){ window.aiTA_pickRfq(rfqCd); };
window.aiTA_viewAnalysis = function(caseNo, ver){
  var rec = caseByNo(caseNo); if(!rec) return;
  window._aiTA_viewVer = window._aiTA_viewVer || {};
  window._aiTA_viewVer[caseNo] = ver;
  window.aiTA_pickRfq(rec.srcRfq);
};
window.aiTA_build = function(){
  var rfqCd = selectedRfq();
  if(!rfqCd){ alert('ابتدا درخواست را انتخاب کنید'); return; }
  try{
    saveBundleForRfq(rfqCd);
    renderRecent();
    renderCase(rfqCd);
    if(typeof ptfToast==='function') ptfToast('بسته فنی ذخیره شد','ok');
  }catch(e){ alert('خطا در ساخت بسته فنی: '+(e.message||e)); }
};
window.aiTA_analyze = function(){
  var rfqCd = selectedRfq();
  if(!rfqCd){ alert('ابتدا درخواست را انتخاب کنید'); return; }
  var out = document.getElementById('aiTaOut');
  if(out) out.innerHTML = '<div style="background:#eff6ff;border:1px solid #93c5fd;border-radius:14px;padding:18px;color:#1d4ed8">⏳ در حال ساخت/به‌روزرسانی بسته، خواندن ضمائم و اجرای تحلیل فارسی پرونده...</div>';
  var rec;
  try { rec = saveBundleForRfq(rfqCd); } catch(e){ alert('خطا در ساخت بسته: '+(e.message||e)); return; }
  resolveAttachmentsForCase(rec, function(resolvedRec){
    var useRec = caseByRfq(rfqCd) || resolvedRec || rec;
    llmAnalyze(useRec.bundle, function(d){
      var finalData, source='heuristic';
      if(d && d.ok && d.data){
        finalData = normalizeTechcaseResponse(d.data, useRec.bundle);
        source = 'llm';
      } else {
        finalData = heuristicAnalysis(useRec.bundle);
        if(typeof ptfToast==='function') ptfToast('تحلیل با هسته کمکی محلی انجام شد','info');
      }
      var latestRec = caseByRfq(rfqCd) || useRec;
      saveAnalysis(latestRec, finalData, source);
      renderRecent();
      renderCase(rfqCd);
    });
  });
};
window.aiTA_gate = function(){
  var rec = selectedCase();
  if(!rec){ alert('ابتدا یک پرونده فنی بسازید'); return; }
  var a = findAnalysis(rec, currentViewVer(rec));
  if(!a){ alert('ابتدا تحلیل فارسی را اجرا کنید'); return; }
  if(arr(a.criticalMissing).length){
    alert('این پرونده هنوز دارای کمبودهای حیاتی است و طبق ضابطه نمی‌تواند وارد Gate مرحله Proposal شود.');
    return;
  }
  rec.gate = {
    approved:true,
    approvedAt: nowIso(),
    approvedFa: nowFa(),
    approvedBy: curUser(),
    approvedByName: curName(),
    analysisVer: a.ver
  };
  rec.stage = 'gate_approved';
  rec.updatedAt = nowIso();
  rec.updatedFa = nowFa();
  rec.updatedBy = curUser();
  rec.updatedByName = curName();
  patchCase(rec);
  if(typeof audit==='function') audit('AI Technical Assistant','تایید Gate پرونده فنی '+rec.caseNo+' بر مبنای تحلیل '+a.ver, rec.caseNo);
  renderRecent();
  renderCase(rec.srcRfq);
  if(typeof ptfToast==='function') ptfToast('Gate پرونده تایید شد','ok');
};

})();
