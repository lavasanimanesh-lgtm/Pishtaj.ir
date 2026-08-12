'use strict';
var fs = require('fs');
var assert = require('assert');
var pro = fs.readFileSync('crm/offers-pro.js', 'utf8');
assert.ok(pro.indexOf('function () {\n    var fr = document.getElementById(\'ptfPrintFrame\')') > -1 || pro.indexOf('ptfSharePreviewToMessenger') > -1, 'share helper');
assert.ok(pro.indexOf("previewAction('share'") > -1, 'share button on preview');
assert.ok(pro.indexOf('navigator.share') > -1 && pro.indexOf('canShare') > -1, 'web share files');
console.log('PASS tester391 share-preview-msg');
