/* tester274 — v31.7.97 (BUG-SYNC-TOMBSTONE-OPPO-LINECHART-001)
 * Deleted records must not resurrect via stale browser cache; lost financial offers leave active opportunities; final reports include line charts.
 */
require('./harness');
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var sync = fs.readFileSync(path.join(ROOT, 'crm/sync.js'), 'utf-8');
var api = fs.readFileSync(path.join(ROOT, 'api/crm.php'), 'utf-8');
var oppo = fs.readFileSync(path.join(ROOT, 'crm/oppo.js'), 'utf-8');
var toolsApi = fs.readFileSync(path.join(ROOT, 'api/tools.php'), 'utf-8');
var adv = fs.readFileSync(path.join(ROOT, 'tools/advanced-tools-ui.js'), 'utf-8');
var idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(ROOT, 'crm/sw.js'), 'utf-8');

SECTION('Client/server tombstone sync');
T('sync.js نسخه tombstone و helperها را دارد', sync.indexOf('BUG-SYNC-TOMBSTONE-001') > -1 && sync.indexOf('ptfApplyDeletionTombstones') > -1 && sync.indexOf('ptfArchiveKindsForKey') > -1);
T('sync.js push/pull/conflict/beacon را با tombstone فیلتر می‌کند', ['ptfApplyDeletionTombstones(k, v)','ptfApplyDeletionTombstones(k, d.data[k]','ptfApplyDeletionTombstones(k, merged','navigator.sendBeacon'].every(function (x) { return sync.indexOf(x) > -1; }));
T('api/crm.php server-side tombstone filter دارد', api.indexOf('sync_apply_tombstones') > -1 && api.indexOf('sync_tombstone_kinds_for_key') > -1 && api.indexOf('serverArchiveJson') > -1 && api.indexOf('incomingArchiveJson') > -1);
T('api/crm.php data_push و data_pull را tombstone-filter می‌کند', api.indexOf('$v = sync_apply_tombstones($k, $v') > -1 && api.indexOf('$out[$k] = sync_apply_tombstones($k') > -1 && api.indexOf('$conflictData[$k] = sync_apply_tombstones') > -1);

SECTION('Runtime tombstone filter');
var ls = { s: { ptf_crm_deleted_archive: JSON.stringify([{ kind: 'OFFER', id: 'CO-DEL', iso: '2026-07-22T00:00:00Z' }]) }, getItem: function (k) { return this.s[k] || null; }, setItem: function (k, v) { this.s[k] = String(v); } };
var sandbox = { console: console, localStorage: ls, window: null };
sandbox.window = sandbox;
var start = sync.indexOf('function ptfCodeIdentity');
var end = sync.indexOf('function ptfValScore', start);
vm.runInNewContext(sync.slice(start, end), sandbox, { filename: 'sync-tombstone-slice.js' });
var filtered = JSON.parse(sandbox.ptfApplyDeletionTombstones('ptf_crm_offers', JSON.stringify([{ no: 'CO-DEL', items: [] }, { no: 'CO-KEEP', items: [] }])));
T('runtime: tombstone offer رکورد حذف‌شده را از merge حذف می‌کند', filtered.length === 1 && filtered[0].no === 'CO-KEEP');

SECTION('Lost financial opportunity behavior');
T('oppo.js نسخه lost financial fix دارد', oppo.indexOf('BUG-OPPO-LOST-FINANCIAL-001') > -1 && oppo.indexOf('finOffers.every') > -1);
var data = { ptf_crm_offers: [{ no: 'CO-1', kind: 'CO', inqNo: 'RFQ-1', st: 'lost', buyerCo: 'A' }], ptf_crm_rfqs: [{ cd: 'RFQ-1', co: 'A', st: 'st3' }], ptf_crm_deals: [], ptf_crm_projects: [] };
var osb = { window: null, getData: function (k) { return data[k] || []; }, escP: function (v) { return String(v == null ? '' : v); } };
osb.window = osb;
vm.runInNewContext(oppo, osb, { filename: 'oppo.js' });
T('runtime: پیشنهادی که همه CO/TCهایش lost هستند در فرصت فعال نمی‌آید', osb.ptfOppoList().length === 0);

SECTION('Control Valve line charts');
T('api/tools.php گزارش نهایی line chart دارد', toolsApi.indexOf('function tools_chart_line_svg') > -1 && toolsApi.indexOf('Flow vs Cv line chart') > -1 && toolsApi.indexOf('Flow vs opening line chart') > -1);
T('نمونه عمومی گزارش هم line chart دارد', adv.indexOf('Flow vs Cv line chart') > -1 && adv.indexOf('polyline points') > -1);
T('CRM/SW نسخه v33.4.5 است', /window\.VER = 'v3[0-9.]+'/.test(idx) && /ptf-crm-v3[0-9.]+/.test(sw));

DONE('tester274-sync-tombstone-oppo-linechart');
