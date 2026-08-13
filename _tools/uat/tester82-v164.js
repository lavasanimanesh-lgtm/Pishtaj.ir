/* tester82 — v16.4 (اسپرینت «و»: US-361 تور آکاردئونی + US-375 تور نوار پایین + US-372 dialogx + US-369 کانبان درخواست/پیشنهاد) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var tr = fs.readFileSync(path.join(BASE, 'tour.js'), 'utf-8');
var dx = fs.readFileSync(path.join(BASE, 'dialogx.js'), 'utf-8');
var kb = fs.readFileSync(path.join(BASE, 'kanban.js'), 'utf-8');
var br = fs.readFileSync(path.join(BASE, 'bridge.js'), 'utf-8');
var sh = fs.readFileSync(path.join(BASE, 'shell.js'), 'utf-8');
var of = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8');
var dd = fs.readFileSync(path.join(BASE, 'dedup.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('نسخه و ثبت فایل‌ها');
/* قاعده تسترها: چک نسخه الگوی عمومی + cache-bust «>= نسخه» نه exact */
T('نسخه v16.4+ در index.html', (function(){var m=idx.match(/window.PTF_CRM_RELEASE = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=16.4;})());
T('کش sw >= ptf-crm-v16.4', (function(){var m=sw.match(/var RELEASE = 'v([0-9.]+)';/);return m&&parseFloat(m[1])>=16.4;})());
T('dialogx.js و kanban.js در SHELL کش', sw.indexOf("'./dialogx.js'") > -1 && sw.indexOf("'./kanban.js'") > -1);
T('اسکریپت‌های جدید در index.html', /dialogx\.js\?v=[0-9.]+/.test(idx) && /kanban\.js\?v=[0-9.]+/.test(idx));
T('dialogx قبل از dedup لود می‌شود (ptfDlgAlert در دسترس ضدتکرار)', idx.indexOf('dialogx.js?v=') < idx.indexOf('dedup.js?v='));
(function () {
  function vOf(f) { var m = idx.match(new RegExp(f.replace('.', '\\.') + '\\?v=([0-9.]+)')); return m ? parseFloat(m[1]) : 0; }
  T('cache-bust فایل‌های تغییریافته >= 16.4', ['tour.js', 'bridge.js', 'shell.js', 'offers.js', 'dedup.js'].every(function (f) { return vOf(f) >= 16.4; }));
})();

SECTION('US-361 (کد): تور هماهنگ با آکاردئون');
T('shell.js منبع واحد گروه‌ها را export می‌کند', sh.indexOf('window.PTF_NAV_GROUPS = GROUPS') > -1);
T('تور از PTF_NAV_GROUPS گام می‌سازد (گروه‌به‌گروه AC3)', tr.indexOf('window.PTF_NAV_GROUPS ||') > -1 && tr.indexOf('navGroups().forEach') > -1);
T('AC1/AC4: فقط یک گروه باز — openOnlyGroup', tr.indexOf('function openOnlyGroup(gid)') > -1 && tr.indexOf("classList.remove('open')") > -1 && tr.indexOf("classList.add('open')") > -1);
T('AC2: اسپات‌لایت هم‌اندازه آیتم (pad حداقلی 3)', tr.indexOf('spotlight(r, 3)') > -1);
T('AC5: پایان/رد تور = همه گروه‌ها بسته + ptf_nav_open دست نمی‌خورد', tr.indexOf("openOnlyGroup('')") > -1 && tr.indexOf("localStorage.setItem('ptf_nav_open'") === -1);
T('AC6: RBAC با display:none (نه offsetParent که آیتم گروه بسته را حذف می‌کرد)', tr.indexOf("b.style.display === 'none'") > -1 && tr.indexOf('offsetParent !== null') === -1);
T('صبر برای انیمیشن آکاردئون قبل از اندازه‌گیری', tr.indexOf('}, 330);') > -1);

SECTION('US-361 (رفتاری): ترتیب گام‌ها و باز/بسته شدن گروه‌ها');
(function () {
  /* شبیه‌سازی DOM سبک: دکمه‌های سایدبار + گروه‌ها */
  var GROUPS = [
    { id: 'g-dash', lb: '📊 داشبورد', items: ['dash', 'cart', 'ai'], single: true },
    { id: 'g-sales', lb: '💼 فروش', items: ['leads', 'cust', 'rfq', 'off', 'deals'] },
    { id: 'g-supply', lb: '🛒 تامین', items: ['sup', 'rfqs'] }
  ];
  global.PTF_NAV_GROUPS = GROUPS;
  var btns = {};
  ['dash', 'cart', 'ai', 'leads', 'cust', 'rfq', 'off', 'deals', 'sup', 'rfqs'].forEach(function (id) {
    btns[id] = { style: { display: id === 'deals' ? 'none' : '' } }; /* deals = RBAC مخفی */
  });
  global.document = {
    querySelector: function (sel) {
      var m = sel.match(/\.sb-i\[onclick\*="'([a-z]+)'"\]/);
      if (m) return btns[m[1]] || null;
      return null;
    },
    querySelectorAll: function () { return []; },
    getElementById: function () { return null; },
    createElement: function () { return { style: {}, setAttribute: function(){}, appendChild: function(){} }; },
    head: { appendChild: function(){} }, body: { appendChild: function(){} }, addEventListener: function(){}
  };
  /* استخراج visSteps + navGroups + btnOf از tour.js */
  var mNG = tr.match(/function navGroups\(\) \{[\s\S]*?\n  \}/);
  var mBO = tr.match(/function btnOf\(id\) \{[\s\S]*?\n  \}/);
  var mVS = tr.match(/function visSteps\(\) \{[\s\S]*?\n    return out;\n  \}/);
  var mDESC = tr.match(/var DESC = \{[\s\S]*?\n  \};/);
  T('توابع تور قابل استخراج', !!mNG && !!mBO && !!mVS && !!mDESC);
  if (mNG && mBO && mVS && mDESC) {
    eval.call(global, mDESC[0].replace('var DESC', 'global.DESC'));
    eval.call(global, mNG[0].replace('function navGroups', 'global.navGroups = function'));
    eval.call(global, mBO[0].replace('function btnOf', 'global.btnOf = function'));
    eval.call(global, mVS[0].replace('function visSteps', 'global.visSteps = function'));
    global.window = global;
    var steps = visSteps();
    T('ترتیب گروه‌به‌گروه: dash/cart/ai اول، سپس فروش، سپس تامین',
      steps.map(function (s) { return s.id; }).join(',') === 'dash,cart,ai,leads,cust,rfq,off,sup,rfqs');
    T('RBAC: ماژول مخفی (deals) در تور نیست', !steps.some(function (s) { return s.id === 'deals'; }));
    T('گام‌های single بدون گروه (gid خالی)', steps.filter(function (s) { return ['dash','cart','ai'].indexOf(s.id) > -1; }).every(function (s) { return s.gid === ''; }));
    T('گام‌های گروهی gid درست دارند', steps.filter(function (s) { return s.id === 'rfq'; })[0].gid === 'g-sales' && steps.filter(function (s) { return s.id === 'sup'; })[0].gid === 'g-supply');
  }
})();

SECTION('US-375: تور نوار پایین موبایل');
T('۵ گام: dash/cart/off(FAB)/ai/سایر', tr.indexOf("{ tab: 'dash'") > -1 && tr.indexOf("{ tab: 'cart'") > -1 && tr.indexOf("{ tab: 'off'") > -1 && tr.indexOf("{ tab: 'ai'") > -1 && tr.indexOf("{ tab: '_more'") > -1);
T('AC2: کلید یک‌باره per-user جدا (ptf_tour_mnv_done_)', tr.indexOf("'ptf_tour_mnv_done_' + s.user") > -1 && tr.indexOf("'ptf_tour_mnv_done_' + curSession().user") > -1);
T('AC4: گام سایر = باز شدن کشو (ptfMnvMore(true))', tr.indexOf('window.ptfMnvMore(true)') > -1);
T('AC5: در موبایل تور دسکتاپ اجرا نشود و بالعکس', tr.indexOf('if (isMob()) { if (typeof window.ptfTourMnvStart') > -1 && tr.indexOf('if (isMob()) {\n          if (localStorage.getItem') > -1);
T('AC3: کادر بالای نوار (top = r.top - boxH)', tr.indexOf('r.top - boxH - 14') > -1);
T('پایان تور موبایل: کشو بسته می‌شود', tr.indexOf("window.ptfMnvMore(false); /* کشو بسته شود */") > -1);
T('اجرای دستی از تنظیمات (هر دو تور)', tr.indexOf('ptfTourMnvStart()">📱') > -1);

SECTION('US-372 (کد): dialogx هم‌تم');
T('سه متد Promise-محور', dx.indexOf('alert: function (msg, opts)') > -1 && dx.indexOf('confirm: function (msg, opts)') > -1 && dx.indexOf('prompt: function (msg, def, opts)') > -1);
T('AC4: ESC + کلیک بیرون = انصراف امن', dx.indexOf("ev.key === 'Escape'") > -1 && dx.indexOf('if (ev.target === b) done(cancelVal())') > -1);
T('AC4: focus trap با Tab', dx.indexOf("ev.key === 'Tab'") > -1 && dx.indexOf('f[(i + (ev.shiftKey ? -1 : 1) + f.length) % f.length].focus()') > -1);
T('AC1: تم RTL + متغیرهای تم + متن چندخطی', dx.indexOf('direction:rtl') > -1 && dx.indexOf('var(--crd,#fff)') > -1 && dx.indexOf('white-space:pre-line') > -1);
T('AC5: موبایل دکمه تمام‌عرض', dx.indexOf('@media(max-width:600px)') > -1 && dx.indexOf('width:100%') > -1);
T('helper مهاجرت تدریجی با fallback بومی', dx.indexOf('window.ptfDlgAlert = function') > -1 && dx.indexOf('alert(msg);') > -1);
T('AC2: ضدتکرار dedup مهاجرت کرد (با fallback)', dd.indexOf("ptfDlgAlert(dedupMsg(c), { icon: '♻️'") > -1 && dd.indexOf('else alert(dedupMsg(c))') > -1);
T('AC2: اعتبارسنجی فرم‌های اصلی مهاجرت کرد', idx.indexOf("(window.ptfDlgAlert || alert)('نام شرکت را وارد کنید'") > -1 && of.indexOf("(window.ptfDlgAlert || alert)('نام شرکت را وارد کنید'") > -1);
T('AC3: confirm حذف پیشنهاد → dialogx.confirm danger + fallback', of.indexOf("dialogx.confirm('پیشنهاد ' + no + ' حذف شود؟', { icon: '🗑'") > -1 && of.indexOf('function ptfOfferDelDo(no)') > -1 && of.indexOf("if (!confirm('پیشنهاد ' + no + ' حذف شود؟')) return;") > -1);

SECTION('US-372 (رفتاری): fallback بدون شکستن جریان');
(function () {
  delete global.dialogx;
  global._alerts = [];
  global.alert = function (m) { global._alerts.push(String(m)); };
  var m = dx.match(/window\.ptfDlgAlert = function[\s\S]*?\n  \};/);
  T('ptfDlgAlert استخراج شد', !!m);
  if (m) {
    global.Promise = Promise;
    eval(m[0].replace('window.ptfDlgAlert', 'global.ptfDlgAlert'));
    ptfDlgAlert('پیام تست');
    T('بدون dialogx → alert بومی (جریان نمی‌شکند)', global._alerts.length === 1 && global._alerts[0] === 'پیام تست');
  }
})();

