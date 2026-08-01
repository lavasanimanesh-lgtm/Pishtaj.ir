/* tester275 — v31.7.97 (BUG-FISCAL-PROFIT-ICON-UX-001)
 * Fiscal profit must include direct project costs and standalone petty expenses; requested icons are minimal/dark-safe.
 */
require('./harness');
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var fiscal = fs.readFileSync(path.join(ROOT, 'crm/fiscal.js'), 'utf-8');
var financehub = fs.readFileSync(path.join(ROOT, 'crm/financehub.js'), 'utf-8');
var wc = fs.readFileSync(path.join(ROOT, 'crm/working-capital.js'), 'utf-8');
var settingsAcc = fs.readFileSync(path.join(ROOT, 'crm/settings-accordion.js'), 'utf-8');
var theme = fs.readFileSync(path.join(ROOT, 'crm/theme-contrast.js'), 'utf-8');
var home = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8');
var kc = fs.readFileSync(path.join(ROOT, 'knowledge-center/index.html'), 'utf-8');
var idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(ROOT, 'crm/sw.js'), 'utf-8');

SECTION('Static fiscal profit completeness');
T('fiscal مستقیم project cost را خودش تضمین می‌کند', fiscal.indexOf('function fiscalDirectProjectCosts') > -1 && fiscal.indexOf('projectCostIrr') > -1 && fiscal.indexOf('هزینه‌های مستقیم پرونده در سود سال مالی کسر شد') > -1);
T('fiscal تنخواه مستقل را در سود خالص کم می‌کند', fiscal.indexOf('function fiscalPettyStandalone') > -1 && fiscal.indexOf('pettyStandaloneTotal') > -1 && fiscal.indexOf('var net = projectProfit - (+ox.total || 0) - (+pettyStandalone.total || 0) + amendTotal') > -1);
T('dashboard مالی کارت تنخواه مستقل و label سود پس از هزینه‌ها دارد', fiscal.indexOf('هزینه‌های تنخواه مستقل سال') > -1 && fiscal.indexOf('سود خالص مدیریتی پس از هزینه‌ها') > -1);
T('CSV/report مالی هزینه مستقیم و تنخواه را نشان می‌دهد', fiscal.indexOf('هزینه مستقیم') > -1 && fiscal.indexOf('تنخواه مستقل') > -1);

SECTION('Runtime fiscal profit completeness');
var store = {
  ptf_crm_projects: [],
  ptf_crm_deals: [{ cd:'DEAL-1', wonOffer:'CO-1', inqNo:'RFQ-1', buyerCo:'Buyer A', t:'1405/04/01', costEvents:[{ cd:'COST-1', amt:1000, t:'1405/04/02' }] }],
  ptf_crm_invoices: [],
  ptf_crm_petty: [{ cd:'PTY-1', amt:300, cat:'ایاب‌ذهاب و ماموریت', month:'1405/04', st:'settled', by:'User' }],
  ptf_crm_shareholders: [],
  ptf_crm_fiscal_snapshots: []
};
var sandbox = {
  console: console,
  window: null,
  getData: function (k) { return store[k] || []; },
  setData: function (k, v) { store[k] = v; },
  curRole: function () { return 'admin'; },
  curSession: function () { return { name:'Admin' }; },
  faDateTime: function () { return '1405/04/01 10:00'; },
  genCode: function (p) { return p + '-1'; },
  escP: function (v) { return String(v == null ? '' : v); },
  ptfProjectProfitIRR: function () { return { ok:true, complete:true, sellIrr:10000, buyIrr:5000, profit:5000, warnings: [] }; },
  ptfOpexSumFiscal: function () { return { total:200, byCat:{ 'اداری':200 }, totalLinked:0, totalUnlinked:200 }; },
  ptfTodayISO: function () { return '2026-07-22'; },
  ptfISOToJ: function (x) { return x; },
  ptfJToISO: function (x) { return String(x || '').indexOf('1406/') === 0 ? '2027-03-21' : '2026-03-21'; },
  Intl: Intl,
  Date: Date,
  document: { getElementById: function () { return null; }, body: { insertAdjacentHTML: function () {} } }
};
sandbox.window = sandbox;
vm.runInNewContext(fiscal, sandbox, { filename: 'fiscal.js' });
var d = sandbox.ptfFiscalDistribution('1405', 60);
T('runtime: direct project cost از سود پروژه کم می‌شود', d.projectProfit === 4000 && d.projects[0].projectCostIrr === 1000, JSON.stringify(d));
T('runtime: سود خالص هزینه جاری و تنخواه مستقل را هم کم می‌کند', d.netProfit === 3500 && d.pettyStandaloneTotal === 300 && d.opexTotal === 200, JSON.stringify(d));

