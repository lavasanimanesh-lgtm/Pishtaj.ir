/* =====================================================================
   PTF CRM — datex.js — v20.5
   US-446: تاریخ شمسی در UI نرم‌افزار؛ ISO فقط برای محاسبه و قالب‌های انگلیسی
   API:
     ptfTodayJ()                 -> 1405/04/19
     ptfISOToJ('2026-07-10')     -> 1405/04/19
     ptfJToISO('۱۴۰۵/۰۴/۱۹')     -> 2026-07-10
   ===================================================================== */
(function(){
  'use strict';
  function div(a,b){ return ~~(a / b); }
  function pad(n){ return String(n).padStart(2,'0'); }
  function g2d(gy, gm, gd){
    var d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * ((gm + 9) % 12) + 2, 5) + gd - 34840408;
    d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
    return d;
  }
  function d2g(jdn){
    var j = 4 * jdn + 139361631;
    j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
    var i = div((j % 1461), 4) * 5 + 308;
    var gd = div((i % 153), 5) + 1;
    var gm = (div(i, 153) % 12) + 1;
    var gy = div(j, 1461) - 100100 + div(8 - gm, 6);
    return { gy: gy, gm: gm, gd: gd };
  }
  var breaks = [-61,9,38,199,426,686,756,818,1111,1181,1210,1635,2060,2097,2192,2262,2324,2394,2456,3178];
  function jalCal(jy){
    var bl = breaks.length, gy = jy + 621, leapJ = -14, jp = breaks[0], jm, jump, leap, n, i;
    if (jy < jp || jy >= breaks[bl-1]) throw new Error('Invalid Jalali year ' + jy);
    for (i=1; i<bl; i++){ jm = breaks[i]; jump = jm - jp; if (jy < jm) break; leapJ += div(jump,33)*8 + div((jump%33),4); jp = jm; }
    n = jy - jp;
    leapJ += div(n,33)*8 + div(((n%33)+3),4);
    if ((jump%33) === 4 && jump - n === 4) leapJ += 1;
    var leapG = div(gy,4) - div((div(gy,100)+1)*3,4) - 150;
    var march = 20 + leapJ - leapG;
    if (jump - n < 6) n = n - jump + div((jump+4),33)*33;
    leap = (((n+1)%33)-1)%4;
    if (leap === -1) leap = 4;
    return { leap: leap, gy: gy, march: march };
  }
  function j2d(jy,jm,jd){ var r=jalCal(jy); return g2d(r.gy,3,r.march)+(jm-1)*31-div(jm,7)*(jm-7)+jd-1; }
  function d2j(jdn){
    var gy = d2g(jdn).gy;
    var jy = gy - 621;
    var r = jalCal(jy);
    var jdn1f = g2d(gy, 3, r.march);
    var k = jdn - jdn1f;
    var jm, jd;
    if (k >= 0) {
      if (k <= 185) { jm = 1 + div(k,31); jd = (k%31)+1; return { jy: jy, jm: jm, jd: jd }; }
      k -= 186;
    } else {
      jy -= 1;
      k += 179;
      if (r.leap === 1) k += 1;
    }
    jm = 7 + div(k,30); jd = (k%30)+1;
    return { jy: jy, jm: jm, jd: jd };
  }
  window.ptfDigitsEn = function(s){ return String(s||'').replace(/[۰-۹]/g,function(d){return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d);}).replace(/[٠-٩]/g,function(d){return '٠١٢٣٤٥٦٧٨٩'.indexOf(d);}); };
  window.ptfJNormalize = function(j){
    j = ptfDigitsEn(j).replace(/-/g,'/').replace(/\s/g,'');
    var m = j.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (!m) return '';
    var jy=+m[1], jm=+m[2], jd=+m[3];
    if (jm<1||jm>12||jd<1||jd>31) return '';
    return jy + '/' + pad(jm) + '/' + pad(jd);
  };
  window.ptfJToISO = function(j){
    var n = ptfJNormalize(j); if (!n) return '';
    var a = n.split('/').map(Number);
    try { var g = d2g(j2d(a[0],a[1],a[2])); return g.gy + '-' + pad(g.gm) + '-' + pad(g.gd); } catch(e){ return ''; }
  };
  window.ptfISOToJ = function(iso){
    iso = String(iso||'').slice(0,10);
    var m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!m) return '';
    try { var j = d2j(g2d(+m[1],+m[2],+m[3])); return j.jy + '/' + pad(j.jm) + '/' + pad(j.jd); } catch(e){ return ''; }
  };
  window.ptfTodayISO = function(){ return new Date().toISOString().slice(0,10); };
  window.ptfTodayJ = function(){ return ptfISOToJ(ptfTodayISO()); };
  /* v22.0 audited: ورودی تاریخ شمسی یکپارچه — دکمه تقویم خارج از خود فیلد تا متن تاریخ خراب نشود */
  window.ptfDatePicker = function(id, iso, ph){
    return '<div style="position:relative;display:block;width:100%">' +
      '<input type="text" id="'+id+'" value="'+(ptfISOToJ(iso)||'')+'" placeholder="'+(ph||'1405/04/19')+'" style="direction:ltr;color:#0e7490;width:100%;padding:9px 11px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:inherit;font-size:13.5px;box-sizing:border-box">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:6px;flex-wrap:wrap">' +
        '<button type="button" onclick="ptfCalShow(\''+id+'\')" style="background:#f8fafc;border:1px solid var(--brd);border-radius:8px;padding:5px 10px;cursor:pointer;font-size:12px;color:#0e7490">📅 انتخاب از تقویم</button>' +
        '<button type="button" onclick="ptfCalPickToday(\''+id+'\')" style="background:#fff;border:1px dashed var(--brd);border-radius:8px;padding:5px 10px;cursor:pointer;font-size:11.5px;color:#64748b">امروز</button>' +
      '</div>' +
      '<div id="'+id+'_cal" style="display:none;position:relative;margin-top:6px;z-index:200;background:#fff;border:1px solid var(--brd);border-radius:12px;padding:10px;box-shadow:0 12px 34px rgba(0,0,0,.10);width:100%;max-width:280px"></div></div>';
  };
  window.ptfDateInput = function(id, iso, ph){ return window.ptfDatePicker(id, iso, ph); };
  window.ptfCalShow = function(inputId){
    var box = document.getElementById(inputId + '_cal');
    if (!box) return;
    var visible = box.style.display === 'block';
    document.querySelectorAll('[id$="_cal"]').forEach(function(c){ c.style.display = 'none'; });
    if (visible) { box.style.display = 'none'; return; }
    var val = document.getElementById(inputId).value || ptfTodayJ();
    var parts = ptfJNormalize(val).split('/');
    var jy = +parts[0] || +ptfTodayJ().split('/')[0];
    var jm = +parts[1] || +ptfTodayJ().split('/')[1];
    ptfCalRender(box, inputId, jy, jm);
    box.style.display = 'block';
  };
  window.ptfCalRender = function(box, inputId, jy, jm){
    var today = ptfTodayJ().split('/').map(Number);
    var val = document.getElementById(inputId).value || '';
    var valNorm = ptfJNormalize(val);
    function j2g(y,m,d){ try{ var g=d2g(j2d(y,m,d)); return g.gy+'-'+pad(g.gm)+'-'+pad(g.gd); }catch(e){ return ''; } }
    function g2j(iso){ return ptfISOToJ(iso); }
    var firstISO = j2g(jy, jm, 1);
    var firstDay = new Date(firstISO + 'T12:00:00').getDay();
    firstDay = (firstDay + 1) % 7;
    var daysInMonth = 31;
    if (jm > 6 && jm < 12) daysInMonth = 30;
    if (jm === 12) { var jc = jalCal(jy); daysInMonth = jc.leap ? 30 : 29; }
    var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
      '<button type="button" onclick="ptfCalRender(this.closest(\'[id$=_cal]\'),\''+inputId+'\','+(jy-(jm===1?1:0))+','+(jm===1?12:jm-1)+')" style="background:none;border:none;cursor:pointer;font-size:14px">◀</button>' +
      '<b style="font-size:13px">'+jy+' / '+pad(jm)+'</b>' +
      '<button type="button" onclick="ptfCalRender(this.closest(\'[id$=_cal]\'),\''+inputId+'\','+(jy+(jm===12?1:0))+','+(jm===12?1:jm+1)+')" style="background:none;border:none;cursor:pointer;font-size:14px">▶</button></div>' +
      '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center;font-size:11px;color:#64748b;margin-bottom:4px"><div>ش</div><div>ی</div><div>د</div><div>س</div><div>چ</div><div>پ</div><div>ج</div></div>' +
      '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px">';
    for (var i = 0; i < firstDay; i++) html += '<div></div>';
    for (var d = 1; d <= daysInMonth; d++) {
      var jStr = jy + '/' + pad(jm) + '/' + pad(d);
      var isToday = jStr === ptfTodayJ();
      var isSelected = valNorm === jStr;
      var bg = isSelected ? '#0e7490;color:#fff' : (isToday ? '#f0f9ff;color:#0e7490;border:1px solid #bae6fd' : 'transparent;color:#1e293b');
      html += '<button type="button" onclick="ptfCalPick(\''+inputId+'\','+jy+','+jm+','+d+')" style="background:'+bg+';border:none;border-radius:8px;padding:6px 0;cursor:pointer;font-size:12px;font-family:inherit">'+d+'</button>';
    }
    html += '</div>';
    box.innerHTML = html;
  };
  window.ptfCalPick = function(inputId, jy, jm, jd){
    var jStr = jy + '/' + pad(jm) + '/' + pad(jd);
    document.getElementById(inputId).value = jStr;
    var box = document.getElementById(inputId + '_cal');
    if (box) box.style.display = 'none';
    var faEl = document.getElementById(inputId + 'Fa');
    if (faEl) faEl.textContent = '✓ ' + jStr;
    var iso = ptfJToISO(jStr);
    if (iso) {
      var isoEl = document.getElementById(inputId + 'ISO');
      if (isoEl) isoEl.value = iso;
    }
  };
  window.ptfCalPickToday = function(inputId){
    var j = ptfTodayJ();
    var a = j.split('/').map(Number);
    if (a.length === 3) ptfCalPick(inputId, a[0], a[1], a[2]);
  };
  document.addEventListener('click', function(e){
    if (!e.target.closest('[id$="_cal"]') && !e.target.closest('button[onclick*="ptfCalShow"]')) {
      document.querySelectorAll('[id$="_cal"]').forEach(function(c){ c.style.display = 'none'; });
    }
  });
})();
