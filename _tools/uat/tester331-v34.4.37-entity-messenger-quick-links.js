'use strict';
/* Customer/supplier messenger links under the contact number. */
var fs = require('fs');
var vm = require('vm');
var assert = require('assert');
var src = fs.readFileSync('crm/messengers.js', 'utf8');

/* Structural UI contract. */
['wa', 'tg', 'bale', 'eitaa', 'rubika'].forEach(function (id) {
  assert.ok(src.indexOf("id: '" + id + "'") > -1, id + ' app definition missing');
});
assert.ok(src.indexOf('msg-quick-links') > -1 && src.indexOf('msg-quick-app') > -1, 'compact link strip must exist');
assert.ok(src.indexOf('var contactCell = tds[isCustomer ? 4 : 3]') > -1, 'links must be injected under the contact column');
assert.ok(src.indexOf("['cTb', 'sTb']") > -1 && src.indexOf('MutationObserver') > -1, 'both customer and supplier rerenders must be covered');
assert.ok(src.indexOf("whatsapp://send?phone=") > -1 && src.indexOf("https://t.me/+") > -1, 'phone deep-links must use native WhatsApp and international Telegram formats');
assert.ok(src.indexOf("if (appId === 'wa') window.ptfWhatsAppOpen") > -1, 'prepared-message WhatsApp action must use the installed app');
assert.ok(src.indexOf("if (appId === 'wa') {") > -1 && src.indexOf("window.ptfWhatsAppOpen(firstMobile(c), '')") > -1, 'quick WhatsApp action must use the installed app');
assert.ok(src.indexOf("https://ble.ir/") > -1 && src.indexOf("https://eitaa.com/") > -1 && src.indexOf("https://rubika.ir/") > -1, 'username deep-links must exist');
assert.ok(src.indexOf("https://web.bale.ai/") > -1 && src.indexOf("https://web.eitaa.com/") > -1 && src.indexOf("https://web.rubika.ir/") > -1, 'phone-assisted web fallbacks must exist');
assert.ok(src.indexOf('updatedAtISO') > -1, 'messenger ID edits must carry a sync conflict timestamp');

