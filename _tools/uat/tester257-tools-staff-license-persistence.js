/* tester257 — v31.7.97 (TOOLS-STAFF-LICENSE-PERSISTENCE-001)
 * Staff/internal license grants persist across browser sessions and remain quota-exempt.
 */
require('./harness');
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var api = fs.readFileSync(path.join(ROOT, 'api/tools.php'), 'utf-8');
var ui = fs.readFileSync(path.join(ROOT, 'tools/tools-ui.js'), 'utf-8');
var idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(ROOT, 'crm/sw.js'), 'utf-8');

SECTION('Server staff/internal grant policy');
T('نسخه TOOLS-STAFF-LICENSE-PERSISTENCE-001 ثبت شده است', api.indexOf('TOOLS-STAFF-LICENSE-PERSISTENCE-001') > -1 || ui.indexOf('TOOLS-STAFF-LICENSE-PERSISTENCE-001') > -1);
T('server grant TTL نوع staff_internal را ۳۰ روزه می‌کند', api.indexOf('function tools_grant_ttl_seconds') > -1 && api.indexOf("$type === 'staff_internal'") > -1 && api.indexOf('30 * 24 * 3600') > -1);
T('enterprise/subscription هم grant پایدارتر از تک‌گزارش دارند', api.indexOf("$type === 'enterprise' || $type === 'subscription'") > -1 && api.indexOf('7 * 24 * 3600') > -1);
T('grantPayload پرچم persistent و ttl دارد', api.indexOf("'ttl' => $ttl") > -1 && api.indexOf("'persistent' => in_array") > -1);
T('license_check برای staff_internal quota_exhausted نمی‌دهد', api.indexOf("$quotaExempt = ($licenseType === 'staff_internal')") > -1 && api.indexOf('!$quotaExempt && isset($match') > -1);
T('safe license quotaExempt/grantTtlSeconds برمی‌گرداند', api.indexOf("'quotaExempt' => (($lic['type'] ?? '') === 'staff_internal')") > -1 && api.indexOf("'grantTtlSeconds' => tools_grant_ttl_seconds") > -1);
T('tools API status v33.4.9 است', /'version' => 'v3[0-9.]+'/.test(api));

SECTION('Client persistent grant storage');
T('tools-ui persistent localStorage key دارد', ui.indexOf('GRANT_PERSIST_KEY') > -1 && ui.indexOf("GRANT_KEY + '_persist'") > -1);
T('ptfToolsGrant ابتدا session و بعد localStorage persist را می‌خواند', ui.indexOf('ptfToolsReadStoredGrant(sessionStorage') > -1 && ui.indexOf('ptfToolsReadStoredGrant(localStorage') > -1 && ui.indexOf('sessionStorage.setItem(GRANT_KEY, JSON.stringify(pg))') > -1);
T('ptfToolsStoreGrant برای staff/enterprise/subscription در localStorage ذخیره می‌کند', ui.indexOf("['staff_internal','enterprise','subscription']") > -1 && ui.indexOf('localStorage.setItem(GRANT_PERSIST_KEY') > -1);
T('grant_verify برای پاک‌سازی grant نامعتبر وجود دارد', ui.indexOf('ptfToolsVerifyStoredGrant') > -1 && ui.indexOf('action=grant_verify') > -1 && ui.indexOf('ptfToolsClearStoredGrant') > -1);
T('advanced-report-ui fallback persistent grant دارد', fs.readFileSync(path.join(ROOT, 'tools/advanced-report-ui.js'), 'utf-8').indexOf('GRANT_PERSIST_KEY') > -1);
T('CRM/SW نسخه v33.4.9 است', /window\.VER = 'v3[0-9.]+'/.test(idx) && /ptf-crm-v3[0-9.]+/.test(sw));

SECTION('Runtime localStorage restore');
function Storage(){ this.s = {}; }
Storage.prototype.getItem = function(k){ return Object.prototype.hasOwnProperty.call(this.s,k) ? this.s[k] : null; };
Storage.prototype.setItem = function(k,v){ this.s[k] = String(v); };
Storage.prototype.removeItem = function(k){ delete this.s[k]; };
function el(){ return { style:{}, className:'', textContent:'', value:'', disabled:false, selectedOptions:[{text:'مایع'}], appendChild:function(){}, querySelectorAll:function(){ return []; }, innerHTML:'', onclick:null, onchange:null }; }
var els = { ttabs: el(), tbody: el(), calcBtn: el(), pdfBtn: el(), tres: el() };
var session = new Storage(), local = new Storage();
var future = Math.floor(Date.now()/1000) + 86400;
local.setItem('ptf_tools_license_grant_persist', JSON.stringify({ grant:'G.STAFF', grantPayload:{ licenseId:'LIC-STAFF', tool:'control_valve_advanced', type:'staff_internal', exp:future, persistent:true }, license:{ type:'staff_internal' } }));
var sandbox = {
  console: console,
  window: null,
  Date: Date,
  setTimeout: function(fn){ if (typeof fn === 'function') fn(); },
  encodeURIComponent: encodeURIComponent,
  alert: function(){},
  fetch: function(){ return Promise.resolve({ json: function(){ return Promise.resolve({ ok:true }); } }); },
  sessionStorage: session,
  localStorage: local,
  document: { getElementById: function(id){ if (!els[id]) els[id] = el(); return els[id]; }, createElement: function(){ return el(); }, body: { insertAdjacentHTML: function(){} } },
  PTF_TOOLS: { PIPE:{ '1':{ OD:33.4, S40:[3.4] } }, MAT_LB:{ cs:'CS' }, sizeCv:function(){ return { Cv:1, Kv:1, size:'1', warns:[], ref:'ref' }; }, sizeOnOff:function(){}, sizePRV:function(){}, pipePressure:function(){}, trackTable:function(){ return []; }, pipeWeight:function(){ return { total:1 }; }, flangeWeight:function(){ return { total:1 }; }, elbowWeight:function(){ return { total:1 }; } }
};
sandbox.window = sandbox;
vm.runInNewContext(ui, sandbox, { filename: 'tools-ui.js' });
T('runtime: persistent staff grant از localStorage بازیابی می‌شود', sandbox.ptfToolsHasGrant('control_valve_advanced') === true && !!session.getItem('ptf_tools_license_grant'));

DONE('tester257-tools-staff-license-persistence');
