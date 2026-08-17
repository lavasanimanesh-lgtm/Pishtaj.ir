#!/usr/bin/env node
'use strict';
/* =====================================================================
   PTF CRM — نگهبان معماری (Architecture Guard)
   هدف: هر خانوادهٔ باگی که در این دوره واقعاً رخ داد، از این پس به‌صورت
   خودکار و پیش از استقرار گرفته شود — نه با بازنویسی معماری، بلکه با
   چند قاعدهٔ ساده روی همان معماری.

   اجرا:
     node _tools/arch/arch-guard.js            # بررسی (خروج ۱ در صورت تخلف جدید)
     node _tools/arch/arch-guard.js --baseline # ثبت وضعیت فعلی به‌عنوان مبنا

   قواعد:
     A1 بازنویسی خاموش تابع سراسری (نسخهٔ قبلی بدون زنجیره دور ریخته شود)
     A2 ناسازگاری ترتیب شناسه (`cd || _id` در برابر قرارداد `_id || cd`)
     A3 تطبیق با مقدار تهی (کلید '' در نقشه‌ها / مقایسهٔ دو مقدار احتمالاً تهی)
     A4 دکمهٔ مرده (هندلر onclick بدون تعریف)
     A5 خرابی انکدینگ فارسی (U+FFFD)
     A6 ناهماهنگی نسخه در ۷ نقطهٔ رسمی
     A7 شکست خاموش در اکشن‌های کاربر (return بدون هیچ بازخورد)  [گزارشی]

   قرارداد مبنا (baseline): بدهی موجود مسدودکننده نیست، اما «افزایش» آن مسدود است.
   ===================================================================== */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var BASELINE = path.join(__dirname, 'arch-baseline.json');
var writeBaseline = process.argv.indexOf('--baseline') > -1;
var quiet = process.argv.indexOf('--quiet') > -1;

function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function crmFiles() { return fs.readdirSync(path.join(ROOT, 'crm')).filter(function (f) { return /\.js$/.test(f); }); }
/* حذف توضیحات با حفظ شمارهٔ خط — قواعد باید فقط کد را ببینند، نه متن فارسی توضیحات. */
function codeOnly(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, function (m) { return m.replace(/[^\n]/g, ' '); })
            .split('\n').map(function (l) { return l.replace(/\/\/.*$/, ''); }).join('\n');
}
function loadOrder() {
  var html = read('crm/index.html'), out = [], re = /<script[^>]*src="([a-zA-Z0-9_\-.]+\.js)\?v=/g, m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

var findings = {};   /* ruleId → [signature] */
function add(rule, sig) { (findings[rule] = findings[rule] || []).push(sig); }

/* ---------- A1: بازنویسی خاموش تابع سراسری ---------- */
(function ruleA1() {
  var order = loadOrder(), defs = {};
  order.forEach(function (f, idx) {
    var p = path.join(ROOT, 'crm', f); if (!fs.existsSync(p)) return;
    var s = fs.readFileSync(p, 'utf8'), r = /window\.([A-Za-z_$][\w$]*)\s*=\s*function/g, x;
    while ((x = r.exec(s))) { defs[x[1]] = defs[x[1]] || {}; defs[x[1]][f] = idx; }
  });
  Object.keys(defs).forEach(function (name) {
    var files = Object.keys(defs[name]);
    if (files.length < 2) return;
    var winner = files.reduce(function (a, b) { return defs[name][b] >= defs[name][a] ? b : a; });
    var src = fs.readFileSync(path.join(ROOT, 'crm', winner), 'utf8');
    var chains = new RegExp('=\\s*window\\.' + name + '\\b|typeof\\s+window\\.' + name + '|=\\s*' + name + '\\s*;').test(src);
    if (!chains) add('A1', name + ' @ ' + files.sort().join('+'));
  });
})();

/* ---------- A2: ترتیب شناسه برخلاف قرارداد ---------- */
(function ruleA2() {
  crmFiles().forEach(function (f) {
    var lines = codeOnly(read('crm/' + f)).split('\n');
    lines.forEach(function (ln, i) {
      if (/\.cd\s*\|\|\s*[A-Za-z_$][\w$]*\._id/.test(ln)) add('A2', f + ':' + (i + 1));
    });
  });
})();

/* ---------- A3: تطبیق با مقدار تهی ---------- */
(function ruleA3() {
  crmFiles().forEach(function (f) {
    var lines = codeOnly(read('crm/' + f)).split('\n');
    lines.forEach(function (ln, i) {
      /* کلید تهی وارد نقشه: map[String(x._id || x.cd || '')] = true */
      if (/\[\s*String\([^)]*\|\|\s*''\s*\)\s*\]\s*=\s*(true|1)\b/.test(ln)) add('A3', f + ':' + (i + 1) + ' (empty-map-key)');
      /* مقایسهٔ دو فیلد که هر دو می‌توانند تهی/undefined باشند، بدون گارد */
      if (/return\s+x\.no\s*===\s*\w+;/.test(ln) || /\bx\.no\s*===\s*(i|inv|invoice)\.offerNo\b/.test(ln)) add('A3', f + ':' + (i + 1) + ' (empty-equality)');
    });
  });
})();

