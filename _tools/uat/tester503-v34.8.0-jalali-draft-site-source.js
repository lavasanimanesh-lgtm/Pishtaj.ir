#!/usr/bin/env node
'use strict';
/* v34.8.16 — DATE-DRAFT-SITE-001
   UAT/contract test for the unified Jalali day/month/year controls, outgoing
   letter draft lifecycle, and website RFQ source identity. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var pass = 0, fail = 0;
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function T(name, ok, detail) {
  if (ok) { pass++; console.log('PASS', name); }
  else { fail++; console.error('FAIL', name, detail === undefined ? '' : JSON.stringify(detail)); }
}
function between(src, start, end) {
  var a = src.indexOf(start), b = src.indexOf(end, a + start.length);
  if (a < 0 || b < 0) throw new Error('extract failed: ' + start + ' .. ' + end);
  return src.slice(a, b);
}
function hasAll(src, values) { return values.every(function (v) { return src.indexOf(v) > -1; }); }

var dateKitSrc = read('crm/date-kit.js');
var uiKit = read('crm/ui-kit.js');
var letters = read('crm/letters.js');
var bridge = read('crm/bridge.js');
var opex = read('crm/opex.js');
var shareholders = read('crm/shareholders.js');
var chequePrint = read('crm/cheque-print.js');
var cheques = read('crm/cheques.js');
var gate = read('_tools/uat/run-ci-gate.js');

console.log('\n── DateKit: تبدیل و pickerهای روز/ماه/سال ──');
try {
  var listeners = {}, ids = {}, styles = [];
  var document = {
    head: { appendChild: function (el) { styles.push(el); } },
    createElement: function () { return { style: {}, setAttribute: function () {}, appendChild: function () {} }; },
    addEventListener: function (kind, fn) { (listeners[kind] = listeners[kind] || []).push(fn); },
    getElementById: function (id) { return ids[id] || null; },
    querySelectorAll: function () { return []; }
  };
  function FakeEvent(type, opt) { this.type = type; this.bubbles = !!(opt && opt.bubbles); }
  var sb = { window: null, document: document, console: console, Date: Date, Math: Math, JSON: JSON, Event: FakeEvent };
  sb.window = sb;
  vm.createContext(sb);
  vm.runInContext(dateKitSrc, sb, { filename: 'date-kit.js' });
  var dk = sb.DateKit;

  T('DateKit در runtime بارگذاری می‌شود', !!dk);
  T('تبدیل ISO به شمسی صحیح است', dk.isoToJ('2026-08-24') === '1405/06/02', dk.isoToJ('2026-08-24'));
  T('تبدیل شمسی به ISO صحیح است', dk.jToIso('۱۴۰۵/۰۶/۰۲') === '2026-08-24', dk.jToIso('۱۴۰۵/۰۶/۰۲'));
  T('روز نامعتبر شمسی/میلادی رد و روز کبیسه معتبر پذیرفته می‌شود',
    dk.jNormalize('1404/12/30') === '' && dk.jNormalize('1403/12/30') === '1403/12/30' && dk.isoToJ('2026-02-31') === '');
  T('جابجایی ماه، اسفند کبیسه و عادی را درست clamp می‌کند',
    dk.rangeNav('1403/11/30', '1403/11/30', 1, 'month').from === '1403/12/30' &&
    dk.rangeNav('1404/11/30', '1404/11/30', 1, 'month').from === '1404/12/29');
  var roundTripOk = true, validJalaliDays = 0;
  for (var jy = 1300; jy <= 1499 && roundTripOk; jy++) {
    for (var jm = 1; jm <= 12 && roundTripOk; jm++) {
      for (var jd = 1; jd <= 31; jd++) {
        var jCandidate = jy + '/' + String(jm).padStart(2, '0') + '/' + String(jd).padStart(2, '0');
        var jNormal = dk.jNormalize(jCandidate);
        if (!jNormal) continue;
        validJalaliDays++;
        if (dk.isoToJ(dk.jToIso(jNormal)) !== jNormal) { roundTripOk = false; break; }
      }
    }
  }
  T('تمام ۷۳۰۴۹ روز معتبر شمسی ۱۳۰۰ تا ۱۴۹۹ رفت‌وبرگشت بدون rollover دارند', roundTripOk && validJalaliDays === 73049, validJalaliDays);
  var previousMonth = dk.quickRanges().filter(function (x) { return x.label === 'ماه قبل'; })[0];
  T('بازه آماده ماه قبل، ابتدا و انتهای همان ماه را به ترتیب می‌سازد',
    previousMonth && previousMonth.from.slice(0, 7) === previousMonth.to.slice(0, 7) && dk.jToIso(previousMonth.from) <= dk.jToIso(previousMonth.to), previousMonth);
  T('نرمال‌سازی ماه با رقم فارسی و جداکننده خط تیره', dk.monthNormalize('۱۴۰۵-۶') === '1405/06');
  T('ماه نامعتبر رد می‌شود', dk.monthNormalize('1405/13') === '');
  T('نرمال‌سازی سال فقط سال شمسی معتبر را می‌پذیرد', dk.yearNormalize('۱۴۰۵') === '1405' && dk.yearNormalize('2026') === '');

  var dayIso = dk.picker('dayIso', '2026-08-24');
  var dayJ = dk.picker('dayJ', '۱۴۰۵/۰۶/۰۲');
  T('day picker مقدار ISO اولیه را در UI شمسی نشان می‌دهد', dayIso.indexOf('value="1405/06/02"') > -1 && dayIso.indexOf('data-calendar="jalali"') > -1);
  T('day picker مقدار شمسی اولیه را نیز بدون پاک‌شدن می‌پذیرد', dayJ.indexOf('value="1405/06/02"') > -1);
  T('پنل روز به‌صورت fixed روی viewport باز می‌شود و وارد flow صفحه نمی‌شود',
    hasAll(dayIso, ['data-datekit-float-width="280"', 'position:fixed', 'role="dialog"']));

  var monthHtml = dk.monthPicker('periodM', '۱۴۰۵-۶');
  var yearHtml = dk.yearPicker('periodY', '۱۴۰۵');
  var emptyMonthHtml = dk.monthPicker('periodMEmpty', '', { allowEmpty: true });
  var emptyYearHtml = dk.yearPicker('periodYEmpty', '', { allowEmpty: true });
  T('month picker مقدار فنی hidden لاتین و برچسب دیداری فارسی دارد', monthHtml.indexOf('type="hidden" id="periodM" value="1405/06"') > -1 && monthHtml.indexOf('شهریور ۱۴۰۵') > -1);
  T('year picker مقدار فنی hidden و جدول‌محور دارد', yearHtml.indexOf('type="hidden" id="periodY" value="1405"') > -1 && yearHtml.indexOf('ptf-period-trigger') > -1);
  T('پنل‌های ماه و سال نیز fixed هستند و ساختار فرم را جابه‌جا نمی‌کنند',
    hasAll(monthHtml, ['data-datekit-float-width="330"', 'position:fixed', 'role="dialog"']) && hasAll(yearHtml, ['data-datekit-float-width="330"', 'position:fixed']));
  T('جای‌گذاری شناور با viewport، بازشدن رو به بالا و reposition اسکرول/resize را پوشش می‌دهد',
    hasAll(dateKitSrc, ['getBoundingClientRect', 'openAbove', "addEventListener('resize', _scheduleFloatingPosition)", "addEventListener('scroll', _scheduleFloatingPosition, true)"]));
  T('حالت خالی picker دوره برچسب معنایی همه ماه‌ها/همه سال‌ها دارد', emptyMonthHtml.indexOf('همه ماه‌ها') > -1 && emptyYearHtml.indexOf('همه سال‌ها') > -1);
  T('CSS شمسی و میلادی فونت‌های مستقل دارد', styles.length === 1 && /Vazirmatn/.test(styles[0].textContent) && /ptf-date-gregorian/.test(styles[0].textContent) && /Arial/.test(styles[0].textContent));

  /* runtime viewport test: trigger نزدیک پایین صفحه است؛ پنل باید بدون تغییر flow
     بالای trigger باز و سپس با کلیک دوباره بسته شود. */
  var floatExpanded = '';
  var floatTrigger = {
    setAttribute: function (k, v) { if (k === 'aria-expanded') floatExpanded = v; },
    getBoundingClientRect: function () { return { top: 700, bottom: 730, right: 980, left: 760 }; }
  };
  var floatRoot = { querySelector: function (sel) { return sel === '[data-datekit-action="show"]' ? floatTrigger : null; } };
  var floatBox = {
    style: { display: 'none' }, innerHTML: '', parentElement: floatRoot, scrollHeight: 300, offsetHeight: 300,
    getAttribute: function (k) { return k === 'data-datekit-float-width' ? '280' : (k === 'data-datekit-cal' ? 'floatRuntime' : ''); }
  };
  ids.floatRuntime = { value: '1405/06/02' }; ids.floatRuntime_cal = floatBox;
  sb.innerWidth = 1000; sb.innerHeight = 760;
  document.querySelectorAll = function (sel) { return sel === '[data-datekit-cal]' ? [floatBox] : []; };
  dk.show('floatRuntime');
  T('runtime: تقویم نزدیک پایین viewport رو به بالا و در محدوده صفحه باز می‌شود',
    floatBox.style.display === 'block' && parseInt(floatBox.style.top, 10) < 700 && parseInt(floatBox.style.left, 10) >= 8 && floatBox.style.visibility === 'visible' && floatExpanded === 'true', floatBox.style);
  dk.show('floatRuntime');
  T('runtime: کلیک دوباره پنل شناور را می‌بندد و aria-expanded را برمی‌گرداند', floatBox.style.display === 'none' && floatExpanded === 'false');
  document.querySelectorAll = function () { return []; };

  var panel = {
    style: { display: 'none' }, innerHTML: '', parentElement: null, scrollHeight: 260, offsetHeight: 260,
    getAttribute: function (k) { return k === 'data-datekit-float-width' ? '330' : ''; }
  };
  var label = { textContent: '' }, periodExpanded = '';
  var trigger = {
    setAttribute: function (k, v) { if (k === 'aria-expanded') periodExpanded = v; },
    getBoundingClientRect: function () { return { top: 700, bottom: 730, right: 980, left: 650 }; }
  };
  var root = {
    attrs: { 'data-datekit-period': 'periodRuntime', 'data-datekit-period-kind': 'month', 'data-datekit-period-year': '1405', 'data-datekit-period-empty-label': 'همه ماه‌ها' },
    getAttribute: function (k) { return this.attrs[k] || ''; },
    setAttribute: function (k, v) { this.attrs[k] = String(v); },
    querySelector: function (sel) {
      if (sel === '[data-datekit-period-panel]') return panel;
      if (sel === '[data-datekit-period-label]') return label;
      if (sel === '[data-datekit-period-action="show"]') return trigger;
      return null;
    }
  };
  panel.parentElement = root;
  var changes = 0;
  ids.periodRuntime = { value: '', dispatchEvent: function (e) { if (e.type === 'change' && e.bubbles) changes++; } };
  function action(name, attrs) {
    attrs = attrs || {};
    attrs['data-datekit-period-action'] = name;
    return {
      getAttribute: function (k) { return attrs[k] == null ? '' : String(attrs[k]); },
      setAttribute: function (k, v) { attrs[k] = String(v); if (name === 'show' && k === 'aria-expanded') periodExpanded = String(v); },
      closest: function (sel) {
        if (sel === '[data-datekit-period-action]') return this;
        if (sel === '[data-datekit-period]') return root;
        return null;
      }
    };
  }
  var clickHandlers = listeners.click || [];
  clickHandlers.forEach(function (fn) { fn({ target: action('show') }); });
  T('runtime: پنل دوره نیز روی viewport و بدون تغییر flow رو به بالا باز می‌شود',
    panel.style.display === 'block' && parseInt(panel.style.top, 10) < 700 && panel.style.visibility === 'visible' && periodExpanded === 'true', panel.style);
  clickHandlers.forEach(function (fn) { fn({ target: action('year', { 'data-year': '1406' }) }); });
  T('month picker پس از انتخاب سال، جدول ۱۲ ماه فارسی را می‌سازد', root.attrs['data-datekit-period-year'] === '1406' && hasAll(panel.innerHTML, ['فروردین', 'شهریور', 'اسفند']));
  clickHandlers.forEach(function (fn) { fn({ target: action('month', { 'data-month': '7' }) }); });
  T('انتخاب ماه مقدار YYYY/MM را ذخیره و change bubbling منتشر می‌کند', ids.periodRuntime.value === '1406/07' && changes === 1, { value: ids.periodRuntime.value, changes: changes });
  T('برچسب ماه انتخاب‌شده فارسی است', label.textContent === 'مهر ۱۴۰۶', label.textContent);
  clickHandlers.forEach(function (fn) { fn({ target: action('clear') }); });
  T('پاک‌کردن دوره، برچسب معنایی همه ماه‌ها را حفظ می‌کند', ids.periodRuntime.value === '' && label.textContent === 'همه ماه‌ها' && changes === 2, { value: ids.periodRuntime.value, label: label.textContent, changes: changes });

  var yearPanel = { style: { display: 'block' }, innerHTML: '', parentElement: null };
  var yearLabel = { textContent: '' }, yearTrigger = { setAttribute: function () {} };
  var yearRoot = {
    attrs: { 'data-datekit-period': 'yearRuntime', 'data-datekit-period-kind': 'year', 'data-datekit-period-year': '1405' },
    getAttribute: function (k) { return this.attrs[k] || ''; }, setAttribute: function (k, v) { this.attrs[k] = String(v); },
    querySelector: function (sel) { if (sel === '[data-datekit-period-panel]') return yearPanel; if (sel === '[data-datekit-period-label]') return yearLabel; if (sel === '[data-datekit-period-action="show"]') return yearTrigger; return null; }
  };
  yearPanel.parentElement = yearRoot;
  var yearChanges = 0;
  ids.yearRuntime = { value: '', dispatchEvent: function () { yearChanges++; } };
  var yearAction = {
    getAttribute: function (k) { return k === 'data-datekit-period-action' ? 'year' : (k === 'data-year' ? '1407' : ''); },
    closest: function (sel) { if (sel === '[data-datekit-period-action]') return this; if (sel === '[data-datekit-period]') return yearRoot; return null; }
  };
  clickHandlers.forEach(function (fn) { fn({ target: yearAction }); });
  T('year picker انتخاب را مستقیم نهایی می‌کند', ids.yearRuntime.value === '1407' && yearLabel.textContent === 'سال ۱۴۰۷' && yearChanges === 1);
} catch (eDate) {
  T('اجرای runtime DateKit بدون خطا', false, eDate && eDate.stack || String(eDate));
}

