/* =====================================================================
   PTF CRM — cheques.js — v25.4 (ضمانت بدون یادآور + لینک پرونده + چاپ)
   US-327: ثبت چک‌های صادره + یادآور روزانه از ۷ روز قبل از سررسید (ماژول شخصی)
   US-330: متن‌های از پیش آماده با متغیر نام مخاطب (مشتری/تامین‌کننده/سایر)
   US-331: تب تامین‌کنندگان داخلی / خارجی
   ===================================================================== */
(function () {
  'use strict';

  var K = 'ptf_crm_cheques';

  /* ============ US-327: چک‌های صادره ============ */
  function chPersonalKey(){ return 'ptf_personal_cheques_' + ((curSession()||{}).user||'_'); }
  function chPersonalAll(){ try{return JSON.parse(localStorage.getItem(chPersonalKey())||'[]')}catch(e){return[]} }
  // v31.7.4 BUG-AUDIT-007 FIXED: Add ownership filter to prevent personal cheques from leaking into company reports
  function chAll() { 
    var company = getData(K) || [];
    var personal = chPersonalAll();
    // Filter: company cheques should not include personal ownership
    var filteredCompany = company.filter(function(c) { 
      return !c || c.ownership !== 'personal'; 
    });
    return filteredCompany.concat(personal); 
  }
  function chMine() {
    var me = (curSession() || {}).user || '';
    return chAll().filter(function (c) { return !me || c.by === me; });
  }
  function chSave(l) {
    /* FW-C01 (ممیزی ۱۴۰۵/۰۵/۰۷ — crm/AUDIT-FINANCIAL-SYSTEM-2026-07-29.md، تصمیم صریح کارفرما:
       «الان به آن رسیدگی کن»):
       chAll() یک رکورد چک شخصی legacy که هنوز در کلید global (K) مانده
       باشد را کاملاً از دید مخفی می‌کند — حتی اگر صاحب آن خودِ کاربر فعلی
       باشد (فیلتر ownership!=='personal' برای بخش global بدون قید مالک).
       یعنی چنین رکوردی هرگز در آرایه‌ی ورودی این تابع (l، که از chAll()
       گرفته شده) دیده نمی‌شود؛ و چون chSave همیشه کل کلید شخصیِ کاربر
       فعلی را با «mine» (برگرفته از l) جایگزین می‌کند، آن رکورد legacy
       برای همیشه از بین می‌رفت.
       راه‌حل idempotent و خودترمیم‌شونده، بدون خطر «زنده‌کردن» رکورد
       حذف‌شده‌ی عمدی کاربر: پیش از هر overwrite، وضعیت کلید شخصیِ کاربر
       فعلی را قبل و بعد از اجرای migration مقایسه می‌کنیم. هر رکوردی که
       فقط بعد از migration ظاهر شده (delta) — یعنی legacy‌ای که همین الان
       اولین‌بار منتقل شد و در l هرگز دیده نشده بود — به «mine» اضافه
       می‌شود. رکوردهایی که از قبل هم در کلید شخصی بودند و کاربر آگاهانه
       از لیست خود حذف کرده (در l نیستند)، دوباره زنده نمی‌شوند؛ چون تنها
       delta جدید merge می‌شود، نه کل محتوای قبلی کلید. */
    var mePreMig = (curSession()||{}).user||'';
    var personalKeyPreMig = 'ptf_personal_cheques_' + (mePreMig || '_');
    var beforeMigJson = '[]';
    try { beforeMigJson = localStorage.getItem(personalKeyPreMig) || '[]'; } catch (eB) {}
    try { if (typeof window.chMigratePersonal === 'function') window.chMigratePersonal(); } catch (eMig) {}
    var newlyMigrated = [];
    try {
      var beforeArr = JSON.parse(beforeMigJson || '[]');
      var afterArr = JSON.parse(localStorage.getItem(personalKeyPreMig) || '[]');
      var beforeIds = {}; (Array.isArray(beforeArr) ? beforeArr : []).forEach(function (c) { if (c && c.cd) beforeIds[c.cd] = 1; });
      newlyMigrated = (Array.isArray(afterArr) ? afterArr : []).filter(function (c) { return c && c.cd && !beforeIds[c.cd]; });
    } catch (eDelta) {}
    // v30.0.1 server guard: company cheque only chairman/ceo/commercial
    try {
      var canCompany = (function(){ try{ var r=curRole(); return ['chairman','ceo','commercial'].indexOf(r)>-1; }catch(e){return false;} })();
      if(!canCompany){
        var hasCompany=false;
        l.forEach(function(c){ if(c.ownership==='company'){ hasCompany=true; c.ownership='personal'; } });
        if(hasCompany){ alert('⛔ فقط رییس هیات مدیره و مدیرعامل می‌توانند چک شرکتی ثبت کنند'); }
      }
    } catch(e){}
    var me=(curSession()||{}).user||''; var company=l.filter(function(c){return c.ownership!=='personal';}); var mine=l.filter(function(c){return c.ownership==='personal' && c.by===me;});
    /* FW-C01: اضافه‌کردن رکوردهای همین‌الان‌مهاجرت‌شده (که در l نبودند چون l از
       chAll() پیش از migration ساخته شده) — بدون این خط، خط بعدی که کلید
       شخصی را با mine جایگزین می‌کند، همان چیزی را که چند خط بالاتر
       migration کرده بود از بین می‌برد. */
    if (newlyMigrated.length) {
      var mineIds = {}; mine.forEach(function (c) { if (c && c.cd) mineIds[c.cd] = 1; });
      newlyMigrated.forEach(function (c) { if (c && c.cd && !mineIds[c.cd]) { mine.push(c); mineIds[c.cd] = 1; } });
    }
    setData(K, company); try{localStorage.setItem(chPersonalKey(),JSON.stringify(mine));}catch(e){} }

  // v29.7 FIN-WF-002: migration legacy personal cheques from global to personal keys
  window.chMigratePersonal = function(){
    try {
      var global = getData(K)||[];
      var toMove = global.filter(function(c){ return c.ownership==='personal'; });
      if(!toMove.length) return {moved:0};
      var moves={};
      toMove.forEach(function(c){ var u=c.by||'unknown'; moves[u]=(moves[u]||0)+1; var key='ptf_personal_cheques_'+u; var arr=[]; try{ arr=JSON.parse(localStorage.getItem(key)||'[]'); }catch(e){} if(!arr.some(function(x){ return x.cd===c.cd; })){ arr.unshift(c); try{ localStorage.setItem(key, JSON.stringify(arr)); }catch(e){} } });
      // remove from global
      var remaining = global.filter(function(c){ return c.ownership!=='personal'; });
      setData(K, remaining);
      try { audit('چک‌ها', 'مهاجرت چک‌های شخصی لگاسی از گلوبال به کلید شخصی: '+JSON.stringify(moves), 'FW-C01'); } catch(e){}
      return {moved:toMove.length, details:moves};
    } catch(e){ return {moved:0, error:String(e)}; }
  };
  // auto-migrate on boot
  try { window.chMigratePersonal(); } catch(e){}

  function chDaysTo(iso) {
    try { return Math.ceil((new Date(iso) - new Date(new Date().toISOString().slice(0, 10))) / 86400000); } catch (e) { return 999; }
  }
  function chFaDigits(s) { return String(s || '').replace(/\d/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'[+d] || d; }); }
  function chWords(v) {
    var n = Math.round(+v || 0);
    var w = (typeof ptfNumWordsFa === 'function') ? ptfNumWordsFa(n) : String(n);
    // نمونه خزانه‌داری: «... ریال تمام ##»
    if (w && w.indexOf('ریال') === -1) w = w + ' ریال تمام';
    else if (w && w.indexOf('تمام') === -1) w = w.replace(/\s*ریال\s*$/, ' ریال تمام');
    return w + ' ##';
  }
  function chFind(cd) { return chAll().filter(function (x) { return x.cd === cd; })[0]; }

  /* v25.6: آرگومان امن برای onclick داخل attribute با " */
  function chJsArg(v) {
    return String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  window.chUpsertReminder = function (rec) { return chUpsertReminder(rec); };
  function chUpsertReminder(rec) {
    try {
      /* v25.4: چک ضمانت/سپرده یادآور سررسید ندارد */
      if (!rec || rec.ownership === 'personal' || rec.kind === 'guarantee' || rec.reminderDisabled || rec.ownership === 'third_party' || rec.st === 'transferred' || rec.st === 'voided_transfer' || rec.st === 'void') {
        if (rec && rec.remCd) chFinishReminder(rec, true);
        if (rec) { rec.remCd = ''; }
        return;
      }
      if (!rec.dueISO) return; /* بدون تاریخ = بدون یادآور */
      var rems = getData('ptf_crm_reminders');
      var r = rec.remCd ? rems.filter(function (x) { return x.cd === rec.remCd; })[0] : null;
      var payload = {
        title: 'سررسید چک صادره ' + (rec.sayad || rec.no || ''),
        topic: 'سررسید چک صادره',
        dueISO: rec.dueISO,
        dueFa: rec.dueFa || (typeof ptfISOToJ === 'function' ? ptfISOToJ(rec.dueISO) : rec.dueISO),
        dueTime: '', pri: 'متوسط',
        link: { panel: 'rem', lb: 'چک صادره' },
        note: 'در وجه: ' + (rec.toWhom || '-') + ' | مبلغ: ' + (+rec.amt || 0).toLocaleString('fa-IR') + ' ریال',
        st: 'open', by: rec.byNm || curSession().name,
        ownerUser: rec.by || (curSession() || {}).user || '',
        ownerName: rec.byNm || (curSession() || {}).name || '',
        shareUsers: [], notifiedUsers: {}, chequeCd: rec.cd
      };
      if (r) {
        Object.keys(payload).forEach(function (k) { r[k] = payload[k]; });
      } else {
        r = Object.assign({ cd: genCode('REM'), createdFa: faDate() }, payload);
        rems.unshift(r);
        rec.remCd = r.cd;
      }
      setData('ptf_crm_reminders', rems);
    } catch (e) {}
  }
  function chFinishReminder(rec, removeOnly) {
    if (!rec || !rec.remCd) return;
    try {
      var rems = getData('ptf_crm_reminders');
      if (removeOnly) rems = rems.filter(function (x) { return x.cd !== rec.remCd; });
      else rems.forEach(function (x) { if (x.cd === rec.remCd) { x.st = 'done'; x.doneFa = faDate(); x.doneBy = (curSession() || {}).name || ''; } });
      setData('ptf_crm_reminders', rems);
    } catch (e) {}
  }
  function chRowActions(c) {
    var h = '<button class="bt bt-o" style="padding:3px 8px;font-size:11px;color:#0e7490" onclick="chEdit(\'' + escP(c.cd) + '\')">✏️</button> ' +
      '<button class="bt bt-o" style="padding:3px 8px;font-size:11px" onclick="chPrintOne(\'' + escP(c.cd) + '\')">👁/🖨</button> ';
    if (c.kind === 'guarantee') {
      if (c.st !== 'retrieved') h += '<button class="bt bt-o" style="padding:3px 8px;font-size:11px;color:#7c3aed" onclick="chRetrieve(\'' + escP(c.cd) + '\')">🏆 استرداد</button> ';
      if (c.dealCd && typeof ptfGoSalesFile === 'function') h += '<button class="bt bt-o" style="padding:3px 8px;font-size:11px" onclick="ptfGoSalesFile(\'' + escP(c.dealCd) + '\')">📁 پرونده</button> ';
      else if (c.dealCd && typeof goPanel === 'function') h += '<button class="bt bt-o" style="padding:3px 8px;font-size:11px" onclick="goPanel(\'deals\')">📁 پرونده</button> ';
    } else if (c.ownership === 'third_party' || c.st === 'transferred' || c.st === 'voided_transfer') {
      h += '<span class="bd" style="background:#e0f2fe;color:#0369a1;font-size:10px">↪ منتقل‌شده / خارج از ید شرکت</span> ';
    } else {
      h += '<button class="bt bt-o" style="padding:3px 8px;font-size:11px;color:#059669" onclick="chClear(\'' + escP(c.cd) + '\')">✓ پاس شد</button> ';
    }
    h += '<button class="bt bt-o" style="padding:3px 8px;font-size:11px;color:#dc2626" onclick="chDel(\'' + escP(c.cd) + '\')">✕</button>';
    return h;
  }
  function chDealOptions(selected) {
    var h = '<option value="">— بدون لینک پرونده —</option>';
    try {
      var deals = getData('ptf_crm_deals') || [];
      deals.slice(0, 100).forEach(function (d) {
        if (!d || !d.cd) return;
        var lb = (d.inqNo || d.cd) + (d.buyerCo ? ' — ' + d.buyerCo : '') + (d.wonOffer ? ' | ' + d.wonOffer : '');
        h += '<option value="' + escP(d.cd) + '"' + (selected === d.cd ? ' selected' : '') + '>' + escP(lb) + '</option>';
      });
    } catch (e) {}
    return h;
  }
  function chKindLabel(c) {
    if (c.kind === 'guarantee') {
      var sub = ({ advance: 'پیش‌پرداخت', performance: 'حسن انجام کار', bid: 'شرکت در مناقصه', other: 'سایر' })[c.guarType] || 'ضمانت';
      return '<span class="bd" style="background:#f5f3ff;color:#6d28d9;font-size:10.5px">🛡️ ' + sub + '</span>';
    }
    return '<span class="bd" style="background:#ecfdf5;color:#047857;font-size:10.5px">💰 مالی</span>';
  }

  /* باکس چک‌ها داخل پنل یادآورها (ماژول شخصی) */
  window.chRetrieve = function (cd) {
    if (!confirm('آیا این چک ضمانت از کارفرما استرداد شد (پس گرفته شد)؟')) return;
    var list = chAll();
    var c = list.filter(function (x) { return x.cd === cd; })[0];
    if (!c) return;
    c.st = 'retrieved'; c.retrievedAt = faDateTime(); c.retrievedBy = curSession().name;
    chSave(list);
    try { audit('چک‌ها', 'استرداد چک ضمانت ' + (c.sayad || c.no) + ' از کارفرما (' + c.toWhom + ')', cd); } catch (e) {}
    refreshBox();
    if (typeof ptfToast === 'function') ptfToast('🏆 چک ضمانت با موفقیت استرداد شد', 'ok');
  };

  window._chFilterKind = window._chFilterKind || 'all';
  window.chSetFilterKind = function (k) { window._chFilterKind = k; refreshBox(); };

  function chBoxHtml() {
    var my = chMine();
    var numFin = my.filter(function(c){ return c.kind !== 'guarantee' && c.st !== 'cleared'; }).length;
    var numGuar = my.filter(function(c){ return c.kind === 'guarantee' && c.st !== 'retrieved'; }).length;
    var ft = window._chFilterKind || 'all';
    var list = my.filter(function (c) {
      if (ft === 'fin' && c.kind === 'guarantee') return false;
      if (ft === 'guar' && c.kind !== 'guarantee') return false;
      return c.kind === 'guarantee' ? c.st !== 'retrieved' : (c.st !== 'cleared' && c.st !== 'transferred' && c.st !== 'voided_transfer' && c.st !== 'void' && c.ownership !== 'third_party');
    });
    list.sort(function (a, b) { return (a.dueISO || '') < (b.dueISO || '') ? -1 : 1; });
    var rows = list.map(function (c) {
      var d = chDaysTo(c.dueISO);
      var cl = d < 0 ? '#dc2626' : d <= 7 ? '#f59e0b' : '#0ea5e9';
      var lb = d < 0 ? 'سررسید گذشته (' + Math.abs(d) + ' روز)' : d === 0 ? 'سررسید امروز!' : d + ' روز مانده';
      return '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;padding:8px 12px;border:1px solid var(--brd);border-right:4px solid ' + cl + ';border-radius:10px;margin-bottom:6px;font-size:12.5px;flex-wrap:wrap">' +
        '<span>' + chKindLabel(c) + ' <b dir="ltr">' + escP(c.sayad || c.no) + '</b> — ' + escP(c.toWhom || '-') + ' — <b>' + (+c.amt).toLocaleString('fa-IR') + ' ریال</b>' +
        (c.dealCd ? ' <small style="color:#7c3aed">📁 ' + escP(c.dealLabel || c.dealCd) + '</small>' : '') +
        '<br><small style="color:#64748b">بانک: ' + escP((c.bank || '-') + (c.branch ? ' / ' + c.branch : '')) +
        (c.kind === 'guarantee' ? (c.dueFa || c.dueISO ? ' | تاریخ: ' + escP(c.dueFa || c.dueISO) : ' | بدون سررسید مالی') : (' | سررسید: ' + escP(c.dueFa || c.dueISO || '—') + ' — <b style="color:' + cl + '">' + lb + '</b>')) +
        (c.beneficiaryId ? ' | شناسه/کدملی: ' + escP(c.beneficiaryId) : '') + (c.note ? ' | ' + escP(c.note) : '') + '</small></span>' +
        '<span style="white-space:nowrap">' + chRowActions(c) + '</span></div>';
    }).join('');
    var cleared = my.filter(function (c) { return c.st === 'cleared'; }).length;
    var voidRows = my.filter(function(c){return c.st==='void'||c.st==='voided_transfer';}).map(function(c){return '<div style="font-size:11px;color:#64748b;padding:4px 0">🗑 ابطال‌شده: <b dir="ltr">'+escP(c.sayad||c.no)+'</b> — '+(+c.amt||0).toLocaleString('fa-IR')+' ریال</div>';}).join('');
    return '<div style="background:var(--crd,#fff);border:1px solid var(--brd);border-radius:14px;padding:14px;margin-bottom:14px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:6px">' +
      '<h4 style="margin:0;font-size:14px">🏦 چک‌های صادره (' + list.length + (ft==='guar' ? ' ضمانت' : ft==='fin' ? ' مالی' : ' باز') + (cleared && ft!=='guar' ? ' / ' + cleared + ' پاس‌شده' : '') + ')</h4>' +
      '<div style="display:flex;gap:6px;margin:8px 0 10px;flex-wrap:wrap">' +
      '<button type="button" class="' + (ft==='all'?'bt':'bt bt-o') + '" style="font-size:11.5px;padding:4px 10px" onclick="chSetFilterKind(\'all\')">همه</button>' +
      '<button type="button" class="' + (ft==='fin'?'bt':'bt bt-o') + '" style="font-size:11.5px;padding:4px 10px" onclick="chSetFilterKind(\'fin\')">💰 مالی (' + numFin + ')</button>' +
      '<button type="button" class="' + (ft==='guar'?'bt':'bt bt-o') + '" style="font-size:11.5px;padding:4px 10px" onclick="chSetFilterKind(\'guar\')">🛡️ ضمانت (' + numGuar + ')</button></div>' +
      '<span style="display:flex;gap:6px;flex-wrap:wrap">' +
      '<button class="bt" style="font-size:12px" onclick="chNew()">+ ثبت تکی</button>' +
      '<button class="bt" style="font-size:12px;background:#0e7490" onclick="chBatchFillOpen()">🧾 ثبت دسته‌ای + چاپ</button>' +
      '<button class="bt bt-o" style="font-size:12px;color:#0e7490" onclick="chBulkPrint()">🖨 چاپ چندتایی</button>' +
      '<button class="bt bt-o" style="font-size:12px" onclick="chPrintLayoutOpen()">📐 کالیبره چاپ</button>' +
      '<button class="bt bt-o" style="font-size:12px;color:#7c3aed" onclick="chAiOpen()">🤖 دستیار چک</button></span></div>' +
      '<div style="font-size:11.5px;color:#475569;margin-bottom:8px;line-height:1.8">🧾 <b>ثبت دسته‌ای + چاپ:</b> تاریخ/ذی‌نفع/مبلغ را در جدول بزنید و چند برگه چک را یک‌جا در پرینتر چاپ کنید (بدون نوشتن دستی).<br>⏰ فقط چک‌های <b>مالی</b> یادآور سررسید می‌گیرند؛ چک <b>ضمانت/سپرده</b> بدون یادآور است و قابل لینک به پرونده فروش.</div>' +
      (rows || '<div style="color:#94a3b8;font-size:12px">چکی ثبت نشده</div>') + (voidRows ? '<details style="margin-top:8px"><summary>تاریخچه چک‌های ابطال‌شده</summary>'+voidRows+'</details>' : '') + '</div>';
  }

  function chFormHtml(rec, fromAi) {
    rec = rec || {};
    var dueISO = rec.dueISO || '';
    var isG = rec.kind === 'guarantee';
    var gt = rec.guarType || 'advance';
    var canCompany = (function(){ try{ var r=curRole(); return ['chairman','ceo','commercial'].indexOf(r)>-1; }catch(e){return false;} })();
    var own = rec.ownership || (canCompany ? 'company' : 'personal');
    return '<div class="md-b" id="chFormDlg" style="display:grid;z-index:1600" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:760px;max-height:92vh;overflow:auto">' +
      '<h3>' + (rec.cd ? '✏️ اصلاح' : '🏦 ثبت') + ' چک صیادی</h3>' +
      '<div style="background:#f8fafc;border:1px solid var(--brd);border-radius:12px;padding:10px 12px;font-size:12px;color:#475569;margin-bottom:10px">چک <b>مالی</b>: یادآور سررسید ساخته می‌شود. چک <b>ضمانت/سپرده</b>: بدون یادآور؛ فقط برای پیگیری استرداد و لینک به پرونده فروش.</div>' +
      '<div class="fr"><div class="fld"><label>نوع چک *</label><select id="chKind" onchange="chKindUi()">' +
        '<option value="finance"' + (!isG ? ' selected' : '') + '>💰 چک مالی / پرداخت</option>' +
        '<option value="guarantee"' + (isG ? ' selected' : '') + '>🛡️ چک ضمانت / سپرده</option></select></div><div class="fld"><label>مالکیت چک</label><select id="chOwnership">' + (function(){ var can=(function(){ try{ var r=curRole(); return ['chairman','ceo','commercial'].indexOf(r)>-1; }catch(e){return false;} })(); var opts=''; if(can) opts+='<option value="company"' + (own==='company'?' selected':'') + '>🏢 چک شرکت</option>'; opts+='<option value="personal"' + (own==='personal'?' selected':'') + '>👤 چک شخصی من</option>'; return opts; })() + '</select></div>' +
      '<div class="fld" id="chGuarTypeWrap" style="' + (isG ? '' : 'display:none') + '"><label>نوع ضمانت</label><select id="chGuarType">' +
        '<option value="advance"' + (gt==='advance'?' selected':'') + '>ضمانت پیش‌پرداخت</option>' +
        '<option value="performance"' + (gt==='performance'?' selected':'') + '>حسن انجام کار</option>' +
        '<option value="bid"' + (gt==='bid'?' selected':'') + '>شرکت در مناقصه</option>' +
        '<option value="other"' + (gt==='other'?' selected':'') + '>سایر</option></select></div></div>' +
      '<div class="fld" id="chDealWrap" style="' + (isG ? '' : 'display:none') + '"><label>لینک پرونده فروش (اختیاری)</label><select id="chDealCd">' + chDealOptions(rec.dealCd || '') + '</select></div>' +
      '<div class="fr"><div class="fld"><label>شماره برگه چک</label><input type="text" id="chNo" value="' + escP(rec.no || '') + '" style="direction:ltr"></div>' +
      '<div class="fld"><label>شناسه صیادی *</label><input type="text" id="chSayad" value="' + escP(rec.sayad || rec.no || '') + '" style="direction:ltr"></div></div>' +
      '<div class="fr"><div class="fld"><label>مبلغ (ریال) *</label><input type="text" inputmode="numeric" data-money="1" autocomplete="off" id="chAmt" value="' + escP(rec.amt || '') + '" style="direction:ltr"></div>' +
      '<div class="fld"><label id="chDueLbl">' + (isG ? 'تاریخ (اختیاری)' : 'تاریخ چک / سررسید (شمسی) *') + '</label>' + (typeof ptfDateInput === 'function' ? ptfDateInput('chDueJ', dueISO) : '<input type="text" id="chDueJ" value="' + escP(rec.dueFa || '') + '" placeholder="1405/04/19" style="direction:ltr">') + '</div></div>' +
      '<div class="fr"><div class="fld"><label>در وجه (ذی‌نفع) *</label><input type="text" id="chTo" value="' + escP(rec.toWhom || '') + '" placeholder="نام شرکت/شخص گیرنده"></div>' +
      '<div class="fld"><label>کد ملی (۱۰ رقم) / شناسه ملی (۱۱ رقم) ذی‌نفع</label><input type="text" id="chBenId" value="' + escP(rec.beneficiaryId || '') + '" style="direction:ltr"></div></div>' +
      '<div class="fr"><div class="fld"><label>بانک</label><input type="text" id="chBank" value="' + escP(rec.bank || '') + '"></div>' +
      '<div class="fld"><label>شعبه</label><input type="text" id="chBranch" value="' + escP(rec.branch || '') + '"></div></div>' +
      '<div class="fld"><label>بابت / یادداشت</label><input type="text" id="chNote" value="' + escP(rec.note || '') + '"></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px;flex-wrap:wrap">' +
      '<button class="bt bt-o" onclick="document.getElementById(\'chFormDlg\').remove()">انصراف</button>' +
      '<button type="button" class="bt bt-o" style="color:#0e7490" onclick="chPreviewDraft(\'' + chJsArg(rec.cd || '') + '\')">👁 پیش‌نویس چاپ</button>' +
      '<button type="button" class="bt" id="chSaveBtn" onclick="chSaveForm(\'' + chJsArg(rec.cd || '') + '\')">' + (rec.cd ? '💾 ذخیره نهایی' : '✅ ثبت نهایی') + '</button></div></div></div>';
  }
  window.chKindUi = function () {
    var k = ((document.getElementById('chKind') || {}).value || 'finance');
    var g = k === 'guarantee';
    var w1 = document.getElementById('chGuarTypeWrap'); if (w1) w1.style.display = g ? '' : 'none';
    var w2 = document.getElementById('chDealWrap'); if (w2) w2.style.display = g ? '' : 'none';
    var lb = document.getElementById('chDueLbl'); if (lb) lb.textContent = g ? 'تاریخ (اختیاری)' : 'تاریخ چک / سررسید (شمسی) *';
  };
  window.chNew = function () { (document.getElementById('panels') || document.body).insertAdjacentHTML('beforeend', chFormHtml()); setTimeout(function(){ try{ chKindUi(); }catch(e){} }, 0); };
  window.chEdit = function (cd) { var rec = chFind(cd); if (!rec) return; (document.getElementById('panels') || document.body).insertAdjacentHTML('beforeend', chFormHtml(rec)); setTimeout(function(){ try{ chKindUi(); }catch(e){} }, 0); };

  window.chCollectForm = function(ex){ return chCollectForm(ex); };
  function canCreateCompanyCheque(){ try{ var r=curRole(); return ['chairman','ceo','commercial'].indexOf(r)>-1; }catch(e){return false;} }
  /* AUD-05 (ممیزی ۱۴۰۵/۰۵/۰۷ — crm/AUDIT-FINANCIAL-SYSTEM-2026-07-29.md):
     supplier-finance.js مسیر مستقل دیگری برای ساخت چک شرکتی دارد
     (slChequeCreate، از فرم پرداخت تأمین‌کننده) که همین گیت نقش را نیاز
     دارد اما به این تابع private دسترسی نداشت. به‌جای تکرار لیست نقش‌ها
     در فایل دیگر (که بعداً می‌تواند از هم واگرا شود)، همین تابع را روی
     window قرار می‌دهیم تا مرجع واحد بماند. */
  window.ptfCanCreateCompanyCheque = canCreateCompanyCheque;
  function chCollectForm(existingCd) {
    var sayad = ((document.getElementById('chSayad') || {}).value || '').trim();
    // v30.8 FIN-EX-02: یکتایی شماره صیادی
    try{
      if(sayad){
        var allCh = getData(K)||[];
        var dup = allCh.some(function(c){ return (c.sayad||c.no||'').toLowerCase()===sayad.toLowerCase() && (!existingCd || c.cd!==existingCd); });
        if(dup){ alert('⛔ چک با شماره صیادی '+sayad+' قبلاً ثبت شده - شماره تکراری مجاز نیست (FIN-EX-02)'); return null; }
      }
    }catch(e){}
    var no = (((document.getElementById('chNo') || {}).value || '').trim()) || sayad;
    var amtRaw = ((document.getElementById('chAmt') || {}).value || '');
    var amt = (typeof ptfNum === 'function') ? ptfNum(amtRaw) : (+String(amtRaw).replace(/[^\d.-]/g, '') || 0);
    var to = ((document.getElementById('chTo') || {}).value || '').trim();
    var due = (typeof ptfJToISO === 'function') ? ptfJToISO((document.getElementById('chDueJ') || {}).value || '') : '';
    var obj = existingCd ? (chFind(existingCd) || { cd: existingCd }) : { cd: genCode('CHQ') };
    obj.no = no; obj.sayad = sayad; obj.amt = amt; obj.toWhom = to;
    obj.beneficiaryId = ((document.getElementById('chBenId') || {}).value || '').trim();
    obj.bank = ((document.getElementById('chBank') || {}).value || '').trim();
    obj.branch = ((document.getElementById('chBranch') || {}).value || '').trim();
    obj.note = ((document.getElementById('chNote') || {}).value || '').trim();
    obj.dueISO = due || ''; obj.dueFa = due ? (typeof ptfISOToJ === 'function' ? ptfISOToJ(due) : due) : '';
    var kindEl = document.getElementById('chKind');
    if (kindEl) obj.kind = (kindEl.value === 'guarantee') ? 'guarantee' : 'finance';
    else if (!obj.kind) obj.kind = 'finance';
    var canCompany2 = (function(){ try{ var r=curRole(); return ['chairman','ceo','commercial'].indexOf(r)>-1; }catch(e){return false;} })();
    obj.ownership = ((document.getElementById('chOwnership')||{}).value || (canCompany2 ? 'company' : 'personal'));
    if(obj.ownership==='company' && !canCreateCompanyCheque()){
      alert('⛔ فقط رییس هیات مدیره و مدیرعامل (و در آینده مدیر بازرگانی) می‌توانند چک شرکتی ثبت کنند - زیرساخت برای نقش commercial فراهم است');
      obj.ownership='personal';
    }
    obj.guarType = obj.kind === 'guarantee' ? (((document.getElementById('chGuarType') || {}).value) || 'advance') : '';
    var dealCd = ((document.getElementById('chDealCd') || {}).value || '').trim();
    obj.dealCd = obj.kind === 'guarantee' ? dealCd : '';
    obj.dealLabel = '';
    if (obj.dealCd) {
      try {
        var d0 = (getData('ptf_crm_deals') || []).filter(function (x) { return x.cd === obj.dealCd; })[0];
        if (d0) obj.dealLabel = (d0.inqNo || d0.cd) + (d0.buyerCo ? ' — ' + d0.buyerCo : '');
      } catch (eD) {}
    }
    obj.st = obj.st || 'open'; obj.by = obj.by || (curSession() || {}).user; obj.byNm = obj.byNm || (curSession() || {}).name; obj.t = obj.t || faDateTime();
    obj.notified = obj.notified || {};
    return obj;
  }
  function chValidate(rec) {
    if (!rec.sayad || !rec.amt || !rec.toWhom) return 'شناسه صیادی، مبلغ و ذی‌نفع الزامی است';
    if (rec.kind !== 'guarantee' && !rec.dueISO) return 'برای چک مالی، تاریخ سررسید الزامی است';
    return '';
  }
  /* ============================================================
     v25.1 — چاپ واقعی روی برگه چک صیادی (نه شبیه‌سازی تزئینی)
     ابعاد پیش‌فرض تقریبی چک ایران: 169mm × 78mm
     مختصات فیلدها قابل کالیبره (localStorage) است چون بانک‌ها اختلاف جزئی دارند.
     ============================================================ */
  var CH_LAYOUT_KEY = 'ptf_cheque_print_layout_v1';
  function chDefaultLayout() {
    /* مختصات تقریبی بر اساس نمونه چک صیادی/خزانه‌داری (نه تضمین میلی‌متری همه بانک‌ها).
       بعد از یک چاپ آزمایشی با ox/oy و top/right دقیق کنید. */
    return {
      pageW: 169, pageH: 78, // mm — ابعاد رایج برگه چک ایران
      ox: 0, oy: 0,
      // تاریخ: بالا-راست (نزدیک مهر «چک»)
      dateTop: 8, dateRight: 14, dateFont: 12,
      // در وجه: میان‌راست
      paytoTop: 24, paytoRight: 14, paytoFont: 12,
      // مبلغ به حروف: نوار افقی وسط
      wordsTop: 36, wordsRight: 14, wordsLeft: 52, wordsFont: 10.5,
      // مبلغ عددی: چپ (قالب ## … RLS)
      amtTop: 18, amtLeft: 8, amtW: 52, amtFont: 13,
      // ردیف دوم مبلغ (ارقام فارسی در کادر پایین‌چپ نمونه)
      amt2Top: 48, amt2Left: 8, amt2W: 52, amt2Font: 11,
      // کد/شناسه ملی
      nidTop: 30, nidRight: 14, nidFont: 9,
      // بابت
      memoTop: 56, memoRight: 14, memoFont: 9,
      // شناسه صیادی (اختیاری روی چاپ)
      sayadTop: 8, sayadLeft: 8, sayadFont: 9,
      showGuide: false,
      showSayad: true,
      showAmt2: true, // ردیف دوم مبلغ مثل نمونه
      amtStyle: 'rls' // rls = ## 1,234 RLS | plain = فقط عدد
    };
  }
  function chLoadLayout() {
    try {
      var o = JSON.parse(localStorage.getItem(CH_LAYOUT_KEY) || 'null');
      if (!o || typeof o !== 'object') return chDefaultLayout();
      var d = chDefaultLayout();
      Object.keys(d).forEach(function (k) {
        if (o[k] == null || o[k] === '') return;
        if (typeof d[k] === 'boolean') d[k] = !!o[k];
        else if (typeof d[k] === 'string') d[k] = String(o[k]);
        else d[k] = (+o[k] === +o[k]) ? +o[k] : o[k];
      });
      return d;
    } catch (e) { return chDefaultLayout(); }
  }
  function chSaveLayout(L) {
    try { localStorage.setItem(CH_LAYOUT_KEY, JSON.stringify(L || chLoadLayout())); } catch (e) {}
  }
  function chAmtDigits(n, fa) {
    n = Math.round(+n || 0);
    var s = n.toLocaleString(fa ? 'fa-IR' : 'en-US');
    return s;
  }
  function chAmtPrint(n, L) {
    var style = (L && L.amtStyle) || 'rls';
    var num = chAmtDigits(n, false);
    if (style === 'rls') return '## ' + num + ' RLS';
    return num;
  }
  function chAmtPrintFa(n) {
    return '## ' + chAmtDigits(n, true) + ' RLS';
  }
  function chDateWords(c){ var d=String(c.dueFa||'').replace(/[^0-9]/g,''); return d ? 'تاریخ به حروف: '+d : ''; }
  function chDatePrint(c) {
    // تاریخ روی چک: ترجیح ارقام فارسی شمسی
    return chFaDigits(c.dueFa || (typeof ptfISOToJ === 'function' ? ptfISOToJ(c.dueISO || '') : '') || '');
  }
  /**
   * mode:
   *  - 'paper'  : چاپ روی برگه واقعی (بدون کادر/پس‌زمینه)
   *  - 'preview': پیش‌نمایش روی صفحه با کادر کم‌رنگ
   *  - 'calib'  : پیش‌نمایش + خطوط راهنما
   */
  function chPrintHtml(list, mode) {
    list = list || [];
    mode = mode || 'paper';
    var L = chLoadLayout();
    var guide = (mode === 'calib') || L.showGuide;
    var paper = (mode === 'paper');
    var body = list.map(function (c) {
      var ox = (+L.ox || 0), oy = (+L.oy || 0);
      function box(cls, top, right, left, extra) {
        var st = 'position:absolute;top:' + (top + oy) + 'mm;';
        if (right != null) st += 'right:' + (right + ox) + 'mm;';
        if (left != null) st += 'left:' + (left + ox) + 'mm;';
        return '<div class="' + cls + '" style="' + st + (extra || '') + '">';
      }
      var amtMain = chAmtPrint(c.amt, L);
      var amtFa = chAmtPrintFa(c.amt);
      return '<section class="pg"><div class="cheque ' + (paper ? 'paper' : 'mock') + (guide ? ' calib' : '') + '">' +
        (guide ? '<div class="guide"></div>' : '') +
        /* تاریخ */
        box('f-date', L.dateTop, L.dateRight, null, 'font-size:' + L.dateFont + 'pt;') + chDatePrint(c) + '</div>' + box('f-datewords', (L.dateTop||0)+6, L.dateRight, null, 'font-size:8pt;') + escP(chDateWords(c)) + '</div>' +
        /* ذی‌نفع */
        box('f-pay', L.paytoTop, L.paytoRight, null, 'font-size:' + L.paytoFont + 'pt;') + escP(c.toWhom || '') + '</div>' +
        /* مبلغ حروفی */
        box('f-words', L.wordsTop, L.wordsRight, L.wordsLeft, 'font-size:' + L.wordsFont + 'pt;') + escP(chWords(c.amt || 0)) + '</div>' +
        /* مبلغ عددی لاتین ## RLS (چپ) */
        box('f-amt', L.amtTop, null, L.amtLeft, 'width:' + (L.amtW || 52) + 'mm;font-size:' + L.amtFont + 'pt;text-align:left;direction:ltr;font-weight:900;') + escP(amtMain) + '</div>' +
        /* مبلغ عددی فارسی دوم (مثل نمونه) */
        (L.showAmt2 !== false ? box('f-amt2', L.amt2Top != null ? L.amt2Top : 48, null, L.amt2Left != null ? L.amt2Left : 8, 'width:' + (L.amt2W || L.amtW || 52) + 'mm;font-size:' + (L.amt2Font || 11) + 'pt;text-align:left;direction:ltr;font-weight:800;') + escP(amtFa) + '</div>' : '') +
        /* کد/شناسه ملی */
        (c.beneficiaryId ? box('f-nid', L.nidTop, L.nidRight, null, 'font-size:' + L.nidFont + 'pt;direction:ltr;') + escP(c.beneficiaryId) + '</div>' : '') +
        /* بابت */
        (c.note ? box('f-memo', L.memoTop, L.memoRight, null, 'font-size:' + L.memoFont + 'pt;') + escP(c.note) + '</div>' : '') +
        /* شناسه صیادی */
        ((L.showSayad !== false && (c.sayad || c.no)) ? box('f-sayad', L.sayadTop != null ? L.sayadTop : 8, null, L.sayadLeft != null ? L.sayadLeft : 8, 'font-size:' + (L.sayadFont || 9) + 'pt;direction:ltr;') + escP(c.sayad || c.no || '') + '</div>' : '') +
      '</div></section>';
    }).join('');
    /* v31.7.19 US-PDF-NAME: عنوان = شماره سند تا PDF ذخیره‌شده قابل تمایز باشد */
    var _chTitle = 'CHQ-' + (list||[]).map(function(c){return (c&&(c.sayad||c.no||c.cd))||'';}).filter(Boolean).slice(0,3).join('_');
    if(_chTitle==='CHQ-') _chTitle='چاپ چک صیادی';
    return '<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>' + escP(_chTitle) + '</title><style>' +
      '@page{size:' + L.pageW + 'mm ' + L.pageH + 'mm;margin:0}' +
      '*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#000}' +
      'body{font-family:"B Nazanin","B Lotus","IRANSansX","IRANSans",Tahoma,"Segoe UI",Vazirmatn,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
      '.pg{page-break-after:always;width:' + L.pageW + 'mm;height:' + L.pageH + 'mm;overflow:hidden;position:relative}' +
      '.pg:last-child{page-break-after:auto}' +
      '.cheque{position:relative;width:' + L.pageW + 'mm;height:' + L.pageH + 'mm}' +
      /* paper: بدون کادر — فقط متن روی برگه واقعی */
      '.cheque.paper{background:transparent;border:0}' +
      '.cheque.mock{background:#fff;border:0.3mm dashed #cbd5e1}' +
      '.cheque.calib .guide{position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 9.9mm,rgba(14,165,233,.12) 10mm),repeating-linear-gradient(90deg,transparent,transparent 9.9mm,rgba(14,165,233,.12) 10mm);pointer-events:none}' +
      '.f-date,.f-pay,.f-words,.f-amt,.f-nid,.f-memo{white-space:nowrap;overflow:hidden;text-overflow:clip;font-weight:700}' +
      '.f-words{white-space:normal;line-height:1.5;max-height:14mm}' +
      '@media screen{body{background:#e2e8f0;padding:12px}.pg{margin:0 auto 12px;background:#fff;box-shadow:0 4px 18px rgba(0,0,0,.12)}}' +
      '@media print{body{background:#fff;padding:0}.pg{box-shadow:none;margin:0}}' +
      '</style></head><body onload="setTimeout(function(){try{window.focus();window.print()}catch(e){}},300)">' + body +
      '<div class="noprint" style="position:fixed;bottom:10px;left:50%;transform:translateX(-50%);background:#0f172a;color:#fff;padding:8px 14px;border-radius:999px;font-size:12px;z-index:9">' +
      'پرینتر: برگه چک را در سینی بگذارید · حاشیه = None · Scale = 100% · ' + list.length + ' برگه' +
      '</div></body></html>';
  }
  function chOpenPrint(list, mode) {
    list = list || [];
    if (!list.length) { alert('چکی برای چاپ نیست'); return; }
    var html = chPrintHtml(list, mode || 'paper');
    if (typeof ptfPreviewPrintableDoc === 'function') { ptfPreviewPrintableDoc('پیش‌نمایش چک', html, 'cheque'); return; }
    document.getElementById('panels').insertAdjacentHTML('beforeend','<div class="md-b" style="display:grid;z-index:4000"><div class="md" style="max-width:95vw;width:1000px;height:90vh"><iframe style="width:100%;height:75vh" srcdoc="'+html.replace(/"/g,'&quot;')+'"></iframe><button class="bt" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div>');
  }
  window.chPreviewDraft = function (existingCd) {
    var rec = chCollectForm(existingCd || '');
    var err = chValidate(rec);
    if (err) { alert(err); return; }
    chOpenPrint([rec], 'preview');
  };
  window.chPrintOne = function (cd) {
    var rec = chFind(cd); if (!rec) return;
    chOpenPrint([rec], 'paper');
  };
  window.chPrintLayoutOpen = function () {
    var L = chLoadLayout();
    var fields = [
      ['pageW','عرض برگه (mm)'],['pageH','ارتفاع برگه (mm)'],['ox','آفست افقی ox'],['oy','آفست عمودی oy'],
      ['dateTop','تاریخ top'],['dateRight','تاریخ right'],['paytoTop','ذی‌نفع top'],['paytoRight','ذی‌نفع right'],
      ['wordsTop','مبلغ حروف top'],['wordsRight','مبلغ حروف right'],['wordsLeft','مبلغ حروف left'],
      ['amtTop','مبلغ ## RLS top'],['amtLeft','مبلغ ## RLS left'],['amtW','عرض مبلغ لاتین'],
      ['amt2Top','مبلغ فارسی top'],['amt2Left','مبلغ فارسی left'],
      ['nidTop','کدملی top'],['nidRight','کدملی right'],['sayadTop','صیادی top'],['sayadLeft','صیادی left'],
      ['memoTop','بابت top'],['memoRight','بابت right']
    ];
    var inputs = fields.map(function (f) {
      return '<div class="fld" style="min-width:120px"><label style="font-size:11px">' + f[1] + '</label>' +
        '<input type="number" step="0.5" id="chL_' + f[0] + '" value="' + (L[f[0]] != null ? L[f[0]] : '') + '" style="direction:ltr;width:100%;padding:6px;border:1px solid var(--brd);border-radius:8px"></div>';
    }).join('');
    var html = '<div class="md-b" id="chLayoutDlg" style="display:grid;z-index:' + ((typeof ptfTopZIndex==='function'?ptfTopZIndex(2500):2500)) + '" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:720px;max-height:92vh;overflow:auto">' +
      '<h3>📐 کالیبره چاپ چک صیادی (روی برگه واقعی)</h3>' +
      '<div style="font-size:12.5px;color:#475569;line-height:1.9;margin-bottom:10px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:10px 12px">' +
      'هدف: مثل نمونه خزانه‌داری/صیادی — <b>تاریخ، ذی‌نفع، مبلغ حروفی، مبلغ عددی (## … RLS)</b> و در صورت ورود <b>کد/شناسه ملی</b>. بدون کادر اضافه.<br><b>صادقانه:</b> مختصات پیش‌فرض تقریبی است؛ با یک برگه تست و ox/oy دقیق می‌شود. اگر اسکن برگه خالی بانک خودتان را بدهید، پیش‌فرض همان بانک را تنظیم می‌کنیم.<br>' +
      'یک برگه تست در پرینتر بگذارید، «چاپ آزمایشی» را بزنید و با ox/oy و top/right فیلدها را جابه‌جا کنید تا دقیقاً روی خطوط چک بنشیند.<br>' +
      '<b>ابعاد پیش‌فرض:</b> حدود 169×78 mm (رایج چک ایران). اگر بانک شما فرق دارد، pageW/pageH را عوض کنید.</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px">' + inputs + '</div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap">' +
      '<button type="button" class="bt bt-o" onclick="document.getElementById(\'chLayoutDlg\').remove()">بستن</button>' +
      '<button type="button" class="bt bt-o" onclick="chPrintLayoutSave(true)">💾 ذخیره چیدمان</button>' +
      '<button type="button" class="bt" style="background:#0e7490" onclick="chPrintLayoutSave(false);chPrintLayoutTest()">🖨 چاپ آزمایشی (با راهنما)</button>' +
      '</div></div></div>';
    (document.body || document.getElementById('panels')).insertAdjacentHTML('beforeend', html);
  };
  window.chPrintLayoutSave = function (toast) {
    var L = chLoadLayout();
    ['pageW','pageH','ox','oy','dateTop','dateRight','paytoTop','paytoRight','wordsTop','wordsRight','wordsLeft','amtTop','amtLeft','amtW','amt2Top','amt2Left','amt2W','nidTop','nidRight','sayadTop','sayadLeft','memoTop','memoRight','dateFont','paytoFont','wordsFont','amtFont','amt2Font','nidFont','sayadFont','memoFont'].forEach(function (k) {
      var el = document.getElementById('chL_' + k);
      if (el && el.value !== '') L[k] = +el.value;
    });
    chSaveLayout(L);
    if (toast && typeof ptfToast === 'function') ptfToast('چیدمان چاپ چک ذخیره شد', 'ok');
  };
  window.chPrintLayoutTest = function () {
    var sample = { dueFa: '۱۴۰۵/۰۴/۲۱', dueISO: '2026-07-12', toWhom: 'شرکت نمونه ذی‌نفع', amt: 3210200000000, sayad: '001234567890', beneficiaryId: '14010077558', note: 'بابت خرید کالا' };
    chOpenPrint([sample], 'calib');
  };

  /* ---- چاپ چندتایی از لیست ذخیره‌شده ---- */
  window.chBulkPrint = function () {
    var list = chMine().filter(function (c) { return c.st !== 'void'; });
    if (!list.length) { alert('چکی برای چاپ وجود ندارد — از «ثبت دسته‌ای + چاپ» استفاده کنید'); return; }
    var rows = list.map(function (c) {
      return '<label style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px dashed var(--brd);font-size:12px">' +
        '<input type="checkbox" class="chBulkSel" value="' + escP(c.cd) + '" checked> ' +
        '<span><b dir="ltr">' + escP(c.sayad || c.no || '—') + '</b> — ' + escP(c.toWhom || '') + ' — ' + (+c.amt || 0).toLocaleString('fa-IR') + ' ریال — ' + escP(c.dueFa || '') + '</span></label>';
    }).join('');
    var z = (typeof ptfTopZIndex === 'function') ? ptfTopZIndex(2500) : 2500;
    var html = '<div class="md-b" id="chBulkDlg" style="display:grid;z-index:' + z + '" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:640px;max-height:92vh;overflow:auto">' +
      '<h3>🖨 چاپ چندتایی روی برگه چک</h3>' +
      '<div style="font-size:12.5px;color:#475569;line-height:1.9;margin-bottom:10px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:10px">' +
      'برگه‌های چک را به‌ترتیب در پرینتر بگذارید. با یک بار Print، همه چک‌های انتخاب‌شده پشت‌سرهم چاپ می‌شوند (هر چک = یک صفحه به اندازه برگه چک).<br>' +
      'اگر جای نوشته‌ها جابه‌جاست: «📐 کالیبره چاپ».</div>' +
      '<div style="max-height:45vh;overflow:auto;margin-bottom:10px">' + rows + '</div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">' +
      '<button type="button" class="bt bt-o" onclick="document.getElementById(\'chBulkDlg\').remove()">انصراف</button>' +
      '<button type="button" class="bt bt-o" style="color:#0e7490" onclick="chPrintLayoutOpen()">📐 کالیبره</button>' +
      '<button type="button" class="bt" onclick="chBulkPrintGo()">🖨 چاپ روی برگه چک</button></div></div></div>';
    (document.body || document.getElementById('panels')).insertAdjacentHTML('beforeend', html);
  };
  window.chBulkPrintGo = function () {
    var ids = Array.prototype.slice.call(document.querySelectorAll('.chBulkSel:checked')).map(function (el) { return el.value; });
    if (!ids.length) { alert('حداقل یک چک را انتخاب کنید'); return; }
    var list = chMine().filter(function (c) { return ids.indexOf(c.cd) > -1; });
    var dlg = document.getElementById('chBulkDlg'); if (dlg) dlg.remove();
    chOpenPrint(list, 'paper');
  };

  /* ---- ثبت دسته‌ای از جدول + چاپ یک‌جا (خواسته اصلی کارفرما) ---- */
  window.chBatchFillOpen = function () {
    var z = (typeof ptfTopZIndex === 'function') ? ptfTopZIndex(2600) : 2600;
    var rows = '';
    for (var i = 0; i < 5; i++) {
      rows += '<tr>' +
        '<td><input class="chB_due" type="text" placeholder="1405/04/21" style="width:100%;direction:ltr;padding:6px;border:1px solid var(--brd);border-radius:8px"></td>' +
        '<td><input class="chB_to" type="text" placeholder="نام ذی‌نفع" style="width:100%;padding:6px;border:1px solid var(--brd);border-radius:8px"></td>' +
        '<td><input class="chB_nid" type="text" placeholder="کد ملی / شناسه ملی" style="width:100%;direction:ltr;padding:6px;border:1px solid var(--brd);border-radius:8px" title="اشخاص: کد ملی ۱۰ رقمی — شرکت‌ها: شناسه ملی ۱۱ رقمی"></td>' +
        '<td><input class="chB_amt" type="text" inputmode="numeric" data-money="1" placeholder="مبلغ ریال" style="width:100%;direction:ltr;padding:6px;border:1px solid var(--brd);border-radius:8px"></td>' +
        '<td><input class="chB_sayad" type="text" placeholder="اختیاری" style="width:100%;direction:ltr;padding:6px;border:1px solid var(--brd);border-radius:8px"></td>' +
        '<td><input class="chB_note" type="text" placeholder="بابت..." style="width:100%;padding:6px;border:1px solid var(--brd);border-radius:8px"></td>' +
        '</tr>';
    }
    var html = '<div class="md-b" id="chBatchDlg" style="display:grid;z-index:' + z + '" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:920px;max-height:94vh;overflow:auto">' +
      '<h3>🧾 ثبت دسته‌ای چک + چاپ یک‌جا</h3>' +
      '<div style="font-size:12.5px;color:#334155;line-height:1.95;margin-bottom:12px;background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:10px 12px">' +
      '<b>هدف شما:</b> برای <b>چک مالی</b> — تاریخ / مبلغ / ذی‌نفع / کدملی. (ثبت ضمانت از فرم تکی یا دستیار با انتخاب نوع ضمانت)، برگه‌های چک را در پرینتر بگذارید، و همه را یک‌جا چاپ کنید — بدون نوشتن دستی.<br><small>اشخاص حقیقی: <b>کد ملی ۱۰ رقمی</b> · اشخاص حقوقی: <b>شناسه ملی ۱۱ رقمی</b> (اختیاری ولی روی چک چاپ می‌شود).</small><br>' +
      '۱) ردیف‌ها را پر کنید &nbsp; ۲) «ثبت و چاپ همه» &nbsp; ۳) در دیالوگ پرینت: <b>Margins=None</b> و <b>Scale=100%</b></div>' +
      '<div class="tb2" style="overflow:auto"><table style="font-size:12.5px;min-width:820px"><thead><tr>' +
      '<th style="width:110px">تاریخ شمسی *</th><th>ذی‌نفع *</th><th style="width:130px">کد/شناسه ملی</th><th style="width:130px">مبلغ (ریال) *</th><th style="width:120px">شناسه صیادی</th><th>بابت</th>' +
      '</tr></thead><tbody id="chBatchBody">' + rows + '</tbody></table></div>' +
      '<div style="display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap;margin-top:12px">' +
      '<button type="button" class="bt bt-o" onclick="chBatchAddRows()">＋ ۵ ردیف بیشتر</button>' +
      '<span style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button type="button" class="bt bt-o" onclick="document.getElementById(\'chBatchDlg\').remove()">انصراف</button>' +
      '<button type="button" class="bt bt-o" style="color:#0e7490" onclick="chPrintLayoutOpen()">📐 کالیبره چاپ</button>' +
      '<button type="button" class="bt bt-o" onclick="chBatchPreview()">👁 پیش‌نمایش</button>' +
      '<button type="button" class="bt" onclick="chBatchCommit(true)">✅ ثبت و چاپ همه</button>' +
      '</span></div></div></div>';
    (document.body || document.getElementById('panels')).insertAdjacentHTML('beforeend', html);
  };
  window.chBatchAddRows = function () {
    var tb = document.getElementById('chBatchBody'); if (!tb) return;
    var html = '';
    for (var i = 0; i < 5; i++) {
      html += '<tr><td><input class="chB_due" type="text" placeholder="1405/04/21" style="width:100%;direction:ltr;padding:6px;border:1px solid var(--brd);border-radius:8px"></td>' +
        '<td><input class="chB_to" type="text" style="width:100%;padding:6px;border:1px solid var(--brd);border-radius:8px"></td>' +
        '<td><input class="chB_nid" type="text" placeholder="کد/شناسه ملی" style="width:100%;direction:ltr;padding:6px;border:1px solid var(--brd);border-radius:8px"></td>' +
        '<td><input class="chB_amt" type="text" inputmode="numeric" data-money="1" style="width:100%;direction:ltr;padding:6px;border:1px solid var(--brd);border-radius:8px"></td>' +
        '<td><input class="chB_sayad" type="text" style="width:100%;direction:ltr;padding:6px;border:1px solid var(--brd);border-radius:8px"></td>' +
        '<td><input class="chB_note" type="text" style="width:100%;padding:6px;border:1px solid var(--brd);border-radius:8px"></td></tr>';
    }
    tb.insertAdjacentHTML('beforeend', html);
  };
  function chBatchCollect() {
    var dues = document.querySelectorAll('#chBatchBody .chB_due');
    var tos = document.querySelectorAll('#chBatchBody .chB_to');
    var nids = document.querySelectorAll('#chBatchBody .chB_nid');
    var amts = document.querySelectorAll('#chBatchBody .chB_amt');
    var sayads = document.querySelectorAll('#chBatchBody .chB_sayad');
    var notes = document.querySelectorAll('#chBatchBody .chB_note');
    var out = [], errs = [];
    for (var i = 0; i < dues.length; i++) {
      var to = (tos[i].value || '').trim();
      var nid = (nids[i] && nids[i].value ? nids[i].value : '').trim().replace(/\s+/g, '');
      // ارقام فارسی → انگلیسی
      if (typeof ptfToEnDigits === 'function') nid = ptfToEnDigits(nid);
      else nid = nid.replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }).replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); });
      var amt = (typeof ptfNum === 'function') ? ptfNum(amts[i].value) : +String(amts[i].value || '').replace(/[^\d.-]/g, '');
      var dueRaw = (dues[i].value || '').trim();
      var dueISO = (typeof ptfJToISO === 'function') ? ptfJToISO(dueRaw) : '';
      var sayad = (sayads[i].value || '').trim();
      var note = (notes[i].value || '').trim();
      if (!to && !amt && !dueRaw && !sayad && !nid) continue; // empty row
      if (!to || !amt || !dueISO) { errs.push('ردیف ' + (i + 1) + ': تاریخ شمسی معتبر، ذی‌نفع و مبلغ الزامی است'); continue; }
      if (nid && !/^\d{10,11}$/.test(nid)) {
        errs.push('ردیف ' + (i + 1) + ': کد ملی باید ۱۰ رقم و شناسه ملی معمولاً ۱۱ رقم باشد');
        continue;
      }
      out.push({
        cd: genCode('CHQ'),
        no: sayad || '',
        sayad: sayad || ('TMP-' + (i + 1)),
        amt: amt,
        toWhom: to,
        beneficiaryId: nid,
        bank: '', branch: '',
        note: note,
        dueISO: dueISO,
        dueFa: (typeof ptfISOToJ === 'function' ? ptfISOToJ(dueISO) : dueRaw),
        st: 'open',
        by: (curSession() || {}).user,
        byNm: (curSession() || {}).name,
        t: faDateTime(),
        notified: {},
        src: 'batch-fill',
        /* AUD-06 (ممیزی ۱۴۰۵/۰۵/۰۷ — crm/AUDIT-FINANCIAL-SYSTEM-2026-07-29.md):
           رکورد batch قبلاً هیچ ownership صریحی نداشت؛ چون chAll()/chSave()
           هر رکورد بدون ownership==='personal' را «شرکتی» تلقی می‌کنند
           (فیلتر روی !== 'personal' است، نه === 'company')، این رکورد بدون
           هیچ enforce نقشی وارد گزارش نقدینگی شرکت/یادآورها/My Day می‌شد،
           حتی اگر سازنده‌اش کارشناس فروش (غیرمجاز به صدور چک شرکتی) باشد.
           اکنون مالکیت صریح تعیین می‌شود؛ chSave() هم به‌عنوان خط دفاع دوم
           همچنان این را برای نقش‌های غیرمجاز به 'personal' برمی‌گرداند. */
        ownership: canCreateCompanyCheque() ? 'company' : 'personal'
      });
    }
    return { list: out, errs: errs };
  }
  window.chBatchPreview = function () {
    var r = chBatchCollect();
    if (r.errs.length) { alert(r.errs.join('\\n')); return; }
    if (!r.list.length) { alert('حداقل یک ردیف کامل وارد کنید'); return; }
    chOpenPrint(r.list, 'preview');
  };
  window.chBatchCommit = function (doPrint) {
    var r = chBatchCollect();
    if (r.errs.length) { alert(r.errs.join('\\n')); return; }
    if (!r.list.length) { alert('حداقل یک ردیف کامل وارد کنید'); return; }
    var list = chAll();
    r.list.forEach(function (rec) {
      chUpsertReminder(rec);
      list.unshift(rec);
    });
    chSave(list);
    try { audit('چک‌ها', 'ثبت دسته‌ای ' + r.list.length + ' فقره چک برای چاپ', ''); } catch (e) {}
    var dlg = document.getElementById('chBatchDlg'); if (dlg) dlg.remove();
    if (typeof renderReminders === 'function') try { renderReminders(); } catch (e2) {}
    refreshBox();
    if (typeof ptfToast === 'function') ptfToast('✅ ' + r.list.length + ' چک ثبت شد', 'ok');
    if (doPrint) chOpenPrint(r.list, 'paper');
  };
  window.chSaveNew = function () { return window.chSaveForm(''); };
  window.chSaveForm = function (existingCd) {
    try {
      existingCd = existingCd == null ? '' : String(existingCd);
      var rec = chCollectForm(existingCd);
      var err = chValidate(rec);
      if (err) { alert(err); return; }
      /* v31.7.3 BUG-AUDIT-002-FINANCIAL-CODEGEN: چک با کد TMP ذخیره نمی‌شود —
         شماره رسمی فقط از سرور. اگر pool خالی باشد، کاربر باید refresh/ورود مجدد کند. */
      if (/^TMP-(CHQ)-/.test(String(rec.cd || ''))) {
        alert('⛔ شماره رسمی چک از سرور دریافت نشده است. اتصال/ورود را برقرار کنید و فرم را دوباره باز کنید.');
        return;
      }
      var list = chAll();
      var found = existingCd ? list.filter(function (x) { return x.cd === existingCd; })[0] : null;
      if (found) {
        Object.keys(rec).forEach(function (k) { found[k] = rec[k]; });
        rec = found;
      } else {
        if (existingCd && !rec.cd) rec.cd = existingCd;
        list.unshift(rec);
      }
      chUpsertReminder(rec);
      chSave(list);
      try { audit('چک‌ها', (found ? 'اصلاح' : 'ثبت') + (rec.kind === 'guarantee' ? ' چک ضمانت ' : ' چک مالی ') + (rec.sayad || rec.no || '') + ' — ' + (+rec.amt || 0).toLocaleString('fa-IR') + ' ریال در وجه ' + rec.toWhom + (rec.dealCd ? ' | پرونده ' + rec.dealCd : ''), rec.cd); } catch (e) {}
      var m = document.getElementById('chFormDlg'); if (m) m.remove();
      if (typeof renderReminders === 'function') try { renderReminders(); } catch (e) {}
      refreshBox();
      if (typeof ptfToast === 'function') ptfToast(found ? '✅ چک ذخیره شد' : '✅ چک ثبت شد', 'ok');
    } catch (eSave) {
      try { console.error('chSaveForm', eSave); } catch (e0) {}
      alert('⛔ خطا در ذخیره چک: ' + (eSave && eSave.message ? eSave.message : eSave));
    }
  };

  window.chClear = function (cd) {
    if (!confirm('این چک پاس شد؟')) return;
    var list = chAll();
    var c = list.filter(function (x) { return x.cd === cd; })[0];
    if (!c) return;
    if (c.by !== (curSession() || {}).user) { alert('⛔ فقط ثبت‌کننده چک می‌تواند آن را مدیریت کند'); return; }
    c.st = 'cleared'; c.clearedAt = faDateTime(); c.clearedBy = curSession().name;
    chFinishReminder(c, false);
    chSave(list);
    try { if (typeof window.ntfResolveByRef === 'function') window.ntfResolveByRef(cd); } catch (eNR) {} /* v33.4.1: چک پاس شد — اعلان سررسید مرتبط برای همه حذف شود */
    try { audit('چک‌ها', 'چک ' + (c ? (c.sayad || c.no) : cd) + ' پاس شد', cd); } catch (e) {}
    if (typeof renderReminders === 'function') try { renderReminders(); } catch (e2) {}
    refreshBox();
  };

  window.chDel = function (cd) {
    if (!confirm('چک از فهرست حذف شود؟')) return;
    var list = chAll();
    var c = list.filter(function (x) { return x.cd === cd; })[0];
    if (!c) return;
    if (c.by !== (curSession() || {}).user) { alert('⛔ فقط ثبت‌کننده چک می‌تواند آن را حذف کند'); return; }
    chFinishReminder(c, true);
    try { if (typeof window.ntfResolveByRef === 'function') window.ntfResolveByRef(cd); } catch (eNR) {} /* v33.4.1: چک حذف/باطل شد — اعلان سررسید مرتبط برای همه حذف شود */
    /* Sprint 273: ابطال چک شرکتی متصل، پرداخت تامین‌کننده را هم void می‌کند. */
    if (c.supplierPaymentCd && c.ownership === 'company' && typeof window.slPaymentVoid === 'function') {
      c.st = 'void'; c.reminderDisabled = true;
      chSave(list);
      window.slPaymentVoid(c.supplierPaymentCd);
      try { audit('چک‌ها', 'ابطال چک شرکت و برگشت پرداخت تامین‌کننده', cd); } catch (eP) {}
      if (typeof renderReminders === 'function') try { renderReminders(); } catch (eR) {}
      refreshBox();
      return;
    }
    chSave(list.filter(function (x) { return x.cd !== cd; }));
    if (typeof renderReminders === 'function') try { renderReminders(); } catch (e2) {}
    refreshBox();
  };


  function refreshBox() {
    var host = document.getElementById('chqBox');
    if (host) host.innerHTML = chBoxHtml();
  }

  /* تزریق باکس به پنل یادآورها (ماژول شخصی) */
  function hookReminders() {
    if (window._chqHooked || typeof window.buildReminders !== 'function') return false;
    window._chqHooked = true;
    var _br = window.buildReminders;
    window.buildReminders = function () {
      return _br() + '<div id="chqBox">' + chBoxHtml() + '</div>';
    };
    return true;
  }

  /* ============ یادآور روزانه: از ۷ روز قبل تا سررسید، هر روز یک اعلان ============ */
  function chDailyNotify() {
    try {
      var s = curSession();
      if (!s.user) return;
      var today = new Date().toISOString().slice(0, 10);
      var list = chAll();
      var changed = false;
      list.forEach(function (c) {
        if (c.st !== 'open') return;
        if (c.kind === 'guarantee') return; /* بدون یادآور/اعلان سررسید */
        // v29.7 FIN-WF-002: شخصی و ثالث انتقالی یادآور ندارد
        if(c.ownership==='personal' || c.ownership==='third_party' || c.st==='transferred' || c.st==='voided_transfer' || c.reminderDisabled) return;

        if (!c.dueISO) return;
        var d = chDaysTo(c.dueISO);
        if (d > 7) return; /* هنوز به پنجره ۷ روزه نرسیده */
        c.notified = c.notified || {};
        if (c.notified[today]) return; /* امروز اعلان رفته */
        c.notified[today] = 1;
        changed = true;
        var msg = d < 0 ? '🔴 چک ' + c.no + ' سررسیدش ' + Math.abs(d) + ' روز گذشته!' :
                  d === 0 ? '🔴 چک ' + c.no + ' امروز سررسید است!' :
                  '🟠 چک ' + c.no + ' — ' + d + ' روز تا سررسید';
        if (typeof notify === 'function') {
          notify({
            toUsers: [c.by || s.user], toRoles: [],
            title: msg + ' — ' + (+c.amt).toLocaleString('fa-IR') + ' ریال در وجه ' + (c.toWhom || ''),
            body: 'بانک: ' + (c.bank || '-') + ' | سررسید: ' + (c.dueFa || c.dueISO),
            kind: 'cheque', channels: ['cart'], link: { panel: 'rem' }, actionable: true, refCd: c.cd,
            dkey: 'chq-due-' + c.cd /* v33.4.1: dkey ثابت per چک — با تغییر شمارش روز، کارت موجود به‌روز می‌شود نه اینکه کارت جدید بسازد */
          });
        }
      });
      if (changed) chSave(list);
    } catch (e) {}
  }


  /* ============ v20.8 (US-410): دستیار هوشمند ورود چک — تصویر/متن، با پیش‌نمایش قابل اصلاح ============ */
  function chAiApi(body, cb) {
    fetch('../api/llm.php?action=cheque', { method: 'POST', headers: (typeof ptfApiAuthHeaders==='function'?ptfApiAuthHeaders(true):{ 'Content-Type': 'application/json' }), body: JSON.stringify(body) })
      .then(function (r) { return r.json(); }).then(cb).catch(function () { cb({ ok: false, error: 'عدم دسترسی به سرور AI' }); });
  }
  window.chAiOpen = function () {
    var html = '<div class="md-b" id="chAiDlg" style="display:grid;z-index:2200" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:640px;max-height:92vh;overflow:auto">' +
      '<h3>🤖 دستیار ورود چک</h3><div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:12px;padding:10px 12px;font-size:12.5px;color:#5b21b6;margin-bottom:10px">عکس/PDF چک یا متن مشخصات چک را بدهید؛ سیستم شماره صیاد، مبلغ، تاریخ سررسید شمسی، در وجه و بانک را استخراج می‌کند. ثبت نهایی فقط پس از تایید شما انجام می‌شود.</div>' +
      '<input type="file" id="chAiFile" accept=".pdf,.jpg,.jpeg,.png,.webp" style="display:none" onchange="chAiFileGo(this)"><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="bt" onclick="document.getElementById(\'chAiFile\').click()">📎 عکس/PDF چک</button><button class="bt bt-o" onclick="chAiTextBox()">📝 ورود متن</button></div>' +
      '<div id="chAiStatus" style="margin-top:10px;font-size:12.5px;color:#64748b"></div><div id="chAiOut" style="margin-top:12px"></div><div style="display:flex;justify-content:flex-end;margin-top:10px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };
  window.chAiTextBox = function () { var out = document.getElementById('chAiOut'); if (out) out.innerHTML = '<div class="fld"><label>متن مشخصات چک</label><textarea id="chAiText" rows="5" placeholder="چک صیاد... مبلغ... سررسید 1405/06/15..."></textarea></div><button class="bt" onclick="chAiTextGo()">استخراج از متن</button>'; };
  window.chAiTextGo = function () { var txt = ((document.getElementById('chAiText') || {}).value || '').trim(); if (!txt) { alert('متن را وارد کنید'); return; } var st = document.getElementById('chAiStatus'); if (st) st.textContent = '⏳ در حال استخراج...'; chAiApi({ text: txt }, function (d) { if (!d.ok) { if (st) st.innerHTML = '<span style="color:#dc2626">❌ ' + (d.error || 'خطا') + '</span>'; return; } if (st) st.textContent = '✅ استخراج انجام شد'; chAiRender(d.data || {}); }); };
  window.chAiFileGo = function (inp) { var f = inp.files[0]; if (!f) return; if (f.size > 8 * 1048576) { alert('فایل بزرگتر از ۸MB است'); return; } var st = document.getElementById('chAiStatus'); if (st) st.textContent = '⏳ در حال خواندن فایل...'; var rd = new FileReader(); rd.onload = function () { var b64 = String(rd.result).split(',')[1]; chAiApi({ mime: f.type, b64: b64 }, function (d) { if (!d.ok) { if (st) st.innerHTML = '<span style="color:#dc2626">❌ ' + (d.error || 'خطا') + '</span>'; return; } if (st) st.textContent = '✅ استخراج انجام شد'; chAiRender(d.data || {}); }); }; rd.readAsDataURL(f); inp.value = ''; };
  window.chAiRender = function (c) { window._chAi = c || {}; var dueISO = c.dueISO || ''; var out = document.getElementById('chAiOut'); if (!out) return; out.innerHTML = '<div style="background:#fff;border:1px solid var(--brd);border-radius:14px;padding:12px"><div class="fr"><div class="fld"><label>شماره چک / صیاد *</label><input id="chAiNo" value="' + escP(c.no || c.sayad || '') + '" style="direction:ltr"></div><div class="fld"><label>مبلغ (ریال) *</label><input id="chAiAmt" data-money="1" inputmode="numeric" value="' + escP(c.amt || '') + '" style="direction:ltr"></div></div><div class="fr"><div class="fld"><label>در وجه *</label><input id="chAiTo" value="' + escP(c.toWhom || c.payee || '') + '"></div><div class="fld"><label>بانک / شعبه</label><input id="chAiBank" value="' + escP(c.bank || '') + '"></div></div><div class="fr"><div class="fld"><label>تاریخ سررسید (شمسی) *</label>' + (typeof ptfDatePicker==='function' ? ptfDatePicker('chAiDueJ', dueISO, '1405/06/15') : '<input id="chAiDueJ" value="' + escP((c.dueJ || ((c.dueISO && typeof ptfISOToJ === 'function') ? ptfISOToJ(c.dueISO) : ''))) + '" placeholder="1405/06/15" style="direction:ltr">') + '</div><div class="fld"><label>بابت / یادداشت</label><input id="chAiNote" value="' + escP(c.note || '') + '"></div></div><div class="fr"><div class="fld"><label>نوع چک</label><select id="chAiKind" onchange="var g=this.value===\'guarantee\';var w=document.getElementById(\'chAiGuarWrap\');if(w)w.style.display=g?\'\':\'none\';var d=document.getElementById(\'chAiDealWrap\');if(d)d.style.display=g?\'\':\'none\';"><option value="finance">💰 مالی / پرداخت</option><option value="guarantee">🛡️ ضمانت / سپرده</option></select></div>' +
      '<div class="fld" id="chAiGuarWrap" style="display:none"><label>نوع ضمانت</label><select id="chAiGuarType"><option value="advance">پیش‌پرداخت</option><option value="performance">حسن انجام کار</option><option value="bid">مناقصه</option><option value="other">سایر</option></select></div></div>' +
      '<div class="fld" id="chAiDealWrap" style="display:none"><label>لینک پرونده فروش</label><select id="chAiDealCd">' + chDealOptions('') + '</select></div>' +
      '<button class="bt" onclick="chAiCommit()">✅ ثبت چک از پیش‌نمایش</button></div>'; };
  window.chAiCommit = function () {
    var no = ((document.getElementById('chAiNo') || {}).value || '').trim();
    var amt = (typeof ptfNum === 'function') ? ptfNum((document.getElementById('chAiAmt') || {}).value) : +((document.getElementById('chAiAmt') || {}).value || 0);
    var to = ((document.getElementById('chAiTo') || {}).value || '').trim();
    var dueRaw = ((document.getElementById('chAiDueJ') || {}).value || '');
    var due = (typeof ptfJToISO === 'function') ? ptfJToISO(dueRaw) : '';
    var kind = ((document.getElementById('chAiKind') || {}).value === 'guarantee') ? 'guarantee' : 'finance';
    if (!no || !amt || !to) { alert('شماره چک، مبلغ و در وجه الزامی است'); return; }
    if (kind !== 'guarantee' && !due) { alert('برای چک مالی، تاریخ سررسید الزامی است'); return; }
    var list = chAll();
    var rec = {
      cd: genCode('CHQ'), no: no, sayad: no, amt: amt, toWhom: to,
      bank: ((document.getElementById('chAiBank') || {}).value || '').trim(),
      note: ((document.getElementById('chAiNote') || {}).value || '').trim(),
      dueISO: due || '', dueFa: due ? (typeof ptfISOToJ === 'function' ? ptfISOToJ(due) : dueRaw) : '',
      kind: kind, guarType: kind === 'guarantee' ? (((document.getElementById('chAiGuarType') || {}).value) || 'advance') : '',
      dealCd: kind === 'guarantee' ? (((document.getElementById('chAiDealCd') || {}).value) || '') : '',
      dealLabel: '',
      /* AUD-06-b (کشف تکمیلی ۱۴۰۵/۰۵/۰۷ — همان الگوی AUD-06 که برای فرم دسته‌ای رفع شد،
         در مسیر «دستیار هوشمند ثبت چک» هم فراموش شده بود): بدون ownership صریح،
         chSave/chAll این رکورد را پیش‌فرض «شرکتی» می‌دیدند و کاربر غیرمجاز
         (مثل کارشناس فروش) می‌توانست از این مسیر هم بی‌صدا وارد استخر چک
         شرکتی شود. */
      ownership: (typeof window.ptfCanCreateCompanyCheque === 'function' && window.ptfCanCreateCompanyCheque()) ? 'company' : 'personal',
      st: 'open', by: curSession().user, byNm: curSession().name, t: faDateTime(), notified: {}, src: 'ai-cheque'
    };
    if (rec.dealCd) {
      try {
        var d1 = (getData('ptf_crm_deals') || []).filter(function (x) { return x.cd === rec.dealCd; })[0];
        if (d1) rec.dealLabel = (d1.inqNo || d1.cd) + (d1.buyerCo ? ' — ' + d1.buyerCo : '');
      } catch (e) {}
    }
    list.unshift(rec);
    chUpsertReminder(rec);
    chSave(list);
    try { audit('چک‌ها', 'ثبت چک ' + (kind === 'guarantee' ? 'ضمانت' : 'مالی') + ' با دستیار AI ' + no + ' — ' + amt.toLocaleString('fa-IR') + ' ریال', ''); } catch (e) {}
    var dlg = document.getElementById('chAiDlg'); if (dlg) dlg.remove();
    if (typeof renderReminders === 'function') try { renderReminders(); } catch (e2) {}
    refreshBox();
    if (typeof ptfToast === 'function') ptfToast(kind === 'guarantee' ? 'چک ضمانت با دستیار ثبت شد (بدون یادآور)' : 'چک مالی با دستیار ثبت شد', 'ok');
  };

  /* ============ US-330: متن‌های از پیش آماده با متغیر ============ */
  var TPL_KEY = 'ptf_crm_msgtpls';
  var TPL_DEFAULTS = [
    { id: 'cust-follow', aud: 'مشتری', title: 'پیگیری پیشنهاد', body: 'جناب {نام} وقت بخیر؛ احتراماً پیرو پیشنهاد ارسالی شرکت پیشرو تجهیز فرتاک، خواهشمند است در صورت نیاز به توضیحات تکمیلی اعلام بفرمایید. با سپاس' },
    { id: 'cust-thanks', aud: 'مشتری', title: 'تشکر پس از سفارش', body: 'جناب {نام} وقت بخیر؛ از حسن اعتماد شما به شرکت پیشرو تجهیز فرتاک سپاسگزاریم. سفارش شما در حال پیگیری است و روند اجرا به اطلاع خواهد رسید.' },
    { id: 'cust-newoffer', aud: 'مشتری', title: 'اعلام آمادگی', body: 'جناب {نام} وقت بخیر؛ شرکت پیشرو تجهیز فرتاک آمادگی خود را جهت تامین اقلام مورد نیاز آن مجموعه محترم اعلام می‌دارد. در خدمت شما هستیم.' },
    { id: 'sup-rfq', aud: 'تامین‌کننده', title: 'استعلام قیمت', body: 'جناب {نام} وقت بخیر؛ خواهشمند است قیمت و زمان تحویل اقلام فهرست پیوست را به شرکت پیشرو تجهیز فرتاک اعلام بفرمایید. با تشکر' },
    { id: 'sup-follow', aud: 'تامین‌کننده', title: 'پیگیری پاسخ استعلام', body: 'جناب {نام} وقت بخیر؛ پیرو استعلام ارسالی، خواهشمند است در صورت آماده بودن پیشنهاد قیمت، اعلام بفرمایید. سپاس از همکاری شما' },
    { id: 'sup-order', aud: 'تامین‌کننده', title: 'ابلاغ سفارش', body: 'جناب {نام} وقت بخیر؛ بدینوسیله سفارش اقلام مطابق پیش‌فاکتور مورد تایید ابلاغ می‌گردد. لطفاً برنامه تحویل را اعلام بفرمایید.' },
    { id: 'gen-greet', aud: 'سایر', title: 'تبریک عمومی', body: 'جناب {نام} وقت بخیر؛ از طرف شرکت پیشرو تجهیز فرتاک بهترین آرزوها را برای شما و مجموعه محترمتان داریم.' },
    { id: 'gen-meeting', aud: 'سایر', title: 'هماهنگی جلسه', body: 'جناب {نام} وقت بخیر؛ خواهشمند است در خصوص زمان جلسه پیشنهادی اعلام نظر بفرمایید. با احترام — پیشرو تجهیز فرتاک' }
  ];
  function tplAll() {
    try {
      var saved = JSON.parse(localStorage.getItem(TPL_KEY) || 'null');
      return (saved && saved.length) ? saved : TPL_DEFAULTS.slice();
    } catch (e) { return TPL_DEFAULTS.slice(); }
  }
  window.ptfMsgTpls = tplAll;
  /* رندر متن با متغیر */
  window.ptfTplRender = function (tpl, name) {
    return String(tpl.body || tpl).replace(/\{نام\}/g, name || 'مخاطب گرامی');
  };
  /* دیالوگ انتخاب متن آماده — از کارت مشتری/تامین‌کننده صدا زده می‌شود */
  window.ptfTplPick = function (aud, name) {
    var list = tplAll().filter(function (t) { return t.aud === aud || aud === 'همه'; });
    var rows = list.map(function (t, i) {
      return '<div style="border:1px solid var(--brd);border-radius:10px;padding:10px;margin-bottom:8px;cursor:pointer" onclick="ptfTplCopy(' + i + ',\'' + escP(aud) + '\',\'' + escP(name || '') + '\')">' +
        '<b style="font-size:12.5px">' + escP(t.title) + '</b> <small style="color:#94a3b8">(' + escP(t.aud) + ')</small>' +
        '<div style="font-size:12px;color:#475569;margin-top:4px">' + escP(ptfTplRender(t, name)) + '</div></div>';
    }).join('');
    var html = '<div class="md-b" style="display:grid;z-index:2400" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:560px;max-height:88vh;overflow:auto">' +
      '<h3>💬 متن‌های آماده' + (name ? ' — ' + escP(name) : '') + '</h3>' +
      '<div style="font-size:11.5px;color:#94a3b8;margin-bottom:10px">کلیک روی هر متن = کپی متن نهایی (نام مخاطب جایگذاری شده) برای ارسال در پیام‌رسان</div>' +
      (rows || '<div style="color:#94a3b8">متنی نیست</div>') +
      '<div style="display:flex;justify-content:flex-end;margin-top:8px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };
  window.ptfTplCopy = function (i, aud, name) {
    var list = tplAll().filter(function (t) { return t.aud === aud || aud === 'همه'; });
    var t = list[i];
    if (!t) return;
    var txt = ptfTplRender(t, name);
    try { navigator.clipboard.writeText(txt); } catch (e) {}
    if (typeof ptfToast === 'function') ptfToast('✅ متن کپی شد — در پیام‌رسان Paste کنید', 'ok');
  };

  /* دکمه «متن آماده» روی کارت مشتری/تامین‌کننده */
  function hookEntityCard() {
    if (window._tplCardHooked || typeof window.showEntityCard !== 'function') return false;
    window._tplCardHooked = true;
    var _sec = window.showEntityCard;
    window.showEntityCard = function (key, cd) {
      _sec(key, cd);
      try {
        var c = getData(key).filter(function (x) { return x.cd === cd; })[0];
        if (!c) return;
        var aud = key === 'ptf_crm_customers' ? 'مشتری' : key === 'ptf_crm_suppliers' ? 'تامین‌کننده' : 'سایر';
        var pp = (typeof primaryPerson === 'function' ? primaryPerson(c) : null);
        var nm = (pp && pp.nm) || c.con || c.nm || c.co || '';
        var mds = document.querySelectorAll('.md-b .md');
        /* v16.2 (BUG-017): آخرین مودال قابل‌مشاهده — نه مینیمایزشده در body */
        var md = null;
        for (var _mv = mds.length - 1; _mv >= 0; _mv--) {
          var _pb = mds[_mv].closest ? mds[_mv].closest('.md-b') : null;
          if (!_pb || _pb.style.display !== 'none') { md = mds[_mv]; break; }
        }
        var h3 = md ? md.querySelector('h3') : null;
        if (h3) h3.insertAdjacentHTML('afterend',
          '<button class="bt bt-o" style="font-size:12px;color:#7c3aed;border-color:#ddd6fe;margin-bottom:8px" onclick="ptfTplPick(\'' + aud + '\',\'' + escP(nm) + '\')">💬 متن‌های آماده پیام</button>');
      } catch (e) {}
    };
    return true;
  }

  /* ============ US-331: تب تامین‌کنندگان داخلی / خارجی ============ */
  function hookSupTabs() {
    if (window._supTabsHooked || typeof window.buildSuppliers !== 'function' || typeof window.renderSuppliers2 !== 'function') return false;
    window._supTabsHooked = true;
    var _bs = window.buildSuppliers;
    window.buildSuppliers = function () {
      var h = _bs();
      var tabs = '<div style="display:flex;gap:6px;margin-bottom:10px" id="supTabs">' +
        '<button class="bt" id="supTabAll" style="font-size:12px" onclick="ptfSupTab(\'\')">همه</button>' +
        '<button class="bt bt-o" id="supTabIr" style="font-size:12px" onclick="ptfSupTab(\'داخلی\')">🇮🇷 داخلی</button>' +
        '<button class="bt bt-o" id="supTabFx" style="font-size:12px" onclick="ptfSupTab(\'خارجی\')">🌍 خارجی</button>' +
        '<button class="bt bt-o" style="font-size:11.5px;color:#7c3aed;border-color:#ddd6fe" onclick="ptfSupOriginReview()" title="اصلاح رکوردهای جابه‌جاشده داخلی/خارجی (BUG-022)">🧭 بازبینی</button></div>';
      return h.replace('<div class="tb2">', tabs + '<div class="tb2">');
    };
    window._supTabCur = '';
    /* v19.0 (پورت BUG-022): ابزار بازبینی origin — اصلاح رکوردهای جابه‌جاشده با یک کلیک */
    window.ptfSupOriginReview = function () {
      var items = getData('ptf_crm_suppliers');
      if (!items.length) { alert('تامین‌کننده‌ای نیست'); return; }
      var rows = items.map(function (c) {
        return '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0;border-bottom:1px dashed var(--brd);font-size:12.5px">' +
          '<span><b>' + escP(c.co) + '</b> <small dir="ltr">(' + escP(c.cd) + ')</small></span>' +
          '<select onchange="ptfSupOriginSet(\'' + escP(c.cd) + '\',this.value)" style="padding:5px;border:1px solid var(--brd);border-radius:8px;font-size:12px">' +
          '<option value="داخلی"' + ((c.origin || 'داخلی') === 'داخلی' ? ' selected' : '') + '>🇮🇷 داخلی</option>' +
          '<option value="خارجی"' + (c.origin === 'خارجی' ? ' selected' : '') + '>🌍 خارجی</option></select></div>';
      }).join('');
      var html = '<div class="md-b" style="display:grid;z-index:2400" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:560px;max-height:92vh;overflow:auto">' +
        '<h3>🧭 بازبینی داخلی/خارجی تامین‌کنندگان</h3>' +
        '<div style="font-size:11.5px;color:#64748b;margin-bottom:8px">رکوردهای جابه‌جاشده از باگ قدیمی (BUG-022) را اصلاح کنید — تغییر همان لحظه ذخیره و audit می‌شود.</div>' +
        rows + '<div style="display:flex;justify-content:flex-end;margin-top:8px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove();renderSuppliers()">بستن</button></div></div></div>';
      document.getElementById('panels').insertAdjacentHTML('beforeend', html);
    };
    window.ptfSupOriginSet = function (cd, org) {
      var items = getData('ptf_crm_suppliers');
      var rec = items.filter(function (x) { return x.cd === cd; })[0];
      if (!rec || rec.origin === org) return;
      rec.origin = org;
      setData('ptf_crm_suppliers', items);
      try { audit('تامین‌کنندگان', 'اصلاح داخلی/خارجی: ' + rec.co + ' → ' + org + ' (BUG-022)', cd); } catch (eA) {}
    };
    window.ptfSupTab = function (t) {
      window._supTabCur = t;
      ['supTabAll', 'supTabIr', 'supTabFx'].forEach(function (id, i2) {
        var b = document.getElementById(id);
        if (b) b.className = ((i2 === 0 && !t) || (i2 === 1 && t === 'داخلی') || (i2 === 2 && t === 'خارجی')) ? 'bt' : 'bt bt-o';
      });
      renderSuppliers();
    };
    var _rs = window.renderSuppliers2;
    window.renderSuppliers2 = window.renderSuppliers = function () {
      _rs();
      var t = window._supTabCur || '';
      if (!t) return;
      /* فیلتر پس از رندر: بر اساس فیلد origin (پیش‌فرض داخلی) */
      try {
        var items = getData('ptf_crm_suppliers');
        var tb = document.getElementById('sTb');
        if (!tb) return;
        tb.querySelectorAll('tr').forEach(function (tr) {
          var strong = tr.querySelector('td strong');
          if (!strong) return;
          var cd = strong.textContent.trim();
          var c = items.filter(function (x) { return x.cd === cd; })[0];
          if (!c) return;
          var org = c.origin || 'داخلی';
          tr.style.display = org === t ? '' : 'none';
        });
      } catch (e) {}
    };
    return true;
  }

  /* فیلد داخلی/خارجی در فرم تامین‌کننده */
  function hookSupModal() {
    if (window._supOrgHooked || typeof window.showSupModal2 !== 'function' || typeof window.saveSup2 !== 'function') return false;
    window._supOrgHooked = true;
    var _sm = window.showSupModal2;
    window.showSupModal2 = function (cd) {
      _sm(cd);
      try {
        var c = cd ? getData('ptf_crm_suppliers').filter(function (x) { return x.cd === cd; })[0] : null;
        var kindSel = document.getElementById('nS2Kind');
        if (!kindSel || document.getElementById('nS2Origin')) return;
        var fld = kindSel.closest('.fld');
        if (fld) fld.insertAdjacentHTML('afterend',
          '<div class="fld"><label>داخلی / خارجی</label><select id="nS2Origin" onchange="if(typeof ptfSupOriginLabels===\'function\')ptfSupOriginLabels()">' +
          '<option value="داخلی"' + (!c || (c.origin || 'داخلی') === 'داخلی' ? ' selected' : '') + '>🇮🇷 داخلی</option>' +
          '<option value="خارجی"' + (c && c.origin === 'خارجی' ? ' selected' : '') + '>🌍 خارجی</option></select></div>');
        /* v17.5 (US-415): برچسب‌های پویا — خارجی: EN اجباری، فارسی اختیاری */
        window.ptfSupOriginLabels = function () {
          try {
            var isF = (document.getElementById('nS2Origin') || {}).value === 'خارجی';
            var faInp = document.getElementById('nS2Comp');
            var enInp = document.getElementById('nS2CoEn');
            var faLb = faInp && faInp.closest('.fld') ? faInp.closest('.fld').querySelector('label') : null;
            var enLb = enInp && enInp.closest('.fld') ? enInp.closest('.fld').querySelector('label') : null;
            if (faLb) faLb.textContent = isF ? 'نام فارسی (اختیاری — شرکت خارجی)' : 'نام شرکت / شخص (فارسی) *';
            if (enLb) enLb.textContent = isF ? 'English Name * (الزامی برای خارجی)' : 'نام انگلیسی';
            if (enInp) enInp.style.borderColor = isF ? '#f59e0b' : '';
          } catch (e2) {}
        };
        ptfSupOriginLabels();
      } catch (e) {}
    };
    var _ss = window.saveSup2;
    window.saveSup2 = function (cd) {
      window._supLastSaved = null; /* v19.0 (پورت BUG-022): ریست فلگ — فقط ذخیره موفق ست می‌کند */
      _ss(cd);
      try {
        /* v19.0 (BUG-022 — ریشه): قبلا بی‌قیدوشرط اجرا می‌شد حتی با ذخیره ناموفق و برای ثبت جدید
           روی items[0] (بی‌ربط!) می‌نوشت → داخلی/خارجی رکوردها جابه‌جا می‌شد. */
        var savedCd = window._supLastSaved;
        if (!savedCd) return;
        var org = (document.getElementById('nS2Origin') || {}).value;
        if (!org) return;
        var items = getData('ptf_crm_suppliers');
        var rec = items.filter(function (x) { return x.cd === savedCd; })[0];
        if (rec && rec.origin !== org) { rec.origin = org; setData('ptf_crm_suppliers', items); if (typeof renderSuppliers === 'function') renderSuppliers(); }
      } catch (e) {}
    };
    return true;
  }

  /* ============ بوت ============ */
  var tries = 0;
  var t = setInterval(function () {
    tries++;
    var a = hookReminders(), b = hookEntityCard(), c = hookSupTabs(), d = hookSupModal();
    if ((window._chqHooked && window._tplCardHooked && window._supTabsHooked && window._supOrgHooked) || tries > 60) {
      clearInterval(t);
      chDailyNotify();
    }
  }, 400);
})();
