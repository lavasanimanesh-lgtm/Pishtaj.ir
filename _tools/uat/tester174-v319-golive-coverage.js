/* Sprint v31.6.19 — Go-Live reset coverage for newly added transactional keys */
'use strict';
require('./harness');
var fs=require('fs'),path=require('path');
var ROOT=path.resolve(__dirname,'../..');
var gl=fs.readFileSync(path.join(ROOT,'crm/golive.js'),'utf8');
function list(decl){
  var m=gl.match(new RegExp('var '+decl+'\\s*=\\s*\\[([\\s\\S]*?)\\];'));
  return m?(m[1].match(/'([^']+)'/g)||[]).map(function(x){return x.slice(1,-1);}):[];
}
var wipe=list('WIPE_KEYS');
var protectedKeys=['ptf_crm_users','ptf_crm_perms','ptf_crm_settings','ptf_crm_sigprofiles','ptf_crm_msgtpls','ptf_crm_notifprefs','ptf_crm_avatars'];
SECTION('قرارداد Go-Live reset');
T('مازاد پروژه در wipe تراکنشی است', wipe.indexOf('ptf_crm_surplus')>-1);
T('payables در wipe تراکنشی است', wipe.indexOf('ptf_crm_payables')>-1);
T('کلیدهای حفاظت‌شده اشتباهاً wipe نمی‌شوند', protectedKeys.every(function(k){return wipe.indexOf(k)<0;}));
T('WIPE_KEYS کلید تکراری ندارد', new Set(wipe).size===wipe.length);
T('pre-golive backup همان WIPE_KEYS را شامل می‌کند', gl.indexOf('WIPE_KEYS.concat')>-1 && gl.indexOf("'ptf_crm_users', 'ptf_crm_settings'")>-1);
T('wipe سروری با allow_wipe و backup پیشینی محافظت شده', gl.indexOf('allow_wipe: true')>-1 && gl.indexOf('ptfBackupDownload')>-1 && gl.indexOf('window._ptfGoLiveWipe = true')>-1);
DONE('tester174-v319-golive-coverage');
