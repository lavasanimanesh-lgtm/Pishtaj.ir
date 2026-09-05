/* tester220 — v31.7.43 (WEB-INT-OPS-001)
 * Public interactive website flows must be operational, explicit and fail-closed.
 */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
function read(rel){ return fs.readFileSync(path.join(ROOT, rel), 'utf-8'); }
var home = read('index.html');
var rfq = read('rfq/index.html');
var supplier = read('supplier/index.html');
var tracking = read('tracking/index.html');
var tools = read('tools/index.html');
var toolsUi = read('tools/tools-ui.js');
var guard = read('assets/js/ptf-guard.js');
var api = read('api/crm.php');

SECTION('Home quick RFQ');
T('Home RFQ به add_rfq_site وصل است و submit اختصاصی دارد', home.indexOf('data-ptf-custom-submit="home-rfq"') > -1 && home.indexOf("api/crm.php?action=add_rfq_site") > -1);
T('Home RFQ کد تصادفی نمی‌سازد و fail-closed است', home.indexOf("'PTF-RFQ-' + rand") === -1 && home.indexOf('هیچ کد رهگیری صادر نشده است') > -1);
T('Home RFQ success فقط با ok:true + code سرور است', home.indexOf('!res.ok || !dj.ok || !dj.code') > -1 && home.indexOf('const code = String(dj.code') > -1);

SECTION('Smart RFQ page');
T('RFQ هوشمند به add_rfq_site وصل است', rfq.indexOf('action="../api/crm.php?action=add_rfq_site"') > -1);
T('RFQ هوشمند کد موقت/تصادفی صادر نمی‌کند', rfq.indexOf('PTF-RFQ-TMP') === -1 && rfq.indexOf('هیچ کد رهگیری صادر نشده است') > -1);
T('RFQ فعال‌سازی ابزار را قابل مشاهده می‌کند', rfq.indexOf('درخواست فعال‌سازی ابزارهای پیشرفته') > -1 && rfq.indexOf("params.get('activation')") > -1 && rfq.indexOf("hiddenCategory').value = 'فعال‌سازی ابزارهای پیشرفته مهندسی'") > -1);

SECTION('Tool activation and paywall');
T('Tools activation link وارد RFQ با activation=tools می‌شود', tools.indexOf('../rfq/?activation=tools&tool=all&item=Advanced%20Engineering%20Tools%20License') > -1);
T('Tools paywall لینک activation=tools و license input دارد', toolsUi.indexOf('../rfq/?activation=tools&tool=advanced_report&item=') > -1 && toolsUi.indexOf('ptfToolsLicenseCode') > -1);
T('Free PDF بدون grant تولید نمی‌شود', /function exportPdf\(\)[\s\S]{0,420}ptfToolsPaywall/.test(toolsUi) && /function exportPdf\(\)[\s\S]{0,260}ptfToolsHasGrant/.test(toolsUi));

SECTION('Supplier registration');
T('Supplier form به add_supplier وصل است', supplier.indexOf('action="../api/crm.php?action=add_supplier"') > -1);
T('Supplier دیگر کد موقت fake-success نمی‌سازد', supplier.indexOf('PTF-VEN-TMP') === -1 && supplier.indexOf('هیچ کد رهگیری تامین‌کننده صادر نشده است') > -1);
T('Supplier شماره موبایل 09 و OTP/degraded flow دارد', supplier.indexOf('شماره موبایل واتساپ برای تایید پیامکی') > -1 && guard.indexOf('d.ok && d.degraded && d.otp_token') > -1);
T('API supplier SMS degraded fallback دارد', api.indexOf('BUG-SUP-OTP-001') > -1 && api.indexOf("'degraded' => true") > -1);
/* v34.37.5: کرانه‌های این پین کهنه شده بود (بلوک add_supplier با SUP-DEDUP/SUP-PAY-TERMS و
   SUP-UPLOAD-RCA بزرگ‌تر شده است) ⇒ تستر حتی پیش از این تغییر هم FAIL بود. کرانه‌ها بر اساس
   فاصلهٔ واقعیِ دوباره اندازه‌گیری‌شدند؛ معنا حفظ شده: «هشدار پیوست ساخته می‌شود و در پاسخ موفق هست». */
T('خطای پیوست اختیاری ثبت‌نام تامین‌کننده را متوقف نمی‌کند', /case 'add_supplier':[\s\S]{0,9000}\$attachmentWarning[\s\S]{0,9000}'warning' => \$attachmentWarning/.test(api));
T('فرم تامین‌کننده علت واقعی خطای سرور را نمایش می‌دهد', supplier.indexOf('const raw = await res.text()') > -1 && supplier.indexOf('submitError') > -1 && supplier.indexOf('venWarning') > -1);

SECTION('Tracking');
T('Tracking form از api track استفاده می‌کند', tracking.indexOf('trackForm') > -1 && tracking.indexOf("../api/crm.php?action=track&code=") > -1);
T('Backend track public و rate-limited است', api.indexOf("'track'") > -1 && api.indexOf("'track' => 60") > -1);

DONE('tester220-public-interactions-operational');
