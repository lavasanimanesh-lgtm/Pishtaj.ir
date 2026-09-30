#!/usr/bin/env node
'use strict';
/* =============================================================================
   tester684 — v34.39.44 (SUP-FORM-HEADER)
   گزارش کارفرما: «در صفحهٔ ثبت‌نام تامین‌کنندگان یک بهم‌ریختگی در هدر فرم دیده می‌شود.»

   سه ریشه، همه در لایهٔ CSS/ساختار `supplier/index.html`:
   ① بلوک راهنمای روشن (`background:#ecfeff`) داخل `.sup-header` با پس‌زمینهٔ گرادیانِ
      تیره رها شده بود. رنگ متن از `.sup-header{color:#fff}` ارث می‌برد ⇒ متنِ سفید روی
      سیانِ تقریباً سفید (نسبت کنتراست ≈ ۱٫۰۵) عملاً نامرئی، و `text-align:center`
      پاراگرافِ چندسطریِ RTL را دندانه‌دار می‌کرد.
   ② قاعدهٔ سراسری `h1{…line-height:1.16;letter-spacing:-1.7px}` در style.css برای تیترِ
      لاتینِ هیرو نوشته شده و روی `.sup-header h1` نیز اثر می‌کرد: حروف فارسی به هم
      فشرده و چشم‌انداز سرِ سطرها قفل می‌شد (خودِ «بهم‌ریختگی»).
   ③ `@media(max-width:500px){h1{font-size:28px!important}}` بر `.sup-header h1{font-size:26px}`
      می‌چربید ⇒ عنوانِ کارت در موبایل از دسکتاپ بزرگ‌تر و سرِ دوخط می‌شد.
   (④ جدا: `.ptf-bc` زیر هدرِ fixed پنهان بود و ۱۴۰px فاصلهٔ بالای کارت فضای مرده می‌ساخت.)

   پیگرد (همان برنچ، SUP-NOTICE-DROP): کارفرما «متن «🔎 به دنبال تامین‌کننده … هستید؟»
   کلاً پاک شود» را خواست ⇒ بلوک یادداشت از صفحه حذف شد (نه جابه‌جایی). این تست همان را
   پین می‌کند: نه نشانهِ‌ای از بلوک بماند (markup + CSS)، نه چیزی از محتوای دیگرِ صفحه برود.
   پیوند‌های `/suppliers/` و `/services/` که در آن بلوک بود، در ناو/فوترِ پوسته همچنان هستند
   ⇒ حذف بلوک، گراف پیوند داخلی را نمی‌شکند (سنجهٔ ۱٫۴).

   قرارداد تست: کشکیدنِ واقعیِ CSS (اختصاص + !important + ترتیب فایل + مدیای زنده) روی
   قواعدِ style.css / discover.css / <style> صفحه / site-shell.css — نه فقط regex.
   روی کدِ پیش از اصلاح FAIL می‌شود.
   ============================================================================= */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
var p = 0, f = 0;
function T(n, c) { if (c) { p++; console.log('PASS', n); } else { console.error('FAIL', n); f++; } }
function SECTION(s) { console.log('\n── ' + s + ' ──'); }

/* ────────────────────────── مینی‌کِسکید (CSS cascade) ────────────────────────── */
var PAGE = read('supplier/index.html');
var STYLE = read('assets/css/style.css');
var DISCOVER = read('assets/css/discover.css');
var SHELL = read('assets/css/site-shell.css');
var INLINE = (function () { var m = PAGE.match(/<style>([\s\S]*?)<\/style>/); return m ? m[1] : ''; })();
/* ترتیب واقعی <head>: style.css → <style> صفحه → discover.css → site-shell.css */
var SOURCES = [STYLE, INLINE, DISCOVER, SHELL];

