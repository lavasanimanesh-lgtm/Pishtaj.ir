/* Stage 0 / Sprint 1 static evidence only.
   This reads source files and never opens a network connection or mutates data. */
'use strict';
var fs = require('fs'), assert = require('assert');
var idx = fs.readFileSync('crm/index.html', 'utf8');
var sync = fs.readFileSync('crm/sync.js', 'utf8');
var api = fs.readFileSync('api/crm.php', 'utf8');

function section(name, ok) {
  assert.ok(ok, name);
  console.log('PASS:', name);
}

section('Client login writes roleId to localStorage session',
  idx.indexOf("localStorage.setItem('ptf_crm_session'") > -1 && idx.indexOf('roleId:') > -1);
section('Sync sends client-derived X-CRM-Role header',
  sync.indexOf("'X-CRM-Role': curRole()") > -1);
section('Server reads client role from HTTP header',
  api.indexOf("$client_role = $_SERVER['HTTP_X_CRM_ROLE']") > -1);
section('verify_request source contains no active token comparison enforcement',
  api.indexOf('// if ($token !== $expected)') > -1 && api.indexOf('return true;') > -1);
var push = api.slice(api.indexOf("case 'data_push':"), api.indexOf("case 'data_pull':"));
section('data_push allowlists financial keys',
  push.indexOf("'ptf_crm_supplier_finance'") > -1 && push.indexOf("'ptf_crm_cheques'") > -1 && push.indexOf("'ptf_crm_fiscal_snapshots'") > -1);
section('data_push source has no role_guard invocation', push.indexOf('role_guard(') === -1);
console.log('RESULT: static source evidence supports staging PoC; no live exploit was executed.');
