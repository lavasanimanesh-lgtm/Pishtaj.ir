/* tester277 — v33.5.0 SEC-AUTH-SESSION-001
   Contract guards for token reuse, single-flight refresh and bounded retry. */
require('./harness');
var fs=require('fs'), path=require('path');
var ROOT=path.resolve(__dirname,'../..');
var idx=fs.readFileSync(path.join(ROOT,'crm/index.html'),'utf8');
var sync=fs.readFileSync(path.join(ROOT,'crm/sync.js'),'utf8');
var auth=fs.readFileSync(path.join(ROOT,'api/auth.php'),'utf8');
SECTION('v33.5.0 token-session stabilization');
var show=idx.slice(idx.indexOf('function showCrm()'), idx.indexOf('function hideCrm()', idx.indexOf('function showCrm()')));
T('showCrm بدون توکن فوراً ورود مجدد صریح می‌خواهد (بدون auth_login خاموش)', show.indexOf("localStorage.getItem('ptf_crm_token')") > -1 && show.indexOf('ptfInvalidateSession') > -1 && show.indexOf('action=auth_login') === -1);
T('refresh در هر تب coalesce و سقف تلاش دارد (الگوی authWait)', sync.indexOf('state.authWait = (state.authWait || 0) + 1;') > -1 && sync.indexOf('if (state.authWait > 3)') > -1 && sync.indexOf('state.authWait > 30') === -1);
T('retry refresh حداکثر سه بار است', sync.indexOf('if (state.authWait > 3)') > -1 && sync.indexOf('state.authWait > 30') === -1);
T('قرارداد header token حفظ شده است', sync.indexOf("h['X-CRM-Token'] = t") > -1);
T('بارگذاری token map هنوز file-based است (بدهی معلق P2: گذر به DB)', auth.indexOf('auth_load_tokens()') > -1 || auth.indexOf('auth_tokens_file()') > -1);
T('فرمت و عمر session تغییر نکرده است', /\$exp\s*=\s*\$now\s*\+\s*86400\s*\*\s*7/.test(auth) && auth.indexOf("'X-CRM-Token'") > -1);
DONE('tester277-auth-token-session-stabilization');
