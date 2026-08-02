/* PARKED v24.4: Lead Finder از UI و لود اسکریپت خارج شد (فاز ثبات). فایل نگه داشته شده؛ فعال‌سازی مجدد فقط با تأیید کارفرما. */
/* =====================================================================
   PTF CRM — lead-finder.js — Sprint v22.4
   Lead Finder — Source Governance + Candidate Discovery Foundation
   Human-in-the-loop / explainable / evidence-based only
   ===================================================================== */
(function(){
'use strict';

var JOB_KEY = 'ptf_crm_leadfinder_jobs';
var SRC_KEY = 'ptf_crm_leadfinder_sources';

var SOURCE_REGISTRY = [
  { id:'official_company', title:'اعلان رسمی شرکت / وب‌سایت رسمی', trust:'T1', freq:'ad-hoc', legal:'public', note:'Official owner/operator/EPC newsroom' },
  { id:'project_awards', title:'اعلان رسمی پروژه / award', trust:'T1', freq:'ad-hoc', legal:'public', note:'Owner / EPC / public project award source' },
  { id:'public_tender', title:'مناقصه / tender عمومی', trust:'T1', freq:'daily', legal:'public', note:'Procurement intent signal' },
  { id:'exchange_disclosure', title:'افشا / کدال / exchange disclosure', trust:'T1', freq:'daily', legal:'public', note:'Expansion / capex / project signal' },
  { id:'operator_newsroom', title:'اخبار رسمی اپراتور / کارفرما / EPC', trust:'T1', freq:'weekly', legal:'public', note:'Role inference source' },
  { id:'industrial_news', title:'رسانه صنعتی معتبر', trust:'T2', freq:'daily', legal:'public', note:'Strong secondary source' },
  { id:'ministry_release', title:'اطلاعیه وزارت / سازمان / نهاد صنعتی', trust:'T1', freq:'weekly', legal:'public', note:'Official industry signal' },
  { id:'directory_support', title:'دایرکتوری / listing پشتیبان', trust:'T3', freq:'monthly', legal:'public', note:'Weak support only; never sole basis' }
];

function esc(s){ var d=document.createElement('div'); d.textContent=s==null?'':String(s); return d.innerHTML; }
function arr(v){ return Array.isArray(v) ? v : []; }
function getData(k){ try{return JSON.parse(localStorage.getItem(k)||'[]'); }catch(e){ return []; } }
function setData(k,v){ return localStorage.setItem(k, JSON.stringify(v)); }
function curUser(){ try{return curSession().user||'system';}catch(e){return 'system';} }
function curName(){ try{return curSession().name||'سیستم';}catch(e){return 'سیستم';} }
function nowIso(){ return new Date().toISOString(); }
function nowFa(){ try{return typeof faDateTime==='function' ? faDateTime() : new Date().toLocaleString('fa-IR');}catch(e){return new Date().toLocaleString('fa-IR');} }
function jalaliYear(){ try{return String(new Date().toLocaleDateString('fa-IR-u-nu-latn')).split('/')[0]||'1405';}catch(e){return '1405';} }
function norm(s){ return String(s==null?'':s).replace(/[\u200c\u200f\u202a-\u202e]/g,' ').replace(/\s+/g,' ').trim(); }
function dn(s){ return (typeof dedupNorm === 'function') ? dedupNorm(s) : norm(s).toLowerCase(); }
function uniq(a){ var o={}, out=[]; arr(a).forEach(function(x){ var k=JSON.stringify(x); if(!o[k]){ o[k]=1; out.push(x); } }); return out; }
function jobs(){ return getData(JOB_KEY); }
function saveJobs(v){ setData(JOB_KEY, v); }
function srcOverrides(){ return getData(SRC_KEY); }
function saveSrcOverrides(v){ setData(SRC_KEY, v); }
function sourceRegistry(){
  var ov = {};
  srcOverrides().forEach(function(x){ ov[x.id]=x; });
  return SOURCE_REGISTRY.map(function(s){
    var o = ov[s.id] || {};
    return {
      id: s.id,
      title: s.title,
      trust: o.trust || s.trust,
      enabled: o.enabled !== false,
      freq: o.freq || s.freq,
      legal: o.legal || s.legal,
      note: o.note || s.note
    };
  });
}
function sourceById(id){ return sourceRegistry().filter(function(x){ return x.id===id; })[0] || null; }
function nextJobNo(){
  var y = jalaliYear();
  var max = 0;
  jobs().forEach(function(j){
    var m = String(j.jobNo||'').match(new RegExp('^LFD-'+y+'-(\\d+)$'));
    if(m && +m[1] > max) max = +m[1];
  });
  return 'LFD-' + y + '-' + String(max + 1).padStart(3,'0');
}
function patchJob(rec){
  var list = jobs();
  var done = false;
  for(var i=0;i<list.length;i++) if(list[i].jobNo===rec.jobNo){ list[i]=rec; done=true; break; }
  if(!done) list.unshift(rec);
  saveJobs(list);
}
function getJob(jobNo){ return jobs().filter(function(j){ return j.jobNo===jobNo; })[0] || null; }
function selectedJob(){ return getJob(window._lfJobNo || ''); }
function nextEvidenceId(job){
  var mx = 0;
  arr(job && job.evidences).forEach(function(e){ var n = +String(e.id||'').replace(/^E/,''); if(n > mx) mx = n; });
  return 'E' + String(mx + 1).padStart(3,'0');
}
function tfScore(trust){ return trust==='T1' ? 25 : trust==='T2' ? 17 : 8; }
function roleScore(role){
  var r = String(role||'').toLowerCase();
  if(/owner|operator|procurement|buyer|کارفرما|اپراتور|خرید|تدارکات/.test(r)) return 15;
  if(/epc|consultant|engineering|پیمانکار|مشاور/.test(r)) return 12;
  if(/subcontractor|sub-contractor|sub contractor|sub\b|زیرپیمانکار/.test(r)) return 8;
  if(/manufacturer|integrator|distributor/.test(r)) return 6;
  return 5;
}
function daysSince(iso){
  if(!iso) return 9999;
  try {
    var d = new Date(iso), n = new Date();
    if(isNaN(d.getTime())) return 9999;
    return Math.max(0, Math.round((n - d) / 86400000));
  } catch(e){ return 9999; }
}
function recencyScore(iso){
  var d = daysSince(iso);
  if(d <= 30) return 20;
  if(d <= 90) return 15;
  if(d <= 180) return 10;
  if(d <= 365) return 5;
  return 1;
}
function keywordHits(text, words){
  var blob = dn(text || '');
  var n = 0;
  words.forEach(function(w){ if(w && blob.indexOf(dn(w)) > -1) n++; });
  return n;
}
function parseWords(s){
  return String(s||'').split(/[\n,،;؛|]+/).map(function(x){ return x.trim(); }).filter(Boolean);
}
function evidenceBlob(evs){
  return arr(evs).map(function(e){ return [e.title,e.url,e.snippet,e.familyLabel,e.activityDate].join(' '); }).join(' | ');
}
function detectGeo(text, job){
  var geo = parseWords(job.params.geography || '');
  if(!geo.length) return 0;
  return Math.min(5, keywordHits(text, geo) * 2.5);
}
function detectPortfolio(text, job){
  var words = parseWords((job.params.targetIndustry || '') + ',' + (job.params.equipmentFamily || '') + ',' + (job.params.keywords || ''));
  if(!words.length) return 0;
  return Math.min(5, keywordHits(text, words));
}
function detectProjectFit(text, job){
  var words = parseWords((job.params.projectType || '') + ',' + (job.params.keywords || ''));
  if(!words.length) return 5;
  return Math.min(10, keywordHits(text, words) * 2);
}
function detectEquipFit(text, job){
  var words = parseWords((job.params.equipmentFamily || '') + ',' + (job.params.keywords || ''));
  if(!words.length) return 6;
  return Math.min(15, keywordHits(text, words) * 3);
}
function repeatedSignal(company, evs){
  var c = dn(company);
  var n = 0;
  arr(evs).forEach(function(e){ if(dn([e.title,e.snippet].join(' ')).indexOf(c) > -1) n++; });
  return n > 1 ? 5 : 0;
}
function domainOf(url){
  try{ return String(new URL(url).hostname||'').replace(/^www\./,'').toLowerCase(); }catch(e){ return ''; }
}
function leadDup(candidate){
  var leadRec = { co: candidate.company || '', person: candidate.contact || '', tel: candidate.phone || '', mob: candidate.phone || '', email: candidate.email || '' };
  var custRec = { co: candidate.company || '', tel: candidate.phone || '', mob: candidate.phone || '', coWeb: candidate.website || '' };
  var leadConf = (typeof ptfCheckDup === 'function') ? ptfCheckDup('lead', leadRec, null) : [];
  var custConf = (typeof ptfCheckDup === 'function') ? ptfCheckDup('customer', custRec, null) : [];
  var domain = domainOf(candidate.website || '');
  var domainHits = [];
  if(domain){
    getData('ptf_crm_customers').forEach(function(c){ var d = domainOf(c.coWeb || ''); if(d && d===domain) domainHits.push({ kind:'customer', cd:c.cd, name:c.co }); });
    getData('ptf_crm_leads').forEach(function(c){ var d = domainOf(c.coWeb || c.website || ''); if(d && d===domain) domainHits.push({ kind:'lead', cd:c.cd, name:c.co }); });
  }
  var refs = [];
  leadConf.forEach(function(x){ refs.push({kind:'lead', cd:x.cd, name:x.name, reason:x.f}); });
  custConf.forEach(function(x){ refs.push({kind:'customer', cd:x.cd, name:x.name, reason:x.f}); });
  domainHits.forEach(function(x){ refs.push({kind:x.kind, cd:x.cd, name:x.name, reason:'website domain'}); });
  var cls = 'new';
  if(refs.some(function(x){ return /نام|company|website domain/i.test(x.reason); })) cls = 'exact_duplicate';
  else if(refs.length) cls = 'probable_duplicate';
  return { classification: cls, refs: refs };
}
function trustFromEvidence(evs){
  var best = 'T3';
  arr(evs).forEach(function(e){
    var t = e.trust || 'T3';
    if(t === 'T1') best = 'T1';
    else if(t === 'T2' && best !== 'T1') best = 'T2';
  });
  return best;
}
function scoreCandidate(candidate, job){
  var evs = arr(candidate.evidence);
  var trust = trustFromEvidence(evs);
  var text = [candidate.company, candidate.role, candidate.industry, candidate.whyRelevant, candidate.summaryFa, evidenceBlob(evs)].join(' ');
  var dims = {
    sourceTrust: tfScore(trust),
    recency: recencyScore(candidate.activityDate || (evs[0] && evs[0].activityDate)),
    projectRelevance: detectProjectFit(text, job),
    equipmentRelevance: detectEquipFit(text, job),
    roleStrength: roleScore(candidate.role),
    repeatedActivity: repeatedSignal(candidate.company, evs),
    geographicFit: detectGeo(text, job),
    strategicFit: detectPortfolio(text, job)
  };
  var total = 0; Object.keys(dims).forEach(function(k){ total += +dims[k]||0; });
  return { total: Math.min(100, Math.round(total)), trust: trust, dimensions: dims };
}
window.ptfLeadFinderScoreCandidate = scoreCandidate;
window.ptfLeadFinderDup = leadDup;

function heuristicCandidates(job){
  return arr(job.evidences).slice(0,10).map(function(e, idx){
    var company = firstCompany(e.title) || firstCompany(e.snippet) || ('Candidate ' + (idx+1));
    var role = inferRole([e.title,e.snippet,job.params.companyTypes].join(' '));
    return {
      cid: 'C' + String(idx+1).padStart(3,'0'),
      company: company,
      role: role,
      industry: job.params.targetIndustry || '',
      whyRelevant: truncate(e.snippet || e.title || '', 220),
      activityDate: e.activityDate || '',
      evidence: [{ title:e.title||'', url:e.url||'', quote:truncate(e.snippet||'', 260), trust:e.trust || 'T3', familyLabel:e.familyLabel||'' }],
      recommendedAction: 'review'
    };
  });
}
function firstCompany(text){
  text = String(text||'').trim();
  if(!text) return '';
  var cut = text.split(/[-|:؛،]/)[0].trim();
  cut = cut.replace(/^(اعلان|خبر|مناقصه|پروژه|tender|news)\s+/i,'').trim();
  return cut.length >= 3 ? cut.slice(0,120) : '';
}
function inferRole(text){
  text = String(text||'');
  if(/owner|operator|کارفرما|اپراتور/i.test(text)) return 'owner/operator';
  if(/epc|پیمانکار/i.test(text)) return 'EPC contractor';
  if(/consultant|مشاور/i.test(text)) return 'consultant';
  if(/procurement|buyer|خرید|تدارکات/i.test(text)) return 'buyer/procurement';
  return 'industrial actor';
}
function truncate(s, n){ s=String(s||''); return s.length>n ? s.slice(0,n-1)+'…' : s; }
function normalizeLlmCandidates(raw, job){
  var out=[];
  arr(raw).forEach(function(c, idx){
    var ev = arr(c.evidence).map(function(e){
      return {
        title: norm(e.title || e.sourceTitle || ''),
        url: norm(e.url || ''),
        quote: norm(e.quote || e.snippet || e.text || ''),
        trust: norm(e.trust || 'T3') || 'T3',
        familyLabel: norm(e.familyLabel || e.sourceFamily || ''),
        activityDate: norm(e.activityDate || c.activityDate || '')
      };
    }).filter(function(e){ return e.title || e.quote || e.url; });
    out.push({
      cid: 'C' + String(idx+1).padStart(3,'0'),
      company: norm(c.company || c.companyName || ''),
      role: norm(c.role || ''),
      industry: norm(c.industry || job.params.targetIndustry || ''),
      whyRelevant: norm((typeof ptfAiClean==='function' ? ptfAiClean(c.whyRelevant || c.reason || '') : (c.whyRelevant || c.reason || ''))),
      activityDate: norm(c.activityDate || ''),
      evidence: ev,
      recommendedAction: norm(c.recommendedAction || 'review') || 'review'
    });
  });
  return out.filter(function(c){ return c.company; });
}
function leadFinderLlm(job, cb){
  if(!(typeof fetch === 'function')) { cb({ok:false}); return; }
  var payloadText = [
    'Lead Finder discovery job',
    'Target industry: ' + (job.params.targetIndustry || ''),
    'Equipment family: ' + (job.params.equipmentFamily || ''),
    'Keywords: ' + (job.params.keywords || ''),
    'Project type: ' + (job.params.projectType || ''),
    'Geography: ' + (job.params.geography || ''),
    'Time window months: ' + (job.params.timeWindow || '12'),
    'Target company types: ' + (job.params.companyTypes || ''),
    'Selected source families: ' + arr(job.sourceFamilies).join(', '),
    'Evidence items:',
    arr(job.evidences).map(function(e, i){ return (i+1)+') ['+(e.trust||'T3')+'] '+(e.familyLabel||'')+' | '+(e.title||'')+' | '+(e.url||'')+' | date='+(e.activityDate||'')+' | snippet='+(e.snippet||''); }).join('\n')
  ].join('\n\n');
  fetch('../api/llm.php?action=leadfinder', { method:'POST', headers:(typeof ptfApiAuthHeaders==='function'?ptfApiAuthHeaders(true):{'Content-Type':'application/json'}), body: JSON.stringify({ text: payloadText.slice(0, 12000) }) })
    .then(function(r){ return r.json(); })
    .then(cb)
    .catch(function(){ cb({ok:false}); });
}
function composeCandidateSet(job, llmData){
  var list = llmData && llmData.ok && llmData.data && llmData.data.candidates ? normalizeLlmCandidates(llmData.data.candidates, job) : heuristicCandidates(job);
  var seen={};
  return list.filter(function(c){ var k=dn(c.company); if(!k || seen[k]) return false; seen[k]=1; return true; }).map(function(c){
    var score = scoreCandidate(c, job);
    var dup = leadDup(c);
    c.score = score.total;
    c.scoreBreakdown = score;
    c.dup = dup;
    c.reviewStatus = c.reviewStatus || 'pending';
    c.reviewNote = c.reviewNote || '';
    c.actionTaken = c.actionTaken || '';
    c.explanationFa = 'امتیاز این کاندید بر اساس اعتبار منبع (' + score.trust + '), تازگی خبر, انطباق کلیدواژه‌ها, نقش پروژه‌ای و سیگنال تکرار فعالیت محاسبه شده است.';
    return c;
  }).sort(function(a,b){ return (+b.score||0) - (+a.score||0); });
}
function defaultSourceState(){
  return sourceRegistry().filter(function(s){ return s.enabled; }).map(function(s){ return s.id; });
}
function ensureWorkingState(rec){
  rec = rec || null;
  window._lfForm = {
    targetIndustry: rec && rec.params ? rec.params.targetIndustry || '' : '',
    equipmentFamily: rec && rec.params ? rec.params.equipmentFamily || '' : '',
    keywords: rec && rec.params ? rec.params.keywords || '' : '',
    projectType: rec && rec.params ? rec.params.projectType || '' : '',
    geography: rec && rec.params ? rec.params.geography || '' : '',
    timeWindow: rec && rec.params ? rec.params.timeWindow || 12 : 12,
    companyTypes: rec && rec.params ? rec.params.companyTypes || '' : '',
    sourceFamilies: rec && rec.sourceFamilies ? rec.sourceFamilies.slice() : defaultSourceState(),
    evidences: rec && rec.evidences ? JSON.parse(JSON.stringify(rec.evidences)) : []
  };
}
function fld(id){ var e=document.getElementById(id); return e ? e.value.trim() : ''; }
function gatherForm(){
  if(!window._lfForm) ensureWorkingState(null);
  window._lfForm.targetIndustry = fld('lfIndustry');
  window._lfForm.equipmentFamily = fld('lfEquip');
  window._lfForm.keywords = fld('lfKeywords');
  window._lfForm.projectType = fld('lfProject');
  window._lfForm.geography = fld('lfGeo');
  window._lfForm.timeWindow = +fld('lfTime') || 12;
  window._lfForm.companyTypes = fld('lfTypes');
  window._lfForm.sourceFamilies = Array.prototype.slice.call(document.querySelectorAll('.lf-src:checked')).map(function(el){ return el.value; });
  return window._lfForm;
}
function buildJobRecord(existing){
  var f = gatherForm();
  return {
    jobNo: existing ? existing.jobNo : nextJobNo(),
    kind: 'leadfinder',
    status: existing && existing.status ? existing.status : 'draft',
    createdAt: existing ? existing.createdAt : nowIso(),
    createdFa: existing ? existing.createdFa : nowFa(),
    createdBy: existing ? existing.createdBy : curUser(),
    createdByName: existing ? existing.createdByName : curName(),
    updatedAt: nowIso(),
    updatedFa: nowFa(),
    updatedBy: curUser(),
    updatedByName: curName(),
    params: {
      targetIndustry: f.targetIndustry,
      equipmentFamily: f.equipmentFamily,
      keywords: f.keywords,
      projectType: f.projectType,
      geography: f.geography,
      timeWindow: f.timeWindow,
      companyTypes: f.companyTypes
    },
    sourceFamilies: f.sourceFamilies.slice(),
    evidences: JSON.parse(JSON.stringify(f.evidences || [])),
    candidates: existing && existing.candidates ? existing.candidates : [],
    reviewSummary: existing && existing.reviewSummary ? existing.reviewSummary : { pending:0, saved:0, dismissed:0, later:0 }
  };
}
function recount(job){
  var s={ pending:0, saved:0, dismissed:0, later:0 };
  arr(job.candidates).forEach(function(c){
    if(c.reviewStatus==='saved') s.saved++;
    else if(c.reviewStatus==='dismissed') s.dismissed++;
    else if(c.reviewStatus==='later') s.later++;
    else s.pending++;
  });
  job.reviewSummary = s;
}
function registryHtml(){
  return sourceRegistry().map(function(s){
    var checked = window._lfForm && window._lfForm.sourceFamilies.indexOf(s.id) > -1;
    var color = s.trust==='T1' ? '#166534' : s.trust==='T2' ? '#b45309' : '#92400e';
    var bg = s.trust==='T1' ? '#dcfce7' : s.trust==='T2' ? '#fef3c7' : '#fff7ed';
    return '<label style="display:flex;align-items:flex-start;gap:8px;border:1px solid var(--brd);border-radius:10px;padding:8px 10px;background:#fff;cursor:pointer">' +
      '<input type="checkbox" class="lf-src" value="'+esc(s.id)+'"'+(checked?' checked':'')+'>'+
      '<div style="min-width:0"><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><b>'+esc(s.title)+'</b><span style="background:'+bg+';color:'+color+';border:1px solid rgba(0,0,0,.05);border-radius:999px;padding:1px 8px;font-size:10.5px">'+esc(s.trust)+'</span></div><div style="font-size:11.5px;color:#64748b;line-height:1.8">'+esc(s.note)+' | تناوب به‌روزرسانی: '+esc(s.freq)+' | وضعیت حقوقی: '+esc(s.legal)+'</div></div></label>';
  }).join('');
}
function evidenceFamilyOptions(cur){
  return sourceRegistry().map(function(s){ return '<option value="'+esc(s.id)+'"'+(cur===s.id?' selected':'')+'>'+esc(s.title)+' — '+esc(s.trust)+'</option>'; }).join('');
}
function evidenceRows(){
  var list = arr(window._lfForm && window._lfForm.evidences);
  if(!list.length) return '<div style="color:#94a3b8;font-size:12px">هنوز هیچ evidence ثبت نشده است. حداقل یک منبع/اسنیپت برای تحلیل لازم است.</div>';
  return list.map(function(e){
    return '<div style="border:1px solid var(--brd);border-radius:12px;padding:10px;background:#fff;margin-bottom:8px">'+
      '<div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><div><b>'+esc(e.title||e.url||e.id)+'</b><div style="font-size:11.5px;color:#64748b">'+esc(e.familyLabel||'')+' | '+esc(e.trust||'T3')+' | '+esc(e.activityDate||'')+'</div></div>'+
      '<div style="display:flex;gap:4px"><button class="ba" onclick="ptfLfEditEvidence(\''+esc(e.id)+'\')">✏️</button><button class="ba" style="color:#dc2626" onclick="ptfLfDelEvidence(\''+esc(e.id)+'\')">🗑️</button></div></div>'+
      (e.url ? '<div style="font-size:11px;color:#0e7490;margin-top:4px;direction:ltr">'+esc(e.url)+'</div>' : '')+
      '<div style="font-size:12px;color:#334155;margin-top:6px;line-height:1.9">'+esc(truncate(e.snippet||'', 340))+'</div></div>';
  }).join('');
}
function queueItems(){
  var out=[];
  jobs().forEach(function(j){
    arr(j.candidates).forEach(function(c){ if(c.reviewStatus==='pending' || c.reviewStatus==='later') out.push({ job:j, candidate:c }); });
  });
  return out.sort(function(a,b){ return (+b.candidate.score||0) - (+a.candidate.score||0); });
}
function dupHtml(d){
  if(!d || !d.classification) return '<span style="color:#94a3b8">بررسی تکرار هنوز انجام نشده</span>';
  if(d.classification==='new') return '<span style="color:#166534">رکورد جدید</span>';
  if(d.classification==='exact_duplicate') return '<span style="color:#dc2626">تکراری قطعی</span>';
  return '<span style="color:#b45309">تکراری محتمل</span>';
}
function candCard(job, c){
  var dims = c.scoreBreakdown && c.scoreBreakdown.dimensions ? c.scoreBreakdown.dimensions : {};
  var refs = arr(c.dup && c.dup.refs).slice(0,3).map(function(r){ return r.kind + ': ' + (r.name||'') + (r.cd ? ' ('+r.cd+')' : '') + ' — ' + (r.reason||''); }).join('<br>');
  return '<div style="background:#fff;border:1px solid var(--brd);border-radius:14px;padding:12px;margin-bottom:10px">'+
    '<div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;flex-wrap:wrap"><div><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><b>'+esc(c.company)+'</b><span style="background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:999px;padding:2px 8px;font-size:10.5px">امتیاز '+esc(String(c.score||0))+'</span><span style="background:#f8fafc;color:#475569;border:1px solid #cbd5e1;border-radius:999px;padding:2px 8px;font-size:10.5px">'+esc(c.scoreBreakdown && c.scoreBreakdown.trust || 'T3')+'</span></div><div style="font-size:11.5px;color:#64748b">'+esc(c.role||'فعال صنعتی')+' | '+esc(c.industry||'')+' | '+esc(c.activityDate||'')+'</div></div>'+
    '<div style="font-size:11px;color:#475569">'+dupHtml(c.dup)+'</div></div>'+
    '<div style="font-size:12px;color:#334155;line-height:1.9;margin-top:8px"><b>چرایی اهمیت:</b> '+esc(c.whyRelevant||'—')+'</div>'+
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;margin-top:8px;font-size:11.5px;color:#475569">'+
      '<div>اعتبار منبع: <b>'+esc(String(dims.sourceTrust||0))+'</b></div><div>تازگی: <b>'+esc(String(dims.recency||0))+'</b></div><div>انطباق پروژه: <b>'+esc(String(dims.projectRelevance||0))+'</b></div><div>انطباق تجهیز: <b>'+esc(String(dims.equipmentRelevance||0))+'</b></div><div>نقش پروژه‌ای: <b>'+esc(String(dims.roleStrength||0))+'</b></div><div>تکرار فعالیت: <b>'+esc(String(dims.repeatedActivity||0))+'</b></div></div>'+
    (refs ? '<div style="margin-top:8px;font-size:11.5px;color:#92400e;background:#fff7ed;border:1px solid #fdba74;border-radius:10px;padding:8px">'+refs+'</div>' : '')+
    '<div style="margin-top:8px;font-size:11.5px;color:#64748b"><b>شواهد</b><br>'+arr(c.evidence).map(function(e){ return '• ['+esc(e.trust||'T3')+'] '+esc(e.familyLabel||'')+' — '+esc(e.title||e.url||'')+(e.url?' <span style="direction:ltr;color:#0e7490">'+esc(e.url)+'</span>':'')+'<br><span style="color:#334155">'+esc(truncate(e.quote||'', 180))+'</span>'; }).join('<br>')+'</div>'+
    '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">'+
      '<button class="bt" onclick="ptfLfRegister(\''+esc(job.jobNo)+'\',\''+esc(c.cid)+'\')">➕ ثبت به‌عنوان لید</button>'+
      '<button class="bt bt-o" onclick="ptfLfCandidateState(\''+esc(job.jobNo)+'\',\''+esc(c.cid)+'\',\'later\')">⏳ برای بعد</button>'+
      '<button class="bt bt-o" style="color:#dc2626" onclick="ptfLfCandidateState(\''+esc(job.jobNo)+'\',\''+esc(c.cid)+'\',\'dismissed\')">✖ رد</button>'+
      '</div></div>';
}
function queueHtml(){
  var items = queueItems();
  return items.length ? items.slice(0,8).map(function(x){ return candCard(x.job, x.candidate); }).join('') : '<div style="color:#94a3b8;font-size:12px">صف بازبینی خالی است.</div>';
}
function recentJobsHtml(){
  var rows = jobs().slice(0,8).map(function(j){
    recount(j);
    return '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;border-bottom:1px dashed var(--brd);padding:7px 0">'+
      '<div style="min-width:0"><div style="font-weight:800">'+esc(j.jobNo)+'</div><div style="font-size:11.5px;color:#64748b">'+esc(j.params.targetIndustry||'')+' | '+esc(j.params.equipmentFamily||'')+' | شاهدها: '+arr(j.evidences).length+'</div></div>'+
      '<div style="display:flex;gap:6px;align-items:center;flex:none"><span style="font-size:11px;color:#475569">در انتظار '+j.reviewSummary.pending+'</span><button class="ba" onclick="ptfLfPickJob(\''+esc(j.jobNo)+'\')">باز</button></div></div>';
  }).join('');
  return rows || '<div style="color:#94a3b8;font-size:12px">هنوز هیچ job کشف لیدی ثبت نشده است.</div>';
}

window.ptfLfHtml = function(){
  if(!window._lfForm) ensureWorkingState(null);
  return '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:18px">'+
    '<div style="background:var(--crd);border:1px solid var(--brd);border-radius:16px;padding:16px">'+
      '<h3 style="margin:0 0 8px">🔎 لیدیاب — اسپرینت v22.4</h3>'+
      '<div style="font-size:12.5px;color:#64748b;line-height:2;margin-bottom:12px">این نسخه برای کشف سرنخ‌های باارزش بر پایه منبع عمومیِ قابل رهگیری، امتیاز explainable، duplicate check و صف بازبینی انسانی طراحی شده است؛ نه به‌عنوان scraper کور.</div>'+
      '<div class="fr"><div class="fld"><label>صنعت هدف</label><input id="lfIndustry" value="'+esc(window._lfForm.targetIndustry||'')+'" placeholder="مثلا پتروشیمی / فولاد / پیمانکار EPC"></div><div class="fld"><label>خانواده تجهیز</label><input id="lfEquip" value="'+esc(window._lfForm.equipmentFamily||'')+'" placeholder="مثلا شیر کنترلی / ابزار دقیق"></div></div>'+
      '<div class="fr"><div class="fld"><label>کلیدواژه‌ها</label><input id="lfKeywords" value="'+esc(window._lfForm.keywords||'')+'" placeholder="با ویرگول جدا کنید"></div><div class="fld"><label>نوع پروژه</label><input id="lfProject" value="'+esc(window._lfForm.projectType||'')+'" placeholder="مثلا توسعه ظرفیت / مناقصه / تعمیرات اساسی"></div></div>'+
      '<div class="fr"><div class="fld"><label>جغرافیا</label><input id="lfGeo" value="'+esc(window._lfForm.geography||'')+'" placeholder="مثلا ایران / خوزستان / عسلویه"></div><div class="fld"><label>بازه زمانی (ماه)</label><input id="lfTime" value="'+esc(String(window._lfForm.timeWindow||12))+'" style="direction:ltr"></div></div>'+
      '<div class="fld"><label>نوع شرکت‌های هدف</label><input id="lfTypes" value="'+esc(window._lfForm.companyTypes||'')+'" placeholder="مثلا کارفرما، اپراتور، EPC، مشاور، خرید"></div>'+
      '<div style="margin:10px 0"><div style="font-weight:900;margin-bottom:6px">🧭 رجیستری حاکمیت منبع</div><div style="display:grid;gap:8px">'+registryHtml()+'</div></div>'+
      '<div style="margin-top:12px;background:#f8fafc;border:1px solid var(--brd);border-radius:12px;padding:12px">'+
        '<div style="font-weight:900;margin-bottom:6px">📎 ثبت شواهد</div>'+
        '<div class="fr"><div class="fld"><label>عنوان منبع</label><input id="lfEvTitle" placeholder="تیتر خبر / اعلان / tender"></div><div class="fld"><label>خانواده منبع</label><select id="lfEvFamily">'+evidenceFamilyOptions('')+'</select></div></div>'+
        '<div class="fr"><div class="fld"><label>آدرس منبع</label><input id="lfEvUrl" placeholder="https://..." style="direction:ltr"></div><div class="fld"><label>تاریخ فعالیت / انتشار</label><input id="lfEvDate" placeholder="YYYY-MM-DD" style="direction:ltr"></div></div>'+
        '<div class="fld"><label>اسنیپت / شاهد</label><textarea id="lfEvSnippet" rows="4" placeholder="متن شاهد عمومی / نشانه پروژه / خلاصه tender"></textarea></div>'+
        '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="bt bt-o" onclick="ptfLfAddEvidence()">➕ افزودن شاهد</button><button class="bt bt-o" onclick="ptfLfSaveJob()">💾 ذخیره job کشف</button><button class="bt" onclick="ptfLfAnalyze()">🤖 تحلیل کاندیدها</button></div>'+
        '<div id="lfEvidenceList" style="margin-top:10px">'+evidenceRows()+'</div></div>'+
      '<div style="margin-top:12px;background:#f8fafc;border:1px solid var(--brd);border-radius:12px;padding:12px"><div style="font-weight:900;margin-bottom:6px">🗂️ jobهای اخیر کشف لید</div><div id="lfJobsBox">'+recentJobsHtml()+'</div></div>'+
    '</div>'+
    '<div id="lfOut" style="display:grid;gap:14px"></div>'+
  '</div>';
};
window.ptfLfAfterRender = function(){
  if(!window._lfForm) ensureWorkingState(null);
  ptfLfRenderOut();
};
window.ptfLfPickJob = function(jobNo){
  var j = getJob(jobNo); if(!j) return;
  window._lfJobNo = jobNo;
  ensureWorkingState(j);
  if(typeof aiWB_tab==='function') aiWB_tab('leadfinder');
};
window.ptfLfSaveJob = function(){
  var existing = selectedJob();
  var rec = buildJobRecord(existing);
  patchJob(rec);
  window._lfJobNo = rec.jobNo;
  recount(rec); patchJob(rec);
  ptfLfRenderOut();
  if(typeof audit==='function') audit('Lead Finder','save discovery job ' + rec.jobNo, rec.jobNo);
  if(typeof ptfToast==='function') ptfToast('job کشف لید ذخیره شد','ok');
};
window.ptfLfAddEvidence = function(){
  if(!window._lfForm) ensureWorkingState(selectedJob());
  var title = fld('lfEvTitle');
  var fam = fld('lfEvFamily');
  var snippet = fld('lfEvSnippet');
  var url = fld('lfEvUrl');
  var dt = fld('lfEvDate');
  if(!title && !snippet) { alert('حداقل عنوان یا متن شاهد را وارد کنید'); return; }
  var src = sourceById(fam);
  var list = window._lfForm.evidences || [];
  var fakeJob = { evidences:list };
  var id = nextEvidenceId(fakeJob);
  list.push({ id:id, title:title, familyId:fam, familyLabel:src ? src.title : fam, trust:src ? src.trust : 'T3', url:url, activityDate:dt, snippet:snippet });
  window._lfForm.evidences = list;
  ['lfEvTitle','lfEvUrl','lfEvDate','lfEvSnippet'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=''; });
  var bx = document.getElementById('lfEvidenceList'); if(bx) bx.innerHTML = evidenceRows();
};
window.ptfLfEditEvidence = function(id){
  var list = arr(window._lfForm && window._lfForm.evidences);
  var e = list.filter(function(x){ return x.id===id; })[0]; if(!e) return;
  setTimeout(function(){
    setField('lfEvTitle', e.title); setField('lfEvUrl', e.url); setField('lfEvDate', e.activityDate); setField('lfEvSnippet', e.snippet); setField('lfEvFamily', e.familyId);
    window._lfForm.evidences = list.filter(function(x){ return x.id!==id; });
    var bx = document.getElementById('lfEvidenceList'); if(bx) bx.innerHTML = evidenceRows();
  },0);
};
window.ptfLfDelEvidence = function(id){
  if(!confirm('شاهد / evidence حذف شود؟')) return;
  window._lfForm.evidences = arr(window._lfForm && window._lfForm.evidences).filter(function(x){ return x.id!==id; });
  var bx = document.getElementById('lfEvidenceList'); if(bx) bx.innerHTML = evidenceRows();
};
function setField(id, val){ var e=document.getElementById(id); if(e) e.value = val==null?'':val; }
window.ptfLfAnalyze = function(){
  var rec = buildJobRecord(selectedJob());
  if(!arr(rec.evidences).length){ alert('حداقل یک شاهد / evidence لازم است'); return; }
  patchJob(rec);
  window._lfJobNo = rec.jobNo;
  var out = document.getElementById('lfOut');
  if(out) out.innerHTML = '<div style="background:#eff6ff;border:1px solid #93c5fd;border-radius:14px;padding:18px;color:#1d4ed8">⏳ در حال تحلیل شواهد منبع و ساخت کاندیدهای لید...</div>';
  leadFinderLlm(rec, function(d){
    var j = getJob(rec.jobNo) || rec;
    j.candidates = composeCandidateSet(j, d);
    j.status = 'analyzed';
    recount(j);
    patchJob(j);
    ptfLfRenderOut();
    if(typeof audit==='function') audit('Lead Finder','analyze discovery job ' + j.jobNo, j.jobNo);
  });
};
window.ptfLfCandidateState = function(jobNo, cid, status){
  var j = getJob(jobNo); if(!j) return;
  arr(j.candidates).forEach(function(c){ if(c.cid===cid){ c.reviewStatus=status; c.actionTaken=status; } });
  recount(j); patchJob(j); ptfLfRenderOut();
};
window.ptfLfRegister = function(jobNo, cid){
  var j = getJob(jobNo); if(!j) return;
  var c = arr(j.candidates).filter(function(x){ return x.cid===cid; })[0]; if(!c) return;
  if(c.dup && c.dup.classification==='exact_duplicate'){
    alert('این کاندید تکراری قطعی است. ابتدا رکورد موجود را بررسی کنید و در صورت نیاز از ابزارهای merge/ویرایش استفاده کنید.');
    return;
  }
  var leads = getData('ptf_crm_leads');
  var rec = {
    cd: (typeof ptfUnifiedCode==='function' ? ptfUnifiedCode('LEAD') : (typeof genCode==='function' ? genCode('LEAD') : ('LEAD-' + Date.now()))),
    co: c.company,
    person: c.contact || '',
    role: c.role || '',
    ind: c.industry || j.params.targetIndustry || 'سایر',
    tel: c.phone || '',
    mob: c.phone || '',
    email: c.email || '',
    src: 'لیدیاب',
    firstISO: c.activityDate || new Date().toISOString().slice(0,10),
    firstFa: (typeof gDateToFa==='function' ? gDateToFa(c.activityDate || new Date().toISOString().slice(0,10)) : ''),
    stage: 'new',
    hist: [{ t:(typeof faDateTime==='function' ? faDateTime() : nowFa()), k:'ثبت', tx:'ثبت از لیدیاب — job ' + j.jobNo + ' | امتیاز ' + c.score }],
    createdFa: (typeof faDate==='function' ? faDate() : ''),
    createdISO: new Date().toISOString().slice(0,10),
    need: [j.params.equipmentFamily, j.params.keywords, c.whyRelevant].filter(Boolean).join(' | '),
    lfJobNo: j.jobNo,
    lfScore: c.score,
    lfEvidence: c.evidence,
    lfWhy: c.whyRelevant,
    website: c.website || ''
  };
  if(c.dup && c.dup.classification==='probable_duplicate'){
    if(!confirm('این کاندید probable duplicate است. با وجود شباهت موجود، به‌عنوان lead جدید ثبت شود؟')) return;
  }
  if(typeof dedupStamp==='function') dedupStamp(rec);
  leads.unshift(rec);
  setData('ptf_crm_leads', leads);
  if(typeof renderLeads==='function') renderLeads();
  c.reviewStatus = 'saved';
  c.actionTaken = 'saved';
  c.crmLeadCd = rec.cd;
  recount(j); patchJob(j); ptfLfRenderOut();
  if(typeof audit==='function') audit('Lead Finder','register lead candidate ' + c.company + ' from ' + j.jobNo, rec.cd);
  if(typeof ptfToast==='function') ptfToast('کاندید از لیدیاب به لید ثبت شد','ok');
};
window.ptfLfToggleSource = function(id){
  var list = sourceRegistry().map(function(s){ return { id:s.id, trust:s.trust, enabled:s.enabled }; });
  list = list.map(function(s){ if(s.id===id) s.enabled=!s.enabled; return s; });
  saveSrcOverrides(list);
};
function ptfLfRenderOut(){
  var out = document.getElementById('lfOut'); if(!out) return;
  var j = selectedJob();
  var candHtml = j && arr(j.candidates).length ? arr(j.candidates).map(function(c){ return candCard(j, c); }).join('') : '<div style="color:#94a3b8;font-size:12px">برای job انتخابی هنوز کاندیدی ساخته نشده است.</div>';
  out.innerHTML =
    '<div style="background:#fff;border:1px solid var(--brd);border-radius:16px;padding:16px">'+
      '<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap"><div><div style="font-weight:900">📋 صف بازبینی</div><div style="font-size:12px;color:#64748b">کاندیدهای «در انتظار» و «برای بعد» از همه jobها</div></div><div style="font-size:12px;color:#475569">تعداد: '+queueItems().length+'</div></div><div style="margin-top:10px">'+queueHtml()+'</div></div>'+
    '<div style="background:#fff;border:1px solid var(--brd);border-radius:16px;padding:16px">'+
      '<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap"><div><div style="font-weight:900">🧪 job جاری</div><div style="font-size:12px;color:#64748b">'+(j ? esc(j.jobNo) + ' | ' + esc(j.status) + ' | شواهد ' + arr(j.evidences).length : 'هنوز job انتخاب نشده')+'</div></div>'+
      (j ? '<div style="font-size:12px;color:#475569">در انتظار '+(j.reviewSummary&&j.reviewSummary.pending||0)+' | ثبت‌شده '+(j.reviewSummary&&j.reviewSummary.saved||0)+' | رد '+(j.reviewSummary&&j.reviewSummary.dismissed||0)+'</div>' : '') + '</div>'+
      '<div style="margin-top:10px">'+candHtml+'</div></div>';
  var jb = document.getElementById('lfJobsBox'); if(jb) jb.innerHTML = recentJobsHtml();
}

})();
