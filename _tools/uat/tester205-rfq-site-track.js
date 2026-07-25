/* tester205 — v31.7.30 (US-RFQ-TRACK-AUDIT: ممیزی کامل زنجیره RFQ هوشمند سایت ↔ CRM ↔ رهگیری)
 * سوال کارفرما: آیا RFQ سایت کاملاً به سیستم داخلی لینک است و کد رهگیری واقعی است؟
 * پاسخ ممیزی: بله — زنجیره کامل از قبل موجود و با E2E سرور PHP واقعی اثبات شد.
 * بهبود این ریلیز: نگاشت وضعیت داخلی به پیام مشتری‌پسند در track (US-RFQ-TRACK-POLISH). */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var api = fs.readFileSync(path.join(ROOT, 'api/crm.php'), 'utf-8');
var br = fs.readFileSync(path.join(ROOT, 'crm/bridge.js'), 'utf-8');
var rfqPage = fs.readFileSync(path.join(ROOT, 'rfq/index.html'), 'utf-8');
var trackPage = fs.readFileSync(path.join(ROOT, 'tracking/index.html'), 'utf-8');

SECTION('زنجیره ثبت: سایت → سرور');
T('فرم سایت به add_rfq_site پست می‌کند', rfqPage.indexOf('action=add_rfq_site') > -1);
T('کد رهگیری واقعی سرورساز (PTF-RFQ-{سال}-NNNN اتمیک)', api.indexOf("'PTF-RFQ-' . fa_year() . '-' . str_pad(next_seq('rfq_site')") > -1);
T('کپچا اجباری + rate-limit عمومی 10/ساعت', api.indexOf("'add_rfq_site' => 10") > -1);
T('کد به کاربر نمایش + لینک مستقیم رهگیری', rfqPage.indexOf('trackCode') > -1 && rfqPage.indexOf('tracking/?code=') > -1);
T('رویداد لحظه‌ای برای ادمین push می‌شود', api.indexOf("push_event_rec('rfq_site'") > -1);

SECTION('زنجیره CRM: صندوق → تایید → چرخه');
T('get_inbox استعلام‌های src=site را به CRM می‌دهد', api.indexOf("($r['src'] ?? '') === 'site'") > -1);
T('rfqApprove: با تایید، مشتری خودکار + ورود به چرخه با همان کد', br.indexOf('rfqSiteEnsureCustomer') > -1 && br.indexOf("src: 'site'") > -1);
T('پیوست سایت به پیوست‌های CRM منتقل می‌شود', br.indexOf('siteAttachmentMeta') > -1 && br.indexOf('importedFiles') > -1);

SECTION('زنجیره وضعیت: CRM → رهگیری مشتری');
T('هسته واحد ptfRfqSetStatus برای src=site به سرور set_status می‌فرستد', br.indexOf("if (target && target.src === 'site')") > -1 && br.indexOf("api('set_status', { type: 'rfq', code: cd") > -1);
T('کانبان/پرونده فروش/تامین همه از همان هسته می‌گذرند (بازتاب کامل)', fs.readFileSync(path.join(ROOT, 'crm/kanban.js'), 'utf-8').indexOf('ptfRfqSetStatus') > -1 && fs.readFileSync(path.join(ROOT, 'crm/salesfiles.js'), 'utf-8').indexOf('ptfRfqSetStatus') > -1 && fs.readFileSync(path.join(ROOT, 'crm/buycompare.js'), 'utf-8').indexOf('ptfRfqSetStatus') > -1);
T('track عمومی با rate-limit 60/ساعت', api.indexOf("'track' => 60") > -1);
T('صفحه رهگیری سایت از track می‌خواند', trackPage.indexOf('action=track&code=') > -1);
T('track فقط فیلدهای امن برمی‌گرداند (نه message/phone/email)', !/'phone' => \$found\['phone'\][\s\S]{0,200}'track'/.test(api) && api.indexOf("'statusText' => $found['statusText']") > -1);

SECTION('US-RFQ-TRACK-POLISH: پیام مشتری‌پسند');
T('نگاشت pubMap در track', api.indexOf('US-RFQ-TRACK-POLISH') > -1 && api.indexOf('$pubMap') > -1);
T('وضعیت داخلی st8 (تامین‌کننده) به مشتری نشت نمی‌کند', api.indexOf("'st8' => 'سفارش در حال تامین است'") > -1);
T('st7 پیام تحویل محترمانه', api.indexOf("'st7' => 'تحویل شد — با سپاس از اعتماد شما'") > -1);
T('rejected دلیل ثبت‌شده را حفظ می‌کند', api.indexOf("'rejected' => $found['statusText'] ?? 'مختومه'") > -1);
T('نگاشت فقط برای rfq اعمال می‌شود (رهگیری تامین‌کننده مثل قبل)', /if \(\$type === 'rfq'\) \{\s*\n\s*\$st = \$found\['status'\]/.test(api));

DONE('tester205-rfq-site-track');
