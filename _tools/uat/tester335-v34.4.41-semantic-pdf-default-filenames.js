'use strict';
/* Regression: browser Save as PDF defaults to a semantic document filename. */
var fs = require('fs');
var vm = require('vm');
var assert = require('assert');
var ui = fs.readFileSync('crm/ui-kit.js', 'utf8');
var preview = fs.readFileSync('crm/offers-pro.js', 'utf8');
var offers = fs.readFileSync('crm/offers.js', 'utf8');
var rfq = fs.readFileSync('crm/rfqsmart.js', 'utf8');
var letters = fs.readFileSync('crm/letters.js', 'utf8');
var contracts = fs.readFileSync('crm/contracts.js', 'utf8');
var docsx = fs.readFileSync('crm/docsx.js', 'utf8');
var cheques = fs.readFileSync('crm/cheques.js', 'utf8');
var chequePrint = fs.readFileSync('crm/cheque-print.js', 'utf8');

/* Execute the filename helpers without booting the UI kit. */
var start = ui.indexOf('window.ptfPdfFileName = function');
var end = ui.indexOf('/* v31.7.19 US-PDF-NAME', start);
assert.ok(start > -1 && end > start, 'PDF naming helper boundary missing');
var rfqs = [{ cd: 'RFQ-SYS-41', inqNo: 'CLIENT/REQ:7788' }, { cd: 'RFQ-NO-CLIENT', inqNo: '' }];
var ctx = {
  window: null,
  getData: function (key) { return key === 'ptf_crm_rfqs' ? rfqs : []; },
  ptfInqClientNo: function (v) { return v; }
};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(ui.slice(start, end), ctx, { filename: 'pdf-name-helpers.js' });

assert.strictEqual(ctx.ptfPdfFileName(['CO:1405/0041', 'REQ*7788.pdf']), 'CO-1405-0041__REQ-7788');
assert.strictEqual(ctx.ptfPdfFileName(['نامه ۱۴۰۵/۱۲', 'شرکت نمونه']), 'نامه_۱۴۰۵-۱۲__شرکت_نمونه');
assert.strictEqual(ctx.ptfOfferPdfFileName({ no: 'CO-1405-0041', inqNo: 'RFQ-SYS-41' }), 'CO-1405-0041__CLIENT-REQ-7788', 'offer filename must append customer request number');
assert.strictEqual(ctx.ptfOfferPdfFileName({ no: 'CO-1405-0042', inqNo: 'RFQ-NO-CLIENT' }), 'CO-1405-0042', 'system RFQ code must not masquerade as a customer request number');
assert.strictEqual(ctx.ptfOfferPdfFileName({ no: 'TO-LEGACY-1', inqNo: 'OLD/CLIENT/9' }), 'TO-LEGACY-1__OLD-CLIENT-9', 'legacy stored customer reference must remain in filename');
assert.ok(ctx.ptfPdfHtmlWithTitle('<html><head><title>CRM</title></head><body>x</body></html>', 'CO/41').indexOf('<title>CO-41</title>') > -1);
assert.ok(ctx.ptfPdfHtmlWithTitle('<html><head></head><body>x</body></html>', 'LTR-77').indexOf('<title>LTR-77</title>') > -1);

/* The shared preview must inject and re-assert the title immediately before print. */
assert.ok(preview.indexOf('var printFileName = typeof ptfPdfFileName') > -1, 'preview must normalize its fileName argument');
assert.ok(preview.indexOf('window._ptfPrintFileName = printFileName') > -1, 'preview must retain the active PDF filename');
assert.ok(preview.indexOf('if (printDoc) printDoc.title = pdfTitle') > -1 && preview.indexOf('document.title = pdfTitle') > -1, 'iframe and top-page titles must be set immediately before print');
assert.ok(preview.indexOf('ptfPdfHtmlWithTitle(_cleanHtml, printFileName)') > -1, 'srcdoc must receive the semantic title');
assert.ok(preview.indexOf('نام پیش‌فرض PDF:') > -1 && preview.indexOf("'.pdf</b>") > -1, 'preview must show the user the expected PDF filename');

/* Priority document contracts requested by the user. */
assert.ok(preview.indexOf('ptfOfferPdfFileName(o)') > -1 && offers.indexOf('ptfOfferPdfFileName(o)') > -1, 'all offer print paths must include offer/customer-request naming');
assert.ok(rfq.indexOf("r.no + (tgt && tgt.co ? ('__' + tgt.co) : '')") > -1, 'supplier RFQ output must start with supplier-request number');
assert.ok(letters.indexOf("fullHtml, l.no || 'letter'") > -1, 'letter output must use letter number');
assert.ok(contracts.indexOf("fullHtml, c.no") > -1, 'contract output must use contract number');
assert.ok(docsx.indexOf("fullHtml, rec.no") > -1, 'official sales document output must use document number');
assert.ok(cheques.indexOf("var chequeFileName = 'CHQ-'") > -1 && chequePrint.indexOf("var chequeTitle = 'CHQ-'") > -1, 'cheque PDF/print paths must use cheque identifiers');

var version = JSON.parse(fs.readFileSync('VERSION.json', 'utf8')).crm_version;
assert.ok(/^v34\.(?:4\.(?:4[1-9]|[5-9]\d|\d{3,})|[5-9]\.\d+|\d{2,}\.\d+\.\d+)$/.test(version), 'release must retain or advance the v34.4.41 semantic PDF naming baseline');
var current = version.slice(1);
['crm/index.html','crm/sw.js','crm/manifest.json','crm/clear-cache.html','crm/shell.js'].forEach(function (file) {
  assert.ok(fs.readFileSync(file, 'utf8').indexOf(current) > -1, file + ' version drift');
});
console.log('PASS tester335-v34.4.41: semantic PDF filename reaches document.title for offers, supplier RFQs, letters and other numbered documents');
