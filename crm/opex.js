/* =====================================================================
   PTF CRM — opex.js — v17.7 — US-418 (کیس R9 — فاز ۱ خانواده مالی)
   هزینه‌های جاری شرکت: اجاره، حقوق/دستمزد، بیمه، مالیات، پذیرایی/اداری،
   پورسانت بیرونی، ایاب‌ذهاب/ماموریت، سایر — ماهانه (شمسی) + تکرارشونده.
   اصول:
   - جای نمایش: داخل پنل «تنخواه گردان» (تنخواه = زیرمجموعه هزینه‌ها — مصوبه R9)
     با hook — بدون شکستن petty؛ فقط نقش‌های دارای finance می‌بینند.
   - کلید جدید ptf_crm_opex (سینک + بک‌آپ + سپر داده‌صفر v16.7).
   - هزینه تکرارشونده (اجاره/حقوق): یک‌بار تعریف در settings.opexTpl؛
     هر ماه «پیشنهاد ثبت» با تایید کاربر — هیچ ثبت خودکار بی‌صدا (قاعده ایمنی).
   - مصرف‌کننده آینده: US-420 (داشبورد سال مالی) — جمع per ماه/دسته/سال از همین کلید.
   ===================================================================== */
(function () {
  'use strict';

  var K = 'ptf_crm_opex';
  window.PTF_OPEX_CATS = ['اجاره‌بها', 'حقوق و دستمزد', 'بیمه', 'مالیات', 'پذیرایی و اداری', 'پورسانت بیرونی', 'ایاب‌ذهاب و ماموریت', 'سایر'];

  function oAll() { return getData(K); }
  function oSave(l) { setData(K, l); }
  function canFin() { try { return !!(roleDef() || {}).finance; } catch (e) { return false; } }
  function fmtT(v) { return (+v || 0).toLocaleString('fa-IR'); }

  /* ماه شمسی جاری «1405/04» — ورودی دستی هم پذیرفته می‌شود */
  window.ptfFaMonthNow = function () {
    try {
      var p = new Date().toLocaleDateString('fa-IR-u-nu-latn').split('/');
      return p[0] + '/' + ('0' + p[1]).slice(-2);
    } catch (e) {
      try { return faDate().split('/').slice(0, 2).join('/'); } catch (e2) { return ''; }
    }
  };
  function normMonth(m) {
    m = String(m || '').trim().replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); });
    var mt = m.match(/^(\d{4})[\/\-](\d{1,2})$/);
    if (!mt) return '';
    return mt[1] + '/' + ('0' + mt[2]).slice(-2);
  }

  /* ---------- جمع‌ها (مصرف: پنل + US-420 آینده) ---------- */
  window.ptfOpexSum = function (monthOrYear) {
    var pre = String(monthOrYear || '');
    var out = { total: 0, byCat: {}, totalLinked:0, totalUnlinked:0 };
    oAll().forEach(function (x) {
      if (pre && String(x.month || '').indexOf(pre) !== 0) return;
      var amt=(+x.amt||0);
      out.total += amt;
      out.byCat[x.cat] = (out.byCat[x.cat] || 0) + amt;
      if(x.dealRef){
        out.totalLinked+=amt;
      }else{
        out.totalUnlinked+=amt;
      }
    });
    return out;
  };
  // v30.2 FIN-WF-008: برای جلوگیری از دوباره‌شماری، fiscal فقط unlinked را می‌خواهد
  window.ptfOpexSumFiscal = function(monthOrYear){
    var s=window.ptfOpexSum(monthOrYear);
    // فقط هزینه‌های مستقل از پرونده در سود سال کم می‌شود، لینک‌شده در سود پروژه کم شده
    return { total: s.totalUnlinked, byCat: s.byCat, totalLinked: s.totalLinked, totalUnlinked: s.totalUnlinked };
  };


  /* ---------- قالب‌های تکرارشونده (settings.opexTpl — سینک‌شونده) ---------- */
  function tpls() {
    try { return (JSON.parse(localStorage.getItem('ptf_crm_settings') || '{}').opexTpl) || []; } catch (e) { return []; }
  }
  function saveTpls(list) {
    var st = {};
    try { st = JSON.parse(localStorage.getItem('ptf_crm_settings') || '{}'); } catch (e) {}
    st.opexTpl = list;
    setData('ptf_crm_settings', st);
  }
  /* قالب‌هایی که برای ماه جاری هنوز ثبت نشده‌اند */
  window.ptfOpexPendingTpls = function (month) {
    var m = month || ptfFaMonthNow();
    if (!m) return [];
    var list = oAll();
    return tpls().filter(function (t) {
      return !list.some(function (x) { return x.tplId === t.id && x.month === m; });
    });
  };

  /* ---------- ثبت هزینه ---------- */
  window.ptfOpexAdd = function (pre) {
    if (!canFin()) { alert('⛔ هزینه‌های جاری فقط برای نقش‌های مالی (US-418)'); return; }
    pre = pre || {};
    var catOpts = PTF_OPEX_CATS.map(function (c) { return '<option' + (pre.cat === c ? ' selected' : '') + '>' + c + '</option>'; }).join('');
    var dealOpts = '<option value="">— مستقل از پرونده فروش —</option>' + (getData('ptf_crm_deals') || []).filter(function (d) { return d.wonOffer && d.st !== 'archived'; }).map(function (d) { return '<option value="' + escP(d.cd) + '">' + escP(d.inqNo || d.cd) + ' — ' + escP(d.buyerCo || '') + '</option>'; }).join('');
    ptfDialog({
      title: '🏢 ثبت هزینه جاری شرکت',
      body: 'همه مبالغ به ریال — مبنای محاسبه سود خالص سال مالی (کیس R9). در صورت انتخاب پرونده فروش، هزینه به همان پرونده هم متصل می‌شود.',
      fields: [
        { id: 'cat', label: 'دسته هزینه', type: 'select', optionsHtml: catOpts },
        { id: 'isOfficial', label: 'نوع سند هزینه', type: 'select', optionsHtml: '<option value="no" selected>غیررسمی (بدون فاکتور ممیزپسند)</option><option value="yes">رسمی (فاکتور رسمی/قابل قبول ممیز)</option>' },
        { id: 'amt', label: 'مبلغ (ریال) *', type: 'number', value: pre.amt || '', dir: 'ltr', required: true },
        { id: 'month', label: 'ماه شمسی (مثلا 1405/04) *', type: 'text', value: pre.month || ptfFaMonthNow(), required: true },
        { id: 'desc', label: 'شرح', type: 'text', value: pre.desc || '' },
        { id: 'dealRef', label: 'مربوط به کدام درخواست/پرونده فروش؟', type: 'select', optionsHtml: dealOpts },
        { id: 'rec', label: 'تکرارشونده ماهانه؟ (اجاره/حقوق — هر ماه پیشنهاد ثبت می‌آید)', type: 'select', optionsHtml: '<option value="no" selected>خیر — یک‌باره</option><option value="yes">بله — هر ماه پیشنهاد شود</option>' }
      ],
      okText: 'ثبت هزینه',
      onOk: function (v) {
        var amt = +v.amt || 0;
        var month = normMonth(v.month);
        if (amt <= 0) { alert('⛔ مبلغ نامعتبر'); return; }
        if (!month) { alert('⛔ ماه شمسی مثل 1405/04 وارد کنید'); return; }
        var isOfficial = v.isOfficial === 'yes';
        var rec = { cd: genCode('OPX'), cat: v.cat, amt: amt, month: month, desc: v.desc || '', dealRef: v.dealRef || '', t: faDate(), by: curSession().name, isOfficial: isOfficial };
        if (pre.tplId) rec.tplId = pre.tplId;
        if (v.rec === 'yes' && !pre.tplId) {
          var list = tpls();
          var tid = 'TPL-' + Date.now();
          list.push({ id: tid, cat: v.cat, amt: amt, desc: v.desc || '', by: curSession().name, t: faDate() });
          saveTpls(list);
          rec.tplId = tid;
        }
        var all = oAll();
        all.unshift(rec);
        oSave(all);
        if (rec.dealRef) {
          try {
            var ds = getData('ptf_crm_deals');
            var d = ds.filter(function (x) { return x.cd === rec.dealRef; })[0];
            if (d) {
              d.costEvents = d.costEvents || [];
              d.costEvents.unshift({ cd: rec.cd, amt: amt, cat: 'other', desc: '[هزینه جاری] ' + (v.desc || v.cat), by: curSession().name, t: faDateTime(), files: [], fromOpex: true });
              d.timeline = d.timeline || [];
              d.timeline.push({ t: faDateTime(), by: curSession().name, tx: '➕ لینک هزینه جاری به پرونده: ' + fmtT(amt) + ' ریال — ' + (v.desc || v.cat) });
              setData('ptf_crm_deals', ds);
            }
          } catch (eD) {}
        }
        try { audit('هزینه جاری', 'ثبت ' + v.cat + ' — ' + fmtT(amt) + ' ریال (' + month + ')' + (rec.tplId ? ' [تکرارشونده]' : '') + (rec.dealRef ? ' [linked-deal]' : ''), rec.cd); } catch (eA) {}
        if (typeof ptfToast === 'function') ptfToast('✅ هزینه ثبت شد' + (rec.dealRef ? ' و به پرونده فروش متصل شد' : ''), 'ok');
        if (typeof renderDeals === 'function') { try { renderDeals(); } catch (eR) {} }
        ptfOpexRender();
      }
    });
  };

  window.ptfOpexDel = function (cd) {
    if (!canFin()) return;
    var rec = oAll().filter(function (x) { return x.cd === cd; })[0];
    if (!rec) return;
    // v29.3 FIN-WF-004: قفل سال مالی
    try {
      var y = String((rec.month||'').split('/')[0]||'').trim();
      if(y){
        var snaps=getData('ptf_crm_fiscal_snapshots')||[];
        if(snaps.some(function(s){ return String(s.year)===String(y) && s.locked; })){
          alert('🔒 سال مالی '+y+' قفل است - حذف هزینه جاری در سال قفل‌شده مجاز نیست. سند اصلاحی ثبت کنید.');
          return;
        }
      }
    } catch(e){}
    if (!confirm('🗑 حذف هزینه «' + rec.cat + ' — ' + fmtT(rec.amt) + ' ریال» (' + rec.month + ')؟')) return;
    oSave(oAll().filter(function (x) { return x.cd !== cd; }));
    if (rec.dealRef) {
      try {
        var ds = getData('ptf_crm_deals');
        var d = ds.filter(function (x) { return x.cd === rec.dealRef; })[0];
        if (d) {
          d.costEvents = (d.costEvents || []).filter(function (x) { return x.cd !== cd; });
          d.timeline = d.timeline || [];
          d.timeline.push({ t: faDateTime(), by: curSession().name, tx: '🗑 حذف هزینه جاری لینک‌شده از پرونده: ' + fmtT(rec.amt) + ' ریال — ' + (rec.desc || rec.cat) });
          setData('ptf_crm_deals', ds);
        }
      } catch (eD) {}
    }
    try { audit('هزینه جاری', 'حذف هزینه ' + rec.cat + ' ' + fmtT(rec.amt) + ' ریال (' + rec.month + ')', cd); } catch (eA) {}
    if (typeof renderDeals === 'function') { try { renderDeals(); } catch (eR) {} }
    ptfOpexRender();
  };

  window.ptfOpexEdit = function (cd) {
    if (!canFin()) return;
    var rec = oAll().filter(function (x) { return x.cd === cd; })[0];
    if (!rec) return;
    // چک قفل سال
    try {
      var y = String((rec.month||'').split('/')[0]||'').trim();
      if(y){
        var snaps=getData('ptf_crm_fiscal_snapshots')||[];
        if(snaps.some(function(s){ return String(s.year)===String(y) && s.locked; })){
          alert('🔒 سال مالی '+y+' قفل است - ویرایش هزینه جاری در سال قفل‌شده مجاز نیست. سند اصلاحی ثبت کنید.');
          return;
        }
      }
    } catch(e){}
    var catOpts = PTF_OPEX_CATS.map(function (c) { return '<option' + (rec.cat === c ? ' selected' : '') + '>' + c + '</option>'; }).join('');
    var dealOpts = '<option value=\"\">— مستقل از پرونده فروش —</option>' + (getData('ptf_crm_deals') || []).filter(function (d) { return d.wonOffer && d.st !== 'archived'; }).map(function (d) { return '<option value=\"' + escP(d.cd) + '\"' + (rec.dealRef===d.cd?' selected':'') + '>' + escP(d.inqNo || d.cd) + ' — ' + escP(d.buyerCo || '') + '</option>'; }).join('');
    ptfDialog({
      title: '✏️ ویرایش هزینه جاری - ' + rec.cd,
      body: 'مبلغ به ریال است - در صورت اصلاح واحد مبلغ قدیمی، دلیل را در شرح بنویسید. ویرایش audit می‌شود.',
      fields: [
        { id: 'cat', label: 'دسته هزینه', type: 'select', optionsHtml: catOpts },
        { id: 'amt', label: 'مبلغ (ریال) *', type: 'number', value: rec.amt, dir: 'ltr', required: true },
        { id: 'month', label: 'ماه شمسی', type: 'text', value: rec.month, required: true },
        { id: 'desc', label: 'شرح', type: 'text', value: rec.desc || '' },
        { id: 'dealRef', label: 'پرونده فروش', type: 'select', optionsHtml: dealOpts }
      ],
      okText: 'ذخیره ویرایش',
      onOk: function(v){
        var oldAmt = rec.amt;
        var newAmt = +v.amt || 0;
        var newMonth = (function(m){ m=String(m||'').trim(); var mt=m.match(/^(\d{4})[\/\-](\d{1,2})$/); if(!mt) return ''; return mt[1]+'/'+('0'+mt[2]).slice(-2); })(v.month);
        if(newAmt<=0){ alert('⛔ مبلغ نامعتبر'); return; }
        if(!newMonth){ alert('⛔ ماه مثل 1405/04'); return; }
        // چک قفل سال جدید هم
        try {
          var ny = newMonth.split('/')[0];
          var snaps2=getData('ptf_crm_fiscal_snapshots')||[];
          if(snaps2.some(function(s){ return String(s.year)===String(ny) && s.locked; })){
            alert('🔒 سال مالی جدید '+ny+' قفل است');
            return;
          }
        } catch(e){}
        rec.cat = v.cat; rec.amt = newAmt; rec.month = newMonth; rec.desc = v.desc||''; 
        var oldDeal = rec.dealRef; rec.dealRef = v.dealRef||'';
        rec.editedAt = faDateTime(); rec.editedBy = (typeof curSession==='function'?curSession().name:'');
        // به‌روزرسانی costEvents پرونده ها
        try {
          var ds=getData('ptf_crm_deals');
          // حذف از پرونده قدیم اگر تغییر کرد
          if(oldDeal && oldDeal!==rec.dealRef){
            var dOld=ds.filter(function(x){ return x.cd===oldDeal; })[0];
            if(dOld){ dOld.costEvents=(dOld.costEvents||[]).filter(function(x){ return x.cd!==rec.cd; }); }
          }
          // اضافه/آپدیت در پرونده جدید
          if(rec.dealRef){
            var dNew=ds.filter(function(x){ return x.cd===rec.dealRef; })[0];
            if(dNew){
              dNew.costEvents=dNew.costEvents||[];
              var ev=dNew.costEvents.filter(function(x){ return x.cd===rec.cd; })[0];
              if(ev){ ev.amt=newAmt; ev.desc='[هزینه جاری ویرایش] '+(v.desc||v.cat); }
              else {
                dNew.costEvents.unshift({ cd: rec.cd, amt: newAmt, cat: 'other', desc: '[هزینه جاری] '+(v.desc||v.cat), by: rec.editedBy, t: faDateTime(), files: [], fromOpex: true });
              }
              dNew.timeline=dNew.timeline||[];
              dNew.timeline.push({ t: faDateTime(), by: rec.editedBy, tx: '✏️ ویرایش هزینه جاری لینک‌شده: ' + oldAmt.toLocaleString('fa-IR') + ' → ' + newAmt.toLocaleString('fa-IR') + ' ریال' });
            }
          }
          setData('ptf_crm_deals', ds);
        } catch(e){}
        // ذخیره opex
        var all=oAll(); for(var i=0;i<all.length;i++){ if(all[i].cd===cd){ all[i]=rec; break; } }
        oSave(all);
        try { audit('هزینه جاری', 'ویرایش هزینه '+rec.cat+' '+oldAmt+' → '+newAmt+' ریال ('+newMonth+')', cd); } catch(e){}
        if(typeof ptfToast==='function') ptfToast('✅ هزینه ویرایش شد', 'ok');
        if(typeof renderDeals==='function'){ try{ renderDeals(); }catch(e){} }
        ptfOpexRender();
      }
    });
  };

  /* ثبت یک‌کلیکی قالب برای ماه جاری (با confirm — قاعده ایمنی) */
  window.ptfOpexApplyTpl = function (tid) {
    var t = tpls().filter(function (x) { return x.id === tid; })[0];
    if (!t) return;
    var m = ptfFaMonthNow();
    if (!confirm('🔁 ثبت هزینه تکرارشونده «' + t.cat + '» ماه ' + m + '؟\n\nمبلغ: ' + fmtT(t.amt) + ' ریال' + (t.desc ? '\nشرح: ' + t.desc : ''))) return;
    var all = oAll();
    all.unshift({ cd: genCode('OPX'), cat: t.cat, amt: +t.amt, month: m, desc: t.desc || '', tplId: t.id, t: faDate(), by: curSession().name });
    oSave(all);
    try { audit('هزینه جاری', 'ثبت تکرارشونده ' + t.cat + ' — ' + fmtT(t.amt) + ' ریال (' + m + ')', t.id); } catch (eA) {}
    ptfOpexRender();
  };
  window.ptfOpexDelTpl = function (tid) {
    var t = tpls().filter(function (x) { return x.id === tid; })[0];
    if (!t) return;
    if (!confirm('حذف قالب تکرارشونده «' + t.cat + ' — ' + fmtT(t.amt) + ' ریال»؟ (هزینه‌های ثبت‌شده قبلی دست نمی‌خورند)')) return;
    saveTpls(tpls().filter(function (x) { return x.id !== tid; }));
    try { audit('هزینه جاری', 'حذف قالب تکرارشونده ' + t.cat, tid); } catch (eA) {}
    ptfOpexRender();
  };

  /* ---------- رندر باکس داخل پنل تنخواه ---------- */
  window.ptfOpexRender = function () {
    var el = document.getElementById('opexBox');
    if (!el) return;
    var m = window._opexMonth || ptfFaMonthNow();
    var year = m ? m.split('/')[0] : '';
    var sm = ptfOpexSum(m);
    var sy = ptfOpexSum(year);
    var pend = ptfOpexPendingTpls(ptfFaMonthNow());
    var pendHtml = pend.length
      ? '<div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:8px 12px;margin-bottom:8px;font-size:12px">' +
        '🔁 <b>هزینه‌های تکرارشونده ماه جاری که هنوز ثبت نشده‌اند:</b> ' +
        pend.map(function (t) { return '<button class="bt bt-o" style="padding:3px 10px;font-size:11.5px;margin:2px" onclick="ptfOpexApplyTpl(\'' + escP(t.id) + '\')">' + escP(t.cat) + ' — ' + fmtT(t.amt) + ' ریال ➕</button>'; }).join(' ') + '</div>'
      : '';
    var chips = Object.keys(sm.byCat).map(function (c) {
      return '<span style="background:#f1f5f9;border-radius:999px;padding:4px 11px;font-size:11.5px">' + escP(c) + ': <b>' + fmtT(sm.byCat[c]) + '</b> ریال</span>';
    }).join(' ');
    var rows = oAll().filter(function (x) { return !m || x.month === m; }).map(function (x) {
      return '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;padding:6px 0;border-bottom:1px dashed var(--brd);font-size:12.5px">' +
        '<span><b>' + fmtT(x.amt) + ' ریال</b> — ' + escP(x.cat) + (x.tplId ? ' <span class="bd" style="background:#ede9fe;color:#6d28d9;font-size:10px">🔁</span>' : '') +
        (x.dealRef ? ' <span class="bd" style="background:#ecfdf5;color:#166534;font-size:10px">📁 پرونده فروش</span>' : '') +
        (x.desc ? ' <small style="color:#64748b">' + escP(x.desc) + '</small>' : '') +
        (x.editedAt ? ' <small style="color:#0e7490">✏️ ویرایش: ' + escP(x.editedAt) + '</small>' : '') +
        '<br><small style="color:#94a3b8">' + escP(x.month) + ' | ثبت: ' + escP(x.t) + ' — ' + escP(x.by) + (x.dealRef ? ' | لینک: ' + escP(x.dealRef) : '') + '</small></span>' +
        '<span style="display:flex;gap:4px"><button class="bt bt-o" style="padding:3px 9px;font-size:11.5px" onclick="ptfOpexEdit(\'' + escP(x.cd) + '\')">✏️</button><button class="bt bt-o" style="padding:3px 9px;font-size:11.5px;color:#dc2626" onclick="ptfOpexDel(\'' + escP(x.cd) + '\')">✕</button></span></div>';
    }).join('');
    var tplRows = tpls().map(function (t) {
      return '<span style="background:#ede9fe;border-radius:999px;padding:4px 11px;font-size:11.5px">🔁 ' + escP(t.cat) + ' — ' + fmtT(t.amt) + ' ریال <a href="javascript:void(0)" onclick="ptfOpexDelTpl(\'' + escP(t.id) + '\')" style="color:#dc2626;text-decoration:none">✕</a></span>';
    }).join(' ');
    el.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:8px">' +
      '<h4 style="margin:0;font-size:13.5px">🏢 هزینه‌های جاری شرکت (US-418)</h4>' +
      '<span style="display:flex;gap:6px;align-items:center">' +
      '<input type="text" value="' + escP(m) + '" onchange="window._opexMonth=this.value.trim();ptfOpexRender()" style="width:90px;padding:6px;border:1.5px solid var(--brd);border-radius:9px;direction:ltr;font-size:12px" title="ماه شمسی — خالی = همه">' +
      '<button class="bt" style="font-size:12px" onclick="ptfOpexAdd()">+ ثبت هزینه</button></span></div>' +
      pendHtml +
      '<div style="font-size:12.5px;margin-bottom:6px">جمع ماه <b dir="ltr">' + escP(m || '—') + '</b>: <b style="color:#b45309">' + fmtT(sm.total) + ' ریال</b> | جمع سال ' + escP(year) + ': <b>' + fmtT(sy.total) + ' ریال</b></div>' +
      (chips ? '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px">' + chips + '</div>' : '') +
      (rows || '<div style="color:#94a3b8;font-size:12px;padding:6px 0">هزینه‌ای برای این ماه ثبت نشده</div>') +
      (tplRows ? '<div style="margin-top:8px;font-size:11.5px;color:#64748b">قالب‌های تکرارشونده: ' + tplRows + '</div>' : '');
  };

  /* ---------- hook پنل تنخواه (تنخواه = زیرمجموعه هزینه‌ها — R9) ---------- */
  function hookPetty() {
    if (window._opexHooked || typeof window.buildPetty !== 'function') return false;
    window._opexHooked = true;
    var _bp = window.buildPetty;
    window.buildPetty = function () {
      var box = canFin()
        ? '<div id="opexBox" style="background:var(--crd,#fff);border:1px solid #fcd34d;border-radius:14px;padding:12px 14px;margin-bottom:14px"></div>'
        : '';
      return box + _bp();
    };
    var _rp = window.renderPetty;
    if (typeof _rp === 'function') {
      window.renderPetty = function () {
        _rp();
        try { if (canFin()) ptfOpexRender(); } catch (e) {}
      };
    }
    return true;
  }
  var tries = 0;
  var t = setInterval(function () { tries++; if (hookPetty() || tries > 50) clearInterval(t); }, 350);
})();