SECTION('US-369 (کد): کانبان درخواست‌ها/پیشنهادها — نمای دوم بدون منطق جدید');
T('bridge: هسته مشترک ptfRfqSetStatus (مودال+کانبان)', br.indexOf('window.ptfRfqSetStatus = function (cd, stVal, stText)') > -1);
T('bridge: saveRfqStatus فقط wrapper نازک DOM', br.indexOf('ptfRfqSetStatus(cd, sel.value, sel.options[sel.selectedIndex].text);') > -1);
T('bridge: اثرات جانبی در هسته حفظ شد (waiting/notify/سینک سایت)', br.indexOf("if (stVal === 'stTO') r.waiting = 'TO';") > -1 && (function () { var i = br.indexOf('window.ptfRfqSetStatus'); var seg = br.slice(i, i + 2200); return seg.indexOf("kind: 'offer_wait'") > -1 && seg.indexOf("api('set_status'") > -1; })());
T('bridge: منبع واحد ستون‌ها PTF_RFQ_STATUSES + بج منتظر صدور export شد', br.indexOf('window.PTF_RFQ_STATUSES = RFQ_STATUSES') > -1 && br.indexOf('window.ptfRfqWaitBadge = rfqWaitBadge') > -1);
T('کانبان درخواست: درگ → همان هسته (نه منطق موازی)', kb.indexOf('ptfRfqSetStatus(id, st, lb)') > -1);
T('کانبان پیشنهاد: درگ → همان offerSetSt با تمام گاردها', kb.indexOf('offerSetSt(id, st, null)') > -1);
T('AC3: بج‌های موجود روی کارت (مهلت 348/ضمایم 388/منتظر/اعتبار)', kb.indexOf('ptfRfqDueState') > -1 && kb.indexOf('r.files || {}') > -1 && kb.indexOf('ptfRfqWaitBadge') > -1 && kb.indexOf('offerValidState') > -1);
T('AC4: نمای per-user در ptf_crm_settings.kanbanView (الگوی dashOrder)', kb.indexOf('st.kanbanView[myUser()][mod] = v') > -1);
T('AC5: درگ لمسی با نگه‌داشتن 300ms (الگوی لانچر) + اسکرول افقی', kb.indexOf('}, 300);') > -1 && kb.indexOf('overflow-x:auto') > -1 && kb.indexOf("e.pointerType === 'touch'") > -1);
T('CO برنده: کارت قفل — درگ ممنوع', kb.indexOf("data-lock=\"1\"") > -1 && kb.indexOf('وضعیت برنده قفل است') > -1);
T('ستون‌های TO شش‌گانه US-367 + مهاجرت نرم won→approved', kb.indexOf("{ v: 'registered', t: '📋 ثبت‌شده' }") > -1 && kb.indexOf("if (o.st === 'won') return 'approved';") > -1);
T('کلیک ساده روی کارت = باز کردن (editRfq/offerEdit موجود)', kb.indexOf('editRfq(id)') > -1 && kb.indexOf('offerEdit(id)') > -1);
T('گارد پنل: بدون rTb/oTb هیچ تزریقی', kb.indexOf("if (!document.getElementById('rTb')) return;") > -1 && kb.indexOf("if (!document.getElementById('oTb')) return;") > -1);
T('AC6: به کانبان/فیلتر مشتریان دست نخورده (فقط rfq/off)', kb.indexOf('ptf_crm_customers') === -1 && kb.indexOf("'cust'") === -1);

