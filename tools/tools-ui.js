/* PTF Tools UI — Sprint 66 (US-126) */
(function () {
  'use strict';
  var T = window.PTF_TOOLS;
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  var calcNo = 1;

  var TOOLS = [
    { id: 'cv', lb: 'سایزینگ ولو کنترلی (Cv)' },
    { id: 'onoff', lb: 'سایزینگ ولو آن/آف' },
    { id: 'prv', lb: 'سایزینگ PRV' },
    { id: 'weight', lb: 'وزن متریال' },
    { id: 'press', lb: 'تحمل فشار لوله' },
    { id: 'track', lb: 'ترک‌تیبل ولو کنترلی' }
  ];

  var npsOpts = Object.keys(T.PIPE).map(function (n) { return '<option>' + n + '</option>'; }).join('');
  var matOpts = Object.keys(T.MAT_LB).map(function (m) { return '<option value="' + m + '">' + T.MAT_LB[m] + '</option>'; }).join('');

  var FORMS = {
    cv: '<h3>سایزینگ ولو کنترلی — محاسبه Cv/Kv</h3><div class="tg">' +
      '<div><label>نوع سیال *</label><select id="cvF"><option value="liquid">مایع</option><option value="gas">گاز</option><option value="steam">بخار</option></select></div>' +
      '<div><label>دبی * (مایع/گاز: m³/h — بخار: kg/h)</label><input type="number" id="cvQ" value="50"></div>' +
      '<div><label>فشار ورودی P1 (bara) *</label><input type="number" id="cvP1" value="10" step="0.1"></div>' +
      '<div><label>فشار خروجی P2 (bara) *</label><input type="number" id="cvP2" value="7" step="0.1"></div>' +
      '<div><label>دما (°C)</label><input type="number" id="cvT" value="25"></div>' +
      '<div><label>چگالی نسبی SG</label><input type="number" id="cvSG" value="1" step="0.01"></div>' +
      '<div><label>ویسکوزیته (cP — اختیاری)</label><input type="number" id="cvV" value="1"></div></div>',
    onoff: '<h3>سایزینگ ولو آن/آف — کنترل سرعت خط</h3><div class="tg">' +
      '<div><label>نوع سیال</label><select id="ooF"><option value="liquid">مایع</option><option value="gas">گاز</option></select></div>' +
      '<div><label>دبی (m³/h) *</label><input type="number" id="ooQ" value="100"></div>' +
      '<div><label>سایز خط</label><select id="ooN">' + npsOpts + '</select></div>' +
      '<div><label>اسکجول</label><select id="ooS"><option>S40</option><option>S80</option><option>S160</option></select></div></div>',
    prv: '<h3>سایزینگ شیر اطمینان (PRV) — گاز/بخار</h3><div class="tg">' +
      '<div><label>سناریو</label><select id="pvSc"><option value="blocked">Blocked Outlet</option><option value="fire">آتش (Fire)</option><option value="thermal">انبساط حرارتی</option></select></div>' +
      '<div><label>دبی ریلیف (kg/h) *</label><input type="number" id="pvW" value="5000"></div>' +
      '<div><label>فشار ست (barg) *</label><input type="number" id="pvP" value="10" step="0.1"></div>' +
      '<div><label>Overpressure %</label><select id="pvO"><option>10</option><option>16</option><option>21</option></select></div>' +
      '<div><label>دما (°C)</label><input type="number" id="pvT" value="50"></div>' +
      '<div><label>جرم مولی (g/mol)</label><input type="number" id="pvM" value="20"></div></div>',
    weight: '<h3>محاسبه وزن متریال — سبد چندقلمی</h3><div class="tg">' +
      '<div><label>نوع قلم</label><select id="wtK"><option value="pipe">لوله</option><option value="flange">فلنج WN</option><option value="elbow">الو 90° LR</option></select></div>' +
      '<div><label>سایز NPS</label><select id="wtN">' + npsOpts + '</select></div>' +
      '<div id="wtSchW"><label>اسکجول</label><select id="wtS"><option>S40</option><option>S80</option><option>S160</option></select></div>' +
      '<div id="wtClsW" style="display:none"><label>کلاس</label><select id="wtC"><option>150</option><option>300</option><option>600</option><option>900</option><option>1500</option></select></div>' +
      '<div><label>متریال</label><select id="wtM">' + matOpts + '</select></div>' +
      '<div><label>طول (m) / تعداد</label><input type="number" id="wtQ" value="12"></div></div>' +
      '<div class="tbtn"><button class="btn btn-primary" style="min-height:40px;padding:8px 18px;font-size:13px" id="wtAdd" type="button">+ افزودن به سبد</button></div>' +
      '<div id="wtBasket"></div>',
    press: '<h3>تحمل فشار لوله (ASME B31.3)</h3><div class="tg">' +
      '<div><label>سایز NPS</label><select id="prN">' + npsOpts + '</select></div>' +
      '<div><label>اسکجول</label><select id="prS"><option>S40</option><option>S80</option><option>S160</option></select></div>' +
      '<div><label>متریال</label><select id="prM"><option value="cs">کربن استیل A106-B</option><option value="ss316">استنلس 316</option><option value="alloy">آلیاژی P11</option></select></div>' +
      '<div><label>دمای طراحی (°C)</label><select id="prT"><option>38</option><option>200</option><option>300</option><option>400</option></select></div>' +
      '<div><label>ضریب جوش E</label><select id="prE"><option value="1">مانیسمان (E=1.0)</option><option value="0.85">درزدار ERW (E=0.85)</option></select></div>' +
      '<div><label>خوردگی مجاز CA (mm)</label><input type="number" id="prC" value="1.5" step="0.5"></div></div>',
    track: '<h3>ترک‌تیبل ولو کنترلی (Travel vs Cv)</h3><div class="tg">' +
      '<div><label>Cv حداکثر ولو *</label><input type="number" id="tkCv" value="100"></div>' +
      '<div><label>مشخصه ولو</label><select id="tkCh"><option value="linear">Linear</option><option value="eqp">Equal Percentage</option><option value="qo">Quick Opening</option></select></div>' +
      '<div><label>دبی در ۱۰۰٪ (اختیاری m³/h)</label><input type="number" id="tkQ" value="200"></div></div>'
  };

  var basket = [];

  function renderTabs() {
    var tw = $('ttabs');
    TOOLS.forEach(function (t, i) {
      var b = document.createElement('button');
      b.className = 'tool-tab' + (i === 0 ? ' active' : '');
      b.textContent = t.lb;
      b.onclick = function () {
        tw.querySelectorAll('.tool-tab').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        showTool(t.id);
      };
      tw.appendChild(b);
    });
    showTool('cv');
  }

  function resBox() {
    return '<div class="tres" id="tres"></div>' +
      '<div class="tbtn"><button class="btn btn-primary" id="calcBtn" type="button">محاسبه</button>' +
      '<button class="btn btn-ghost" style="background:#f1f5f9;color:#334155" id="pdfBtn" type="button" disabled>گزارش PDF کامل (فعال‌سازی)</button>' +
      '<a class="btn btn-ghost" style="background:#ecfdf5;color:#047857" id="rfqBtn" href="../rfq/" style="display:none">استعلام این تجهیز</a></div>';
  }

  var curTool = 'cv', lastResult = null;

  function showTool(id) {
    curTool = id;
    lastResult = null;
    $('tbody').innerHTML = FORMS[id] + (id === 'weight' ? '<div class="tres" id="tres"></div><div class="tbtn"><button class="btn btn-ghost" style="background:#f1f5f9;color:#334155" id="pdfBtn" type="button" disabled>گزارش PDF کامل (فعال‌سازی)</button></div>' : resBox());
    if (id === 'weight') {
      basket = [];
      $('wtK').onchange = function () {
        $('wtSchW').style.display = this.value === 'flange' ? 'none' : '';
        $('wtClsW').style.display = this.value === 'flange' ? '' : 'none';
      };
      $('wtAdd').onclick = addToBasket;
    } else {
      $('calcBtn').onclick = calc;
    }
    $('pdfBtn') && ($('pdfBtn').onclick = exportPdf);
  }

  function show(html, rfqText) {
    var r = $('tres');
    r.innerHTML = html;
    r.style.display = 'block';
    $('pdfBtn').disabled = false;
    if (rfqText) {
      var a = $('rfqBtn');
      if (a) { a.style.display = ''; a.href = '../rfq/?item=' + encodeURIComponent(rfqText); }
    }
  }

  function calc() {
    try {
      if (curTool === 'cv') {
        var r = T.sizeCv({ fluid: $('cvF').value, Q: +$('cvQ').value, P1: +$('cvP1').value, P2: +$('cvP2').value, T: +$('cvT').value, SG: +$('cvSG').value, visc: +$('cvV').value });
        if (r.err) { show('<b style="color:#dc2626">' + esc(r.err) + '</b>'); return; }
        lastResult = { tool: 'سایزینگ ولو کنترلی', inputs: { 'سیال': $('cvF').selectedOptions[0].text, 'دبی': $('cvQ').value, 'P1': $('cvP1').value + ' bara', 'P2': $('cvP2').value + ' bara', 'دما': $('cvT').value + '°C', 'SG': $('cvSG').value }, outputs: { 'Cv محاسباتی': r.Cv, 'Kv': r.Kv, 'سایز پیشنهادی': r.size, 'درصد باز بودن': r.open ? r.open + '٪' : '—' }, warns: r.warns, ref: r.ref };
        show('<b class="big">Cv = ' + r.Cv + '</b> &nbsp; (Kv = ' + r.Kv + ')<br>سایز پیشنهادی: <b>' + esc(r.size) + '</b>' + (r.open ? ' — باز بودن در نقطه طراحی: <b>' + r.open + '٪</b>' : '') +
          r.warns.map(function (w) { return '<div class="twarn">' + esc(w) + '</div>'; }).join('') + '<div class="tref">' + esc(r.ref) + '</div>',
          'Control Valve — Cv=' + r.Cv + ', Size ' + r.size);
      } else if (curTool === 'onoff') {
        var p = T.PIPE[$('ooN').value];
        var ID = p.OD - 2 * p[$('ooS').value][0];
        var r = T.sizeOnOff({ fluid: $('ooF').value, Q: +$('ooQ').value, lineID: ID });
        lastResult = { tool: 'سایزینگ ولو آن/آف', inputs: { 'سیال': $('ooF').selectedOptions[0].text, 'دبی': $('ooQ').value + ' m³/h', 'خط': $('ooN').value + '" ' + $('ooS').value }, outputs: { 'سرعت': r.v + ' m/s', 'حد مجاز': r.vMax + ' m/s', 'نتیجه': r.advice }, warns: [], ref: r.ref };
        show('سرعت سیال: <b class="big">' + r.v + ' m/s</b> (حد راهنما: ' + r.vMax + ')<br>' + esc(r.advice) + '<div class="tref">' + esc(r.ref) + '</div>',
          'On/Off Valve ' + $('ooN').value + '" — line velocity ' + r.v + ' m/s');
      } else if (curTool === 'prv') {
        var r = T.sizePRV({ W: +$('pvW').value, Pset: +$('pvP').value, over: +$('pvO').value, T: +$('pvT').value, M: +$('pvM').value, scenario: $('pvSc').value });
        lastResult = { tool: 'سایزینگ PRV', inputs: { 'سناریو': $('pvSc').selectedOptions[0].text, 'دبی ریلیف': $('pvW').value + ' kg/h', 'فشار ست': $('pvP').value + ' barg', 'Overpressure': $('pvO').value + '٪', 'دما': $('pvT').value + '°C', 'M': $('pvM').value }, outputs: { 'سطح لازم': r.A_cm2 + ' cm² (' + r.A_in2 + ' in²)', 'اریفیس API 526': r.orifice }, warns: r.warns, ref: r.ref };
        show('سطح تخلیه لازم: <b class="big">' + r.A_in2 + ' in²</b> (' + r.A_cm2 + ' cm²)<br>اریفیس پیشنهادی: <b style="font-size:20px;color:var(--red)">' + esc(r.orifice) + '</b>' +
          r.warns.map(function (w) { return '<div class="twarn">' + esc(w) + '</div>'; }).join('') + '<div class="tref">' + esc(r.ref) + '</div>',
          'PSV Orifice ' + r.orifice + ' — Set ' + $('pvP').value + ' barg');
      } else if (curTool === 'press') {
        var r = T.pipePressure({ nps: $('prN').value, sch: $('prS').value, mat: $('prM').value, T: +$('prT').value, E: +$('prE').value, CA: +$('prC').value });
        lastResult = { tool: 'تحمل فشار لوله', inputs: { 'لوله': $('prN').value + '" ' + $('prS').value, 'متریال': $('prM').selectedOptions[0].text, 'دما': $('prT').value + '°C', 'E': $('prE').value, 'CA': $('prC').value + ' mm' }, outputs: { 'فشار مجاز': r.P_bar + ' bar', 'ضخامت موثر': r.tEff + ' mm', 'تنش مجاز': r.S + ' MPa' }, warns: [r.note], ref: r.ref };
        show('حداکثر فشار مجاز: <b class="big">' + r.P_bar + ' bar</b><br>ضخامت موثر: ' + r.tEff + ' mm | تنش مجاز: ' + r.S + ' MPa | E=' + r.E +
          '<div class="twarn">' + esc(r.note) + '</div><div class="tref">' + esc(r.ref) + '</div>',
          'Pipe ' + $('prN').value + '" ' + $('prS').value + ' — MAWP ' + r.P_bar + ' bar');
      } else if (curTool === 'track') {
        var rows = T.trackTable(+$('tkCv').value, $('tkCh').value, +$('tkQ').value);
        lastResult = { tool: 'ترک‌تیبل ولو کنترلی', inputs: { 'Cv max': $('tkCv').value, 'مشخصه': $('tkCh').selectedOptions[0].text, 'Q100': $('tkQ').value }, table: rows, ref: 'مشخصه‌های استاندارد ولو کنترلی (R=50 برای EQ%)' };
        var tbl = '<table class="tt"><tr><th>باز بودن ٪</th>' + rows.map(function (r) { return '<td>' + r.open + '</td>'; }).join('') + '</tr>' +
          '<tr><th>Cv ٪</th>' + rows.map(function (r) { return '<td>' + r.cvPct + '</td>'; }).join('') + '</tr>' +
          '<tr><th>Cv</th>' + rows.map(function (r) { return '<td>' + r.cv + '</td>'; }).join('') + '</tr>' +
          (rows[0].q != null ? '<tr><th>دبی m³/h</th>' + rows.map(function (r) { return '<td>' + r.q + '</td>'; }).join('') + '</tr>' : '') + '</table>';
        show(tbl + '<div class="tref">مشخصه ' + esc($('tkCh').selectedOptions[0].text) + ' — R=50</div>');
      }
    } catch (e) { show('<b style="color:#dc2626">خطا در محاسبه — ورودی‌ها را بررسی کنید</b>'); }
  }

  function addToBasket() {
    var k = $('wtK').value, n = $('wtN').value, q = +$('wtQ').value || 1, m = $('wtM').value;
    var r, lb;
    if (k === 'pipe') { r = T.pipeWeight(n, $('wtS').value, m, q); lb = 'لوله ' + n + '" ' + $('wtS').value + ' × ' + q + 'm'; if (r) r.total = r.total; }
    else if (k === 'flange') { r = T.flangeWeight($('wtC').value, n, q); lb = 'فلنج WN ' + n + '" کلاس ' + $('wtC').value + ' × ' + q; }
    else { r = T.elbowWeight(n, $('wtS').value, m, q); lb = 'الو 90° ' + n + '" ' + $('wtS').value + ' × ' + q; }
    if (!r) { alert('این ترکیب سایز/اسکجول در جدول نیست'); return; }
    basket.push({ lb: lb, w: r.total });
    var sum = basket.reduce(function (s, b) { return s + b.w; }, 0);
    lastResult = { tool: 'محاسبه وزن متریال', basket: basket, sum: sum, ref: 'ASME B36.10 / B16.5 / B16.9 (وزن‌های اسمی)' };
    $('tres').innerHTML = basket.map(function (b, i) {
      return '<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px dashed #eee;font-size:13px"><span>' + esc(b.lb) + '</span><b>' + b.w.toLocaleString('fa-IR') + ' kg</b></div>';
    }).join('') + '<div style="text-align:left;margin-top:8px"><b class="big">جمع: ' + Math.round(sum).toLocaleString('fa-IR') + ' kg</b></div>';
    $('tres').style.display = 'block';
    $('pdfBtn').disabled = false;
  }

  /* ---------- License + PDF / paid report gate (v31.7.97 TOOLS-STAFF-LICENSE-PERSISTENCE-001) ---------- */
  var LICENSE_API = '../api/tools.php';
  var GRANT_KEY = 'ptf_tools_license_grant';
  var GRANT_PERSIST_KEY = GRANT_KEY + '_persist';

  function ptfToolsGrantRecordValid(g) {
    if (!g || !g.grantPayload) return false;
    if ((+g.grantPayload.exp || 0) * 1000 < Date.now()) return false;
    return true;
  }
  function ptfToolsGrantAllowed(g, kind) {
    if (!ptfToolsGrantRecordValid(g)) return false;
    if (kind && g.grantPayload.tool && g.grantPayload.tool !== 'all' && g.grantPayload.tool !== 'control_valve_advanced' && g.grantPayload.tool !== kind) return false;
    return true;
  }
  function ptfToolsReadStoredGrant(storage, key) {
    try { return JSON.parse(storage.getItem(key) || 'null'); } catch (e) { return null; }
  }
  function ptfToolsGrant() {
    var g = ptfToolsReadStoredGrant(sessionStorage, GRANT_KEY);
    if (ptfToolsGrantRecordValid(g)) return g;
    try { sessionStorage.removeItem(GRANT_KEY); } catch (e1) {}
    var pg = ptfToolsReadStoredGrant(localStorage, GRANT_PERSIST_KEY);
    if (ptfToolsGrantRecordValid(pg)) {
      try { sessionStorage.setItem(GRANT_KEY, JSON.stringify(pg)); } catch (e2) {}
      return pg;
    }
    try { localStorage.removeItem(GRANT_PERSIST_KEY); } catch (e3) {}
    return null;
  }
  window.ptfToolsGrant = ptfToolsGrant;
  function ptfToolsHasGrant(kind) {
    return ptfToolsGrantAllowed(ptfToolsGrant(), kind);
  }
  window.ptfToolsHasGrant = ptfToolsHasGrant;

  function ptfToolsStoreGrant(d) {
    try {
      var rec = { grant: d.grant, grantPayload: d.grantPayload, license: d.license, at: new Date().toISOString() };
      sessionStorage.setItem(GRANT_KEY, JSON.stringify(rec));
      var type = (d.grantPayload || {}).type || (d.license || {}).type || '';
      var persistent = !!((d.grantPayload || {}).persistent) || ['staff_internal','enterprise','subscription'].indexOf(type) > -1;
      if (persistent) localStorage.setItem(GRANT_PERSIST_KEY, JSON.stringify(rec));
      else localStorage.removeItem(GRANT_PERSIST_KEY);
    } catch (e) {}
  }
  function ptfToolsClearStoredGrant() {
    try { sessionStorage.removeItem(GRANT_KEY); } catch (e1) {}
    try { localStorage.removeItem(GRANT_PERSIST_KEY); } catch (e2) {}
  }
  window.ptfToolsClearStoredGrant = ptfToolsClearStoredGrant;
  function ptfToolsVerifyStoredGrant() {
    var g = ptfToolsGrant();
    if (!g || !g.grant) return;
    fetch(LICENSE_API + '?action=grant_verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant: g.grant, tool: 'control_valve_advanced' }),
      cache: 'no-store'
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (!d || !d.ok) ptfToolsClearStoredGrant();
    }).catch(function () {});
  }
  window.ptfToolsVerifyStoredGrant = ptfToolsVerifyStoredGrant;

  function ptfToolsCheckLicense(kind) {
    kind = kind || 'control_valve_advanced';
    var inp = document.getElementById('ptfToolsLicenseCode');
    var st = document.getElementById('ptfToolsLicenseStatus');
    var code = inp ? inp.value.trim() : '';
    if (!code) { if (st) st.textContent = 'کد فعال‌سازی را وارد کنید.'; return; }
    if (st) { st.textContent = 'در حال بررسی کد فعال‌سازی...'; st.style.color = '#475569'; }
    try { if (typeof window.ptfTrack === 'function') window.ptfTrack('tools_license_check_start', { tool: kind }); } catch (eT) {}
    fetch(LICENSE_API + '?action=license_check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ license_code: code, tool: 'control_valve_advanced' }),
      cache: 'no-store'
    }).then(function (r) { return r.json().then(function (d) { d._http = r.status; return d; }); })
      .then(function (d) {
        if (!d || !d.ok || !d.grant) throw new Error((d && (d.error || d.message)) || 'کد نامعتبر است');
        ptfToolsStoreGrant(d);
        if (st) { st.textContent = 'فعال‌سازی تایید شد؛ دسترسی این ابزار فعال شد.'; st.style.color = '#059669'; }
        try { if (typeof window.ptfTrack === 'function') window.ptfTrack('tools_license_check_success', { tool: kind, licenseId: (d.license || {}).licenseId || '' }); } catch (eS) {}
        setTimeout(function () { var m = document.getElementById('ptfToolsPaywall'); if (m) m.remove(); if (lastResult) exportPdfPaid(); }, 450);
      })
      .catch(function (err) {
        if (st) { st.textContent = 'فعال‌سازی تایید نشد: ' + (err && err.message ? err.message : err); st.style.color = '#dc2626'; }
        try { if (typeof window.ptfTrack === 'function') window.ptfTrack('tools_license_check_fail', { tool: kind, error: err && err.message ? err.message : String(err || '') }); } catch (eF) {}
      });
  }
  window.ptfToolsCheckLicense = ptfToolsCheckLicense;

  function ptfToolsPaywall(kind) {
    kind = kind || (lastResult && lastResult.tool) || 'گزارش مهندسی';
    try { if (typeof window.ptfTrack === 'function') window.ptfTrack('tools_pdf_paywall_open', { tool: kind }); } catch (eT) {}
    var old = document.getElementById('ptfToolsPaywall');
    if (old) old.remove();
    var msg = 'سلام، درخواست فعال‌سازی گزارش کامل ابزارهای مهندسی PTF را دارم. ابزار: ' + kind;
    var active = ptfToolsHasGrant('control_valve_advanced');
    var html = '<div class="md-b" id="ptfToolsPaywall" style="display:grid;position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:99999;place-items:center;padding:18px" onclick="if(event.target===this)this.remove()">' +
      '<div style="background:#fff;border-radius:22px;border:1px solid #e2e8f0;box-shadow:0 25px 70px rgba(15,23,42,.28);max-width:620px;width:min(620px,96vw);padding:24px;line-height:2;color:#334155">' +
      '<h3 style="margin:0 0 10px;color:#ef4b1a;font-size:20px">گزارش PDF کامل نیازمند فعال‌سازی است</h3>' +
      '<p style="margin:0 0 12px;font-size:14px">محاسبه اولیه رایگان است؛ اما گزارش PDF مهندسی، شماره گزارش، نمودارها، trace فرمول‌ها و ابزارهای پیشرفته از طریق فعال‌سازی غیررایگان/سازمانی ارائه می‌شود.</p>' +
      '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:12px 14px;font-size:13px;margin:12px 0"><b>فاز اول پرداخت:</b> فاکتور/پرداخت دستی و صدور کد فعال‌سازی توسط واحد بازرگانی PTF.<br><b>ابزار درخواستی:</b> ' + esc(kind) + '</div>' +
      '<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:14px;padding:12px;margin:12px 0">' +
      '<label style="display:block;font-size:12px;font-weight:900;color:#9a3412;margin-bottom:5px">کد فعال‌سازی دستی</label>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><input id="ptfToolsLicenseCode" type="text" inputmode="latin" autocomplete="off" placeholder="مثلاً LIC-CV-..." style="flex:1;min-width:220px;padding:9px 12px;border:1.5px solid #fed7aa;border-radius:10px;direction:ltr;font-weight:800"><button type="button" id="ptfToolsLicenseBtn" class="btn btn-primary" style="padding:8px 14px;font-size:13px">بررسی و فعال‌سازی</button></div>' +
      '<div id="ptfToolsLicenseStatus" style="font-size:12px;color:' + (active ? '#059669' : '#92400e') + ';margin-top:6px">' + (active ? 'یک فعال‌سازی معتبر در همین نشست مرورگر وجود دارد.' : 'اگر کد فعال‌سازی ندارید، از مسیرهای زیر درخواست بدهید.') + '</div></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;margin-top:16px">' +
      (active ? '<button type="button" id="ptfToolsPaidPdfBtn" class="btn btn-primary" style="padding:9px 14px;font-size:13px">دریافت گزارش فعال‌شده</button>' : '') +
      '<a class="btn btn-primary" style="padding:9px 14px;font-size:13px" data-ptf-event="tools_activation_rfq" href="../rfq/?activation=tools&tool=advanced_report&item=' + encodeURIComponent('Advanced engineering report — ' + kind) + '">درخواست فعال‌سازی از طریق RFQ</a>' +
      '<a class="btn btn-ghost" style="background:#ecfdf5;color:#047857;padding:9px 14px;font-size:13px" data-ptf-event="tools_activation_whatsapp" target="_blank" rel="noopener" href="https://wa.me/989925868479?text=' + encodeURIComponent(msg) + '">واتساپ واحد فروش</a>' +
      '<button type="button" id="ptfToolsPaywallClose" class="btn btn-ghost" style="background:#f1f5f9;color:#334155;padding:9px 14px;font-size:13px">بستن</button>' +
      '</div></div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    var closeBtn = document.getElementById('ptfToolsPaywallClose');
    if (closeBtn) closeBtn.onclick = function () { var m = document.getElementById('ptfToolsPaywall'); if (m) m.remove(); };
    var licBtn = document.getElementById('ptfToolsLicenseBtn');
    if (licBtn) licBtn.onclick = function () { ptfToolsCheckLicense('control_valve_advanced'); };
    var paidBtn = document.getElementById('ptfToolsPaidPdfBtn');
    if (paidBtn) paidBtn.onclick = function () { var m = document.getElementById('ptfToolsPaywall'); if (m) m.remove(); exportPdfPaid(); };
  }
  window.ptfToolsPaywall = ptfToolsPaywall;

  function exportPdfPaid() {
    if (!lastResult) return;
    var L = lastResult;
    var no = 'PTF-CALC-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + String(calcNo++).padStart(2, '0');
    var rows = '';
    if (L.inputs) rows += '<h3>ورودی‌ها</h3><table>' + Object.keys(L.inputs).map(function (k) { return '<tr><td>' + esc(k) + '</td><td><b>' + esc(L.inputs[k]) + '</b></td></tr>'; }).join('') + '</table>';
    if (L.outputs) rows += '<h3>نتایج</h3><table>' + Object.keys(L.outputs).map(function (k) { return '<tr><td>' + esc(k) + '</td><td><b>' + esc(L.outputs[k]) + '</b></td></tr>'; }).join('') + '</table>';
    if (L.basket) rows += '<h3>اقلام</h3><table>' + L.basket.map(function (b) { return '<tr><td>' + esc(b.lb) + '</td><td><b>' + b.w + ' kg</b></td></tr>'; }).join('') + '<tr><td><b>جمع کل</b></td><td><b>' + Math.round(L.sum) + ' kg</b></td></tr></table>';
    if (L.table) rows += '<h3>ترک‌تیبل</h3><table><tr><th>باز٪</th><th>Cv٪</th><th>Cv</th><th>دبی</th></tr>' + L.table.map(function (r) { return '<tr><td>' + r.open + '</td><td>' + r.cvPct + '</td><td>' + r.cv + '</td><td>' + (r.q != null ? r.q : '—') + '</td></tr>'; }).join('') + '</table>';
    var w = window.open('', '_blank');
    if (!w) { alert('لطفاً popup مرورگر را برای دریافت گزارش فعال کنید.'); return; }
    w.document.write('<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>' + no + '</title><style>' +
      '@page{size:A4 portrait;margin:14mm}body{font-family:Vazirmatn,Tahoma,sans-serif;font-size:12px;color:#222}' +
      '.hd{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #ef4b1a;padding-bottom:8px;margin-bottom:12px}' +
      '.hd img{height:16mm}.hd .no{text-align:left;font-size:11px;color:#555}.paid{background:#ecfdf5;border:1px solid #10b981;color:#047857;border-radius:999px;padding:3px 10px;font-weight:900}' +
      'h2{font-size:16px;color:#ef4b1a;margin:0 0 4px}h3{font-size:13px;margin:12px 0 6px;color:#f79400}' +
      'table{border-collapse:collapse;width:100%;font-size:11.5px}td,th{border:1px solid #999;padding:6px 10px}' +
      '.warn{color:#b45309;font-size:11px;margin-top:8px}.disc{color:#888;font-size:10px;margin-top:14px;border-top:1px solid #ddd;padding-top:6px}' +
      '</style></head><body>' +
      '<div class="hd"><img src="../assets/images/ptf-logo-full.png" alt="PTF"><div class="no"><span class="paid">LICENSED REPORT</span><br>شماره محاسبه: <b dir="ltr">' + no + '</b><br>تاریخ: ' + new Date().toLocaleDateString('fa-IR') + '</div></div>' +
      '<h2>' + esc(L.tool) + '</h2>' + rows +
      (L.warns && L.warns.length ? '<div class="warn">' + L.warns.map(esc).join('<br>') + '</div>' : '') +
      '<div class="disc">مرجع: ' + esc(L.ref || '') + '<br>⚠️ این محاسبه راهنمای اولیه است و مبنای طراحی نهایی نیست — تایید مهندس مسئول/سازنده الزامی است.<br>پیشرو تجهیز فرتاک — pishtaj.ir — 021-46087679</div>' +
      '<script>window.onload=function(){setTimeout(function(){window.print()},400)}<\\/script></body></html>');
    w.document.close();
  }

  function exportPdf() {
    if (!lastResult) return;
    if (ptfToolsHasGrant('control_valve_advanced')) { exportPdfPaid(); return; }
    ptfToolsPaywall(lastResult.tool || curTool);
  }

  try { ptfToolsVerifyStoredGrant(); } catch (eV) {}
  renderTabs();
})();