/* Execute only the direct-message section, before bot integration. */
var end = src.indexOf('  /* ---------- US-333:');
assert.ok(end > 0, 'US-333 boundary missing');
var records = {
  ptf_crm_customers: [{
    cd: 'C-1', co: 'مشتری تست', ph: '۰۲۱۸۸۷۷۶۶۵۵',
    people: [{ nm: 'خریدار', primary: true, mobs: [{ n: '۰۹۱۲ ۳۴۵ ۶۷۸۹' }], tels: [] }],
    msgIds: { bale: '@bale_user', rubika: 'https://rubika.ir/rubika.user' }
  }, { cd: 'C-FIXED', co: 'فقط ثابت', ph: '۰۲۱۸۸۷۷۶۶۵۵', people: [] }],
  ptf_crm_suppliers: [{
    cd: 'S-1', co: 'Foreign Supplier', origin: 'خارجی',
    people: [{ nm: 'Sales', primary: true, mobs: [{ n: '+33 6 12 34 56 78' }], tels: [] }],
    msgIds: { tg: '@foreign_sales' }
  }]
};
var opened = [], assigned = [], copied = [];
var panels = { insertAdjacentHTML: function () {} };
var ctx = {
  window: null, console: console, JSON: JSON, Date: Date, Promise: Promise,
  navigator: { clipboard: { writeText: function (text) { copied.push(text); return Promise.resolve(); } } },
  location: { assign: function (url) { assigned.push(url); } },
  getData: function (k) { return records[k] || []; },
  setData: function (k, v) { records[k] = v; },
  primaryPerson: function (c) { return (c.people || []).filter(function (p) { return p.primary; })[0] || (c.people || [])[0] || null; },
  escP: function (v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/"/g, '&quot;'); },
  ptfOnClickArg: function (v) { return String(v == null ? '' : v).replace(/'/g, ''); },
  ptfMsgTpls: function () { return []; }, ptfToast: function () {}, audit: function () {},
  curSession: function () { return { name: 'تستر', user: 'tester' }; },
  renderCustomers: function () {}, renderSuppliers: function () {},
  MutationObserver: function () { this.observe = function () {}; },
  setTimeout: function () { return 0; },
  document: {
    getElementById: function (id) {
      if (id === 'panels') return panels;
      if (id === 'msgTxt') return { value: 'سلام از CRM' };
      return null;
    },
    querySelector: function () { return null; },
    createElement: function () { return { style: { setProperty: function () {} }, setAttribute: function () {}, appendChild: function () {}, addEventListener: function () {} }; },
    head: { appendChild: function () {} },
    body: { appendChild: function () {} }
  },
  open: function (url) { opened.push(url); return { opener: null }; }
};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(src.slice(0, end) + '\n})();', ctx, { filename: 'messengers-direct.js' });

assert.strictEqual(ctx.ptfMsgNormalizeMobile('۰۹۱۲ ۳۴۵ ۶۷۸۹'), '989123456789', 'Persian digits/mobile normalization failed');
assert.strictEqual(ctx.ptfMsgNormalizeMobile('021 8877 6655'), '', 'landline must not become a WhatsApp number');
assert.strictEqual(ctx.ptfMsgContactMobile(records.ptf_crm_customers[0]), '989123456789', 'primary person mobile must win over legacy fixed phone');
assert.strictEqual(ctx.ptfMsgContactMobile(records.ptf_crm_customers[1]), '', 'fixed-only record must have no mobile deep-link');
assert.strictEqual(ctx.ptfMsgContactMobile(records.ptf_crm_suppliers[0]), '33612345678', 'foreign trusted mobile must retain country code');

var strip = ctx.ptfMsgQuickHtml('ptf_crm_customers', records.ptf_crm_customers[0]);
['wa','tg','bale','eitaa','rubika'].forEach(function (id) { assert.ok(strip.indexOf('data-msg-app="' + id + '"') > -1, id + ' quick button missing'); });
assert.strictEqual((strip.match(/is-missing/g) || []).length, 0, 'all configured/phone-capable apps should be active');
assert.ok(strip.indexOf('ایتا وب؛ شماره برای یافتن مخاطب کپی می‌شود') > -1, 'mobile-only Eitaa button must explain its assisted web fallback');

ctx.ptfMsgQuickOpen('wa', 'ptf_crm_customers', 'C-1');
ctx.ptfMsgQuickOpen('tg', 'ptf_crm_customers', 'C-1');
ctx.ptfMsgQuickOpen('bale', 'ptf_crm_customers', 'C-1');
ctx.ptfMsgQuickOpen('rubika', 'ptf_crm_customers', 'C-1');
ctx.ptfMsgQuickOpen('eitaa', 'ptf_crm_customers', 'C-1');
ctx.ptfMsgOpen('wa', 'ptf_crm_customers', 'C-1');
assert.deepStrictEqual(assigned, [
  'whatsapp://send?phone=989123456789',
  'whatsapp://send?phone=989123456789&text=' + encodeURIComponent('سلام از CRM')
], 'quick and prepared-message WhatsApp actions must open the installed app without a new tab');
assert.strictEqual(ctx.ptfWhatsAppAppLink('۰۹۱۲ ۳۴۵ ۶۷۸۹', 'سلام تست'), 'whatsapp://send?phone=989123456789&text=' + encodeURIComponent('سلام تست'));
assert.deepStrictEqual(opened, [
  'https://t.me/+989123456789',
  'https://ble.ir/bale_user',
  'https://rubika.ir/rubika.user',
  'https://web.eitaa.com/'
]);
assert.deepStrictEqual(copied, ['09123456789'], 'mobile-only messenger web fallback must copy a searchable local phone number');

var version = JSON.parse(fs.readFileSync('VERSION.json', 'utf8')).crm_version;
assert.ok(/^v34\.(?:4\.(?:3[7-9]|[4-9]\d|\d{3,})|[5-9]\.\d+|\d{2,}\.\d+\.\d+)$/.test(version), 'release must retain or advance the v34.4.37 messenger baseline');
var current = version.slice(1);
['crm/index.html','crm/sw.js','crm/manifest.json','crm/clear-cache.html','crm/shell.js'].forEach(function (file) {
  assert.ok(fs.readFileSync(file, 'utf8').indexOf(current) > -1, file + ' version drift');
});
console.log('PASS tester331-v34.4.37+: customer/supplier WhatsApp/Telegram direct links + Bale/Eitaa/Rubika direct-or-assisted web links + phone normalization');
