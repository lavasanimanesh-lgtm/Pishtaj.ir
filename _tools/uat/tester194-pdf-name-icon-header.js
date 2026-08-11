/* tester194 — v31.7.19 (US-PDF-NAME + BUG-ICON-STORE-001 + BUG-HDR-MOBILE-002)
 * گزارش کارفرما: ۱) PDFهای دانلودی همه با نام «سامانه مدیریت پیشرو تجهیز فرتاک» ذخیره
 * می‌شوند و قابل تمایز نیستند — باید شماره سند خودشان را داشته باشند.
 * ۲) آیکون موجودی انبار (🏬) مینیمال نیست — در MAP iconx نگاشت SVG نداشت.
 * ۳) هدر موبایل نامنظم‌تر شد — overflow:hidden سراسری v31.7.18 بج نسخه/زنگ را می‌برید. */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var read = function (p) { return fs.readFileSync(path.join(ROOT, p), 'utf-8'); };
var ix = read('crm/iconx.js'), mn = read('crm/mobilenav.js'), uk = read('crm/ui-kit.js');
var ch = read('crm/cheques.js'), an = read('crm/analyzer.js'), fi = read('crm/fiscal.js');
var sc = read('crm/scoring.js'), aw = read('crm/ai-workbench.js');

SECTION('US-PDF-NAME: عنوان سنددار برای PDF');
T('helper سراسری ptfPrintWithTitle با restore پس از چاپ', uk.indexOf('window.ptfPrintWithTitle') > -1 && uk.indexOf("addEventListener('afterprint'") > -1 && /setTimeout\(restore, 4000\)/.test(uk));
T('چک صیادی: عنوان = CHQ-{شماره صیادی/چک}', ch.indexOf('US-PDF-NAME') > -1 && /_chTitle = 'CHQ-'/.test(ch) && /c\.sayad\|\|c\.no\|\|c\.cd/.test(ch));
T('گزارش تحلیلی: عنوان ANL-{تاریخ}', /ANL-' \+ \(typeof faDate/.test(an));
T('گزارش سال مالی: FIS-{سال}', (fi.match(/ptfPrintWithTitle\(\\'FIS-\\'/g) || []).length === 2);
T('گزارش امتیازها: SCORE', /ptfPrintWithTitle\(\\'SCORE\\'\)/.test(sc));
T('پیش‌نویس نامه دستیار: LTR-DRAFT', /ptfPrintWithTitle\(\\'LTR-DRAFT\\'\)/.test(aw));

SECTION('پوشش موجود از قبل (رگرسیون — نباید خراب شده باشد)');
var of = read('crm/offers.js'), op = read('crm/offers-pro.js'), lt = read('crm/letters.js');
var ct = read('crm/contracts.js'), pj = read('crm/projects.js'), rq = read('crm/rfqsmart.js'), iq = read('crm/inqreader.js');
T('پیشنهادها: title = نام معنایی پیشنهاد + شماره درخواست کارفرما', of.indexOf('ptfOfferPdfFileName(o)') > -1 && op.indexOf('ptfOfferPdfFileName(o)') > -1 && uk.indexOf('window.ptfOfferPdfFileName') > -1);
T('نامه/قرارداد/بسته‌بندی/تامین/استعلام: title سنددار', /<title>' \+ escP\(l\.no/.test(lt) && /<title>' \+ c\.no/.test(ct) && /<title>' \+ pl\.no/.test(pj) && /<title>' \+ escP\(r\.no/.test(rq) && /<title>' \+ escP\(inqNo\)/.test(iq));

SECTION('رفتاری: ptfPrintWithTitle');
global.window = global;
global.document = { title: 'CRM | سامانه مدیریت | پیشرو تجهیز فرتاک' };
var listeners = {};
window.addEventListener = function (ev, fn) { listeners[ev] = fn; };
window.removeEventListener = function (ev) { delete listeners[ev]; };
var printed = [];
window.print = function () { printed.push(document.title); };
eval(uk.match(/window\.ptfPdfFileName = function[\s\S]*?\n\};/)[0]);
eval(uk.match(/window\.ptfPrintWithTitle = function[\s\S]*?\n\};/)[0]);
window.ptfPrintWithTitle('CO-1405-77');
T('هنگام چاپ، عنوان سند = شماره سند (نام پیش‌فرض PDF)', printed[0] === 'CO-1405-77');
if (listeners.afterprint) listeners.afterprint();
T('پس از چاپ، عنوان برنامه برمی‌گردد', document.title === 'CRM | سامانه مدیریت | پیشرو تجهیز فرتاک');

SECTION('BUG-ICON-STORE-001: آیکون مینیمال موجودی انبار');
T('نگاشت 🏬 و 🧱 به SVG خطی store', /'🏬': svg\(P\.store\), '🧱': svg\(P\.store\)/.test(ix));
T('path آیکون store (سایه‌بان فروشگاه) تعریف شده', /store: '<path d="M4 10v10h16V10"/.test(ix));

SECTION('BUG-HDR-MOBILE-002: هدر موبایل بدون بریدگی');
T('overflow:hidden سراسری هدر حذف شد (بج‌ها را می‌برید)', !/\.tb\{[^}]*overflow:hidden\}/.test(mn));
T('بج نسخه: در هدر موبایل خلوت پنهان است یا ellipsis امن دارد', /#clockD,#liveHealthPill,#topVerPill\{display:none!important\}/.test(mn) || /#topVerPill\{[^}]*text-overflow:ellipsis/.test(mn));
T('tbic با overflow:visible — بج زنگ (67) بیرون نمی‌بُرد', /\.tb \.tbic\{[^}]*overflow:visible[^}]*\}/.test(mn));
T('هدر خلوت: بایگانی/ابر در موبایل مخفی (از کشوی سایر در دسترس)', /title="بایگانی"/.test(mn) && /title="فضای ابری"/.test(mn));

DONE('tester194-pdf-name-icon-header');
