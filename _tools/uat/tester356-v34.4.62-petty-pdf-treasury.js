#!/usr/bin/env node
var fs = require('fs');
var path = require('path');
var root = path.join(__dirname, '../..');
function read(p) { return fs.readFileSync(path.join(root, p), 'utf8'); }
function fail(m) { console.log('FAIL ' + m); process.exit(1); }
var petty = read('crm/petty.js');
var treas = read('crm/treasury.js');
var hub = read('crm/financehub.js');
var ver = JSON.parse(read('VERSION.json'));
if (ver.crm_version !== 'v34.4.65') fail('VERSION ' + ver.crm_version);
if (petty.indexOf("mode: 'base64'") < 0 && petty.indexOf('mode: "base64"') < 0) fail('petty resolve base64');
if (petty.indexOf('size:A4 landscape') < 0) fail('landscape print');
if (petty.indexOf('table-layout:fixed') < 0) fail('fixed table');
if (treas.indexOf('sfRaw.payments') < 0) fail('supplier payments object');
if (treas.indexOf('ptfTrPdfInp') < 0) fail('pdf import button');
if (hub.indexOf("'treasuryBox'") < 0) fail('hub order treasuryBox');
console.log('PASS tester356 petty-pdf-treasury');
