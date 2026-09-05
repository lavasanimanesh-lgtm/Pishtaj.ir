/* =====================================================================
   PTF CRM — Official Invoice Registry v35
   CRM registers an invoice already issued by accounting/Modian. It does not
   issue the legal invoice. VAT and total are strict derived/read-only values;
   at least one versioned accounting/Modian image or PDF is mandatory.
   ===================================================================== */
(function () {
  'use strict';
  var ROLES=['admin','chairman','ceo','commercial','accountant'];
  var draftFiles=[];
  function data(k){try{var v=getData(k);return Array.isArray(v)?v:[];}catch(e){return[];}}
  function role(){try{return String(curRole()||'').toLowerCase();}catch(e){return'';}}
  function can(){return ROLES.indexOf(role())>-1;}
  function esc(v){return typeof escP==='function'?escP(v):String(v==null?'':v).replace(/[&<>"']/g,function(x){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[x];});}
  function arg(v){return typeof ptfOnClickArg==='function'?ptfOnClickArg(v):String(v==null?'':v).replace(/[\\']/g,'');}
  function num(v){return typeof ptfNum==='function'?ptfNum(v):(+String(v==null?'':v).replace(/[^\d.-]/g,'')||0);}
  function money(v){return(+v||0).toLocaleString('fa-IR')+' ریال';}
  function active(x){var s=String((x&&(x.status||x.st))||'').toLowerCase();return!!x&&['void','voided','deleted','superseded','replaced'].indexOf(s)<0&&!x.voided;}
  function iid(i){return String((i&&(i._id||i.cd))||'');}
  function cid(c){return String((c&&(c._id||c.cd))||'');}
  function toast(m,k){if(typeof ptfToast==='function')ptfToast(m,k||'info');else if(k==='warn')alert(m);}
  function api(a,p){return window.ptfSalesDomainApi(a,p);}
  function command(a,p,h){return window.ptfSalesDomainCommand(a,p,h);}
  function findOffer(no){return data('ptf_crm_offers').filter(function(o){return o&&o.no===no;})[0]||null;}
  function findCaseForOffer(o){if(!o)return null;return data('ptf_crm_deals').filter(function(c){return c&&active(c)&&((o._id&&c.rootOfferId===o._id)||c.wonOffer===o.no||c.offerNo===o.no||(o.amendmentOfCaseId&&cid(c)===o.amendmentOfCaseId));})[0]||null;}
  /* v34.7.26 (S1 / باگ «ابطال کنترل‌شده»): تطبیق شناسه باید متقارن باشد.
     ریشهٔ باگ: کشوی پروندهٔ فروش (salesfiles.js) شناسه را با اولویت `cd` می‌فرستاد ولی
     iid() با اولویت `_id` می‌خواند؛ برای هر فاکتور سروری (که هم _id دارد هم cd) نتیجه
     null می‌شد و ptfInvoiceVoid/showInvModal بی‌صدا خارج می‌شدند. سرور از قبل هر دو کلید
     را می‌پذیرد (api/sales-domain.php: void_invoice)، پس تحمل دوطرفه اینجا هم درست است.
     شناسهٔ تهی هرگز تطبیق نمی‌کند (جلوگیری از تطبیق ''===''). */
  function findInvoice(id){
    var s=String(id==null?'':id);if(!s)return null;
    var list=data('ptf_crm_invoices');
    var byId=list.filter(function(i){return i&&String(i._id||'')===s;})[0];
    if(byId)return byId;
    return list.filter(function(i){return i&&String(i.cd||'')===s;})[0]||null;
  }
  function vatDefault(date){try{if(typeof window.ptfVatRateOf==='function')return window.ptfVatRateOf(date);}catch(e){}var s={};try{s=getData('ptf_crm_settings')||{};}catch(e){}var y=String(date||'').replace(/[۰-۹]/g,function(d){return'۰۱۲۳۴۵۶۷۸۹'.indexOf(d);}).match(/(13|14)\d{2}/);var map=s.vatRates||s.fiscalVatRates||{};if(y&&map[y[0]]!=null)return+map[y[0]];return s.vatDefaultPct!=null?+s.vatDefaultPct:(s.vatPercent!=null?+s.vatPercent:10);}
  window.ptfVatCalc=function(base,pct){base=Math.round(num(base));pct=num(pct);var vat=Math.round(base*pct/100);return{base:base,pct:pct,vat:vat,total:base+vat};};
  window.ptfVatDefaultSave=function(){if(!can())return;var pct=num((document.getElementById('ofiVatPct')||{}).value),date=String((document.getElementById('ofiDate')||{}).value||''),m=date.replace(/[۰-۹]/g,function(d){return'۰۱۲۳۴۵۶۷۸۹'.indexOf(d);}).match(/(13|14)\d{2}/);if(!m||pct<0||pct>100){alert('سال فاکتور یا درصد معتبر نیست');return;}var reason=prompt('دلیل ثبت/تغییر درصد مصوب ارزش افزوده سال '+m[0]+':','نرخ مصوب سال مالی');if(reason===null||!reason.trim())return;if(typeof window.ptfVatRateSet==='function'){var r=window.ptfVatRateSet(m[0],pct,reason.trim());if(!r.ok){alert('❌ ذخیره نشد: '+r.error);return;}toast('درصد '+pct+'٪ به‌عنوان نرخ مصوب سال '+m[0]+' ذخیره شد','ok');return;}var s=getData('ptf_crm_settings')||{};if(Array.isArray(s))s={};s.vatRates=s.vatRates||{};s.vatRates[m[0]]=pct;s.vatRateHistory=s.vatRateHistory||[];s.vatRateHistory.push({year:m[0],pct:pct,reason:reason.trim(),at:new Date().toISOString(),by:(curSession()||{}).name||''});if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_settings', s, { reason: 'w4' }); else setData('ptf_crm_settings', s);toast('درصد '+pct+'٪ به‌عنوان پیش‌فرض سال '+m[0]+' ذخیره شد','ok');};
  function activeRequiredFiles(files){return(files||[]).filter(function(f){return f&&['replaced','deleted','rejected'].indexOf(String(f.status||'active'))<0&&['accounting_official_invoice','modian_tax_invoice'].indexOf(f.category)>-1&&f.key&&(!f._justUploaded||f.readVerified===true);});}
  function filesHtml(inv, compact){var fs=(inv&&inv.files)||[];var activeFs=activeRequiredFiles(fs);var history=fs.filter(function(f){return f&&String(f.status)==='replaced';});var rows=activeFs.map(function(f){return'<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px dashed var(--brd)"><span>📎 <b>'+esc(f.category==='modian_tax_invoice'?'سند سامانه مودیان':'فاکتور رسمی حسابداری')+'</b><br><small>'+esc(f.name||'فایل')+' — نسخه '+(+f.version||1)+'</small></span><span><button type="button" class="bt bt-o" style="font-size:11px" onclick="openStoredFile(\''+arg(f.key)+'\',\''+arg(f.name||'')+'\')">مشاهده</button> '+(can()?'<button type="button" class="bt bt-o" style="font-size:11px" onclick="ptfOfficialAttachmentReplace(\''+arg(iid(inv))+'\',\''+arg(f._id||'')+'\',\''+arg(f.category)+'\')">اصلاح/جایگزینی</button>':'')+'</span></div>';}).join('');if(!compact&&history.length)rows+='<details style="margin-top:7px"><summary>تاریخچه '+history.length+' نسخه جایگزین‌شده</summary>'+history.map(function(f){return'<div style="padding:4px 0;color:#64748b"><button class="bt bt-o" style="font-size:10px" onclick="openStoredFile(\''+arg(f.key)+'\',\''+arg(f.name||'')+'\')">مشاهده نسخه '+(+f.version||1)+'</button> '+esc(f.name||'')+'</div>';}).join('')+'</details>';return rows||'<span style="color:#b91c1c">مدرک اجباری ثبت نشده</span>';}

  window.buildInvoices=function(){return'<div class="ph"><h3>🧾 ثبت فاکتور رسمی صادرشده در حسابداری/مودیان</h3><div style="font-size:11.5px;color:#64748b">CRM فاکتور رسمی صادر نمی‌کند؛ فقط سند قطعی خارجی را ثبت و مطالبات آن را مدیریت می‌کند.</div><div class="sb2"><input type="text" id="invSrch" placeholder="جستجو: شماره CO، شماره فاکتور، شناسه مودیان، نام مشتری (فارسی/انگلیسی)…" oninput="renderInvoices()" style="flex:1;max-width:420px;padding:8px 10px;border:1px solid var(--brd);border-radius:10px;font-family:inherit;font-size:12.5px"></div></div><div id="invWrap"></div>';};
  /* ═══ v34.37.1 (INV-PANEL-ROWS) ═══
     خواستهٔ کارفرما: «فاکتورها به صورت ردیف نمایش داده شوند و اطلاعات دیگر به صورت
     کشویی در صورت زدن روی فلش باز شوند. اگر فاکتوری ثبت شد دکمهٔ ثبت فاکتور به
     «فاکتور ثبت شده است» تغییر کند و دیگر مودال ثبت را باز نکند.»
     پیش از این هر ارجاع یک کارتِ بلندِ همیشه‌باز بود و دکمهٔ «+ ثبت فاکتور رسمی
     صادرشده» حتی پس از ثبتِ فاکتور هم فعال می‌ماند و مودال را دوباره باز می‌کرد. */
  window._ptfInvOpenRows = window._ptfInvOpenRows || {};
  window.ptfInvRowToggle = function (key) {
    var open = !window._ptfInvOpenRows[key];
    window._ptfInvOpenRows[key] = open;
    var d = document.getElementById('invD_' + key);
    var a = document.getElementById('invA_' + key);
    if (d) d.style.display = open ? '' : 'none';
    if (a) { a.textContent = open ? '▾' : '◀'; a.setAttribute('aria-expanded', open ? 'true' : 'false'); }
  };
  window.ptfInvRowsToggleAll = function (open) {
    var el = document.getElementById('invWrap'); if (!el) return;
    (el.querySelectorAll('[data-inv-row]') || []).forEach(function (n) {
      var key = n.getAttribute('data-inv-row');
      window._ptfInvOpenRows[key] = !!open;
      var d = document.getElementById('invD_' + key), a = document.getElementById('invA_' + key);
      if (d) d.style.display = open ? '' : 'none';
      if (a) { a.textContent = open ? '▾' : '◀'; a.setAttribute('aria-expanded', open ? 'true' : 'false'); }
    });
  };
  /* کلید پایدار ردیف — با re-render وضعیت باز/بسته از بین نمی‌رود */
  function rowKey(no) { return String(no || '').replace(/[^A-Za-z0-9]/g, '_'); }

  /* ═══ v34.37.3 (INV-PANEL-COLS — گزارش کارفرما: «بهم‌ریختگی چینش ستون‌ها») ═══
     پیش از این عرض ستون‌ها دو بار دستی نوشته می‌شد (یک‌بار در سربرگ، یک‌بار در
     ردیف) و flex-wrap روی ردیف باعث می‌شد هر ردیف با نام مشتریِ بلند ستون‌هایش را
     جابه‌جا کند؛ یعنی ترازِ ستون‌ها بین ردیف‌ها هیچ‌گاه تضمین‌شده نبود.
     قرارداد جدید: یک قالب مشترک برای سربرگ و ردیف + ستون انعطاف‌پذیر (مشتری) که
     به‌جای راندنِ بقیه، خودش کوتاه (ellipsis) می‌شود.
     v34.37.6 (INV-PANEL-COL-CLIP — گزارش کارفرما: «اعداد و سرستون‌ها در هم می‌روند؛
     شماره سند مبنا روی اسم مشتری می‌افتد؛ مبلغ با مطالبه باز درهم می‌رود؛ سرستون
     اقدام بالای مقادیر نیست») — سه نقص در همان قرارداد بسته شد:
     ① ستون‌های ثابت flex:0 0 بودند: در پنلِ باریک کوتاه نمی‌شدند و از ظرف بیرون
       می‌زدند؛ حالا flex:0 1 با کفِ min-width — جمع‌شدنِ سربرگ و ردیف هم‌اندازه
       می‌ماند چون هر دو از همین یک قالب می‌خوانند.
     ② محتوای بلندتر از ستون هیچ clip نداشت (شمارۀ سند با بَجِ 💱 در ۱۱۲px، مبلغ
       ریالیِ ۱۰ رقمی در ۱۱۶px، دکمۀ ≈۱۷۰px «ثبت فاکتور» در ۱۳۸px) و در RTL سرریز
       به سمت چپ روی ستون بعدی نوشته می‌شد — همان «همپوشانی»؛ حالا تمام سلول‌ها
       overflow:hidden + text-overflow:ellipsis (بدترین حالت: سه‌نقطه با title که
       مقدار/شمارۀ کامل را نشان می‌دهد، نه همپوشانی) + عرض‌های واقعی + ارقام
       هم‌عرض (tabular-nums) برای دو ستون مبلغ.
     ③ جعبۀ سربرگ border نداشت ولی ردیف‌ها داخل کارتِ ۱px لبه‌دار بودند — کل تراز
       ۱–۲px جابه‌جا؛ حالا سربرگ هم همان لبه/گِردی دارد. برچسب‌ها هم صریح شدند:
       «شماره سند مبنا»، «مبلغ فاکتور (ریال)»، «مطالبه باز (ریال)». */
  var INV_COLS = [
    { id: 'arrow',  style: 'width:30px;flex:0 0 30px' },
    { id: 'doc',    style: 'min-width:96px;flex:0 1 132px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' },
    { id: 'cust',   style: 'min-width:90px;flex:1 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' },
    { id: 'status', style: 'min-width:92px;flex:0 1 128px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' },
    { id: 'amt',    style: 'min-width:110px;flex:0 1 146px;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-variant-numeric:tabular-nums' },
    { id: 'open',   style: 'min-width:110px;flex:0 1 146px;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-variant-numeric:tabular-nums' },
    { id: 'act',    style: 'min-width:122px;flex:0 1 176px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }
  ];
  function invCol(id, extra) {
    for (var i = 0; i < INV_COLS.length; i++) if (INV_COLS[i].id === id) return INV_COLS[i].style + (extra ? ';' + extra : '');
    return extra || '';
  }
  function invHeaderHtml() {
    return '<span style="' + invCol('arrow') + '"></span>' +
      '<span style="' + invCol('doc') + '">شماره سند مبنا</span>' +
      '<span style="' + invCol('cust') + '">مشتری</span>' +
      '<span style="' + invCol('status') + '">وضعیت فاکتور</span>' +
      '<span style="' + invCol('amt') + '" title="جمع فاکتورهای فعال (ریال)">مبلغ فاکتور (ریال)</span>' +
      '<span style="' + invCol('open') + '" title="ماندۀ وصولی‌نشده (ریال)">مطالبه باز (ریال)</span>' +
      '<span style="' + invCol('act') + '">اقدام</span>';
  }
  window.ptfInvPanelColStyles = function () { return INV_COLS.map(function (c) { return c.id + '|' + c.style; }); };

  /* ═══ v34.37.2 (INV-PANEL-ORPHANS) — سه نقصِ یک‌ریشه در لایهٔ نمایش فاکتورها ═══
     گزارش کارفرما: «در قسمت فاکتورها، فاکتورهای ثبت‌شده و ارجاع‌شده نمایش داده
     نمی‌شوند.» (تحلیل کامل: ARENA-CRM-INVOICE-PANEL-ASSESSMENT-2026-09-05.md)
     ریشهٔ مشترک: پنل «ارجاع‌محور» است — تنها مبدأ ردیف‌ها سوابق ptf_crm_offers با
     offer.invRef هستند و فاکتورها فقط «زیرِ» همان ردیف و با تطبیقِ سخت offerNo
     رندر می‌شوند. پس اگر invRef روی این دستگاه نرسیده یا پاک شده باشد (رویژن
     ابلاغ، لغو ارجاع، آینهٔ کهنهٔ فاز B، فاکتور مهاجرت‌شدهٔ بی‌offerNo) هر دو
     دسته یک‌جا ناپدید می‌شوند و فقط پیام «ارجاع آماده …» می‌ماند.
     دامنهٔ اصلاح — فقط نمایش؛ هیچ تغییری در مدل داده، سرور، مجوزها، یا جریان
     ثبت/اصلاح/ابطال فاکتور انجام نشده است:
       ① بخش «فاکتورهای ثبت‌شده بدون ردیف ارجاع»: سند یتیم دیگر نامرئی نیست و
         حداقل «📎 اسناد» و «ابطال» از همان‌جا در دسترس می‌ماند.
       ② تطبیق نرمال‌شده (trim + ارقام فارسی/عربی + نام‌های مستعار همان سند:
         نسخهٔ ریالی/مبنای ریالی/rialOf) و نجات فاکتورهای بی‌offerNo با caseId —
         فقط وقتی آن فاکتور هیچ مالکی ندارد و دقیقاً یک ردیف با همان پرونده هست.
       ③ سربرگ تشخیصی (ارجاع / ثبت‌شده / یتیم / مانده باز) + جستجو + «↻ بازخوانی
         از سرور» و یک بازتلاش خودکارِ یک‌باره (سقف ۶۰ ثانیه) وقتی پنل روی دادهٔ
         سرد رندر شده — رفع «خالی بودنِ صفحهٔ فرود حسابدار» پس از ورود.
     قفل «فاکتور ثبت شده است» هم از همان تطبیق نرمال‌شده استفاده می‌کند، پس حصارِ
     ثبتِ دوم با دادهٔ کج دیگر از کار نمی‌افتد (ریسک سند مالیاتی تکراری). */
  function normRef(v) {
    return String(v == null ? '' : v)
      .replace(/[۰-۹]/g, function (d) { return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); })
      .replace(/[٠-٩]/g, function (d) { return String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)); })
      .trim().toUpperCase();
  }
  /* نام‌های مستعارِ یک ردیف — همه به یک سند تجاری اشاره می‌کنند */
  function offerAliasKeys(o, comp) {
    var out = [];
    [o && o.no, o && o.rialOf, o && o.invRef && o.invRef.rialBasis, comp && comp.no].forEach(function (v) {
      var k = normRef(v); if (k && out.indexOf(k) < 0) out.push(k);
    });
    return out;
  }
  function openIrr(i) {
    return i.openAmountIRR != null ? +i.openAmountIRR : Math.max(0, (+i.amount || 0) - (+i.allocatedBase || 0) - (+i.allocatedVat || 0));
  }
  function invDateDesc(a, b) { return String(b.invDate || b.t || '').localeCompare(String(a.invDate || a.t || '')); }
  function hay(parts) {
    var out = [];
    (parts || []).forEach(function (x) { if (x !== null && x !== undefined && x !== '') out.push(x); });
    return normRef(out.join(' '));
  }
  function invHay(i) { return i ? hay([i.no, i.taxUid, i.modianReference, i.offerNo, i.invDate, i.buyerCo]) : ''; }
  /* نسخهٔ ریالی/مبنای ریالیِ همان ردیف — یک‌جا و با همان ترتیبِ همیشگی */
  function rowComp(o) {
    var comp = (o.invRef && o.invRef.rialBasis) ? findOffer(o.invRef.rialBasis) : (typeof window.ptfRialCompanionOf === 'function' ? window.ptfRialCompanionOf(o.no) : null);
    /* v34.37.1: «نسخهٔ ریالیِ همراه» فقط وقتی معنا دارد که سندِ دیگری باشد. برای ارجاع
       ریالیِ ساده rialBasis برابر خودِ شمارهٔ پیشنهاد است و findOffer همان سند را
       برمی‌گرداند؛ نتیجه‌اش این بود که پنل برای یک پیشنهاد IRR هم «💱 مبنای ریالی از
       پیشنهاد ارزی CO-… (IRR) — نرخ ۰ ریال» چاپ می‌کرد. */
    if (comp && String(comp.no) === String(o.no)) comp = null;
    return comp;
  }
  window._ptfInvHydrateAt = 0;
  /* «↻ بازخوانی از سرور» — یک catch-up pull و سپس رندر دوباره. بی‌خطر: اگر پنل
     بسته شده باشد (نبودِ #invWrap) هیچ کاری نمی‌کند و هیچ نوشتنی ندارد. */
  window.ptfInvoicesRefresh = function (cb) {
    var done = function () {
      try { if (document.getElementById('invWrap') && typeof window.renderInvoices === 'function') window.renderInvoices(); } catch (eR) {}
      if (typeof cb === 'function') { try { cb(); } catch (eCb) {} }
    };
    if (typeof window.ptfSyncPullNow === 'function' && typeof setTimeout === 'function') {
      window._ptfInvHydrateAt = Date.now();
      setTimeout(function () { try { window.ptfSyncPullNow(done); } catch (eP) { done(); } }, 120);
      return;
    }
    done();
  };
  function autoCatchupOnce() {
    try {
      if (typeof window.ptfSyncPullNow !== 'function' || typeof setTimeout !== 'function') return;
      if (Date.now() - (+window._ptfInvHydrateAt || 0) < 60000) return;
      window.ptfInvoicesRefresh();
    } catch (eA) {}
  }

  window.renderInvoices = function () {
    var el = document.getElementById('invWrap'); if (!el) return;
    /* v34.37.3 (INV-REF-UNDO-IMMEDIATE — دستور کارفرما): «لغو ارجاع باید ردیف را
       بلافاصله از ردیف‌های ثبت‌شده/ارجاع‌شده پاک کند». تا وقتی فرمان در راه است یا
       projection پاسخ به‌دلیل گاردِ watermarkِ krevs پذیرفته نشده (crm/sync.js:887)،
       invRef در آینهٔ محلی زنده می‌ماند و ردیف برمی‌گشت. این مجموعهٔ نشست، ردیفِ
       لغو‌شده را تا تأیید/ردِ سرور پنهان می‌کند (sales-domain-v2.js آن را پر و خالی
       می‌کند؛ در حالت رد، همان‌جا بازگردانی می‌شود). */
    var pendingRevoke = window._ptfInvRefPendingRevoke || {};
    var offers = data('ptf_crm_offers').filter(function (o) {
      return o && o.invRef && !o.rialOf && !pendingRevoke[String(o.no || '')];
    });
    var invs = data('ptf_crm_invoices');
    var canUndo = (typeof window.ptfCanRepairOfferWin === 'function') && window.ptfCanRepairOfferWin();
    var q = normRef(((document.getElementById('invSrch') || {}).value || ''));

    /* ── ① تقسیم فاکتورها: به هر ردیف، یا بخش یتیم‌ها ── */
    var aliasRow = {}, caseRow = {};
    offers.forEach(function (o) {
      var key = rowKey(o.no);
      offerAliasKeys(o, rowComp(o)).forEach(function (k) { if (aliasRow[k] === undefined) aliasRow[k] = key; });
      var c0 = findCaseForOffer(o);
      if (c0) [c0._id, c0.cd].forEach(function (idv) {
        var k = normRef(idv); if (!k) return;
        if (!caseRow[k]) caseRow[k] = [];
        if (caseRow[k].indexOf(key) < 0) caseRow[k].push(key);
      });
    });
    var byRow = {}, orphan = [], rescuedIds = {};
    invs.forEach(function (i) {
      if (!i) return;
      var k = normRef(i.offerNo);
      if (k && aliasRow[k] !== undefined) { (byRow[aliasRow[k]] = byRow[aliasRow[k]] || []).push(i); return; }
      if (!k) {
        var ck = normRef(i.caseId);
        if (ck && caseRow[ck] && caseRow[ck].length === 1) {
          var rk = caseRow[ck][0];
          (byRow[rk] = byRow[rk] || []).push(i);
          rescuedIds[iid(i)] = 1;
          return;
        }
      }
      orphan.push(i);
    });

    var rows = offers.map(function (o) {
      var key = rowKey(o.no);
      var c = findCaseForOffer(o);
      var comp = rowComp(o);
      var rialRate = comp && comp.fxConvert ? (+comp.fxConvert.rate || 0) : ((o.invRef && +o.invRef.rialRate) || 0);
      var rialTotal = comp ? (comp.items || []).reduce(function (s, it) { return s + (+it.qty || 0) * (+it.price || 0); }, 0) : ((o.invRef && +o.invRef.rialTotal) || 0);
      var list = (byRow[key] || []).slice().sort(invDateDesc);
      var live = list.filter(active);
      var activeInv = live[0] || null;
      var openSum = live.reduce(function (s, i) { return s + openIrr(i); }, 0);
      var billed = live.reduce(function (s, i) { return s + (+i.amount || 0); }, 0);
      var isOpen = !!window._ptfInvOpenRows[key];

      var pair = (typeof ptfCustNamePair === 'function') ? ptfCustNamePair(o.buyerCd, o.buyerCo) : { fa: o.buyerCo || '', en: '' };
      /* جستجو (v34.9.2 — در پنل زنده گم شده بود): شماره سند/پرونده/مشتری/فاکتور/مودیان */
      if (q && hay([o.no, o.buyerCo, o.inqNo, comp && comp.no, c && (c.cd || c.inqNo), pair.fa, pair.en].concat(list.map(invHay))).indexOf(q) < 0) return '';

      /* ── وضعیت ردیف ── */
      var status;
      if (activeInv) status = '<span class="bd" style="background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0" title="شمارهٔ فاکتور رسمی ثبت‌شده">✅ فاکتور ' + esc(activeInv.no || activeInv.cd) + '</span>';
      else if (list.length) status = '<span class="bd" style="background:#fef2f2;color:#b91c1c;border:1px solid #fecaca" title="همهٔ فاکتورهای این ارجاع ابطال شده‌اند">🚫 ابطال‌شده</span>';
      else status = '<span class="bd" style="background:#fffbeb;color:#92400e;border:1px solid #fde68a">⏳ بدون فاکتور</span>';

      /* ── دکمهٔ اصلی ردیف ──
         v34.37.1: پس از ثبتِ فاکتورِ فعال، دکمهٔ ثبت جای خود را به یک نشانگرِ
         غیرقابل‌کلیک می‌دهد؛ مسیر باز شدن دوبارهٔ مودالِ ثبت کاملاً بسته است.
         اصلاح/ابطال همچنان از داخل کشو در دسترس است. */
      var mainBtn;
      if (!c) mainBtn = '<span style="color:#b91c1c;font-size:11.5px">⛔ پرونده فروش یافت نشد</span>';
      else if (activeInv) mainBtn = '<span class="bd" data-inv-registered="1" style="background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;cursor:default" title="برای اصلاح یا ابطال، ردیف را باز کنید">✅ فاکتور ثبت شده است</span>';
      else if (can()) mainBtn = '<button class="bt" style="padding:5px 11px;font-size:11.5px" onclick="event.stopPropagation();showInvModal(\'' + arg(o.no) + '\')">+ ثبت فاکتور رسمی صادرشده</button>';
      else mainBtn = '';

      /* ── کارت‌های فاکتور (داخل کشو) ── */
      var cards = list.map(function (i) {
        var isVoid = !active(i);
        var open = openIrr(i);
        return '<div style="margin-top:8px;padding:9px;border:1px solid ' + (isVoid ? '#fecaca' : '#bbf7d0') + ';border-radius:10px;background:' + (isVoid ? '#fef2f2' : '#f8fafc') + '">' +
          '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><span><b>' + esc(i.no || i.cd) + '</b> ' +
          (isVoid ? '<span style="color:#b91c1c">ابطال‌شده</span>' : '<span style="color:#047857">فعال</span>') +
          (rescuedIds[iid(i)] ? ' <span style="color:#0e7490" title="این فاکتور offerNo نداشت و از روی پروندهٔ فروش به همین ردیف وصل شد">🧭 وصل‌شده از پرونده</span>' : '') +
          '<br><small>تاریخ: ' + esc(i.invDate || '') + ' | شناسه مودیان: ' + esc(i.taxUid || '—') + '</small>' +
          '<br><small>پایه: ' + money(i.base || 0) + ' | VAT ' + (+i.vatPercent || 0) + '٪: ' + money(i.vat || 0) + ' | کل: ' + money(i.amount || 0) + ' | مطالبه باز: ' + money(isVoid ? 0 : open) + '</small></span><span>' +
          (isVoid ? '' : (can() ? '<button class="bt bt-o" style="font-size:11px" onclick="showInvModal(\'' + arg(o.no) + '\',\'' + arg(iid(i)) + '\')">اصلاح اطلاعات</button> <button class="bt bt-o" style="font-size:11px;color:#b91c1c" onclick="ptfInvoiceVoid(\'' + arg(iid(i)) + '\')">ابطال</button> ' : '')) +
          (role() === 'admin' ? '<button class="bt bt-o" style="font-size:11px;color:#b91c1c" onclick="ptfAdminHardDelete(\'invoice\',\'' + arg(iid(i)) + '\',function(){renderInvoices();if(typeof renderReceivables===\'function\')renderReceivables();})">حذف قطعی</button> ' : '') +
          '<button class="bt bt-o" style="font-size:11px" onclick="ptfOfficialInvoiceFilesUi(\'' + arg(iid(i)) + '\')">📎 اسناد</button></span></div>' +
          '<div style="margin-top:5px">' + filesHtml(i, true) + '</div></div>';
      }).join('');

      /* ── اسناد مبنا + لغو ارجاع (داخل کشو) ── */
      var docBtns = comp
        ? '<button class="bt bt-o" style="font-size:11px;color:#047857;border-color:#a7f3d0" title="نسخه ریالی داده‌شده به کارفرما — مبنای صدور فاکتور رسمی" onclick="offerPrint(\'' + arg(comp.no) + '\')">💱 مبنای ریالی (PDF)</button> <button class="bt bt-o" style="font-size:11px;color:#64748b" title="پیش‌نمایش نسخه ریالی" onclick="offerQuickPreview(\'' + arg(comp.no) + '\')">👁</button> '
        : (o.invRef && o.invRef.fromFile && typeof sfAwardPrint === 'function'
          ? '<button class="bt bt-o" style="font-size:11px;color:#b45309;border-color:#fde68a" title="نسخه تغییرناپذیر لحظه ابلاغ سفارش — مبنای صدور فاکتور رسمی" onclick="sfAwardPrint(\'' + arg(o.invRef.fromFile) + '\',\'' + arg(o.no) + '\')">🏆 سند برد (PDF)</button> ' : '');
      /* v34.37.0 (INV-REF-UNDO): «اگر ارجاع اشتباه بود، از قسمت فاکتورها هم بشود برگرداند».
         تا وقتی هیچ فاکتور فعالی ثبت نشده، ادمین/رئیس می‌تواند ارجاع را همین‌جا لغو کند. */
      var undoBtn = (!activeInv && canUndo)
        ? '<button class="bt bt-o" style="font-size:11px;color:#b45309;border-color:#fde68a" title="ارجاع را برمی‌گرداند تا پرونده با مبنای ریالی/نرخ درست دوباره ارجاع شود" onclick="ptfRevokeInvoiceRef(\'' + arg(o.no) + '\')">↩️ لغو ارجاع</button>'
        : (activeInv ? '<span style="font-size:11px;color:#9a3412">🔒 فاکتور ثبت شده؛ لغو ارجاع ممکن نیست (ابتدا فاکتور را ابطال کنید).</span>' : '');

      var meta = '<div style="font-size:11.5px;color:#475569;line-height:1.9">' +
        (comp ? '💱 مبنای ریالی از پیشنهاد ارزی <b dir="ltr">' + esc(o.no) + '</b> (' + esc(o.currency || '') + ') — نرخ ' + (+rialRate).toLocaleString('fa-IR') + ' ریال' + ((o.invRef && o.invRef.rialRateDerived) ? ' (برگرفته از جمع سند ریالی)' : '') + ' — جمع: ' + money(rialTotal) + '<br>' : '') +
        'ارجاع از پرونده: ' + esc((o.invRef || {}).t || '') + (o.invRef && o.invRef.by ? ' — توسط ' + esc(o.invRef.by) : '') +
        (pair.en && pair.en !== pair.fa ? '<br><span dir="ltr" style="color:#64748b">' + esc(pair.en) + '</span>' : '') +
        '</div>';

      return '<div data-inv-row="' + key + '" style="border:1px solid var(--brd);border-radius:12px;background:#fff;margin-bottom:7px;overflow:hidden">' +
        /* ردیف فشرده — کل ردیف کلیک‌پذیر است، فلش هم برای دسترس‌پذیری دکمهٔ مستقل دارد */
        '<div style="display:flex;align-items:center;gap:9px;padding:9px 11px;cursor:pointer" onclick="ptfInvRowToggle(\'' + key + '\')">' +
        '<span style="' + invCol('arrow') + ';display:flex;align-items:center"><button type="button" id="invA_' + key + '" class="bt bt-o" aria-expanded="' + (isOpen ? 'true' : 'false') + '" title="نمایش/پنهان‌کردن جزئیات" style="padding:1px 8px;font-size:13px;line-height:1.6;width:30px" onclick="event.stopPropagation();ptfInvRowToggle(\'' + key + '\')">' + (isOpen ? '▾' : '◀') + '</button></span>' +
        '<span style="' + invCol('doc') + '" title="' + esc(comp ? comp.no : o.no) + '"><b dir="ltr">' + esc(comp ? comp.no : o.no) + '</b>' + (comp ? ' <small style="color:#0e7490">💱</small>' : '') + '</span>' +
        '<span style="' + invCol('cust') + '" title="' + esc(pair.fa || '-') + '">' + esc(pair.fa || '-') + '</span>' +
        '<span style="' + invCol('status') + '">' + status + '</span>' +
        '<span style="' + invCol('amt') + '" title="جمع فاکتورهای فعال (ریال)">' + money(billed || rialTotal) + '</span>' +
        '<span style="' + invCol('open') + ';color:' + (openSum > 0.5 ? '#b45309' : '#065f46') + '" title="ماندۀ وصولی‌نشده (ریال)">' + money(openSum) + '</span>' +
        '<span style="' + invCol('act') + ';display:flex;align-items:center;justify-content:flex-start;gap:6px;white-space:nowrap" onclick="event.stopPropagation()">' + mainBtn + '</span>' +
        '</div>' +
        /* کشوی جزئیات */
        '<div id="invD_' + key + '" style="display:' + (isOpen ? '' : 'none') + ';padding:0 11px 11px;border-top:1px solid var(--brd);background:#fcfdff">' +
        '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:flex-start;padding-top:9px">' + meta +
        '<span style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">' + docBtns + undoBtn + '</span></div>' +
        (cards || '<div style="margin-top:8px;font-size:12px;color:#94a3b8">هنوز فاکتوری برای این ارجاع ثبت نشده است.</div>') +
        '</div></div>';
    }).filter(function (x) { return !!x; }).join('');

    /* ── ② بخش یتیم‌ها: فاکتور رسمیِ فعالی که هیچ ردیف ارجاعی آن را نمی‌شناسد ──
       فقط فاکتورهای رسمی (isUnofficial نه‌اند) — صورتحساب غیررسمی ماژول خودش را
       دارد و اینجا نباید فیلترِ دفتر غیررسمی (ptfCanSeeLedger) دور زده شود. */
    var orphans = orphan.filter(function (i) { return i && active(i) && !i.isUnofficial; });
    if (q) orphans = orphans.filter(function (i) { return invHay(i).indexOf(q) > -1; });
    orphans.sort(invDateDesc);
    var orphanVoidLeft = orphan.filter(function (i) { return i && !active(i) && !i.isUnofficial && (!q || invHay(i).indexOf(q) > -1); }).length;
    var ORPHAN_CAP = 40;
    var orphanHtml = orphans.slice(0, ORPHAN_CAP).map(function (i) {
      var knownOffer = !!(normRef(i.offerNo) && findOffer(i.offerNo));
      var c = null, cand = data('ptf_crm_deals').filter(function (x) { return x && active(x) && (normRef(x._id) === normRef(i.caseId) || normRef(x.cd) === normRef(i.caseId)); })[0];
      c = cand || null;
      return '<div style="margin-top:7px;padding:9px;border:1px solid #fed7aa;border-radius:10px;background:#fff7ed">' +
        '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><span><b>' + esc(i.no || i.cd) + '</b> <span style="color:#9a3412">⚠️ بدون ردیف ارجاع</span>' +
        '<br><small>تاریخ: ' + esc(i.invDate || '') + ' | شناسه مودیان: ' + esc(i.taxUid || '—') + ' | سند مبدأ: ' + esc(i.offerNo || '—') + ' | پرونده: ' + esc((c && (c.inqNo || c.cd)) || i.caseId || '—') + '</small>' +
        '<br><small>پایه: ' + money(i.base || 0) + ' | کل: ' + money(i.amount || 0) + ' | مطالبه باز: ' + money(openIrr(i)) + '</small></span><span>' +
        (can() && knownOffer ? '<button class="bt bt-o" style="font-size:11px" onclick="showInvModal(\'' + arg(i.offerNo) + '\',\'' + arg(iid(i)) + '\')">اصلاح اطلاعات</button> ' : '') +
        (can() ? '<button class="bt bt-o" style="font-size:11px;color:#b91c1c" onclick="ptfInvoiceVoid(\'' + arg(iid(i)) + '\')">ابطال</button> ' : '') +
        /* پرش به پروندهٔ مبدأ — «دوباره ارجاع بده» بدون این‌که کاربر مسیر را گم کند */
        (typeof ptfGoSalesFile === 'function' ? '<button class="bt bt-o" style="font-size:11px" title="پروندهٔ فروش مبدأ باز می‌شود؛ در صورت لزوم همان‌جا دوباره ارجاع دهید" onclick="ptfGoSalesFile(\'' + arg((c && c.cd) || '') /* A2/arch-guard: فقط cd — و همین کلیدی است که salesfiles با آن ردیف را باز می‌کند (window._sfOpen === r.cd)؛ بدون فال‌بک _id */ + '\')">🔗 پرونده</button> ' : '') +
        '<button class="bt bt-o" style="font-size:11px" onclick="ptfOfficialInvoiceFilesUi(\'' + arg(iid(i)) + '\')">📎 اسناد</button></span></div>' +
        '<div style="margin-top:5px;font-size:11px;color:#9a3412;line-height:1.8">این سند روی پروندهٔ فروش ثبت شده ولی «ارجاع فعال» (invRef) روی پیشنهاد یافت نشد — ' +
        'معمولاً پس از «رویژن ابلاغ»، «لغو ارجاع» یا همگام‌سازی نشدنِ این دستگاه. برای بازگشتنِ ردیف: «🔗 پرونده» را بزنید و از پروندهٔ فروش دوباره ارجاع دهید ' +
        'یا «↻ بازخوانی از سرور» را بزنید. مبلغ در «💰 مطالبات» درست محاسبه می‌شود و هیچ سندِ تکراری لازم نیست.</div>' +
        '<div style="margin-top:5px">' + filesHtml(i, true) + '</div></div>';
    }).join('');
    if (orphans.length > ORPHAN_CAP) orphanHtml += '<div style="font-size:11.5px;color:#64748b;margin-top:6px">… و ' + (orphans.length - ORPHAN_CAP) + ' مورد دیگر (با فیلتر یا «💰 مطالبات» ببینید).</div>';

    /* ── ③ سربرگ تشخیصی ── */
    var statReg = 0, statOpen = 0, statRows = 0;
    offers.forEach(function (o) {
      var l = (byRow[rowKey(o.no)] || []).filter(active);
      if (!l.length) return;
      statRows++;
      statReg++;
      l.forEach(function (i) { statOpen += openIrr(i); });
    });
    orphans.forEach(function (i) { statOpen += openIrr(i); });
    var summary = '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:11.5px;color:#475569;background:#f8fafc;border:1px solid var(--brd);border-radius:10px;padding:6px 10px;margin-bottom:7px">' +
      '<span title="پیشنهادهایی که برای صدور فاکتور رسمی به حسابدار ارجاع شده‌اند">📤 ارجاع‌شده: <b>' + offers.length + '</b></span>' +
      '<span style="color:#065f46" title="ارجاع‌هایی که حداقل یک فاکتور فعال دارند">✅ ثبت‌شده: <b>' + statReg + '</b></span>' +
      (orphans.length ? '<span style="color:#9a3412" title="فاکتور رسمی فعالی که ردیف ارجاع ندارد — از همین‌جا قابل دسترسی است">⚠️ بدون ردیف ارجاع: <b>' + orphans.length + '</b></span>' : '') +
      '<span title="جمع ماندهٔ فاکتورهای فعال">💰 مطالبه باز: <b>' + money(statOpen) + '</b></span>' +
      '<span style="color:#64748b" title="تعداد رکوردی که این دستگاه از دو مجموعهٔ لازم برای این پنل دارد">دادهٔ این دستگاه: ' + invs.length + ' فاکتور · ' + data('ptf_crm_offers').length + ' پیشنهاد</span>' +
      '<button class="bt bt-o" style="font-size:11px;margin-inline-start:auto" title="یک همگام‌سازی فوری با سرور و سپس بازسازی فهرست" onclick="ptfInvoicesRefresh()">↻ بازخوانی از سرور</button>' +
      '</div>';

    if (!rows && !orphanHtml) {
      el.innerHTML = summary +
        '<div style="text-align:center;color:#94a3b8;padding:24px">' +
        (q ? 'هیچ ردیفی با جستجوی «' + esc(((document.getElementById('invSrch') || {}).value || '')) + '» پیدا نشد. ' : '') +
        (invs.length || data('ptf_crm_offers').length
          ? 'ارجاع آماده ثبت فاکتور رسمی وجود ندارد.<br><small style="color:#9a3412">در حافظهٔ این دستگاه ' + invs.length + ' فاکتور و ' + data('ptf_crm_offers').length + ' پیشنهاد هست، ولی هیچ پیشنهادی «ارجاع فعال» (invRef) ندارد — اگر فاکتوری ثبت شده، دادهٔ این دستگاه کهنه است: «↻ بازخوانی از سرور» را بزنید یا یک‌بار از بخش دیگری به این‌جا برگردید.</small>'
          : 'ارجاع آماده ثبت فاکتور رسمی وجود ندارد.<br><small style="color:#9a3412">هیچ رکوردی از پیشنهادها/فاکتورها در این دستگاه خوانده نشد — احتمالاً همگام‌سازی کامل نشده: «↻ بازخوانی از سرور» و سپس «تنظیمات ← وضعیت دستگاه» را ببینید.</small>') +
        '</div>';
      if (!q) autoCatchupOnce();
      return;
    }
    el.innerHTML = summary +
      '<div style="display:flex;justify-content:flex-end;gap:6px;margin-bottom:7px">' +
      '<button class="bt bt-o" style="font-size:11px" onclick="ptfInvRowsToggleAll(true)">باز کردن همه</button>' +
      '<button class="bt bt-o" style="font-size:11px" onclick="ptfInvRowsToggleAll(false)">بستن همه</button></div>' +
      '<div style="display:flex;align-items:center;gap:9px;padding:4px 11px;font-size:11px;color:#64748b;font-weight:700;background:#f1f5f9;border:1px solid var(--brd);border-radius:12px;margin:0 0 3px">' +
      invHeaderHtml() + '</div>' + rows +
      (orphanHtml
        ? '<div style="margin-top:10px;border-top:2px dashed #fdba74;padding-top:8px">' +
          '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px;color:#9a3412;font-weight:700">' +
          '<span>🧾 فاکتورهای ثبت‌شده بدون ردیف ارجاع (' + orphans.length + ')</span>' +
          (orphanVoidLeft ? '<small style="color:#64748b;font-weight:400">' + orphanVoidLeft + ' سند ابطال‌شدهٔ مرتبط هم در بایگانی همین بخش است</small>' : '') +
          '</div>' + orphanHtml + '</div>'
        : '');
    if (q && !rows && !orphans.length) autoCatchupOnce();
  };

  /* فاکتور فعالِ ثبت‌شده روی یک پیشنهاد (پایهٔ قفلِ «ثبت دوباره ممنوع»)
     v34.37.2: تطبیق نرمال‌شده + نام‌های مستعارِ همان سند (نسخهٔ ریالی/مبنای ریالی).
     پیش از این با یک فاصله یا یک شمارهٔ ریالیِ جابه‌جا، هم ردیف «بدون فاکتور»
     می‌شد و هم این قفل از کار می‌افتاد ⇒ امکان ثبت سند مالیاتی دوم روی همان پرونده.
     ⚠️ خودکفا: tester598 همین تابع را تنها (برشِ ایزوله در vm) اجرا می‌کند و در آن
     هارنس نه findOffer قابل صدا زدن است («گارد باید پیش از لمس findOffer برگردد») و
     نه توابع کمکیِ بیرونِ برش در دست‌اند؛ پس نرمال‌سازی و تطبیق داخل بدنه تکرار شده
     و هیچ وابستگی بیرونی جز data()/active() ندارد. تغییرش دادنی؟ هر دو جا (اینجا و
     offerAliasKeys در renderInvoices) باید هم‌قاعده بمانند. */
  window.ptfActiveInvoiceOfOffer=function(offerNo){
    var nrm=function(v){return String(v==null?'':v).replace(/[۰-۹]/g,function(d){return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d));}).replace(/[٠-٩]/g,function(d){return String('٠١٢٣٤٥٦٧٨٩'.indexOf(d));}).trim().toUpperCase();};
    var s=nrm(offerNo);if(!s)return null;
    var alias={};alias[s]=1;
    var offers=data('ptf_crm_offers'),o=offers.filter(function(x){return x&&nrm(x.no)===s;})[0]||null;
    if(o){
      /* نسخهٔ ریالی/مبنای ریالیِ همین ارجاع، همان سند تجاری است — نه سند دوم */
      [o.rialOf,o.invRef&&o.invRef.rialBasis].forEach(function(v){var k=nrm(v);if(k)alias[k]=1;});
      offers.forEach(function(x){if(x&&nrm(x.rialOf)===s){var k=nrm(x.no);if(k)alias[k]=1;}});
    }
    return data('ptf_crm_invoices').filter(function(i){
      return i&&active(i)&&!i.isUnofficial&&alias[nrm(i.offerNo)]===1;
    })[0]||null;
  };
  window.showInvModal=function(offerNo,editId){
    if(!can()){alert('⛔ نقش فعلی مجاز به ثبت/اصلاح فاکتور رسمی نیست');return;}
    /* ═══ v34.37.1 (INV-PANEL-ROWS): قفل «ثبت دوباره» ═══
       خواستهٔ کارفرما: «اگر فاکتوری ثبت شد … نباید با زدن روی ثبت فاکتور پنجرهٔ مودالِ
       ثبت دوباره باز شود.» دکمهٔ پنل فاکتورها از قبل جای خود را به نشانگر داده است،
       ولی این گارد در خودِ در ورودی است تا هیچ مسیر دیگری (کشوی پروندهٔ فروش، کارتابل،
       فراخوانی مستقیم) هم نتواند فاکتور دوم بسازد. مسیر اصلاح (editId) باز می‌ماند. */
    if(!editId){
      var already=window.ptfActiveInvoiceOfOffer(offerNo);
      if(already){
        alert('✅ برای این ارجاع فاکتور «'+String(already.no||already.cd||'')+'» از قبل ثبت شده است.\n\nبرای تغییر اطلاعات از «اصلاح اطلاعات» و برای ثبت سند جایگزین ابتدا از «ابطال» استفاده کنید (ردیف را در پنل فاکتورها باز کنید).');
        return;
      }
    }
    var o=findOffer(offerNo),c=findCaseForOffer(o),inv=editId?findInvoice(editId):null;var comp=(o&&o.invRef&&o.invRef.rialBasis)?findOffer(o.invRef.rialBasis):(o&&typeof window.ptfRialCompanionOf==='function'?window.ptfRialCompanionOf(o.no):null);var rialTotal=comp?(comp.items||[]).reduce(function(s,it){return s+(+it.qty||0)*(+it.price||0);},0):(o&&o.currency==='IRR'?(o.items||[]).reduce(function(s,it){return s+(+it.qty||0)*(+it.price||0);},0):0);/* v34.31.0 (FX-RIAL-REF): نمایش نرخ حتی وقتی نسخهٔ ریالی «ثبت‌شدهٔ مستقل» است (بدون اف‌ایکس‌کانورت) — فال‌بک به نرخ ذخیره‌شدهٔ ارجاع + برچسب برگرفته */var rbRateShown=(comp&&comp.fxConvert&&+comp.fxConvert.rate>0)?+comp.fxConvert.rate:((o&&o.invRef&&+o.invRef.rialRate)||0);var rbDerived=!!(comp&&rbRateShown>0&&!(comp.fxConvert&&+comp.fxConvert.rate>0));/*--RB-RATE--*//* v34.7.26 (S1/F1-4): اگر «اصلاح» با شناسه صدا زده شد ولی سند پیدا نشد، مودال نباید بی‌صدا در حالت «ثبت فاکتور جدید» باز شود (ریسک سند تکراری). */if(editId&&!inv){alert('⛔ فاکتور رسمی با شناسهٔ «'+String(editId)+'» یافت نشد؛ برای جلوگیری از ثبت سند تکراری، فرم اصلاح باز نشد.');return;}/* v34.7.26 (S1/F1-4b): این مودال «ثبت فاکتور رسمی» است؛ اگر شناسهٔ یک صورتحساب غیررسمی به آن داده شود نباید سند غیررسمی را با فرم رسمی بازنویسی کند. */if(inv&&inv.isUnofficial){alert('⛔ این سند «صورتحساب غیررسمی» است و از فرم فاکتور رسمی اصلاح نمی‌شود؛ از مسیر صورتحساب غیررسمی همان پرونده اقدام کنید.');return;}if(!o||!c){alert('پیشنهاد یا پرونده یکتا یافت نشد');return;}if(inv&&!active(inv)){alert('فاکتور ابطال‌شده قابل اصلاح نیست');return;}draftFiles=inv?JSON.parse(JSON.stringify(inv.files||[])):[];window._ptfOfficialInvCtx={offerNo:offerNo,caseId:cid(c),invoiceId:inv?iid(inv):'',existing:inv,caseRecord:c,offerRecord:o,rialBasisNo:comp?comp.no:'',rialBasisRate:(comp&&comp.fxConvert?(+comp.fxConvert.rate||0):(o&&o.invRef?(+o.invRef.rialRate||0):0)),rialBasisTotal:rialTotal,operationId:'OFFICIAL-INVOICE|'+(inv?iid(inv):offerNo)+'|'+Date.now()+'|'+Math.random().toString(36).slice(2,8)};var pct=inv?inv.vatPercent:vatDefault(inv?inv.invDate:(typeof faDate==='function'?faDate():''));document.querySelectorAll('#ptfOfficialInvDlg').forEach(function(x){x.remove();});var current=inv?'<div style="background:#f8fafc;border:1px solid var(--brd);border-radius:9px;padding:8px;margin-bottom:8px"><b>اسناد فعال فعلی</b>'+filesHtml(inv,true)+'</div>':'';var unofficial=data('ptf_crm_invoices').filter(function(i){return i&&active(i)&&i.isUnofficial&&i.offerNo===offerNo;}),unofficialHtml=(!inv&&unofficial.length)?'<div class="fld"><label>صورتحساب غیررسمی مبدأ (در صورت تبدیل)</label><select id="ofiReplaces"><option value="">— بدون جایگزینی —</option>'+unofficial.map(function(i){return'<option value="'+esc(iid(i))+'">'+esc(i.no||i.cd)+' — '+money(i.amount||0)+'</option>';}).join('')+'</select></div>':'';var html='<div class="md-b" id="ptfOfficialInvDlg" style="display:grid;z-index:3000" onclick="if(event.target===this)ptfOfficialInvoiceCancel()"><div class="md" style="max-width:820px;max-height:94vh;overflow:auto"><h3>'+(inv?'اصلاح ثبت CRM':'ثبت')+' فاکتور رسمی صادرشده — '+esc(offerNo)+'</h3><div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:8px;color:#1e40af;font-size:12px">فاکتور ابتدا در نرم‌افزار حسابداری/سامانه مودیان صادر شده است. مبلغ VAT و مبلغ نهایی قابل تایپ نیستند و از فرمول قطعی محاسبه می‌شوند.</div>'+(comp?'<div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:8px;color:#065f46;font-size:12px;margin-top:6px">💱 <b>مبنای ریالی:</b> '+esc(comp.no)+' — جمع ریالی '+money(rialTotal)+' — نرخ تسعیر '+(+rbRateShown).toLocaleString('fa-IR')+' ریال'+(rbDerived?' (برگرفته از جمع سند ریالی)':'')+' — پیشنهاد ارزی مبدأ: '+esc(o.no)+' ('+esc(o.currency||'')+')</div>':'')+current+unofficialHtml+'<div class="fr"><div class="fld"><label>شماره فاکتور حسابداری *</label><input id="ofiNo" value="'+esc(inv?inv.no:'')+'" dir="ltr"></div><div class="fld"><label>شناسه یکتای مالیاتی/مودیان *</label><input id="ofiTax" value="'+esc(inv?inv.taxUid:'')+'" dir="ltr"></div></div><div class="fr"><div class="fld"><label>تاریخ صدور (شمسی) *</label>'+(typeof ptfDatePicker==='function'?ptfDatePicker('ofiDate',inv?inv.invDate:(typeof faDate==='function'?faDate():'')):'<input id="ofiDate" value="'+esc(inv?inv.invDate:(typeof faDate==='function'?faDate():''))+'">')+'</div><div class="fld"><label>مرجع مودیان</label><input id="ofiModian" value="'+esc(inv?inv.modianReference||'':'')+'" dir="ltr"></div></div><div class="fr"><div class="fld"><label>مبلغ پایه (ریال) *</label><input id="ofiBase" type="number" value="'+esc(inv?inv.base:(rialTotal||''))+'" dir="ltr" oninput="ptfOfficialInvoiceCalc()"></div><div class="fld"><label>درصد ارزش افزوده * <small style="color:#0e7490">(از هاب مالی — قابل ویرایش در «ارزش افزوده»</small>)</label><input id="ofiVatPct" type="number" step="0.01" value="'+esc(pct)+'" dir="ltr" oninput="ptfOfficialInvoiceCalc()"></div></div><div id="ofiCalc"></div><div class="fld"><label>نوع پوشش فاکتور</label><select id="ofiCoverage" onchange="ptfOfficialCoverageRender()"><option value="amount">مبلغ/درصد کلی</option><option value="lines">اقلام و مقدار</option></select></div><div id="ofiCoverageBody"></div>'+
      '<div style="background:#fff7ed;border:1px solid #fdba74;border-radius:10px;padding:9px;margin-top:8px"><b>حداقل یکی از دو مدرک زیر اجباری است</b><div class="fr" style="margin-top:7px"><div><label>فاکتور رسمی سیستم حسابداری</label><div id="ofiAccUp" style="border:1px dashed #fdba74;border-radius:9px;padding:7px"></div></div><div><label>سند/تصویر سامانه مودیان</label><div id="ofiModUp" style="border:1px dashed #fdba74;border-radius:9px;padding:7px"></div></div></div><div id="ofiFileState" style="font-size:11.5px;margin-top:6px"></div></div>'+(inv?'<div class="fld"><label>دلیل اصلاح اطلاعات CRM *</label><textarea id="ofiReason" rows="2"></textarea></div>':'')+'<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px"><button class="bt bt-o" onclick="ptfOfficialInvoiceCancel()">انصراف</button><button class="bt" id="ofiSave" onclick="saveInv(\''+arg(offerNo)+'\')">'+(inv?'ثبت اصلاحیه':'ثبت فاکتور رسمی')+'</button></div></div></div>';document.getElementById('panels').insertAdjacentHTML('beforeend',html);if(document.getElementById('ofiCoverage')&&inv)document.getElementById('ofiCoverage').value=inv.coverageMode||'amount';
    function uploaded(cat,f){f.category=cat;f.status='active';f.version=1;f._justUploaded=true;draftFiles.push(f);window.ptfOfficialInvoiceFileState();window.ptfOfficialInvoiceOcr(f);}
    if(typeof attachUploadWidget==='function'){var removed=function(key){draftFiles=draftFiles.filter(function(f){return f.key!==key;});window.ptfOfficialInvoiceFileState();};attachUploadWidget('ofiAccUp','official-invoices/accounting',function(f){uploaded('accounting_official_invoice',f);},removed);attachUploadWidget('ofiModUp','official-invoices/modian',function(f){uploaded('modian_tax_invoice',f);},removed);}
    window.ptfOfficialInvoiceCalc();window.ptfOfficialCoverageRender();window.ptfOfficialInvoiceFileState();
  };
  function coverageOffers(){var x=window._ptfOfficialInvCtx||{},c=x.caseRecord||{},all=data('ptf_crm_offers'),out=[];(c.linkedOffers||[]).forEach(function(l){var o=all.filter(function(z){return z&&(z._id===l.offerId||z.no===l.offerNo);})[0];if(o&&!out.some(function(q){return q.no===o.no;}))out.push(o);});if(!out.length&&x.offerRecord)out.push(x.offerRecord);return out;}
  window.ptfOfficialCoverageRender=function(){var el=document.getElementById('ofiCoverageBody');if(!el)return;var mode=(document.getElementById('ofiCoverage')||{}).value||'amount',inv=(window._ptfOfficialInvCtx||{}).existing||{},old=Array.isArray(inv.coverage)?inv.coverage:[];if(mode==='amount'){var a=old.filter(function(x){return x&&x.mode==='amount';})[0]||{};el.innerHTML='<div class="fr"><div class="fld"><label>درصد/سهم این صورت‌حساب از پرونده</label><input id="ofiCoveragePct" type="number" step="0.01" value="'+esc(a.percent||'')+'" dir="ltr"></div><div class="fld"><label>دلیل/شرح صورت‌وضعیت *</label><input id="ofiCoverageNote" value="'+esc(a.note||'')+'"></div></div>';return;}var oldMap={};old.forEach(function(x){if(x&&x.lineKey)oldMap[x.lineKey]=x;});var rows=[];coverageOffers().forEach(function(o){(o.items||[]).forEach(function(it,idx){var key=(o._id||o.no)+'|'+(it.lineId||it.sourceItemKey||idx),prev=oldMap[key]||{},max=+it.qty||0;rows.push('<tr><td><input type="checkbox" class="ofiLineUse" data-key="'+esc(key)+'" data-offer="'+esc(o._id||o.no)+'" data-line="'+esc(it.lineId||it.sourceItemKey||idx)+'" '+(prev.qty?'checked':'')+'></td><td>'+esc(o.no)+'</td><td>'+esc(it.name||it.nm||it.desc||'قلم')+'</td><td>'+max.toLocaleString('fa-IR')+'</td><td><input class="ofiLineQty" data-key="'+esc(key)+'" type="number" min="0" max="'+max+'" value="'+esc(prev.qty||'')+'" style="width:100px" dir="ltr"></td></tr>');});});el.innerHTML='<div class="tb2"><table><thead><tr><th>انتخاب</th><th>پیشنهاد</th><th>قلم</th><th>مقدار قرارداد</th><th>مقدار این فاکتور</th></tr></thead><tbody>'+(rows.join('')||'<tr><td colspan="5">قلمی یافت نشد</td></tr>')+'</tbody></table></div>';};
  function collectCoverage(){var mode=(document.getElementById('ofiCoverage')||{}).value||'amount';if(mode==='amount')return[{mode:'amount',percent:num((document.getElementById('ofiCoveragePct')||{}).value),note:((document.getElementById('ofiCoverageNote')||{}).value||'').trim()}];var out=[];document.querySelectorAll('.ofiLineUse:checked').forEach(function(ch){var key=ch.getAttribute('data-key'),q=document.querySelector('.ofiLineQty[data-key="'+String(key).replace(/"/g,'')+'"]'),qty=num(q&&q.value);if(qty>0)out.push({mode:'line',lineKey:key,offerId:ch.getAttribute('data-offer'),lineId:ch.getAttribute('data-line'),qty:qty});});return out;}
  window.ptfOfficialInvoiceCalc=function(){var b=num((document.getElementById('ofiBase')||{}).value),p=num((document.getElementById('ofiVatPct')||{}).value),r=window.ptfVatCalc(b,p),el=document.getElementById('ofiCalc');if(el)el.innerHTML='<div class="sr" style="margin:8px 0"><div class="sc"><b>'+money(r.base)+'</b><span>مبلغ پایه</span></div><div class="sc"><b>'+money(r.vat)+'</b><span>ارزش افزوده (گرد نزدیک‌ترین ریال)</span></div><div class="sc"><b>'+money(r.total)+'</b><span>مبلغ نهایی</span></div></div>';return r;};
  window.ptfOfficialInvoiceOcr=function(file){if(!file||!file.key)return Promise.resolve();file.ocrStatus='running';window.ptfOfficialInvoiceFileState();return fetch('../api/attachment-read.php',{method:'POST',headers:(typeof ptfApiAuthHeaders==='function'?ptfApiAuthHeaders(true):{'Content-Type':'application/json'}),body:JSON.stringify({key:file.key,name:file.name,mode:'inline'})}).then(function(r){if(!r.ok)throw new Error('read');return r.blob();}).then(function(blob){file.readVerified=true;if(blob.size>6*1048576)throw new Error('large');return new Promise(function(resolve,reject){var fr=new FileReader();fr.onload=function(){resolve(String(fr.result||'').split(',')[1]||'');};fr.onerror=reject;fr.readAsDataURL(blob);}).then(function(b64){return fetch('../api/llm.php?action=invoice_ocr',{method:'POST',headers:(typeof ptfApiAuthHeaders==='function'?ptfApiAuthHeaders(true):{'Content-Type':'application/json'}),body:JSON.stringify({mime:blob.type||file.contentType,b64:b64})});});}).then(function(r){return r.json();}).then(function(d){if(!d.ok)throw new Error(d.error||'ocr');file.ocrStatus='done';file.ocrResult=d.data||{};var x=file.ocrResult,w=[],enteredNo=((document.getElementById('ofiNo')||{}).value||'').trim(),enteredTax=((document.getElementById('ofiTax')||{}).value||'').trim(),calc=window.ptfOfficialInvoiceCalc();if(x.invoiceNo&&enteredNo&&String(x.invoiceNo)!==enteredNo)w.push('شماره سند '+x.invoiceNo+' با ورودی '+enteredNo+' متفاوت است');if(x.taxUid&&enteredTax&&String(x.taxUid)!==enteredTax)w.push('شناسه مودیان سند با ورودی متفاوت است');if(+x.baseAmountIRR>0&&calc.base>0&&Math.abs(+x.baseAmountIRR-calc.base)>1)w.push('مبلغ پایه سند '+money(x.baseAmountIRR)+' با ورودی '+money(calc.base)+' متفاوت است');if(+x.totalAmountIRR>0&&calc.total>0&&Math.abs(+x.totalAmountIRR-calc.total)>1)w.push('مبلغ نهایی سند '+money(x.totalAmountIRR)+' با محاسبه '+money(calc.total)+' متفاوت است');file.ocrWarnings=w;window.ptfOfficialInvoiceFileState();}).catch(function(e){if(file.readVerified!==true)file.readVerified=false;file.ocrStatus='unavailable';file.ocrError=String(e&&e.message||e);window.ptfOfficialInvoiceFileState();});};
  window.ptfOfficialInvoiceFileState=function(){var el=document.getElementById('ofiFileState');if(!el)return;var candidates=draftFiles.filter(function(f){return f&&f.key&&['accounting_official_invoice','modian_tax_invoice'].indexOf(f.category)>-1&&['replaced','deleted','rejected'].indexOf(String(f.status||'active'))<0;}),fs=activeRequiredFiles(draftFiles),ok=fs.length>0,w=[];fs.forEach(function(f){(f.ocrWarnings||[]).forEach(function(x){w.push(x);});});var state=candidates.some(function(f){return f.ocrStatus==='running';})?' <span style="color:#0e7490">— OCR در حال تطبیق…</span>':candidates.some(function(f){return f.ocrStatus==='unavailable';})?' <span style="color:#64748b">— OCR در دسترس نبود؛ تأیید انسانی الزامی است</span>':'';el.innerHTML=(ok?'<span style="color:#047857">✅ مدرک اجباری پیوست شده است ('+fs.length+' فایل)</span>':'<span style="color:#b91c1c">⛔ هنوز هیچ‌یک از دو مدرک اجباری پیوست نشده است.</span>')+state+(w.length?'<div style="margin-top:5px;background:#fef2f2;color:#991b1b;padding:6px;border-radius:7px">⚠️ مغایرت OCR — پیش از ثبت بررسی و تأیید کنید:<br>'+w.map(esc).join('<br>')+'</div>':'');};
  window.ptfOfficialInvoiceCancel=function(){var fresh=draftFiles.filter(function(f){return f&&f._justUploaded&&f.key;});fresh.forEach(function(f){fetch('../api/storage.php?action=delete_financial',{method:'POST',headers:(typeof ptfApiAuthHeaders==='function'?ptfApiAuthHeaders(true):{'Content-Type':'application/json'}),body:JSON.stringify({key:f.key})}).catch(function(){});});draftFiles=draftFiles.filter(function(f){return !f._justUploaded;});document.querySelectorAll('#ptfOfficialInvDlg').forEach(function(x){x.remove();});};
  window.saveInv=function(offerNo){var x=window._ptfOfficialInvCtx||{},inv=x.existing,r=window.ptfOfficialInvoiceCalc(),no=((document.getElementById('ofiNo')||{}).value||'').trim(),tax=((document.getElementById('ofiTax')||{}).value||'').trim(),date=((document.getElementById('ofiDate')||{}).value||'').trim(),pct=num((document.getElementById('ofiVatPct')||{}).value),reason=((document.getElementById('ofiReason')||{}).value||'').trim();if(!no||!tax||!date||r.base<=0){alert('شماره، شناسه مودیان، تاریخ و مبلغ پایه الزامی است');return;}if(pct<0||pct>100){alert('درصد ارزش افزوده نامعتبر است');return;}if(!activeRequiredFiles(draftFiles).length){alert('⛔ افزودن تصویر/PDF فاکتور رسمی حسابداری یا سند سامانه مودیان اجباری است.');return;}if(inv&&!reason){alert('دلیل اصلاح الزامی است');return;}var coverage=collectCoverage(),coverageMode=(document.getElementById('ofiCoverage')||{}).value||'amount';if(coverageMode==='amount'&&!(coverage[0]||{}).note){alert('شرح/دلیل صورت‌وضعیت مبلغی الزامی است');return;}if(coverageMode==='lines'&&!coverage.length){alert('حداقل یک قلم و مقدار برای فاکتور انتخاب کنید');return;}var filesPayload=draftFiles.map(function(f){var x=Object.assign({},f);delete x._justUploaded;return x;}),ocrWarnings=[];draftFiles.forEach(function(f){(f.ocrWarnings||[]).forEach(function(w){ocrWarnings.push(w);});var x=f.ocrResult||{};if(x.invoiceNo&&String(x.invoiceNo)!==no)ocrWarnings.push('شماره سند '+x.invoiceNo+' با ورودی '+no+' متفاوت است');if(x.taxUid&&String(x.taxUid)!==tax)ocrWarnings.push('شناسه مودیان سند با ورودی متفاوت است');if(+x.baseAmountIRR>0&&Math.abs(+x.baseAmountIRR-r.base)>1)ocrWarnings.push('مبلغ پایه سند '+money(x.baseAmountIRR)+' با ورودی '+money(r.base)+' متفاوت است');if(+x.totalAmountIRR>0&&Math.abs(+x.totalAmountIRR-r.total)>1)ocrWarnings.push('مبلغ نهایی سند '+money(x.totalAmountIRR)+' با محاسبه '+money(r.total)+' متفاوت است');});ocrWarnings=ocrWarnings.filter(function(w,i,a){return a.indexOf(w)===i;});var ocrOverrideReason='';if(ocrWarnings.length){ocrOverrideReason=prompt('OCR مغایرت تشخیص داده است. پس از مشاهده سند، دلیل تأیید اطلاعات واردشده را ثبت کنید:\n\n'+ocrWarnings.join('\n'),'سند مشاهده و اطلاعات با مسئولیت کاربر تأیید شد')||'';if(!ocrOverrideReason.trim())return;}var btn=document.getElementById('ofiSave');if(btn){btn.disabled=true;btn.textContent='در حال تأیید سرور…';}command(inv?'correct_invoice':'register_invoice',{caseId:x.caseId,invoiceId:inv?iid(inv):'',offerNo:offerNo,rialBasisNo:x.rialBasisNo||'',rialBasisRate:x.rialBasisRate||0,rialBasisTotal:x.rialBasisTotal||0,replacesUnofficialInvoiceId:((document.getElementById('ofiReplaces')||{}).value||''),invoiceNo:no,taxUid:tax,modianReference:((document.getElementById('ofiModian')||{}).value||'').trim(),issueDate:date,baseAmountIRR:r.base,vatPercent:pct,coverageMode:coverageMode,coverage:coverage,files:filesPayload,ocrOverrideReason:ocrOverrideReason,reason:reason,idempotencyKey:x.operationId},{onAck:function(d){toast(inv?'اطلاعات فاکتور اصلاح و مطالبات بازسازی شد':'فاکتور رسمی و مطالبات باز ثبت شد','ok');document.querySelectorAll('#ptfOfficialInvDlg').forEach(function(y){y.remove();});window.renderInvoices();if(typeof renderReceivables==='function')renderReceivables();},onReject:function(e){var m={duplicate_invoice_identity:'شماره فاکتور یا شناسه مودیان تکراری است',required_official_attachment_missing:'مدرک اجباری معتبر نیست',fiscal_period_locked:'دوره مالی قفل است و ابتدا باید بازگشایی شود',unofficial_payments_require_review:'صورتحساب غیررسمی وصول واقعیِ مهاجرت‌نشده دارد؛ ابتدا از کیفیت داده تعیین تکلیف کنید'};alert('⛔ '+(m[e.message]||e.message));if(btn){btn.disabled=false;btn.textContent=inv?'ثبت اصلاحیه':'ثبت فاکتور رسمی';}},onUncertain:function(e){alert('⚠️ نتیجه ثبت فاکتور هنوز نامشخص است؛ فرم و فایل‌ها حفظ شدند. شناسه پیگیری: '+e.operationId);if(btn){btn.disabled=false;btn.textContent='بررسی نتیجه / تلاش مجدد';}}});};

  window.ptfInvoiceVoid=function(id){var i=findInvoice(id);if(!i){alert('⛔ فاکتور رسمی با شناسهٔ «'+String(id==null?'':id)+'» یافت نشد.');return;}if(!active(i)){alert('⛔ این فاکتور دیگر فعال نیست (وضعیت: '+String(i.status||i.st||(i.voided?'voided':'-'))+') و دوباره ابطال نمی‌شود.');return;}if(!can()){alert('نقش فعلی مجاز نیست');return;}var reason=prompt('دلیل ابطال قانونی فاکتور '+(i.no||'')+':','ابطال در نرم‌افزار حسابداری/سامانه مودیان');if(reason===null||!reason.trim())return;if(!confirm('مطالبات فاکتور حذف و همه تخصیص‌ها به بستانکاری همان پرونده برگردند؟\nورودی خزانه حذف نخواهد شد.'))return;command('void_invoice',{invoiceId:iid(i),reason:reason.trim(),idempotencyKey:'VOID-INVOICE|'+iid(i)+'|'+reason.trim().slice(0,40)},{onAck:function(){toast('فاکتور ابطال؛ مطالبات حذف و بستانکاری آزاد شد','ok');window.renderInvoices();if(typeof renderReceivables==='function')renderReceivables();if(typeof ptfTreasuryRender==='function')ptfTreasuryRender();},onReject:function(e){alert('⛔ '+(e.message==='fiscal_period_locked'?'دوره مالی قفل است و باید صریحاً بازگشایی شود':e.message));}});};
  window.ptfOfficialInvoiceFilesUi=function(id){var i=findInvoice(id);if(!i){alert('⛔ فاکتور رسمی با شناسهٔ «'+String(id==null?'':id)+'» یافت نشد.');return;}document.querySelectorAll('#ofiFilesDlg').forEach(function(x){x.remove();});var html='<div class="md-b" id="ofiFilesDlg" style="display:grid;z-index:3200" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:680px"><h3>📎 اسناد فاکتور رسمی '+esc(i.no||'')+'</h3><div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:9px;padding:8px;font-size:12px">پس از ثبت قطعی حذف مستقل وجود ندارد؛ فقط فایل صحیح جدید جایگزین و نسخه قبلی در تاریخچه نگهداری می‌شود.</div>'+filesHtml(i,false)+'<div style="text-align:left;margin-top:10px">'+(can()&&active(i)?'<button class="bt" style="font-size:12px" onclick="this.closest(\'.md-b\').remove();ptfOfficialAttachmentAdd(\''+arg(iid(i))+'\')">➕ افزودن سند جدید (فاکتور/مودیان)</button> ':'')+'<button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';document.getElementById('panels').insertAdjacentHTML('beforeend',html);};
  window.ptfOfficialAttachmentAdd=function(invId){
    var i=findInvoice(invId);if(!i){alert('⛔ فاکتور رسمی یافت نشد.');return;}
    if(!can()){alert('⛔ نقش فعلی مجاز به افزودن سند فاکتور رسمی نیست');return;}
    if(!active(i)){alert('فاکتور ابطال‌شده قابل تغییر نیست');return;}
    document.querySelectorAll('#ofiAddDlg').forEach(function(x){x.remove();});
    var html='<div class="md-b" id="ofiAddDlg" style="display:grid;z-index:3300" onclick="if(event.target===this)this.remove()">'+
      '<div class="md" style="max-width:520px"><h3>➕ افزودن سند — فاکتور رسمی '+esc(i.no||'')+'</h3>'+
      '<div style="font-size:12px;color:#64748b">پس از ثبت، سند فاکتور حسابداری یا سند/تصویر سامانه مودیان را اینجا اضافه کنید؛ نسخه‌های قبلی حفظ می‌شوند.</div>'+
      '<div class="fld" style="margin-top:8px"><label>نوع سند</label><select id="ofiAddCat">'+
      '<option value="accounting_official_invoice">فاکتور رسمی سیستم حسابداری</option>'+
      '<option value="modian_tax_invoice">سند/تصویر سامانه مودیان</option></select></div>'+
      '<div class="fld"><label>فایل (PDF/عکس)</label><div id="ofiAddUp" style="border:1px dashed var(--brd);border-radius:9px;padding:8px"></div></div>'+
      '<div class="fld"><label>یادداشت (اختیاری — در سابقه ثبت می‌شود)</label><textarea id="ofiAddReason" rows="2"></textarea></div>'+
      '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">انصراف</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend',html);
    if(typeof attachUploadWidget==='function')attachUploadWidget('ofiAddUp','official-invoices/attachments',function(f){
      f.category=(document.getElementById('ofiAddCat')||{}).value||'accounting_official_invoice';
      f._justUploaded=true;
      window.ptfOfficialInvoiceOcr(f).then(function(){
        if(!f.readVerified){throw new Error('فایل قابل مشاهده/تأیید نیست');}
        var w=f.ocrWarnings||[];
        if(w.length&&!confirm('OCR مغایرت گزارش کرد:\n'+w.join('\n')+'\n\nپس از مشاهده، افزودن تأیید می‌شود؟'))throw new Error('تأیید انسانی انجام نشد');
        var clean=Object.assign({},f);delete clean._justUploaded;
        var reason=((document.getElementById('ofiAddReason')||{}).value||'').trim();
        return command('invoice_attachment_add',{invoiceId:invId,category:f.category,reason:reason,file:clean},{
          onAck:function(){toast('سند جدید به فاکتور افزوده شد','ok');document.querySelectorAll('#ofiAddDlg,#ofiFilesDlg').forEach(function(x){x.remove();});window.renderInvoices();window.ptfOfficialInvoiceFilesUi(invId);},
          onReject:function(e){fetch('../api/storage.php?action=delete_financial',{method:'POST',headers:(typeof ptfApiAuthHeaders==='function'?ptfApiAuthHeaders(true):{'Content-Type':'application/json'}),body:JSON.stringify({key:f.key})}).catch(function(){});alert('⛔ افزودن سند رد شد؛ فایل موقت پاک شد: '+e.message);},
          onUncertain:function(e){alert('⚠️ نتیجه افزودن سند نامشخص است؛ فایل برای بازیابی پاک نشد. شناسه پیگیری: '+e.operationId);}
        });
      }).catch(function(e){
        fetch('../api/storage.php?action=delete_financial',{method:'POST',headers:(typeof ptfApiAuthHeaders==='function'?ptfApiAuthHeaders(true):{'Content-Type':'application/json'}),body:JSON.stringify({key:f.key})}).catch(function(){});
        if(String(e.message||'').indexOf('تأیید')<0)alert('⛔ اعتبارسنجی سند انجام نشد و فایل موقت پاک شد: '+e.message);
      });
    });
  };
  window.ptfOfficialAttachmentReplace=function(invId,attId,category){var i=findInvoice(invId);if(!i){alert('⛔ فاکتور رسمی یافت نشد.');return;}if(!can()){alert('⛔ نقش فعلی مجاز به جایگزینی سند فاکتور رسمی نیست');return;}var reason=prompt('دلیل اصلاح/جایگزینی فایل:','فایل اشتباه پیوست شده بود');if(reason===null||!reason.trim())return;document.querySelectorAll('#ofiReplaceDlg').forEach(function(x){x.remove();});var html='<div class="md-b" id="ofiReplaceDlg" style="display:grid;z-index:3400" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:500px"><h3>جایگزینی امن مدرک</h3><div style="font-size:12px;color:#64748b">ابتدا فایل جدید کامل آپلود می‌شود؛ فقط پس از تأیید سرور نسخه قبلی غیرفعال خواهد شد.</div><div id="ofiReplaceUp" style="margin-top:8px;border:1px dashed var(--brd);padding:8px;border-radius:9px"></div><button class="bt bt-o" style="margin-top:8px" onclick="this.closest(\'.md-b\').remove()">انصراف</button></div></div>';document.getElementById('panels').insertAdjacentHTML('beforeend',html);if(typeof attachUploadWidget==='function')attachUploadWidget('ofiReplaceUp','official-invoices/replacements',function(f){f.category=category;f._justUploaded=true;window.ptfOfficialInvoiceOcr(f).then(function(){if(!f.readVerified){throw new Error('فایل جدید قابل مشاهده/تأیید نیست');}var ox=f.ocrResult||{},rw=f.ocrWarnings||[];if(ox.invoiceNo&&String(ox.invoiceNo)!==String(i.no||''))rw.push('شماره فایل با فاکتور متفاوت است');if(ox.taxUid&&String(ox.taxUid)!==String(i.taxUid||''))rw.push('شناسه مودیان فایل با فاکتور متفاوت است');if(+ox.baseAmountIRR>0&&Math.abs(+ox.baseAmountIRR-(+i.base||0))>1)rw.push('مبلغ پایه فایل با فاکتور متفاوت است');if(+ox.totalAmountIRR>0&&Math.abs(+ox.totalAmountIRR-(+i.amount||0))>1)rw.push('مبلغ نهایی فایل با فاکتور متفاوت است');f.ocrWarnings=rw;if((f.ocrWarnings||[]).length&&!confirm('OCR مغایرت زیر را گزارش کرد:\n'+f.ocrWarnings.join('\n')+'\n\nپس از مشاهده فایل، جایگزینی تأیید می‌شود؟'))throw new Error('تأیید انسانی انجام نشد');var clean=Object.assign({},f);delete clean._justUploaded;return command('replace_invoice_attachment',{invoiceId:invId,attachmentId:attId,reason:reason.trim(),file:clean},{onAck:function(){toast('نسخه صحیح فعال و نسخه قبلی در تاریخچه نگهداری شد','ok');document.querySelectorAll('#ofiReplaceDlg,#ofiFilesDlg').forEach(function(x){x.remove();});window.renderInvoices();window.ptfOfficialInvoiceFilesUi(invId);},onReject:function(e){fetch('../api/storage.php?action=delete_financial',{method:'POST',headers:(typeof ptfApiAuthHeaders==='function'?ptfApiAuthHeaders(true):{'Content-Type':'application/json'}),body:JSON.stringify({key:f.key})}).catch(function(){});alert('⛔ جایگزینی رد شد؛ فایل قبلی فعال ماند و فایل موقت پاک شد: '+e.message);},onUncertain:function(e){alert('⚠️ نتیجه جایگزینی سند نامشخص است؛ فایل جدید برای بازیابی پاک نشد. شناسه پیگیری: '+e.operationId);}});}).catch(function(e){fetch('../api/storage.php?action=delete_financial',{method:'POST',headers:(typeof ptfApiAuthHeaders==='function'?ptfApiAuthHeaders(true):{'Content-Type':'application/json'}),body:JSON.stringify({key:f.key})}).catch(function(){});alert('⛔ اعتبارسنجی فایل جدید انجام نشد و فایل موقت پاک شد: '+e.message);});});};
})();
