#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
seo_redirect_audit.py — ممیزیِ خودکارِ ریدایرکت‌های .htaccess و یکپارچگیِ لینک داخلی

چرا
---
تا امروز ۲۶۰+ قاعدهٔ RewriteRule در .htaccess نوشته شده بود (ادغام‌های مرکز دانش،
مهاجرت از وردپرس/ASP، یکسان‌سازی نشانی) **بدون هیچ بازبینیِ خودکار**. یک اشتباه
کوچک در این فایل سه پیامد گران دارد و هیچ‌کدام در CI گرفته نمی‌شد:
  ۱) مقصدِ ۳۰۱ به فایلی اشاره کند که وجود ندارد → کاربر و گوگل به ۴۰۴ می‌رسند
     (بدتر از نبودِ ریدایرکت).
  ۲) زنجیرهٔ ۳۰۱ (A→B→C) یا حلقه (A→B→A) → هدررفت اعتبار و خزش.
  ۳) نشانیِ مرده‌ای که هیچ قاعده‌ای نمی‌گیرد → در «Not indexed» گوگل باقی می‌ماند.

چه چیزی بررسی می‌شود
--------------------
  ۱. هر ۳۰۱ در .htaccess: مقصدش واقعاً در مخزن وجود دارد؟ (پوشه → index.html)
  ۲. زنجیره: مقصدِ هر ۳۰۱ خودش دوباره ۳۰۱ می‌شود؟
  ۳. حلقه: مبدأ == مقصد؟
  ۴. پوشش: هر URL در _tools/legacy-url-inventory.json (سیاههٔ Wayback) یا ۳۰۱
     می‌شود یا ۴۱۰ — و با انتظارِ ثبت‌شده در سیاهه هم‌خوان است.
  ۵. لینک داخلی: هر href در صفحات عمومی به فایلِ موجود می‌رسد؟

اجرا
----
    python3 _tools/seo_redirect_audit.py            # گزارش
    python3 _tools/seo_redirect_audit.py --strict   # خطای غیرصفر روی هر مشکل
    python3 _tools/seo_redirect_audit.py --no-links # بدونِ بررسیِ ۱۳۰۰+ لینک