console.log('\n── قرارداد ptfDialog و مهاجرت سراسری تاریخ ──');
T('ptfDialog روز شمسی را با type:date به ISO خروجی می‌دهد و datePicker:true را شمسی نگه می‌دارد',
  hasAll(uiKit, ["f.type === 'date' && f.gregorian !== true && !f.datePicker", 'window.DateKit.jToIso(val)', 'f.datePicker || (f.type === \'date\' && f.gregorian !== true)']));
T('ptfDialog برای ماه و سال از pickerهای جدولی DateKit استفاده می‌کند', hasAll(uiKit, ['DateKit.monthPicker', 'DateKit.yearPicker']));
T('Enter روی دکمه‌های picker دیالوگ را زودهنگام submit نمی‌کند', uiKit.indexOf("e.target.tagName !== 'BUTTON'") > -1);
T('تاریخ‌های صریحاً میلادی opt-out و فونت انگلیسی دارند',
  hasAll(read('crm/salesfiles.js'), ["label: 'تاریخ پکینگ (میلادی)', type: 'date', gregorian: true", "label: 'تاریخ ارسال (میلادی)', type: 'date', gregorian: true", "label: 'تاریخ تحویل (میلادی)', type: 'date', gregorian: true"]) &&
  read('crm/management-intelligence.js').indexOf("label:'موعد اقدام (میلادی، اختیاری)',type:'date',gregorian:true") > -1 &&
  read('crm/docsx.js').indexOf('class="ptf-date-gregorian" data-calendar="gregorian"') > -1);
