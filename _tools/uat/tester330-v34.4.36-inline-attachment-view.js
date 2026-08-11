'use strict';
/* Regression: uploaded image/PDF must render inline instead of application/octet-stream
   download/OS save picker. Covers new uploads and legacy objects. */
var fs = require('fs');
var vm = require('vm');
var assert = require('assert');

var client = fs.readFileSync('crm/storage.js', 'utf8');
var api = fs.readFileSync('api/storage.php', 'utf8');
var readApi = fs.readFileSync('api/attachment-read.php', 'utf8');

/* Server contracts: upload metadata + legacy GET response override. */
assert.ok(api.indexOf('function storage_content_type') > -1, 'storage API must derive MIME from safe extension');
assert.ok(api.indexOf("'response-content-type' => $contentType") > -1, 'presigned GET must override legacy object MIME');
assert.ok(api.indexOf("'response-content-disposition' => $disposition") > -1, 'presigned GET must force inline/attachment explicitly');
assert.ok(api.indexOf('"Content-Type: $contentType"') > -1, 'proxy PUT must persist Content-Type metadata');
assert.ok(api.indexOf('"Content-Disposition: inline"') > -1, 'proxy PUT must persist inline disposition');

/* Browser direct PUT must persist the same metadata. */
assert.ok(client.indexOf("setRequestHeader('Content-Type'") > -1, 'direct PUT must send Content-Type');
assert.ok(client.indexOf("setRequestHeader('Content-Disposition', 'inline')") > -1, 'direct PUT must send inline disposition');
assert.ok(client.indexOf("disposition: 'inline'") > -1, 'viewer presign request must ask for inline response');
assert.ok(client.indexOf("disposition: 'attachment'") > -1, 'download action must ask for attachment response');

/* Same-origin authenticated binary proxy is the primary viewer path. */
assert.ok(readApi.indexOf("if ($mode === 'inline')") > -1, 'attachment-read must expose inline binary mode');
assert.ok(readApi.indexOf("header('Content-Type: ' . $mime)") > -1, 'inline response must have a correct MIME');
assert.ok(readApi.indexOf("header('Content-Disposition: inline')") > -1, 'inline response must not trigger Save As');
assert.ok(readApi.indexOf("'svg'=>'image/svg+xml'") === -1, 'active SVG must not be served inline from the application origin');
assert.ok(client.indexOf("fetch('../api/attachment-read.php'") > -1 && client.indexOf("mode: 'inline'") > -1, 'viewer must fetch authenticated same-origin binary');
assert.ok(client.indexOf('URL.createObjectURL(blob)') > -1, 'viewer must render a Blob URL instead of raw octet-stream URL');
assert.ok(client.indexOf('URL.revokeObjectURL') > -1, 'viewer must release Blob URLs');

/* Functional unit for the extracted client inline loader. */
var extStart = client.indexOf('function ptfFileExt');
var extEnd = client.indexOf('\n}', extStart) + 2;
var fnStart = client.indexOf('function ptfInlineStoredFileUrl');
var fnEnd = client.indexOf('\n}', fnStart) + 2;
assert.ok(extStart > -1 && fnStart > -1, 'inline loader functions must exist');
var calls = [];
var ctx = {
  Promise: Promise, Error: Error, JSON: JSON,
  ptfStorageAuthHeaders: function () { return { 'X-CRM-Token': 'test' }; },
  fetch: function (url, opts) {
    calls.push({ url: url, opts: opts });
    return Promise.resolve({ ok: true, blob: function () { return Promise.resolve({ type: 'image/webp', size: 10 }); } });
  },
  URL: { createObjectURL: function (blob) { return 'blob:test-' + blob.type; } }
};
vm.createContext(ctx);
vm.runInContext(client.slice(extStart, extEnd) + '\n' + client.slice(fnStart, fnEnd), ctx);
ctx.ptfInlineStoredFileUrl('cheques/2026-08/sample.webp', 'sample.webp').then(function (url) {
  assert.strictEqual(url, 'blob:test-image/webp');
  assert.strictEqual(calls.length, 1);
  assert.ok(calls[0].url.indexOf('attachment-read.php') > -1);
  var body = JSON.parse(calls[0].opts.body);
  assert.strictEqual(body.mode, 'inline');
  assert.strictEqual(body.key, 'cheques/2026-08/sample.webp');

  var version = JSON.parse(fs.readFileSync('VERSION.json', 'utf8')).crm_version;
  assert.strictEqual(version, 'v34.4.36');
  ['crm/index.html','crm/sw.js','crm/manifest.json','crm/clear-cache.html','crm/shell.js'].forEach(function (file) {
    assert.ok(fs.readFileSync(file, 'utf8').indexOf('34.4.36') > -1, file + ' version drift');
  });
  console.log('PASS tester330-v34.4.36-inline-attachment-view: MIME metadata, legacy response override, authenticated Blob viewer, inline tab, version hygiene');
}).catch(function (err) {
  console.error(err && err.stack || err);
  process.exit(1);
});
