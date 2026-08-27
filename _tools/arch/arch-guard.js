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
var fs = require('fs'), path = require('path'), crypto = require('crypto');
var ROOT = path.resolve(__dirname, '../..');
var BASELINE = path.join(__dirname, 'arch-baseline.json');
var writeBaseline = process.argv.indexOf('--baseline') > -1;
var quiet = process.argv.indexOf('--quiet') > -1;
var selfTest = process.argv.indexOf('--self-test') > -1;

function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function crmFiles() { return fs.readdirSync(path.join(ROOT, 'crm')).filter(function (f) { return /\.js$/.test(f); }); }
/* حذف توضیحات با حفظ شمارهٔ خط — قواعد باید فقط کد را ببینند، نه متن فارسی توضیحات. */
function codeOnly(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, function (m) { return m.replace(/[^\n]/g, ' '); })
            .split('\n').map(function (l) { return l.replace(/\/\/.*$/, ''); }).join('\n');
}
/* v34.7.40: امضای baseline نباید به شمارهٔ خط وابسته باشد؛ درج یک توضیح/تابع در
   بالای فایل قبلاً ده‌ها «تخلف جدید» و «بدهی رفع‌شده» کاذب می‌ساخت. hash از کد
   نرمال‌شده پایدار است و مقایسهٔ multiset همچنان تکرار همان الگو را تشخیص می‌دهد. */
function sourceSignature(file, kind, line) {
  var normalized = String(line || '').replace(/\s+/g, ' ').trim();
  var hash = crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 12);
  var preview = normalized.length > 96 ? normalized.slice(0, 93) + '…' : normalized;
  return file + ' (' + kind + ') [' + hash + '] ' + preview;
}
function multisetDiff(left, right) {
  var counts = {};
  (right || []).forEach(function (x) { counts[x] = (counts[x] || 0) + 1; });
  var out = [];
  (left || []).forEach(function (x) {
    if (counts[x]) counts[x]--;
    else out.push(x);
  });
  return out;
}
if (selfTest) {
  var a = sourceSignature('x.js', 'cd-first', 'var id = r.cd || r._id;');
  var b = sourceSignature('x.js', 'cd-first', '  var   id = r.cd  ||  r._id;  ');
  if (a !== b) throw new Error('source_signature_not_whitespace_stable');
  if (multisetDiff(['same', 'same'], ['same']).length !== 1) throw new Error('multiset_does_not_detect_duplicate');
  if (multisetDiff(['same'], ['same']).length !== 0) throw new Error('multiset_false_positive');
  console.log('PASS arch-guard self-test: stable source signatures + duplicate-sensitive baseline');
  process.exit(0);
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
    lines.forEach(function (ln) {
      if (/\.cd\s*\|\|\s*[A-Za-z_$][\w$]*\._id/.test(ln)) add('A2', sourceSignature(f, 'cd-first', ln));
    });
  });
})();

