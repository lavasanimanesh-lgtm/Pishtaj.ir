/* =====================================================================
   tester590 — v34.37.2 (AI-JSON-REPAIR): «خروجی AI ساختار JSON معتبر ندارد
   (پاسخ قابل تجزیه نبود)» در مدیریت سایت
   ---------------------------------------------------------------------
   شکایت مالک: هر کاری با هوش مصنوعی در «مدیریت سایت» می‌خواست انجام دهد،
   همین پیام را می‌دید و بن‌بست می‌خورد.

   RCA:
     B1) اکشن‌های سئوی مدیریت سایت (seo_fix در ویزارد گروهی، seo_review،
         seo_expand، seo_clusters، seo_intlinks، seo_alt) با llm_call تک‌ضربه
         اجرا می‌شدند ⇒ بدون salvage+retry که از v34.20.0 فقط برای
         seo_meta/seo_product/seo_article فعال بود.
     B2) سقف توکنِ بعضی اکشن‌ها عملاً همیشه کوتاه بود (seo_intlinks=700،
         seo_alt=900، seo_expand=4000 برای مقالهٔ ۱۲۰۰+ کلمهٔ HTML) و در
         مدل‌های استدلالیِ Gemini «فکر کردن» هم از همان maxOutputTokens خرج
         می‌شود ⇒ پاسخ JSON وسط رشته/آبجکت بریده می‌شد.
     B3) llm_json_salvage فقط سه لایه داشت (تجزیهٔ کامل / استخراج {..} /
         حذف کامای انتهایی) ⇒ JSONِ بریده را هیچ‌کدام نجات نمی‌داد.
     B4) دلیل توقف مدل (finishReason) فقط وقتی متن «خالی» بود خوانده می‌شد ⇒
         بریدنِ پاسخ هیچ نشانه‌ای نداشت و پیام خطا علت را نمی‌گفت.
     B5) CMS فقط d.error را نشان می‌داد و نمونهٔ خامِ خروجی مدل (raw) دور
         ریخته می‌شد ⇒ حتی پشتیبانی هم نمی‌توانست تشخیص دهد چه شده.

   سیاست تعمیر (در کد و در این تستر مستند است):
     «بیشترین محتوای ممکن، بدون عضو پوچ» — ابتدا همان نقطهٔ بریدگی بسته
     می‌شود (تا متنِ بریدهٔ یک مقدار بلند، مثل بدنهٔ مقاله، دور ریخته نشود)؛
     اگر آن جوابِ معتبر نبود، به مرزهای امن برمی‌گردیم و عضوِ نیمه‌کارهٔ
     انتهایی پله‌پله پوست کنده می‌شود. نتیجهٔ تهی ({}) هرگز پذیرفته نمی‌شود
     ⇒ دادهٔ ساختگی ساخته نمی‌شود. همهٔ خروجی‌های AI در CMS پیش از اعمال،
     بازبینی انسانی دارند (confirm/جای‌گذاری در فیلد قابل ویرایش).

   این تستر:
     ۱) پورتِ وفادارِ JS از لایه‌های نجات/تعمیر را روی نمونه‌های واقعیِ پاسخِ
        بریده اجرا می‌کند (پیمایش آگاهانه به رشته/گریز، بستن براکت‌ها، پوست‌کردن).
     ۲) cmsAiDiag را در VM اجرا می‌کند: پیام عملیاتی + ثبت نمونهٔ خام.
     ۳) قرارداد سرور (مسیر llm_call_json برای همهٔ اکشن‌های سئو، سقف‌های تازه،
        finish، payload خطا) را پین می‌کند.
   هیچ فایل مخزنی را تغییر نمی‌دهد.
   ===================================================================== */
'use strict';
var fs = require('fs');
var vm = require('vm');

var llm = fs.readFileSync('api/llm.php', 'utf8');
var cms = fs.readFileSync('crm/cms.js', 'utf8');
var gate = fs.readFileSync('_tools/uat/run-ci-gate.js', 'utf8');
var ver = JSON.parse(fs.readFileSync('VERSION.json', 'utf8'));
var sampleCfg = fs.readFileSync('llm-config.sample.php', 'utf8');

var p = 0, f = 0;
function T(name, cond, extra) {
  if (cond) { p++; console.log('PASS ' + name); }
  else { f++; console.log('FAIL ' + name + (extra ? ' — ' + extra : '')); }
}
function blk(src, a, b) {
  var i = src.indexOf(a);
  if (i < 0) return '';
  var j = b ? src.indexOf(b, i + a.length) : -1;
  return j > i ? src.slice(i, j) : src.slice(i);
}

/* ═══════════ پورت JS از لایه‌های نجات (همان منطق api/llm.php) ═══════════
   نکته: PHP روی بایت کار می‌کند و JS روی واحد کد؛ چون همهٔ جداکننده‌های JSON
   ({ } [ ] " \ و ارقام) ASCII هستند و بایت‌های ادامهٔ UTF-8 هرگز با ASCII
   برابر نمی‌شوند، این پورت برای متن فارسی هم همان رفتار را دارد. */