SECTION('US-369 (رفتاری): درگ کانبان = رفت‌وبرگشت با جدول (شرط کارفرما)');
(function () {
  /* هسته bridge را ایزوله اجرا می‌کنیم: ptfRfqSetStatus */
  var m = br.match(/window\.ptfRfqSetStatus = function \(cd, stVal, stText\) \{[\s\S]*?\n    return true;\n  \};/);
  T('هسته ptfRfqSetStatus استخراج شد', !!m);
  if (!m) return;
  global.window = global;
  global._notifies = [];
  global.notify = function (n) { global._notifies.push(n); return 'N1'; };
  global.pushEvent = function () {};
  global.updateInboxBadge = function () {};
  global.addLog = function () {};
  global.audit = function () {};
  global.SALES_ROLES = ['sales'];
  global.api = function (a, d) { global._lastApi = { a: a, d: d }; };
  global.curSession = function () { return { user: 'u1', name: 'کاربر' }; };
  eval(m[0].replace('window.ptfRfqSetStatus', 'global.ptfRfqSetStatus'));
  setData('ptf_crm_rfqs', [{ cd: 'RFQ-1', co: 'فولاد مبارکه', st: 'st1', stxt: '🔴 دریافت اولیه' }, { cd: 'RFQ-2', co: 'پتروشیمی', st: 'st2', stxt: '🔵 بررسی فنی', src: 'site' }]);
  /* سناریو ۱: درگ st1 → stTO */
  var ok = ptfRfqSetStatus('RFQ-1', 'stTO', '🔧 صدور پیشنهاد فنی (TO)');
  var r1 = getData('ptf_crm_rfqs')[0];
  T('درگ → وضعیت و متن ذخیره شد', ok === true && r1.st === 'stTO' && r1.stxt === '🔧 صدور پیشنهاد فنی (TO)');
  T('اثر جانبی waiting=TO + notify کارتابل مثل مودال', r1.waiting === 'TO' && global._notifies.length === 1 && global._notifies[0].kind === 'offer_wait');
  /* سناریو ۲: برگشت به st2 → waiting پاک شود */
  ptfRfqSetStatus('RFQ-1', 'st2', '🔵 بررسی فنی');
  r1 = getData('ptf_crm_rfqs')[0];
  T('رفت‌وبرگشت: waiting پاک شد و وضعیت برگشت', r1.st === 'st2' && r1.waiting === null);
  /* سناریو ۳: درخواست سایت → سینک سرور */
  global._lastApi = null;
  ptfRfqSetStatus('RFQ-2', 'st3', '🟡 تایید');
  T('درخواست سایت: set_status به سرور رفت', global._lastApi && global._lastApi.a === 'set_status' && global._lastApi.d.code === 'RFQ-2' && global._lastApi.d.status === 'st3');
  /* سناریو ۴: کد ناموجود → false بدون خطا */
  T('کد ناموجود → false (کانبان خطا نمی‌دهد)', ptfRfqSetStatus('RFQ-X', 'st1', 'x') === false);
})();

