/* tester207 — v31.7.32 (WEB-RFQ-001)
 * فرم استعلام صفحه اصلی باید به زنجیره واقعی RFQ سایت وصل باشد:
 * add_rfq_site + کد رهگیری سرورساز + fail-closed.
 */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8');
var main = fs.readFileSync(path.join(ROOT, 'assets/js/main.js'), 'utf-8');
var api = fs.readFileSync(path.join(ROOT, 'api/crm.php'), 'utf-8');

SECTION('فرم Home به قرارداد واقعی RFQ متصل است');
T('فرم Home handler اختصاصی دارد تا main.js دوباره submit نکند', idx.indexOf('data-ptf-custom-submit="home-rfq"') > -1 && main.indexOf('!form.dataset.ptfCustomSubmit') > -1);
T('نام ارسال‌کننده با name="name" مطابق add_rfq_site ارسال می‌شود', idx.indexOf('id="name" name="name"') > -1);
T('submitHomepageRfq به add_rfq_site پست می‌کند نه add_rfq', idx.indexOf("api/crm.php?action=add_rfq_site") > -1 && idx.indexOf("api/crm.php?action=add_rfq'") === -1 && idx.indexOf('action=add_rfq\'') === -1);
T('هیچ کد رهگیری PTF-RFQ با Math.random در Home ساخته نمی‌شود', !/PTF-RFQ-'\s*\+\s*rand/.test(idx) && !/Math\.random\(\)[\s\S]{0,120}PTF-RFQ/.test(idx));
T('success فقط با ok:true و code سرور رخ می‌دهد', idx.indexOf('!res.ok || !dj.ok || !dj.code') > -1 && idx.indexOf('const code = String(dj.code') > -1);
T('خطا fail-closed است و تصریح می‌کند هیچ کد رهگیری صادر نشده', idx.indexOf('هیچ کد رهگیری صادر نشده است') > -1);
T('کپچا همچنان الزامی و به FormData افزوده می‌شود', idx.indexOf('ptfCaptchaValid') > -1 && idx.indexOf('ptfCaptchaAppend(fd)') > -1);
T('tracking link از کد واقعی سرور ساخته می‌شود', idx.indexOf("tracking/?code=' + encodeURIComponent(code)") > -1);
T('event tracking پایه برای submit success/fail وجود دارد', idx.indexOf('home_rfq_submit_success') > -1 && idx.indexOf('home_rfq_submit_fail') > -1 && idx.indexOf('ptf_web_events') > -1);

SECTION('قرارداد backend حفظ شده است');
T('add_rfq_site public و rate-limited است', api.indexOf("'add_rfq_site'") > -1 && api.indexOf("'add_rfq_site' => 10") > -1);
T('add_rfq_site کد تصادفی امن و سرورساز می‌دهد', api.indexOf("public_tracking_code('RFQ')") > -1 && api.indexOf('random_int(0, $max)') > -1 && api.indexOf("$alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'") > -1);
T('add_rfq_site کپچا را require می‌کند', /case 'add_rfq_site':[\s\S]{0,120}require_captcha\(\)/.test(api));

DONE('tester207-home-rfq-real-chain');