/* استخراج قاعده‌ها به همراه شرطِ @media والد (تودرتو یک‌سطری کافی است) */
function rules(src) {
  src = src.replace(/\/\*[\s\S]*?\*\//g, ' ');   /* { } داخل توضیحات نباید کاسکید را گم کند */
  var out = [];
  function walk(text, media) {
    var j = 0;
    while (j < text.length) {
      var at = text.indexOf('@', j);
      var brace = text.indexOf('{', j);
      if (brace < 0) break;
      if (at > -1 && at < brace) {
        var head = text.slice(at, brace).trim(), close = matchBrace(text, brace);
        if (/^@media\b/.test(head)) walk(text.slice(brace + 1, close), media.concat([head.slice(6).trim()]));
        j = close + 1; continue;
      }
      var selEnd = text.lastIndexOf('}', brace - 1) + 1;
      var close2 = matchBrace(text, brace);
      var sel = text.slice(selEnd, brace).replace(/\/\*[\s\S]*?\*\//g, '').trim();
      var body = text.slice(brace + 1, close2);
      if (sel && !/^(?:@|\/\*)/.test(sel) && body.indexOf('{') < 0) {
        sel.split(',').forEach(function (s) {
          var decls = body.replace(/\/\*[\s\S]*?\*\//g, '').split(';').map(function (d) {
            var k = d.indexOf(':'); if (k < 0) return null;
            var prop = d.slice(0, k).trim().toLowerCase(), val = d.slice(k + 1).trim();
            var imp = /!\s*important\s*$/i.test(val);
            return { prop: prop, val: val.replace(/\s*!\s*important\s*$/i, ''), important: imp };
          }).filter(Boolean);
          out.push({ sel: s.trim(), media: media, decls: decls });
        });
      }
      j = close2 + 1;
    }
    return out;
  }
  function matchBrace(t, from) {
    var d = 0, k = from;
    for (; k < t.length; k++) { if (t[k] === '{') d++; else if (t[k] === '}') { d--; if (!d) return k; } }
    return t.length;
  }
  return walk(src, []);
}
var ALL = [];
SOURCES.forEach(function (src, order) { rules(src).forEach(function (r) { r.order = order; ALL.push(r); }); });

function specificity(sel) {
  var s = sel.replace(/\[[^\]]*\]/g, '[a]').replace(/:[a-z-]+(\([^)]*\))?/g, '.x');
  var id = (s.match(/#[\w-]+/g) || []).length;
  var cls = (s.match(/\.[\w-]+/g) || []).length;
  var ty = (s.replace(/[.#][\w-]+/g, '').match(/[a-zA-Z][\w-]*/g) || []).length;
  return [id, cls, ty];
}
function cmpSpec(a, b) { for (var i = 0; i < 3; i++) { if (a[i] !== b[i]) return a[i] - b[i]; } return 0; }
function mediaOk(cond, w) {
  var mw = cond.match(/\(\s*max-width\s*:\s*(\d+)(?:\.\d+)?px\s*\)/);
  var nw = cond.match(/\(\s*min-width\s*:\s*(\d+)(?:\.\d+)?px\s*\)/);
  if (mw && !(w <= +mw[1])) return false;
  if (nw && !(w >= +nw[1])) return false;
  return true;
}
/* مقدار مؤثر یک خصوصیت برای عنصری که سلکتورهای matches با آن تطبیق می‌کنند */
function valueFor(prop, matches, width, dark) {
  var best = null;
  ALL.forEach(function (r) {
    if (!matches(r.sel)) return;
    if (r.media.some(function (m) { return !mediaOk(m, width); })) return;
    if (r.sel.indexOf('ptf-dark') > -1 && !dark) return;
    if (r.sel.indexOf('ptf-dark') === -1 && dark && /\bhtml\.ptf-dark\b/.test(r.sel)) return;
    var d = r.decls.filter(function (x) { return x.prop === prop; })[0];
    if (!d) return;
    var cand = { sel: r.sel, val: d.val, important: d.important, spec: specificity(r.sel), order: r.order };
    if (!best) { best = cand; return; }
    var better = (cand.important && !best.important) ||
      (!cand.important === !best.important && (cmpSpec(cand.spec, best.spec) > 0 ||
        (cmpSpec(cand.spec, best.spec) === 0 && cand.order >= best.order)));
    if (better) best = cand;
  });
  return best ? best.val : '';
}
function px(v) { v = String(v || '').trim(); if (/^-?[\d.]+$/.test(v)) return parseFloat(v); var m = /(-?[\d.]+)px/.exec(v); return m ? parseFloat(m[1]) : NaN; }

/* کنتراست WCAG بین دو رنگ */
function rgb(v) {
  v = (v || '').trim();
  var m = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (m) { var h = m[1]; if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  m = v.match(/rgba?\(([^)]+)\)/i);
  if (m) { var a = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat); return [a[0], a[1], a[2]]; }
  return null;
}
function ratio(fg, bg) {
  var a = rgb(fg), b = rgb(bg); if (!a || !b) return 0;
  function lin(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function L(c) { return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]); }
  var l1 = L(a), l2 = L(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

var H1 = function (sel) { return /^(?:h1|\.sup-header h1)$/.test(sel) || /^html\.ptf-dark .*h1/.test(sel); };
var HEADER = function (sel) { return /^(?:\.sup-header|html\.ptf-dark \.sup-header)$/.test(sel); };
var NOTICE = function (sel) { return /^(?:\.sup-notice|html\.ptf-dark \.sup-notice)$/.test(sel); };

/* ────────────────────────── ۱) ساختار هدر: هیچ بلوک روشنی داخلش نیست ────────────────────────── */
SECTION('ساختار هدر فرم');
var hStart = PAGE.indexOf('<div class="sup-header">');
var bStart = PAGE.indexOf('<div class="sup-body">');
var headerHtml = hStart > -1 && bStart > hStart ? PAGE.slice(hStart, bStart) : '';
T('۱.۰ بلوک sup-header و sup-body هر دو یافت شدند', hStart > -1 && bStart > -1);
T('۱.۱ هیچ پس‌زمینهٔ روشنی (ecfeff/a5f3fc/inline background) داخل هدرِ تیره نمانده',
  /class="sup-header"/.test(headerHtml) && !/#ecfeff|#a5f3fc|background:#/.test(headerHtml));
T('۱.۲ هدر فقط شامل عنوان و توضیح است (h1 + p، بدون div/aside)',
  (headerHtml.match(/<h1\b/g) || []).length === 1 && (headerHtml.match(/<p\b/g) || []).length === 1 &&
  !/<div\b|<aside\b|<section\b/.test(headerHtml.slice(headerHtml.indexOf('sup-header') > -1 ? 25 : 0).replace('<div class="sup-header">', '')));
/* نسخهٔ بدون توضیح: توضیحاتِ خودِ فایل می‌توانند نام کلاس/رنگ را ذکر کنند */
var PAGE_NC = PAGE.replace(/<!--[\s\S]*?-->/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');
T('۱.۳ یادداشت «🔎 به دنبال تامین‌کننده … هستید؟» کلاً حذف شده (markup و CSS)',
  /sup-notice/.test(PAGE_NC) === false &&
  PAGE_NC.indexOf('به دنبال تامین‌کننده تجهیزات صنعتی هستید؟') === -1 &&
  /#ecfeff|#a5f3fc/.test(PAGE_NC) === false &&
  (PAGE_NC.match(/<aside/g) || []).length === 0);
T('۱.۴ حذف، فقط همان بلوک را برداشته: تیتر/توضیح سرِ جایش و فرم بی‌واسطه بعد از هدر است',
  PAGE.indexOf('سامانه ثبت‌نام تامین‌کنندگان و انبارداران صنعتی') > -1 &&
  /<\/h1>\s*\n\s*<p>پیوستن به شبکه رسمی زنجیره تامین/.test(PAGE) &&
  /<div class="sup-body">\s*\n\s*<form id="supplierForm"/.test(PAGE) &&
  PAGE.indexOf('href="/suppliers/"') > -1 && PAGE.indexOf('href="/services/"') > -1);
T('۱.۵ تگ‌های صفحه متوازن و بدون کاراکتر خرابِ انکدینگ',
  PAGE.split('<div').length === PAGE.split('</div>').length && PAGE.split('<aside').length === PAGE.split('</aside>').length && PAGE.indexOf('\ufffd') === -1);

/* ────────────────────────── ۲) کشکیدنِ واقعی: تیتر هدر ────────────────────────── */
SECTION('عنوان هدر (کشکیدن واقعی style.css + <style> صفحه)');
var ls = px(valueFor('letter-spacing', H1, 1280, false));
var lh = parseFloat(valueFor('line-height', H1, 1280, false)) || NaN;
T('۲.۱ letter-spacingِ منفیِ هیرو (−۱٫۷px) روی تیترِ فارسی بی‌اثر شده', !isNaN(ls) && ls >= 0);
T('۲.۲ line-height برای فارسی باز شده (≥ ۱٫۴)', !isNaN(lh) && lh >= 1.4);
var fsDesktop = px(valueFor('font-size', H1, 1280, false));
var fsSmall = px(valueFor('font-size', H1, 420, false));
T('۲.۳ در ≤۵۰۰px عنوان از دسکتاپ بزرگ‌تر نمی‌شود (clamp بر !important سراسری چربید)',
  !isNaN(fsDesktop) && !isNaN(fsSmall) && fsSmall <= fsDesktop && fsSmall <= 26 && fsSmall >= 18);
T('۲.۴ تیتر در روز و شب روی پس‌زمینهٔ تیره خواناست (کنتراست ≥ ۴٫۵)',
  ratio(valueFor('color', H1, 1280, false), '#2b2e34') >= 4.5 && ratio(valueFor('color', H1, 1280, true), '#2b2e34') >= 4.5);
T('۲.۵ توضیح زیرِ تیتر هم کنتراست کافی دارد',
  ratio(valueFor('color', HEADER, 1280, false), '#2b2e34') >= 3);

/* ────────────────────────── ۳) هیچ ردّ پایی از بلوکِ حذف‌شده نمی‌ماند ────────────────────────── */
SECTION('پاک‌سازی بعد از حذف بلوک');
(function () {
  var style = (PAGE.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1].replace(/\/\*[\s\S]*?\*\//g, ' ');
  var selectors = [];
  style.split('}').forEach(function (chunk) {
    var at = chunk.indexOf('{'); if (at < 0) return;
    var head = chunk.slice(0, at).trim();
    if (/^@/.test(head)) return;
    head.split(',').forEach(function (x) { selectors.push(x.trim()); });
  });
  var markup = PAGE.slice(PAGE.indexOf('<body'));
  var orphans = selectors.filter(function (sel) {
    return (sel.match(/\.[a-z][\w-]*/gi) || []).some(function (c) {
      c = c.slice(1);
      return c !== 'ptf-dark' && c !== 'sup-wrap' && c !== 'scrolled' &&
        markup.indexOf('"' + c) === -1 && markup.indexOf(c + ' ') === -1 && markup.indexOf(' ' + c) === -1 &&
        markup.indexOf(c + '"') === -1;
    });
  });
  T('۳.۱ هیچ سلکتور بی‌مالکی از بلوکِ حذف‌شده در <style> صفحه نمانده', orphans.length === 0);
  T('۳.۲ <style> صفحه هنوز آکولادِ متوازن و زیر بودجه دارد',
    style.split('{').length === style.split('}').length && style.length < 6000);
  var bodyPad = /\.sup-body\s*\{[^}]*padding:\s*38px 40px/.test(style) ? true : false;
  T('۳.۳ بدنهٔ فرم بدون بلوکِ میانی، همان padding را نگه داشته (فرم بی‌درنگ بعد از هدر شروع می‌شود)', bodyPad);
})();
T('۳.۴ عنوان هدر در روز و شب روی گرادیان تیره کنتراست AA دارد (بی‌تغییری بعد از حذف بلوک)',
  ratio(valueFor('color', H1, 1280, false), '#2b2e34') >= 4.5 &&
  ratio(valueFor('color', H1, 1280, true), '#2b2e34') >= 4.5);
T('۳.۵ توضیح زیر تیتر هم خواناست و وسط‌چینِ محدودبه‌عرض است (بدون پاراگرافِ دندانه‌دارِ اضافی)',
  ratio(valueFor('color', HEADER, 1280, false), '#2b2e34') >= 3 &&
  /max-width:\s*640px/.test((ALL.filter(function (r) { return /^\.sup-header p$/.test(r.sel); })[0] || { decls: [] }).decls.map(function (d) { return d.prop + ':' + d.val; }).join(';')));

/* ────────────────────────── ۴) بالای صفحه: هدر/نوار مسیر ────────────────────────── */
SECTION('تنفس بالای صفحه');
var bcM = px(valueFor('margin-top', function (s) { return /^\.ptf-bc$/.test(s); }, 1280, false));
var bcM720 = px(valueFor('margin-top', function (s) { return /^\.ptf-bc$/.test(s); }, 720, false));
T('۴.۱ نوار مسیر از زیر هدرِ fixed خارج می‌شود (≈ ارتفاع هدر ۸۶ / موبایل ۷۶)', bcM >= 80 && bcM720 >= 70 && bcM720 <= 80);
T('۴.۲ فاصلهٔ مردهٔ ۱۴۰px بالای کارت حذف شد', /margin:\s*140px auto/.test(INLINE) === false);
T('۴.۳ اصلاح، صفحه‌محور است: discover.css و site-shell.css دست‌نخورده‌اند',
  /\.ptf-bc\{background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:8px 0;font-size:13px\}/.test(DISCOVER) &&
  DISCOVER.indexOf('margin-top: 86px') === -1 && DISCOVER.indexOf('margin-top:86px') === -1);

/* ────────────────────────── ۵) قرارداد حفاظت‌شدهٔ فرم (تستر۵۸۹/RCA پیوست) ────────────────────────── */
SECTION('رگرسیون‌زدا: هیچ چیز دیگری از فرم جابه‌جا نشد');
T('۵.۱ میدان‌ها/شناسه‌های قراردادِ ثبت‌نام و رسیدِ پیوست دست‌نخورده',
  ['id="supplierForm"', 'id="sCode"', 'id="sComp"', 'id="sName"', 'id="sPhone"', 'id="sEmail"', 'id="sCat"',
   'id="sPayTerms"', 'id="sCreditRange"', 'id="sBrands"', 'id="sAttach"', 'id="sFileInfo"', 'id="supCaptcha"',
   'id="supOtp"', 'id="supStatus"', 'id="resBox"', 'id="venCode"', 'id="venWarning"', 'id="venAttach"']
    .every(function (k) { return PAGE.indexOf(k) > -1; }));
T('۵.۲ pینِ accept فایل (قرارداد v34.36.2) بدون تغییر',
  PAGE.indexOf('accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.zip,.rar"') > -1);
T('۵.۳ هم‌راستایی ارتفاع فیلدهای v34.7.78 دست‌نخورده',
  /\.sup-body \.field > select \{ height: 52px; \}/.test(INLINE.replace(/\n\s*/g, ' ')) ||
  /height: 52px/.test(INLINE) && /appearance: none !important/.test(INLINE));
T('۵.۴ اسکریپتِ داخل صفحه سینتکساً سالم و بدون تغییرِ مسیر ارسال',
  /action="\.\.\/api\/crm\.php\?action=add_supplier"/.test(PAGE) && /enctype="multipart\/form-data"/.test(PAGE));
T('۵.۵ بودجهٔ صفحه: <style> صفحه ≤ ۶۰۰۰ نویسه و آکولاد‌ها متوازن',
  INLINE.length <= 6000 && INLINE.split('{').length === INLINE.split('}').length);

console.log('');
console.log('PASS: ' + p + ' / FAIL: ' + f);
process.exit(f ? 1 : 0);
