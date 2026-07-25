/* tester217 — v31.7.40 (ADV-TOOLS-CATALOG-001)
 * Advanced tools catalog remains locked but visible, with staff license policy and engineering scope.
 */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var tools = fs.readFileSync(path.join(ROOT, 'tools/index.html'), 'utf-8');
var sample = fs.readFileSync(path.join(ROOT, 'api/tool-licenses.sample.json'), 'utf-8');
var spec = fs.readFileSync(path.join(ROOT, 'ADVANCED-TOOLS-CATALOG-SPEC-v1.md'), 'utf-8');

SECTION('Advanced tools catalog visible but locked');
T('کاتالوگ ابزارهای پیشرفته وجود دارد', tools.indexOf('id="advanced-tools"') > -1 && tools.indexOf('advanced-tools-catalog') > -1);
T('تمام خانواده‌های اصلی ابزار پیشرفته در catalog هستند', ['data-tool="control-valve"','data-tool="piping"','data-tool="pump"','data-tool="flowmeter"','data-tool="electrical"','data-tool="instrument"'].every(function (x) { return tools.indexOf(x) > -1; }));
T('ابزارها فعلاً locked/planned هستند نه اجرای آزاد', tools.indexOf('Locked') > -1 && tools.indexOf('Planned') > -1 && tools.indexOf('تا زمان راه‌اندازی درگاه') > -1);
T('استفاده رایگان پرسنل با کد داخلی ذکر شده', tools.indexOf('پرسنل شرکت') > -1 && tools.indexOf('کد داخلی رایگان') > -1);

SECTION('Advanced Control Valve detail preview');
T('Control Valve preview جزئیات فنی دارد', (tools.indexOf('Detailed Locked Preview') > -1 || tools.indexOf('Locked Input Schema Preview') > -1) && ['Operating Cases','Fluid Data','Valve Data','Brand Library'].every(function (x) { return tools.indexOf(x) > -1; }));
T('برندهای نمونه کنترل ولو ذکر شده‌اند', ['Fisher','Samson','Masoneilan','Flowserve','Neles'].every(function (x) { return tools.indexOf(x) > -1; }));
T('گزارش انگلیسی استاندارد و Paid PDF ذکر شده', tools.indexOf('English Standard Report') > -1 && tools.indexOf('Paid PDF report') > -1 && (tools.indexOf('Calculation Tables + Formula Trace') > -1 || tools.indexOf('Calculation Tables') > -1));

SECTION('Staff/internal license policy');
T('نمونه لایسنس staff_internal وجود دارد', sample.indexOf('staff_internal') > -1 && sample.indexOf('LIC-PTF-STAFF-SAMPLE') > -1 && sample.indexOf('tool": "all"') > -1);
T('Spec کاتالوگ ابزارهای پیشرفته وجود دارد', spec.indexOf('Advanced Engineering Tools Catalog') > -1 && spec.indexOf('PTF staff') > -1 && spec.indexOf('Piping Advanced') > -1 && spec.indexOf('Electrical Engineering') > -1);

DONE('tester217-advanced-tools-catalog-preview');
