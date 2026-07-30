/* PARKED v24.5: Technical Proposals Composer از UI/لود خارج شد (فاز ثبات + پیچیدگی اجرایی/وابستگی LLM). فایل نگه داشته شده. */
/* =====================================================================
   PTF CRM — tech-proposals.js — v22.4 runtime (introduced in v22.3)
   Technical Proposal Composer — English Proposal v1 + Versioning
   Uses deterministic calc outputs only; LLM may draft narrative sections but never calculations
   ===================================================================== */
(function(){
'use strict';

var KEY = 'ptf_crm_techproposals';
var CASE_KEY = 'ptf_crm_techcases';
var CALC_KEY = 'ptf_crm_calc_runs';

function esc(s){ var d=document.createElement('div'); d.textContent=s==null?'':String(s); return d.innerHTML; }
function arr(v){ return Array.isArray(v) ? v : []; }
function getData(k){ try{return JSON.parse(localStorage.getItem(k)||'[]'); }catch(e){ return []; } }
function setData(k,v){ return localStorage.setItem(k, JSON.stringify(v)); }
function curUser(){ try{return curSession().user||'system';}catch(e){return 'system';} }
function curName(){ try{return curSession().name||'سیستم';}catch(e){return 'سیستم';} }
function nowIso(){ return new Date().toISOString(); }
function nowDate(){ return new Date().toISOString().slice(0,10); }
function nowFa(){ try{return typeof faDateTime==='function' ? faDateTime() : new Date().toLocaleString('fa-IR');}catch(e){return new Date().toLocaleString('fa-IR');} }
function jalaliYear(){ try{return String(new Date().toLocaleDateString('fa-IR-u-nu-latn')).split('/')[0]||'1405';}catch(e){return '1405';} }
function proposals(){ return getData(KEY); }
function saveProposals(v){ setData(KEY, v); }
function cases(){ return getData(CASE_KEY); }
function calcRuns(){ return getData(CALC_KEY); }
function norm(s){ return String(s==null?'':s).replace(/[\u200c\u200f\u202a-\u202e]/g,' ').replace(/\s+/g,' ').trim(); }
function firstNonEmpty(){ for(var i=0;i<arguments.length;i++){ var v=arguments[i]; if(v!=null && String(v).trim()) return String(v).trim(); } return ''; }

var SELLER = {
  company: 'Pishro Tajhiz Fartak Co.',
  logo: '../assets/images/ptf-logo.png',
  website: 'www.pishtaj.ir',
  email: 'info@pishtaj.ir',
  tel: '+98 21 46087679'
};

function caseByNo(caseNo){ return cases().filter(function(c){ return c.caseNo===caseNo; })[0] || null; }
function caseByRfq(rfqCd){ return cases().filter(function(c){ return c.srcRfq===rfqCd; })[0] || null; }
function runsForCase(caseNo){ return calcRuns().filter(function(r){ return r.caseNo===caseNo; }).sort(function(a,b){ return String(b.at||'').localeCompare(String(a.at||'')); }); }
function acceptedRun(caseNo){ return runsForCase(caseNo).filter(function(r){ return r.review && r.review.status==='accepted'; })[0] || null; }
function latestRun(caseNo){ return runsForCase(caseNo)[0] || null; }
function latestAnalysis(rec){ return arr(rec && rec.analyses)[0] || null; }
function proposalByNo(propNo){ return proposals().filter(function(p){ return p.docNo===propNo; })[0] || null; }
function proposalsForCase(caseNo){ return proposals().filter(function(p){ return p.caseNo===caseNo; }).sort(function(a,b){ return String(b.generatedAt||'').localeCompare(String(a.generatedAt||'')); }); }
function latestProposal(caseNo){ return proposalsForCase(caseNo)[0] || null; }
function nextProposalNo(){
  var y = jalaliYear();
  var max = 0;
  proposals().forEach(function(p){
    var m = String(p.proposalNo||'').match(new RegExp('^TP-'+y+'-(\\d+)$'));
    if(m && +m[1] > max) max = +m[1];
  });
  return 'TP-' + y + '-' + String(max + 1).padStart(3,'0');
}
function nextRevision(caseNo){
  var list = proposalsForCase(caseNo);
  if(!list.length) return { proposalNo: nextProposalNo(), revNo: 0, baseVersion: 1 };
  var pno = list[0].proposalNo;
  var mx = 0;
  list.forEach(function(x){ if((+x.revNo||0) > mx) mx = +x.revNo||0; });
  return { proposalNo: pno, revNo: mx + 1, baseVersion: list[0].baseVersion || 1 };
}
function patchProposal(rec){
  var list = proposals();
  var done = false;
  for(var i=0;i<list.length;i++) if(list[i].docNo===rec.docNo){ list[i]=rec; done=true; break; }
  if(!done) list.unshift(rec);
  saveProposals(list);
}
function patchCaseProposal(caseNo, meta){
  var list = cases();
  for(var i=0;i<list.length;i++) if(list[i].caseNo===caseNo){
    Object.keys(meta||{}).forEach(function(k){ list[i][k]=meta[k]; });
    list[i].updatedAt = nowIso();
    list[i].updatedFa = nowFa();
    list[i].updatedBy = curUser();
    list[i].updatedByName = curName();
    setData(CASE_KEY, list);
    return true;
  }
  return false;
}
function patchRfqProposal(rfqCd, prop){
  var rfqs = getData('ptf_crm_rfqs');
  for(var i=0;i<rfqs.length;i++) if(rfqs[i].cd===rfqCd){
    rfqs[i].officialTechProposal = prop.docNo;
    rfqs[i].techProposalNo = prop.proposalNo;
    rfqs[i].techProposalRefs = rfqs[i].techProposalRefs || [];
    if(rfqs[i].techProposalRefs.indexOf(prop.docNo) < 0) rfqs[i].techProposalRefs.unshift(prop.docNo);
    setData('ptf_crm_rfqs', rfqs);
    return true;
  }
  return false;
}
function quotaKey(){ return 'ptf_ai_quota_' + curUser(); }
function quotaLimit(){ try{return (typeof window.aiWB_quotaLimit==='function') ? window.aiWB_quotaLimit() : 50;}catch(e){return 50;} }
function quotaCheck(){
  try{
    var q = JSON.parse(localStorage.getItem(quotaKey()) || '{"d":"","n":0}');
    var today = new Date().toISOString().slice(0,10);
    if(q.d !== today) q = {d:today,n:0};
    return q.n < quotaLimit();
  }catch(e){ return true; }
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
function proposalBlockers(rec, analysis, run, mode){
  var blockers=[];
  if(!rec) blockers.push('پرونده فنی یافت نشد');
  if(!analysis) blockers.push('تحلیل فنی فارسی هنوز ثبت نشده است');
  if(rec && (!rec.gate || !rec.gate.approved)) blockers.push('مرحله Proposal گیت شده است و ابتدا باید Gate تایید شود');
  if(analysis && arr(analysis.criticalMissing).length) blockers.push('هنوز داده‌های حیاتی ناقص وجود دارد؛ تولید نهایی Proposal باید متوقف بماند');
  if(analysis && analysis.scopeCode==='control_valve' && !run) blockers.push('برای این family پشتیبانی‌شده، یک محاسبه deterministic کنترل‌والو لازم است');
  if(mode==='official' && analysis && analysis.scopeCode==='control_valve' && (!run || !run.review || run.review.status!=='accepted')) blockers.push('برای ثبت رسمی، calc review accepted برای کنترل‌والو الزامی است');
  return blockers;
}
function proposalWarnings(rec, analysis, run){
  var warns=[];
  if(run && run.review && run.review.status!=='accepted') warns.push('آخرین run محاسباتی موجود است اما هنوز accepted نشده است.');
  if(analysis && arr(analysis.missing).length) warns.push('بخشی از اطلاعات غیرحیاتی هنوز ناقص است و در لیست missing آمده است.');
  if(analysis && arr(analysis.contradictions).length) warns.push('تناقض‌های احتمالی شناسایی شده و قبل از صدور باید بازبینی شوند.');
  return warns;
}
function kvRows(analysis){
  return arr(analysis && analysis.keyData).map(function(x){ return [x.k||'', x.v||'']; });
}
function calcOutputRows(run){
  if(!run || !run.outputs) return [];
  var o = run.outputs;
  return [
    ['Sizing regime', o.sizing_regime || ''],
    ['Cv required', o.cv_required],
    ['Kv required', o.kv_required],
    ['Pressure drop dP (bar)', o.dp_bar],
    ['Choked criterion threshold dPchoke (bar)', o.dp_choke_bar],
    ['Choked condition', o.choked ? 'Yes' : 'No'],
    ['Cavitation risk', o.cavitation_risk || ''],
    ['Cavitation margin (bar)', o.cavitation_margin_bar],
    ['Pressure recovery ratio', o.pressure_recovery_ratio],
    ['Line velocity (m/s)', o.line_velocity_mps != null ? o.line_velocity_mps : ''],
    ['Valve port velocity (m/s)', o.valve_port_velocity_mps != null ? o.valve_port_velocity_mps : ''],
    ['Actuator required force (N)', o.actuator_required_force_n != null ? o.actuator_required_force_n : ''],
    ['Actuator required force (kgf)', o.actuator_required_force_kgf != null ? o.actuator_required_force_kgf : '']
  ].filter(function(r){ return String(r[1]).trim()!==''; });
}
function complianceRows(rec, analysis, run){
  var rows=[];
  arr(analysis && analysis.equipment && analysis.equipment.standards).forEach(function(s){ rows.push([s, 'Available', 'Standard/reference detected in case sources']); });
  arr(analysis && analysis.keyData).forEach(function(k){ rows.push([k.k, k.v ? 'Available' : 'Pending', k.v || 'To be confirmed']); });
  if(run){ rows.push(['Deterministic calculation package', 'Available', 'Run ' + run.runNo + (run.review && run.review.status==='accepted' ? ' (accepted)' : ' (draft review)')]); }
  arr(analysis && analysis.missing).slice(0,6).forEach(function(m){ rows.push([m, 'Pending', 'User / source clarification required']); });
  if(!rows.length) rows.push(['Technical case content', 'Pending', 'No structured rows available']);
  return rows;
}
function chartSvg(run){
  if(!run || !run.outputs) return '';
  var o = run.outputs;
  var data = [
    { lb:'dP', v:+o.dp_bar||0, color:'#2563eb' },
    { lb:'dPchoke', v:+o.dp_choke_bar||0, color:'#f59e0b' },
    { lb:'Cv', v:+o.cv_required||0, color:'#7c3aed' },
    { lb:'Actuator N', v:+o.actuator_required_force_n||0, color:'#0f766e' }
  ].filter(function(x){ return x.v > 0; });
  if(!data.length) return '<div style="color:#94a3b8">No chartable deterministic values available.</div>';
  var max = data.reduce(function(m,x){ return Math.max(m,x.v); }, 1);
  var bars = data.map(function(x, i){
    var h = Math.max(8, Math.round((x.v / max) * 120));
    var x0 = 30 + i * 130;
    var y = 150 - h;
    return '<g><rect x="'+x0+'" y="'+y+'" width="56" height="'+h+'" rx="6" fill="'+x.color+'"></rect>' +
      '<text x="'+(x0+28)+'" y="168" text-anchor="middle" font-size="12" fill="#334155">'+esc(x.lb)+'</text>' +
      '<text x="'+(x0+28)+'" y="'+(y-6)+'" text-anchor="middle" font-size="11" fill="#0f172a">'+esc(String(x.v))+'</text></g>';
  }).join('');
  return '<svg viewBox="0 0 580 180" width="100%" height="180" xmlns="http://www.w3.org/2000/svg" style="background:#fff;border:1px solid #e2e8f0;border-radius:12px">' +
    '<line x1="18" y1="150" x2="560" y2="150" stroke="#cbd5e1" stroke-width="1"/>' +
    '<text x="20" y="20" font-size="13" fill="#334155">Deterministic calculation indicators</text>' +
    bars + '</svg>';
}
function narrSectionsHeuristic(rec, analysis, run){
  var eq = analysis.equipment || {};
  var b = rec.bundle || {};
  var processRows = kvRows(analysis);
  var standards = arr(eq.standards).join(', ') || 'No explicit standard reference was extracted from the current bundle.';
  var calcLine = run ? ('A deterministic calculation package was executed under run ' + run.runNo + ' and has been linked to this proposal draft for full traceability.') : 'No deterministic calculation run is currently attached.';
  var brands = arr(analysis.supply && analysis.supply.brands).join(', ');
  var makers = arr(analysis.supply && analysis.supply.manufacturers).join(', ');
  var recModel = firstNonEmpty(arr(b.items).map(function(x){ return x.model; }).filter(Boolean).join(', '), brands, makers, 'Final recommended model to be selected after commercial alignment and vendor quotation review.');
  var nonCrit = arr(analysis.missing).slice(0,4);
  return {
    executiveSummary:
      'This technical proposal addresses the request referenced as ' + (b.meta && (b.meta.inqNo || b.meta.rfqCd) || rec.srcRfq) + ' for ' + (eq.type || analysis.scope || 'the requested equipment package') + '. ' +
      'The proposal is based on the reviewed request bundle, extracted process data, and the latest validated technical interpretation available in the CRM. ' +
      'It is intended to provide a structured engineering and supply recommendation in English before any final commercial submission.',
    designBasis:
      'The design basis has been prepared from the current request metadata, attachment inventory, structured line items, and the approved Stage-1 technical analysis. ' +
      'The equipment family is currently interpreted as ' + (eq.type || analysis.scope || 'general industrial equipment') + '. ' +
      'Applicable standards / references identified in the case include: ' + standards,
    equipmentSelectionLogic:
      'Vendor and equipment selection logic is derived from the extracted technical requirements, identified standards, available deterministic calculation outputs, and the current supply guidance captured in the case. ' +
      (brands ? 'Preferred / relevant brands presently indicated for review include ' + brands + '. ' : '') +
      (makers ? 'Relevant manufacturer shortlist includes ' + makers + '. ' : '') +
      'Any final vendor recommendation remains subject to document completeness, technical compliance review, and commercial confirmation.',
    recommendedModel:
      'Recommended model / package basis: ' + recModel + '. ' + calcLine,
    deviations:
      nonCrit.length
        ? ('The following non-critical items remain subject to confirmation during the next review cycle: ' + nonCrit.join('; ') + '.')
        : 'No formal deviation is declared at this draft stage beyond the normal requirement for final vendor document review and approval workflow.',
    conclusion:
      'Subject to user review, approved deterministic calculations, and final vendor document confirmation, this draft can be advanced toward official technical-proposal registration inside the CRM revision chain.'
  };
}
function proposalPayloadText(rec, analysis, run){
  var b = rec.bundle || {};
  var calcRows = calcOutputRows(run).map(function(r){ return r[0] + ': ' + r[1]; }).join('\n');
  return [
    'Technical Case: ' + rec.caseNo,
    'RFQ: ' + rec.srcRfq,
    'Inquiry: ' + ((b.meta && b.meta.inqNo) || ''),
    'Customer: ' + ((b.meta && b.meta.customer) || ''),
    'Scope: ' + (analysis.scope || ''),
    'Equipment Type: ' + ((analysis.equipment && analysis.equipment.type) || ''),
    'Summary FA: ' + (analysis.summaryFa || ''),
    'Key Data:\n' + kvRows(analysis).map(function(r){ return '- ' + r[0] + ': ' + r[1]; }).join('\n'),
    'Missing:\n' + arr(analysis.missing).join('\n'),
    'Critical Missing:\n' + arr(analysis.criticalMissing).join('\n'),
    'Contradictions:\n' + arr(analysis.contradictions).join('\n'),
    'Supply Brands:\n' + arr(analysis.supply && analysis.supply.brands).join(', '),
    'Supply Manufacturers:\n' + arr(analysis.supply && analysis.supply.manufacturers).join(', '),
    'Calculation Summary:\n' + calcRows
  ].join('\n\n');
}
function llmSections(rec, analysis, run, cb){
  if(!quotaCheck()) { cb({ok:false, error:'AI quota reached'}); return; }
  fetch('../api/llm.php?action=techproposal', {
    method:'POST', headers:(typeof ptfApiAuthHeaders==='function'?ptfApiAuthHeaders(true):{'Content-Type':'application/json'}),
    body: JSON.stringify({ text: proposalPayloadText(rec, analysis, run).slice(0, 9000) })
  }).then(function(r){ return r.json(); })
    .then(function(d){ quotaBump(); cb(d); })
    .catch(function(){ cb({ok:false, error:'proposal llm unavailable'}); });
}
function normalizeSections(d, rec, analysis, run){
  var h = narrSectionsHeuristic(rec, analysis, run);
  d = d || {};
  return {
    executiveSummary: firstNonEmpty(d.executiveSummary, h.executiveSummary),
    designBasis: firstNonEmpty(d.designBasis, h.designBasis),
    equipmentSelectionLogic: firstNonEmpty(d.equipmentSelectionLogic, h.equipmentSelectionLogic),
    recommendedModel: firstNonEmpty(d.recommendedModel, h.recommendedModel),
    deviations: firstNonEmpty(d.deviations, h.deviations),
    conclusion: firstNonEmpty(d.conclusion, h.conclusion)
  };
}
function riskFa(v){
  return ({low:'Low', moderate:'Moderate', moderate_high:'Moderate to High', high:'High', flashing_or_severe:'Flashing / Severe'})[v] || v || '—';
}
function recordForCase(rec, analysis, run, sections){
  var nxt = nextRevision(rec.caseNo);
  var versionLabel = 'V' + (nxt.baseVersion || 1) + '-R' + nxt.revNo;
  return {
    proposalNo: nxt.proposalNo,
    docNo: nxt.proposalNo + '-R' + nxt.revNo,
    caseNo: rec.caseNo,
    rfqCd: rec.srcRfq,
    requestNo: (rec.bundle && rec.bundle.meta && (rec.bundle.meta.inqNo || rec.bundle.meta.rfqCd)) || rec.srcRfq,
    customer: rec.bundle && rec.bundle.meta ? rec.bundle.meta.customer : '',
    baseVersion: nxt.baseVersion || 1,
    revNo: nxt.revNo,
    versionLabel: versionLabel,
    generatedAt: nowIso(),
    generatedAtFa: nowFa(),
    generatedBy: curUser(),
    generatedByName: curName(),
    generatedDate: nowDate(),
    basedOnAnalysisVer: analysis.ver,
    basedOnBundleVersion: analysis.bundleVersion,
    basedOnCalcRunNo: run ? run.runNo : '',
    status: 'draft',
    currentOfficial: false,
    sections: sections,
    processRows: kvRows(analysis),
    calcOutputRows: calcOutputRows(run),
    calcFormulaRows: arr(run && run.formulas).map(function(f){ return [f.key||'', f.expr||'', f.value, f.note||'']; }),
    complianceRows: complianceRows(rec, analysis, run),
    warnings: proposalWarnings(rec, analysis, run),
    analysisSnapshot: JSON.parse(JSON.stringify(analysis)),
    calcSnapshot: run ? JSON.parse(JSON.stringify(run)) : null,
    deviationsList: arr(analysis.missing).slice(0,6),
    officialMeta: null
  };
}
function htmlTable(headers, rows){
  return '<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr>' + headers.map(function(h){ return '<th style="background:#0f172a;color:#fff;border:1px solid #cbd5e1;padding:8px;text-align:left">'+esc(h)+'</th>'; }).join('') + '</tr></thead><tbody>' +
    rows.map(function(r){ return '<tr>' + r.map(function(c){ return '<td style="border:1px solid #cbd5e1;padding:7px;vertical-align:top">'+esc(c==null?'':c)+'</td>'; }).join('') + '</tr>'; }).join('') +
    '</tbody></table>';
}
function proposalHtml(p){
  var a = p.analysisSnapshot || {};
  var c = p.calcSnapshot || { outputs:{} };
  var o = c.outputs || {};
  var warnHtml = arr(p.warnings).length ? '<div style="background:#fff7ed;border:1px solid #fdba74;border-radius:10px;padding:10px 12px;color:#9a3412;margin-bottom:12px"><b>Open Review Notes</b><ul style="margin:6px 0 0 18px">'+arr(p.warnings).map(function(w){ return '<li>'+esc(w)+'</li>'; }).join('')+'</ul></div>' : '';
  return '<!doctype html><html><head><meta charset="utf-8"><title>'+esc(p.docNo)+'</title>'+
    '<style>body{font-family:Segoe UI,Tahoma,Arial,sans-serif;color:#1f2937;margin:0;background:#fff} .page{padding:24px 28px 48px;max-width:1120px;margin:0 auto} .hdr{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;border-bottom:3px solid #ef4b1a;padding-bottom:16px;margin-bottom:18px}.hdr img{height:52px}.small{font-size:12px;color:#64748b}.box{border:1px solid #e5e7eb;border-radius:14px;padding:16px;margin:14px 0}.sec h2{font-size:18px;margin:0 0 10px;color:#111827}.sec p{line-height:1.95;margin:0 0 10px}.meta-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}.kpi{border:1px solid #e5e7eb;border-radius:12px;padding:12px;background:#f8fafc}.kpi b{display:block;font-size:18px;color:#0f766e}.foot{margin-top:18px;padding-top:10px;border-top:1px solid #e5e7eb;font-size:11px;color:#64748b}</style></head><body><div class="page">' +
    '<div class="hdr"><div style="display:flex;gap:12px;align-items:center"><img src="'+SELLER.logo+'" alt="PTF"><div><div style="font-size:22px;font-weight:800">Technical Proposal</div><div class="small">Pishro Tajhiz Fartak Co.</div></div></div>'+
    '<div style="text-align:right" class="small"><div><b>Proposal No:</b> '+esc(p.docNo)+'</div><div><b>Request No:</b> '+esc(p.requestNo)+'</div><div><b>Date:</b> '+esc(p.generatedDate)+'</div><div><b>Version:</b> '+esc(p.versionLabel)+'</div></div></div>'+
    '<div class="box"><div class="meta-grid"><div><b>Customer</b><div class="small">'+esc(p.customer||'—')+'</div></div><div><b>Technical Case</b><div class="small">'+esc(p.caseNo)+'</div></div><div><b>Analysis Version</b><div class="small">'+esc(String(p.basedOnAnalysisVer||''))+'</div></div><div><b>Calc Run</b><div class="small">'+esc(p.basedOnCalcRunNo||'—')+'</div></div></div></div>'+
    warnHtml +
    '<div class="sec box"><h2>Executive Summary</h2><p>'+esc(p.sections.executiveSummary)+'</p></div>'+
    '<div class="sec box"><h2>Process Data</h2>'+htmlTable(['Parameter','Value'], p.processRows.length ? p.processRows : [['No structured process row','Pending']])+'</div>'+
    '<div class="sec box"><h2>Design Basis</h2><p>'+esc(p.sections.designBasis)+'</p><p><b>Equipment Type:</b> '+esc(a.equipment && a.equipment.type || a.scope || '—')+'<br><b>Service Context:</b> '+esc(a.equipment && a.equipment.serviceContext || '—')+'<br><b>Standards:</b> '+esc(arr(a.equipment && a.equipment.standards).join(', ') || '—')+'</p></div>'+
    '<div class="sec box"><h2>Engineering Calculations</h2><p>The engineering calculations attached to this proposal are deterministic and stored in the CRM for traceability. No hidden assumptions or LLM-generated calculations have been used.</p><div class="meta-grid">'+
      '<div class="kpi"><span class="small">Cv Required</span><b>'+esc(o.cv_required!=null?o.cv_required:'—')+'</b></div>'+
      '<div class="kpi"><span class="small">Kv Required</span><b>'+esc(o.kv_required!=null?o.kv_required:'—')+'</b></div>'+
      '<div class="kpi"><span class="small">Choked Condition</span><b style="color:'+(o.choked?'#dc2626':'#059669')+'">'+esc(o.choked?'YES':'NO')+'</b></div>'+
      '<div class="kpi"><span class="small">Cavitation Risk</span><b>'+esc(riskFa(o.cavitation_risk))+'</b></div></div></div>'+
    '<div class="sec box"><h2>Calculation Tables</h2>'+htmlTable(['Metric','Value'], p.calcOutputRows.length ? p.calcOutputRows : [['No calculation data','Pending']]) + '<div style="margin-top:12px">'+htmlTable(['Step','Formula','Value','Note'], p.calcFormulaRows.length ? p.calcFormulaRows : [['No formula log','','','']])+'</div></div>'+
    '<div class="sec box"><h2>Charts and Graphs</h2>'+chartSvg(c)+'</div>'+
    '<div class="sec box"><h2>Equipment Selection Logic</h2><p>'+esc(p.sections.equipmentSelectionLogic)+'</p></div>'+
    '<div class="sec box"><h2>Recommended Model</h2><p>'+esc(p.sections.recommendedModel)+'</p></div>'+
    '<div class="sec box"><h2>Technical Compliance Matrix</h2>'+htmlTable(['Requirement / Reference','Status','Note'], p.complianceRows)+'</div>'+
    '<div class="sec box"><h2>Deviations</h2><p>'+esc(p.sections.deviations)+'</p></div>'+
    '<div class="sec box"><h2>Conclusion</h2><p>'+esc(p.sections.conclusion)+'</p></div>'+
    '<div class="foot">Generated by CRM Technical Proposal Composer | Proposal family: '+esc(p.proposalNo)+' | Draft time: '+esc(p.generatedAtFa)+'</div>'+
    '</div></body></html>';
}
function proposalDocPayload(p){
  return {
    title: 'Technical Proposal',
    docNo: p.docNo,
    proposalNo: p.proposalNo,
    requestNo: p.requestNo,
    versionLabel: p.versionLabel,
    date: p.generatedDate,
    customer: p.customer,
    caseNo: p.caseNo,
    basedOnAnalysisVer: p.basedOnAnalysisVer,
    basedOnCalcRunNo: p.basedOnCalcRunNo,
    sections: p.sections,
    processRows: p.processRows,
    calcOutputRows: p.calcOutputRows,
    calcFormulaRows: p.calcFormulaRows,
    complianceRows: p.complianceRows,
    warnings: p.warnings,
    equipmentType: p.analysisSnapshot && p.analysisSnapshot.equipment ? p.analysisSnapshot.equipment.type : '',
    serviceContext: p.analysisSnapshot && p.analysisSnapshot.equipment ? p.analysisSnapshot.equipment.serviceContext : '',
    standards: arr(p.analysisSnapshot && p.analysisSnapshot.equipment && p.analysisSnapshot.equipment.standards),
    company: SELLER.company,
    website: SELLER.website,
    email: SELLER.email,
    tel: SELLER.tel
  };
}

window.ptfProposalHeuristicSections = function(caseNo){
  var rec = caseByNo(caseNo); if(!rec) return null;
  var a = latestAnalysis(rec); if(!a) return null;
  var r = acceptedRun(caseNo) || latestRun(caseNo);
  return narrSectionsHeuristic(rec, a, r);
};
window.ptfProposalBuildHeuristicRecord = function(caseNo){
  var rec = caseByNo(caseNo); if(!rec) return null;
  var a = latestAnalysis(rec); if(!a) return null;
  var r = acceptedRun(caseNo) || latestRun(caseNo);
  return recordForCase(rec, a, r, narrSectionsHeuristic(rec, a, r));
};
window.ptfProposalComposeHtml = function(docNo){
  var p = proposalByNo(docNo);
  return p ? proposalHtml(p) : '';
};
window.ptfProposalPrepare = function(caseNo){
  var rec = caseByNo(caseNo);
  if(!rec) { alert('پرونده فنی یافت نشد'); return; }
  var analysis = latestAnalysis(rec);
  var run = acceptedRun(caseNo) || latestRun(caseNo);
  var blockers = proposalBlockers(rec, analysis, run, 'draft');
  if(blockers.length){ alert('ساخت پیش‌نویس Proposal در این لحظه مسدود است:\n- ' + blockers.join('\n- ')); return; }
  var finish = function(sections, source){
    var prop = recordForCase(rec, analysis, run, sections);
    prop.narrativeSource = source || 'heuristic';
    patchProposal(prop);
    patchCaseProposal(caseNo, { latestProposalDocNo: prop.docNo, latestProposalNo: prop.proposalNo, proposalCount: proposalsForCase(caseNo).length });
    if(typeof audit==='function') audit('Tech Proposal','proposal draft generated ' + prop.docNo, prop.docNo);
    if(typeof window.aiTA_pickRfq==='function') window.aiTA_pickRfq(rec.srcRfq);
    if(typeof ptfToast==='function') ptfToast('پیش‌نویس پروپوزال فنی ساخته شد','ok');
  };
  llmSections(rec, analysis, run, function(d){
    if(d && d.ok && d.data) finish(normalizeSections(d.data, rec, analysis, run), 'llm');
    else finish(narrSectionsHeuristic(rec, analysis, run), 'heuristic');
  });
};
window.ptfProposalPreview = function(docNo){
  var p = proposalByNo(docNo); if(!p){ alert('پروپوزال یافت نشد'); return; }
  if(typeof ptfPreviewPrintableDoc==='function') ptfPreviewPrintableDoc('پیش‌نمایش پروپوزال فنی — ' + p.docNo, proposalHtml(p), p.docNo);
  else {
    var w = window.open('', '_blank');
    if(w){ w.document.write(proposalHtml(p)); w.document.close(); }
  }
};
window.ptfProposalRegister = function(docNo){
  var p = proposalByNo(docNo); if(!p) return;
  var rec = caseByNo(p.caseNo); var analysis = latestAnalysis(rec); var run = p.basedOnCalcRunNo ? (calcRuns().filter(function(x){ return x.runNo===p.basedOnCalcRunNo; })[0]||null) : null;
  var blockers = proposalBlockers(rec, analysis, run, 'official');
  if(blockers.length){ alert('ثبت رسمی در این لحظه مسدود است:\n- ' + blockers.join('\n- ')); return; }
  var list = proposals();
  list.forEach(function(x){ if(x.proposalNo===p.proposalNo && x.status==='official'){ x.status='superseded'; x.currentOfficial=false; } });
  for(var i=0;i<list.length;i++) if(list[i].docNo===p.docNo){
    list[i].status='official';
    list[i].currentOfficial=true;
    list[i].officialMeta={ at: nowIso(), atFa: nowFa(), by: curUser(), byName: curName() };
    p=list[i];
    break;
  }
  saveProposals(list);
  patchCaseProposal(p.caseNo, { officialProposalDocNo: p.docNo, officialProposalNo: p.proposalNo, officialProposalRevNo: p.revNo });
  patchRfqProposal(p.rfqCd, p);
  if(typeof audit==='function') audit('Tech Proposal','official technical proposal registered ' + p.docNo, p.docNo);
  if(typeof window.aiTA_pickRfq==='function') window.aiTA_pickRfq(rec.srcRfq);
  if(typeof ptfToast==='function') ptfToast('پروپوزال فنی به‌صورت رسمی ثبت شد','ok');
};
window.ptfProposalDocx = function(docNo){
  var p = proposalByNo(docNo); if(!p){ alert('پروپوزال یافت نشد'); return; }
  fetch('../api/tech-proposal-docx.php', {
    method:'POST', headers:(typeof ptfApiAuthHeaders==='function'?ptfApiAuthHeaders(true):{'Content-Type':'application/json'}),
    body: JSON.stringify({ proposal: proposalDocPayload(p) })
  }).then(function(r){
    var ct = r.headers.get('Content-Type') || '';
    if(!r.ok || ct.indexOf('application/vnd.openxmlformats-officedocument.wordprocessingml.document') < 0){
      return r.text().then(function(t){ throw new Error(t || 'خروجی DOCX ناموفق بود'); });
    }
    return r.blob();
  }).then(function(blob){
    var a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download = p.docNo + '.docx';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1500);
  }).catch(function(e){ alert('خطا در خروجی DOCX: ' + e.message); });
};
window.ptfProposalLoad = function(docNo){
  var p = proposalByNo(docNo); if(!p) return;
  window.ptfProposalPreview(docNo);
};
window.ptfProposalPanelHtml = function(rec, analysis){
  if(!rec || !analysis) return '';
  var run = acceptedRun(rec.caseNo) || latestRun(rec.caseNo);
  var blockers = proposalBlockers(rec, analysis, run, 'draft');
  var warns = proposalWarnings(rec, analysis, run);
  var list = proposalsForCase(rec.caseNo);
  var latest = list[0] || null;
  var rows = list.map(function(p){
    var st = p.status==='official' ? '<span style="background:#dcfce7;color:#166534;border:1px solid #86efac;border-radius:999px;padding:2px 8px;font-size:10.5px">رسمی</span>' : p.status==='superseded' ? '<span style="background:#f8fafc;color:#64748b;border:1px solid #cbd5e1;border-radius:999px;padding:2px 8px;font-size:10.5px">جایگزین‌شده</span>' : '<span style="background:#fff7ed;color:#9a3412;border:1px solid #fdba74;border-radius:999px;padding:2px 8px;font-size:10.5px">پیش‌نویس</span>';
    return '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;border-bottom:1px dashed var(--brd);padding:8px 0">'+
      '<div style="min-width:0"><div style="font-weight:800">'+esc(p.docNo)+' '+st+'</div><div style="font-size:11.5px;color:#64748b">'+esc(p.generatedAtFa||'')+' | تحلیل v'+esc(String(p.basedOnAnalysisVer||''))+' | محاسبه '+esc(p.basedOnCalcRunNo||'—')+'</div></div>'+
      '<div style="display:flex;gap:4px;flex-wrap:wrap;flex:none"><button class="ba" onclick="ptfProposalPreview(\''+esc(p.docNo)+'\')">👁 نمایش</button><button class="ba" onclick="ptfProposalDocx(\''+esc(p.docNo)+'\')">DOCX</button>' +
      (p.status!=='official' ? '<button class="ba" onclick="ptfProposalRegister(\''+esc(p.docNo)+'\')">ثبت رسمی</button>' : '') + '</div></div>';
  }).join('') || '<div style="color:#94a3b8;font-size:12px">هنوز نسخه‌ای از پروپوزال فنی برای این پرونده ساخته نشده است.</div>';
  return '<div style="margin-top:14px;background:#fff;border:1px solid var(--brd);border-radius:16px;padding:16px">'+
    '<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;margin-bottom:10px">'+
      '<div><div style="font-weight:900">📘 ماژول Proposal فنی — v22.4 runtime</div><div style="font-size:12px;color:#64748b;line-height:1.9">ساخت draft انگلیسی Proposal، نسخه/رویزن، ثبت رسمی و خروجی DOCX/PDF shell.</div></div>'+
      '<div style="display:flex;gap:6px;flex-wrap:wrap">'+
        '<button class="bt" onclick="ptfProposalPrepare(\''+esc(rec.caseNo)+'\')">✍️ ساخت پیش‌نویس انگلیسی Proposal</button>'+
        (latest ? '<button class="bt bt-o" onclick="ptfProposalPreview(\''+esc(latest.docNo)+'\')">🖨 پیش‌نمایش آخرین نسخه</button>' : '')+
      '</div></div>'+
    (blockers.length ? '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:12px;color:#b91c1c;margin-bottom:10px"><b>موانع تولید Proposal</b><ul style="margin:6px 0 0 18px">'+blockers.map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('')+'</ul></div>' : '') +
    (warns.length ? '<div style="background:#fff7ed;border:1px solid #fdba74;border-radius:12px;padding:12px;color:#9a3412;margin-bottom:10px"><b>نکات بازبینی باز</b><ul style="margin:6px 0 0 18px">'+warns.map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('')+'</ul></div>' : '') +
    '<div style="font-size:11.5px;color:#64748b;line-height:1.8;margin-bottom:10px">ثبت رسمی Proposal تا قبل از Gate approval و برای کیس کنترل‌والو تا قبل از calc review accepted مسدود می‌ماند.</div>'+
    '<div>'+rows+'</div>'+
  '</div>';
};

})();
