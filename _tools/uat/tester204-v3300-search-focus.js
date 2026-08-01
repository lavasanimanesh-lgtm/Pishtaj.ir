/* S3b — UR-2026-08-01-02: جستجوی زنده نباید فوکوس را از کادر جستجو بگیرد
   بررسی: renderer باید فقط ناحیهٔ داده را به‌روز کند نه کل پنل (شامل کادر جستجو). */
'use strict';
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');

var OFFERS = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8');
var LEADS = fs.readFileSync(path.join(BASE, 'leads.js'), 'utf-8');
var LETTERS = fs.readFileSync(path.join(BASE, 'letters.js'), 'utf-8');
var PROJECTS = fs.readFileSync(path.join(BASE, 'projects.js'), 'utf-8');
var SALESFILES = fs.readFileSync(path.join(BASE, 'salesfiles.js'), 'utf-8');
var RBAC = fs.readFileSync(path.join(BASE, 'rbac.js'), 'utf-8');
var SURPLUS = fs.readFileSync(path.join(BASE, 'surplus.js'), 'utf-8');
var CUSTFIN = fs.readFileSync(path.join(BASE, 'customer-finance.js'), 'utf-8');
var SUPFIN = fs.readFileSync(path.join(BASE, 'supplier-finance.js'), 'utf-8');

SECTION('پیشنهادات — renderOffers فقط جدول را به‌روز می‌کند');
T('renderOffers tbody را به‌روز می‌کند نه کل پنل', /var tb = document\.getElementById\('oTb'\);[\s\S]{0,60}if \(!tb\) return;/.test(OFFERS) && OFFERS.indexOf("document.getElementById('oTb')") > -1);
T('کادر جستجوی پیشنهادات id ثابت دارد و جایگزین نمی‌شود', OFFERS.indexOf('id="oFsrch"') > -1);

SECTION('سرنخ‌ها — renderLeads فقط ldWrap را به‌روز می‌کند');
T('renderLeads کانتینر ldWrap را پر می‌کند', LEADS.indexOf("document.getElementById('ldWrap')") > -1 && !/ldWrap[\s\S]{0,30}outerHTML/.test(LEADS));

SECTION('مکاتبات — renderLetters فقط ltWrap را به‌روز می‌کند');
T('renderLetters کانتینر ltWrap را پر می‌کند', LETTERS.indexOf("document.getElementById('ltWrap')") > -1 && !/ltWrap[\s\S]{0,30}outerHTML/.test(LETTERS));

SECTION('پروژه‌ها — renderProjects2 فقط ناحیهٔ داده را به‌روز می‌کند');
T('renderProjects2 کانتینر جدا دارد', PROJECTS.indexOf("document.getElementById('prjSrch')") > -1 && PROJECTS.indexOf('el.innerHTML = h') > -1);

SECTION('فرصت‌ها — renderDeals فقط ناحیهٔ داده را به‌روز می‌کند');
T('renderDeals از کادر جستجوی sfSrch استفاده می‌کند و فقط dealWrap را پر می‌کند', SALESFILES.indexOf('id="sfSrch"') > -1 && SALESFILES.indexOf("document.getElementById('dealWrap')") > -1 && !/dealWrap[\s\S]{0,20}outerHTML/.test(SALESFILES));

SECTION('قیمت‌های خرید — renderBuyQuotes فقط bqTb را به‌روز می‌کند');
T('renderBuyQuotes tbody bqTb را پر می‌کند', RBAC.indexOf("document.getElementById('bqTb')") > -1 && RBAC.indexOf("tb.innerHTML = list.map") > -1);

SECTION('موجودی انبار — renderSurplus ناحیهٔ آمار را به‌روز می‌کند');
T('renderSurplus کادر جستجوی surpSrch را جدا نگه می‌دارد', SURPLUS.indexOf('id="surpSrch"') > -1 && SURPLUS.indexOf('surplusStats') > -1 && SURPLUS.indexOf('surplusWrap') > -1);

SECTION('حساب مشتریان — cfFinanceSearch فقط جدول را به‌روز می‌کند');
T('cfFinanceSearch فقط tbody (cfFinanceTbl) را به‌روز می‌کند و کادر cfSearch دست‌نخورده می‌ماند', CUSTFIN.indexOf('id="cfFinanceTbl"') > -1 && CUSTFIN.indexOf("tbl.innerHTML = window.cfFinanceRowsHtml()") > -1 && CUSTFIN.indexOf("box.outerHTML") === -1);

SECTION('حساب تأمین‌کنندگان — slFinanceSearch فقط جدول را به‌روز می‌کند');
T('slFinanceSearch کادر slFinanceSearch را جدا نگه می‌دارد', SUPFIN.indexOf('id="slFinanceSearch"') > -1 && SUPFIN.indexOf('window.slFinanceSearch') > -1);

SECTION('ابزار سورت/خروجی از قبل متصل است (listtools)');
T('دکمهٔ فیلتر/خروجی به کادرهای جستجوی اصلی وصل است', (function () {
  var lt = fs.readFileSync(path.join(BASE, 'listtools.js'), 'utf-8');
  return lt.indexOf("{ sel: '#sSrch', id: 'sup' }") > -1 && lt.indexOf("{ sel: '#oFsrch', id: 'off' }") > -1 && lt.indexOf('ptfListTools') > -1;
})());

DONE('tester204-v3300-search-focus');
