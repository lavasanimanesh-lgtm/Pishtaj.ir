/* tester277 — v33.4.7 SEC-AUTH-SESSION-001
   Contract guards for token reuse, single-flight refresh and bounded retry. */
require('./harness');
var fs=require('fs'), path=require('path');
var ROOT=path.resolve(__dirname,'../..');
var idx=fs.readFileSync(path.join(ROOT,'crm/index.html'),'utf8');
var sync=fs.readFileSync(path.join(ROOT,'crm/sync.js'),'utf8');
var auth=fs.readFileSync(path.join(ROOT,'api/auth.php'),'utf8');
SECTION('v33.4.7 token-session stabilization');
var show=idx.slice(idx.indexOf('function showCrm()'), idx.indexOf('function hideCrm()', idx.indexOf('function showCrm()')));
T('showCrm token موجود را قبل از auth_login reuse می‌کند', show.indexOf("localStorage.getItem('ptf_crm_token')") > -1 && show.indexOf("localStorage.getItem('ptf_crm_token')") < show.indexOf("action=auth_login"));
T('sync refresh single-flight است', sync.indexOf('state.authRefreshing') > -1 && sync.indexOf('state.authRefreshWaiters') > -1 && sync.indexOf('function finish(ok)') > -1);
T('retry refresh حداکثر سه بار است', sync.indexOf('if (state.authWait > 3)') > -1 && sync.indexOf('state.authWait > 30') === -1);
T('قرارداد header token حفظ شده است', sync.indexOf("h['X-CRM-Token'] = t") > -1);
T('token map در هر درخواست PHP cache می‌شود', auth.indexOf('static $loaded = false') > -1 && auth.indexOf('static $cache = []') > -1 && auth.indexOf('if ($loaded) return $cache') > -1);
T('فرمت و عمر session تغییر نکرده است', auth.indexOf('$exp=$now+86400*7') > -1 && auth.indexOf("'X-CRM-Token'") > -1);
DONE('tester277-auth-token-session-stabilization');
