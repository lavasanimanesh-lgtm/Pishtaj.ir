#!/usr/bin/env node
'use strict';
/* v34.7.40 — line-stable, duplicate-sensitive architecture baseline.
   Protected GitHub workflow changes are intentionally not asserted here: the
   Arena GitHub App cannot publish .github/workflows without Workflows write
   permission. The existing arena/** staging workflow remains automatic. */
var fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process'),assert=require('assert');
var ROOT=path.resolve(__dirname,'../..');
function read(p){return fs.readFileSync(path.join(ROOT,p),'utf8');}

var guard=path.join(ROOT,'_tools/arch/arch-guard.js');
var self=cp.spawnSync(process.execPath,[guard,'--self-test'],{cwd:ROOT,encoding:'utf8'});
assert.strictEqual(self.status,0,(self.stdout||'')+(self.stderr||''));
var current=cp.spawnSync(process.execPath,[guard,'--quiet'],{cwd:ROOT,encoding:'utf8'});
assert.strictEqual(current.status,0,(current.stdout||'')+(current.stderr||''));
var guardSrc=read('_tools/arch/arch-guard.js'),baseline=JSON.parse(read('_tools/arch/arch-baseline.json'));
assert.ok(guardSrc.indexOf('function sourceSignature')>-1&&guardSrc.indexOf('function multisetDiff')>-1,'guard uses content signatures and duplicate-sensitive comparison');
assert.strictEqual(baseline.signatureFormat,'source-sha256-12-v2');
assert.strictEqual(baseline.rules.A2.length,0,'A2 debt swap must be fixed, not accepted into the migrated baseline');
assert.ok(read('crm/customer-finance.js').indexOf("cfMergeOwnerFiles(i.files, 'invoice', i._id || i.cd)")>-1,'invoice attachment owner follows canonical _id || cd order');

/* End-to-end: shifting an existing A3 finding must remain green, while adding a
   second byte-identical finding must fail. This catches indexOf/set regressions. */
var tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ptf-arch443-'));
try {
  fs.mkdirSync(path.join(tmp,'_tools'),{recursive:true});
  fs.cpSync(path.join(ROOT,'_tools/arch'),path.join(tmp,'_tools/arch'),{recursive:true});
  fs.cpSync(path.join(ROOT,'crm'),path.join(tmp,'crm'),{recursive:true});
  fs.cpSync(path.join(ROOT,'api'),path.join(tmp,'api'),{recursive:true});
  fs.copyFileSync(path.join(ROOT,'VERSION.json'),path.join(tmp,'VERSION.json'));
  var target=path.join(tmp,'crm/archive.js'),src=fs.readFileSync(target,'utf8');
  var match=src.match(/^.*return\s+x\.no\s*===\s*\w+;.*$/m);
  assert.ok(match,'A3 fixture line exists');
  fs.writeFileSync(target,src.replace(match[0],'\n\n'+match[0]));
  var shifted=cp.spawnSync(process.execPath,[path.join(tmp,'_tools/arch/arch-guard.js'),'--quiet'],{cwd:tmp,encoding:'utf8'});
  assert.strictEqual(shifted.status,0,'line shift changed the architecture identity:\n'+shifted.stdout+shifted.stderr);
  src=fs.readFileSync(target,'utf8');
  fs.writeFileSync(target,src.replace(match[0],match[0]+'\n'+match[0]));
  var duplicated=cp.spawnSync(process.execPath,[path.join(tmp,'_tools/arch/arch-guard.js'),'--quiet'],{cwd:tmp,encoding:'utf8'});
  assert.notStrictEqual(duplicated.status,0,'multiset comparison accepted a duplicate signature');
  assert.ok(/❌ A3: archive\.js/.test(duplicated.stdout)&&/ARCH GUARD: FAIL/.test(duplicated.stdout),'duplicate signature was not reported as a new blocking A3 finding:\n'+duplicated.stdout+duplicated.stderr);
} finally { fs.rmSync(tmp,{recursive:true,force:true}); }

assert.strictEqual((read('crm/rbac.js').match(/window\.ptfSetInvoiceDue\s*=\s*function/g)||[]).length,1,'invoice due-date action has one owner');

var v=JSON.parse(read('VERSION.json')).crm_version.slice(1),idx=read('crm/index.html'),sw=read('crm/sw.js');
var q=Array.from(idx.matchAll(/<script[^>]+src="[^"]+\.js\?v=([^"]+)"/g)).map(function(m){return m[1];});
assert.ok(q.length>90&&q.every(function(x){return x.split('&')[0]===v;}),'release cache keys are aligned');
assert.ok(sw.indexOf("ASSET_VERSION = '"+v+"'")>-1,'service worker uses the release version');
console.log('PASS tester443-v34.7.40: stable duplicate-sensitive architecture guard');