(function () {
  /* offerSetSt واقعی از offers.js: درگ TO → approved و گارد rejected با confirm */
  var m = of.match(/function offerSetSt\(no, st, selEl\) \{[\s\S]*?\n\}/);
  T('offerSetSt استخراج شد', !!m);
  if (!m) return;
  global._confirms = [];
  global.confirm = function (msg) { global._confirms.push(String(msg)); return global._confirmAns; };
  global.faDateTime = function () { return '1405/04/19 10:00'; };
  global.renderOffers = function () { global._rendered = true; };
  global.wfRefresh = undefined;
  global.autoCreateProjectFromCO = function (o) { global._autoPrj = o.no; };
  eval(m[0].replace('function offerSetSt', 'global.offerSetSt = function'));
  setData('ptf_crm_offers', [
    { no: 'TO-1', kind: 'TO', st: 'sent', inqNo: '' },
    { no: 'CO-1', kind: 'CO', st: 'sent', inqNo: 'RFQ-1', items: [] }
  ]);
  /* TO → approved (بدون confirm) */
  offerSetSt('TO-1', 'approved', null);
  T('درگ TO → تاییدشده + tst همگام workflow', getData('ptf_crm_offers')[0].st === 'approved' && getData('ptf_crm_offers')[0].tst === 'approved');
  /* TO → rejected با انصراف کاربر: وضعیت نباید عوض شود (selEl=null نباید خطا بدهد) */
  global._confirmAns = false;
  offerSetSt('TO-1', 'rejected', null);
  T('گارد عدم تایید TO: انصراف = بدون تغییر و بدون خطا (selEl=null)', getData('ptf_crm_offers')[0].st === 'approved' && global._confirms.length === 1);
  /* CO → won با تایید: قفل + autoCreateProject همان مسیر جدول */
  global._confirmAns = true;
  offerSetSt('CO-1', 'won', null);
  var co = getData('ptf_crm_offers')[1];
  T('درگ CO → برنده: قفل + هدایت پرونده/خرید واقعی (همان مسیر جدول)', co.st === 'won' && !!co.wonAt && global._autoPrj === 'CO-1');
})();

SECTION('رگرسیون: مسیرهای قبلی سالم');
T('مودال تغییر وضعیت درخواست همچنان کار می‌کند (wrapper)', br.indexOf('window.saveRfqStatus = function () {') > -1 && br.indexOf("document.getElementById('eCd').textContent") > -1);
T('حذف پیشنهاد: منطق حذف عینا در ptfOfferDelDo (برگشت st1 درخواست بی‌پیشنهاد)', of.indexOf("r.st = 'st1'; r.stxt = '🔴 دریافت اولیه';") > -1);
T('guards.js hook حذف پیشنهاد سالم (offerDel هنوز تعریف سراسری است)', of.indexOf('function offerDel(no)') > -1);
T('تور: RBAC گروه خالی مخفی مثل قبل (shell دست‌نخورده جز export)', sh.indexOf('if (!visible.length) return;') > -1);
T('sfLostModal/ptfReasonedDelete مودال اختصاصی — مهاجرت لازم نداشت (بدون تغییر)', fs.readFileSync(path.join(BASE, 'salesfiles.js'), 'utf-8').indexOf('sfLostModal') > -1);

DONE('tester82-v164');
