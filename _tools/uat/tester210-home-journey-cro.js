/* tester210 — v31.7.33 (WEB-CRO-001)
 * Home role-based journey CTAs.
 */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8');

SECTION('Home role journey');
T('سکشن journey نقش‌محور اضافه شده', idx.indexOf('id="journey"') > -1 && idx.indexOf('مسیر سریع بر اساس نقش شما') > -1);
T('مسیر خریدار/EPC به RFQ واقعی می‌رود', idx.indexOf('data-ptf-event="journey_buyer_rfq"') > -1 && idx.indexOf('href="rfq/"') > -1 && idx.indexOf('خریدار / EPC هستم') > -1);
T('مسیر مهندس پروژه به ابزارها می‌رود', idx.indexOf('data-ptf-event="journey_engineer_tools"') > -1 && idx.indexOf('href="tools/"') > -1 && idx.indexOf('مهندس پروژه هستم') > -1);
T('مسیر مشتری در حال پیگیری به tracking می‌رود', idx.indexOf('data-ptf-event="journey_customer_tracking"') > -1 && idx.indexOf('href="tracking/"') > -1 && idx.indexOf('پیگیر استعلام هستم') > -1);
T('مسیر تامین‌کننده به supplier می‌رود', idx.indexOf('data-ptf-event="journey_supplier_signup"') > -1 && idx.indexOf('href="supplier/"') > -1 && idx.indexOf('تامین‌کننده هستم') > -1);
T('متن سکشن به privacy-first بودن شمارش اشاره می‌کند', idx.indexOf('privacy-first') > -1);
T('metrics script در Home قبل از main/chat در دسترس است', idx.indexOf('ptf-metrics.js') > -1 || fs.readFileSync(path.join(ROOT, 'assets/js/ptf-chat.js'), 'utf-8').indexOf('ptf-metrics.js') > -1);

DONE('tester210-home-journey-cro');