T('تاریخ پرداخت تأمین‌کننده در ویرایش نیز picker شمسی دارد', read('crm/supplier-finance.js').indexOf("id:'date',label:'تاریخ پرداخت (شمسی)',datePicker:true") > -1);
T('هاب مالی: OPEX، پورسانت، سهامداران و برنامه‌ریز مالیاتی month/year picker دارند',
  opex.indexOf("DateKit.monthPicker('opexMonthFilter'") > -1 &&
  read('crm/commission.js').indexOf("DateKit.monthPicker('cmMonth'") > -1 &&
  shareholders.indexOf("DateKit.monthPicker('shareholderMonth'") > -1 &&
  read('crm/unofficial-invoice.js').indexOf("DateKit.yearPicker('tpYear'") > -1);
T('OPEX fallback گزینه همه ماه‌ها را دوبار تولید نمی‌کند', opex.indexOf('opexMonthOptions(m, false)') > -1 && opex.indexOf('opexMonthOptions(m, true)') === -1);
T('سال‌های fiscal/VAT/tax/working-capital غیرتایپی شده‌اند',
  read('crm/fiscal.js').indexOf('DateKit.yearPicker') > -1 && read('crm/vat-quarterly.js').indexOf('DateKit.yearPicker') > -1 &&
  read('crm/tax-returns.js').indexOf('DateKit.yearPicker') > -1 && read('crm/working-capital.js').indexOf("type: 'year'") > -1);
