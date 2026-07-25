/* tester17 — اسپرینت ۸۰ — بازساخت کوچک */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var off = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8');
var pr = fs.readFileSync(path.join(BASE, 'perms.js'), 'utf-8');
var pt = fs.readFileSync(path.join(BASE, 'petty.js'), 'utf-8');
SECTION('Sprint80');
T('ptfCanAccess', pr.indexOf('ptfCanAccess') > -1);
T('petty تنخواه', pt.indexOf('ptf_crm_petty') > -1);
T('هوک پیش‌پرداخت', pt.indexOf('advance') > -1);
T('custKindToggle/supKindToggle', off.indexOf('custKindToggle') > -1 && off.indexOf('supKindToggle') > -1);
T('indivPhones', off.indexOf('indivPhonesCollect') > -1);
T('سینک sms از phones', fs.readFileSync(path.join(BASE, 'sms.js'), 'utf-8').indexOf('e.phones') > -1);
DONE('TESTER-17 (Sprint80)');
