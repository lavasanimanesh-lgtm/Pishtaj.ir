'use strict';
/* Regression: mobile-only Bale/Eitaa/Rubika contacts get an assisted web action. */
var fs = require('fs');
var assert = require('assert');

/* Functional VM scenario covers mobile-only Eitaa fallback, clipboard and URL opening. */
require('./tester331-v34.4.37-entity-messenger-quick-links.js');

var src = fs.readFileSync('crm/messengers.js', 'utf8');
[
  ["id: 'bale'", "web: 'https://web.bale.ai/'", 'c.bale'],
  ["id: 'eitaa'", "web: 'https://web.eitaa.com/'", 'c.eitaa'],
  ["id: 'rubika'", "web: 'https://web.rubika.ir/'", 'c.rubika']
].forEach(function (contract) {
  var appAt = src.indexOf(contract[0]);
  assert.ok(appAt > -1, contract[0] + ' definition missing');
  var end = src.indexOf('\n', appAt);
  var line = src.slice(appAt, end);
  assert.ok(line.indexOf(contract[1]) > -1, contract[0] + ' official web URL missing');
  assert.ok(line.indexOf(contract[2]) > -1 && line.indexOf('digits(c.mob) ? this.web : null') > -1, contract[0] + ' must prefer username and fall back to mobile/web');
});
assert.ok(src.indexOf("['wa', 'tg', 'bale', 'eitaa', 'rubika']") > -1, 'Eitaa must appear under customer/supplier phone along with Bale and Rubika');
assert.ok(src.indexOf('function phoneWebFallback') > -1 && src.indexOf('function copyPhoneForMessengerWeb') > -1, 'shared assisted-web helpers missing');
assert.ok(src.indexOf("return /^98(9\\d{9})$/.test(n) ? ('0' + n.slice(2))") > -1, 'Iranian mobile must be copied in searchable 09xx form');
assert.ok(src.indexOf('if (phoneWebFallback(a, quickCtx)) copyPhoneForMessengerWeb(a, quickCtx.mob)') > -1, 'quick action must copy phone before opening messenger web');
assert.ok(src.indexOf("Paste کنید") > -1, 'user must receive explicit search/add-contact guidance');

var version = JSON.parse(fs.readFileSync('VERSION.json', 'utf8')).crm_version;
assert.strictEqual(version, 'v34.4.40');
['crm/index.html','crm/sw.js','crm/manifest.json','crm/clear-cache.html','crm/shell.js'].forEach(function (file) {
  assert.ok(fs.readFileSync(file, 'utf8').indexOf('34.4.40') > -1, file + ' version drift');
});
console.log('PASS tester334-v34.4.40: Bale, Eitaa and Rubika mobile-only actions copy the number and open each official web client');