/* ---------- A4: دکمهٔ مرده ---------- */
(function ruleA4() {
  var all = '';
  crmFiles().forEach(function (f) { all += '\n' + read('crm/' + f); });
  all += '\n' + read('crm/index.html');
  var defined = {};
  [/function\s+([A-Za-z_$][\w$]*)\s*\(/g, /(?:window|W|root)\.([A-Za-z_$][\w$]*)\s*=/g,
   /var\s+([A-Za-z_$][\w$]*)\s*=\s*function/g, /([A-Za-z_$][\w$]*)\s*:\s*function/g].forEach(function (r) {
    var m; while ((m = r.exec(all))) defined[m[1]] = true;
  });
  var DOM = ['closest', 'remove', 'getElementById', 'querySelector', 'querySelectorAll', 'stopPropagation', 'preventDefault',
    'getAttribute', 'setAttribute', 'writeText', 'setItem', 'getItem', 'splice', 'stringify', 'parse', 'trim', 'select',
    'focus', 'blur', 'click', 'reload', 'open', 'print', 'push', 'fn', 'toLocaleString', 'toFixed', 'replace', 'split', 'join'];
  var seen = {}, cre = /on(?:click|change|input|submit|blur|focus|keyup)=\\?["']([^"']{0,500})/g, m;
  while ((m = cre.exec(all))) {
    var body = m[1], r2 = /([A-Za-z_$][\w$]*)\s*\(/g, x;
    while ((x = r2.exec(body))) {
      var n = x[1];
      if (DOM.indexOf(n) > -1) continue;
      if (['if', 'for', 'while', 'switch', 'function', 'return', 'typeof', 'catch', 'confirm', 'alert', 'prompt',
        'parseInt', 'parseFloat', 'String', 'Number', 'Array', 'Object', 'JSON', 'Math', 'Date'].indexOf(n) > -1) continue;
      if (!defined[n] && !seen[n]) { seen[n] = 1; add('A4', n); }
    }
  }
})();

/* ---------- A5: خرابی انکدینگ ---------- */
(function ruleA5() {
  ['crm', 'api'].forEach(function (dir) {
    var full = path.join(ROOT, dir); if (!fs.existsSync(full)) return;
    fs.readdirSync(full).filter(function (f) { return /\.(js|php|html|json)$/.test(f); }).forEach(function (f) {
      var s = fs.readFileSync(path.join(full, f), 'utf8');
      if (s.indexOf('\uFFFD') > -1) add('A5', dir + '/' + f);
    });
  });
})();

/* ---------- A6: هماهنگی نسخه در ۷ نقطه ---------- */
var versionReport = (function ruleA6() {
  var v = JSON.parse(read('VERSION.json')).crm_version;    /* مثل v34.7.28 */
  var bare = String(v).replace(/^v/, '');
  var points = [
    ['crm/index.html', new RegExp("window\\.PTF_CRM_RELEASE\\s*=\\s*'v" + bare.replace(/\./g, '\\.') + "'")],
    ['crm/sw.js', new RegExp("RELEASE\\s*=\\s*'v" + bare.replace(/\./g, '\\.') + "'")],
    ['crm/manifest.json', new RegExp('"version"\\s*:\\s*"' + bare.replace(/\./g, '\\.') + '"')],
    ['crm/clear-cache.html', new RegExp("VER\\s*=\\s*'v" + bare.replace(/\./g, '\\.') + "'")],
    ['crm/shell.js', new RegExp("'v" + bare.replace(/\./g, '\\.') + "'")],
    ['api/sales-domain.php', new RegExp("SD_SERVICE_VERSION\\s*=\\s*'" + bare.replace(/\./g, '\\.') + "'")]
  ];
  points.forEach(function (pt) { if (!pt[1].test(read(pt[0]))) add('A6', pt[0] + ' ≠ ' + v); });
  /* هیچ ارجاع نسخهٔ قدیمی در index.html نماند */
  var stale = (read('crm/index.html').match(/\?v=(\d+\.\d+\.\d+)/g) || []).filter(function (q) { return q !== '?v=' + bare; });
  if (stale.length) add('A6', 'crm/index.html: ' + stale.length + ' ارجاع نسخهٔ ناهمخوان');
  return v;
})();

/* ---------- A7: شکست خاموش در اکشن کاربر (گزارشی) ---------- */
(function ruleA7() {
  var ACTION = /(Void|Delete|Remove|Save|Apply|Open|Confirm|Submit|Issue|Post)$/;
  crmFiles().forEach(function (f) {
    var s = read('crm/' + f);
    var re = /(?:window|W)\.([A-Za-z_$][\w$]*)\s*=\s*function\s*\(([^)]*)\)\s*\{/g, m;
    while ((m = re.exec(s))) {
      var name = m[1]; if (!ACTION.test(name)) continue;
      var head = s.slice(m.index, m.index + 400);
      /* الگوی «اگر پیدا نشد، بی‌صدا برگرد» */
      if (/if\s*\(\s*!\w+(\s*\|\|[^)]{0,60})?\)\s*(\{\s*)?return\s*;/.test(head) &&
          !/alert|toast|confirm|console\.(warn|error)/.test(head.slice(0, head.search(/return\s*;/) + 40))) {
        add('A7', f + ' → ' + name);
      }
    }
  });
})();

/* ---------- مقایسه با مبنا ---------- */
var RULES = {
  A1: { blocking: true, title: 'بازنویسی خاموش تابع سراسری (نسخهٔ قبلی بدون زنجیره دور ریخته می‌شود)' },
  A2: { blocking: true, title: 'ترتیب شناسه برخلاف قرارداد PTF.id (باید `_id || cd` باشد)' },
  A3: { blocking: true, title: 'تطبیق با مقدار تهی (کلید «» یا مقایسهٔ دو مقدار احتمالاً تهی)' },
  A4: { blocking: true, title: 'دکمهٔ مرده: هندلر onclick بدون تعریف' },
  A5: { blocking: true, title: 'خرابی انکدینگ فارسی (U+FFFD)' },
  A6: { blocking: true, title: 'ناهماهنگی نسخه در نقاط رسمی' },
  A7: { blocking: false, title: 'شکست خاموش در اکشن کاربر (بدون هیچ پیام/توست)' }
};
var current = {};
Object.keys(RULES).forEach(function (r) { current[r] = (findings[r] || []).slice().sort(); });

if (writeBaseline) {
  fs.writeFileSync(BASELINE, JSON.stringify({ note: 'بدهی معماریِ پذیرفته‌شده در لحظهٔ ثبت؛ افزایش هر فهرست ⇒ شکست گیت.', version: versionReport, rules: current }, null, 1) + '\n');
  console.log('مبنا ثبت شد: ' + path.relative(ROOT, BASELINE));
  Object.keys(current).forEach(function (r) { console.log('  ' + r + ': ' + current[r].length); });
  process.exit(0);
}

var base = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')).rules || {} : {};
var newIssues = [], fixed = [];
Object.keys(RULES).forEach(function (r) {
  var b = base[r] || [];
  current[r].forEach(function (sig) { if (b.indexOf(sig) < 0) newIssues.push({ rule: r, sig: sig, blocking: RULES[r].blocking }); });
  b.forEach(function (sig) { if (current[r].indexOf(sig) < 0) fixed.push(r + ': ' + sig); });
});

console.log('نگهبان معماری — نسخهٔ ' + versionReport);
Object.keys(RULES).forEach(function (r) {
  console.log('  ' + r + ' ' + (RULES[r].blocking ? '[مسدودکننده]' : '[گزارشی]  ') + ' ' + current[r].length + '/' + ((base[r] || []).length) + '  ' + RULES[r].title);
});
if (!quiet && fixed.length) { console.log('\n✅ بدهی برطرف‌شده (از مبنا حذف کنید با --baseline):'); fixed.forEach(function (x) { console.log('   • ' + x); }); }

var blockingNew = newIssues.filter(function (x) { return x.blocking; });
if (newIssues.length) {
  console.log('\n⚠ تخلف جدید نسبت به مبنا:');
  newIssues.forEach(function (x) { console.log('   ' + (x.blocking ? '❌' : '🟡') + ' ' + x.rule + ': ' + x.sig); });
}
if (blockingNew.length) { console.log('\n=== ARCH GUARD: FAIL (' + blockingNew.length + ' تخلف مسدودکنندهٔ جدید) ==='); process.exit(1); }
console.log('\n=== ARCH GUARD: PASS ===');
process.exit(0);
