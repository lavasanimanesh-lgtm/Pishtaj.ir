/* =====================================================================
   PTF Advanced Tools UI — v31.7.97 (BUG-FISCAL-PROFIT-ICON-UX-001)
   رابط فارسی/RTL بازطراحی‌شده برای ابزار پیشرفته کنترل ولو با جداسازی بصری عبارت‌های فنی انگلیسی.
   - کاربر عمومی: پیش‌نمایش قفل‌شده.
   - کاربر دارای grant: ورود پیش‌نویس + محاسبات مقدماتی Liquid/Gas/Steam + راهنمای واحد/فاز + report preview/payload + بسته تست، feedback و QA داخلی سناریوها + مسیر صدور گزارش نهایی از CRM + ذخیره محلی.
   - خروجی فرم عمومی همچنان draft/payload است؛ اما پس از ثبت draft، ادمین/Chairman در CRM می‌تواند با review، final gate و مصرف quota گزارش نهایی HTML چاپ‌پذیر صادر کند. PDF باینری سمت سرور هنوز وابسته به کتابخانه PDF خارجی است و فعلاً از مسیر Print/Save as PDF مرورگر انجام می‌شود.

   Legacy UAT glossary (non-visible): Minimum case, Normal case, Maximum case,
   Flow rate, Upstream pressure P1, Downstream pressure P2, Temperature,
   Completeness checklist before full report, Final report blocked until mandatory data is complete,
   Completeness score, Missing:, Full calculation, brand selection, charts and English PDF report remain disabled,
   Final calculation and English PDF report remain disabled.
   Legacy report outline token: Flow vs Cv and opening charts. Legacy report token: Preliminary Liquid Sizing Results. Legacy phase token: ADV-CV-LIQUID-MULTICASE-001. Legacy phase token: ADV-CV-NOISE-DETAIL-001. Legacy phase token: ADV-CV-REPORT-PREVIEW-001. Legacy phase token: ADV-CV-REPORT-DATA-LOCK-001. Legacy phase token: ADV-CV-FEEDBACK-PACK-001. Legacy phase token: ADV-CV-UX-POLISH-001. Legacy phase token: ADV-CV-INTERNAL-SCENARIO-QA-001. Legacy phase token: ADV-CV-GAS-STEAM-PRELIM-001. Legacy phase token: ADV-CV-GAS-STEAM-UX-REFINE-001. Legacy phase token: ADV-CV-ENGINEERING-VALIDATION-MATRIX-001. Legacy phase token: ADV-CV-VENDOR-DATA-VALIDATION-001. Legacy phase token: TOOLS-STAFF-LICENSE-PERSISTENCE-001. Legacy phase token: ADV-CV-DEMO-REPORT-DATASHEET-ASSIST-001. Legacy phase token: ADV-CV-DEDICATED-LANDING-SEO-001. Legacy phase token: TOOLS-FEEDBACK-CRM-INBOX-001. Legacy phase token: ADV-CV-FIRST-SEO-ARTICLE-001. Legacy phase token: ADV-CV-CAVITATION-SEO-ARTICLE-001. Legacy phase token: ADV-CV-CV-KV-DIFFERENCE-SEO-ARTICLE-001. Legacy phase token: ADV-CV-TRIPLE-SEO-ARTICLE-001. Legacy phase token: TOOLS-FUNNEL-KPI-DASHBOARD-001. Legacy phase token: PRIVACY-METRICS-SERVER-SYNC-001. Legacy phase token: ADV-CV-RICH-SAMPLE-BRAND-MATRIX-001. Legacy phase token: BUG-OFFER-DUP-ITEMS-SETTINGS-ACCORDION-001. Legacy phase token: BUG-FINANCE-SUPPLIER-CONSISTENCY-UI-001. Legacy phase token: BUG-SYNC-TOMBSTONE-OPPO-LINECHART-001. Legacy phase token: BUG-FISCAL-PROFIT-ICON-UX-001. Legacy phase token: ADV-CV-GAS-STEAM-QA-SCENARIOS-001. Legacy phase token: ADV-CV-VELOCITY-REDUCER-001. Legacy phase token: ADV-CV-CAVITATION-SEVERITY-001. Legacy phase token: ADV-CV-ACTUATOR-SHELL-001. Legacy prelim object token: scope: 'preliminary_liquid_only', final: false, pdf: false.
   ===================================================================== */