SECTION('Dark mode and minimal icons');
T('working-capital boxes در حالت شب dark-safe هستند', wc.indexOf('background:var(--crd') > -1 && wc.indexOf('color:var(--tx') > -1 && wc.indexOf('background:#eff6ff') === -1);
T('سال مالی کلاس semantic و KPI مخصوص شب دارد', fiscal.indexOf('class="ptf-fiscal-shell"') > -1 && fiscal.indexOf('ptf-fiscal-kpi') > -1 && fiscal.indexOf('ptf-fiscal-alert-lock') > -1);
T('dark mode سال مالی transparent text اعداد را خنثی می‌کند', theme.indexOf('#fiscalBox .ptf-fiscal-kpi b') > -1 && theme.indexOf('-webkit-text-fill-color:currentColor!important') > -1 && theme.indexOf('background-image:none!important') > -1);
T('رنگ‌های alert سال مالی در شب صریح و پرکنتراست‌اند', ['#451a1a!important;color:#fecaca', '#064e3b!important;color:#d1fae5', '#2e1065!important;color:#e9d5ff', '#451a03!important;color:#fde68a'].every(function (x) { return theme.indexOf(x) > -1; }));
T('settings accordion از رنگ تم و SVG semantic استفاده می‌کند، نه شماره', settingsAcc.indexOf('ptf-set-ico') > -1 && settingsAcc.indexOf('function lineIcon') > -1 && settingsAcc.indexOf("return ('0' + (i + 1))") === -1 && settingsAcc.indexOf('background:var(--crd') > -1 && settingsAcc.indexOf('color:var(--tx') > -1);
T('financehub آیکون خطی semantic دارد و badge عددی/emoji ندارد', financehub.indexOf('function finIcon') > -1 && financehub.indexOf("btn('custacc', 'حساب مشتریان', 'customer')") > -1 && financehub.indexOf("'01 تنخواه'") === -1 && financehub.indexOf('📘 حساب مشتریان') === -1);
T('Quick access صفحه اصلی SVG خطی دارد و badgeهای 01..05 حذف شده‌اند', home.indexOf('class="ptf-line-icon"') > -1 && home.indexOf('>01</span> سامانه استعلام هوشمند') === -1 && home.indexOf('>CRM</span> ورود همکاران') === -1);
T('Knowledge Center heading آیکون کتاب خطی دارد نه KC/emoji', kc.indexOf('<h1><span class="ptf-line-icon"') > -1 && kc.indexOf('>KC</span>') === -1 && kc.indexOf('<h1>📚') === -1);
T('clusterهای مرکز دانش icon key معنایی و SVG دارند، نه شماره', kc.indexOf('function kcIcon') > -1 && kc.indexOf('icon:"pipe"') > -1 && kc.indexOf('icon:"01"') === -1 && kc.indexOf('kcIcon(cat.icon)') > -1);
T('CRM/SW نسخه v33.4.1 است', /window\.VER = 'v3[0-9.]+'/.test(idx) && /ptf-crm-v3[0-9.]+/.test(sw));

DONE('tester275-fiscal-profit-and-minimal-icons');
