/* tester127 — v21.1 (BUG-035/036/037 + SW ai-workbench) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var oppo = fs.readFileSync(path.join(BASE, 'oppo.js'), 'utf-8');
var sf = fs.readFileSync(path.join(BASE, 'salesfiles.js'), 'utf-8');
var arch = fs.readFileSync(path.join(BASE, 'archive.js'), 'utf-8');
var prj = fs.readFileSync(path.join(BASE, 'projects.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('نسخه v21.1');
T('VER v21.1+', (function(){var m=idx.match(/var VER = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=21.1;})());
T('SW cache v21.1+', (function(){var m=sw.match(/ptf-crm-v([0-9.]+)/);return m&&parseFloat(m[1])>=21.1;})());
T('ai-workbench در SHELL', sw.indexOf('ai-workbench.js') > -1);
T('cache-bust salesfiles >=21.1', (function(){var m=idx.match(/salesfiles\.js\?v=([0-9.]+)/);return m&&parseFloat(m[1])>=21.1;})());
T('cache-bust oppo >=21.1', (function(){var m=idx.match(/oppo\.js\?v=([0-9.]+)/);return m&&parseFloat(m[1])>=21.1;})());
T('cache-bust archive >=21.1', (function(){var m=idx.match(/archive\.js\?v=([0-9.]+)/);return m&&parseFloat(m[1])>=21.1;})());
T('cache-bust projects >=21.1', (function(){var m=idx.match(/projects\.js\?v=([0-9.]+)/);return m&&parseFloat(m[1])>=21.1;})());

SECTION('BUG-035 ساختاری');
T('oppo archivedInqSet', oppo.indexOf('ptfOppoArchivedInqSet') > -1);
T('oppo isArchivedInq', oppo.indexOf('ptfOppoIsArchivedInq') > -1);
T('oppo reads projects', oppo.indexOf("ptf_crm_projects") > -1);
T('sfFindArchivedProject', sf.indexOf('sfFindArchivedProject') > -1);
T('sfMarkLostRelated', sf.indexOf('sfMarkLostRelated') > -1);
T('sfArchive idempotent', sf.indexOf('idempotent') > -1 || sf.indexOf('قبلاً بایگانی') > -1);
T('sfCloseLost guard already', sf.indexOf('sfFindArchivedProject(r)') > -1);
T('mark offers lost', sf.indexOf("o.st = 'lost'") > -1);
T('mark rfq stX', sf.indexOf("q.st = 'stX'") > -1);

SECTION('BUG-036 ساختاری');
T('archiveMetaOnly path', arch.indexOf('archiveMetaOnly') > -1);
T('state archived allowed', arch.indexOf("'archived'") > -1 && arch.indexOf('salesfile') > -1);
T('no-cloud download why', arch.indexOf('no-cloud') > -1);
T('download gate only with files', arch.indexOf('فایل ابری دارد') > -1 || arch.indexOf('cloudDocs(p)') > -1);
T('ptfPrjHasCloudFiles export', arch.indexOf('ptfPrjHasCloudFiles') > -1);
T('UI meta-only hint', prj.indexOf('archiveMetaOnly') > -1 || prj.indexOf('BUG-036') > -1);

SECTION('BUG-037 ساختاری');
T('ptfBinderOpenFolder', idx.indexOf('ptfBinderOpenFolder') > -1);
T('binder stopPropagation', idx.indexOf('ptfBinderModal') > -1 && idx.indexOf('event.stopPropagation()') > -1);
T('binder inline view not remove+open only', idx.indexOf('openStoredFile') > -1 && idx.indexOf('ptfOpenProjectBinder') > -1);
T('projects file stopPropagation', prj.indexOf('event.stopPropagation();openStoredFile') > -1);
T('projects مشاهده button', prj.indexOf('مشاهده') > -1);

SECTION('BUG-035 رفتاری — ptfOppoList');
// Load oppo IIFE
store = {};
global.localStorage = {
  getItem: function (k) { return store[k] || null; },
  setItem: function (k, v) { store[k] = String(v); },
  removeItem: function (k) { delete store[k]; },
  clear: function () { store = {}; }
};
global.getData = function (k) { try { return JSON.parse(store[k] || '[]'); } catch (e) { return []; } };
global.setData = function (k, d) { store[k] = JSON.stringify(d); };
global.window = global;
global.escP = function (s) { return String(s == null ? '' : s); };
global.faDateTime = function () { return '1405/04/20 12:00'; };
global.curSession = function () { return { name: 'Test', user: 'test' }; };
global.audit = function () {};
global.notify = function () {};
global.ptfToast = function () {};
global.renderDeals = function () { global._renderDealsCalled = true; };
global.ptfRfqDueState = null;
global.ptfRfqWaitBadge = null;

// Seed: offers still live after lost archive project exists
setData('ptf_crm_offers', [
  { no: 'CO-1', kind: 'CO', st: 'sent', inqNo: 'INQ-100', buyerCo: 'Acme' },
  { no: 'TO-1', kind: 'TO', st: 'sent', inqNo: 'INQ-200', buyerCo: 'Beta' }
]);
setData('ptf_crm_rfqs', [
  { cd: 'R-100', inqNo: 'INQ-100', co: 'Acme', st: 'st3' },
  { cd: 'R-200', inqNo: 'INQ-200', co: 'Beta', st: 'st3' }
]);
setData('ptf_crm_deals', []);
setData('ptf_crm_projects', [
  { no: 'ARC-INQ-100', inqNo: 'INQ-100', state: 'archived', origin: 'salesfile', closeKind: 'lost', buyerCo: 'Acme' }
]);

eval(oppo);
T('ptfOppoList defined', typeof ptfOppoList === 'function');
var list1 = ptfOppoList();
T('فرصت بایگانی‌شده INQ-100 مخفی است', !list1.some(function (g) { return g.inqNo === 'INQ-100'; }));
T('فرصت زنده INQ-200 باقی است', list1.some(function (g) { return g.inqNo === 'INQ-200'; }));

// Alias path: project archived by cd
setData('ptf_crm_projects', [
  { no: 'ARC-R-200', inqNo: 'R-200', state: 'archived', origin: 'salesfile', closeKind: 'lost' }
]);
// re-eval not needed — function reads live data
var list2 = ptfOppoList();
T('alias cd R-200 هم مخفی می‌شود', !list2.some(function (g) { return g.inqNo === 'INQ-200' || g.inqNo === 'R-200'; }));

SECTION('BUG-035 رفتاری — sfArchive idempotent (extract helpers)');
// Extract and eval helper functions + minimal sfArchive pieces from salesfiles via eval of whole IIFE is heavy;
// instead simulate helpers by evaling matching function blocks if present as window.*
// Load salesfiles carefully: it is IIFE using many globals
global.SF_LOST_REASONS = [
  { id: 'price', lb: 'قیمت' },
  { id: 'other', lb: 'سایر' }
];
global.sfAll = function () { return getData('ptf_crm_deals'); };
global.sfSave = function (arr) { setData('ptf_crm_deals', arr); };
global.sfDocsOf = function () { return { offers: [], letters: [], invoices: [], misc: [], supply: [] }; };
global.sfHasInvoice = function () { return false; };
global.sfDeleteCloud = function () {};
global.ptfProjectLossTotal = function () { return 0; };

// Pull helper functions text
function extractFn(code, name) {
  var re = new RegExp('function ' + name + '\\s*\\([\\s\\S]*?\\n  \\}\\n');
  var m = code.match(re);
  return m ? m[0] : null;
}
var h1 = extractFn(sf, 'sfArchiveAliases');
var h2 = extractFn(sf, 'sfFindArchivedProject');
var h3 = extractFn(sf, 'sfMarkLostRelated');
T('extract sfArchiveAliases', !!h1);
T('extract sfFindArchivedProject', !!h2);
T('extract sfMarkLostRelated', !!h3);
if (h1 && h2 && h3) {
  eval(h1 + h2 + h3);
  setData('ptf_crm_projects', [
    { no: 'ARC-INQ-9', inqNo: 'INQ-9', state: 'archived', origin: 'salesfile', closeKind: 'lost' }
  ]);
  setData('ptf_crm_rfqs', [{ cd: 'R-9', inqNo: 'INQ-9', st: 'st3' }]);
  setData('ptf_crm_offers', [
    { no: 'CO-9', kind: 'CO', st: 'sent', inqNo: 'INQ-9' },
    { no: 'CO-W', kind: 'CO', st: 'won', inqNo: 'INQ-9' }
  ]);
  var found = sfFindArchivedProject({ inqNo: 'INQ-9', cd: 'D-9' });
  T('find archive by inqNo', !!(found && found.no === 'ARC-INQ-9'));
  var found2 = sfFindArchivedProject({ inqNo: 'R-9', cd: 'R-9' });
  T('find archive via rfq alias', !!(found2 && found2.no === 'ARC-INQ-9'));
  T('not found for other', !sfFindArchivedProject({ inqNo: 'INQ-OTHER' }));
  sfMarkLostRelated({ inqNo: 'INQ-9', cd: 'R-9' });
  var offs = getData('ptf_crm_offers');
  T('non-won offer marked lost', offs.filter(function (o) { return o.no === 'CO-9'; })[0].st === 'lost');
  T('won offer untouched', offs.filter(function (o) { return o.no === 'CO-W'; })[0].st === 'won');
  var rqs = getData('ptf_crm_rfqs');
  T('rfq marked stX', rqs[0].st === 'stX');
}

SECTION('BUG-036 رفتاری — cloudDocs helpers');
eval(arch); // IIFE
T('ptfCloudDocsOf', typeof ptfCloudDocsOf === 'function');
T('ptfPrjHasCloudFiles', typeof ptfPrjHasCloudFiles === 'function');
T('has cloud true', ptfPrjHasCloudFiles({ docs: [{ key: 'k1', name: 'a.pdf' }] }) === true);
T('has cloud false purged', ptfPrjHasCloudFiles({ docs: [{ key: null, purged: true, name: 'a.pdf' }] }) === false);
T('has cloud false empty', ptfPrjHasCloudFiles({ docs: [] }) === false);
T('wizard has meta-only confirm path', arch.indexOf('بایگانی متادیتایی') > -1);

SECTION('رگرسیون سبک');
T('oppo still IIFE closed', /\)\(\);\s*$/.test(oppo.trim()) || oppo.trim().slice(-4).indexOf('();') > -1);
T('sfCloseLost still defined', sf.indexOf('window.sfCloseLost = function') > -1);
T('prjArchiveWizard still defined', arch.indexOf('window.prjArchiveWizard = function') > -1);

DONE('tester127-v211');
if (RESULTS.fail) process.exit(1);
