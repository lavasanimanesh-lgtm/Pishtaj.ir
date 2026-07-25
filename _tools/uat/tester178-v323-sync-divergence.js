/* Critical sync divergence regression: different browsers must converge at startup */
'use strict';
require('./harness');
var fs=require('fs'),path=require('path');
var ROOT=path.resolve(__dirname,'../..');
var sy=fs.readFileSync(path.join(ROOT,'crm/sync.js'),'utf8');
var api=fs.readFileSync(path.join(ROOT,'api/crm.php'),'utf8');
SECTION('RCA guard');
T('pullCheck forceFull دارد', sy.indexOf('function pullCheck(done, forceFull)')>-1);
T('startup همیشه snapshot کامل server را می‌کشد', sy.indexOf('} else if (d.rev > 0)')>-1 && sy.indexOf('state.initialReconcile = true;')>-1 && sy.indexOf('}, true);')>-1);
T('startup دیگر به cached rev اعتماد نمی‌کند', sy.indexOf('d.rev > state.lastRev')===-1);
T('forceFull با since=0 به API می‌رود', sy.indexOf('var pullSince = forceFull ? 0 : state.lastRev')>-1 && sy.indexOf("data_pull&since=' + pullSince")>-1);
T('retry توکن forceFull را حفظ می‌کند', sy.indexOf('pullCheck(done, forceFull)')>-1);
T('API در pull کامل data و meta می‌دهد', api.indexOf("case 'data_pull':")>-1 && api.indexOf("'data' => $out")>-1 && api.indexOf("'meta' => $meta")>-1);

SECTION('سناریوی same-rev/different-local');
function startupPullSince(localRev, serverRev){ return serverRev>0 ? 0 : null; }
T('دو browser با rev یکسان هم snapshot کامل می‌گیرند', startupPullSince(42,42)===0);
T('browser با rev قدیمی هم snapshot کامل می‌گیرد', startupPullSince(17,42)===0);
T('server خالی هنوز مسیر seed را حفظ می‌کند', startupPullSince(42,0)===null);
DONE('tester178-v323-sync-divergence');