/* ---------- A3: تطبیق با مقدار تهی ---------- */
(function ruleA3() {
  crmFiles().forEach(function (f) {
    var lines = codeOnly(read('crm/' + f)).split('\n');
    lines.forEach(function (ln) {
      /* کلید تهی وارد نقشه: map[String(x._id || x.cd || '')] = true */
      if (/\[\s*String\([^)]*\|\|\s*''\s*\)\s*\]\s*=\s*(true|1)\b/.test(ln)) add('A3', sourceSignature(f, 'empty-map-key', ln));
      /* مقایسهٔ دو فیلد که هر دو می‌توانند تهی/undefined باشند، بدون گارد */
      if (/return\s+x\.no\s*===\s*\w+;/.test(ln) || /\bx\.no\s*===\s*(i|inv|invoice)\.offerNo\b/.test(ln)) add('A3', sourceSignature(f, 'empty-equality', ln));
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

/* ---------- A8: وصلهٔ زنجیره‌ای که آرگومان را منتقل نمی‌کند ----------
   ریشهٔ باگ v34.7.30 (بارگذاری اقلام درخواست): وصلهٔ inqreader تابع را با امضای بدون
   پارامتر بازنویسی و نسخهٔ قبلی را بدون آرگومان صدا می‌زد ⇒ شمارهٔ انتخاب‌شدهٔ کاربر
   بی‌صدا دور ریخته می‌شد. */
(function ruleA8() {
  var files = crmFiles();
  /* بیشترین تعداد پارامتر شناخته‌شده برای هر نام سراسری */
  var arity = {};
  files.forEach(function (f) {
    var s = codeOnly(read('crm/' + f));
    [/function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/g, /window\.([A-Za-z_$][\w$]*)\s*=\s*function\s*\(([^)]*)\)/g].forEach(function (re) {
      var m; while ((m = re.exec(s))) {
        var n = m[1], ps = m[2].trim() ? m[2].split(',').length : 0;
        if (arity[n] == null || ps > arity[n]) arity[n] = ps;
      }
    });
  });
  files.forEach(function (f) {
    var s = codeOnly(read('crm/' + f));
    /* هم `var x = window.f;` و هم `x = window.f;` (متغیر از قبل تعریف‌شده) */
    var re = /(?:(?:var|let)\s+)?([A-Za-z_$][\w$]*)\s*=\s*window\.([A-Za-z_$][\w$]*)\s*;/g, m;
    while ((m = re.exec(s))) {
      var holder = m[1], name = m[2];
      var region = s.slice(m.index, m.index + 3000);
      if (region.indexOf('window.' + name + ' =') < 0) continue;        /* وصله‌ای در کار نیست */
      if (new RegExp('\\b' + holder + '\\.(apply|call)\\s*\\(').test(region)) continue;  /* درست: انتقال آرگومان */
      if (!new RegExp('\\b' + holder + '\\s*\\(\\s*\\)').test(region)) continue;        /* بدون فراخوان تهی */
      if ((arity[name] || 0) === 0) continue;                            /* تابع اصلاً پارامتر ندارد */
      add('A8', f + ' → ' + name + ' (پارامتر: ' + arity[name] + ')');
    }
  });
})();

/* ---------- A9: تعریف تکراری یک نام سراسری داخل «یک فایل» ----------
   (A1 فقط تکرار بین فایل‌ها را می‌دید؛ کپی‌شدن یک بلوک در همان فایل هم همان تلهٔ
   «کدام نسخه اجرا می‌شود» را می‌سازد.) */
(function ruleA9() {
  crmFiles().forEach(function (f) {
    var s = codeOnly(read('crm/' + f)), seen = {}, re = /window\.([A-Za-z_$][\w$]*)\s*=\s*function/g, m;
    while ((m = re.exec(s))) seen[m[1]] = (seen[m[1]] || 0) + 1;
    Object.keys(seen).forEach(function (n) { if (seen[n] > 1) add('A9', f + ' → ' + n + ' ×' + seen[n]); });
  });
})();

/* ---------- مقایسه با مبنا ---------- */
/* ---------- A10: بایپس لایهٔ داده — localStorage مستقیم (ROADMAP-THIN-CLIENT T0-1) ----------
   اصل E2 رودمپ: UI هرگز مستقیم به storage دست نمی‌زند؛ فقط لایهٔ داده (client-server /
   storage-quota / sync / storage / backup / rbac). بدهی موجود با baseline ثبت می‌شود و
   «افزایش» مسدودکننده است. */
(function ruleA10() {
  /* v34.8.28: cheque-print مجاز — فقط فلگ‌های رسانه/کالیبراسیون چاپ چک
     (ptf_chqprint_bg/cloud: آدرس نسخهٔ ابری در آروان؛ خودِ داده S3 است). */
  var WHITELIST = ['client-server.js', 'storage-quota.js', 'sync.js', 'storage.js', 'backup.js', 'rbac.js', 'cheque-print.js', 'cheques.js']; /* v34.8.29: cheques فقط برای مهاجرت legacy ptf_personal_cheques_* */
  var re = /localStorage\s*\.\s*(setItem|getItem|removeItem)\s*\(/g;
  function scan(rel) {
    var lines = codeOnly(read(rel)).split('\n');
    lines.forEach(function (ln) {
      var m, r = new RegExp(re.source, 'g');
      while ((m = r.exec(ln))) add('A10', sourceSignature(rel, 'ls-' + m[1].replace('Item', '').toLowerCase(), ln));
    });
  }
  crmFiles().forEach(function (f) {
    if (WHITELIST.indexOf(f) > -1) return;
    scan('crm/' + f);
  });
  scan('crm/index.html');
})();

/* ---------- A11: تطابق رجیستری فرمان موجودیت کلاینت/سرور (ROADMAP-THIN-CLIENT T0-2) ----------
   PTF_ENTITY_CMD_ENABLED (sales-domain-v2.js) و sd_entity_registry() (sales-domain.php)
   باید دقیقاً همان مجموعه باشند؛ واگرایی = فرمان «ناموفق» کلاینت روی سرورِ ناآماده. */
(function ruleA11() {
  var clientSrc = read('crm/sales-domain-v2.js');
  var serverSrc = read('api/sales-domain.php');
  var client = [], server = [], m, r;
  var block = clientSrc.match(/window\.PTF_ENTITY_CMD_ENABLED\s*=\s*\{[\s\S]*?\}/);
  if (block) {
    r = /'(ptf_[a-z_]+)'\s*:\s*true/g;
    while ((m = r.exec(block[0]))) client.push(m[1]);
  }
  /* فقط بدنهٔ sd_entity_registry() — نه هر 'ptf_crm_x' => [ در کل فایل */
  var fn = serverSrc.match(/function sd_entity_registry\s*\(\s*\)\s*:\s*array\s*\{[\s\S]*?\n\}/);
  if (fn) {
    r = /'(ptf_crm_[a-z_]+)'\s*=>\s*\[/g;
    while ((m = r.exec(fn[0]))) if (server.indexOf(m[1]) < 0) server.push(m[1]);
  }
  client.sort(); server.sort();
  if (client.join(',') !== server.join(',')) {
    add('A11', 'registry-parity client=[' + client.join('|') + '] server=[' + server.join('|') + ']');
  }
})();

var RULES = {
  A1: { blocking: true, title: 'بازنویسی خاموش تابع سراسری (نسخهٔ قبلی بدون زنجیره دور ریخته می‌شود)' },
  A2: { blocking: true, title: 'ترتیب شناسه برخلاف قرارداد PTF.id (باید `_id || cd` باشد)' },
  A3: { blocking: true, title: 'تطبیق با مقدار تهی (کلید «» یا مقایسهٔ دو مقدار احتمالاً تهی)' },
  A4: { blocking: true, title: 'دکمهٔ مرده: هندلر onclick بدون تعریف' },
  A5: { blocking: true, title: 'خرابی انکدینگ فارسی (U+FFFD)' },
  A6: { blocking: true, title: 'ناهماهنگی نسخه در نقاط رسمی' },
  A7: { blocking: false, title: 'شکست خاموش در اکشن کاربر (بدون هیچ پیام/توست)' },
  A8: { blocking: true, title: 'وصلهٔ زنجیره‌ای بدون انتقال آرگومان (apply(this, arguments))' },
  A9: { blocking: true, title: 'تعریف تکراری یک نام سراسری در همان فایل' },
  A10: { blocking: true, title: 'بایپس لایهٔ داده — localStorage مستقیم بیرون از لایهٔ داده (T0-1)' },
  A11: { blocking: true, title: 'ناهماهنگی رجیستری فرمان موجودیت کلاینت/سرور (T0-2)' }
};
var current = {};
Object.keys(RULES).forEach(function (r) { current[r] = (findings[r] || []).slice().sort(); });

if (writeBaseline) {
  fs.writeFileSync(BASELINE, JSON.stringify({ note: 'بدهی معماری پذیرفته‌شده با امضای پایدار محتوا؛ افزایش multiset هر قاعده ⇒ شکست گیت.', signatureFormat: 'source-sha256-12-v2', version: versionReport, rules: current }, null, 1) + '\n');
  console.log('مبنا ثبت شد: ' + path.relative(ROOT, BASELINE));
  Object.keys(current).forEach(function (r) { console.log('  ' + r + ': ' + current[r].length); });
  process.exit(0);
}

var baselineDoc = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : {};
var base = baselineDoc.rules || {};
var newIssues = [], fixed = [];
Object.keys(RULES).forEach(function (r) {
  var b = base[r] || [];
  multisetDiff(current[r], b).forEach(function (sig) { newIssues.push({ rule: r, sig: sig, blocking: RULES[r].blocking }); });
  multisetDiff(b, current[r]).forEach(function (sig) { fixed.push(r + ': ' + sig); });
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
