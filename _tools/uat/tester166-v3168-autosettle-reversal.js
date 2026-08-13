/* FIN-WF-013 — auto-settlement must be reasoned, identified and reversible */
'use strict';
require('./harness');
var fs=require('fs'),path=require('path');
var BASE=path.resolve(__dirname,'../../crm');
var sf=fs.readFileSync(path.join(BASE,'salesfiles.js'),'utf8');
var rb=fs.readFileSync(path.join(BASE,'rbac.js'),'utf8');
var idx=fs.readFileSync(path.join(BASE,'index.html'),'utf8');
var sw=fs.readFileSync(path.join(BASE,'sw.js'),'utf8');
SECTION('ساختار');
T('نسخه v31.6+', (function(){var m=idx.match(/window.PTF_CRM_RELEASE = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=31.6;})());
T('auto-settle شناسه و status دارد', sf.indexOf("cd: genCode('RPAY')")>-1 && sf.indexOf('autoSettle: true')>-1 && sf.indexOf("status: 'posted'")>-1);
T('دلیل تسویه خودکار ذخیره می‌شود', sf.indexOf('settleReason')>-1 && sf.indexOf('sfClsSettleReason')>-1);
T('دلیل در UI اجباری است', sf.indexOf('برای تسویه خودکار، دلیل الزامی است')>-1);
T('commit دلیل را دریافت می‌کند', sf.indexOf('sfCloseSettledCommit = function (cd, settleOpen, settleReason)')>-1);
T('ابطال عمومی وصولی قابلیت reverse دارد', rb.indexOf('window.ptfInvoicePayVoid')>-1 && rb.indexOf('status: \'reversal\'')>-1);
DONE('tester166-v3168-autosettle-reversal');
