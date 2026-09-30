#!/usr/bin/env node
'use strict';
/* Optional Chromium integration test; never reads live data or calls an API.
   Real customer renderer + CSS + customer summary + AR + customer-finance +
   permissions/customer scope + modalx + icons/mobile table labels run in-browser.
   Record previews/editing outside this feature are captured test doubles.

   Install tooling OUTSIDE the repository, then set NODE_PATH:
     npm i --prefix /tmp/ptf-browser playwright @sparticuz/chromium
     NODE_PATH=/tmp/ptf-browser/node_modules node _tools/uat/e2e-customer-summary-v34.39.42.js
   Alternatively install Playwright Chromium or set PTF_CHROMIUM_EXECUTABLE_PATH.
   Optional screenshots: PTF_E2E_ARTIFACTS=/tmp/ptf-customer-summary
   Generate an isolated synthetic preview without browser dependencies:
     node _tools/uat/e2e-customer-summary-v34.39.42.js --write-preview=/tmp/customer-preview.html
*/
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const { fixture, extractFunction } = require('./tester682-v34.39.42-customer-summary.js');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const source = (name, text) => '<script>' + text.replace(/<\/script/gi, '<\\/script') + '\n//# sourceURL=' + name + '\n</script>';

function previewHtml(data = fixture(), base = 'http://crm.test/crm/') {
  const idx = read('crm/index.html'), offers = read('crm/offers.js'), rbac = read('crm/rbac.js');
  const realCss = (idx.replace(/<script\b[\s\S]*?<\/script>/gi, '').match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) || []).join('\n');
  const roleStart = rbac.indexOf('var ROLES = {');
  const roles = rbac.slice(roleStart, rbac.indexOf('\n};', roleStart) + 3);
  const release = JSON.parse(read('VERSION.json')).crm_version;
  const env = `
window.__summaryDb = ${JSON.stringify(data).replace(/</g, '\\u003c')};
window.__summaryReads = []; window.__summaryWrites = []; window.__summaryCalls = [];
window.previewRole = 'admin'; window.PTF_SALES_DOMAIN_V2 = true;
function getData(k) { __summaryReads.push(k); return __summaryDb[k] || []; }
function setData(k) { __summaryWrites.push(k); throw new Error('No domain writes in customer overview preview'); }
function curSession() { return { user: 'sales1', role: previewRole, name: 'کاربر آزمایشی' }; }
function curRole() { return previewRole; }
var SENIOR_ROLES = ['admin', 'chairman', 'ceo', 'commercial'];
${roles}
${['roleDef', 'isSenior', 'canPanel', 'ptfCanSeeLedger'].map(n => extractFunction(rbac, n)).join('\n')}
function escP(v) { return String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function ptfOnClickArg(v) { return escP(String(v || '').replace(/\\\\/g, '\\\\\\\\').replace(/'/g, "\\\\'")); }
function migrateContacts() {} // fixture contacts are already normalized
function ptfToast(message) { document.getElementById('previewNotice').textContent = message; clearTimeout(window.__previewToast); window.__previewToast = setTimeout(function(){document.getElementById('previewNotice').textContent='';},2800); }
function goPanel() {} // permission hooks can late-bind normally; no production routing
function previewRecord(kind, ref) {
  __summaryCalls.push([kind, ref]);
  document.getElementById('panels').insertAdjacentHTML('beforeend', '<div class="md-b" id="previewRecord" style="display:grid;z-index:'+ptfTopZIndex(2800)+'"><div class="md" role="dialog"><h3>جزئیات آزمایشی — '+escP(ref)+'</h3><p>این پیش‌نمایش فقط مسیر بازشدن سند را نشان می‌دهد؛ جزئیات کامل در ماژول اصلی CRM باز می‌شود.</p><button class="bt bt-o" onclick="this.parentNode.parentNode.remove()">بستن</button></div></div>');
}
function ptfViewRfq(ref) { previewRecord('rfq', ref); }
function offerQuickPreview(ref) { previewRecord('offer', ref); }
function openProject(ref) { previewRecord('archive', ref); }
function ptfGoSalesFile(ref) { previewRecord('deal', ref); }
function showEntityCard(kind, ref) { previewRecord('contact', ref); }
function showCustModal() { ptfToast('ویرایش و ثبت در این پیش‌نمایش آزمایشی غیرفعال است.'); }
function previewSwitchRole(role) { previewRole = role; ptfCustomerSummaryClose(); renderCustomers(); }
window.PTF_RFQ_STATUSES = [{v:'st1',t:'دریافت اولیه'},{v:'st2',t:'بررسی فنی'},{v:'stX',t:'مختومه'}];
${['buildCustomers', 'ptfCustSortNewest', 'ptfCustDualName'].map(n => extractFunction(idx, n)).join('\n')}
${['primaryPerson', 'fmtTel', 'telHref', 'entityMatches', 'ptfCustContactChannels', 'ptfCustContactCell', 'renderCustomers2'].map(n => extractFunction(offers, n)).join('\n')}
var renderCustomers = renderCustomers2;
`;
  const modules = ['perms', 'theme-contrast', 'date-kit', 'finance-helpers', 'metrics-shared', 'ar-reconcile', 'modalx', 'iconx', 'my-customers-filter', 'customer-finance', 'mobile-table-labels', 'mobile-actions', 'customer-summary'];
  return '<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="' + base + '"><title>پیش‌نمایش خلاصهٔ مشتری</title>' + realCss +
    '<style>.preview-frame{max-width:1280px;margin:20px auto;padding:0 22px}.preview-head{display:flex;justify-content:space-between;gap:14px;align-items:center;flex-wrap:wrap;margin-bottom:18px}.preview-head h1{font-size:23px;margin:4px 0}.preview-note{background:#fffbeb;color:#92400e;border:1px solid #fde68a;padding:10px 14px;border-radius:12px;line-height:1.9;font-size:12px;margin-bottom:16px}.preview-tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.preview-tools select{min-height:36px;padding:5px;border:1px solid var(--brd);border-radius:8px}#previewNotice{position:fixed;bottom:12px;right:12px;z-index:7000;max-width:calc(100vw - 24px);padding:9px 12px;background:#0f172a;color:white;border-radius:10px;font-size:12px}#previewNotice:empty{display:none}@media(max-width:600px){.preview-frame{padding:0 12px;margin:14px auto}.preview-head h1{font-size:20px}}</style></head><body>' +
    '<main class="preview-frame"><header class="preview-head"><div><small>پیشتاز تجهیز فکر · ' + release + '</small><h1>فروش / مشتریان</h1></div><div class="preview-tools"><label for="previewRole">نقش آزمایشی</label><select id="previewRole" onchange="previewSwitchRole(this.value)"><option value="admin">مدیر سیستم</option><option value="sales">کارشناس فروش</option></select><button class="bt bt-o" onclick="ptfSetTheme(document.body.classList.contains(\'ptf-dark\')?\'light\':\'dark\')">شب / روز</button></div></header>' +
    '<div class="preview-note"><b>پیش‌نمایش با داده‌های کاملاً آزمایشی</b> — هیچ اطلاعات واقعی یا اتصال به سرور ندارد. روی نام «شرکت نمونه» یا آیکون خلاصه بزنید تا قابلیت جدید را ببینید. ثبت/ویرایش غیرفعال است.</div><section id="panels"><div id="previewCustomers"></div></section></main><div id="previewNotice" role="status" aria-live="polite"></div>' +
    source('preview-environment.js', env) + modules.map(n => source('crm/' + n + '.js', read('crm/' + n + '.js'))).join('\n') +
    source('preview-boot.js', "document.getElementById('previewCustomers').innerHTML = buildCustomers(); renderCustomers();") + '</body></html>';
}

