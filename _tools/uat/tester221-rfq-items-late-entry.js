/* tester221 — v31.7.44 (BUG-INQ-ITEMS-001)
 * RFQ items can be added later manually or by guided Excel even when AI cannot read attachment.
 */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var inq = fs.readFileSync(path.join(ROOT, 'crm/inqreader.js'), 'utf-8');
var idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf-8');

SECTION('View RFQ item actions');
T('BUG-INQ-ITEMS-001 marker exists', inq.indexOf('BUG-INQ-ITEMS-001') > -1);
T('مشاهده درخواست دکمه افزودن/ویرایش اقلام دارد', inq.indexOf('افزودن/ویرایش اقلام') > -1 && inq.indexOf('ptfOpenFullInqEditor') > -1);
T('در حالت بدون قلم، راهنمای AI failure و اکسل دیده می‌شود', inq.indexOf('اگر خواندن فایل با AI موفق نبود') > -1 && inq.indexOf('اکسل راهنمادار') > -1);
T('نمونه CSV اقلام قابل دانلود است', inq.indexOf('ptfDownloadInqItemsTemplate') > -1 && inq.indexOf('ptf-inquiry-items-template.csv') > -1);

SECTION('Guided Excel for request items');
T('راهنمای اکسل INQ در modal عمومی اضافه شده', idx.indexOf('INQ: {') > -1 && idx.indexOf('دستورالعمل ورود اکسل اقلام درخواست') > -1 && idx.indexOf('ستون A') > -1 && idx.indexOf('شرح کالا / تجهیز') > -1);
T('Full editor ورود اکسل با راهنما دارد', inq.indexOf("ptfShowExcelGuidelineModal(\\'INQ\\',\\'inqEdXlsInp\\')") > -1 && inq.indexOf('دانلود نمونه CSV') > -1);
T('Read-file modal هم ورود اکسل با راهنما دارد', inq.indexOf("ptfShowExcelGuidelineModal(\\'INQ\\',\\'irXls\\')") > -1);
T('Excel parser از helper مشترک irXlsRowToItem استفاده می‌کند', inq.indexOf('function irXlsRowToItem') > -1 && (inq.match(/irXlsRowToItem\(c, idx\)/g) || []).length >= 2);
T('Excel mapping ستون‌های شرح/spec/qty/unit/type/brand/model را پشتیبانی می‌کند', ['var desc = c[0]','var spec = c[1]','var qty = +String(c[2]','var un = c[3]','var tp = c[4]','var brand = c[5]','var model = c[6]'].every(function (x) { return inq.indexOf(x) > -1; }));

SECTION('Manual item completeness');
T('Full editor ستون‌های نوع/برند/مدل را برای ورود دستی دارد', ['_inqEditItems[\'+idx+\'].tp','_inqEditItems[\'+idx+\'].brand','_inqEditItems[\'+idx+\'].model'].every(function (x) { return inq.indexOf(x) > -1; }) && ['<th>نوع</th>','<th>برند</th>','<th>مدل</th>'].every(function (x) { return inq.indexOf(x) > -1; }));
T('ذخیره اقلام همچنان ptf_crm_inqitems و r.items را به‌روزرسانی می‌کند', inq.indexOf("setData('ptf_crm_inqitems', iq)") > -1 && inq.indexOf("setData('ptf_crm_rfqs', rfqs)") > -1);
T('snapshots خوانش AI قدیمی هنگام ذخیره پاک می‌شود', inq.indexOf('irClearReadSnapshots') > -1 && inq.indexOf('snapshot خوانش AI') > -1);

DONE('tester221-rfq-items-late-entry');
