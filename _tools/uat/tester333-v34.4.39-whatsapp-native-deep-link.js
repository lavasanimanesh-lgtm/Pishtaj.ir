'use strict';
/* Regression: WhatsApp buttons must open the installed app, not a wa.me install tab. */
var fs = require('fs');
var assert = require('assert');

/* Reuse the functional customer/supplier quick-link and prepared-message scenarios. */
require('./tester331-v34.4.37-entity-messenger-quick-links.js');

var src = fs.readFileSync('crm/messengers.js', 'utf8');
assert.ok(src.indexOf("'whatsapp://send?phone=' + n") > -1, 'native WhatsApp custom protocol missing');
assert.ok(src.indexOf("window.location.assign(lnk)") > -1, 'native protocol must navigate in the current user gesture');
assert.ok(src.indexOf("if (appId === 'wa') window.ptfWhatsAppOpen(mob, txt)") > -1, 'message-dialog WhatsApp action must use native opener');
assert.ok(src.indexOf("window.ptfWhatsAppOpen(firstMobile(c), '')") > -1, 'under-phone quick action must use native opener');
assert.strictEqual(src.indexOf('https://wa.me/'), -1, 'messenger buttons must not retain the web/install redirect');

var version = JSON.parse(fs.readFileSync('VERSION.json', 'utf8')).crm_version;
assert.ok(/^v34\.(?:4\.(?:39|[4-9]\d|\d{3,})|[5-9]\.\d+|\d{2,}\.\d+\.\d+)$/.test(version), 'release must retain or advance the v34.4.39 native WhatsApp baseline');
var current = version.slice(1);
['crm/index.html','crm/sw.js','crm/manifest.json','crm/clear-cache.html','crm/shell.js'].forEach(function (file) {
  assert.ok(fs.readFileSync(file, 'utf8').indexOf(current) > -1, file + ' version drift');
});
console.log('PASS tester333-v34.4.39: WhatsApp quick/message buttons open the installed desktop/mobile app without a wa.me tab');
