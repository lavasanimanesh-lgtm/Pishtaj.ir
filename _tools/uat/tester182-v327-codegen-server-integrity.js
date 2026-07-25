/* Critical codegen integrity: official offer numbers must be server-reserved */
'use strict';
require('./harness');
var fs=require('fs'),path=require('path');
var ROOT=path.resolve(__dirname,'../..');
var cg=fs.readFileSync(path.join(ROOT,'crm/codegen.js'),'utf8');
var php=fs.readFileSync(path.join(ROOT,'api/codegen.php'),'utf8');
var of=fs.readFileSync(path.join(ROOT,'crm/offers.js'),'utf8');
SECTION('RCA/official reservation');
T('server counters existing offers را اسکن می‌کند (v31.7.24: هر دو مسیر data و sync)', php.indexOf("$data_dir.'/ptf_crm_offers.json'")>-1 && php.indexOf("$data_dir.'/sync/ptf_crm_offers.json'")>-1 && php.indexOf("/^PTF-(TO|CO|TC)-")>-1 && php.indexOf('$counters[\'yearSeq\']')>-1);
var offerSerialBlock=(of.match(/function offerSerial\(kind\) \{[\s\S]*?\n\}/)||[''])[0];
T('offerSerial دیگر local max scan نیست', offerSerialBlock.indexOf('window.ptfUnifiedCode(k)')>-1 && offerSerialBlock.indexOf("getData('ptf_crm_offers')")===-1);
// v31.7.3 BUG-AUDIT-002: server-only prefixes (RFQ/TO/CO/TC/CHQ/INV/PAY/CMP) have no legacy fallback
T('server-only prefix بدون pool به legacy fallback نمی‌روند', cg.indexOf('SERVER_ONLY_PREFIXES')>-1 && cg.indexOf('isServerOnlyPrefix')>-1 && cg.indexOf('legacyMaxNext')>-1);
T('TMP offer به‌عنوان official ذخیره نمی‌شود', of.indexOf('CODEGEN-OFFER-SERVER')>-1 && of.indexOf('/^TMP-(TO|CO|TC)-/')>-1);
T('server reserve هنوز lock/sequence دارد', php.indexOf('flock($fp,LOCK_EX)')>-1 && php.indexOf('format_code($pref,$n,$y)')>-1);
var dupBlock=(cg.match(/window\.ptfScanDuplicateCodes = function\(\)\{[\s\S]*?\n\};/)||[''])[0];
T('duplicate audit فقط read-only است', cg.indexOf('CODEGEN-DUP-AUDIT')>-1 && dupBlock.indexOf('ptfScanDuplicateCodes')>-1 && dupBlock.indexOf('setData(')===-1);
DONE('tester182-v327-codegen-server-integrity');