function stripFences(t) {
  t = String(t == null ? '' : t).trim();
  t = t.replace(/```(?:json|javascript|js)?\s*/gi, '');
  t = t.split('```').join('');
  return t.trim();
}
function scan(t) {
  t = String(t == null ? '' : t);
  var n = t.length, start = -1, i;
  for (i = 0; i < n; i++) { if (t[i] === '{' || t[i] === '[') { start = i; break; } }
  if (start < 0) return null;
  var stack = [], inStr = false, esc = false;
  for (i = start; i < n; i++) {
    var c = t[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === '{' || c === '[') { stack.push(c); continue; }
    if (c === '}' || c === ']') {
      if (stack.length) stack.pop();
      if (!stack.length) return { json: t.slice(start, i + 1), complete: true, stack: [], inStr: false };
    }
  }
  return { json: t.slice(start), complete: false, stack: stack, inStr: inStr };
}
function closeTail(s) {
  var stack = [], inStr = false, esc = false, i, c;
  for (i = 0; i < s.length; i++) {
    c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{' || c === '[') stack.push(c);
    else if (c === '}' || c === ']') { if (stack.length) stack.pop(); }
  }
  var tail = inStr ? '"' : '';
  for (i = stack.length - 1; i >= 0; i--) tail += (stack[i] === '{') ? '}' : ']';
  return tail;
}
function peel(s, level) {
  var cand = String(s == null ? '' : s).replace(/[,\s]+$/, '').replace(/:\s*$/, '').replace(/[,\s]+$/, '');
  for (var k = 0; k < level; k++) {
    var before = cand;
    cand = cand.replace(/"[^"]*$/, '');       /* رشتهٔ ناتمامِ انتهایی */
    cand = cand.replace(/:\s*$/, '');         /* «کلید»: بی‌مقدار */
    cand = cand.replace(/"[^"]*"$/, '');      /* کلیدِ تنها */
    cand = cand.replace(/,\s*[{[]\s*$/, '');  /* «,{» یا «,[» خالی */
    cand = cand.replace(/[{[]\s*$/, '');      /* براکت خالی انتهایی */
    cand = cand.replace(/[,\s]+$/, '');
    if (cand === before || cand === '') break;
  }
  return cand;
}
/* «محتوای واقعی» دارد؟ آرایه/آبجکت تهی و رشتهٔ خالی تنها = موفقیت پوچ ⇒ رد */
function meaningful(d) {
  if (!d || typeof d !== 'object') return false;
  var keys = Object.keys(d);
  if (!keys.length) return false;
  for (var i = 0; i < keys.length; i++) {
    var v = d[keys[i]];
    if (v && typeof v === 'object') { if (meaningful(v)) return true; continue; }
    if (typeof v === 'string') { if (v.trim() !== '') return true; continue; }
    return true; /* عدد/بولی/null */
  }
  return false;
}
function goodParse(txt) {
  var d = null;
  try { d = JSON.parse(txt); } catch (e) { d = null; }
  return meaningful(d) ? d : null;
}
var TAIL_BAD = /(:\s*"|[,{[])$/;
function repairTruncated(t) {
  var sc = scan(t);
  if (sc === null || sc.complete) return null;
  var s = sc.json;
  /* گام ۱: بستن در همان نقطهٔ بریدگی — مگر وقتی «کلید":" بی‌مقدار» عضو پوچ می‌سازد */
  if (!TAIL_BAD.test(s)) {
    var d0 = goodParse(s + closeTail(s));
    if (d0 !== null) return d0;
  }
  var d = null;
  var n = s.length, tries = 0;                    /* گام ۲: مرزهای امن + پوست‌کردن پله‌ای */
  for (var i = n; i > 0 && tries < 60; i--) {
    var c = s[i - 1];
    if (c !== '}' && c !== ']' && c !== '"' && c !== 'e' && !/[0-9]/.test(c)) continue;
    tries++;
    var base = s.slice(0, i);
    for (var lvl = 0; lvl <= 4; lvl++) {
      var cand = peel(base, lvl);
      if (cand === '') continue;
      if (lvl === 0 && TAIL_BAD.test(cand)) continue; /* عضو پوچ می‌سازد */
      d = goodParse(cand + closeTail(cand));
      if (d !== null) return d;
    }
  }
  return null;
}
function salvage(text) {
  var t = String(text == null ? '' : text).trim();
  if (t === '') return { d: null, how: '' };
  var d = goodParse(t);
  if (d !== null) return { d: d, how: 'direct' };
  var s = t.indexOf('{'), e = t.lastIndexOf('}');
  if (s > -1 && e > -1 && e > s) {
    d = goodParse(t.slice(s, e + 1));
    if (d !== null) return { d: d, how: 'extract' };
  }
  var t2 = t.replace(/,(\s*[\]}])/g, '$1');
  if (t2 !== t) {
    d = goodParse(t2);
    if (d !== null) return { d: d, how: 'trailing-comma' };
    s = t2.indexOf('{'); e = t2.lastIndexOf('}');
    if (s > -1 && e > -1 && e > s) {
      d = goodParse(t2.slice(s, e + 1));
      if (d !== null) return { d: d, how: 'trailing-comma+extract' };
    }
  }
  var t3 = stripFences(t2 || t);
  if (t3 !== t) {
    d = goodParse(t3);
    if (d !== null) return { d: d, how: 'fences' };
    s = t3.indexOf('{'); e = t3.lastIndexOf('}');
    if (s > -1 && e > -1 && e > s) {
      d = goodParse(t3.slice(s, e + 1));
      if (d !== null) return { d: d, how: 'fences+extract' };
    }
  }
  d = repairTruncated(t3);
  if (d !== null) return { d: d, how: 'repaired-truncated' };
  return { d: null, how: '' };
}

/* ═══════════ نمونه‌های واقعی پاسخِ بریدهٔ مدل (سقف توکن) ═══════════ */
var SEO_FIX_TRUNCATED = [
  '{"title":"خرید لوله فولادی A106 Gr.B | قیمت و موجودی",',
  '"desc":"تامین پروژه‌ای لوله فولادی بدون درز ASTM A106 Gr.B در سایزهای ۲ تا ۲۴ اینچ با گواهی بازرسی",',
  '"h1":"خرید لوله فولادی A106 Gr.B","fixes":[',
  '{"issue":"توضیح متا خالی است","action":"توضیح ۷۰ تا ۱۶۵ حرفی با اشاره به سایز و گواهی بازرسی نوشته شد"},',
  '{"issue":"H1 بلند است","action":"H1 به ۳۲ حرف کوتاه شد"},',
  '{"iss'
].join('');
var SEO_INTLINKS_TRUNCATED = [
  '{"links":[',
  '{"from":"/knowledge-center/astm-a106","anchor":"لوله A106","how":"در پاراگراف دوم"},',
  '{"from":"/products/pipe","anchor":"خرید لوله","how":"در فهرست منابع انتهای صفحه"},',
  '{"fr'
].join('');
var SEO_REVIEW_TRUNCATED = [
  '{"score":72,"verdict":"fix-first","issues":[',
  '{"severity":"high","issue":"توضیح متا خالی","fix":"توضیح ۱۴۰ حرفی بنویسید"},',
  '{"severity":"medium","issue":"لینک داخلی کم","fix":"سه لینک به صفحات دانش اضافه کنید"}],',
  '"missing_keywords":["فلنج","استاندارد API"],',
  '"internal_links":[{"anchor":"فلنج فولادی","target":"/knowledge-center/flange"'
].join('');
var SEO_ALT_TRUNCATED = [
  '{"alts":[',
  '{"src":"/assets/images/valve-1.jpg","alt":"شیر فلکه فولادی سایز ۲ اینچ"},',
  '{"src":"/assets/images/valve-2.jpg","alt":"شیر دروازه‌ای فولادی"},',
  '{"src":"/assets/ima'
].join('');
var EXPAND_TRUNCATED = [
  '{"title":"راهنمای انتخاب فلنج","desc":"راهنمای کامل انتخاب فلنج","h1":"راهنمای انتخاب فلنج",',
  '"body":"<h2>انواع فلنج</h2><p>فلنج‌ها بر اساس استاندارد ASME B16.5 دسته‌بندی می‌شوند</p>',
  '<h2>کلاس فشاری</h2><p>کلاس‌های ۱۵۰ تا ۲۵۰۰ بر اساس دما و فش'
].join('');
var CLUSTERS_OK = '{"clusters":[{"topic":"لوله فولادی","action":"optimize","why":"نمایش بالا و کلیک کم","queries":["لوله a106","قیمت لوله فولادی"],"target":"/products/pipe"}]}';
var FENCED = 'Sure! Here is the JSON you asked for:\n```json\n' + CLUSTERS_OK + '\n```\nLet me know if you need changes.';
var PROSE_ONLY = 'I cannot help with that request because it violates policy.';

console.log('── ۱) رفتار لایهٔ تعمیر روی پاسخ‌های واقعیِ بریده ──');
(function () {
  var r = salvage(SEO_FIX_TRUNCATED);
  T('۱.۱ seo_fix بریده نجات می‌یابد (پیش‌تر: خطای بن‌بست)', r.d !== null, r.how);
  T('۱.۲ عنوان و توضیح و H1 کاملِ پیشنهادی حفظ می‌شوند', !!r.d && r.d.title === 'خرید لوله فولادی A106 Gr.B | قیمت و موجودی' && r.d.h1 === 'خرید لوله فولادی A106 Gr.B' && typeof r.d.desc === 'string' && r.d.desc.length > 40, JSON.stringify(r.d && Object.keys(r.d)));
  T('۱.۳ اصلاحاتِ کاملِ پیش از بریدگی حفظ و عضو نیمه‌کاره حذف می‌شود', !!r.d && Array.isArray(r.d.fixes) && r.d.fixes.length === 2 && r.d.fixes[0].action.indexOf('۱۶۵ حرفی') > -1 && r.d.fixes[1].action === 'H1 به ۳۲ حرف کوتاه شد', JSON.stringify(r.d && r.d.fixes));
  T('۱.۴ لایهٔ به‌کاررفته «تعمیر بریدگی» است', r.how === 'repaired-truncated', r.how);

  var r2 = salvage(SEO_INTLINKS_TRUNCATED);
  T('۱.۵ seo_intlinks بریده (سقف قدیمی ۷۰۰ توکن) نجات می‌یابد', r2.d !== null && Array.isArray(r2.d.links) && r2.d.links.length === 2, JSON.stringify(r2.d && r2.d.links));
  T('۱.۶ هر دو لینکِ کامل نگه داشته می‌شوند و عضو بی‌انتها حذف', !!r2.d && r2.d.links[0].anchor === 'لوله A106' && r2.d.links[1].anchor === 'خرید لوله' && r2.d.links.every(function (l) { return l && l.from && l.how; }));

  var r3 = salvage(SEO_REVIEW_TRUNCATED);
  T('۱.۷ seo_review بریده نجات می‌یابد و امتیاز/مسائل قابل استفاده‌اند', r3.d !== null && r3.d.score === 72 && r3.d.verdict === 'fix-first' && r3.d.issues.length === 2, JSON.stringify(r3.d && r3.d.score));
  T('۱.۸ آرایهٔ ناتمام بسته می‌شود و عضوِ کاملِ آخر هم نجات می‌یابد', !!r3.d && Array.isArray(r3.d.internal_links) && r3.d.internal_links.length === 1 && r3.d.internal_links[0].target === '/knowledge-center/flange' && r3.d.missing_keywords.length === 2, JSON.stringify(r3.d && r3.d.internal_links));

  var r4 = salvage(SEO_ALT_TRUNCATED);
  T('۱.۹ seo_alt بریده نجات می‌یابد و altهای کامل می‌رسند', r4.d !== null && Array.isArray(r4.d.alts) && r4.d.alts.length >= 2 && r4.d.alts[1].alt === 'شیر دروازه‌ای فولادی', JSON.stringify(r4.d && r4.d.alts));
  T('۱.۱۰ متن فارسی و نویسهٔ چندبایتی پورت را نمی‌شکند', !!r4.d && String(r4.d.alts[0].alt).indexOf('شیر فلکه فولادی') === 0);
  T('۱.۱۱ عضو بریدهٔ انتهایی «alt» ندارد ⇒ در CMS بی‌اثر است (تطبیق با src و پرکردنِ فقط فیلد خالی)', !!r4.d && r4.d.alts.some(function (a) { return !a.alt; }) && /if \(p\.src === a\.src\)[\s\S]{0,120}if \(inp && !inp\.value\)/.test(cms));

  var r5 = salvage(EXPAND_TRUNCATED);
  T('۱.۱۲ seo_expand با بدنهٔ HTML بریده نجات می‌یابد و title/desc/h1 می‌رسند', r5.d !== null && r5.d.title === 'راهنمای انتخاب فلنج' && typeof r5.d.body === 'string' && r5.d.body.indexOf('<h2>') > -1, JSON.stringify(r5.d && Object.keys(r5.d)));
  T('۱.۱۳ بدنهٔ بریده دور ریخته نمی‌شود (سیاست: حذف ناخواستهٔ محتوا ممنوع)', !!r5.d && r5.d.body.indexOf('کلاس‌های ۱۵۰ تا ۲۵۰۰') > -1 && r5.d.body.slice(-1) !== '\\');
  T('۱.۱۴ خروجی گسترش پیش از اعمال، بازبینی انسانی دارد (confirm)', /cmsPgExpand[\s\S]{0,1500}confirm\(/.test(cms));
})();

console.log('\n── ۲) مرزها: مثبت کاذب نساختن و سالم‌ها را دست نزدن ──');
(function () {
  T('۲.۱ JSON سالم بدون دستکاری تجزیه می‌شود', salvage(CLUSTERS_OK).how === 'direct');
  T('۲.۲ پوشش markdown + پیشوند توضیحی مدل نجات می‌یابد', (function () { var r = salvage(FENCED); return r.d !== null && Array.isArray(r.d.clusters) && r.d.clusters[0].topic === 'لوله فولادی'; })());
  T('۲.۳ متنِ کاملاً غیر JSON → null (خطای دقیق، نه دادهٔ ساختگی)', salvage(PROSE_ONLY).d === null);
  T('۲.۴ ورودی خالی → null', salvage('').d === null && salvage(null).d === null);
  T('۲.۵ «{" تنها → آبجکت تهی برنمی‌گرداند (دادهٔ ساختگی ممنوع)', salvage('{"').d === null && salvage('{"tit').d === null && salvage('{').d === null);
  T('۲.۶ براکت/نقل‌قول داخل رشتهٔ مقدار، پیمایشگر را فریب نمی‌دهد', (function () {
    var r = salvage('{"a":"value with } and ] and \\" quote","b":2,"c":[1,2');
    return r.d !== null && r.d.a.indexOf('} and ]') > -1 && r.d.b === 2 && Array.isArray(r.d.c) && r.d.c.length === 2;
  })());
  T('۲.۷ گریزِ دوتایی (\\\\) درست پیمایش می‌شود', (function () {
    var r = salvage('{"path":"C:\\\\temp\\\\a.json","n":1,"tail":"natam');
    return r.d !== null && r.d.n === 1 && r.d.path.indexOf('temp') > -1 && r.d.tail === 'natam';
  })());
  T('۲.۸ کاماهای انتهایی (لایهٔ قدیمی) همچنان کار می‌کنند', (function () { var r = salvage('{"a":1,"b":[1,2,],}'); return r.d !== null && r.d.b.length === 2; })());
  T('۲.۹ آرایهٔ سطح‌بالای بریده هم تعمیر می‌شود (عضوهای کامل می‌مانند)', (function () { var r = salvage('[{"a":1},{"b":2},{"c":'); return r.d !== null && Array.isArray(r.d) && r.d.length === 2 && r.d[0].a === 1 && r.d[1].b === 2; })());
  T('۲.۱۰ عضو پوچ ساخته نمی‌شود («کلید":" بی‌مقدار»)', (function () { var r = salvage('{"title":"t","desc":"'); return r.d !== null && r.d.title === 't' && (!Object.prototype.hasOwnProperty.call(r.d, 'desc') || r.d.desc !== ''); })());
  T('۲.۱۱ پاسخ بریدهٔ خیلی کوتاه، «موفقیت پوچ» نمی‌سازد', salvage('{"a":').d === null && salvage('[{').d === null);
  T('۲.۱۲ عدد/مقدار بریده در انتهای آرایه بسته می‌شود', (function () { var r = salvage('{"q":[1,2,3'); return r.d !== null && r.d.q.length === 3; })());
  T('۲.۱۳ JSON تودرتوی سالمِ بریده در عمق، سطح‌های بیرونی را حفظ می‌کند', (function () {
    var r = salvage('{"a":{"b":{"c":[1,2,{"d":"x');
    return r.d !== null && r.d.a && r.d.a.b && r.d.a.b.c.length === 3 && r.d.a.b.c[2].d === 'x';
  })());
})();

console.log('\n── ۳) cmsAiDiag — پیام عملیاتی به‌جای بن‌بست (VM) ──');
var DIAG = blk(cms, 'function cmsAiDiag(', '\n  function cmsLLM(');
(function () {
  T('۳.۱ تابع تشخیص در cms.js وجود دارد', DIAG.indexOf('window.__ptfAiLast') > -1);
  var logs = [];
  var sb = {
    window: null,
    console: { error: function () { logs.push(Array.prototype.slice.call(arguments).map(String).join(' ')); } }
  };
  sb.window = sb;
  var ctx = vm.createContext(sb);
  vm.runInContext(DIAG + '\n;cmsAiDiag', ctx, { filename: 'cms.js#cmsAiDiag' });
  var diag = vm.runInContext('cmsAiDiag', ctx);

  var out1 = diag({ ok: false, error: 'خروجی AI ساختار JSON معتبر ندارد (پاسخ قابل تجزیه نبود) — پاسخ مدل به سقف توکن خورد', truncated: true, finish: 'MAX_TOKENS', model: 'gemini-2.5-flash', raw: '{"title":"...' }, 'seo_fix');
  T('۳.۲ پیام خطا عملیاتی می‌شود (کارِ بعدی می‌گوید)', /دوباره بزنید/.test(out1.error), out1.error);
  T('۳.۳ نمونهٔ خام + مدل + finish در window.__ptfAiLast نگه داشته می‌شود', sb.__ptfAiLast && sb.__ptfAiLast.raw === '{"title":"...' && sb.__ptfAiLast.finish === 'MAX_TOKENS' && sb.__ptfAiLast.model === 'gemini-2.5-flash' && sb.__ptfAiLast.action === 'seo_fix', JSON.stringify(sb.__ptfAiLast));
  T('۳.۴ نمونهٔ خام در کنسول ثبت می‌شود (برای پشتیبانی)', logs.length > 0 && logs[0].indexOf('[PTF AI] seo_fix') > -1 && logs[0].indexOf('نمونهٔ خام خروجی مدل') > -1, logs.join(' | ').slice(0, 120));
  T('۳.۵ زمان وقوع خطا ثبت می‌شود', sb.__ptfAiLast && /^\d{4}-\d{2}-\d{2}T/.test(sb.__ptfAiLast.at));

  logs = [];
  var out2 = diag({ ok: false, error: 'خروجی AI ساختار JSON معتبر ندارد (پاسخ قابل تجزیه بود)', raw: 'oops' }, 'seo_review');
  T('۳.۶ حالتِ غیربریده هم راهنمای تلاش دوباره + کنسول دارد', /یک بار دیگر بزنید/.test(out2.error) && /window\.__ptfAiLast/.test(out2.error), out2.error);
  T('۳.۷ پاسخ موفق دست‌نخورده عبور می‌کند', (function () { var ok = { ok: true, data: { title: 't' } }; return diag(ok, 'seo_meta') === ok; })());
  T('۳.۸ پاسخ نامعتبر/تهی هم به خطای خوانا تبدیل می‌شود', (function () { var r = diag(null, 'seo_meta'); return r && r.ok === false && String(r.error).length > 3; })());
  T('۳.۹ راهنما به پیامی که خودش راهنما دارد دوباره اضافه نمی‌شود', (function () {
    var once = diag({ ok: false, error: 'خطا — دوباره بزنید' }, 'seo_fix');
    var twice = diag(once, 'seo_fix');
    return (twice.error.match(/دوباره بزنید/g) || []).length === 1;
  })());
})();

console.log('\n── ۴) قرارداد سرور: همهٔ اکشن‌های سئو از مسیر مقاوم ──');
(function () {
  /* نخستین out_json پس از هر شاخهٔ اکشن — پرامپت‌های بلند، فاصله را از هر سقف
     ثابتِ {0,n} بیرون می‌برد، پس «نخستین فراخوانی بعد از شاخه» ملاک است. */
  function firstOutJsonAfter(marker) {
    var i = llm.indexOf(marker);
    if (i < 0) return '';
    var j = llm.indexOf('out_json(', i);
    return j > -1 ? llm.slice(j, j + 34) : '';
  }
  T('۴.۱ شمار اکشن‌های سئو روی llm_call_json = ۹', (llm.match(/out_json\(llm_call_json\(/g) || []).length === 9, String((llm.match(/out_json\(llm_call_json\(/g) || []).length));
  ['seo_review', 'seo_expand', 'seo_clusters', 'seo_intlinks', 'seo_alt', 'seo_meta', 'seo_product', 'seo_article'].forEach(function (a) {
    var call = firstOutJsonAfter("if ($action === '" + a + "')");
    T('۴.۲ ' + a + ' از llm_call_json (salvage+retry) عبور می‌کند', call.indexOf('out_json(llm_call_json(') === 0, call);
  });
  T('۴.۲ seo_fix (شاخهٔ پایانی بلوک سئو) از llm_call_json عبور می‌کند', firstOutJsonAfter('$user = "ایرادات گزارش‌شده').indexOf('out_json(llm_call_json(') === 0, firstOutJsonAfter('$user = "ایرادات گزارش‌شده'));
  T('۴.۳ هیچ اکشن سئویی روی llm_call تک‌ضربه نمانده است', !/if \(\$action === 'seo_[a-z]+'\)[\s\S]{0,9000}out_json\(llm_call\(\$cfg/.test(llm) && !/\$user = "ایرادات گزارش‌شده[\s\S]{0,300}out_json\(llm_call\(\$cfg/.test(llm));
  T('۴.۴ سقف توکن اکشن‌های کوچک بالا رفت (intlinks ۱۴۰۰ / alt ۱۸۰۰)', /seo_intlinks[\s\S]{0,6000}out_json\(llm_call_json\(\$cfg, \$sys, \$user, null, null, 1400\)\)/.test(llm) && llm.indexOf("out_json(llm_call_json($cfg, $sys, $user, null, null, 1800, ['images' => $pack]));") > -1);
  T('۴.۵ سقف توکن اکشن‌های بلند بالا رفت (clusters ۲۴۰۰ / review ۳۶۰۰ / fix ۲۸۰۰ / expand ۶۰۰۰)', [2400, 3600, 2800, 6000].every(function (n) { return llm.indexOf('out_json(llm_call_json($cfg, $sys, $user, null, null, ' + n + '));') > -1; }));
  T('۴.۶ سازگاری: seo_product همچنان ۱۶۰۰ و seo_article همچنان ۴۰۰۰ (پین tester565)', /seo_product[\s\S]{0,4200}out_json\(llm_call_json\(\$cfg, \$sys, \$user, null, null, 1600\)\)/.test(llm) && llm.indexOf('out_json(llm_call_json($cfg, $sys, $user, null, null, 4000));') > -1);
  T('۴.۷ سازگاری: اکشن‌های OCR/سند CRM دست‌نخورده (پین tester140)', llm.indexOf('out_json(llm_call($cfg, $sys, $text, null, null, 6000))') > -1);
  T('۴.۸ سازگاری: حالت JSON اجباریِ هر دو provider دست‌نخورده', llm.indexOf("'responseMimeType' => 'application/json'") > -1 && llm.indexOf("'response_format' => ['type' => 'json_object']") > -1);
  /* v34.37.2: مهاجرت فقط برای اکشن‌های JSONِ سئو بود. این شمار قفل می‌کند که مسیرهای
     OCR/سند (چک، کارت ویزیت، صورت‌حساب، RFQ) و ترجمه/شناسایی همچنان روی llm_call
     تک‌ضربه‌اند — اگر روزی بی‌خبر مهاجرت کنند، این سنجه داد می‌زند. */
  T('۴.۹ شمار فراخوانی‌های تک‌ضربهٔ llm_call = ۱۶ (مسیرهای OCR/سند/ترجمه دست‌نخورده)', (llm.match(/out_json\(llm_call\(\$cfg/g) || []).length === 16, String((llm.match(/out_json\(llm_call\(\$cfg/g) || []).length));
})();

console.log('\n── ۵) لایه‌های نجات و تشخیص در سرور ──');
(function () {
  var SALV = blk(llm, 'function llm_json_salvage', 'function llm_call_json');
  var RETRY = blk(llm, 'function llm_call_json', 'function out_json');
  var OJ = blk(llm, 'function out_json', 'switch ($action)');
  T('۵.۱ سه لایهٔ قدیمی salvage دست‌نخورده (سازگاری با v34.20.0)', SALV.indexOf('json_decode($t, true)') > -1 && SALV.indexOf("strrpos($t, '}')") > -1 && SALV.indexOf("'/,\\s*([\\]}])/'") > -1);
  T('۵.۲ لایهٔ ۴: حذف پوشش markdown در هر کجای متن', llm.indexOf('function llm_json_strip_fences(') > -1 && SALV.indexOf('llm_json_strip_fences(') > -1);
  T('۵.۳ لایهٔ ۵: تعمیر JSON بریده', llm.indexOf('function llm_json_repair_truncated(') > -1 && SALV.indexOf('llm_json_repair_truncated(') > -1);
  T('۵.۴ پیمایشگر آگاهانه به رشته/گریز (فریبِ } داخل مقدار را نمی‌خورد)', llm.indexOf('function llm_json_scan(') > -1 && /llm_json_scan[\s\S]{0,900}if \(\$c === '"'\) \{ \$inStr = true; continue; \}/.test(llm));
  T('۵.۵ بستن براکت‌ها به ترتیب معکوس + بستن رشتهٔ باز', llm.indexOf('function llm_json_close_tail(') > -1 && /array_reverse\(\$stack\)/.test(llm));
  T('۵.۶ پوست‌کردن پله‌ای عضو نیمه‌کاره (سطح ۰ = کمترین دست‌کاری)', llm.indexOf('function llm_json_peel(') > -1 && /for \(\$k = 0; \$k < \(int\)\$level; \$k\+\+\)/.test(llm));
  T('۵.۷ سیاست «بدون عضو پوچ» در گام ۱ و سطح ۰ اعمال می‌شود', llm.indexOf('$tailBad = ') > -1 && llm.indexOf('if (preg_match($tailBad, $s) !== 1) {') > -1 && llm.indexOf('if ($lvl === 0 && preg_match($tailBad, $cand) === 1) continue;') > -1);
  T('۵.۸ «موفقیت پوچ» ممنوع: نتیجهٔ تعمیر باید محتوای واقعی داشته باشد', llm.indexOf('function llm_json_meaningful(') > -1 && (llm.match(/if \(llm_json_meaningful\(\$d\)\) return \$d;/g) || []).length === 2 && llm.indexOf('if (!is_array($d) || count($d) === 0) return false;') > -1);
  T('۵.۹ حلقه‌ها سقف تلاش دارند (بی‌نهایت نمی‌چرخند)', /for \(\$i = \$n; \$i > 0 && \$tries < 60; \$i--\)/.test(llm) && /for \(\$lvl = 0; \$lvl <= 4; \$lvl\+\+\)/.test(llm));
  T('۵.۱۰ گام نخست، بستن در همان نقطهٔ بریدگی است (حذف ناخواستهٔ محتوا ممنوع)', /گام ۱: بستن در همان نقطهٔ بریدگی[\s\S]{0,300}json_decode\(\$s \. llm_json_close_tail\(\$s\), true\)/.test(llm));
  T('۵.۱۱ salvage علت نجات را گزارش می‌کند (قابل تشخیص در لاگ)', /function llm_json_salvage\(\$text, &\$how = ''\)/.test(llm) && SALV.indexOf("'repaired-truncated'") > -1 && SALV.indexOf("'direct'") > -1);
  T('۵.۱۲ دلیل توقف مدل برای هر دو provider خوانده می‌شود', llm.indexOf("$finish = strtoupper((string)($json['candidates'][0]['finishReason'] ?? ''));") > -1 && llm.indexOf("$finish = strtoupper((string)($json['choices'][0]['finish_reason'] ?? ''));") > -1);
  T('۵.۱۳ finish در نتیجهٔ موفق نگه داشته می‌شود (و در کش هم می‌ماند)', /'finish' => \$finish\]/.test(llm));
  T('۵.۱۴ تلاش دوباره با سقف توکنِ محدود (از ۴۰۰ خطای مدل‌های دیگر جلوگیری می‌شود)', RETRY.indexOf('min(8000, max(1200, $maxTok * 2))') > -1 && RETRY.indexOf("'skip_cache' => true") > -1 && RETRY.indexOf('COMPLETE compact valid JSON') > -1);
  T('۵.۱۵ تلاش دوباره فقط یک‌بار و در شکستِ هر دو، خطای اولیه برمی‌گردد', RETRY.indexOf('json_retried') > -1 && /return \$res; \/\* خطای اولیه معتبرتر است \*\//.test(RETRY));
  T('۵.۱۶ پیام خطای قدیمی (پین tester41) دست‌نخورده + علت و raw اضافه شد', OJ.indexOf('خروجی AI ساختار JSON معتبر ندارد (پاسخ قابل تجزیه نبود)') > -1 && OJ.indexOf("'truncated' => $truncated") > -1 && OJ.indexOf("'raw' => mb_substr((string)($res['text'] ?? ''), 0, 300)") > -1 && OJ.indexOf("'model' =>") > -1 && OJ.indexOf("'finish' => $finish") > -1);
  T('۵.۱۷ out_json پاسخ از پیش تجزیه‌شده را می‌پذیرد (سازگاری)', OJ.indexOf("isset($res['jsonData'])") > -1);
  T('۵.۱۸ نشانگر jsonRetried/jsonSalvage در پاسخ موفق (دیدپذیری هزینه)', OJ.indexOf("'jsonRetried' =>") > -1 && OJ.indexOf("'jsonSalvage' =>") > -1);
  T('۵.۱۹ بودجهٔ «فکر کردن» Gemini فقط opt-in است (رفتار فعلی دست‌نخورده)', llm.indexOf("if (isset($cfg['gemini_thinking_budget']) && is_numeric($cfg['gemini_thinking_budget'])) {") > -1 && llm.indexOf("$genCfg['thinkingConfig'] = ['thinkingBudget' => (int)$cfg['gemini_thinking_budget']];") > -1 && llm.indexOf("'generationConfig' => $genCfg") > -1);
  T('۵.۲۰ راهنمای این کلید در نمونهٔ پیکربندی مستند شده است', sampleCfg.indexOf('gemini_thinking_budget') > -1);
  T('۵.۲۱ الگوهای regex تعمیر، ASCII-only هستند (برش وسط نویسهٔ فارسی خطا نمی‌سازد)', !/preg_(?:replace|match)\([^)]*\/u[\'"]/.test(blk(llm, 'function llm_json_peel', 'function llm_json_salvage')));
})();

console.log('\n── ۶) قرارداد CMS (فراخوان‌ها دست‌نخورده) ──');
(function () {
  T('۶.۱ cmsLLM هم در موفقیت و هم در قطعی شبکه از cmsAiDiag عبور می‌کند', /function cmsLLM\([\s\S]{0,700}\.then\(function \(d\) \{ cb\(cmsAiDiag\(d, action\)\); \}\)[\s\S]{0,300}cb\(cmsAiDiag\(\{ ok: false, error: 'عدم دسترسی به هوش مصنوعی' \}, action\)\)/.test(cms));
  T('۶.۲ ویزارد گروهی همچنان seo_fix را با همان قرارداد صدا می‌زند', cms.indexOf("cmsLLM('seo_fix', { issues: r.is.join('، '), content: txt }") > -1);
  T('۶.۳ ایراد هر ردیف در ویزارد گروهی از پیام (اکنون عملیاتی) پر می‌شود', /r\.st = 'bad'; r\.note = escP\(d\.error/.test(cms));
  T('۶.۴ سایر فراخوان‌های AI مدیریت سایت دست‌نخورده‌اند', ["cmsLLM('seo_meta'", "cmsLLM('seo_article'", "cmsLLM('seo_expand'", "cmsLLM('seo_review'", "cmsLLM('seo_intlinks'", "cmsLLM('seo_alt'"].every(function (k) { return cms.indexOf(k) > -1; }));
  T('۶.۵ اعتبارسنجی طول عنوان/توضیح در ویزارد گروهی دست‌نخورده (پیشنهاد بریده اعمال نمی‌شود)', /tl < 30 \|\| tl > 65/.test(cms) && /dl < 70 \|\| dl > 165/.test(cms));
})();

console.log('\n── ۷) بهداشت ──');
(function () {
  T('۷.۱ VERSION.json = v34.37.2', ver.crm_version === 'v34.37.2', ver.crm_version);
  T('۷.۲ tester590 در گیت CI ثبت شده است', gate.indexOf('tester590-v34.36.2-ai-json-repair.js') > -1);
  T('۷.۳ یادداشت انتشار این نسخه موجود است', fs.existsSync('RELEASE-NOTES-v34.37.2.md'));
  T('۷.۴ پینِ به‌روزِ tester565 (۹ اکشن) با تغییر هم‌خوان است', fs.readFileSync('_tools/uat/tester565-v34.20.0-cms-complaints.js', 'utf8').indexOf('length === 9') > -1);
  T('۷.۵ هیچ کلید/رمزی در پیام‌های خطا نشت نمی‌کند', !/(apiKey|\$cfg\['key'\]|secret)/.test(blk(llm, 'function out_json', 'switch ($action)')));
})();

console.log('\n— tester590 (v34.37.2: ریشه‌کنی خطای JSON هوش مصنوعی — AI-JSON-REPAIR) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
