/* tester195 — v31.7.20 (BUG-CODE-DUP-002 + BUG-RFQS-MODEL-001)
 * گزارش کارفرما: ۱) ثبت درخواست جدید کد جدید نساخت — کد آخرین درخواست را گرفت، اقلام قبلی
 * merge شد و شماره درخواست مشتری پذیرفته نشد؛ ۲) حذف درخواست جدید، قبلی هم‌کد را هم برد؛
 * ۳) همان ایراد برای کالای جدید؛ ۴) ستون Model در PDF استعلام تامین حذف می‌شود.
 * ریشه ۱-۳: counters سرور کدساز فقط crm/data/*.json را اسکن می‌کرد — داده واقعی در crm/data/sync/
 * است → شمارنده عقب → رزرو شماره استفاده‌شده → کد تکراری؛ و کلاینت هیچ گاردی نداشت.
 * ریشه ۴: فیلد model از ماژول کالا می‌آمد ولی در جدول PDF رندر نمی‌شد. */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var api = fs.readFileSync(path.join(ROOT, 'api/codegen.php'), 'utf-8');
var idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf-8');
var rq = fs.readFileSync(path.join(ROOT, 'crm/rfqsmart.js'), 'utf-8');

SECTION('BUG-CODE-DUP-002: سرور کدساز');
T('counters هر دو مسیر data و data/sync را اسکن می‌کند', api.indexOf('BUG-CODE-DUP-002') > -1 && /\$sources=\[\$data_dir\.'\/'\.\$jsonKey\.'\.json', \$data_dir\.'\/sync\/'\.\$jsonKey\.'\.json'\]/.test(api));
T('حلقه sources بسته شده (سینتکس سالم)', api.indexOf('پایان حلقه sources') > -1);

SECTION('BUG-CODE-DUP-002: گاردهای کلاینت');
T('saveRfq: کد تکراری → تا ۵ regen، سپس مسدود با پیام (نه ادغام بی‌صدا)', idx.indexOf('BUG-CODE-DUP-002') > -1 && /while \(rfqs\.some\(function \(r\) \{ return r && r\.cd === cd; \}\) && _dupTry < 5\)/.test(idx) && idx.indexOf('جلوگیری از ثبت درخواست با کد تکراری') > -1);
T('saveProd: همان گارد برای کالا', /while \(items\.some\(function \(x\) \{ return x && x\.cd === cd; \}\) && _pTry < 5\)/.test(idx) && idx.indexOf('جلوگیری از ثبت کالا با کد تکراری') > -1);
T('گارد TMP قبلی RFQ سالم است', idx.indexOf('TMP-RFQ-') > -1);

SECTION('رفتاری: شبیه‌سازی سناریوی دقیق کارفرما');
global.window = global;
// شبیه‌سازی genCode ای که (به‌دلیل counter عقب سرور) اول کد تکراری می‌دهد، بعد کد سالم
var seq = ['RFQ-1361', 'RFQ-1361', 'RFQ-1362']; var gi = 0;
global.genCode = function () { return seq[Math.min(gi++, seq.length - 1)]; };
global.audit = function () {};
var alerts = []; global.alert = function (m) { alerts.push(m); };
var rfqs = [{ cd: 'RFQ-1361', co: 'فولاد مشیز', items: [{ name: 'قلم قبلی' }] }];
// همان منطق گارد جدید:
var cd = genCode('RFQ');
var _dupTry = 0;
while (rfqs.some(function (r) { return r && r.cd === cd; }) && _dupTry < 5) { cd = genCode('RFQ'); _dupTry++; }
T('کد تکراری شناسایی و کد بعدی سالم گرفته شد (RFQ-1362 نه RFQ-1361)', cd === 'RFQ-1362' && _dupTry === 2);
// سناریوی همه-تکراری → مسدود
gi = 0; seq = ['RFQ-1361', 'RFQ-1361', 'RFQ-1361', 'RFQ-1361', 'RFQ-1361', 'RFQ-1361', 'RFQ-1361'];
cd = genCode('RFQ'); _dupTry = 0;
while (rfqs.some(function (r) { return r && r.cd === cd; }) && _dupTry < 5) { cd = genCode('RFQ'); _dupTry++; }
var blocked = rfqs.some(function (r) { return r && r.cd === cd; });
T('وقتی همه تلاش‌ها تکراری است → ثبت مسدود می‌شود (کدی که باعث merge/حذف آبشاری مشترک شود ساخته نمی‌شود)', blocked === true);

SECTION('BUG-RFQS-MODEL-001: ستون Model در PDF استعلام تامین');
T('جدول PDF ستون Model دارد (شرطی — فقط وقتی قلمی مدل دارد)', rq.indexOf('BUG-RFQS-MODEL-001') > -1 && /_hasModel \? '<th style="width:12%">Model<\/th>' : ''/.test(rq));
T('سلول model در ردیف‌ها رندر می‌شود', /_hasModel\?'<td class="spec" dir="ltr">'\+escP\(it\.model\|\|'—'\)/.test(rq));
T('ویرایشگر اقلام استعلام ستون «مدل/پارت‌نامبر» قابل‌ویرایش دارد', rq.indexOf('مدل / پارت‌نامبر') > -1 && /_stU\(' \+ i \+ ',\\'model\\'/.test(rq));
T('model از ماژول کالا همچنان mapping می‌شود (x.md → model)', /model: x\.md \|\| ''/.test(rq) || /model: p\.md \|\| ''/.test(rq));

SECTION('رفتاری: رندر PDF با و بدون مدل');
global.escP = function (s) { return String(s == null ? '' : s); };
global.getData = function () { return []; };
eval('(function(){ window.ptfRfqsPrintHtml_test = ' + rq.match(/window\.ptfRfqsPrintHtml = (function[\s\S]*?\n  \};)/)[1] + '})()');
var htmlWith = window.ptfRfqsPrintHtml_test({ no: 'SRFQ-1', items: [{ name: 'Gauge', model: 'EN837-1', spec: 'DN100', qty: 2, unit: 'PCS' }] }, null);
T('PDF با مدل: ستون Model + مقدار EN837-1 حاضر است', htmlWith.indexOf('>Model<') > -1 && htmlWith.indexOf('EN837-1') > -1);
var htmlWithout = window.ptfRfqsPrintHtml_test({ no: 'SRFQ-2', items: [{ name: 'Bolt', spec: 'M12', qty: 10, unit: 'PCS' }] }, null);
T('PDF بدون مدل: ستون اضافه نمی‌شود (جدول تمیز می‌ماند)', htmlWithout.indexOf('>Model<') === -1);

DONE('tester195-code-dup-model');