module.exports = { previewHtml };

async function runBrowserTests() {
  const { chromium } = require('playwright');
  let options = { headless: true, args: ['--no-sandbox'] };
  if (process.env.PTF_CHROMIUM_EXECUTABLE_PATH) options.executablePath = process.env.PTF_CHROMIUM_EXECUTABLE_PATH;
  else {
    let pkg;
    try { pkg = require('@sparticuz/chromium'); } catch (e) { /* use installed Playwright Chromium */ }
    if (pkg) {
      const binary = pkg.default || pkg;
      if (typeof pkg.inflate === 'function' && typeof pkg.setupLambdaEnvironment === 'function') {
        const packageRoot = path.resolve(path.dirname(require.resolve('@sparticuz/chromium')), '..');
        await pkg.inflate(path.join(packageRoot, 'bin/al2023.tar.br'));
        pkg.setupLambdaEnvironment('/tmp/al2023/lib');
      }
      options = { headless: true, executablePath: await binary.executablePath(), args: binary.args };
    }
  }
  const browser = await chromium.launch(options);
  let pass = 0, fail = 0;
  const T = (name, ok, detail) => { if (ok) { pass++; console.log('PASS', name); } else { fail++; console.error('FAIL', name, detail || ''); } };
  const artifacts = process.env.PTF_E2E_ARTIFACTS;
  if (artifacts) fs.mkdirSync(artifacts, { recursive: true });
  const errors = [], requests = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'fa-IR' });
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'crm.test' && url.pathname === '/crm/') return route.fulfill({ contentType: 'text/html', body: previewHtml() });
      if (/^\/assets\/fonts\/[\w.-]+\.woff2$/.test(url.pathname)) return route.fulfill({ contentType: 'font/woff2', body: fs.readFileSync(path.join(ROOT, url.pathname)) });
      requests.push(route.request().url()); await route.abort();
    });
    const page = await context.newPage();
    page.on('pageerror', err => errors.push(err.message));
    await page.goto('http://crm.test/crm/', { waitUntil: 'load' });
    await page.waitForSelector('#cTb .cs-name');
    const seed = await page.evaluate(() => JSON.stringify(__summaryDb));
    const name = '#cTb .cs-name[data-customer-id="customer-1"]';
    await page.locator(name).click();
    await page.waitForSelector('#ptfCustomerSummaryDlg .mx-dots');
    await page.waitForFunction(() => document.activeElement.closest('#ptfCustomerSummaryDlg'));
    T('real list click opens accessible RTL dialog', await page.locator('#ptfCustomerSummaryDlg .cs-dialog[role="dialog"][dir="rtl"]').count() === 1);
    T('count cards and account summary appear', await page.locator('.cs-stat').count() === 4 && await page.locator('.cs-finance-grid > div').count() === 6);
    T('requests and both proposal families retain real counts', await page.locator('.cs-stat b').allTextContents().then(v => v.slice(0, 3).join(',') === '۳,۲,۸'));
    await page.locator('#csTab-requests').focus(); await page.keyboard.press('ArrowLeft');
    T('RTL arrow activates and focuses technical tab', await page.locator('#csTab-technical').getAttribute('aria-selected') === 'true' && await page.evaluate(() => document.activeElement.id === 'csTab-technical'));
    await page.keyboard.press('End');
    T('End reaches invoice tab', await page.locator('#csTab-invoices').getAttribute('aria-selected') === 'true');
    await page.keyboard.press('Home');
    T('Home returns to first tab', await page.locator('#csTab-requests').getAttribute('aria-selected') === 'true');
    let trapped = true;
    for (let i = 0; i < 28; i++) { await page.keyboard.press('Tab'); trapped = trapped && await page.evaluate(() => !!document.activeElement.closest('#ptfCustomerSummaryDlg')); }
    T('modalx keeps keyboard Tab inside top dialog', trapped);
    await page.locator('#csTab-commercial').click();
    T('real history has all financial documents and companions', await page.locator('#csHistory .cs-table tbody tr').count() === 10 && (await page.locator('#csHistory').innerText()).includes('CO-FX'));
    await page.locator('#ptfCustomerSummaryDlg .mx-dot.y').click();
    T('modalx can minimize overview without losing customer view', !await page.locator('#ptfCustomerSummaryDlg').isVisible() && await page.locator('#mxDock .mx-disk').count() === 1);
    await page.locator('#mxDock .mx-disk').click();
    T('dock restore retains selected tab and customer history', await page.locator('#ptfCustomerSummaryDlg').isVisible() && await page.locator('#csTab-commercial').getAttribute('aria-selected') === 'true' && await page.locator('#csHistory .cs-table tbody tr').count() === 10);
    await page.locator('#csHistory [data-cs-action="offer"]').first().click();
    await page.waitForSelector('#previewRecord');
    T('document button invokes the existing offer reference handler', await page.evaluate(() => __summaryCalls.at(-1)[0] === 'offer' && __summaryCalls.at(-1)[1].startsWith('CO-')));
    T('document dialog stacks above customer overview', await page.evaluate(() => +getComputedStyle(document.getElementById('previewRecord')).zIndex > +getComputedStyle(document.getElementById('ptfCustomerSummaryDlg')).zIndex));
    await page.keyboard.press('Escape');
    T('Escape closes only top document, keeps overview', await page.locator('#previewRecord').count() === 0 && await page.locator('#ptfCustomerSummaryDlg').count() === 1);
    await page.locator('#ptfCustomerSummaryDlg [data-cs-action="account"]').click();
    await page.waitForSelector('#cfAccountDlg');
    T('actual cfOpen accepts canonical customer _id and renders correct ledger', (await page.locator('#cfAccountDlg h3').innerText()).includes('شرکت نمونه') && await page.locator('#cfAccountDlg table tbody tr').count() > 0);
    await page.keyboard.press('Escape');
    T('Escape from real account returns focus to overview', await page.locator('#cfAccountDlg').count() === 0 && await page.waitForFunction(() => !!document.activeElement.closest('#ptfCustomerSummaryDlg')).then(() => true));
    if (artifacts) { await page.evaluate(() => document.querySelector('.cs-dialog').scrollTop = 0); await page.screenshot({ path: path.join(artifacts, 'desktop.png') }); }
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.activeElement.matches('#cTb .cs-name[data-customer-id="customer-1"]'));
    T('closing overview restores original list trigger focus', await page.locator('#ptfCustomerSummaryDlg').count() === 0);
    await page.locator('#cTb .cs-summary-action[data-customer-id="customer-1"]').click();
    await page.evaluate(() => ptfCustomerSummaryOpen('customer-1'));
    T('reopening is singleton with one live dialog', await page.locator('#ptfCustomerSummaryDlg').count() === 1);
    await page.mouse.click(3, 3);
    T('backdrop click closes singleton', await page.locator('#ptfCustomerSummaryDlg').count() === 0);
    await page.locator('#cTb .cs-name[data-customer-id="customer-3"]').click();
    T('empty customer displays genuine empty state', (await page.locator('#ptfCustomerSummaryContent').innerText()).includes('رکوردی ثبت نشده') && await page.locator('.cs-stat b').allTextContents().then(v => v.every(n => n === '۰')));
    await page.evaluate(() => ptfCustomerSummaryClose());
    T('overview, real account and renderer leave source data unchanged', await page.evaluate(() => JSON.stringify(__summaryDb)) === seed && await page.evaluate(() => __summaryWrites.length) === 0);
    await page.locator(name).click();
    await page.waitForSelector('#ptfCustomerSummaryDlg .mx-dot.y'); await page.locator('#ptfCustomerSummaryDlg .mx-dot.y').click();
    await page.locator('#cTb .cs-name[data-customer-id="customer-3"]').click();
    await page.waitForFunction(() => document.querySelectorAll('#mxDock .mx-disk').length === 0);
    T('changing customer while minimized removes stale dock entry, keeps one new overview', await page.locator('#ptfCustomerSummaryDlg').count() === 1 && (await page.locator('.cs-profile h2').innerText()).includes('مشتری جدید'));
    await page.evaluate(() => ptfCustomerSummaryClose());

    await page.locator(name).click();
    await page.evaluate(() => { previewRole = 'sales'; __summaryReads = []; window.sfStageLabel = function(){ getData('ptf_crm_invoices'); return 'وضعیت مالی خارج از دسترسی'; }; });
    await page.locator('#csTab-commercial').click();
    T('live role reduction clears prior finance cards/tabs', await page.locator('.cs-finance,#csTab-invoices').count() === 0);
    T('sales interaction never reads invoice, return or receipt collections', await page.evaluate(() => __summaryReads.every(k => !['ptf_crm_invoices','ptf_crm_sales_returns','ptf_crm_case_receipts'].includes(k))));
    await page.evaluate(() => ptfCustomerSummaryOpen('C-2'));
    T('real customer scope rejects another owner even through direct global call', (await page.locator('#ptfCustomerSummaryContent').innerText()).includes('محدودهٔ دسترسی') && await page.locator('.cs-stats').count() === 0);
    await page.evaluate(() => { previewRole = 'admin'; ptfCustomerSummaryOpen('C-1'); localStorage.setItem('ptf_crm_perms', JSON.stringify({sales1:{cust:'deny'}})); });
    await page.locator('#csTab-commercial').click();
    T('actual personal permission deny clears overview on tab click', (await page.locator('#ptfCustomerSummaryContent').innerText()).includes('دسترسی') && await page.locator('.cs-stats').count() === 0);
    await page.evaluate(() => { localStorage.removeItem('ptf_crm_perms'); previewRole = 'buyer'; localStorage.setItem('ptf_crm_perms',JSON.stringify({sales1:{cust:'allow',rfq:'allow',off:'allow',deals:'allow'}})); ptfCustomerSummaryOpen('C-1'); ptfCustomerSummaryTab('commercial'); });
    T('custom panel allow never grants sellPrice or ledger rights', await page.locator('.cs-values,.cs-finance').count() === 0 && !(await page.locator('#csHistory').innerText()).includes('مبلغ پیشنهاد'));
    await page.evaluate(() => { localStorage.removeItem('ptf_crm_perms'); previewRole = 'admin'; ptfCustomerSummaryClose(); });

    await page.evaluate(() => document.getElementById('previewNotice').textContent = '');
    for (const width of [768, 390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.locator('#cTb .cs-summary-action[data-customer-id="customer-1"]').click();
      await page.locator('#csTab-commercial').click();
      const layout = await page.evaluate(() => {
        const md = document.querySelector('.cs-dialog'), rect = md.getBoundingClientRect();
        const wrap = document.querySelector('.cs-table-wrap');
        return { x:rect.left, right:rect.right, width:innerWidth, mdOverflow:md.scrollWidth-md.clientWidth, docOverflow:document.documentElement.scrollWidth-innerWidth, tableScrollable:wrap.scrollWidth > wrap.clientWidth, columns:getComputedStyle(document.querySelector('.cs-stats')).gridTemplateColumns.split(' ').length };
      });
      T(width + 'px: dialog contained; no modal/page horizontal overflow', layout.x >= -1 && layout.right <= width + 1 && layout.mdOverflow <= 1 && layout.docOverflow <= 1, layout);
      if (width < 680) T(width + 'px: two-column counts, locally scrollable history', layout.columns === 2 && layout.tableScrollable, layout);
      if (artifacts && width === 390) { await page.evaluate(() => document.querySelector('.cs-dialog').scrollTop = 0); await page.screenshot({ path: path.join(artifacts, 'mobile.png') }); }
      await page.evaluate(() => ptfCustomerSummaryClose());
      const action = await page.locator('#cTb .cs-summary-action[data-customer-id="customer-1"] svg').boundingBox();
      T(width + 'px: mobile summary icon is actually visible', action && action.width >= 16 && action.height >= 16);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.evaluate(() => { ptfSetTheme('dark'); ptfCustomerSummaryOpen('C-1'); });
    const contrast = await page.evaluate(() => ({ sub:getComputedStyle(document.querySelector('.cs-profile .cs-sub')).color, number:getComputedStyle(document.querySelector('.cs-stat b')).color, bg:getComputedStyle(document.querySelector('.cs-dialog')).backgroundColor }));
    T('dark mode uses semantic light secondary text and visible count color', contrast.sub === 'rgb(213, 223, 237)' && contrast.number === 'rgb(103, 232, 249)' && contrast.bg !== 'rgb(255, 255, 255)', contrast);
    if (artifacts) await page.screenshot({ path: path.join(artifacts, 'dark.png') });
    await page.evaluate(() => { ptfSetTheme('light'); ptfCustomerSummaryClose(); __summaryDb.ptf_crm_rfqs = Array.from({length:45},(_,i)=>({cd:'R-PAGE-'+i,custCd:'C-1',st:'st1',dt:'2026-09-30'})); ptfCustomerSummaryOpen('C-1'); });
    T('real DOM pagination starts at 20 without truncating count', await page.locator('#csHistory .cs-table tbody tr').count() === 20 && await page.locator('.cs-stat b').first().innerText() === '۴۵');
    await page.locator('#csHistory button[onclick="ptfCustomerSummaryMore()"]').click();
    T('real DOM next page reaches 40 records', await page.locator('#csHistory .cs-table tbody tr').count() === 40);
    await page.locator('#csHistory button[onclick="ptfCustomerSummaryMore()"]').click();
    T('final page reaches 45, removes exhausted More action', await page.locator('#csHistory .cs-table tbody tr').count() === 45 && await page.locator('#csHistory button[onclick="ptfCustomerSummaryMore()"]').count() === 0);
    await page.evaluate(() => { __summaryDb.ptf_crm_rfqs.push({cd:'R-SYNC',custCd:'C-1',st:'st1'}); window.dispatchEvent(new Event('ptf:sync-ready')); });
    T('real sync event refreshes count from current data', await page.locator('.cs-stat b').first().innerText() === '۴۶');
    await page.evaluate(() => { ptfCustomerSummaryClose(); window.__hydrations=[]; window.ptfBIdbHydrated=false; window.ptfBMirrorActive=()=>true; window.ptfBWhenHydrated=fn=>__hydrations.push(fn); ptfCustomerSummaryOpen('C-1'); });
    T('cold browser mirror shows loading, not false zero', (await page.locator('#ptfCustomerSummaryContent').innerText()).includes('در حال خواندن'));
    await page.evaluate(() => { ptfCustomerSummaryOpen('C-2'); __hydrations[0](); });
    T('stale hydration callback cannot replace selected customer', (await page.locator('#ptfCustomerSummaryContent').innerText()).includes('در حال خواندن'));
    await page.evaluate(() => { ptfBIdbHydrated=true; __hydrations[1](); });
    T('latest hydration callback renders correct browser customer', (await page.locator('.cs-profile h2').innerText()).includes('شرکت همسایه'));
    await page.evaluate(() => { ptfBIdbHydrated=false; ptfCustomerSummaryOpen('C-1'); ptfCustomerSummaryClose(); __hydrations[2](); });
    T('close while hydrating never resurrects modal', await page.locator('#ptfCustomerSummaryDlg').count() === 0);
    T('all browser actions remain domain-read-only', await page.evaluate(() => __summaryWrites.length === 0));
    T('no browser runtime errors', errors.length === 0, errors);
    T('no API or other network requests', requests.length === 0, requests);
    await context.close();
  } finally { await browser.close(); }
  console.log('\n=== Browser customer summary: ' + pass + ' PASS / ' + fail + ' FAIL ===');
  return fail ? 1 : 0;
}
if (require.main === module) {
  const output = process.argv.find(arg => arg.startsWith('--write-preview='));
  if (output) { fs.writeFileSync(output.slice('--write-preview='.length), previewHtml(fixture(), '/crm/')); console.log('Wrote synthetic-only customer preview'); }
  else runBrowserTests().then(code => { process.exitCode = code; }).catch(err => { console.error(err); process.exitCode = 1; });
}