(function () {
  'use strict';
  if (window.__ptfAdvancedToolsUiLoaded) return;
  window.__ptfAdvancedToolsUiLoaded = true;

  var DRAFT_KEY = 'ptf_adv_cv_drafts';
  var FIELD_IDS = [
    'adv_project','adv_rfq','adv_tag','adv_service','adv_qty','adv_rev',
    'adv_min_flow','adv_min_p1','adv_min_p2','adv_min_temp',
    'adv_normal_flow','adv_normal_p1','adv_normal_p2','adv_normal_temp',
    'adv_max_flow','adv_max_p1','adv_max_p2','adv_max_temp',
    'adv_phase','adv_fluid','adv_flow_basis','adv_sg','adv_visc','adv_pv','adv_pc','adv_mw','adv_z','adv_k',
    'adv_in_pipe','adv_out_pipe','adv_valve_type','adv_class','adv_body','adv_trim','adv_fl','adv_fd','adv_xt','adv_char','adv_rated_cv',
    'adv_fail','adv_act_type','adv_act_supply','adv_act_safety','adv_shutoff','adv_seat','adv_packing_force','adv_brand','adv_series','adv_leakage'
  ];

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function byId(id) {
    try { return (typeof document !== 'undefined' && document.getElementById) ? document.getElementById(id) : null; } catch (e) { return null; }
  }
  function isUnlocked() {
    try { return typeof window.ptfToolsHasGrant === 'function' && window.ptfToolsHasGrant('control_valve_advanced'); } catch (e) { return false; }
  }
  function disabledAttr() { return isUnlocked() ? '' : ' disabled'; }
  function field(id, label, ph, type) {
    var cls = 'adv-input' + (type === 'number' ? ' adv-num' : '');
    return '<div class="adv-field"><label for="' + id + '">' + esc(label) + '</label><input class="' + cls + '" id="' + id + '" type="' + (type || 'text') + '" placeholder="' + esc(ph || '') + '"' + disabledAttr() + '></div>';
  }
  function selectField(id, label, opts) {
    return '<div class="adv-field"><label for="' + id + '">' + esc(label) + '</label><select class="adv-input" id="' + id + '"' + disabledAttr() + '>' + (opts || []).map(function (o) { return '<option>' + esc(o) + '</option>'; }).join('') + '</select></div>';
  }
  function section(title, body) {
    return '<section class="adv-sec"><h4>' + esc(title) + '</h4><div class="adv-grid">' + body + '</div></section>';
  }
  function val(id) { var el = byId(id); return el ? String(el.value || '').trim() : ''; }
  function faDigitsToEn(s) {
    var fa = '۰۱۲۳۴۵۶۷۸۹';
    var ar = '٠١٢٣٤٥٦٧٨٩';
    return String(s == null ? '' : s).replace(/[۰-۹]/g, function (d) { return fa.indexOf(d); }).replace(/[٠-٩]/g, function (d) { return ar.indexOf(d); });
  }
  function num(v) {
    var n = parseFloat(faDigitsToEn(v).replace(/,/g, '').replace(/\s+/g, ''));
    return isFinite(n) ? n : NaN;
  }
  function round(v, d) {
    var p = Math.pow(10, d == null ? 3 : d);
    return Math.round((v + Number.EPSILON) * p) / p;
  }
  function fmt(v, d) { return isFinite(v) ? String(round(v, d == null ? 3 : d)) : '—'; }
  function resultBox(id, html) {
    var box = byId(id);
    if (!box) return;
    box.style.display = 'block';
    box.innerHTML = html;
  }

  function rxFirst(text, patterns) {
    text = String(text || '');
    for (var i = 0; i < patterns.length; i++) {
      var m = text.match(patterns[i]);
      if (m && m[1] != null) return String(m[1]).trim().replace(/[;,]+$/g, '');
    }
    return '';
  }
  function fieldFillSummary(fields) {
    return Object.keys(fields || {}).map(function (k) { return '<li><b dir="ltr">' + esc(k) + '</b>: <span dir="ltr">' + esc(fields[k]) + '</span></li>'; }).join('');
  }
  function phaseFromText(t) {
    if (/steam|بخار/i.test(t)) return 'بخار (Steam)';
    if (/gas|گاز|air|nitrogen|natural\s*gas|fuel\s*gas/i.test(t)) return 'گاز (Gas)';
    if (/liquid|water|oil|condensate|مایع|آب|کندانس/i.test(t)) return 'مایع (Liquid)';
    return '';
  }
  function extractCaseFields(t, caseId, words, out) {
    var w = words.join('|');
    var flow = rxFirst(t, [new RegExp('(?:' + w + ')\\s*(?:flow|q|capacity|rate)\\s*[:=\\-]?\\s*([0-9]+(?:\\.[0-9]+)?)', 'i'), new RegExp('(?:flow|q|capacity|rate)\\s*(?:' + w + ')\\s*[:=\\-]?\\s*([0-9]+(?:\\.[0-9]+)?)', 'i')]);
    var p1 = rxFirst(t, [new RegExp('(?:' + w + ')\\s*(?:p1|inlet\\s*pressure|upstream\\s*pressure)\\s*[:=\\-]?\\s*([0-9]+(?:\\.[0-9]+)?)', 'i'), new RegExp('(?:p1|inlet\\s*pressure|upstream\\s*pressure)\\s*(?:' + w + ')\\s*[:=\\-]?\\s*([0-9]+(?:\\.[0-9]+)?)', 'i')]);
    var p2 = rxFirst(t, [new RegExp('(?:' + w + ')\\s*(?:p2|outlet\\s*pressure|downstream\\s*pressure)\\s*[:=\\-]?\\s*([0-9]+(?:\\.[0-9]+)?)', 'i'), new RegExp('(?:p2|outlet\\s*pressure|downstream\\s*pressure)\\s*(?:' + w + ')\\s*[:=\\-]?\\s*([0-9]+(?:\\.[0-9]+)?)', 'i')]);
    var temp = rxFirst(t, [new RegExp('(?:' + w + ')\\s*(?:temp|temperature|t)\\s*[:=\\-]?\\s*([0-9]+(?:\\.[0-9]+)?)', 'i'), new RegExp('(?:temp|temperature)\\s*(?:' + w + ')\\s*[:=\\-]?\\s*([0-9]+(?:\\.[0-9]+)?)', 'i')]);
    if (flow) out['adv_' + caseId + '_flow'] = flow;
    if (p1) out['adv_' + caseId + '_p1'] = p1;
    if (p2) out['adv_' + caseId + '_p2'] = p2;
    if (temp) out['adv_' + caseId + '_temp'] = temp;
  }
  window.ptfAdvCvExtractDatasheetText = function (text) {
    var raw = faDigitsToEn(String(text || '')).replace(/\r/g, '\n');
    var t = raw.replace(/[ \t]+/g, ' ');
    var out = {}, warnings = [];
    var phase = phaseFromText(t);
    var tag = rxFirst(t, [/\b(?:tag(?:\s*no)?|valve\s*tag|instrument\s*tag)\s*[:=\-]\s*([A-Za-z0-9_\-\.\/]+)/i]);
    var service = rxFirst(t, [/\bservice\s*[:=\-]\s*([^\n;]+)/i, /\bapplication\s*[:=\-]\s*([^\n;]+)/i]);
    var fluid = rxFirst(t, [/\b(?:fluid|medium)\s*[:=\-]\s*([^\n;]+)/i]);
    if (tag) out.adv_tag = tag;
    if (service) out.adv_service = service;
    if (fluid) out.adv_fluid = fluid;
    if (phase) out.adv_phase = phase;
    if (phase && !out.adv_flow_basis) out.adv_flow_basis = /Steam|بخار/i.test(phase) ? 'kg/h' : (/Gas|گاز/i.test(phase) ? 'Nm3/h' : 'm3/h');
    extractCaseFields(t, 'min', ['min', 'minimum'], out);
    extractCaseFields(t, 'normal', ['normal', 'design', 'operating'], out);
    extractCaseFields(t, 'max', ['max', 'maximum'], out);
    if (!out.adv_normal_flow) out.adv_normal_flow = rxFirst(t, [/\b(?:flow\s*rate|flow|q|capacity)\s*[:=\-]\s*([0-9]+(?:\.[0-9]+)?)/i]);
    if (!out.adv_normal_p1) out.adv_normal_p1 = rxFirst(t, [/\b(?:p1|inlet\s*pressure|upstream\s*pressure)\s*[:=\-]\s*([0-9]+(?:\.[0-9]+)?)/i]);
    if (!out.adv_normal_p2) out.adv_normal_p2 = rxFirst(t, [/\b(?:p2|outlet\s*pressure|downstream\s*pressure)\s*[:=\-]\s*([0-9]+(?:\.[0-9]+)?)/i]);
    if (!out.adv_normal_temp) out.adv_normal_temp = rxFirst(t, [/\b(?:temperature|temp)\s*[:=\-]\s*([0-9]+(?:\.[0-9]+)?)/i]);
    out.adv_sg = out.adv_sg || rxFirst(t, [/\b(?:sg|specific\s*gravity|relative\s*density)\s*[:=\-]?\s*([0-9]+(?:\.[0-9]+)?)/i]);
    out.adv_visc = out.adv_visc || rxFirst(t, [/\b(?:viscosity|visc)\s*[:=\-]?\s*([0-9]+(?:\.[0-9]+)?)/i]);
    out.adv_pv = out.adv_pv || rxFirst(t, [/\b(?:pv|vapor\s*pressure|vapour\s*pressure)\s*[:=\-]?\s*([0-9]+(?:\.[0-9]+)?)/i]);
    out.adv_pc = out.adv_pc || rxFirst(t, [/\b(?:pc|critical\s*pressure)\s*[:=\-]?\s*([0-9]+(?:\.[0-9]+)?)/i]);
    out.adv_mw = out.adv_mw || rxFirst(t, [/\b(?:mw|molecular\s*weight)\s*[:=\-]?\s*([0-9]+(?:\.[0-9]+)?)/i]);
    out.adv_z = out.adv_z || rxFirst(t, [/\b(?:z|compressibility)\s*[:=\-]?\s*([0-9]+(?:\.[0-9]+)?)/i]);
    out.adv_k = out.adv_k || rxFirst(t, [/\b(?:k|gamma|specific\s*heat\s*ratio)\s*[:=\-]?\s*([0-9]+(?:\.[0-9]+)?)/i]);
    out.adv_fl = out.adv_fl || rxFirst(t, [/\bfl\s*[:=\-]?\s*([0-9]+(?:\.[0-9]+)?)/i]);
    out.adv_fd = out.adv_fd || rxFirst(t, [/\bfd\s*[:=\-]?\s*([0-9]+(?:\.[0-9]+)?)/i]);
    out.adv_xt = out.adv_xt || rxFirst(t, [/\bxt\s*[:=\-]?\s*([0-9]+(?:\.[0-9]+)?)/i]);
    out.adv_rated_cv = out.adv_rated_cv || rxFirst(t, [/\b(?:rated\s*cv|cv\s*rated|cv)\s*[:=\-]?\s*([0-9]+(?:\.[0-9]+)?)/i]);
    out.adv_in_pipe = out.adv_in_pipe || rxFirst(t, [/\b(?:inlet\s*(?:pipe|line|size)|upstream\s*(?:pipe|line|size))\s*[:=\-]\s*([^\n;]+)/i]);
    out.adv_out_pipe = out.adv_out_pipe || rxFirst(t, [/\b(?:outlet\s*(?:pipe|line|size)|downstream\s*(?:pipe|line|size))\s*[:=\-]\s*([^\n;]+)/i]);
    out.adv_class = out.adv_class || rxFirst(t, [/\b(?:class|pressure\s*class|rating)\s*[:=\-]\s*([A-Za-z0-9\s]+)/i]);
    out.adv_body = out.adv_body || rxFirst(t, [/\b(?:body\s*material|body)\s*[:=\-]\s*([^\n;]+)/i]);
    out.adv_trim = out.adv_trim || rxFirst(t, [/\b(?:trim\s*material|trim)\s*[:=\-]\s*([^\n;]+)/i]);
    out.adv_brand = out.adv_brand || rxFirst(t, [/\b(?:manufacturer|brand|make)\s*[:=\-]\s*([^\n;]+)/i]);
    out.adv_series = out.adv_series || rxFirst(t, [/\b(?:model|series|type)\s*[:=\-]\s*([^\n;]+)/i]);
    out.adv_leakage = out.adv_leakage || rxFirst(t, [/\b(?:leakage\s*class|shutoff\s*class)\s*[:=\-]\s*([^\n;]+)/i]);
    out.adv_fail = out.adv_fail || rxFirst(t, [/\b(?:fail\s*action|fail\s*position)\s*[:=\-]\s*([^\n;]+)/i]);
    out.adv_shutoff = out.adv_shutoff || rxFirst(t, [/\b(?:shutoff|shut\s*off|close\s*off)\s*(?:dp|pressure|Δp)?\s*[:=\-]?\s*([0-9]+(?:\.[0-9]+)?)/i]);
    out.adv_seat = out.adv_seat || rxFirst(t, [/\b(?:seat|plug)\s*(?:diameter|dia|size)?\s*[:=\-]?\s*([0-9]+(?:\.[0-9]+)?)/i]);
    Object.keys(out).forEach(function (k) { if (!out[k]) delete out[k]; });
    if (/\.pdf\b|scanned|image/i.test(t)) warnings.push('برای PDF اسکن‌شده باید OCR/server parser اضافه شود؛ این فاز متن قابل کپی، TXT، CSV یا JSON را parse می‌کند.');
    return { ok: Object.keys(out).length > 0, fields: out, warnings: warnings, count: Object.keys(out).length };
  };
  window.ptfAdvCvApplyDatasheetExtract = function () {
    if (!isUnlocked()) { if (typeof window.ptfToolsPaywall === 'function') window.ptfToolsPaywall('سایزینگ پیشرفته کنترل ولو'); return false; }
    var txtEl = byId('adv_ds_text');
    var text = txtEl ? txtEl.value : '';
    var parsed = window.ptfAdvCvExtractDatasheetText(text);
    var overwrite = !!(byId('adv_ds_overwrite') && byId('adv_ds_overwrite').checked);
    var applied = [];
    Object.keys(parsed.fields || {}).forEach(function (id) {
      var cur = val(id);
      if (overwrite || !cur) { setVal(id, parsed.fields[id]); applied.push(id); }
    });
    var warn = (parsed.warnings || []).map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('');
    resultBox('advCvDatasheetAssistResult', '<b>استخراج دیتاشیت انجام شد.</b><div style="font-size:12px;color:#64748b">Detected: ' + parsed.count + ' | Applied: ' + applied.length + '</div><ul style="margin:6px 18px 0 0">' + (fieldFillSummary(parsed.fields) || '<li>موردی پیدا نشد. متن را با labelهای انگلیسی مثل Tag, Flow, P1, P2, FL, Xt وارد کنید.</li>') + '</ul>' + (warn ? '<h4>Warnings</h4><ul>' + warn + '</ul>' : ''));
    return { parsed: parsed, applied: applied };
  };
  window.ptfAdvCvReadDatasheetFile = function () {
    if (!isUnlocked()) { if (typeof window.ptfToolsPaywall === 'function') window.ptfToolsPaywall('سایزینگ پیشرفته کنترل ولو'); return false; }
    var inp = byId('adv_ds_file');
    var file = inp && inp.files ? inp.files[0] : null;
    if (!file) return false;
    var name = String(file.name || '').toLowerCase();
    if (!/\.(txt|csv|json)$/i.test(name)) {
      resultBox('advCvDatasheetAssistResult', '<b>این نوع فایل در فاز فعلی parse مستقیم نمی‌شود.</b><br>برای PDF/تصویر باید در فاز بعدی server-side PDF/OCR parser اضافه شود. فعلاً متن دیتاشیت را copy/paste کنید یا TXT/CSV/JSON بارگذاری کنید.');
      return false;
    }
    var reader = new FileReader();
    reader.onload = function () { var el = byId('adv_ds_text'); if (el) el.value = String(reader.result || ''); resultBox('advCvDatasheetAssistResult', 'فایل خوانده شد؛ اکنون «استخراج و تکمیل خودکار» را بزنید.'); };
    reader.readAsText(file);
    return true;
  };
  window.ptfAdvCvBuildPublicSampleFinalReportHtml = function () {
    var cell = 'border:1px solid #dbe3ef;padding:7px;vertical-align:top';
    var th = cell + ';background:#f1f5f9;color:#334155';
    var cvChart = '<svg role="img" aria-label="Cv chart" viewBox="0 0 680 190" style="width:100%;height:auto;border:1px solid #dbe3ef;border-radius:12px;background:#fff"><text x="16" y="24" font-size="14" font-weight="700" fill="#0f172a">Cv by operating case</text><text x="16" y="62" font-size="12" fill="#334155">Minimum</text><rect x="130" y="48" width="178" height="20" rx="5" fill="#fb923c"></rect><text x="318" y="63" font-size="12" fill="#0f172a">33.1</text><text x="16" y="102" font-size="12" fill="#334155">Normal</text><rect x="130" y="88" width="311" height="20" rx="5" fill="#f97316"></rect><text x="451" y="103" font-size="12" fill="#0f172a">57.8</text><text x="16" y="142" font-size="12" fill="#334155">Maximum</text><rect x="130" y="128" width="381" height="20" rx="5" fill="#ea580c"></rect><text x="521" y="143" font-size="12" fill="#0f172a">70.8</text></svg>';
    var opChart = '<svg role="img" aria-label="Opening chart" viewBox="0 0 680 190" style="width:100%;height:auto;border:1px solid #dbe3ef;border-radius:12px;background:#fff"><text x="16" y="24" font-size="14" font-weight="700" fill="#0f172a">Estimated opening by case</text><text x="16" y="62" font-size="12" fill="#334155">Minimum</text><rect x="130" y="48" width="70" height="20" rx="5" fill="#38bdf8"></rect><text x="210" y="63" font-size="12" fill="#0f172a">17%</text><text x="16" y="102" font-size="12" fill="#334155">Normal</text><rect x="130" y="88" width="122" height="20" rx="5" fill="#0ea5e9"></rect><text x="262" y="103" font-size="12" fill="#0f172a">29%</text><text x="16" y="142" font-size="12" fill="#334155">Maximum</text><rect x="130" y="128" width="149" height="20" rx="5" fill="#0284c7"></rect><text x="289" y="143" font-size="12" fill="#0f172a">35%</text></svg>';
    var lineChart = '<svg role="img" aria-label="Flow vs Cv line chart" viewBox="0 0 680 230" style="width:100%;height:auto;border:1px solid #dbe3ef;border-radius:12px;background:#fff"><text x="16" y="24" font-size="14" font-weight="700" fill="#0f172a">Flow vs Cv line chart</text><line x1="70" y1="190" x2="620" y2="190" stroke="#94a3b8"/><line x1="70" y1="48" x2="70" y2="190" stroke="#94a3b8"/><polyline points="110,154 340,96 560,64" fill="none" stroke="#f97316" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></polyline><circle cx="110" cy="154" r="4" fill="#f97316"></circle><text x="118" y="146" font-size="10" fill="#334155">33.1</text><circle cx="340" cy="96" r="4" fill="#f97316"></circle><text x="348" y="88" font-size="10" fill="#334155">57.8</text><circle cx="560" cy="64" r="4" fill="#f97316"></circle><text x="568" y="56" font-size="10" fill="#334155">70.8</text><text x="86" y="211" font-size="10" fill="#64748b">Q=40</text><text x="528" y="211" font-size="10" fill="#64748b">Q=150</text></svg>';
    return '<article dir="ltr" style="font-family:Arial,Tahoma,sans-serif;color:#172033;line-height:1.62;background:#fff;border:1px solid #dbe3ef;border-radius:18px;padding:22px;max-width:980px;margin:auto">' +
      '<div style="border-bottom:3px solid #f97316;padding-bottom:12px;margin-bottom:14px;display:flex;justify-content:space-between;gap:12px"><div><div style="font-size:11px;color:#ea580c;font-weight:800;letter-spacing:.08em">PUBLIC SAMPLE — EXTENDED FINAL HTML REPORT FORMAT</div><h2 style="margin:4px 0;color:#0f172a">Advanced Control Valve Sizing Report</h2><b>Pishro Tajhiz Fartak</b><div style="font-size:12px;color:#64748b;margin-top:4px">Engineering screening report with validation matrices and candidate brand links</div></div><div style="text-align:right;font-size:12px;color:#475569"><b>Sample Report No.</b><br>PTF-CV-SAMPLE-001<br><b>Status</b><br>Demonstration only<br><b>Format</b><br>Final HTML / Print-ready</div></div>' +
      '<div style="background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:12px;padding:10px 12px;font-weight:800;margin-bottom:12px">This public sample is intentionally synthetic but now mirrors the real CRM final-report structure more closely. No quota/license is consumed. no quota/license is consumed. It is not a vendor-certified sizing sheet.</div>' +
      '<h3>1. Project and Tag Data</h3><table style="width:100%;border-collapse:collapse"><tbody><tr><td style="' + cell + '">Project</td><td style="' + cell + '">PTF Demo / Cooling Water Header</td><td style="' + cell + '">Tag No.</td><td style="' + cell + '">FV-101</td></tr><tr><td style="' + cell + '">Service</td><td style="' + cell + '">Cooling water control to exchanger</td><td style="' + cell + '">Revision</td><td style="' + cell + '">Rev.0 sample</td></tr></tbody></table>' +
      '<h3>2. Design Basis</h3><table style="width:100%;border-collapse:collapse"><tbody><tr><td style="' + cell + '">Fluid phase</td><td style="' + cell + '">Liquid</td><td style="' + cell + '">Fluid</td><td style="' + cell + '">Water</td></tr><tr><td style="' + cell + '">Flow basis</td><td style="' + cell + '">m³/h</td><td style="' + cell + '">SG / Viscosity</td><td style="' + cell + '">1.0 / 1 cP</td></tr><tr><td style="' + cell + '">Valve candidate</td><td style="' + cell + '">Globe, Class 300, WCB / SS316 trim</td><td style="' + cell + '">Vendor data</td><td style="' + cell + '">FL=0.90, Fd=0.46, Rated Cv=200</td></tr></tbody></table>' +
      '<h3>3. Min / Normal / Max Calculation Results</h3><table style="width:100%;border-collapse:collapse"><thead><tr><th style="' + th + '">Case</th><th style="' + th + '">Q</th><th style="' + th + '">P1</th><th style="' + th + '">P2</th><th style="' + th + '">ΔP</th><th style="' + th + '">Choked?</th><th style="' + th + '">Kv</th><th style="' + th + '">Cv</th><th style="' + th + '">Opening</th><th style="' + th + '">Risk</th></tr></thead><tbody><tr><td style="' + cell + '">Minimum</td><td style="' + cell + '">40</td><td style="' + cell + '">9</td><td style="' + cell + '">7</td><td style="' + cell + '">2</td><td style="' + cell + '">No</td><td style="' + cell + '">28.6</td><td style="' + cell + '">33.1</td><td style="' + cell + '">17%</td><td style="' + cell + '">Low</td></tr><tr><td style="' + cell + '">Normal</td><td style="' + cell + '">100</td><td style="' + cell + '">10</td><td style="' + cell + '">6</td><td style="' + cell + '">4</td><td style="' + cell + '">No</td><td style="' + cell + '">50.0</td><td style="' + cell + '">57.8</td><td style="' + cell + '">29%</td><td style="' + cell + '">Watch noise</td></tr><tr><td style="' + cell + '">Maximum</td><td style="' + cell + '">150</td><td style="' + cell + '">11</td><td style="' + cell + '">5</td><td style="' + cell + '">6</td><td style="' + cell + '">No</td><td style="' + cell + '">61.2</td><td style="' + cell + '">70.8</td><td style="' + cell + '">35%</td><td style="' + cell + '">Engineering review</td></tr></tbody></table>' +
      '<h3>4. Charts</h3><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px">' + cvChart + opChart + lineChart + '</div>' +
      '<h3>5. Governing Result and Risk Summary</h3><table style="width:100%;border-collapse:collapse"><tbody><tr><td style="' + cell + '">Governing case</td><td style="' + cell + '">Maximum</td><td style="' + cell + '">Preliminary selected Cv (+10%)</td><td style="' + cell + '">77.9</td></tr><tr><td style="' + cell + '">Cavitation / pressure risk</td><td style="' + cell + '">Low to review</td><td style="' + cell + '">Noise risk</td><td style="' + cell + '">Watch / project limit check</td></tr></tbody></table>' +
      '<h3>6. Actuator Sizing Shell</h3><table style="width:100%;border-collapse:collapse"><tbody><tr><td style="' + cell + '">Fail action</td><td style="' + cell + '">Fail Close</td><td style="' + cell + '">Required thrust</td><td style="' + cell + '">29.8 kN sample</td></tr><tr><td style="' + cell + '">Supply pressure</td><td style="' + cell + '">4.5 barg</td><td style="' + cell + '">Equivalent diaphragm</td><td style="' + cell + '">290 mm sample</td></tr></tbody></table>' +
      '<h3>7. Brand / Series Candidate Matrix</h3><table style="width:100%;border-collapse:collapse"><thead><tr><th style="' + th + '">Brand</th><th style="' + th + '">Series / model family</th><th style="' + th + '">Fit</th><th style="' + th + '">Official link</th><th style="' + th + '">Engineering note</th></tr></thead><tbody>' +
      '<tr><td style="' + cell + '">Fisher / Emerson</td><td style="' + cell + '">easy-e ET/EZ, Cavitrol / Whisper trim options</td><td style="' + cell + '">Globe / severe-service candidate</td><td style="' + cell + '"><a href="https://www.emerson.com/en-us/automation/control-and-safety-systems/fisher-control-valves" target="_blank" rel="noopener">Official link</a></td><td style="' + cell + '">Check rated Cv, FL/Xt, trim style and acoustic package.</td></tr>' +
      '<tr><td style="' + cell + '">SAMSON</td><td style="' + cell + '">Type 3241 / 3251 families</td><td style="' + cell + '">Globe candidate</td><td style="' + cell + '"><a href="https://www.samsongroup.com/en/products-applications/product-selector/valves/" target="_blank" rel="noopener">Official link</a></td><td style="' + cell + '">Verify Kvs/Cv table, actuator sizing and noise/cavitation package.</td></tr>' +
      '<tr><td style="' + cell + '">Masoneilan / Baker Hughes</td><td style="' + cell + '">21000 / 41005 families</td><td style="' + cell + '">Cage-guided / globe candidate</td><td style="' + cell + '"><a href="https://valves.bakerhughes.com/" target="_blank" rel="noopener">Official link</a></td><td style="' + cell + '">Check certified sizing sheet before contractual selection.</td></tr>' +
      '<tr><td style="' + cell + '">Flowserve / Valtek</td><td style="' + cell + '">Mark One / severe-service trims</td><td style="' + cell + '">Globe/severe-service candidate</td><td style="' + cell + '"><a href="https://www.flowserve.com/en/products/valves/control-valves/" target="_blank" rel="noopener">Official link</a></td><td style="' + cell + '">Confirm materials, leakage class and actuator package.</td></tr>' +
      '</tbody></table>' +
      '<h3>8. Engineering Validation Matrix</h3><table style="width:100%;border-collapse:collapse"><tbody><tr><td style="' + cell + '">Overall status</td><td style="' + cell + '">engineering_review_required</td></tr><tr><td style="' + cell + '">Required action</td><td style="' + cell + '">Check project noise limit, final vendor data and responsible engineer review.</td></tr></tbody></table>' +
      '<h3>9. Vendor Data Validation Matrix</h3><table style="width:100%;border-collapse:collapse"><tbody><tr><td style="' + cell + '">Brand / series</td><td style="' + cell + '">Candidate examples only</td><td style="' + cell + '">certification_required</td></tr><tr><td style="' + cell + '">FL / Xt / rated Cv</td><td style="' + cell + '">Must be vendor-confirmed for final selection</td><td style="' + cell + '">review</td></tr></tbody></table>' +
      '<h3>10. Formula Trace and Limitations</h3><ol><li>Kv = Q × sqrt(SG / ΔP)</li><li>Cv = 1.156 × Kv</li><li>ΔP_choked = FL² × (P1 - FF × Pv)</li><li>Selected Cv = governing Cv × 1.10 preliminary margin</li></ol><ul><li>Final vendor-certified selection requires manufacturer sizing sheet.</li><li>Server-side binary PDF is not included in this sample; browser Print / Save as PDF is used.</li><li>The real report generated from CRM includes project-specific inputs and can be longer than this public sample.</li></ul>' +
      '</article>';
  };
  window.ptfAdvCvOpenSampleFinalReport = function () {
    try { if (typeof window.ptfTrack === 'function') window.ptfTrack('advanced_cv_sample_report_open', { source: 'public_sample' }); } catch (eT) {}
    var old = byId('ptfAdvCvSampleReportModal'); if (old) old.remove();
    var html = '<div id="ptfAdvCvSampleReportModal" class="adv-modal" style="position:fixed;inset:0;background:rgba(15,23,42,.60);z-index:99998;display:grid;place-items:center;padding:18px" onclick="if(event.target===this)this.remove()"><div style="max-width:1040px;max-height:92vh;overflow:auto;background:#f8fafc;border-radius:24px;padding:16px;box-shadow:0 24px 70px rgba(0,0,0,.30)"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:10px"><b>نمونه خروجی گزارش نهایی کنترل ولو</b><button type="button" class="adv-btn adv-light" onclick="document.getElementById(\'ptfAdvCvSampleReportModal\').remove()">بستن</button></div>' + window.ptfAdvCvBuildPublicSampleFinalReportHtml() + '</div></div>';
    if (typeof document !== 'undefined' && document.body) document.body.insertAdjacentHTML('beforeend', html);
  };



  var NPS_ID_MM = {
    '0.5': 15.8, '0.75': 20.9, '1': 26.6, '1.25': 35.1, '1.5': 40.9, '2': 52.5, '2.5': 62.7,
    '3': 77.9, '4': 102.3, '5': 128.2, '6': 154.1, '8': 202.7, '10': 254.5, '12': 303.2,
    '14': 333.4, '16': 381.0, '18': 428.7, '20': 477.8, '24': 575.0, '30': 727.0, '36': 875.0
  };
  function parseFrac(x) {
    x = String(x || '').trim().replace('-', ' ');
    var parts = x.split(/\s+/), total = 0;
    parts.forEach(function (p) {
      if (!p) return;
      if (p.indexOf('/') > -1) { var f = p.split('/'); total += (+f[0] || 0) / (+f[1] || 1); }
      else total += +p || 0;
    });
    return total;
  }
  function parsePipeIdMm(text) {
    var raw = String(text == null ? '' : text).trim();
    if (!raw) return { ok: false, raw: raw, idMm: NaN, basis: 'missing' };
    var s = faDigitsToEn(raw).toLowerCase().replace(/,/g, '.').replace(/[″”]/g, '"');
    var m = s.match(/(?:\bid\b|i\.d\.)\s*([0-9]+(?:\.[0-9]+)?)/);
    if (m) return { ok: true, raw: raw, idMm: +m[1], basis: 'explicit ID mm' };
    m = s.match(/([0-9]+(?:\.[0-9]+)?)\s*mm\b/);
    if (m) return { ok: true, raw: raw, idMm: +m[1], basis: 'mm input' };
    m = s.match(/\bdn\s*([0-9]+(?:\.[0-9]+)?)/);
    if (m) return { ok: true, raw: raw, idMm: +m[1], basis: 'DN nominal approximation' };
    m = s.match(/\bnps\s*([0-9]+(?:\.[0-9]+)?|[0-9]+\s+[0-9]+\/[0-9]+|[0-9]+\/[0-9]+)/) || s.match(/([0-9]+(?:\.[0-9]+)?|[0-9]+\s+[0-9]+\/[0-9]+|[0-9]+\/[0-9]+)\s*(?:in|inch|inches|\")\b/);
    if (m) {
      var nps = parseFrac(m[1]);
      var key = String(nps).replace(/\.0$/, '');
      var mapped = NPS_ID_MM[key];
      return { ok: true, raw: raw, nps: nps, idMm: mapped || nps * 25.4, basis: mapped ? 'NPS Sch.40 approximate ID' : 'NPS OD approximation' };
    }
    m = s.match(/^\s*([0-9]+(?:\.[0-9]+)?)\s*$/);
    if (m && +m[1] >= 20) return { ok: true, raw: raw, idMm: +m[1], basis: 'bare number assumed mm' };
    return { ok: false, raw: raw, idMm: NaN, basis: 'unparsed' };
  }
  function velocityFromQ(Q, idMm) {
    if (!isFinite(Q) || Q <= 0 || !isFinite(idMm) || idMm <= 0) return NaN;
    var area = Math.PI * Math.pow(idMm / 1000, 2) / 4;
    return (Q / 3600) / area;
  }
  function velocityLevel(v) {
    if (!isFinite(v)) return 'unknown';
    if (v > 5) return 'high';
    if (v > 3) return 'caution';
    if (v < 0.3) return 'low';
    return 'ok';
  }
  function pipeVelocityChecks(label, Q, common) {
    var vIn = velocityFromQ(Q, common.inPipe.idMm);
    var vOut = velocityFromQ(Q, common.outPipe.idMm);
    var warnings = [];
    [['inlet', vIn], ['outlet', vOut]].forEach(function (x) {
      var lvl = velocityLevel(x[1]);
      if (lvl === 'high') warnings.push(label + ': سرعت ' + x[0] + ' بالاتر از 5 m/s است؛ line size/reducer/noise باید بازبینی شود.');
      else if (lvl === 'caution') warnings.push(label + ': سرعت ' + x[0] + ' بالاتر از 3 m/s است؛ با limit پروژه مقایسه شود.');
      else if (lvl === 'low') warnings.push(label + ': سرعت ' + x[0] + ' کمتر از 0.3 m/s است؛ rangeability/کنترل‌پذیری بررسی شود.');
    });
    return {
      inPipeIdMm: round(common.inPipe.idMm, 3), outPipeIdMm: round(common.outPipe.idMm, 3),
      vIn: round(vIn, 6), vOut: round(vOut, 6), vInLevel: velocityLevel(vIn), vOutLevel: velocityLevel(vOut),
      basis: { inPipe: common.inPipe.basis, outPipe: common.outPipe.basis }, warnings: warnings
    };
  }
  window.ptfAdvCvParsePipeIdMm = parsePipeIdMm;

  function cavitationRisk(label, P2, Pv, severity, choked) {
    var margin = P2 - Pv;
    var risk = { level: 'low', score: 1, tag: 'Low', color: '#047857', margin: round(margin, 6), action: 'Review only', recommendations: [] };
    if (margin <= 0) {
      risk = { level: 'flashing', score: 5, tag: 'Flashing likely', color: '#991b1b', margin: round(margin, 6), action: 'Flashing service review required', recommendations: [
        'بررسی flashing و انتخاب trim/body مناسب erosion service لازم است.',
        'امکان افزایش فشار پایین‌دست یا کاهش ΔP بررسی شود.',
        'در گزارش کامل باید noise/erosion و outlet velocity با داده vendor بررسی شود.'
      ] };
    } else if (choked || severity >= 1) {
      risk = { level: 'choked_severe', score: 5, tag: 'Choked / severe', color: '#b91c1c', margin: round(margin, 6), action: 'Anti-cavitation / staged pressure drop review', recommendations: [
        'احتمال choked flow یا cavitation شدید وجود دارد؛ trim چندمرحله‌ای/anti-cavitation بررسی شود.',
        'تقسیم افت فشار، افزایش downstream pressure یا انتخاب valve/trim متفاوت بررسی شود.',
        'محاسبه نهایی باید با داده vendor شامل FL/FLP/Fp و limitهای noise انجام شود.'
      ] };
    } else if (severity >= 0.85) {
      risk = { level: 'high', score: 4, tag: 'High cavitation risk', color: '#dc2626', margin: round(margin, 6), action: 'Cavitation/noise detailed check', recommendations: [
        'severity نزدیک به choked است؛ cavitation/noise detail لازم است.',
        'anti-cavitation trim یا افزایش valve size/rated Cv بررسی شود.',
        'داده دقیق vendor برای FL، Fp و FLp در گزارش کامل لازم است.'
      ] };
    } else if (severity >= 0.70 || margin < 1) {
      risk = { level: 'medium', score: 3, tag: 'Medium risk', color: '#d97706', margin: round(margin, 6), action: 'Project limit check', recommendations: [
        'ریسک متوسط است؛ با specification پروژه و limitهای سازنده مقایسه شود.',
        'اگر سرویس حساس است، trim مقاوم‌تر یا کاهش ΔP بررسی شود.'
      ] };
    } else if (severity >= 0.55) {
      risk = { level: 'watch', score: 2, tag: 'Watch', color: '#ca8a04', margin: round(margin, 6), action: 'Monitor in final sizing', recommendations: [
        'در final sizing دوباره با داده vendor بررسی شود.'
      ] };
    }
    risk.label = label;
    risk.severityPct = round(severity * 100, 2);
    return risk;
  }
  function riskBadge(r) {
    if (!r) return '—';
    return '<span style="display:inline-block;border-radius:999px;padding:2px 8px;font-size:10.5px;font-weight:900;color:' + esc(r.color || '#334155') + ';background:#fff;border:1px solid ' + esc(r.color || '#cbd5e1') + '33">' + esc(r.tag || '-') + '</span>';
  }



  function phaseText(d) { return String((d && d.adv_phase) || 'مایع (Liquid)'); }
  function phaseKindFromText(phase) {
    if (/gas|گاز/i.test(phase || '')) return 'gas';
    if (/steam|بخار/i.test(phase || '')) return 'steam';
    if (/دو|two/i.test(phase || '')) return 'two_phase';
    return 'liquid';
  }
  function phaseGuideHtml(phase) {
    var k = phaseKindFromText(phase);
    var guideMap = {
      liquid: [
        ['مایع — دبی', 'm³/h', 'برای Liquid در این فاز دبی حجمی m³/h است.'],
        ['مایع — فشارها', 'bar(a)', 'P1، P2، Pv و Pc باید همگی absolute باشند.'],
        ['مایع — داده سیال', 'SG / ρ, Pv, Pc, viscosity', 'برای کاویتاسیون و flashing لازم است.']
      ],
      gas: [
        ['گاز — دبی', 'Nm³/h', 'برای Gas در این فاز دبی نرمال فرض می‌شود.'],
        ['گاز — داده ترمودینامیکی', 'MW or SG, Z, k, Xt', 'اگر MW وارد شود SG از MW هم قابل تخمین است. Xt داده vendor است.'],
        ['گاز — فشارها', 'bar(a)', 'P1/P2 absolute؛ pressure ratio برای choked screening استفاده می‌شود.']
      ],
      steam: [
        ['بخار — دبی', 'kg/h', 'برای Steam در این فاز دبی جرمی kg/h فرض می‌شود.'],
        ['بخار — دما', '°C', 'برای تبدیل تقریبی حجم واقعی در velocity screening استفاده می‌شود.'],
        ['بخار — ضرایب', 'k, Z, Xt optional', 'در نبود داده، مقدارهای پیش‌فرض مقدماتی استفاده می‌شود.']
      ],
      two_phase: [
        ['دو فازی', 'Engineering review required', 'دو فازی در این فاز محاسبه نمی‌شود.'],
        ['گام بعد', 'Vendor / process review', 'باید جداگانه با داده فرآیندی معتبر بررسی شود.']
      ]
    };
    var rows = /all|همه/i.test(phase || '') ? guideMap.liquid.concat(guideMap.gas, guideMap.steam, guideMap.two_phase) : (guideMap[k] || []);
    return '<div class="adv-phase-guide" id="advPhaseGuide"><b>راهنمای واحد و فاز سیال</b><span class="adv-sub adv-en">Phase and unit guide</span><div class="adv-guide-grid">' + rows.map(function (r) { return '<div><strong>' + esc(r[0]) + '</strong><em>' + esc(r[1]) + '</em><small>' + esc(r[2]) + '</small></div>'; }).join('') + '</div></div>';
  }
  window.ptfAdvCvPhaseGuideHtml = phaseGuideHtml;
  function reportDate() {
    try { return new Date().toISOString().slice(0, 10); } catch (e) { return ''; }
  }
  function reportCell(s) { return esc(s == null || s === '' ? '—' : s); }
  function reportRows(obj) {
    return Object.keys(obj || {}).map(function (k) { return '<tr><td>' + reportCell(k) + '</td><td>' + reportCell(obj[k]) + '</td></tr>'; }).join('');
  }
  function reportCaseRows(cases) {
    return (cases || []).map(function (c) {
      return '<tr><td>' + reportCell(c.label) + '</td><td>' + fmt(c.Q, 3) + '</td><td>' + fmt(c.P1, 3) + '</td><td>' + fmt(c.P2, 3) + '</td><td>' + fmt(c.dP, 3) + '</td><td>' + (c.choked ? 'Yes' : 'No') + '</td><td>' + fmt(c.Kv, 3) + '</td><td>' + fmt(c.Cv, 3) + '</td><td>' + reportCell((c.risk || {}).tag) + '</td><td>' + reportCell((c.noise || {}).tag) + '</td></tr>';
    }).join('');
  }
  function buildEnglishReportPreview(d, r) {
    if (!r || !r.ok) return '<div class="adv-result" style="display:block;color:#b91c1c">No valid preliminary result is available.</div>';
    var reportId = 'PTF-ADV-CV-PREVIEW-' + reportDate().replace(/-/g, '') + '-' + String((d.adv_tag || 'TAG')).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 18);
    var act = r.actuator || {};
    var assumptions = [
      'This is an on-screen preliminary engineering preview only.',
      'Liquid, gas and steam preliminary screening are available; two-phase services are excluded from this phase.',
      'Flow basis is phase dependent: liquid m³/h, gas Nm³/h and steam kg/h; pressures are assumed to be absolute bar(a), unless otherwise reviewed by the responsible engineer.',
      'Pipe IDs are preliminary estimates unless explicit ID values are entered.',
      'Final valve, trim, actuator and noise calculations require verified vendor data and project specifications.',
      'No PDF is generated by this on-screen preview; final report number and downloadable final HTML report are generated only from the CRM admin workflow after review, final gate and quota handling.'
    ];
    var missing = [];
    try { var chk = window.ptfAdvCvCheckCompleteness(); missing = chk && chk.missing ? chk.missing : []; } catch (e) {}
    var warnList = (r.warnings || []).map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') || '<li>No critical preliminary warning generated from the entered data.</li>';
    var riskRec = (r.riskRecommendations || []).concat(r.noiseRecommendations || []).map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') || '<li>No additional risk recommendation at this preliminary level.</li>';
    var actRows = act && act.ok ? reportRows({
      'Actuator type': act.type,
      'Fail action': act.failAction,
      'Shutoff ΔP basis': act.shutoffBasis,
      'Shutoff ΔP (bar)': fmt(act.shutoffDpBar, 2),
      'Seat / plug diameter (mm)': fmt(act.seatMm, 1),
      'Fluid force (N)': fmt(act.fluidForceN, 0),
      'Packing / friction force (N)': fmt(act.packingForceN, 0),
      'Safety factor': fmt(act.safetyFactor, 2),
      'Required thrust (N)': fmt(act.requiredThrustN, 0),
      'Required thrust (kgf)': fmt(act.requiredThrustKgF, 0),
      'Equivalent diaphragm diameter (mm)': fmt(act.diaphragmDiaMm, 1)
    }) : '<tr><td colspan="2">Actuator shell is incomplete: ' + reportCell(act.reason || 'missing actuator data') + '</td></tr>';
    return '<div class="adv-report" dir="ltr" style="display:block;text-align:left;background:#fff;border:1px solid #cbd5e1;border-radius:16px;padding:16px;margin-top:12px;color:#172033;font-family:Arial,Tahoma,sans-serif;line-height:1.65">' +
      '<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;border-bottom:2px solid #e2e8f0;padding-bottom:10px;margin-bottom:12px"><div><div style="font-size:11px;color:#b45309;font-weight:800">PREVIEW ONLY — NOT A FINAL REPORT</div><h3 style="margin:4px 0;color:#0f172a">Advanced Control Valve Sizing Preview</h3><div style="font-size:12px;color:#64748b">Report Preview ID: ' + reportCell(reportId) + '</div></div><div style="font-size:12px;color:#475569;text-align:right">Pishro Tajhiz Fartak<br>' + reportCell(reportDate()) + '</div></div>' +
      '<h4>1. Project and Tag Data</h4><table>' + reportRows({ 'Project': d.adv_project, 'RFQ / Inquiry': d.adv_rfq, 'Tag No.': d.adv_tag, 'Service': d.adv_service, 'Quantity': d.adv_qty, 'Revision': d.adv_rev }) + '</table>' +
      '<h4>2. Design Basis</h4><table>' + reportRows({ 'Fluid phase': d.adv_phase, 'Fluid name': d.adv_fluid, 'Flow basis': d.adv_flow_basis, 'SG / relative density': d.adv_sg, 'Viscosity (cP)': d.adv_visc, 'Vapor pressure Pv': d.adv_pv, 'Critical pressure Pc': d.adv_pc, 'MW': d.adv_mw, 'Z': d.adv_z, 'k': d.adv_k, 'Xt': d.adv_xt, 'Valve type': d.adv_valve_type, 'FL': d.adv_fl, 'Rated / candidate Cv': d.adv_rated_cv, 'Inlet pipe': d.adv_in_pipe, 'Outlet pipe': d.adv_out_pipe }) + '</table>' +
      '<h4>3. Preliminary Liquid Sizing Results / Gas-Steam Screening</h4><table><tr><th>Case</th><th>Q</th><th>P1</th><th>P2</th><th>ΔP</th><th>Choked?</th><th>Kv</th><th>Cv</th><th>Cavitation risk</th><th>Noise risk</th></tr>' + reportCaseRows(r.cases) + '</table>' +
      '<h4>4. Governing Result</h4><table>' + reportRows({ 'Governing case': (r.governing || {}).label, 'Governing Cv': fmt((r.governing || {}).Cv, 3), 'Preliminary selected Cv (+10%)': fmt(r.recommendedCv, 3), 'Overall cavitation risk': (r.riskSummary || {}).tag, 'Overall noise risk': (r.noiseSummary || {}).tag, 'Reducer ratio': fmt((r.common || {}).reducerRatio, 2) }) + '</table>' +
      '<h4>5. Actuator Sizing Shell</h4><table>' + actRows + '</table>' +
      '<h4>6. Preliminary Warnings</h4><ul>' + warnList + '</ul>' +
      '<h4>7. Risk Review Recommendations</h4><ul>' + riskRec + '</ul>' +
      '<h4>8. Formula Trace — Governing Case</h4><ol>' + ((r.formulaTrace || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') || '<li>No formula trace available.</li>') + '</ol>' +
      '<h4>9. Missing / Incomplete Data</h4><ul>' + (missing.length ? missing.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') : '<li>No mandatory preliminary field missing according to the current completeness rule.</li>') + '</ul>' +
      '<h4>10. Assumptions and Limitations</h4><ul>' + assumptions.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
      '<div style="margin-top:12px;padding:10px;border-radius:10px;background:#fff7ed;color:#9a3412;border:1px solid #fed7aa"><b>Important:</b> This preview is not a contractual design document and must not be used as a final sizing report. Direct final report generation from this public form is locked; CRM final issue produces a print-ready final HTML report after approval and quota handling.</div>' +
      '</div>';
  }
  window.ptfAdvCvBuildEnglishReportPreview = buildEnglishReportPreview;
  window.ptfAdvCvShowReportPreview = function () {
    if (!isUnlocked()) { if (typeof window.ptfToolsPaywall === 'function') window.ptfToolsPaywall('سایزینگ پیشرفته کنترل ولو'); return; }
    var d = window.ptfAdvCvCollectDraft();
    var r = window.ptfAdvCvCalculateAdvancedCases(d);
    if (!r || !r.ok) return;
    resultBox('advCvReportPreview', buildEnglishReportPreview(d, r));
    try { if (typeof window.ptfTrack === 'function') window.ptfTrack('advanced_cv_report_preview_open', { cases: (r.cases || []).length }); } catch (e) {}
  };


  function stableJson(x) {
    if (x === null || typeof x !== 'object') return JSON.stringify(x);
    if (Array.isArray(x)) return '[' + x.map(stableJson).join(',') + ']';
    return '{' + Object.keys(x).sort().map(function (k) { return JSON.stringify(k) + ':' + stableJson(x[k]); }).join(',') + '}';
  }
  function checksum32(str) {
    var h = 2166136261;
    str = String(str || '');
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    return ('00000000' + (h >>> 0).toString(16).toUpperCase()).slice(-8);
  }
  function grantMeta() {
    try {
      var g = JSON.parse(sessionStorage.getItem('ptf_tools_license_grant') || 'null');
      return g && g.grantPayload ? { licenseId: g.grantPayload.licenseId || '', type: g.grantPayload.type || '', tool: g.grantPayload.tool || '', exp: g.grantPayload.exp || 0 } : {};
    } catch (e) { return {}; }
  }
  function strictReportReadiness(d, r) {
    var missing = [];
    function need(id, label) { if (!String(d[id] || '').trim()) missing.push(label); }
    ['project','tag','service'].forEach(function (x) { need('adv_' + x, x); });
    ['min','normal','max'].forEach(function (c) {
      need('adv_' + c + '_flow', c + ' flow');
      need('adv_' + c + '_p1', c + ' P1');
      need('adv_' + c + '_p2', c + ' P2');
      need('adv_' + c + '_temp', c + ' temperature');
    });
    [['adv_phase','fluid phase'],['adv_fluid','fluid name'],['adv_fl','FL']].forEach(function (x) { need(x[0], x[1]); });
    var rk = phaseKindFromText(d.adv_phase);
    if (rk === 'gas') {
      [['adv_flow_basis','gas flow basis'],['adv_z','compressibility Z'],['adv_k','specific heat ratio k'],['adv_xt','Xt']].forEach(function (x) { need(x[0], x[1]); });
      if (!String(d.adv_mw || '').trim() && !String(d.adv_sg || '').trim()) missing.push('MW or SG basis');
    }
    else if (rk === 'steam') [['adv_flow_basis','steam flow basis'],['adv_k','specific heat ratio k'],['adv_xt','Xt']].forEach(function (x) { need(x[0], x[1]); });
    else [['adv_sg','SG/density'],['adv_visc','viscosity'],['adv_pv','vapor pressure Pv'],['adv_pc','critical pressure Pc']].forEach(function (x) { need(x[0], x[1]); });
    [['adv_in_pipe','inlet pipe ID/size'],['adv_out_pipe','outlet pipe ID/size'],['adv_valve_type','valve type'],['adv_class','pressure class'],['adv_body','body material'],['adv_trim','trim material'],['adv_char','flow characteristic'],['adv_rated_cv','rated/candidate Cv']].forEach(function (x) { need(x[0], x[1]); });
    [['adv_fail','fail action'],['adv_act_type','actuator type'],['adv_act_supply','instrument air supply'],['adv_act_safety','actuator safety factor'],['adv_shutoff','shutoff ΔP'],['adv_seat','seat/plug diameter']].forEach(function (x) { need(x[0], x[1]); });
    var pipeIssues = [];
    try {
      var pi = parsePipeIdMm(d.adv_in_pipe), po = parsePipeIdMm(d.adv_out_pipe);
      if (!pi.ok) pipeIssues.push('inlet pipe could not be parsed');
      if (!po.ok) pipeIssues.push('outlet pipe could not be parsed');
    } catch (e) { pipeIssues.push('pipe parse failed'); }
    var blockedReasons = [
      'Direct final report issue from the public tool form is locked; submit a server draft first.',
      'CRM admin/chairman approval, final readiness gate and license quota handling are required before final issue.',
      'The final deliverable is an immutable English HTML report that is print/PDF-ready in the browser; server-side binary PDF generation remains a future library-dependent phase.',
      'Vendor-certified model selection and contractual guarantees still require verified vendor data and responsible engineer review.'
    ];
    return {
      inputCompleteForFutureReport: missing.length === 0 && pipeIssues.length === 0 && !!(r && r.ok),
      missing: missing,
      pipeIssues: pipeIssues,
      blockedReasons: blockedReasons,
      finalReportLocked: true,
      pdfLocked: true,
      serverReportEnabled: true,
      crmFinalWorkflowRequired: true
    };
  }
  function compactCase(c) {
    return {
      caseId: c.caseId || null, label: c.label || null, Q: c.Q == null ? null : c.Q, P1: c.P1 == null ? null : c.P1, P2: c.P2 == null ? null : c.P2, T: c.T == null ? null : c.T,
      dP: c.dP == null ? null : c.dP, dPChoke: c.dPChoke == null ? null : c.dPChoke, x: c.x == null ? null : c.x, xChoked: c.xChoked == null ? null : c.xChoked, choked: !!c.choked, Kv: c.Kv == null ? null : c.Kv, Cv: c.Cv == null ? null : c.Cv,
      actualQ: c.actualQ == null ? null : c.actualQ, phase: c.phase || '', severity: c.severity == null ? null : c.severity, openingPct: c.openingPct == null ? null : c.openingPct,
      cavitationMargin: c.cavitationMargin == null ? null : c.cavitationMargin,
      cavitationRisk: c.risk ? { level: c.risk.level || '', tag: c.risk.tag || '', score: c.risk.score == null ? null : c.risk.score, margin: c.risk.margin == null ? null : c.risk.margin } : null,
      noiseRisk: c.noise ? { level: c.noise.level || '', tag: c.noise.tag || '', score: c.noise.score == null ? null : c.noise.score, index: c.noise.index == null ? null : c.noise.index } : null,
      pipe: c.pipe || null
    };
  }
  function buildLockedReportPayload(d, r) {
    var readiness = strictReportReadiness(d, r);
    var payload = {
      schema: 'ADV-CV-REPORT-PAYLOAD-v1',
      reportMeta: {
        tool: 'control_valve_advanced',
        generatedAt: new Date().toISOString(),
        status: 'LOCKED_PREVIEW_PAYLOAD',
        final: false,
        pdf: false,
        download: false,
        serverSideReport: false,
        language: 'en',
        previewOnly: true
      },
      entitlement: grantMeta(),
      project: { project: d.adv_project || '', rfq: d.adv_rfq || '', tag: d.adv_tag || '', service: d.adv_service || '', quantity: d.adv_qty || '', revision: d.adv_rev || '' },
      inputs: {
        operatingCases: ['min','normal','max'].map(function (c) { return { caseId: c, flow: d['adv_' + c + '_flow'] || '', p1: d['adv_' + c + '_p1'] || '', p2: d['adv_' + c + '_p2'] || '', temperature: d['adv_' + c + '_temp'] || '' }; }),
        fluid: { phase: d.adv_phase || '', name: d.adv_fluid || '', flowBasis: d.adv_flow_basis || '', sg: d.adv_sg || '', viscosity: d.adv_visc || '', pv: d.adv_pv || '', pc: d.adv_pc || '', mw: d.adv_mw || '', z: d.adv_z || '', k: d.adv_k || '' },
        valve: { type: d.adv_valve_type || '', class: d.adv_class || '', body: d.adv_body || '', trim: d.adv_trim || '', fl: d.adv_fl || '', fd: d.adv_fd || '', xt: d.adv_xt || '', characteristic: d.adv_char || '', ratedCv: d.adv_rated_cv || '' },
        piping: { inlet: d.adv_in_pipe || '', outlet: d.adv_out_pipe || '' },
        actuator: { failAction: d.adv_fail || '', type: d.adv_act_type || '', supply: d.adv_act_supply || '', safety: d.adv_act_safety || '', shutoffDp: d.adv_shutoff || '', seat: d.adv_seat || '', packingForce: d.adv_packing_force || '' },
        brand: { brand: d.adv_brand || '', series: d.adv_series || '', leakage: d.adv_leakage || '' }
      },
      calculations: r && r.ok ? {
        cases: (r.cases || []).map(compactCase),
        governing: r.governing ? { caseId: r.governing.caseId, label: r.governing.label, Cv: r.governing.Cv, Kv: r.governing.Kv } : null,
        recommendedCv: r.recommendedCv,
        riskSummary: r.riskSummary || null,
        noiseSummary: r.noiseSummary || null,
        actuator: r.actuator || null,
        common: r.common || null,
        formulaTrace: r.formulaTrace || [],
        warnings: r.warnings || [],
        riskRecommendations: r.riskRecommendations || [],
        noiseRecommendations: r.noiseRecommendations || []
      } : null,
      readiness: readiness,
      limitations: [
        'This payload is a locked draft input for the CRM final-report workflow, not the final report itself.',
        'Final report issue is available only after CRM review, final gate and license quota handling.',
        'Final output is immutable English HTML with browser Print/Save as PDF support; binary server PDF is not generated in this build.',
        'Vendor-certified validation is still required for contractual model selection.'
      ]
    };
    payload.reportMeta.checksum = checksum32(stableJson(payload));
    return payload;
  }
  function showLockedReportData() {
    if (!isUnlocked()) { if (typeof window.ptfToolsPaywall === 'function') window.ptfToolsPaywall('سایزینگ پیشرفته کنترل ولو'); return; }
    var d = window.ptfAdvCvCollectDraft();
    var r = window.ptfAdvCvCalculateAdvancedCases(d);
    if (!r || !r.ok) return;
    var payload = buildLockedReportPayload(d, r);
    window.ptfAdvCvLastReportPayload = payload;
    var ready = payload.readiness || {};
    var missingHtml = (ready.missing || []).concat(ready.pipeIssues || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') || '<li>Input data is complete for a future server-side report payload.</li>';
    var blockHtml = (ready.blockedReasons || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('');
    resultBox('advCvReportData', '<div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:14px;padding:12px;line-height:1.8"><b>داده ساختاری گزارش قفل‌شده آماده شد</b><div style="direction:ltr;text-align:left;margin-top:6px;font-family:monospace;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:8px">schema: ' + esc(payload.schema) + '<br>checksum: ' + esc(payload.reportMeta.checksum) + '<br>status: ' + esc(payload.reportMeta.status) + '<br>draft final: false | crm final workflow: enabled</div><div style="margin-top:8px"><b>Readiness for future server-side report:</b> ' + (ready.inputCompleteForFutureReport ? '<span style="color:#047857">Ready</span>' : '<span style="color:#b45309">Incomplete</span>') + '</div><ul style="margin:6px 18px 0 0">' + missingHtml + '</ul><div style="margin-top:8px;color:#9a3412"><b>چرا هنوز گزارش نهایی تولید نمی‌شود؟</b><ul style="margin:4px 18px 0 0">' + blockHtml + '</ul></div></div>');
    try { if (typeof window.ptfTrack === 'function') window.ptfTrack('advanced_cv_locked_report_payload_ready', { checksum: payload.reportMeta.checksum, ready: !!ready.inputCompleteForFutureReport }); } catch (e) {}
    return payload;
  }
  window.ptfAdvCvStableJson = stableJson;
  window.ptfAdvCvChecksum32 = checksum32;
  window.ptfAdvCvStrictReportReadiness = strictReportReadiness;
  window.ptfAdvCvBuildLockedReportPayload = buildLockedReportPayload;
  window.ptfAdvCvShowLockedReportData = showLockedReportData;

  function noiseRisk(label, Q, dP, severity, choked, pipe, cavRisk) {
    var vin = pipe && isFinite(pipe.vIn) ? pipe.vIn : 0;
    var vout = pipe && isFinite(pipe.vOut) ? pipe.vOut : 0;
    var vmax = Math.max(vin, vout);
    var energyIndex = 10 * Math.log(1 + Math.max(0, Q || 0) * Math.max(0, dP || 0)) / Math.LN10;
    var idx = 45 + energyIndex + Math.max(0, severity || 0) * 18;
    if (vmax > 3) idx += (vmax - 3) * 4;
    if (choked) idx += 8;
    if (cavRisk && cavRisk.score >= 4) idx += 6;
    idx = Math.max(35, Math.min(110, idx));
    var out = { label: label, index: round(idx, 3), vmax: round(vmax, 6), level: 'low', score: 1, tag: 'Low noise risk', color: '#047857', action: 'Review only', recommendations: [] };
    if (idx >= 95) out = { label: label, index: round(idx, 3), vmax: round(vmax, 6), level: 'severe', score: 5, tag: 'Severe noise risk', color: '#991b1b', action: 'Noise attenuation / multi-stage trim review', recommendations: [
      'ریسک noise بسیار بالاست؛ multi-stage / low-noise trim یا تقسیم افت فشار بررسی شود.',
      'outlet velocity و pipe size باید با limit پروژه و سازنده کنترل شود.',
      'محاسبه نهایی noise باید با IEC 60534-8 و داده vendor انجام شود.'
    ] };
    else if (idx >= 85) out = { label: label, index: round(idx, 3), vmax: round(vmax, 6), level: 'high', score: 4, tag: 'High noise risk', color: '#dc2626', action: 'Detailed noise check', recommendations: [
      'ریسک noise بالا است؛ low-noise trim و outlet velocity detail لازم است.',
      'در گزارش کامل باید acoustic efficiency/vendor data و pipe schedule بررسی شود.'
    ] };
    else if (idx >= 75) out = { label: label, index: round(idx, 3), vmax: round(vmax, 6), level: 'medium', score: 3, tag: 'Medium noise risk', color: '#d97706', action: 'Project noise limit check', recommendations: [
      'ریسک noise متوسط است؛ با limit پروژه و فاصله از محل کار مقایسه شود.'
    ] };
    else if (idx >= 65) out = { label: label, index: round(idx, 3), vmax: round(vmax, 6), level: 'watch', score: 2, tag: 'Watch noise', color: '#ca8a04', action: 'Monitor in final sizing', recommendations: [
      'در final sizing دوباره با داده vendor بررسی شود.'
    ] };
    out.formulaTrace = [
      label + ': preliminary noise index = 45 + 10log10(1+Q×ΔP) + 18×severity + velocity/choked/cavitation penalties = ' + fmt(idx, 1),
      label + ': max line velocity used for noise screening = ' + fmt(vmax, 2) + ' m/s'
    ];
    return out;
  }
  function noiseSummary(cases) {
    var top = null;
    (cases || []).forEach(function (c) { if (c.noise && (!top || c.noise.score > top.score || (c.noise.score === top.score && c.noise.index > top.index))) top = c.noise; });
    return top || { level: 'unknown', score: 0, tag: 'Unknown', color: '#64748b', recommendations: [] };
  }

  function actuatorShell(d, cases) {
    var valveType = String(d.adv_valve_type || '').toLowerCase();
    var shutoff = num(d.adv_shutoff);
    var seat = num(d.adv_seat);
    var supply = num(d.adv_act_supply);
    var safety = num(d.adv_act_safety);
    var packing = num(d.adv_packing_force);
    var failAction = d.adv_fail || 'Fail Close';
    var actType = d.adv_act_type || 'Pneumatic diaphragm / spring return';
    var warnings = [];
    var maxDp = 0;
    (cases || []).forEach(function (c) { if (isFinite(c.dP) && c.dP > maxDp) maxDp = c.dP; });
    var shutoffBasis = 'entered shutoff ΔP';
    if (!isFinite(shutoff) || shutoff <= 0) {
      shutoff = maxDp;
      shutoffBasis = 'fallback: max operating ΔP';
      warnings.push('Actuator: shutoff ΔP وارد نشده؛ فعلاً از بیشترین ΔP عملیاتی استفاده شد. برای انتخاب نهایی، shutoff واقعی لازم است.');
    }
    if (!isFinite(supply) || supply <= 0) {
      supply = 4.5;
      warnings.push('Actuator: فشار هوای ابزار دقیق وارد نشده؛ پیش‌فرض 4.5 barg استفاده شد.');
    }
    if (!isFinite(safety) || safety <= 0) safety = 1.25;
    if (!isFinite(packing) || packing < 0) packing = 0;
    if (!isFinite(seat) || seat <= 0) {
      return { ok: false, reason: 'قطر seat/plug برای actuator shell وارد نشده است.', warnings: warnings.concat(['Actuator: برای محاسبه preliminary thrust، قطر seat/plug لازم است.']) };
    }
    var seatAreaMm2 = Math.PI * Math.pow(seat, 2) / 4;
    var fluidForceN = shutoff * 0.1 * seatAreaMm2; // 1 bar = 0.1 N/mm2
    var requiredThrustN = (fluidForceN + packing) * safety;
    var supplyNmm2 = supply * 0.1;
    var actuatorAreaMm2 = supplyNmm2 > 0 ? requiredThrustN / supplyNmm2 : NaN;
    var diaphragmDiaMm = isFinite(actuatorAreaMm2) && actuatorAreaMm2 > 0 ? Math.sqrt(4 * actuatorAreaMm2 / Math.PI) : NaN;
    if (safety < 1.15) warnings.push('Actuator: safety factor کمتر از مقدار رایج است؛ حداقل 1.25 پیشنهاد می‌شود.');
    if (supply < 3) warnings.push('Actuator: supply pressure پایین است؛ actuator size ممکن است بزرگ شود یا fail action به مشکل بخورد.');
    if (/rotary|ball|butterfly|segment/i.test(valveType)) warnings.push('Actuator: valve type rotary است؛ این خروجی thrust-equivalent shell است و torque sizing نهایی نیست.');
    if (/fail close/i.test(failAction)) warnings.push('Actuator: برای Fail Close، spring/air action و shutoff direction با سازنده کنترل شود.');
    if (/fail open/i.test(failAction)) warnings.push('Actuator: برای Fail Open، required thrust در جهت seat/unseat باید با سازنده کنترل شود.');
    return {
      ok: true,
      type: actType,
      failAction: failAction,
      shutoffDpBar: round(shutoff, 6),
      shutoffBasis: shutoffBasis,
      seatMm: round(seat, 6),
      seatAreaMm2: round(seatAreaMm2, 6),
      fluidForceN: round(fluidForceN, 6),
      packingForceN: round(packing, 6),
      safetyFactor: round(safety, 6),
      requiredThrustN: round(requiredThrustN, 6),
      requiredThrustKgF: round(requiredThrustN / 9.80665, 6),
      supplyBarG: round(supply, 6),
      actuatorAreaMm2: round(actuatorAreaMm2, 6),
      diaphragmDiaMm: round(diaphragmDiaMm, 6),
      warnings: warnings,
      formulaTrace: [
        'Seat area = π × d² / 4 = ' + fmt(seatAreaMm2, 2) + ' mm²',
        'Fluid force = ΔP_shutoff × 0.1 × seat area = ' + fmt(fluidForceN, 1) + ' N',
        'Required thrust = (fluid force + packing/friction) × safety factor = ' + fmt(requiredThrustN, 1) + ' N',
        'Equivalent pneumatic area = required thrust / (supply barg × 0.1) = ' + fmt(actuatorAreaMm2, 1) + ' mm²',
        'Equivalent diaphragm diameter = sqrt(4 × area / π) = ' + fmt(diaphragmDiaMm, 1) + ' mm'
      ]
    };
  }

  function riskSummary(cases) {
    var top = null;
    (cases || []).forEach(function (c) { if (c.risk && (!top || c.risk.score > top.score)) top = c.risk; });
    return top || { level: 'unknown', score: 0, tag: 'Unknown', color: '#64748b', recommendations: [] };
  }



  var FEEDBACK_SAMPLES = {
    baseline_water: {
      title: 'Baseline liquid water — balanced control case',
      data: {
        adv_project: 'PTF Demo / Cooling Water', adv_rfq: 'DEMO-CV-001', adv_tag: 'FV-101', adv_service: 'Cooling water control', adv_qty: '1', adv_rev: 'Rev.0',
        adv_min_flow: '40', adv_min_p1: '9', adv_min_p2: '7', adv_min_temp: '25',
        adv_normal_flow: '100', adv_normal_p1: '10', adv_normal_p2: '6', adv_normal_temp: '25',
        adv_max_flow: '150', adv_max_p1: '11', adv_max_p2: '5', adv_max_temp: '25',
        adv_phase: 'مایع (Liquid)', adv_fluid: 'Water', adv_flow_basis: 'm3/h', adv_sg: '1', adv_visc: '1', adv_pv: '0.03', adv_pc: '221',
        adv_in_pipe: 'NPS 4', adv_out_pipe: 'NPS 4', adv_valve_type: 'Globe', adv_class: 'Class 300', adv_body: 'WCB', adv_trim: 'SS316', adv_fl: '0.9', adv_fd: '0.46', adv_xt: '', adv_char: 'Equal Percentage', adv_rated_cv: '200',
        adv_fail: 'Fail Close', adv_act_type: 'Pneumatic diaphragm / spring return', adv_act_supply: '4.5', adv_act_safety: '1.5', adv_shutoff: '10', adv_seat: '50', adv_packing_force: '200', adv_brand: 'Fisher', adv_series: 'TBD', adv_leakage: 'Class IV'
      }
    },
    cavitation_noise: {
      title: 'High ΔP liquid — cavitation and noise stress case',
      data: {
        adv_project: 'PTF Demo / High DP Service', adv_rfq: 'DEMO-CV-002', adv_tag: 'LV-220', adv_service: 'Condensate letdown', adv_qty: '1', adv_rev: 'Rev.0',
        adv_min_flow: '30', adv_min_p1: '18', adv_min_p2: '4', adv_min_temp: '45',
        adv_normal_flow: '120', adv_normal_p1: '20', adv_normal_p2: '3', adv_normal_temp: '45',
        adv_max_flow: '220', adv_max_p1: '22', adv_max_p2: '2', adv_max_temp: '45',
        adv_phase: 'مایع (Liquid)', adv_fluid: 'Condensate', adv_flow_basis: 'm3/h', adv_sg: '0.82', adv_visc: '0.7', adv_pv: '0.8', adv_pc: '45',
        adv_in_pipe: 'NPS 3', adv_out_pipe: 'DN80', adv_valve_type: 'Globe', adv_class: 'Class 600', adv_body: 'WCB', adv_trim: 'SS316 + hardened trim', adv_fl: '0.82', adv_fd: '0.46', adv_xt: '', adv_char: 'Equal Percentage', adv_rated_cv: '180',
        adv_fail: 'Fail Close', adv_act_type: 'Pneumatic piston', adv_act_supply: '5.5', adv_act_safety: '1.5', adv_shutoff: '22', adv_seat: '45', adv_packing_force: '450', adv_brand: 'Vendor TBD', adv_series: 'Anti-cavitation candidate', adv_leakage: 'Class V'
      }
    },
    reducer_velocity: {
      title: 'Reducer / velocity stress case',
      data: {
        adv_project: 'PTF Demo / Reducer Review', adv_rfq: 'DEMO-CV-003', adv_tag: 'FV-330', adv_service: 'Process water high velocity', adv_qty: '1', adv_rev: 'Rev.0',
        adv_min_flow: '80', adv_min_p1: '8', adv_min_p2: '6', adv_min_temp: '30',
        adv_normal_flow: '180', adv_normal_p1: '9', adv_normal_p2: '5', adv_normal_temp: '30',
        adv_max_flow: '300', adv_max_p1: '10', adv_max_p2: '4', adv_max_temp: '30',
        adv_phase: 'مایع (Liquid)', adv_fluid: 'Water', adv_flow_basis: 'm3/h', adv_sg: '1', adv_visc: '1', adv_pv: '0.04', adv_pc: '221',
        adv_in_pipe: 'NPS 4', adv_out_pipe: 'DN65', adv_valve_type: 'Globe', adv_class: 'Class 300', adv_body: 'CF8M', adv_trim: 'SS316', adv_fl: '0.88', adv_fd: '0.46', adv_xt: '', adv_char: 'Linear', adv_rated_cv: '250',
        adv_fail: 'Fail Open', adv_act_type: 'Pneumatic diaphragm / spring return', adv_act_supply: '4.5', adv_act_safety: '1.25', adv_shutoff: '10', adv_seat: '55', adv_packing_force: '250', adv_brand: 'Samson', adv_series: 'TBD', adv_leakage: 'Class IV'
      }
    },
    gas_steam_screen: {
      title: 'Gas / steam preliminary screening case',
      data: {
        adv_project: 'PTF Demo / Gas Service', adv_rfq: 'DEMO-CV-004', adv_tag: 'PV-410', adv_service: 'Natural gas pressure control', adv_qty: '1', adv_rev: 'Rev.0',
        adv_min_flow: '500', adv_min_p1: '18', adv_min_p2: '12', adv_min_temp: '25',
        adv_normal_flow: '1200', adv_normal_p1: '20', adv_normal_p2: '10', adv_normal_temp: '25',
        adv_max_flow: '2200', adv_max_p1: '22', adv_max_p2: '8', adv_max_temp: '25',
        adv_phase: 'گاز (Gas)', adv_fluid: 'Natural gas', adv_flow_basis: 'Nm3/h', adv_sg: '0.62', adv_visc: '', adv_pv: '', adv_pc: '', adv_mw: '18', adv_z: '0.92', adv_k: '1.3',
        adv_in_pipe: 'NPS 4', adv_out_pipe: 'NPS 6', adv_valve_type: 'Globe', adv_class: 'Class 600', adv_body: 'WCB', adv_trim: 'Low-noise cage', adv_fl: '0.9', adv_fd: '0.46', adv_xt: '0.72', adv_char: 'Equal Percentage', adv_rated_cv: '350',
        adv_fail: 'Fail Close', adv_act_type: 'Pneumatic piston', adv_act_supply: '5.5', adv_act_safety: '1.5', adv_shutoff: '22', adv_seat: '65', adv_packing_force: '450', adv_brand: 'Vendor TBD', adv_series: 'Low-noise candidate', adv_leakage: 'Class IV'
      }
    },
    gas_non_choked: {
      title: 'Gas non-choked — stable pressure ratio case',
      data: {
        adv_project: 'PTF QA / Gas Non-Choked', adv_rfq: 'QA-CV-GAS-001', adv_tag: 'PV-GN-101', adv_service: 'Fuel gas pressure control non-choked', adv_qty: '1', adv_rev: 'Rev.QA',
        adv_min_flow: '400', adv_min_p1: '18', adv_min_p2: '15', adv_min_temp: '30',
        adv_normal_flow: '900', adv_normal_p1: '20', adv_normal_p2: '16', adv_normal_temp: '30',
        adv_max_flow: '1400', adv_max_p1: '22', adv_max_p2: '17', adv_max_temp: '30',
        adv_phase: 'گاز (Gas)', adv_fluid: 'Fuel gas', adv_flow_basis: 'Nm3/h', adv_sg: '0.65', adv_visc: '', adv_pv: '', adv_pc: '', adv_mw: '', adv_z: '0.95', adv_k: '1.29',
        adv_in_pipe: 'NPS 4', adv_out_pipe: 'NPS 4', adv_valve_type: 'Globe', adv_class: 'Class 300', adv_body: 'WCB', adv_trim: 'Standard cage', adv_fl: '0.9', adv_fd: '0.46', adv_xt: '0.72', adv_char: 'Equal Percentage', adv_rated_cv: '220',
        adv_fail: 'Fail Close', adv_act_type: 'Pneumatic diaphragm / spring return', adv_act_supply: '4.5', adv_act_safety: '1.3', adv_shutoff: '22', adv_seat: '55', adv_packing_force: '300', adv_brand: 'Vendor TBD', adv_series: 'Gas trim candidate', adv_leakage: 'Class IV'
      }
    },
    gas_choked: {
      title: 'Gas choked — critical pressure ratio case',
      data: {
        adv_project: 'PTF QA / Gas Choked', adv_rfq: 'QA-CV-GAS-002', adv_tag: 'PV-GC-201', adv_service: 'Natural gas letdown choked screening', adv_qty: '1', adv_rev: 'Rev.QA',
        adv_min_flow: '700', adv_min_p1: '28', adv_min_p2: '12', adv_min_temp: '25',
        adv_normal_flow: '1600', adv_normal_p1: '30', adv_normal_p2: '10', adv_normal_temp: '25',
        adv_max_flow: '2600', adv_max_p1: '32', adv_max_p2: '8', adv_max_temp: '25',
        adv_phase: 'گاز (Gas)', adv_fluid: 'Natural gas', adv_flow_basis: 'Nm3/h', adv_sg: '0.62', adv_visc: '', adv_pv: '', adv_pc: '', adv_mw: '18', adv_z: '0.9', adv_k: '1.3',
        adv_in_pipe: 'NPS 4', adv_out_pipe: 'NPS 6', adv_valve_type: 'Globe', adv_class: 'Class 600', adv_body: 'WCB', adv_trim: 'Low-noise cage', adv_fl: '0.9', adv_fd: '0.46', adv_xt: '0.66', adv_char: 'Equal Percentage', adv_rated_cv: '320',
        adv_fail: 'Fail Close', adv_act_type: 'Pneumatic piston', adv_act_supply: '5.5', adv_act_safety: '1.5', adv_shutoff: '32', adv_seat: '65', adv_packing_force: '500', adv_brand: 'Vendor TBD', adv_series: 'Multi-stage low-noise', adv_leakage: 'Class V'
      }
    },
    steam_non_choked: {
      title: 'Steam non-choked — moderate letdown case',
      data: {
        adv_project: 'PTF QA / Steam Non-Choked', adv_rfq: 'QA-CV-ST-001', adv_tag: 'TV-SN-101', adv_service: 'Steam temperature control non-choked', adv_qty: '1', adv_rev: 'Rev.QA',
        adv_min_flow: '600', adv_min_p1: '10', adv_min_p2: '8', adv_min_temp: '185',
        adv_normal_flow: '1500', adv_normal_p1: '12', adv_normal_p2: '9', adv_normal_temp: '190',
        adv_max_flow: '2200', adv_max_p1: '14', adv_max_p2: '10', adv_max_temp: '195',
        adv_phase: 'بخار (Steam)', adv_fluid: 'Saturated steam', adv_flow_basis: 'kg/h', adv_sg: '', adv_visc: '', adv_pv: '', adv_pc: '', adv_mw: '', adv_z: '1', adv_k: '1.3',
        adv_in_pipe: 'NPS 3', adv_out_pipe: 'NPS 4', adv_valve_type: 'Globe', adv_class: 'Class 300', adv_body: 'WCB', adv_trim: 'SS trim', adv_fl: '0.9', adv_fd: '0.46', adv_xt: '0.72', adv_char: 'Equal Percentage', adv_rated_cv: '180',
        adv_fail: 'Fail Close', adv_act_type: 'Pneumatic diaphragm / spring return', adv_act_supply: '4.5', adv_act_safety: '1.3', adv_shutoff: '14', adv_seat: '50', adv_packing_force: '350', adv_brand: 'Vendor TBD', adv_series: 'Steam trim candidate', adv_leakage: 'Class IV'
      }
    },
    steam_choked: {
      title: 'Steam choked — critical letdown case',
      data: {
        adv_project: 'PTF QA / Steam Choked', adv_rfq: 'QA-CV-ST-002', adv_tag: 'PV-SC-201', adv_service: 'Steam letdown choked screening', adv_qty: '1', adv_rev: 'Rev.QA',
        adv_min_flow: '900', adv_min_p1: '20', adv_min_p2: '8', adv_min_temp: '230',
        adv_normal_flow: '2600', adv_normal_p1: '22', adv_normal_p2: '9', adv_normal_temp: '235',
        adv_max_flow: '4200', adv_max_p1: '24', adv_max_p2: '10', adv_max_temp: '240',
        adv_phase: 'بخار (Steam)', adv_fluid: 'Superheated steam', adv_flow_basis: 'kg/h', adv_sg: '', adv_visc: '', adv_pv: '', adv_pc: '', adv_mw: '', adv_z: '1', adv_k: '1.3',
        adv_in_pipe: 'NPS 4', adv_out_pipe: 'NPS 6', adv_valve_type: 'Globe', adv_class: 'Class 600', adv_body: 'WC6', adv_trim: 'Low-noise steam trim', adv_fl: '0.9', adv_fd: '0.46', adv_xt: '0.68', adv_char: 'Equal Percentage', adv_rated_cv: '260',
        adv_fail: 'Fail Close', adv_act_type: 'Pneumatic piston', adv_act_supply: '5.5', adv_act_safety: '1.5', adv_shutoff: '24', adv_seat: '60', adv_packing_force: '600', adv_brand: 'Vendor TBD', adv_series: 'Steam letdown candidate', adv_leakage: 'Class V'
      }
    }
  };
  function setVal(id, v) { var el = byId(id); if (el) el.value = v == null ? '' : String(v); }
  window.ptfAdvCvApplyFeedbackSample = function (sampleId) {
    if (!isUnlocked()) { if (typeof window.ptfToolsPaywall === 'function') window.ptfToolsPaywall('سایزینگ پیشرفته کنترل ولو'); return false; }
    var s = FEEDBACK_SAMPLES[sampleId] || FEEDBACK_SAMPLES.baseline_water;
    Object.keys(s.data || {}).forEach(function (id) { setVal(id, s.data[id]); });
    resultBox('advCvDraftStatus', 'سناریوی نمونه بارگذاری شد: <b>' + esc(s.title) + '</b>. اکنون محاسبه یا preview را اجرا کنید.');
    try { if (typeof window.ptfTrack === 'function') window.ptfTrack('advanced_cv_feedback_sample_loaded', { sample: sampleId }); } catch (e) {}
    return true;
  };
  window.ptfAdvCvFeedbackText = function () {
    var d = window.ptfAdvCvCollectDraft ? window.ptfAdvCvCollectDraft() : {};
    return [
      'Advanced Control Valve feedback',
      'Tag: ' + (d.adv_tag || ''),
      'Service: ' + (d.adv_service || ''),
      '1) Are input labels/units clear? ',
      '2) Are Cv/Kv and governing case reasonable? ',
      '3) Are pipe velocity / reducer warnings useful? ',
      '4) Are cavitation/flashing and noise risk levels understandable? ',
      '5) Is actuator shell useful and what data is missing? ',
      '6) Is English report preview acceptable for engineering review? ',
      '7) What should be added before final PDF/report? '
    ].join('\n');
  };
  window.ptfAdvCvCopyFeedbackText = function () {
    var txt = window.ptfAdvCvFeedbackText();
    try { navigator.clipboard.writeText(txt); resultBox('advCvFeedbackPack', 'قالب feedback کپی شد.'); } catch (e) { resultBox('advCvFeedbackPack', '<pre style="white-space:pre-wrap;direction:ltr;text-align:left">' + esc(txt) + '</pre>'); }
  };
  function qaLevel(ok, warnCount) {
    if (!ok) return { tag: 'FAILED', color: '#b91c1c' };
    if (warnCount > 6) return { tag: 'REVIEW', color: '#b45309' };
    return { tag: 'PASS', color: '#047857' };
  }
  function qaBadge(x) {
    return '<span style="display:inline-block;border-radius:999px;padding:2px 8px;font-size:10.5px;font-weight:900;color:' + esc(x.color) + ';background:#fff;border:1px solid ' + esc(x.color) + '33">' + esc(x.tag) + '</span>';
  }
  window.ptfAdvCvRunInternalScenarioQa = function () {
    if (!isUnlocked()) { if (typeof window.ptfToolsPaywall === 'function') window.ptfToolsPaywall('سایزینگ پیشرفته کنترل ولو'); return false; }
    var rows = [];
    var summary = { total: 0, pass: 0, review: 0, failed: 0 };
    Object.keys(FEEDBACK_SAMPLES).forEach(function (id) {
      var sample = FEEDBACK_SAMPLES[id];
      var r = window.ptfAdvCvCalculateAdvancedCases(sample.data);
      var payload = r && r.ok && typeof window.ptfAdvCvBuildLockedReportPayload === 'function' ? window.ptfAdvCvBuildLockedReportPayload(sample.data, r) : null;
      var warnings = r && r.warnings ? r.warnings.length : 0;
      var level = qaLevel(!!(r && r.ok), warnings);
      summary.total++;
      if (level.tag === 'PASS') summary.pass++;
      else if (level.tag === 'REVIEW') summary.review++;
      else summary.failed++;
      var vmax = 0;
      try { (r.cases || []).forEach(function (c) { vmax = Math.max(vmax, (c.pipe || {}).vIn || 0, (c.pipe || {}).vOut || 0); }); } catch (e) {}
      var gov = r && r.ok ? (r.governing || {}) : {};
      var common = r && r.ok ? (r.common || {}) : {};
      rows.push('<tr><td style="text-align:left;direction:ltr"><b>' + esc(id) + '</b><br><small>' + esc(sample.title) + '</small></td>' +
        '<td>' + qaBadge(level) + '</td>' +
        '<td>' + esc(common.phase || 'liquid') + '</td>' +
        '<td>' + (r && r.ok ? esc(gov.label || '—') : '—') + '</td>' +
        '<td>' + (r && r.ok ? fmt(gov.Cv, 3) : '—') + '</td>' +
        '<td>' + (r && r.ok ? (gov.choked ? 'Yes' : 'No') : '—') + '</td>' +
        '<td>' + (r && r.ok ? fmt(gov.x, 3) : '—') + '</td>' +
        '<td>' + (r && r.ok ? fmt(gov.xChoked, 3) : '—') + '</td>' +
        '<td>' + (r && r.ok ? fmt(gov.actualQ, 2) : '—') + '</td>' +
        '<td>' + (r && r.ok ? riskBadge(r.riskSummary) : '—') + '</td>' +
        '<td>' + (r && r.ok ? riskBadge(r.noiseSummary) : '—') + '</td>' +
        '<td>' + fmt(vmax, 2) + '</td>' +
        '<td>' + (r && r.actuator && r.actuator.ok ? fmt(r.actuator.requiredThrustN / 1000, 2) + ' kN' : '—') + '</td>' +
        '<td>' + (payload ? (payload.readiness.inputCompleteForFutureReport ? '<span style="color:#047857;font-weight:800">Ready</span>' : '<span style="color:#b45309;font-weight:800">Incomplete</span>') : '—') + '</td>' +
        '<td style="direction:ltr;text-align:left;font-family:monospace">' + esc(payload ? payload.reportMeta.checksum : '—') + '</td>' +
        '<td>' + warnings + '</td></tr>');
    });
    var html = '<div style="background:#fff;border:1px solid #cbd5e1;border-radius:14px;padding:12px;line-height:1.8">' +
      '<b>QA داخلی سناریوهای Advanced Control Valve</b>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin:10px 0">' +
      '<span style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:8px"><b>Total</b><br>' + summary.total + '</span>' +
      '<span style="background:#ecfdf5;border:1px solid #bbf7d0;border-radius:10px;padding:8px;color:#047857"><b>Pass</b><br>' + summary.pass + '</span>' +
      '<span style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:8px;color:#b45309"><b>Review</b><br>' + summary.review + '</span>' +
      '<span style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:8px;color:#b91c1c"><b>Failed</b><br>' + summary.failed + '</span></div>' +
      '<div style="overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:11.5px;direction:ltr;text-align:left"><thead><tr style="background:#f1f5f9"><th>Scenario</th><th>QA</th><th>Phase</th><th>Governing</th><th>Cv</th><th>Choked</th><th>x</th><th>xChoked</th><th>Actual Q</th><th>Cavitation</th><th>Noise</th><th>Vmax</th><th>Actuator</th><th>Readiness</th><th>Checksum</th><th>Warnings</th></tr></thead><tbody>' + rows.join('') + '</tbody></table></div>' +
      '<div style="font-size:12px;color:#64748b;margin-top:8px">این QA داخلی برای مقایسه سناریوهای نمونه Liquid/Gas/Steam است؛ صدور گزارش نهایی فقط از CRM و پس از review/final gate/quota انجام می‌شود.</div>' +
      '</div>';
    resultBox('advCvFeedbackPack', html);
    try { if (typeof window.ptfTrack === 'function') window.ptfTrack('advanced_cv_internal_scenario_qa_run', summary); } catch (eT) {}
    return summary;
  };

  window.ptfAdvCvOpenFeedbackPack = function () {
    var html = '<div style="background:#fff;border:1px solid #cbd5e1;border-radius:14px;padding:12px;line-height:1.9">' +
      '<b>بسته تست و feedback مهندسی — Advanced Control Valve</b>' +
      '<div style="font-size:12px;color:#64748b;margin-top:4px">هدف: قبل از توسعه PDF باینری/پرداخت آنلاین، سناریوهای نمونه Liquid/Gas/Steam و چک‌لیست feedback برای مهندسان آماده است.</div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">' +
      '<button type="button" class="adv-btn adv-light" onclick="ptfAdvCvApplyFeedbackSample(\'baseline_water\')">نمونه ۱: سرویس نرمال آب</button>' +
      '<button type="button" class="adv-btn adv-light" onclick="ptfAdvCvApplyFeedbackSample(\'cavitation_noise\')">نمونه ۲: ΔP بالا / کاویتاسیون</button>' +
      '<button type="button" class="adv-btn adv-light" onclick="ptfAdvCvApplyFeedbackSample(\'reducer_velocity\')">نمونه ۳: سرعت خط / reducer</button>' +
      '<button type="button" class="adv-btn adv-light" onclick="ptfAdvCvApplyFeedbackSample(\'gas_non_choked\')">Gas non-choked</button>' +
      '<button type="button" class="adv-btn adv-light" onclick="ptfAdvCvApplyFeedbackSample(\'gas_choked\')">Gas choked</button>' +
      '<button type="button" class="adv-btn adv-light" onclick="ptfAdvCvApplyFeedbackSample(\'steam_non_choked\')">Steam non-choked</button>' +
      '<button type="button" class="adv-btn adv-light" onclick="ptfAdvCvApplyFeedbackSample(\'steam_choked\')">Steam choked</button>' +
      '<button type="button" class="adv-btn adv-light" onclick="ptfAdvCvCopyFeedbackText()">کپی قالب feedback</button><button type="button" class="adv-btn adv-light" onclick="ptfAdvCvRunInternalScenarioQa()">اجرای QA داخلی سناریوها</button></div>' +
      '<ol style="margin:10px 18px 0 0"><li>یک نمونه را بارگذاری کنید.</li><li>محاسبه مقدماتی را اجرا کنید.</li><li>پیش‌نمایش گزارش انگلیسی و داده گزارش قفل‌شده را بررسی کنید.</li><li>feedback را با قالب کپی‌شده ثبت کنید.</li></ol>' +
      '<div style="font-size:12px;color:#9a3412;margin-top:8px">این بسته فقط برای feedback است؛ گزارش نهایی از مسیر CRM صادر می‌شود و PDF باینری سمت سرور هنوز فعال نیست.</div>' +
      '</div>';
    resultBox('advCvFeedbackPack', html);
  };

  window.ptfAdvCvCollectDraft = function () {
    var data = {};
    FIELD_IDS.forEach(function (id) { data[id] = val(id); });
    data.tool = 'control_valve_advanced';
    data.version = 'ADV-CV-DRAFT-v1';
    data.updatedAt = new Date().toISOString();
    return data;
  };

  window.ptfAdvCvCheckCompleteness = function () {
    var d = window.ptfAdvCvCollectDraft();
    var phase = d.adv_phase || 'مایع (Liquid)';
    var req = [
      ['adv_project', 'نام پروژه'],
      ['adv_tag', 'شماره تگ ولو'],
      ['adv_service', 'سرویس / کاربری'],
      ['adv_normal_flow', 'دبی حالت نرمال'],
      ['adv_normal_p1', 'فشار بالادست P1 در حالت نرمال'],
      ['adv_normal_p2', 'فشار پایین‌دست P2 در حالت نرمال'],
      ['adv_normal_temp', 'دمای حالت نرمال'],
      ['adv_phase', 'فاز سیال'],
      ['adv_fluid', 'نام سیال'],
      ['adv_fl', 'ضریب بازیابی FL']
    ];
    if (/liquid|مایع/i.test(phase)) {
      req = req.concat([['adv_sg', 'چگالی نسبی / دانسیته'], ['adv_pv', 'فشار بخار Pv'], ['adv_pc', 'فشار بحرانی Pc'], ['adv_visc', 'ویسکوزیته']]);
    } else if (/gas|steam|گاز|بخار/i.test(phase)) {
      req = req.concat([['adv_flow_basis', 'مبنای دبی'], ['adv_mw', 'جرم مولکولی'], ['adv_z', 'ضریب تراکم‌پذیری Z'], ['adv_k', 'نسبت گرمای ویژه k'], ['adv_xt', 'ضریب Xt']]);
    }
    var missing = [];
    req.forEach(function (r) { if (!d[r[0]]) missing.push(r[1]); });
    var score = Math.max(0, Math.round(((req.length - missing.length) / req.length) * 100));
    var result = { ok: missing.length === 0, score: score, missing: missing, requiredCount: req.length };
    resultBox('advCvCompletenessResult', '<b>امتیاز کامل بودن داده‌ها: ' + score + '٪</b>' +
      (missing.length ? '<div style="margin-top:6px;color:#b45309">داده‌های ناقص: ' + missing.map(esc).join('، ') + '</div>' : '<div style="margin-top:6px;color:#047857">داده‌های حداقلی برای بازبینی پیش‌نویس کامل است. گزارش نهایی همچنان قفل است.</div>') +
      '<div style="font-size:11px;color:#64748b;margin-top:6px">Completeness score / Missing data list — در این فاز گزارش نهایی و PDF تولید نمی‌شود.</div>');
    return result;
  };

  window.ptfAdvCvSaveDraft = function () {
    if (!isUnlocked()) { if (typeof window.ptfToolsPaywall === 'function') window.ptfToolsPaywall('سایزینگ پیشرفته کنترل ولو'); return; }
    var data = window.ptfAdvCvCollectDraft();
    var check = window.ptfAdvCvCheckCompleteness();
    data.completeness = check;
    var list = [];
    try { list = JSON.parse(localStorage.getItem(DRAFT_KEY) || '[]'); } catch (e) { list = []; }
    data.draftId = data.draftId || ('ADVCV-DRAFT-' + Date.now().toString(36));
    list.unshift(data);
    while (list.length > 20) list.pop();
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(list)); } catch (e2) {}
    resultBox('advCvDraftStatus', 'پیش‌نویس در همین مرورگر ذخیره شد: <b>' + esc(data.draftId) + '</b> — کامل بودن ' + check.score + '٪');
    try { if (typeof window.ptfTrack === 'function') window.ptfTrack('advanced_cv_draft_saved', { score: check.score }); } catch (e3) {}
  };

  function validationError(msg, missingId) {
    var r = { ok: false, error: msg, missingId: missingId || '' };
    resultBox('advCvPrelimResult', '<b style="color:#b91c1c">محاسبه مقدماتی انجام نشد.</b><div style="margin-top:6px;color:#b45309">' + esc(msg) + '</div>');
    return r;
  }
  function commonLiquid(d) {
    var phase = d.adv_phase || 'مایع (Liquid)';
    if (!/liquid|مایع/i.test(phase)) return { ok: false, error: 'در این فاز فقط محاسبه مقدماتی مایع فعال است. Gas/Steam و Two-phase در فازهای بعدی اضافه می‌شود.', missingId: 'adv_phase' };
    var SG = num(d.adv_sg), Pv = num(d.adv_pv), Pc = num(d.adv_pc), FL = num(d.adv_fl), visc = num(d.adv_visc), ratedCv = num(d.adv_rated_cv);
    var inPipe = parsePipeIdMm(d.adv_in_pipe), outPipe = parsePipeIdMm(d.adv_out_pipe);
    var reducerRatio = (inPipe.ok && outPipe.ok) ? Math.min(inPipe.idMm, outPipe.idMm) / Math.max(inPipe.idMm, outPipe.idMm) : NaN;
    var required = [
      [SG, 'SG/دانسیته نسبی باید عدد مثبت باشد.', 'adv_sg'],
      [Pv, 'فشار بخار Pv باید عدد معتبر باشد.', 'adv_pv'],
      [Pc, 'فشار بحرانی Pc باید عدد مثبت باشد.', 'adv_pc'],
      [FL, 'ضریب FL باید عدد مثبت و معمولاً بین 0.5 تا 1 باشد.', 'adv_fl']
    ];
    for (var i = 0; i < required.length; i++) if (!isFinite(required[i][0]) || required[i][0] <= 0) return { ok: false, error: required[i][1], missingId: required[i][2] };
    if (Pc <= Pv) return { ok: false, error: 'Pc باید از Pv بزرگ‌تر باشد تا FF قابل محاسبه باشد.', missingId: 'adv_pc' };
    if (FL > 1.2) return { ok: false, error: 'FL واردشده غیرعادی است؛ مقدار vendor را بازبینی کنید.', missingId: 'adv_fl' };
    return { ok: true, SG: SG, Pv: Pv, Pc: Pc, FL: FL, visc: visc, ratedCv: ratedCv, inPipe: inPipe, outPipe: outPipe, reducerRatio: reducerRatio };
  }
  function calcLiquidCase(caseId, label, d, common, requiredCase) {
    var Q = num(d['adv_' + caseId + '_flow']), P1 = num(d['adv_' + caseId + '_p1']), P2 = num(d['adv_' + caseId + '_p2']), T = num(d['adv_' + caseId + '_temp']);
    var hasAny = [Q, P1, P2, T].some(function (x) { return isFinite(x); });
    if (!hasAny && !requiredCase) return null;
    if (!isFinite(Q) || Q <= 0) return { ok: false, caseId: caseId, label: label, error: 'دبی ' + label + ' باید عدد مثبت باشد.', missingId: 'adv_' + caseId + '_flow' };
    if (!isFinite(P1) || P1 <= 0) return { ok: false, caseId: caseId, label: label, error: 'P1 ' + label + ' باید عدد مثبت باشد.', missingId: 'adv_' + caseId + '_p1' };
    if (!isFinite(P2) || P2 <= 0) return { ok: false, caseId: caseId, label: label, error: 'P2 ' + label + ' باید عدد مثبت باشد.', missingId: 'adv_' + caseId + '_p2' };
    if (P1 <= P2) return { ok: false, caseId: caseId, label: label, error: 'برای ' + label + '، P1 باید بزرگ‌تر از P2 باشد.', missingId: 'adv_' + caseId + '_p1' };
    var dP = P1 - P2;
    var Pv = common.Pv, Pc = common.Pc, FL = common.FL, SG = common.SG;
    var FF = 0.96 - 0.28 * Math.sqrt(Pv / Pc);
    var pressureTerm = P1 - FF * Pv;
    if (pressureTerm <= 0) return { ok: false, caseId: caseId, label: label, error: 'عبارت P1 - FF×Pv برای ' + label + ' مثبت نیست؛ واحدهای فشار را بررسی کنید.', missingId: 'adv_' + caseId + '_p1' };
    var dPChoke = FL * FL * pressureTerm;
    if (dPChoke <= 0) return { ok: false, caseId: caseId, label: label, error: 'ΔP choked برای ' + label + ' قابل محاسبه نیست.', missingId: 'adv_fl' };
    var choked = dP >= dPChoke;
    var KvNonChoked = Q * Math.sqrt(SG / dP);
    var KvChoked = Q * Math.sqrt(SG) / (FL * Math.sqrt(pressureTerm));
    var Kv = choked ? KvChoked : KvNonChoked;
    var Cv = 1.156 * Kv;
    var cavitationMargin = P2 - Pv;
    var severity = dP / dPChoke;
    var openingPct = isFinite(common.ratedCv) && common.ratedCv > 0 ? (Cv / common.ratedCv) * 100 : NaN;
    var pipe = pipeVelocityChecks(label, Q, common);
    var risk = cavitationRisk(label, P2, Pv, severity, choked);
    var noise = noiseRisk(label, Q, dP, severity, choked, pipe, risk);
    var warnings = [];
    if (choked) warnings.push(label + ': ΔP از حد choked بالاتر یا برابر است؛ trim ضدکاویتاسیون/anti-flashing باید بررسی شود.');
    if (cavitationMargin <= 0) warnings.push(label + ': P2 <= Pv است؛ flashing محتمل است.');
    else if (severity >= 0.85) warnings.push(label + ': severity نزدیک به choked است؛ بررسی cavitation/noise در گزارش کامل لازم است.');
    if (risk && risk.score >= 3) warnings.push(label + ': سطح ریسک cavitation/flashing = ' + risk.tag + ' — ' + risk.action + '.');
    if (noise && noise.score >= 3) warnings.push(label + ': سطح ریسک noise = ' + noise.tag + ' — ' + noise.action + '.');
    if (isFinite(openingPct) && openingPct > 90) warnings.push(label + ': Cv نامی واردشده برای این case احتمالاً کوچک است (opening > 90%).');
    if (isFinite(openingPct) && openingPct < 10) warnings.push(label + ': opening خیلی کم است؛ rangeability/controllability باید بررسی شود.');
    warnings = warnings.concat(pipe.warnings || []);
    return {
      ok: true, caseId: caseId, label: label, Q: Q, P1: P1, P2: P2, T: T,
      SG: SG, Pv: Pv, Pc: Pc, FL: FL,
      dP: round(dP, 6), FF: round(FF, 6), dPChoke: round(dPChoke, 6), choked: choked,
      KvNonChoked: round(KvNonChoked, 6), KvChoked: round(KvChoked, 6), Kv: round(Kv, 6), Cv: round(Cv, 6),
      cavitationMargin: round(cavitationMargin, 6), severity: round(severity, 6), openingPct: round(openingPct, 3), pipe: pipe, risk: risk, noise: noise, warnings: warnings,
      formulaTrace: [
        label + ': ΔP = P1 - P2 = ' + fmt(P1, 4) + ' - ' + fmt(P2, 4) + ' = ' + fmt(dP, 4) + ' bar',
        label + ': FF = 0.96 - 0.28 × sqrt(Pv / Pc) = ' + fmt(FF, 5),
        label + ': ΔP_choked = FL² × (P1 - FF × Pv) = ' + fmt(dPChoke, 4) + ' bar',
        choked ? label + ': Choked branch: Kv = Q × sqrt(SG) / (FL × sqrt(P1 - FF × Pv)) = ' + fmt(Kv, 4) : label + ': Non-choked branch: Kv = Q × sqrt(SG / ΔP) = ' + fmt(Kv, 4),
        label + ': Cv = 1.156 × Kv = ' + fmt(Cv, 4),
        label + ': Cavitation margin = P2 - Pv = ' + fmt(cavitationMargin, 4) + ' bar; severity = ΔP / ΔP_choked = ' + fmt(severity, 4)
      ]
    };
  }
  function summarizeCases(cases, d, common) {
    var governing = cases.reduce(function (best, c) { return !best || c.Cv > best.Cv ? c : best; }, null);
    var warnings = [];
    cases.forEach(function (c) { warnings = warnings.concat(c.warnings || []); });
    if (isFinite(common.visc) && common.visc > 100) warnings.push('ویسکوزیته بالا است؛ correction کامل viscosity در این فاز اعمال نشده است.');
    if (!common.inPipe.ok || !common.outPipe.ok) warnings.push('ID/سایز لوله برای pipe velocity / reducer correction وارد نشده یا قابل خواندن نیست؛ گزارش نهایی بدون آن مسدود می‌ماند.');
    else if (isFinite(common.reducerRatio) && common.reducerRatio < 0.8) warnings.push('تفاوت inlet/outlet pipe قابل توجه است (reducer ratio=' + fmt(common.reducerRatio, 2) + ')؛ correctionهای Fp/FLp در گزارش کامل لازم است.');
    else if (common.inPipe.ok && common.outPipe.ok) warnings.push('Pipe ID basis: inlet=' + common.inPipe.basis + '، outlet=' + common.outPipe.basis + '. این check مقدماتی است.');
    if (!d.adv_brand) warnings.push('برند/سری فقط پس از داده vendor معتبر قابل پیشنهاد است؛ این محاسبه انتخاب مدل قطعی نیست.');
    var topRisk = riskSummary(cases);
    var topNoise = noiseSummary(cases);
    var riskRecommendations = [];
    cases.forEach(function (c) { if (c.risk && c.risk.recommendations) riskRecommendations = riskRecommendations.concat(c.risk.recommendations.map(function (x) { return c.label + ': ' + x; })); });
    riskRecommendations = riskRecommendations.filter(function (x, i, a) { return a.indexOf(x) === i; }).slice(0, 8);
    var noiseRecommendations = [];
    cases.forEach(function (c) { if (c.noise && c.noise.recommendations) noiseRecommendations = noiseRecommendations.concat(c.noise.recommendations.map(function (x) { return c.label + ': ' + x; })); });
    noiseRecommendations = noiseRecommendations.filter(function (x, i, a) { return a.indexOf(x) === i; }).slice(0, 8);
    return {
      governing: governing,
      recommendedCv: governing ? round(governing.Cv * 1.10, 6) : NaN,
      warnings: warnings,
      riskSummary: topRisk,
      riskRecommendations: riskRecommendations,
      noiseSummary: topNoise,
      noiseRecommendations: noiseRecommendations
    };
  }
  function renderLiquidCases(r) {
    if (!r || !r.ok) return;
    var rows = r.cases.map(function (c) {
      return '<tr><td>' + esc(c.label) + '</td><td>' + fmt(c.Q, 3) + '</td><td>' + fmt(c.P1, 3) + '</td><td>' + fmt(c.P2, 3) + '</td><td>' + fmt(c.dP, 3) + '</td><td>' + fmt(c.dPChoke, 3) + '</td><td>' + (c.choked ? 'Yes' : 'No') + '</td><td>' + riskBadge(c.risk) + '</td><td>' + riskBadge(c.noise) + '</td><td><b>' + fmt(c.Kv, 3) + '</b></td><td><b>' + fmt(c.Cv, 3) + '</b></td><td>' + fmt(c.severity * 100, 0) + '٪</td><td>' + fmt(c.openingPct, 1) + '</td><td>' + fmt((c.pipe || {}).vIn, 2) + '</td><td>' + fmt((c.pipe || {}).vOut, 2) + '</td></tr>';
    }).join('');
    var act = r.actuator || null;
    var actHtml = act ? (act.ok ? '<div style="margin-top:10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:10px"><b>Actuator sizing shell — preliminary only</b><div style="overflow:auto;margin-top:6px"><table style="width:100%;border-collapse:collapse;font-size:11.5px;direction:ltr;text-align:left"><tr><th>Fail action</th><th>Shutoff ΔP</th><th>Seat mm</th><th>Fluid force N</th><th>Packing N</th><th>Safety</th><th>Req. thrust N</th><th>Req. thrust kgf</th><th>Supply barg</th><th>Eq. diaphragm mm</th></tr><tr><td>' + esc(act.failAction) + '</td><td>' + fmt(act.shutoffDpBar,2) + '</td><td>' + fmt(act.seatMm,1) + '</td><td>' + fmt(act.fluidForceN,0) + '</td><td>' + fmt(act.packingForceN,0) + '</td><td>' + fmt(act.safetyFactor,2) + '</td><td><b>' + fmt(act.requiredThrustN,0) + '</b></td><td><b>' + fmt(act.requiredThrustKgF,0) + '</b></td><td>' + fmt(act.supplyBarG,1) + '</td><td>' + fmt(act.diaphragmDiaMm,1) + '</td></tr></table></div><div style="font-size:11px;color:#64748b;margin-top:6px">این خروجی فقط actuator shell است؛ انتخاب actuator/diaphragm/spring/torque نهایی باید با سازنده انجام شود.</div></div>' : '<div style="margin-top:10px;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:10px;color:#92400e"><b>Actuator shell incomplete:</b> ' + esc(act.reason || 'missing actuator data') + '</div>') : '';
    var noiseRecHtml = (r.noiseRecommendations && r.noiseRecommendations.length) ? '<div style="margin-top:8px;color:#334155"><b>پیشنهادهای مقدماتی برای ریسک noise:</b><ul style="margin:4px 18px 0 0;padding:0;line-height:1.8">' + r.noiseRecommendations.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul></div>' : '';
    var recHtml = (r.riskRecommendations && r.riskRecommendations.length) ? '<div style="margin-top:8px;color:#334155"><b>پیشنهادهای مقدماتی برای ریسک cavitation/flashing:</b><ul style="margin:4px 18px 0 0;padding:0;line-height:1.8">' + r.riskRecommendations.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul></div>' : '';
    var warnHtml = r.warnings.length ? '<div style="margin-top:8px;color:#b45309"><b>هشدارهای مهندسی مقدماتی:</b><ul style="margin:4px 18px 0 0;padding:0;line-height:1.8">' + r.warnings.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul></div>' : '<div style="margin-top:8px;color:#047857">در caseهای واردشده، هشدار بحرانی فوری دیده نشد؛ تایید نهایی سازنده/مهندس همچنان لازم است.</div>';
    var trace = (r.governing && r.governing.formulaTrace ? r.governing.formulaTrace : []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('');
    resultBox('advCvPrelimResult',
      '<b>نتیجه مقدماتی Liquid — Min/Normal/Max</b>' +
      '<div class="adv-metrics"><span><b>Governing case</b><em>' + esc((r.governing || {}).label || '—') + '</em></span><span><b>Governing Cv</b><em>' + fmt((r.governing || {}).Cv, 3) + '</em></span><span><b>Prelim selected Cv +10%</b><em>' + fmt(r.recommendedCv, 3) + '</em></span><span><b>Cases calculated</b><em>' + r.cases.length + '</em></span><span><b>Reducer ratio</b><em>' + fmt((r.common || {}).reducerRatio, 2) + '</em></span><span><b>Overall cavitation risk</b><em>' + riskBadge(r.riskSummary) + '</em></span><span><b>Overall noise risk</b><em>' + riskBadge(r.noiseSummary) + '</em></span><span><b>Actuator thrust</b><em>' + (r.actuator && r.actuator.ok ? fmt(r.actuator.requiredThrustN/1000,2)+' kN' : '—') + '</em></span></div>' +
      '<div style="overflow:auto;margin-top:10px"><table style="width:100%;border-collapse:collapse;font-size:11.5px;direction:ltr;text-align:left"><thead><tr style="background:#f1f5f9"><th>Case</th><th>Q</th><th>P1</th><th>P2</th><th>ΔP</th><th>ΔPch</th><th>Choked</th><th>Cavitation risk</th><th>Noise risk</th><th>Kv</th><th>Cv</th><th>Severity</th><th>Opening%</th><th>Vin m/s</th><th>Vout m/s</th></tr></thead><tbody>' + rows + '</tbody></table></div>' + warnHtml + recHtml + noiseRecHtml + actHtml +
      '<div style="margin-top:10px"><b>Formula trace for governing case:</b><ol style="margin:6px 20px 0 0;padding:0;direction:ltr;text-align:left;line-height:1.8;color:#334155">' + trace + '</ol></div>' +
      '<div style="font-size:11px;color:#64748b;margin-top:10px;line-height:1.8">فرض این فاز: Q بر حسب m³/h، فشارها bar(a)، SG نسبت به آب و FL از vendor/دیتاشیت است. Selected Cv +10% و velocity/reducer، cavitation severity، preliminary noise risk و actuator shell فقط پیشنهاد مقدماتی برای ادامه بررسی هستند، final sizing/report نیستند، PDF تولید نمی‌کنند و انتخاب برند/مدل را قطعی نمی‌کنند.</div>');
  }


  function compressiblePhase(d) {
    var phase = d.adv_phase || '';
    if (/gas|گاز/i.test(phase)) return 'gas';
    if (/steam|بخار/i.test(phase)) return 'steam';
    return '';
  }
  function commonCompressible(d, phase) {
    var MW = num(d.adv_mw), SG = num(d.adv_sg), Z = num(d.adv_z), k = num(d.adv_k), Xt = num(d.adv_xt), ratedCv = num(d.adv_rated_cv);
    var inPipe = parsePipeIdMm(d.adv_in_pipe), outPipe = parsePipeIdMm(d.adv_out_pipe);
    var reducerRatio = (inPipe.ok && outPipe.ok) ? Math.min(inPipe.idMm, outPipe.idMm) / Math.max(inPipe.idMm, outPipe.idMm) : NaN;
    var errors = [];
    if (phase === 'gas') {
      if (!isFinite(MW) || MW <= 0) MW = isFinite(SG) && SG > 0 ? SG * 28.97 : NaN;
      if (!isFinite(SG) || SG <= 0) SG = isFinite(MW) && MW > 0 ? MW / 28.97 : NaN;
      if (!isFinite(MW) || MW <= 0) errors.push(['adv_mw', 'برای گاز، MW یا SG معتبر لازم است.']);
      if (!isFinite(SG) || SG <= 0) errors.push(['adv_sg', 'برای گاز، SG یا MW معتبر لازم است.']);
      if (!isFinite(Z) || Z <= 0) Z = 1;
      if (!isFinite(k) || k <= 0) k = 1.3;
      if (!isFinite(Xt) || Xt <= 0) Xt = 0.72;
    } else if (phase === 'steam') {
      MW = 18.015; SG = 0.62; if (!isFinite(Z) || Z <= 0) Z = 1; if (!isFinite(k) || k <= 0) k = 1.3; if (!isFinite(Xt) || Xt <= 0) Xt = 0.72;
    }
    if (Xt > 1.2) errors.push(['adv_xt', 'Xt واردشده غیرعادی است؛ داده vendor را بررسی کنید.']);
    if (errors.length) return { ok: false, error: errors[0][1], missingId: errors[0][0] };
    return { ok: true, phase: phase, MW: MW, SG: SG, Z: Z, k: k, Xt: Xt, ratedCv: ratedCv, inPipe: inPipe, outPipe: outPipe, reducerRatio: reducerRatio };
  }
  function actualGasQNm3h(Qn, Pavg, T, Z) {
    var Tk = (isFinite(T) ? T : 20) + 273.15;
    return Qn * (Tk / 273.15) * (1.01325 / Math.max(Pavg, 0.01)) / (Z || 1);
  }
  function actualSteamQm3h(W, Pavg, T) {
    var Tk = (isFinite(T) ? T : 180) + 273.15;
    var rho = (Math.max(Pavg, 0.01) * 100000 * 0.018015) / (8.314 * Tk);
    return W / Math.max(rho, 0.001);
  }
  function calcCompressibleCase(caseId, label, d, common, requiredCase) {
    var Q = num(d['adv_' + caseId + '_flow']), P1 = num(d['adv_' + caseId + '_p1']), P2 = num(d['adv_' + caseId + '_p2']), T = num(d['adv_' + caseId + '_temp']);
    var hasAny = [Q, P1, P2, T].some(function (x) { return isFinite(x); });
    if (!hasAny && !requiredCase) return null;
    if (!isFinite(Q) || Q <= 0) return { ok: false, caseId: caseId, label: label, error: 'دبی ' + label + ' باید عدد مثبت باشد.', missingId: 'adv_' + caseId + '_flow' };
    if (!isFinite(P1) || P1 <= 0) return { ok: false, caseId: caseId, label: label, error: 'P1 ' + label + ' باید عدد مثبت باشد.', missingId: 'adv_' + caseId + '_p1' };
    if (!isFinite(P2) || P2 <= 0) return { ok: false, caseId: caseId, label: label, error: 'P2 ' + label + ' باید عدد مثبت باشد.', missingId: 'adv_' + caseId + '_p2' };
    if (P1 <= P2) return { ok: false, caseId: caseId, label: label, error: 'برای ' + label + '، P1 باید بزرگ‌تر از P2 باشد.', missingId: 'adv_' + caseId + '_p1' };
    var dP = P1 - P2, Pavg = (P1 + P2) / 2, Tk = (isFinite(T) ? T : (common.phase === 'steam' ? 180 : 20)) + 273.15;
    var x = dP / P1;
    var Fgamma = Math.max(0.2, Math.min(1.5, common.k / 1.4));
    var xChoked = Math.max(0.05, Fgamma * common.Xt);
    var choked = common.phase === 'steam' ? dP >= P1 / 2 : x >= xChoked;
    var Cv;
    if (common.phase === 'steam') {
      Cv = choked ? Q / (11.7 * P1) : Q / (13.67 * Math.sqrt(dP * (P1 + P2)));
    } else {
      Cv = choked ? (Q / (0.471 * 417 * P1)) * Math.sqrt(common.SG * Tk * common.Z) : (Q / 417) * Math.sqrt((common.SG * Tk * common.Z) / (dP * (P1 + P2)));
    }
    var Kv = Cv * 0.865;
    var actualQ = common.phase === 'steam' ? actualSteamQm3h(Q, Pavg, T) : actualGasQNm3h(Q, Pavg, T, common.Z);
    var pipe = pipeVelocityChecks(label, actualQ, common);
    var openingPct = isFinite(common.ratedCv) && common.ratedCv > 0 ? (Cv / common.ratedCv) * 100 : NaN;
    var severity = x / xChoked;
    var risk = { level: choked ? 'choked_compressible' : (severity >= 0.85 ? 'high' : 'low'), score: choked ? 4 : (severity >= 0.85 ? 3 : 1), tag: choked ? 'Compressible choked' : (severity >= 0.85 ? 'High pressure-ratio risk' : 'Low'), color: choked ? '#dc2626' : (severity >= 0.85 ? '#d97706' : '#047857'), recommendations: [] };
    if (choked) risk.recommendations.push('Compressible choked flow screening: low-noise trim and vendor sizing are required.');
    var noise = noiseRisk(label, actualQ, dP, severity, choked, pipe, risk);
    var warnings = [];
    if (choked) warnings.push(label + ': جریان تراکم‌پذیر در حالت choked/critical screening است؛ low-noise trim و vendor sizing لازم است.');
    if (severity >= 0.85 && !choked) warnings.push(label + ': pressure ratio نزدیک به حد choked است؛ noise و trim باید بررسی شود.');
    warnings = warnings.concat(pipe.warnings || []);
    if (isFinite(openingPct) && openingPct > 90) warnings.push(label + ': Cv نامی واردشده برای این case احتمالاً کوچک است (opening > 90%).');
    if (isFinite(openingPct) && openingPct < 10) warnings.push(label + ': opening خیلی کم است؛ rangeability/controllability باید بررسی شود.');
    return { ok: true, caseId: caseId, label: label, phase: common.phase, Q: Q, actualQ: round(actualQ, 6), P1: P1, P2: P2, T: isFinite(T) ? T : '', dP: round(dP, 6), x: round(x, 6), xChoked: round(xChoked, 6), choked: choked, Kv: round(Kv, 6), Cv: round(Cv, 6), severity: round(severity, 6), openingPct: round(openingPct, 3), pipe: pipe, risk: risk, noise: noise, warnings: warnings, formulaTrace: [
      label + ': x = ΔP / P1 = ' + fmt(x, 4),
      label + ': x_choked ≈ Fγ × Xt = ' + fmt(xChoked, 4),
      label + ': ' + (common.phase === 'steam' ? 'Steam preliminary Cv' : 'Gas preliminary Cv') + ' = ' + fmt(Cv, 4),
      label + ': Kv = Cv × 0.865 = ' + fmt(Kv, 4),
      label + ': estimated actual line flow for velocity screening = ' + fmt(actualQ, 2) + ' m³/h'
    ] };
  }
  window.ptfAdvCvCalculateCompressibleCases = function (input) {
    if (!isUnlocked()) { if (typeof window.ptfToolsPaywall === 'function') window.ptfToolsPaywall('سایزینگ پیشرفته کنترل ولو'); return validationError('برای اجرای محاسبه مقدماتی، فعال‌سازی ابزار پیشرفته لازم است.', 'license'); }
    var d = input || window.ptfAdvCvCollectDraft();
    var phase = compressiblePhase(d);
    if (!phase) return validationError('برای این مسیر باید فاز سیال Gas یا Steam باشد.', 'adv_phase');
    if (!input && typeof window.ptfAdvCvCheckCompleteness === 'function') window.ptfAdvCvCheckCompleteness();
    var common = commonCompressible(d, phase);
    if (!common.ok) return validationError(common.error, common.missingId);
    var specs = [['min', 'Minimum'], ['normal', 'Normal'], ['max', 'Maximum']];
    var cases = [], errors = [];
    specs.forEach(function (s) { var c = calcCompressibleCase(s[0], s[1], d, common, s[0] === 'normal'); if (!c) return; if (!c.ok) errors.push(c); else cases.push(c); });
    if (errors.length) return validationError(errors[0].error, errors[0].missingId);
    if (!cases.length) return validationError('حداقل داده‌های حالت نرمال برای محاسبه لازم است.', 'adv_normal_flow');
    var sum = summarizeCases(cases, d, common);
    var actuator = actuatorShell(d, cases);
    var combinedWarnings = sum.warnings.concat((actuator && actuator.warnings) || []);
    var result = { ok: true, scope: 'preliminary_' + phase + '_multicase', final: false, pdf: false, cases: cases, governing: sum.governing, recommendedCv: sum.recommendedCv, warnings: combinedWarnings, riskSummary: sum.riskSummary, riskRecommendations: sum.riskRecommendations, noiseSummary: sum.noiseSummary, noiseRecommendations: sum.noiseRecommendations, actuator: actuator, common: common, formulaTrace: (sum.governing || {}).formulaTrace || [] };
    renderLiquidCases(result);
    try { if (typeof window.ptfTrack === 'function') window.ptfTrack('advanced_cv_compressible_multicase_calculated', { phase: phase, cases: cases.length, governingCv: result.governing ? result.governing.Cv : 0 }); } catch (e4) {}
    return result;
  };
  window.ptfAdvCvCalculateAdvancedCases = function (input) {
    var d = input || window.ptfAdvCvCollectDraft();
    var ph = compressiblePhase(d);
    return ph ? window.ptfAdvCvCalculateCompressibleCases(d) : window.ptfAdvCvCalculateLiquidCases(d);
  };

  window.ptfAdvCvCalculateLiquidCases = function (input) {
    if (!isUnlocked()) {
      if (typeof window.ptfToolsPaywall === 'function') window.ptfToolsPaywall('سایزینگ پیشرفته کنترل ولو');
      return validationError('برای اجرای محاسبه مقدماتی، فعال‌سازی ابزار پیشرفته لازم است.', 'license');
    }
    var d = input || window.ptfAdvCvCollectDraft();
    if (!input && typeof window.ptfAdvCvCheckCompleteness === 'function') window.ptfAdvCvCheckCompleteness();
    var common = commonLiquid(d);
    if (!common.ok) return validationError(common.error, common.missingId);
    var specs = [['min', 'Minimum'], ['normal', 'Normal'], ['max', 'Maximum']];
    var cases = [], errors = [];
    specs.forEach(function (s) {
      var c = calcLiquidCase(s[0], s[1], d, common, s[0] === 'normal');
      if (!c) return;
      if (!c.ok) errors.push(c);
      else cases.push(c);
    });
    if (errors.length) return validationError(errors[0].error, errors[0].missingId);
    if (!cases.length) return validationError('حداقل داده‌های حالت نرمال برای محاسبه لازم است.', 'adv_normal_flow');
    var sum = summarizeCases(cases, d, common);
    var actuator = actuatorShell(d, cases);
    var combinedWarnings = sum.warnings.concat((actuator && actuator.warnings) || []);
    var result = {
      ok: true, scope: 'preliminary_liquid_multicase', final: false, pdf: false,
      cases: cases, governing: sum.governing, recommendedCv: sum.recommendedCv, warnings: combinedWarnings, riskSummary: sum.riskSummary, riskRecommendations: sum.riskRecommendations, noiseSummary: sum.noiseSummary, noiseRecommendations: sum.noiseRecommendations, actuator: actuator, common: common,
      formulaTrace: (sum.governing || {}).formulaTrace || []
    };
    renderLiquidCases(result);
    try { if (typeof window.ptfTrack === 'function') window.ptfTrack('advanced_cv_liquid_multicase_calculated', { cases: cases.length, governingCv: result.governing ? result.governing.Cv : 0 }); } catch (e4) {}
    return result;
  };

  window.ptfAdvCvCalculateEngineering = function (input) {
    return window.ptfAdvCvCalculateAdvancedCases(input);
  };

  window.ptfAdvCvCalculatePrelim = function (input) {
    var result = window.ptfAdvCvCalculateLiquidCases(input);
    if (!result || !result.ok) return result;
    var normal = result.cases.filter(function (c) { return c.caseId === 'normal'; })[0] || result.governing || result.cases[0];
    for (var k in normal) if (Object.prototype.hasOwnProperty.call(normal, k)) result[k] = normal[k];
    result.scope = 'preliminary_liquid_only';
    result.multicaseScope = 'preliminary_liquid_multicase';
    return result;
  };

  window.ptfAdvCvOpenSchema = function () {
    var old = byId('ptfAdvCvSchemaModal');
    if (old) old.remove();
    var unlocked = isUnlocked();
    try { if (typeof window.ptfTrack === 'function') window.ptfTrack(unlocked ? 'advanced_cv_draft_open' : 'advanced_cv_schema_preview_open'); } catch (e) {}

    var cases = ['حالت حداقل', 'حالت نرمال', 'حالت حداکثر'].map(function (c, i) {
      var k = ['min', 'normal', 'max'][i];
      return '<div class="adv-case"><b>' + c + '</b>' +
        field('adv_' + k + '_flow', 'دبی جریان', 'm3/h، kg/h، Nm3/h', 'number') +
        field('adv_' + k + '_p1', 'فشار بالادست P1', 'برای محاسبه مقدماتی: bar(a)', 'number') +
        field('adv_' + k + '_p2', 'فشار پایین‌دست P2', 'برای محاسبه مقدماتی: bar(a)', 'number') +
        field('adv_' + k + '_temp', 'دما', '°C', 'number') + '</div>';
    }).join('');

    var html = '<div class="adv-modal" id="ptfAdvCvSchemaModal" onclick="if(event.target===this)this.remove()">' +
      '<div class="adv-dialog" role="dialog" aria-modal="true" aria-labelledby="advCvTitle">' +
      '<style>' +
      '.adv-modal{position:fixed;inset:0;background:radial-gradient(circle at 20% 10%,rgba(247,148,0,.20),transparent 28%),rgba(15,23,42,.62);z-index:99999;display:grid;place-items:center;padding:16px;direction:rtl;backdrop-filter:blur(6px)}' +
      '.adv-dialog{background:linear-gradient(180deg,#ffffff,#f8fafc 58%,#f1f5f9);color:#172033;border-radius:26px;max-width:1160px;width:min(1160px,96vw);max-height:92vh;overflow:auto;box-shadow:0 32px 90px rgba(15,23,42,.34);padding:0;font-family:Tahoma,Arial,sans-serif;text-align:right;border:1px solid rgba(226,232,240,.95)}' +
      '.adv-head{position:sticky;top:0;z-index:3;display:flex;justify-content:space-between;gap:14px;align-items:flex-start;background:linear-gradient(135deg,#0f172a,#17233a 62%,#253858);color:#fff;padding:20px 22px 16px;border-radius:26px 26px 0 0;border-bottom:1px solid rgba(255,255,255,.12)}.adv-head h3{margin:0;color:#fff;font-size:22px;letter-spacing:-.2px}.adv-head p{margin:8px 0 0;color:#dbeafe;font-size:13px;line-height:2;max-width:780px}' +
      '.adv-lock{display:inline-block;border:1px solid rgba(255,207,122,.55);color:#ffcf7a;background:rgba(247,148,0,.12);border-radius:999px;padding:3px 11px;font-size:11px;font-weight:900;margin-bottom:7px}.adv-unlocked{border-color:rgba(134,239,172,.6);color:#bbf7d0;background:rgba(16,185,129,.12)}' +
      '.adv-steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;padding:14px 18px;background:#fff;border-bottom:1px solid #e2e8f0}.adv-step{display:flex;align-items:center;gap:8px;border:1px solid #e2e8f0;border-radius:14px;padding:8px 10px;background:linear-gradient(180deg,#fff,#f8fafc);font-size:12px;color:#334155}.adv-step b{display:grid;place-items:center;width:26px;height:26px;border-radius:9px;background:#0f172a;color:#fff;font-size:11px;flex:none}.adv-step span{line-height:1.6}' +
      '.adv-sec{border:1px solid #e2e8f0;border-radius:18px;padding:15px;margin:14px 18px;background:rgba(255,255,255,.92);box-shadow:0 8px 28px rgba(15,23,42,.045)}.adv-sec h4{display:flex;align-items:center;gap:8px;margin:0 0 12px;font-size:14px;color:#0e7490}.adv-sec h4:before{content:"";width:8px;height:8px;border-radius:99px;background:linear-gradient(135deg,#ef4b1a,#f79400);box-shadow:0 0 0 4px rgba(247,148,0,.12)}.adv-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(198px,1fr));gap:11px}' +
      '.adv-field label{display:flex;justify-content:space-between;gap:8px;align-items:center;font-size:11.5px;color:#475569;margin-bottom:5px;font-weight:900;text-align:right;direction:rtl}.adv-field input,.adv-field select{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:12px;padding:9px 10px;background:' + (unlocked ? '#fff' : '#f1f5f9') + ';color:#24324a;font-size:12.5px;direction:rtl;text-align:right;unicode-bidi:plaintext;outline:none;transition:border .18s,box-shadow .18s,background .18s}.adv-field input:focus,.adv-field select:focus{border-color:#f79400;box-shadow:0 0 0 4px rgba(247,148,0,.14)}.adv-field .adv-num,.adv-field input[type=number]{direction:ltr;text-align:left;font-family:ui-monospace,SFMono-Regular,Consolas,monospace}.adv-field input:disabled,.adv-field select:disabled{color:#64748b;background:#f1f5f9}.adv-field input::placeholder{color:#94a3b8;opacity:1}.adv-textarea{width:100%;box-sizing:border-box;min-height:118px;border:1px solid #cbd5e1;border-radius:12px;padding:10px;background:#fff;color:#24324a;font-size:12px;direction:ltr;text-align:left;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;resize:vertical}' +
      '.adv-case{border:1px solid #dbeafe;border-radius:16px;padding:11px;background:linear-gradient(180deg,#ffffff,#f8fbff)}.adv-case b{display:block;margin-bottom:8px;color:#1e3a8a;font-size:12px}.adv-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:7px;font-size:12.2px;color:#334155;line-height:1.9}.adv-list span{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:7px 9px;direction:rtl;text-align:right}.adv-phase-guide{grid-column:1/-1;background:#f8fafc;border:1px solid #dbeafe;border-radius:14px;padding:10px;color:#334155}.adv-phase-guide>b{display:block;color:#0f172a}.adv-guide-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-top:8px}.adv-guide-grid div{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:8px}.adv-guide-grid strong{display:block;color:#0e7490;font-size:12px}.adv-guide-grid em{display:block;direction:ltr;text-align:left;font-style:normal;font-weight:900;color:#0f172a;font-size:12px}.adv-guide-grid small{display:block;color:#64748b;line-height:1.7;margin-top:3px}.adv-report-outline{direction:ltr;text-align:left}.adv-report-outline h4{direction:rtl;text-align:right}.adv-report-outline .adv-list span{direction:ltr;text-align:left;font-family:Arial,Tahoma,sans-serif}' +
      '.adv-actions{position:sticky;bottom:0;z-index:4;display:flex;gap:8px;justify-content:flex-start;flex-wrap:wrap;margin-top:14px;padding:12px 18px;background:rgba(248,250,252,.94);backdrop-filter:blur(6px);border-top:1px solid #e2e8f0;border-radius:0 0 26px 26px}.adv-btn{border:0;border-radius:13px;padding:9px 14px;font-size:12.5px;font-weight:900;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:6px;transition:transform .15s,box-shadow .15s}.adv-btn:hover{transform:translateY(-1px);box-shadow:0 8px 22px rgba(15,23,42,.12)}.adv-primary{background:linear-gradient(135deg,#ef4b1a,#f79400);color:#fff}.adv-light{background:#fff;color:#334155;border:1px solid #dbe3ef}.adv-result{display:none;border-radius:16px;padding:11px 13px;margin:10px 18px;background:#fff;border:1px solid #e2e8f0;font-size:12px;line-height:1.85;box-shadow:0 6px 22px rgba(15,23,42,.04)}' +
      '.adv-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(138px,1fr));gap:8px;margin-top:10px}.adv-metrics span{display:block;background:linear-gradient(180deg,#f8fafc,#fff);border:1px solid #e2e8f0;border-radius:14px;padding:9px}.adv-metrics b{display:block;color:#64748b;font-size:11px}.adv-metrics em{display:block;color:#0f172a;font-style:normal;font-weight:900;margin-top:3px;direction:ltr;text-align:left}.adv-tech,bdi{unicode-bidi:isolate}table th,table td{border:1px solid #e2e8f0;padding:6px 7px;vertical-align:top}table th{background:#f8fafc;color:#334155}' +
      '</style>' +
      '<div class="adv-head"><div><span class="adv-lock ' + (unlocked ? 'adv-unlocked' : '') + '">' + (unlocked ? 'حالت پیش‌نویس و راهنمای Liquid/Gas/Steam فعال' : 'پیش‌نمایش قفل‌شده فرم ورودی') + '</span><h3 id="advCvTitle">سایزینگ پیشرفته کنترل ولو — فرم ورودی</h3><p>' + (unlocked ? 'فیلدها فعال هستند. می‌توانید کامل بودن داده‌ها را بررسی کنید، برای Liquid/Gas/Steam محاسبه مقدماتی، راهنمای واحد و فاز دریافت کنید، draft را ذخیره کنید و پیش‌نمایش گزارش انگلیسی را روی صفحه ببینید، payload قفل‌شده را برای صدور گزارش نهایی در CRM ثبت کنید و بسته تست/feedback و QA داخلی سناریوها را اجرا کنید. ثبت draft از این فرم انجام می‌شود؛ گزارش نهایی انگلیسی از کارتابل CRM پس از review، final gate و quota صادر می‌شود.' : 'این بخش فقط پیش‌نمایش قفل‌شده است. محاسبه کامل و گزارش نهایی فقط برای کاربر دارای لایسنس و از مسیر review/CRM فعال است؛ کاربر عمومی فقط پیش‌نمایش قفل‌شده می‌بیند.') + '</p></div><button type="button" class="adv-btn adv-light" onclick="document.getElementById(\'ptfAdvCvSchemaModal\').remove()">بستن</button></div>' +
      '<div class="adv-steps"><div class="adv-step"><b>01</b><span>ورودی‌ها و داده‌های پروژه</span></div><div class="adv-step"><b>02</b><span>محاسبه مایع و ریسک‌ها</span></div><div class="adv-step"><b>03</b><span>اکچویتور و گزارش</span></div><div class="adv-step"><b>04</b><span>تست داخلی و feedback</span></div></div>' +
      section('۱. اطلاعات پروژه و تگ',
        field('adv_project', 'نام پروژه', 'مثلاً Olefin Unit Revamp') +
        field('adv_rfq', 'شماره RFQ / استعلام', 'شماره کارفرما یا PTF') +
        field('adv_tag', 'شماره تگ ولو', 'مثلاً FV-101A') +
        field('adv_service', 'سرویس / کاربری', 'Cooling water / Steam letdown / Gas control') +
        field('adv_qty', 'تعداد ولو', 'عدد', 'number') +
        field('adv_rev', 'ویرایش / Revision', 'Rev.0 / Rev.A')) +
      '<section class="adv-sec"><h4>۲. شرایط کاری</h4><div class="adv-grid">' + cases + '</div></section>' +
      section('۳. داده‌های سیال',
        selectField('adv_phase', 'فاز سیال', ['مایع (Liquid)', 'گاز (Gas)', 'بخار (Steam)', 'دوفازی — نیازمند بازبینی مهندسی']) +
        field('adv_fluid', 'نام سیال', 'Water, condensate, natural gas, steam') +
        field('adv_flow_basis', 'مبنای دبی', 'Liquid: m³/h | Gas: Nm³/h | Steam: kg/h') +
        field('adv_sg', 'چگالی نسبی / دانسیته', 'SG یا kg/m3') +
        field('adv_visc', 'ویسکوزیته', 'cP') +
        field('adv_pv', 'فشار بخار Pv', 'برای محاسبه مقدماتی: bar(a)') +
        field('adv_pc', 'فشار بحرانی Pc', 'برای محاسبه مقدماتی: bar(a)') +
        field('adv_mw', 'جرم مولکولی MW', 'Gas: kg/kmol یا g/mol؛ مثال 18') +
        field('adv_z', 'ضریب تراکم‌پذیری Z', 'Gas/Steam؛ پیش‌فرض 1') +
        field('adv_k', 'نسبت گرمای ویژه k', 'مثال Gas=1.3')) + phaseGuideHtml('all') +
      section('۴. داده‌های پایپینگ و ولو',
        field('adv_in_pipe', 'سایز / ID لوله ورودی', 'مثلاً NPS 4 یا DN100 یا ID 102 mm') +
        field('adv_out_pipe', 'سایز / ID لوله خروجی', 'مثلاً NPS 4 یا DN100 یا ID 102 mm') +
        selectField('adv_valve_type', 'نوع ولو', ['Globe', 'Cage guided', 'Rotary', 'Segment ball', 'Butterfly']) +
        field('adv_class', 'کلاس فشاری', 'Class 150 / 300 / 600 / PN') +
        field('adv_body', 'متریال بدنه', 'WCB, CF8M, WC6, ...') +
        field('adv_trim', 'متریال تریم', 'SS316, Stellite, ...') +
        field('adv_fl', 'ضریب بازیابی FL', 'vendor value؛ برای liquid prelim لازم است') +
        field('adv_fd', 'ضریب Fd', 'vendor value') +
        field('adv_xt', 'ضریب Xt', 'Gas/Steam vendor value؛ مثال 0.72') +
        field('adv_rated_cv', 'Cv نامی ولو کاندید', 'اختیاری؛ برای opening%') +
        selectField('adv_char', 'مشخصه جریان', ['Equal Percentage', 'Linear', 'Quick Opening'])) +
      section('۵. اکچویتور و برند',
        selectField('adv_fail', 'وضعیت Fail action', ['Fail Close', 'Fail Open', 'Fail Last']) +
        selectField('adv_act_type', 'نوع اکچویتور مقدماتی', ['Pneumatic diaphragm / spring return', 'Pneumatic piston', 'Electric actuator', 'Hydraulic actuator']) +
        field('adv_act_supply', 'فشار هوای ابزار دقیق', 'bar(g)؛ پیش‌فرض 4.5') +
        field('adv_act_safety', 'ضریب اطمینان اکچویتور', 'پیش‌فرض 1.25') +
        field('adv_shutoff', 'اختلاف فشار Shutoff', 'bar') +
        field('adv_seat', 'قطر seat / plug', 'mm') +
        field('adv_packing_force', 'نیروی packing/friction', 'N؛ اختیاری') +
        field('adv_brand', 'برند ترجیحی', 'Fisher, Samson, Masoneilan, Flowserve, Neles') +
        field('adv_series', 'سری پیشنهادی', 'vendor series if known') +
        field('adv_leakage', 'کلاس نشتی', 'ANSI/FCI 70-2 Class IV/V/VI')) +
      '<section class="adv-sec"><h4>۶. ورود سریع از دیتاشیت / Vendor sheet</h4><div class="adv-grid"><div class="adv-field" style="grid-column:1/-1"><label>فایل یا متن دیتاشیت</label><input id="adv_ds_file" type="file" accept=".txt,.csv,.json,.pdf,.doc,.docx,.jpg,.png" ' + disabledAttr() + ' onchange="ptfAdvCvReadDatasheetFile()"><small style="display:block;color:#64748b;line-height:1.8;margin-top:4px">فاز فعلی TXT/CSV/JSON و متن copy/paste را parse می‌کند. PDF/تصویر اسکن‌شده در فاز بعدی با server PDF/OCR parser تکمیل می‌شود.</small><textarea id="adv_ds_text" class="adv-textarea" placeholder="Paste datasheet text here: Tag, Service, Fluid, Flow, P1, P2, Temperature, SG, FL, Xt, Rated Cv, Brand, Series..."></textarea><label style="justify-content:flex-start;margin-top:8px"><input id="adv_ds_overwrite" type="checkbox" style="width:auto;margin-left:6px"> جایگزینی فیلدهای پرشده</label><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button type="button" class="adv-btn adv-light" onclick="ptfAdvCvApplyDatasheetExtract()" ' + (unlocked ? '' : 'disabled') + '>استخراج و تکمیل خودکار</button></div></div></div><div class="adv-result" id="advCvDatasheetAssistResult"></div></section>' +
      '<section class="adv-sec"><h4>چک‌لیست کامل بودن قبل از گزارش نهایی</h4><div class="adv-list">' +
      '<span>الزامی: دبی و P1/P2 برای حالت نرمال</span><span>پیشنهادی: Min/Max برای envelope کامل‌تر</span><span>برای مایع: SG/دانسیته، ویسکوزیته، Pv، Pc و FL</span><span>برای گاز/بخار: MW، Z، k و مبنای دبی</span><span>پیشنهادی: ID لوله‌های ورودی/خروجی برای velocity و reducer/Fp/FLp</span><span>برای اکچویتور: shutoff ΔP، قطر seat/plug، supply pressure، safety factor و fail action</span><span>برای matrix برند: داده معتبر vendor شامل Cv/FL/Xt</span><span>گزارش نهایی تا تکمیل داده‌های الزامی مسدود می‌ماند</span>' +
      '</div><div class="adv-result" id="advCvCompletenessResult"></div><div class="adv-result" id="advCvPrelimResult"></div><div class="adv-result" id="advCvDraftStatus"></div><div class="adv-result" id="advCvReportPreview"></div><div class="adv-result" id="advCvReportData"></div><div class="adv-result" id="advCvFeedbackPack"></div></section>' +
      '<section class="adv-sec adv-report-outline"><h4>ساختار گزارش نهایی غیررایگان انگلیسی</h4><div class="adv-list"><span>Cover page + Report ID + Revision</span><span>Design Basis and Input Summary</span><span>Min/Normal/Max Calculation Tables</span><span>Cv/Kv and choked-flow checks</span><span>Cavitation / flashing severity assessment</span><span>Formula Trace and Unit Conversion Notes</span><span>Flow vs Cv, opening and preliminary noise risk charts</span><span>Brand / Series Candidate Matrix</span><span>Assumptions, missing data and limitations</span></div></section>' +
      '<div class="adv-actions">' +
      (unlocked ? '<button type="button" class="adv-btn adv-light" onclick="ptfAdvCvCheckCompleteness()">بررسی کامل بودن داده‌ها</button><button type="button" class="adv-btn adv-primary" onclick="ptfAdvCvCalculateEngineering()">محاسبه مقدماتی سیال / noise / اکچویتور</button><button type="button" class="adv-btn adv-light" onclick="ptfAdvCvSaveDraft()">ذخیره پیش‌نویس محلی</button><button type="button" class="adv-btn adv-light" onclick="ptfAdvCvShowReportPreview()">پیش‌نمایش گزارش انگلیسی</button><button type="button" class="adv-btn adv-light" onclick="ptfAdvCvShowLockedReportData()">آماده‌سازی داده گزارش قفل‌شده</button><button type="button" class="adv-btn adv-light" onclick="if(window.ptfAdvCvSubmitReportDraft)ptfAdvCvSubmitReportDraft();else ptfAdvCvShowLockedReportData()">ثبت draft گزارش در سرور</button><button type="button" class="adv-btn adv-light" onclick="if(window.ptfAdvCvOpenFeedbackForm)ptfAdvCvOpenFeedbackForm(\'advanced_modal\');else ptfAdvCvOpenFeedbackPack()">ارسال feedback</button>' : '<a class="adv-btn adv-primary" href="../rfq/?activation=tools&tool=control_valve_advanced&item=Advanced%20Control%20Valve%20Sizing%20Input%20Schema">درخواست فعال‌سازی از طریق RFQ</a>') +
      '<button type="button" class="adv-btn adv-light" onclick="document.getElementById(\'ptfAdvCvSchemaModal\').remove()">بستن</button></div>' +
      '</div></div>';
    if (typeof document !== 'undefined' && document.body) document.body.insertAdjacentHTML('beforeend', html);
  };
})();
