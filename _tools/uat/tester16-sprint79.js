/* tester16 — اسپرینت ۷۹ (سینک) — بازساخت کوچک */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var sy = fs.readFileSync(path.join(BASE, 'sync.js'), 'utf-8');
SECTION('US-Sync');
T('SYNC_KEYS شامل petty/perms', sy.indexOf('ptf_crm_petty') > -1 && sy.indexOf('ptf_crm_perms') > -1);
T('data_push در api', fs.readFileSync(path.resolve(__dirname, '../../api/crm.php'), 'utf-8').indexOf('data_push') > -1);
T('sendBeacon', sy.indexOf('sendBeacon') > -1);
DONE('TESTER-16 (Sprint79 Sync)');