این ابزار هیچ فایلی را تغییر نمی‌دهد؛ فقط می‌خواند.
"""
import os
import re
import sys
import json
import glob
import html
import collections
from urllib.parse import unquote, urlsplit

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTACCESS = os.path.join(ROOT, '.htaccess')
INVENTORY = os.path.join(ROOT, '_tools', 'legacy-url-inventory.json')

# پوشه‌هایی که صفحهٔ عمومی نیستند (همان فهرستِ اسکنِ سئو)
SKIP_PREFIX = ('.git', 'crm', 'api', '_tools', '_audit', '_human_test', '_personas',
               'docs-deploy', 'ptf-', '_', 'ar/', 'de/', 'fr/', 'ru/', 'tr/', 'zh/')


# ─────────────────────────── خواندن .htaccess ───────────────────────────
class Rule:
    __slots__ = ('line', 'pattern', 'target', 'kind', 'flags', 'conds', 'raw')

    def __init__(self, line, pattern, target, kind, flags, conds, raw):
        self.line = line
        self.pattern = pattern
        self.target = target
        self.kind = kind          # '301' | '410' | 'other'
        self.flags = flags
        self.conds = conds        # فهرست (var, regex)
        self.raw = raw

    def __repr__(self):
        return '<%s L%s %s → %s>' % (self.kind, self.line, self.pattern, self.target)


RE_RULE = re.compile(r'^\s*RewriteRule\s+(?:"([^"]*)"|(\S+))\s+(?:"([^"]*)"|(\S+))(?:\s+(\[[^\]]*\]))?\s*$')
RE_COND = re.compile(r'^\s*RewriteCond\s+(\S+)\s+(?:"([^"]*)"|(\S+))\s*(?:\[([^\]]*)\])?\s*$')


def parse_htaccess(path=HTACCESS):
    rules = []
    pending = []
    try:
        text = open(path, encoding='utf-8').read()
    except OSError as e:
        print('⛔ خواندن .htaccess ناموفق:', e)
        return rules
    for i, raw in enumerate(text.splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith('#'):
            continue
        mc = RE_COND.match(raw)
        if mc:
            var = mc.group(1)
            rx = mc.group(2) if mc.group(2) is not None else mc.group(3)
            pending.append((var, rx))
            continue
        mr = RE_RULE.match(raw)
        if not mr:
            continue
        pattern = mr.group(1) if mr.group(1) is not None else mr.group(2)
        target = mr.group(3) if mr.group(3) is not None else mr.group(4)
        flags = (mr.group(5) or '').strip('[]')
        fl = dict((p.split('=')[0].upper(), p.split('=', 1)[1] if '=' in p else '')
                  for p in flags.split(',') if p)
        kind = 'other'
        if fl.get('G') is not None:
            kind = '410'
        elif fl.get('R', '').startswith('301') or fl.get('R') == 'permanent':
            kind = '301'
        rules.append(Rule(i, pattern, target, kind, fl, pending, raw.strip()))
        pending = []
    return rules


# ─────────────────────────── کمکی‌ها ───────────────────────────
def name_flags_of(rules):
    """قواعدی که «نام‌گذاری» می‌کنند نه «انتقال محتوا» — در زنجیره شمرده نمی‌شوند."""
    return rules


def apache_to_python(pattern):
    """تبدیل الگوی mod_rewrite به regex پایتون (سازگاریِ کافی برای الگوهای این مخزن)."""
    return pattern


def path_matches(pattern, path, nocase=False):
    """آیا الگوی RewriteRule این مسیر را می‌گیرد؟ (مسیر بدونِ اسلشِ ابتدایی، مثل خودِ Apache)"""
    try:
        return re.search(apache_to_python(pattern), path, re.IGNORECASE if nocase else 0) is not None
    except re.error:
        return False


def query_matches(conds, query):
    """فقط شرط‌های QUERY_STRING را برای مسیرهای پارامتردار چک می‌کند."""
    for var, rx in conds:
        if 'QUERY_STRING' in var:
            try:
                if re.search(rx, query or '') is None:
                    return False
            except re.error:
                return False
    return True


def has_request_uri_cond(conds, path):
    """شرط‌های REQUEST_URI روی مسیرِ خام (بدون ٪) اعمال می‌شوند."""
    for var, rx in conds:
        if 'REQUEST_URI' in var:
            try:
                if re.search(rx, '/' + path) is None:
                    return False
            except re.error:
                return False
    return True


def split_url(u):
    """'/?p=12#x' → ('', 'p=12')  و  '/about/?a=1' → ('about/', 'a=1')"""
    s = urlsplit(u)
    p = unquote(s.path).lstrip('/') if s.path else ''
    return p, s.query


def target_path(target):
    """مسیرِ مقصدِ ۳۰۱ به شکلِ نسبیِ مخزن؛ قطعه (#...) دور ریخته می‌شود."""
    t = html.unescape(target)
    s = urlsplit(t)
    return unquote(s.path).lstrip('/')


def resolves(rel):
    """آیا این مسیر نسبی در مخزن به یک صفحهٔ واقعی می‌رسد؟"""
    if rel == '':
        return True                      # ریشه = index.html موجود است
    if rel.endswith('/'):
        return os.path.isfile(os.path.join(ROOT, rel + 'index.html'))
    p = os.path.join(ROOT, rel)
    return (os.path.isfile(p)
            or os.path.isfile(p + '.html')
            or os.path.isfile(os.path.join(p, 'index.html')))


def is_host_normalizer(r):
    """قواعدِ یکسان‌سازی میزبان/HTTPS: الگوی ^ با مقصدِ مطلق و %{REQUEST_URI}.
    اینها هر مسیری را می‌گیرند ولی محتوا را منتقل نمی‌کنند؛ در «اولین قاعدهٔ
    مؤثر» و در تشخیصِ زنجیره نباید شمرده شوند."""
    return '%{' in (r.target or '') or (r.target or '').startswith('http')


def first_match(rules, path, query=''):
    for r in rules:
        if is_host_normalizer(r):
            continue
        if not path_matches(r.pattern, path, 'NC' in r.flags):
            continue
        if r.conds and not query_matches(r.conds, query):
            continue
        if r.conds and not has_request_uri_cond(r.conds, path):
            continue
        return r
    return None


# ─────────────────────────── بررسی‌ها ───────────────────────────
def audit_targets(rules):
    """۱) هر مقصدِ ۳۰۱ وجود دارد؟  ۲) زنجیره  ۳) حلقه"""
    bad_targets, chains, loops = [], [], []
    for r in rules:
        if r.kind != '301' or is_host_normalizer(r):
            continue
        rel = target_path(r.target)
        if '%' in (r.target or ''):
            continue            # مقصدِ بازنویسی‌شده با backreference (مثل ^(.*/)?index\.html$)
        if not resolves(rel):
            bad_targets.append((r, rel))
        src = re.sub(r'[/\\]?\$?$', '', r.pattern.lstrip('^'))
        if rel.rstrip('/') == unquote(src).rstrip('/'):
            loops.append(r)
            continue
        # زنجیره: آیا مقصد خودش دوباره ۳۰۱ می‌شود؟
        nxt = first_match(rules, rel)
        if nxt is not None and nxt.kind == '301' and nxt is not r:
            nxt_rel = target_path(nxt.target)
            if nxt_rel.rstrip('/') != rel.rstrip('/'):
                chains.append((r, nxt, rel))
    return bad_targets, chains, loops


def audit_inventory(rules, entries):
    """۴) پوششِ سیاههٔ URLهای مرده"""
    unhandled, mismatch = [], []
    for e in entries:
        url = e['url']
        path, query = split_url(url)
        hit = first_match(rules, path, query)
        if hit is None or hit.kind == 'other':
            unhandled.append((e, hit))
            continue
        exp = e.get('expect')
        if exp and hit.kind != exp:
            mismatch.append((e, hit))
            continue
        if exp == '301' and e.get('to'):
            want = target_path(e['to'])
            got = target_path(hit.target)
            if want.rstrip('/') != got.rstrip('/'):
                mismatch.append((e, hit))
    return unhandled, mismatch


def public_pages():
    """همهٔ صفحات عمومی مخزن با مسیرِ URLشان (همان نگاشتِ Apache)."""
    out = []
    for p in glob.glob(os.path.join(ROOT, '**', '*.html'), recursive=True):
        rel = os.path.relpath(p, ROOT).replace(os.sep, '/')
        if rel.startswith(SKIP_PREFIX):
            continue
        url = rel[:-len('index.html')] if rel.endswith('index.html') else rel
        out.append((rel, url))
    return out


RE_CANON = re.compile(r'<link[^>]+rel=["\']canonical["\'][^>]+href=["\']([^"\']+)', re.I)
RE_ROBOTS = re.compile(r'<meta[^>]+name=["\']robots["\'][^>]+content=["\']([^"\']+)', re.I)


def is_redirect_stub(rel):
    """صفحه‌ای که خودش را به نشانیِ دیگری canonical می‌کند و noindex است
    (استابِ باقی‌مانده از ادغام‌ها) — این‌ها مجازند ۳۰۱ بگیرند."""
    try:
        s = open(os.path.join(ROOT, rel), encoding='utf-8', errors='ignore').read()
    except OSError:
        return False
    mc = RE_CANON.search(s)
    mr = RE_ROBOTS.search(s)
    if not mc or not mr or 'noindex' not in mr.group(1):
        return False
    canon = unquote(urlsplit(html.unescape(mc.group(1))).path).lstrip('/')
    own = rel[:-len('index.html')] if rel.endswith('index.html') else rel
    return canon.rstrip('/') != own.rstrip('/')


def audit_live_pages(rules):
    """۶) هیچ صفحهٔ زندهٔ سایت نباید ۳۰۱/۴۱۰ بگیرد (جلوگیری از خودزنیِ قاعده‌ها)."""
    killed, stray = [], []
    pages = public_pages()
    for rel, url in pages:
        hit = first_match(rules, url)
        if hit is None or hit.kind == 'other':
            continue
        stub = is_redirect_stub(rel)
        if hit.kind == '301':
            if not stub:
                killed.append((rel, hit))
        else:                       # 410 روی یک فایلِ موجود
            stray.append((rel, hit, stub))
    return pages, killed, stray


def audit_internal_links():
    """۵) هر href در صفحات عمومی به یک فایلِ موجود می‌رسد؟"""
    files = []
    for p in glob.glob(os.path.join(ROOT, '**', '*.html'), recursive=True):
        rel = os.path.relpath(p, ROOT).replace(os.sep, '/')
        if rel.startswith(SKIP_PREFIX):
            continue
        files.append(rel)
    safe = re.compile(r'^[\w\u0600-\u06FF\u200c./%~\-()]+$')
    broken = collections.Counter()
    scanned = 0
    for rel in files:
        try:
            src = open(os.path.join(ROOT, rel), encoding='utf-8', errors='ignore').read()
        except OSError:
            continue
        for m in re.finditer(r'href="([^"]+)"', src):
            u = m.group(1).split('#')[0].split('?')[0]
            if not u or u.startswith(('http', 'mailto:', 'tel:', '//', 'javascript:', 'data:')):
                continue
            if not safe.match(u):        # الگوهای JS/قالب — نه لینکِ واقعی
                continue
            scanned += 1
            if u.startswith('/'):
                t = unquote(u).lstrip('/')
            else:
                t = os.path.normpath(os.path.join(os.path.dirname(rel), unquote(u)))
                t = t.replace(os.sep, '/')
            if not resolves(t):
                broken[t] += 1
    return len(files), scanned, broken


# ─────────────────────────── گزارش ───────────────────────────
def main():
    strict = '--strict' in sys.argv
    do_links = '--no-links' not in sys.argv
    rules = parse_htaccess()
    r301 = [r for r in rules if r.kind == '301']
    r410 = [r for r in rules if r.kind == '410']
    print('── ممیزی ریدایرکت ──────────────────────────────')
    print('قواعد: %d کل | %d ریدایرکت ۳۰۱ | %d قاعدهٔ ۴۱۰' % (len(rules), len(r301), len(r410)))

    bad, chains, loops = audit_targets(rules)
    print('\n۱) مقصدِ ناموجود در مخزن: %d' % len(bad))
    for r, rel in bad[:30]:
        print('   ⛔ خط %-4d %s → %s' % (r.line, r.pattern, r.target))

    print('\n۲) زنجیرهٔ ۳۰۱ (A→B→C): %d' % len(chains))
    for a, b, rel in chains[:20]:
        print('   ⚠️  خط %-4d %s → /%s → %s' % (a.line, a.pattern, rel, b.target))

    print('\n۳) حلقهٔ ۳۰۱: %d' % len(loops))
    for r in loops[:10]:
        print('   ⛔ خط %-4d %s' % (r.line, r.pattern))

    n_un, n_mis = 0, 0
    if os.path.isfile(INVENTORY):
        inv = json.load(open(INVENTORY, encoding='utf-8'))
        entries = inv.get('entries', [])
        unhandled, mismatch = audit_inventory(rules, entries)
        n_un, n_mis = len(unhandled), len(mismatch)
        print('\n۴) سیاههٔ URLهای مرده: %d ورودی | بی‌پاسخ: %d | ناهم‌خوان: %d'
              % (len(entries), n_un, n_mis))
        for e, hit in unhandled[:30]:
            print('   ⛔ بی‌پاسخ: %s  (انتظار %s)' % (e['url'], e.get('expect')))
        for e, hit in mismatch[:30]:
            print('   ⚠️  ناهم‌خوان: %s  انتظار %s%s ولی قاعده خط %d می‌دهد %s'
                  % (e['url'], e.get('expect'), ' → ' + e.get('to', '') if e.get('to') else '',
                     hit.line, hit.kind + ' ' + (hit.target if hit.kind == '301' else '')))
    else:
        print('\n۴) سیاههٔ %s پیدا نشد — رد شد.' % os.path.relpath(INVENTORY, ROOT))

    pages, killed, stray = audit_live_pages(rules)
    stubs = sum(1 for rel, _ in pages if is_redirect_stub(rel))
    print('\n۶) صفحاتِ زندهٔ سایت: %d | استابِ ادغام‌شده: %d' % (len(pages), stubs))
    print('   صفحهٔ زنده‌ای که ۳۰۱ می‌گیرد (باید ۰ باشد): %d' % len(killed))
    for rel, hit in killed[:20]:
        print('   ⛔ /%s → خط %d «%s»' % (rel, hit.line, hit.pattern))
    print('   صفحهٔ موجودی که ۴۱۰ می‌گیرد (باید ۰ باشد): %d' % len(stray))
    for rel, hit, stub in stray[:20]:
        print('   ⛔ /%s → خط %d%s' % (rel, hit.line, ' (استاب)' if stub else ''))

    n_pages = n_refs = 0
    broken = {}
    if do_links:
        n_pages, n_refs, broken = audit_internal_links()
        print('\n۵) لینک داخلی: %d صفحه | %d ارجاع | شکسته: %d'
              % (n_pages, n_refs, sum(broken.values())))
        for t, c in broken.most_common(20):
            print('   ⛔ %dx  /%s' % (c, t))

    fails = len(bad) + len(loops) + n_un + n_mis + len(killed) + len(stray)
    print('\n── نتیجه ───────────────────────────────────────')
    if fails == 0:
        print('✅ سالم: همهٔ مقصدها موجود، بدون زنجیره/حلقه، همهٔ URLهای سیاهه پاسخ دارند،')
        print('   و هیچ صفحهٔ زنده‌ای قربانیِ قاعدهٔ ۳۰۱/۴۱۰ نشده است.')
    else:
        print('❌ %d ایرادِ مسدودکننده (مقصد ناموجود %d | حلقه %d | بی‌پاسخ %d | ناهم‌خوان %d | صفحهٔ زندهٔ ۳۰۱شده %d | صفحهٔ ۴۱۰شده %d)'
              % (fails, len(bad), len(loops), n_un, n_mis, len(killed), len(stray)))
    if chains:
        print('ℹ️  %d زنجیرهٔ ۳۰۱ (هشدار، نه مسدودکننده).' % len(chains))
    if broken:
        print('ℹ️  %d لینک داخلی شکسته (خارج از شمارشِ ایراد — ولی اصلاح شود).' % sum(broken.values()))
    return 1 if (strict and (fails or broken)) else 0


if __name__ == '__main__':
    sys.exit(main())
