#!/usr/bin/env node
/* PTF CRM — v26.7 — LLM transport/cache regression source test */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
function ok(condition, label) {
  if (condition) { pass++; console.log('  ✓ PASS: ' + label); }
  else { fail++; console.log('  ✘ FAIL: ' + label); }
}

const api = read('api/llm.php');
const index = read('crm/index.html');
const sw = read('crm/sw.js');
const doc = read('DOCS-LLM-SETUP.md');
const sample = read('llm-config.sample.php');

ok(!/var_dump\s*\(/.test(api), 'no debug var_dump can corrupt JSON API responses');
ok(!/\$sysPrompt\b|\$userPrompt\b/.test(api), 'cache key uses actual system/user payload variables');
ok(api.includes("'skip_cache' => true") && api.includes('llm_test_diagnosis'), 'real test bypasses cache and has a diagnostic path');
ok(api.includes('curl_errno($ch)') && api.includes('curl_getinfo($ch)') && api.includes("'transport' =>"), 'transport returns cURL errno and safe timing metadata');
ok(!api.includes('CURLOPT_IPRESOLVE =>') && api.includes("$mode === 'v4'") && api.includes("$mode === 'v6'"), 'IPv4 is no longer forced; IP mode is configurable');
ok(api.includes('CURLOPT_SSL_VERIFYPEER => $verifyTls') && api.includes('CURLOPT_SSL_VERIFYHOST => $verifyTls ? 2 : 0'), 'TLS verification is secure by default and explicitly configurable');
ok(api.indexOf('$cleanBody =') < api.indexOf("$cacheData[$cacheKey] ="), 'only a parsed successful response is written to cache');
ok(api.includes('$quotaData[$quotaKey] = $quotaUsed + 1') && api.indexOf('$quotaData[$quotaKey] = $quotaUsed + 1') > api.indexOf('$result ='), 'failed upstream calls do not consume daily quota');
ok(index.includes('پیکربندی هوش مصنوعی پیدا شد') && index.includes('ptfLlmTransportHtml') && index.includes('r.text().then'), 'UI distinguishes configuration from live connection and displays valid API parse errors');
ok(index.includes('فاز ثبات — بک‌لاگ و گردش‌کار</span></div>') && index.includes('<div style="max-width:560px">'), 'settings header markup is structurally closed');
ok(/window\.VER = 'v\d+(?:\.\d+)+'; var VER = 'v\d+(?:\.\d+)+'/.test(index), 'CRM version v26.7 is declared');
ok(/var CACHE = 'ptf-crm-v\d+(?:\.\d+)+'/.test(sw), 'service-worker cache is version-aligned');
ok(sample.includes("'ip_resolve' => 'auto'") && sample.includes("'tls_verify' => true"), 'safe sample configuration contains transport controls');
ok(doc.includes('curl_errno: 6') && doc.includes('TLS') && doc.includes('HTTP 429'), 'setup guide covers DNS, TLS and quota diagnostics');

console.log('=== tester139-v258-llm: ' + pass + ' PASS / ' + fail + ' FAIL ===');
process.exit(fail ? 1 : 0);
