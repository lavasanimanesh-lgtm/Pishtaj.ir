/* PARKED v24.5: Engineering Calc Adapter از UI/لود خارج شد (فاز ثبات + پیچیدگی اجرایی/وابستگی LLM). فایل نگه داشته شده. */
/* =====================================================================
   PTF CRM — eng-calc.js — v22.4 runtime (introduced in v22.2)
   Engineering Calculation Engine — Core Adapter Layer + Control Valve Phase 1
   Deterministic only: no LLM math, no hidden assumptions
   ===================================================================== */
(function(){
'use strict';

var KEY = 'ptf_crm_calc_runs';
var CASE_KEY = 'ptf_crm_techcases';

function esc(s){ var d=document.createElement('div'); d.textContent=s==null?'':String(s); return d.innerHTML; }
function arr(v){ return Array.isArray(v) ? v : []; }
function getData(k){ try{return JSON.parse(localStorage.getItem(k)||'[]'); }catch(e){ return []; } }
function setData(k,v){ localStorage.setItem(k, JSON.stringify(v)); }
function curUser(){ try{return curSession().user||'system';}catch(e){return 'system';} }
function curName(){ try{return curSession().name||'سیستم';}catch(e){return 'سیستم';} }
function nowIso(){ return new Date().toISOString(); }
function nowFa(){ try{return typeof faDateTime==='function' ? faDateTime() : new Date().toLocaleString('fa-IR');}catch(e){return new Date().toLocaleString('fa-IR');} }
function jalaliYear(){ try{return String(new Date().toLocaleDateString('fa-IR-u-nu-latn')).split('/')[0]||'1405';}catch(e){return '1405';} }
function runs(){ return getData(KEY); }
function saveRuns(v){ setData(KEY, v); }
function num(v){
  var s = String(v==null?'':v).trim();
  s = s.replace(/[۰-۹]/g, function(d){ return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); })
       .replace(/[٠-٩]/g, function(d){ return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); })
       .replace(/[٬،]/g, ',')
       .replace(/\s+/g,'')
       .replace(/,/g,'');
  if(!s || s==='-' || s==='.') return 0;
  var n = parseFloat(s);
  return isFinite(n) ? n : 0;
}
function rnd(n,d){ n=+n||0; d=(d==null?3:d); var p=Math.pow(10,d); return Math.round(n*p)/p; }
function caseList(){ return getData(CASE_KEY); }
function patchCaseMeta(caseNo, meta){
  var list = caseList();
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
function nextRunNo(){
  var y = jalaliYear();
  var max = 0;
  runs().forEach(function(r){
    var m = String(r.runNo||'').match(new RegExp('^CAL-'+y+'-(\\d+)$'));
    if(m && +m[1] > max) max = +m[1];
  });
  return 'CAL-' + y + '-' + String(max + 1).padStart(3,'0');
}
function saveRun(rec){
  var list = runs();
  var done = false;
  for(var i=0;i<list.length;i++) if(list[i].runNo===rec.runNo){ list[i]=rec; done=true; break; }
  if(!done) list.unshift(rec);
  saveRuns(list);
  patchCaseMeta(rec.caseNo, { lastCalcRunNo: rec.runNo, calcRunCount: list.filter(function(x){ return x.caseNo===rec.caseNo; }).length });
}
function runsForCase(caseNo){
  return runs().filter(function(r){ return r.caseNo===caseNo; }).sort(function(a,b){ return String(b.at||'').localeCompare(String(a.at||'')); });
}
function getRun(runNo){ return runs().filter(function(r){ return r.runNo===runNo; })[0] || null; }
function getCaseByNo(caseNo){ return caseList().filter(function(c){ return c.caseNo===caseNo; })[0] || null; }
function getCaseByRfq(rfqCd){ return caseList().filter(function(c){ return c.srcRfq===rfqCd; })[0] || null; }
function step(key, expr, value, note){ return { key:key, expr:expr, value:value, note:note||'' }; }
function clamp(v, mn, mx){ return Math.max(mn, Math.min(mx, v)); }

var ADAPTERS = {
  control_valve_liquid_phase1: {
    id: 'control_valve_liquid_phase1',
    family: 'control_valve',
    title: 'Control Valve — Liquid Service Phase 1',
    basis: {
      standard: 'ISA/IEC-style liquid control valve deterministic adapter (internal phase-1 implementation)',
      formulaSet: 'PTF-CV-LIQ-v1',
      notes: [
        'Liquid-service sizing only in this sprint foundation',
        'No hidden assumptions are applied',
        'Actuator sizing shell runs only if actuator inputs are completed explicitly'
      ]
    },
    required: [
      { id:'flow_m3h', lb:'دبی جریان (m3/h)' },
      { id:'sg', lb:'چگالی نسبی در شرایط کار' },
      { id:'p1_bar_a', lb:'فشار بالادست P1 (bar a)' },
      { id:'p2_bar_a', lb:'فشار پایین‌دست P2 (bar a)' },
      { id:'pv_bar_a', lb:'فشار بخار Pv (bar a)' },
      { id:'pc_bar_a', lb:'فشار بحرانی Pc (bar a)' },
      { id:'fl', lb:'ضریب بازیابی FL' }
    ],
    optional: [
      { id:'line_id_mm', lb:'Line internal diameter (mm)' },
      { id:'valve_port_id_mm', lb:'Valve port ID (mm)' },
      { id:'seat_d_mm', lb:'Seat / plug hydraulic diameter (mm)' },
      { id:'shutoff_dp_bar', lb:'Shutoff differential pressure (bar)' },
      { id:'packing_friction_n', lb:'Packing friction (N)' },
      { id:'seating_force_n', lb:'Seating / shutoff force add-on (N)' },
      { id:'unbalance_coeff', lb:'Hydraulic unbalance coefficient (0..1)' },
      { id:'safety_factor', lb:'Actuator safety factor (>1)' }
    ],
    validate: function(inp){
      var e=[];
      ['flow_m3h','sg','p1_bar_a','p2_bar_a','pv_bar_a','pc_bar_a','fl'].forEach(function(k){ if(!(inp[k] > 0)) e.push(k + ' الزامی و باید مثبت باشد'); });
      if(inp.p1_bar_a <= inp.p2_bar_a) e.push('P1 باید بزرگتر از P2 باشد');
      if(inp.p1_bar_a <= inp.pv_bar_a) e.push('P1 باید بزرگتر از Pv باشد');
      if(inp.pc_bar_a <= inp.pv_bar_a) e.push('Pc باید بزرگتر از Pv باشد');
      if(inp.fl <= 0 || inp.fl > 1) e.push('FL باید بین 0 و 1 باشد');
      if(inp.sg <= 0) e.push('Specific gravity باید مثبت باشد');
      return e;
    },
    run: function(inp, ctx){
      var warnings=[];
      var formulas=[];
      var out={};

      var Q = +inp.flow_m3h;
      var SG = +inp.sg;
      var P1 = +inp.p1_bar_a;
      var P2 = +inp.p2_bar_a;
      var Pv = +inp.pv_bar_a;
      var Pc = +inp.pc_bar_a;
      var FL = +inp.fl;
      var dP = P1 - P2;
      out.dp_bar = rnd(dP,4);
      formulas.push(step('dP','P1 - P2', out.dp_bar, 'bar'));

      var FF = 0.96 - 0.28 * Math.sqrt(Pv / Pc);
      FF = clamp(FF, 0.5, 1.0);
      out.ff = rnd(FF,4);
      formulas.push(step('FF','0.96 - 0.28*sqrt(Pv/Pc)', out.ff, 'liquid critical pressure ratio factor'));

      var dPchoke = FL * FL * (P1 - FF * Pv);
      out.dp_choke_bar = rnd(dPchoke,4);
      formulas.push(step('dP_choke','FL² * (P1 - FF*Pv)', out.dp_choke_bar, 'bar'));

      out.choked = dP >= dPchoke && dPchoke > 0;
      formulas.push(step('choked','dP >= dP_choke', out.choked ? 'YES' : 'NO', 'liquid choking criterion'));

      var kv_non = Q * Math.sqrt(SG / dP);
      var kv_choked = Q * Math.sqrt(SG) / (FL * Math.sqrt(Math.max(P1 - FF * Pv, 1e-9)));
      out.kv_nonchoked = rnd(kv_non,4);
      out.kv_choked = rnd(kv_choked,4);
      formulas.push(step('Kv_nonchoked','Q * sqrt(SG / dP)', out.kv_nonchoked, 'metric liquid sizing'));
      formulas.push(step('Kv_choked','Q*sqrt(SG) / (FL*sqrt(P1 - FF*Pv))', out.kv_choked, 'metric liquid choked sizing'));

      out.sizing_regime = out.choked ? 'choked-liquid-basis' : 'nonchoked-liquid-basis';
      out.kv_required = rnd(out.choked ? kv_choked : kv_non,4);
      out.cv_required = rnd(out.kv_required * 1.156,4);
      formulas.push(step('Cv_required','1.156 * Kv_required', out.cv_required, 'Cv/Kv conversion'));

      out.pressure_recovery_ratio = rnd(dP / Math.max(P1 - Pv, 1e-9),4);
      formulas.push(step('pressure_recovery_ratio','dP / (P1 - Pv)', out.pressure_recovery_ratio, 'liquid stress indicator'));

      out.cavitation_margin_bar = rnd(P2 - Pv,4);
      formulas.push(step('cavitation_margin','P2 - Pv', out.cavitation_margin_bar, 'positive margin is safer'));

      var sev = dPchoke > 0 ? dP / dPchoke : 0;
      out.cavitation_severity_ratio = rnd(sev,4);
      formulas.push(step('cavitation_severity_ratio','dP / dP_choke', out.cavitation_severity_ratio, 'qualitative risk index'));

      if (P2 <= Pv) out.cavitation_risk = 'flashing_or_severe';
      else if (out.choked) out.cavitation_risk = 'high';
      else if (sev >= 0.85) out.cavitation_risk = 'moderate_high';
      else if (sev >= 0.65) out.cavitation_risk = 'moderate';
      else out.cavitation_risk = 'low';

      if (inp.line_id_mm > 0) {
        var area = Math.PI * Math.pow(inp.line_id_mm / 1000, 2) / 4;
        out.line_velocity_mps = rnd((Q / 3600) / area,4);
        formulas.push(step('line_velocity','(Q/3600) / (π*D²/4)', out.line_velocity_mps, 'm/s, D=line ID in m'));
      }
      if (inp.valve_port_id_mm > 0) {
        var area2 = Math.PI * Math.pow(inp.valve_port_id_mm / 1000, 2) / 4;
        out.valve_port_velocity_mps = rnd((Q / 3600) / area2,4);
        formulas.push(step('port_velocity','(Q/3600) / (π*d²/4)', out.valve_port_velocity_mps, 'm/s, d=valve port ID in m'));
      }

      var actuatorReady = inp.seat_d_mm > 0 && (inp.shutoff_dp_bar > 0 || dP > 0) && inp.packing_friction_n >= 0 && inp.seating_force_n >= 0 && inp.unbalance_coeff >= 0 && inp.unbalance_coeff <= 1 && inp.safety_factor > 1;
      out.actuator_ready = !!actuatorReady;
      if (actuatorReady) {
        var dpShut = +inp.shutoff_dp_bar > 0 ? +inp.shutoff_dp_bar : dP;
        var seatArea = Math.PI * Math.pow(inp.seat_d_mm / 1000, 2) / 4;
        var hydForce = dpShut * 100000 * seatArea;
        var unbalance = hydForce * inp.unbalance_coeff;
        var subtotal = unbalance + (+inp.packing_friction_n) + (+inp.seating_force_n);
        var reqForce = subtotal * (+inp.safety_factor);
        out.seat_area_m2 = rnd(seatArea,8);
        out.actuator_hydraulic_force_n = rnd(hydForce,2);
        out.actuator_unbalance_force_n = rnd(unbalance,2);
        out.actuator_subtotal_force_n = rnd(subtotal,2);
        out.actuator_required_force_n = rnd(reqForce,2);
        out.actuator_required_force_kgf = rnd(reqForce / 9.80665,2);
        formulas.push(step('seat_area','π*d²/4', out.seat_area_m2, 'm², d=seat diameter in m'));
        formulas.push(step('hydraulic_force','ΔP_shutoff * 1e5 * seat_area', out.actuator_hydraulic_force_n, 'N'));
        formulas.push(step('unbalance_force','hydraulic_force * unbalance_coeff', out.actuator_unbalance_force_n, 'N'));
        formulas.push(step('required_actuator_force','(unbalance + packing + seating) * safety_factor', out.actuator_required_force_n, 'N'));
      } else {
        warnings.push('Actuator sizing shell اجرا نشد؛ برای آن باید seat_d_mm, shutoff_dp_bar (یا dP), packing_friction_n, seating_force_n, unbalance_coeff و safety_factor صریحاً تکمیل شوند.');
      }

      if (out.line_velocity_mps > 6) warnings.push('سرعت خط از 6 m/s بالاتر است؛ مسیر و ابعاد line/valve باید بازبینی شود.');
      if (out.valve_port_velocity_mps > 20) warnings.push('سرعت پورت شیر بالاست؛ خطر نویز/سایش/افت فشار باید بازبینی شود.');
      if (out.cavitation_risk === 'high' || out.cavitation_risk === 'flashing_or_severe') warnings.push('ریسک cavitation/flashing بالا است؛ Trim/FL/pressure staging باید بازبینی شود.');
      if (FL < 0.7) warnings.push('FL پایین است؛ حساسیت به choking/cavitation بیشتر می‌شود.');
      if (P1 < 1 || P2 < 0.5) warnings.push('فشارها غیرمعمول به نظر می‌رسند؛ مطمئن شوید واحد bar(a) وارد شده است، نه barg.');

      return { ok:true, outputs:out, formulas:formulas, warnings:warnings };
    }
  }
};

function currentAdapterFor(scopeCode){
  if(scopeCode === 'control_valve') return ADAPTERS.control_valve_liquid_phase1;
  return null;
}
function iv(id){ var el=document.getElementById(id); return el ? el.value : ''; }
function setv(id,v){ var el=document.getElementById(id); if(el) el.value = v==null?'':v; }
function checklist(items){
  return '<ul style="margin:0;padding:0 18px;line-height:2">' + items.map(function(x){ return '<li>'+esc(x.lb)+' <small style="color:#64748b">('+esc(x.id)+')</small></li>'; }).join('') + '</ul>';
}
function reviewBadge(rv){
  if(!rv || !rv.status) return '<span style="color:#94a3b8">بازبینی: پیش‌نویس</span>';
  if(rv.status==='accepted') return '<span style="color:#166534">بازبینی: تایید شد</span>';
  if(rv.status==='needs_revision') return '<span style="color:#b45309">بازبینی: نیازمند اصلاح</span>';
  return '<span style="color:#475569">بازبینی: '+esc(rv.status)+'</span>';
}
function riskFa(v){
  return ({low:'پایین', moderate:'متوسط', moderate_high:'متوسط رو به بالا', high:'بالا', flashing_or_severe:'فلشینگ / شدید'})[v] || v || '—';
}
function statusBadge(run){
  var rv=(run&&run.review)||{};
  if(rv.status==='accepted') return '<span class="bd" style="background:#dcfce7;color:#166534">تایید شد</span>';
  if(rv.status==='needs_revision') return '<span class="bd" style="background:#fef3c7;color:#92400e">نیازمند اصلاح</span>';
  return '<span class="bd" style="background:#f8fafc;color:#64748b;border:1px solid #cbd5e1">پیش‌نویس</span>';
}
function runHtml(run){
  if(!run) return '<div style="color:#94a3b8;font-size:12px">هنوز هیچ محاسبه‌ای برای این پرونده ثبت نشده است.</div>';
  var o = run.outputs || {};
  var frows = arr(run.formulas).map(function(f){ return '<tr><td>'+esc(f.key||'')+'</td><td style="direction:ltr">'+esc(f.expr||'')+'</td><td>'+esc(f.value)+'</td><td>'+esc(f.note||'')+'</td></tr>'; }).join('');
  var warns = arr(run.warnings).length ? '<ul style="margin:6px 0 0;padding:0 18px;line-height:2">'+arr(run.warnings).map(function(w){ return '<li>'+esc(w)+'</li>'; }).join('')+'</ul>' : '<div style="color:#059669;font-size:12px">هشدار فعالی ثبت نشده است.</div>';
  return '<div style="background:#fff;border:1px solid var(--brd);border-radius:14px;padding:14px">'+
    '<div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;flex-wrap:wrap;margin-bottom:10px">'+
      '<div><div style="font-weight:900">'+esc(run.runNo)+'</div><div style="font-size:11.5px;color:#64748b">'+esc(run.adapterTitle||run.adapter)+' | '+esc(run.atFa||'')+' | '+esc(run.byName||run.by||'')+'</div></div>'+
      '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">'+statusBadge(run)+' '+reviewBadge(run.review)+' ' +
      '<button class="ba" onclick="ptfCalcLoadRun(\''+esc(run.runNo)+'\')">بارگذاری در فرم</button>'+
      '<button class="ba" onclick="ptfCalcReview(\''+esc(run.runNo)+'\',\'accepted\')">✅ تایید</button>'+
      '<button class="ba" onclick="ptfCalcReview(\''+esc(run.runNo)+'\',\'needs_revision\')">↩️ بازبینی</button></div></div>'+
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-bottom:10px">'+
      '<div style="background:#f8fafc;border:1px solid var(--brd);border-radius:12px;padding:10px"><b>Kv موردنیاز</b><div style="font-size:18px;color:#1d4ed8">'+esc(o.kv_required)+'</div><small>'+esc(o.sizing_regime||'')+'</small></div>'+
      '<div style="background:#f8fafc;border:1px solid var(--brd);border-radius:12px;padding:10px"><b>Cv موردنیاز</b><div style="font-size:18px;color:#7c3aed">'+esc(o.cv_required)+'</div><small>سرویس مایع</small></div>'+
      '<div style="background:#f8fafc;border:1px solid var(--brd);border-radius:12px;padding:10px"><b>وضعیت Choked</b><div style="font-size:18px;color:'+(o.choked?'#dc2626':'#059669')+'">'+(o.choked?'بله':'خیر')+'</div><small>dPchoke='+esc(o.dp_choke_bar)+' bar</small></div>'+
      '<div style="background:#f8fafc;border:1px solid var(--brd);border-radius:12px;padding:10px"><b>ریسک کاویتاسیون</b><div style="font-size:18px;color:#b45309">'+esc(riskFa(o.cavitation_risk))+'</div><small>margin='+esc(o.cavitation_margin_bar)+' bar</small></div>'+
      '<div style="background:#f8fafc;border:1px solid var(--brd);border-radius:12px;padding:10px"><b>نیروی اکچویتور</b><div style="font-size:18px;color:#0f766e">'+(o.actuator_required_force_n!=null?esc(o.actuator_required_force_n+' N'):'—')+'</div><small>'+(o.actuator_required_force_kgf!=null?esc(o.actuator_required_force_kgf+' kgf'):'shell کامل نشده')+'</small></div>'+
    '</div>'+
    '<div style="margin-bottom:10px"><b>هشدارها / نکات بازبینی</b>'+warns+'</div>'+
    '<div class="tb2"><table style="font-size:12px"><thead><tr><th>گام</th><th>فرمول</th><th>مقدار</th><th>توضیح</th></tr></thead><tbody>'+frows+'</tbody></table></div>'+
  '</div>';
}

window.ptfCalcPanelHtml = function(rec, analysis){
  if(!rec || !analysis) return '';
  var ad = currentAdapterFor(analysis.scopeCode || '');
  var rr = runsForCase(rec.caseNo);
  var latest = rr[0] || null;
  if(!ad){
    return '<div style="margin-top:14px;background:#fff;border:1px solid var(--brd);border-radius:16px;padding:16px">'+
      '<div style="font-weight:900;margin-bottom:6px">🧮 موتور محاسبات مهندسی — v22.4 runtime</div>'+
      '<div style="font-size:12.5px;color:#64748b;line-height:2">برای حوزه «'+esc(analysis.scope || '—')+'» هنوز آداپتر قطعی برای این family فعال نشده است. در v22.4 فعلاً family کنترل‌والو (liquid phase-1) پیاده‌سازی شده است.</div>'+
    '</div>';
  }
  return '<div style="margin-top:14px;background:#fff;border:1px solid var(--brd);border-radius:16px;padding:16px">'+
    '<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;margin-bottom:10px">'+
      '<div><div style="font-weight:900">🧮 موتور محاسبات مهندسی — v22.4 runtime</div><div style="font-size:12px;color:#64748b;line-height:1.8">آداپتر: '+esc(ad.title)+'<br>مبنای فنی: '+esc(ad.basis.standard)+'<br><b>قاعده:</b> بدون فرض پنهان، بدون LLM math، فقط محاسبه deterministic و ذخیره‌شونده.</div></div>'+
      '<div style="display:flex;gap:6px;flex-wrap:wrap">'+
        '<span style="background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:999px;padding:4px 10px;font-size:11px;font-weight:800">'+esc(ad.basis.formulaSet)+'</span>'+
        '<span style="background:#f8fafc;color:#475569;border:1px solid #cbd5e1;border-radius:999px;padding:4px 10px;font-size:11px;font-weight:800">Calc runs: '+rr.length+'</span>'+
      '</div></div>'+
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-bottom:12px">'+
      '<div style="background:#f8fafc;border:1px solid var(--brd);border-radius:12px;padding:12px"><div style="font-weight:900;margin-bottom:6px">Required process inputs</div>'+checklist(ad.required)+'</div>'+
      '<div style="background:#f8fafc;border:1px solid var(--brd);border-radius:12px;padding:12px"><div style="font-weight:900;margin-bottom:6px">Optional extended inputs</div>'+checklist(ad.optional)+'</div>'+
    '</div>'+
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">'+
      '<div class="fld"><label>دبی جریان (m3/h) *</label><input id="calc_flow_m3h" value="'+esc(latest && latest.inputs ? latest.inputs.flow_m3h : '')+'" style="direction:ltr"></div>'+
      '<div class="fld"><label>چگالی نسبی *</label><input id="calc_sg" value="'+esc(latest && latest.inputs ? latest.inputs.sg : '')+'" style="direction:ltr"></div>'+
      '<div class="fld"><label>فشار بالادست P1 (bar a) *</label><input id="calc_p1_bar_a" value="'+esc(latest && latest.inputs ? latest.inputs.p1_bar_a : '')+'" style="direction:ltr"></div>'+
      '<div class="fld"><label>فشار پایین‌دست P2 (bar a) *</label><input id="calc_p2_bar_a" value="'+esc(latest && latest.inputs ? latest.inputs.p2_bar_a : '')+'" style="direction:ltr"></div>'+
      '<div class="fld"><label>فشار بخار Pv (bar a) *</label><input id="calc_pv_bar_a" value="'+esc(latest && latest.inputs ? latest.inputs.pv_bar_a : '')+'" style="direction:ltr"></div>'+
      '<div class="fld"><label>فشار بحرانی Pc (bar a) *</label><input id="calc_pc_bar_a" value="'+esc(latest && latest.inputs ? latest.inputs.pc_bar_a : '')+'" style="direction:ltr"></div>'+
      '<div class="fld"><label>ضریب FL *</label><input id="calc_fl" value="'+esc(latest && latest.inputs ? latest.inputs.fl : '')+'" style="direction:ltr"></div>'+
      '<div class="fld"><label>قطر داخلی لاین (mm)</label><input id="calc_line_id_mm" value="'+esc(latest && latest.inputs ? latest.inputs.line_id_mm : '')+'" style="direction:ltr"></div>'+
      '<div class="fld"><label>قطر پورت شیر (mm)</label><input id="calc_valve_port_id_mm" value="'+esc(latest && latest.inputs ? latest.inputs.valve_port_id_mm : '')+'" style="direction:ltr"></div>'+
      '<div class="fld"><label>قطر seat / plug (mm)</label><input id="calc_seat_d_mm" value="'+esc(latest && latest.inputs ? latest.inputs.seat_d_mm : '')+'" style="direction:ltr"></div>'+
      '<div class="fld"><label>افت فشار shutoff (bar)</label><input id="calc_shutoff_dp_bar" value="'+esc(latest && latest.inputs ? latest.inputs.shutoff_dp_bar : '')+'" style="direction:ltr"></div>'+
      '<div class="fld"><label>اصطکاک packing (N)</label><input id="calc_packing_friction_n" value="'+esc(latest && latest.inputs ? latest.inputs.packing_friction_n : '')+'" style="direction:ltr"></div>'+
      '<div class="fld"><label>نیروی نشیمن (N)</label><input id="calc_seating_force_n" value="'+esc(latest && latest.inputs ? latest.inputs.seating_force_n : '')+'" style="direction:ltr"></div>'+
      '<div class="fld"><label>ضریب unbalance (0..1)</label><input id="calc_unbalance_coeff" value="'+esc(latest && latest.inputs ? latest.inputs.unbalance_coeff : '')+'" style="direction:ltr"></div>'+
      '<div class="fld"><label>ضریب اطمینان (&gt;1)</label><input id="calc_safety_factor" value="'+esc(latest && latest.inputs ? latest.inputs.safety_factor : '')+'" style="direction:ltr"></div>'+
    '</div>'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">'+
      '<button class="bt" onclick="ptfCalcRunForCase(\''+esc(rec.caseNo)+'\')">▶️ اجرای محاسبه deterministic</button>'+
      '<button class="bt bt-o" onclick="ptfCalcLoadLast(\''+esc(rec.caseNo)+'\')">↩️ بارگذاری آخرین run</button>'+
    '</div>'+
    '<div style="margin-top:12px;font-size:11.5px;color:#64748b;line-height:1.9">اگر actuator inputs ناقص باشند، فقط Cv/sizing/choked/cavitation اجرا می‌شود و actuator shell به‌صورت شفاف skip می‌خورد. هیچ مقدار پنهانی فرض نمی‌شود.</div>'+
    '<div style="margin-top:12px" id="calcRunBox">'+runHtml(latest)+'</div>'+
  '</div>';
};

window.ptfCalcAdapters = ADAPTERS;
window.ptfCalcRunAdapter = function(id, inp){
  var ad = ADAPTERS[id];
  if(!ad) return { ok:false, error:'adapter_not_found' };
  var errs = ad.validate(inp || {});
  if(errs.length) return { ok:false, error:'validation', errors:errs };
  return ad.run(inp || {}, {});
};

window.ptfCalcLoadRun = function(runNo){
  var r = getRun(runNo); if(!r || !r.inputs) return;
  Object.keys(r.inputs).forEach(function(k){ setv('calc_'+k, r.inputs[k]); });
  var box = document.getElementById('calcRunBox'); if(box) box.innerHTML = runHtml(r);
};
window.ptfCalcLoadLast = function(caseNo){
  var rr = runsForCase(caseNo); if(!rr.length) { alert('run قبلی وجود ندارد'); return; }
  window.ptfCalcLoadRun(rr[0].runNo);
};
window.ptfCalcReview = function(runNo, status){
  var r = getRun(runNo); if(!r) return;
  var note = prompt(status==='accepted' ? 'یادداشت تایید (اختیاری):' : 'علت نیاز به بازبینی:', r.review && r.review.note ? r.review.note : '');
  r.review = { status: status, note: note||'', at: nowIso(), atFa: nowFa(), by: curUser(), byName: curName() };
  saveRun(r);
  var box = document.getElementById('calcRunBox'); if(box) box.innerHTML = runHtml(r);
  try {
    var c = getCaseByNo(r.caseNo);
    if(c && typeof window.aiTA_pickRfq==='function') window.aiTA_pickRfq(c.srcRfq);
  } catch(e){}
};
window.ptfCalcRunForCase = function(caseNo){
  var c = getCaseByNo(caseNo);
  if(!c) { alert('پرونده فنی یافت نشد'); return; }
  var analysis = arr(c.analyses)[0] || null;
  var ad = currentAdapterFor((analysis && analysis.scopeCode) || '');
  if(!ad){ alert('برای این family هنوز adapter محاسباتی فعال نشده است.'); return; }
  var inp = {
    flow_m3h: num(iv('calc_flow_m3h')),
    sg: num(iv('calc_sg')),
    p1_bar_a: num(iv('calc_p1_bar_a')),
    p2_bar_a: num(iv('calc_p2_bar_a')),
    pv_bar_a: num(iv('calc_pv_bar_a')),
    pc_bar_a: num(iv('calc_pc_bar_a')),
    fl: num(iv('calc_fl')),
    line_id_mm: num(iv('calc_line_id_mm')),
    valve_port_id_mm: num(iv('calc_valve_port_id_mm')),
    seat_d_mm: num(iv('calc_seat_d_mm')),
    shutoff_dp_bar: num(iv('calc_shutoff_dp_bar')),
    packing_friction_n: num(iv('calc_packing_friction_n')),
    seating_force_n: num(iv('calc_seating_force_n')),
    unbalance_coeff: num(iv('calc_unbalance_coeff')),
    safety_factor: num(iv('calc_safety_factor'))
  };
  var errs = ad.validate(inp);
  if(errs.length){ alert('ورودی‌های محاسبه ناقص/نامعتبر:\n- ' + errs.join('\n- ')); return; }
  var res = ad.run(inp, { caseNo:caseNo, rfqCd:c.srcRfq, caseRec:c, analysis:analysis });
  if(!res || !res.ok){ alert('اجرای محاسبه ناموفق بود'); return; }
  var run = {
    runNo: nextRunNo(),
    caseNo: caseNo,
    rfqCd: c.srcRfq,
    family: ad.family,
    adapter: ad.id,
    adapterTitle: ad.title,
    basis: ad.basis,
    at: nowIso(),
    atFa: nowFa(),
    by: curUser(),
    byName: curName(),
    inputs: inp,
    outputs: res.outputs || {},
    formulas: res.formulas || [],
    warnings: res.warnings || [],
    review: { status:'draft', note:'', at:'', atFa:'', by:'', byName:'' }
  };
  saveRun(run);
  var box = document.getElementById('calcRunBox'); if(box) box.innerHTML = runHtml(run);
  if(typeof audit==='function') audit('Engineering Calc','اجرای محاسبه deterministic '+run.runNo+' برای '+caseNo, run.runNo);
  if(typeof ptfToast==='function') ptfToast('محاسبه ذخیره شد','ok');
};

})();
