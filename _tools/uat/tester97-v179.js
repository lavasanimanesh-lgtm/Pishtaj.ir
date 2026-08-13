/* tester97 — v17.9 (US-419: سهامداران، حقوق موظف و علی‌الحساب) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var sh = fs.readFileSync(path.join(BASE, 'shareholders.js'), 'utf-8');
var sy = fs.readFileSync(path.join(BASE, 'sync.js'), 'utf-8');
var bk = fs.readFileSync(path.join(BASE, 'backup.js'), 'utf-8');
var gl = fs.readFileSync(path.join(BASE, 'golive.js'), 'utf-8');
var api = fs.readFileSync(path.resolve(__dirname, '../../api/crm.php'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('نسخه و ثبت');
T('نسخه v17.9+', (function(){var m=idx.match(/window.PTF_CRM_RELEASE = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=17.9;})());
T('window.VER هم v17.9+', (function(){var m=idx.match(/window\.PTF_CRM_RELEASE = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=17.9;})());
T('کش sw >= v17.9 + shareholders در SHELL', (function(){var m=sw.match(/var RELEASE = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=17.9;})() && sw.indexOf("'./shareholders.js'")>-1);
T('shareholders بعد از opex لود می‌شود', /opex\.js\?v=[0-9.]+/.test(idx) && idx.indexOf('shareholders.js?v=') > idx.indexOf('opex.js?v='));
T('کلیدهای سهامداران در sync + guard + backup + api', (function(){ var gm=(sy.match(/var GUARD_KEYS = \[[^\]]*\]/)||[''])[0]; return ['ptf_crm_shareholders','ptf_crm_sharetx'].every(function(k){ return sy.indexOf("'"+k+"'")>-1 && gm.indexOf(k)>-1 && bk.indexOf("'"+k+"'")>-1 && api.indexOf("'"+k+"'")>-1; }); })());
T('sharetx در Go-Live پاک می‌شود اما پروفایل سهامدار setup می‌ماند', gl.indexOf("'ptf_crm_sharetx'")>-1 && gl.indexOf("'ptf_crm_shareholders'")===-1);

SECTION('US-419 کد');
T('RBAC محرمانه فقط admin/chairman', sh.indexOf("['admin', 'chairman'].indexOf(curRole())")>-1);
T('پروفایل سهامدار: درصد/موظف/حقوق/فعال', sh.indexOf('درصد سهام')>-1 && sh.indexOf('سهامدار موظف')>-1 && sh.indexOf('حقوق ماهانه موظف')>-1);
T('اعتبارسنجی جمع سهام: جلوگیری از بیش از ۱۰۰٪', sh.indexOf('جمع سهام فعال از ۱۰۰٪ بیشتر')>-1 && sh.indexOf('pctSum(cd) + pct > 100')>-1);
T('حقوق موظف → sharetx salary + opex حقوق و دستمزد با shareTx', sh.indexOf("addTx('salary'")>-1 && sh.indexOf("cat: 'حقوق و دستمزد'")>-1 && sh.indexOf('shareTx: tx.cd')>-1 && sh.indexOf('shareholderSalary: true')>-1);
T('برداشت/علی‌الحساب → draw', sh.indexOf('window.ptfShareDraw')>-1 && sh.indexOf("addTx('draw'")>-1);
T('مانده کارت = credit + petty - debit', sh.indexOf('ledger.net = ledger.credit + petty - ledger.debit')>-1);
T('اتصال به مطالبات تنخواه با نام شخص', sh.indexOf('ptfPettyPendingByUser()[s.name]')>-1);
T('hook روی پنل تنخواه بعد از opex', sh.indexOf("return _bp() + '<div id=\"shareBox\"></div>'")>-1 && sh.indexOf('var _rp = window.renderPetty')>-1);

SECTION('رفتاری: سهام، حقوق، برداشت، مانده');
global.window = global;
global._role = 'chairman';
global.curRole = function(){ return global._role; };
global.curSession = function(){ return { user:'u1', name:'حامد' }; };
global.roleDef = function(){ return { finance:true }; };
global.audit = function(m,a,r){ global._audit={m:m,a:a,r:r}; };
global.ptfToast = function(m,k){ global._toast={m:m,k:k}; };
global.ptfOpexRender = function(){ global._opexRendered = true; };
global.buildPetty = function(){ return '<div>petty</div>'; };
global.renderPetty = function(){ global._rp = true; };
var shareEl = { innerHTML:'' };
global.document = { getElementById:function(id){ return id==='shareBox'?shareEl:null; }, querySelector:function(){ return { value:'1405/04' }; }, body:{ insertAdjacentHTML:function(pos,html){ global._modalHtml=html; } } };
global.alert = function(m){ global._alerts=(global._alerts||[]).concat([String(m)]); };
global.ptfDialog = function(o){ global._dlg=o; };
eval(sh);

setData('ptf_crm_shareholders', []); setData('ptf_crm_sharetx', []); setData('ptf_crm_opex', []); setData('ptf_crm_petty', []);
ptfShareEdit(); _dlg.onOk({name:'حامد', pct:60, duty:'yes', salary:50000000, active:'yes'});
ptfShareEdit(); _dlg.onOk({name:'شریک دوم', pct:40, duty:'no', salary:0, active:'yes'});
var shares = getData('ptf_crm_shareholders');
T('ثبت دو سهامدار با جمع ۱۰۰٪', shares.length===2 && shares.reduce(function(s,x){return s+x.pct;},0)===100);
T('رندر کارت سهامداران انجام شد', shareEl.innerHTML.indexOf('جمع سهام فعال: ۱۰۰٪')>-1);

global._alerts=[]; ptfShareEdit(); _dlg.onOk({name:'اضافی', pct:1, duty:'no', salary:0, active:'yes'});
T('جمع بیش از ۱۰۰٪ بلاک شد', getData('ptf_crm_shareholders').length===2 && global._alerts.some(function(a){return a.indexOf('جمع سهام فعال')>-1;}));

var hamed = shares.filter(function(x){return x.name==='حامد';})[0];
ptfShareApplySalary('1405/04');
T('حقوق موظف: sharetx salary ثبت شد', getData('ptf_crm_sharetx').some(function(x){return x.type==='salary' && x.shCd===hamed.cd && x.amt===50000000 && x.month==='1405/04';}));
T('حقوق موظف: opex با shareTx و فلگ جلوگیری از دوباره‌شماری', getData('ptf_crm_opex').some(function(o){return o.cat==='حقوق و دستمزد' && o.shareholderSalary===true && o.shareTx;}));
var txN = getData('ptf_crm_sharetx').length, opN = getData('ptf_crm_opex').length;
ptfShareApplySalary('1405/04');
T('ثبت دوباره همان ماه duplicate نمی‌سازد', getData('ptf_crm_sharetx').length===txN && getData('ptf_crm_opex').length===opN);

ptfShareDraw(hamed.cd); _dlg.onOk({amt:10000000, desc:'برداشت علی‌الحساب'});
T('برداشت draw ثبت شد', getData('ptf_crm_sharetx').some(function(x){return x.type==='draw' && x.amt===10000000;}));
setData('ptf_crm_petty', [{cd:'P1',by:'حامد',amt:2000000,st:'open'}]);
var bal = ptfShareholderBalance(hamed.cd);
T('مانده = حقوق ۵۰م + تنخواه ۲م − برداشت ۱۰م = ۴۲م', bal.net===42000000 && bal.petty===2000000);

ptfShareLedger(hamed.cd);
T('گردش سهامدار در مودال نمایش دارد', String(global._modalHtml||'').indexOf('گردش سهامدار')>-1 && String(global._modalHtml||'').indexOf('برداشت علی‌الحساب')>-1);

global._role='ceo'; global._alerts=[]; global._dlg=null; ptfShareEdit();
T('CEO به‌صورت پیش‌فرض به ماژول محرمانه سهامداران دسترسی ندارد', !global._dlg && global._alerts.some(function(a){return a.indexOf('فقط ادمین')>-1;}));

SECTION('رگرسیون');
T('petty/opex hook حفظ شده', idx.indexOf('petty.js?v=') < idx.indexOf('opex.js?v=') && idx.indexOf('opex.js?v=') < idx.indexOf('shareholders.js?v='));
T('ptf_crm_opex و petty keys هنوز در sync هستند', ['ptf_crm_opex','ptf_crm_petty_tx','ptf_crm_petty_periods'].every(function(k){return sy.indexOf(k)>-1;}));
T('پروفایل سهامدار در Go-Live پاک نمی‌شود', gl.indexOf('ptf_crm_shareholders')===-1);

DONE('tester97-v179');