T('ردیف‌های دسته‌ای چک day picker فشرده و collector class قبلی را حفظ می‌کنند',
  chequePrint.indexOf("DateKit.enhanceInput(el.id, { compact: true") > -1 && chequePrint.indexOf("querySelectorAll('#chqpMBody .chqpM_d')") > -1 &&
  cheques.indexOf("DateKit.enhanceInput(el.id, { compact: true") > -1 && cheques.indexOf("querySelectorAll('#chBatchBody .chB_due')") > -1);

console.log('\n── مکاتبات: lifecycle مستقل ثبت پیش‌نویس ──');
T('دکمه مستقل ثبت پیش‌نویس کنار ارسال برای امضا وجود دارد', letters.indexOf('💾 ثبت پیش‌نویس') > -1 && letters.indexOf('ارسال برای امضا') > -1);
try {
  var stored = [{ cd: 'L-1', st: 'rejected', signedT: 'old', signatureSnapshot: { sig: 'x' } }];
  var saved = 0, rendered = 0, hidden = 0, notified = 0, attached = 0, serials = 0;
  var lctx = {
    window: null,
    _collectLetter: function () { return { cd: 'L-1', to: '', subject: '', body: '', signedT: 'old', signatureSnapshot: { sig: 'x' } }; },
    getData: function () { return stored; }, setData: function (k, v) { stored = v; saved++; },
    faDate: function () { return '1405/06/02'; }, faDateTime: function () { return '1405/06/02 12:00'; },
    curSession: function () { return { user: 'author' }; },
    letExtract: function () { return { keywords: [], summary: '' }; }, audit: function () {},
    hideModal: function () { hidden++; }, renderLetters: function () { rendered++; }, ptfToast: function () {}, alert: function () {},
    notify: function () { notified++; }, _letAttachToPrj: function () { attached++; }, letSerial: function () { serials++; }
  };
  lctx.window = lctx;
  vm.createContext(lctx);
  vm.runInContext(between(letters, 'function letSaveDraft', 'function letSubmit'), lctx, { filename: 'letters-save-draft.js' });
  var draft = lctx.letSaveDraft('L-1');
  T('پیش‌نویس ناقص بدون اعتبارسنجی اجباری ذخیره می‌شود', saved === 1 && draft.st === 'draft' && draft.subject === '');
  T('ذخیره پیش‌نویس امضای قبلی را پاک و metadata ویرایش را ثبت می‌کند', !draft.signedT && !draft.signatureSnapshot && draft.draftUpdatedBy === 'author' && draft.draftUpdatedAt === '1405/06/02 12:00');
  T('ذخیره پیش‌نویس هیچ شماره، اعلان امضا یا سند پرونده نمی‌سازد', serials === 0 && notified === 0 && attached === 0 && !draft.no);
  T('پس از ذخیره، مودال بسته و فهرست برای ادامه ویرایش باز-render می‌شود', hidden === 1 && rendered === 1);
} catch (eDraft) {
  T('اجرای runtime ثبت پیش‌نویس بدون خطا', false, eDraft && eDraft.stack || String(eDraft));
}
T('فقط draft/rejected نویسنده دکمه ویرایش می‌گیرند', letters.indexOf("(l.st === 'draft' || l.st === 'rejected')") > -1 && letters.indexOf('✏️') > -1 && letters.indexOf('showLetterModal') > -1);
T('ارسال مجدد پیش‌نویس/ردشده علت رد قبلی را پاک می‌کند', between(letters, 'function letSubmit', 'function letSign').indexOf('delete l.rejectWhy;') > -1);

