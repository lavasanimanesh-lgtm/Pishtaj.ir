/* tester64 — v14.4 (اسپرینت ج «دستیار قابل‌اتکا»: US-378/379/362/360) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var ai = fs.readFileSync(path.join(BASE, 'ai-workbench.js'), 'utf-8');
var wf = fs.readFileSync(path.join(BASE, 'workflow.js'), 'utf-8');
var of = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8');
var ct = fs.readFileSync(path.join(BASE, 'contracts.js'), 'utf-8');
var llm = fs.readFileSync(path.resolve(__dirname, '../../api/llm.php'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('US-378: ماندگاری نتایج دستیار');
T('کلید تاریخچه per-user', ai.indexOf("'ptf_ai_hist_' + (curSession().user||'_')") > -1);
T('ذخیره خودکار aiWB_persist', ai.indexOf('window.aiWB_persist = function(tab, title, payload)') > -1);
T('هرس ۱۰تایی + سقف حجمی', ai.indexOf('while(h.length>10) h.pop();') > -1 && ai.indexOf('sj.length>200000') > -1);
T('بازیابی خودکار پس از رندر تب (بدون توکن)', ai.indexOf('try { aiWB_restore(t); } catch(eR) {}') > -1);
T('هر ۵ تب persist دارند', ai.indexOf("aiWB_persist('ocr'") > -1 && ai.indexOf("aiWB_persist('translate'") > -1 && ai.indexOf("aiWB_persist('identify'") > -1 && ai.indexOf("aiWB_persist('summarize'") > -1 && ai.indexOf("aiWB_persist('letter'") > -1);
T('دکمه «🕓 نتایج اخیر» در هدر', ai.indexOf('aiWB_histShow()') > -1 && ai.indexOf('🕓 نتایج اخیر') > -1);
T('مودال تاریخچه: کپی/حذف/بازکردن', ai.indexOf('aiWB_histCopy(') > -1 && ai.indexOf('aiWB_histDel(') > -1);
T('بازیابی OCR کامل (rows+det)', ai.indexOf("if(t==='ocr' && last.data.rows") > -1 && ai.indexOf('window._aiWB_detected = last.data.det') > -1);
T('بازیابی نامه با دکمه‌های اقدام', ai.indexOf("t==='letter' && last.data.text") > -1 && ai.indexOf('aiWB_letterActionsHtml()') > -1);
T('تاریخچه در SYNC_KEYS نیست (شخصی)', fs.readFileSync(path.join(BASE, 'sync.js'), 'utf-8').indexOf('ptf_ai_hist') === -1);

SECTION('US-379: پاک‌سازی خروجی متنی AI');
T('تابع ptfAiClean', ai.indexOf('window.ptfAiClean = function(t)') > -1);
T('حذف بلوک کد و Markdown', ai.indexOf("replace(/```[a-z]*\\n?/gi") > -1 && ai.indexOf('\\*\\*(.+?)\\*\\*') > -1);
T('استخراج body از JSON دورریز', ai.indexOf('pj.body || pj.text || pj.sum') > -1);
T('حذف کاراکترهای کنترلی', ai.indexOf('u0000-') > -1 || /\\u0000/.test(ai));
T('اکشن اختصاصی letter در llm.php', llm.indexOf("case 'letter':") > -1 && llm.indexOf('NO markdown symbols') > -1);
T('letter: بدنه خالص — بسم/امضا سمت کلاینت', llm.indexOf('Do NOT include بسمه تعالی') > -1);
T('aiWB_letterGo از اکشن letter استفاده می‌کند', ai.indexOf("llmPost('letter',{prompt:prompt,to_name:name") > -1);
T('ترفند قدیمی summarize حذف شد', ai.indexOf('translate hack') === -1 && ai.indexOf('fallback به summarize') === -1);
T('پاک‌ساز روی بدنه نامه', ai.indexOf('body = ptfAiClean(body);') > -1);
T('پاک‌ساز روی خلاصه‌ساز', ai.indexOf('esc(ptfAiClean(d.sum||\'\'))') > -1);
T('پاک‌ساز روی بررسی قرارداد', ct.indexOf('ptfAiClean(d.data.final)') > -1);

SECTION('US-379: رفتار پاک‌ساز');
var mClean = ai.match(/window\.ptfAiClean = function[\s\S]*?\n\};/);
T('تابع استخراج شد', !!mClean);
if (mClean) {
  eval(mClean[0]);
  T('Markdown بولد حذف می‌شود', ptfAiClean('**سلام** دنیا') === 'سلام دنیا');
  T('JSON دورریز → body', ptfAiClean('{"subject":"x","body":"متن نامه"}') === 'متن نامه');
  T('بلوک کد حذف می‌شود', ptfAiClean('```json\nمتن\n```').indexOf('```') === -1);
  T('\\n خام → خط جدید واقعی', ptfAiClean('اول\\nدوم') === 'اول\nدوم');
  T('بولت → خط تیره فارسی', ptfAiClean('* بند') === '— بند');
}

SECTION('US-362: نام انگلیسی + رابط خرید (AC1..AC8)');
T('ocr سرور: coEn برمی‌گرداند', llm.indexOf("'coEn = professional English translation") > -1);
T('ocr سرور: buyer فقط نقش خرید (AC6)', llm.indexOf('PURCHASING/PROCUREMENT contact person ONLY') > -1 && llm.indexOf('Do NOT return managing directors') > -1);
T('ocr سرور: buyerEn با واکه‌گذاری استاندارد', llm.indexOf('مراد → Morad') > -1);
T('AC8: مسیر ocr = همه فایل‌ها (pdf/عکس)', llm.indexOf('"co":"","coEn":"","buyer":"","buyerEn":"","buyerRole":""') > -1);
T('کلاینت: detected شامل coEn/buyer/buyerEn/buyerRole', ai.indexOf('coEn: (d.data&&d.data.coEn') > -1 && ai.indexOf('buyer: (d.data&&d.data.buyer') > -1);
T('AC7: پیشنهاد رابط با پیش‌نمایش fa+en+سمت و تیک تایید', ai.indexOf('id="aiTP_buyer"') > -1 && ai.indexOf('رابط خرید شناسایی‌شده') > -1);
T('AC7: بدون تایید کاربر ثبت نمی‌شود', ai.indexOf("var doBuyer=(document.getElementById('aiTP_buyer')||{}).checked||false;") > -1 && ai.indexOf('if(doBuyer && det.buyer && custCd)') > -1);
T('AC7: ضدتکرار رابط هم‌نام', ai.indexOf('cB.people.some(function(pp){ return (pp.nm||\'\').trim() === det.buyer; })') > -1);
T('AC2: coEn روی مشتری جدید دستیار', ai.indexOf('coEn:(det.coEn||\'\')') > -1);
T('AC6: نام EN رابط همراه ثبت می‌شود', ai.indexOf("nmEn: det.buyerEn||''") > -1 && ai.indexOf("role: det.buyerRole||'کارشناس خرید'") > -1);
T('AC3: چاپ — اولویت nmEn ذخیره‌شده بر ترانویسی', wf.indexOf('_px ? _px.nmEn : ptfNameToEn(o2.buyerContact)') > -1);
T('AC4: دکمه تولید نام EN با AI در فرم مشتری', of.indexOf('ptfGenCoEn()') > -1 && of.indexOf('window.ptfGenCoEn = function ()') > -1);
T('AC5: fallback بدون AI (ترانویسی)', of.indexOf('var fallback = (typeof ptfCoToEn === \'function\')') > -1);
T('offerPickContact از nmEn استفاده می‌کند (موجود از قبل)', of.indexOf('_offState.buyerContact = p.nmEn || p.nm;') > -1);

SECTION('US-360: ترانویسی دقیق نام‌ها');
T('فرهنگ نام‌ها NAME_DICT', wf.indexOf('var NAME_DICT = {') > -1 && wf.indexOf("'مراد': 'Morad'") > -1);
T('واکه‌گذاری vowelize برای ناشناخته‌ها', wf.indexOf('function vowelize(out)') > -1);
T('فرهنگ اولویت اول در fa2enWord', /fa2enWord\(w\) \{[\s\S]*?NAME_DICT\[w\]/.test(wf));
T('ptfFa2EnWord برای تست بیرونی', wf.indexOf('window.ptfFa2EnWord = fa2enWord;') > -1);
T('ترتیب انگلیسی نام سازمان (مضاف معکوس)', wf.indexOf('ORG_TYPES') > -1 && wf.indexOf('en.reverse()') > -1);
T('لاتین دستی هرگز بازنویسی نمی‌شود (رگرسیون)', wf.indexOf("if (!s) return '';\n    if (!/[\\u0600-\\u06FF]/.test(s)) return s; // از قبل لاتین") > -1 || wf.indexOf('از قبل لاتین') > -1);

SECTION('US-360: رفتار ترانویسی');
global.window = global;
global.document = { createElement: function(){return {style:{}};}, head:{appendChild:function(){}}, querySelectorAll: function(){return [];}, getElementById: function(){return null;}, addEventListener: function(){} };
try { eval(wf); } catch (e) {}
T('مراد → Morad (نه Mrad)', typeof ptfFa2EnWord === 'function' && ptfFa2EnWord('مراد') === 'Morad');
T('محمد → Mohammad', ptfFa2EnWord('محمد') === 'Mohammad');
T('نام کامل با لقب', typeof ptfNameToEn === 'function' && ptfNameToEn('آقای مراد پورشاد') === 'Mr. Morad Pourshad');
T('نام ناشناخته بی‌واکه نمی‌ماند', /[aeiou]/.test(ptfFa2EnWord('برزو')));
T('شرکت: مجتمع صنایع فولاد پاسارگاد → Pasargad Steel Industries Complex', typeof ptfCoToEn === 'function' && ptfCoToEn('مجتمع صنایع فولاد پاسارگاد') === 'Pasargad Steel Industries Complex');
T('شرکت با پیشوند «شرکت» → Co.', ptfCoToEn('شرکت پیشرو تجهیز فرتاک') === 'Pishro Tajhiz Fartak Co.');
T('لاتین دست‌نخورده', ptfCoToEn('Pasargad Steel Co.') === 'Pasargad Steel Co.');

SECTION('نسخه و کش');
T('VER الگوی v1x', /var VER = 'v\d+\.\d/.test(idx));
T('کش sw هم‌خانواده ptf-crm-v1', /ptf-crm-v\d+\.\d/.test(sw));
/* قاعده تسترها: قفل نکردن نسخه دقیق — فقط «همان یا جدیدتر از 14.4» */
T('cache-bust فایل‌های اسپرینت ج (>=14.4)', ['ai-workbench.js', 'workflow.js', 'contracts.js', 'offers.js'].every(function (f) {
  var m = idx.match(new RegExp(f.replace(/[.-]/g, '\\$&') + '\\?v=(\\d+)\\.(\\d+)'));
  return m && (+m[1] > 14 || (+m[1] === 14 && +m[2] >= 4));
}));

DONE('tester64-v144');
