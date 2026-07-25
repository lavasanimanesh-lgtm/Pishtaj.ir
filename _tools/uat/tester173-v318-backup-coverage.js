/* Sprint v31.6.18 — backup/sync/API key coverage contract */
'use strict';
require('./harness');
var fs=require('fs'),path=require('path');
var ROOT=path.resolve(__dirname,'../..');
var bk=fs.readFileSync(path.join(ROOT,'crm/backup.js'),'utf8');
var sy=fs.readFileSync(path.join(ROOT,'crm/sync.js'),'utf8');
var api=fs.readFileSync(path.join(ROOT,'api/crm.php'),'utf8');
function list(code,decl){
  var re=new RegExp('(?:var|\\$)\\s*'+decl+'\\s*=\\s*\\[([\\s\\S]*?)\\];');
  var m=code.match(re); return m?(m[1].match(/'([^']+)'/g)||[]).map(function(x){return x.slice(1,-1);}):[];
}
var b=list(bk,'DATA_KEYS'), s=list(sy,'SYNC_KEYS');
var am=api.match(/\$allowed_keys\s*=\s*\[([\s\S]*?)\];/), a=am?(am[1].match(/'([^']+)'/g)||[]).map(function(x){return x.slice(1,-1);}):[];
if(!a.length){ var sm=api.match(/function sync_all_keys\(\)\s*\{[\s\S]*?return\s*\[([\s\S]*?)\];/); a=sm?(sm[1].match(/'([^']+)'/g)||[]).map(function(x){return x.slice(1,-1);}):[]; }
SECTION('قرارداد پوشش کلیدها');
T('ptf_crm_trash در backup است', b.indexOf('ptf_crm_trash')>-1);
T('ptf_crm_trash در sync و API whitelist است', s.indexOf('ptf_crm_trash')>-1 && (a.indexOf('ptf_crm_trash')>-1 || api.indexOf('function sync_all_keys')>-1 && api.indexOf('ptf_crm_trash')>-1));
T('هیچ کلید sync از backup جا نمانده', s.every(function(k){return b.indexOf(k)>-1;}));
T('هیچ کلید API از sync جا نمانده', a.filter(function(k){return /^ptf_crm_/.test(k);}).every(function(k){return s.indexOf(k)>-1 || b.indexOf(k)>-1;}));
T('DATA_KEYS کلید تکراری ندارد', new Set(b).size===b.length);
T('restore همان DATA_KEYS را مصرف می‌کند', bk.indexOf('DATA_KEYS.forEach(function (k) { localStorage.removeItem(k); })')>-1 && bk.indexOf('DATA_KEYS.indexOf(k) > -1')>-1);
DONE('tester173-v318-backup-coverage');