console.log('\n── RFQ سایت: هویت مبدأ ──');
T('زیر شماره RFQ منبع سایت صریح نمایش داده می‌شود', bridge.indexOf("if (r.src === 'site')") > -1 && bridge.indexOf('🌐 ثبت‌شده از وب‌سایت') > -1);
T('RFQ سایت قبل از fallback نامشخص/قدیمی تشخیص داده می‌شود', bridge.indexOf("if (r.src === 'site')") < bridge.indexOf("نامشخص (قدیمی)"));
T('هنگام approve متادیتای مبدأ سایت حفظ می‌شود', hasAll(bridge, ['siteSubmittedAt: r.date || r.createdAt || \'\'', 'siteSourceCode: r.code || code']));
T('API زمان ثبت سایت را با قالب پایدار Y-m-d H:i می‌نویسد', read('api/crm.php').indexOf("date('Y-m-d H:i')") > -1);

T('tester503 در گیت CI ثبت شده است', gate.indexOf('tester503-v34.8.0-jalali-draft-site-source.js') > -1);
console.log('\n— tester503 (v34.8.16: تاریخ شمسی، پیش‌نویس، مبدأ سایت) —');
console.log('PASS: ' + pass + ' | FAIL: ' + fail);
process.exit(fail ? 1 : 0);
