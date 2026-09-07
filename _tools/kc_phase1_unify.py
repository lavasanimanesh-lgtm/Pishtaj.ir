#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""KC Phase 1 structural unification (2026-09-07).

For every indexable knowledge-center article (hub + noindex pages excluded):
  1. Rename template wrappers  -> <main id="main-content"> + <article>
     (fixes 316 broken skip-links; template A: div.article-wrap +
     div.article-content / template B: article's parent div / nace: section+div)
  2. Fix the 'shortest' boilerplate sentence (also on retired/hub pages).
  3. Insert visible byline (author + published/updated Jalali dates + reading time).
  4. Insert static TOC nav (pages with >=2 content H2s).
  5. Backfill related block where missing (token-similarity top-3, indexable only).
  6. Bump sitemap lastmods (sitemap-knowledge-center.xml + manifest + sitemap-index).

Idempotent: re-running changes nothing (all inserts carry kc-* markers).
Usage: python3 _tools/kc_phase1_unify.py [--dry-run]
"""
import re
import sys
import json
import math
import glob
from collections import Counter, defaultdict

TODAY = '2026-09-07'
ORG = 'تیم مهندسی و تامین پیشرو تجهیز فرتاک'
KC = 'knowledge-center'

# ---------------------------------------------------------------- jalali ---
JALALI_BREAKS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210,
                 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178]


def _div(a, b):
    return int(a / b)


def _mod(a, b):
    return a - int(a / b) * b


def _jal_cal(jy):
    bl = len(JALALI_BREAKS)
    gy = jy + 621
    leapJ = -14
    jp = JALALI_BREAKS[0]
    jump = 0
    i = 1
    while i < bl:
        jm = JALALI_BREAKS[i]
        jump = jm - jp
        if jy < jm:
            break
        leapJ = leapJ + _div(jump, 33) * 8 + _div(_mod(jump, 33), 4)
        jp = jm
        i += 1
    n = jy - jp
    leapJ = leapJ + _div(n, 33) * 8 + _div(_mod(n, 33) + 3, 4)
    if _mod(jump, 33) == 4 and jump - n == 4:
        leapJ += 1
    leapG = _div(gy, 4) - _div((_div(gy, 100) + 1) * 3, 4) - 150
    march = 20 + leapJ - leapG
    if jump - n < 6:
        n = n - jump + _div(jump + 4, 33) * 33
    leap = _mod(_mod(n + 1, 33) - 1, 4)
    if leap == -1:
        leap = 4
    return leap, gy, march


def _g2d(y, m, d):
    a = _div(14 - m, 12)
    y2 = y + 4800 - a
    m2 = m + 12 * a - 3
    return d + _div(153 * m2 + 2, 5) + 365 * y2 + _div(y2, 4) - _div(y2, 100) + _div(y2, 400) - 32045


def _d2g(jdn):
    a = jdn + 32044
    b = _div(4 * a + 3, 146097)
    c = a - _div(146097 * b, 4)
    d = _div(4 * c + 3, 1461)
    e = c - _div(1461 * d, 4)
    m = _div(5 * e + 2, 153)
    day = e - _div(153 * m + 2, 5) + 1
    month = m + 3 - 12 * _div(m, 10)
    year = 100 * b + d - 4800 + _div(m, 10)
    return year, month, day


def _d2j(jdn):
    gy, _gm, _gd = _d2g(jdn)
    jy = gy - 621
    r = _jal_cal(jy)
    jdn1f = _g2d(gy, 3, r[2])
    k = jdn - jdn1f
    if k >= 0:
        if k <= 185:
            return jy, 1 + _div(k, 31), _mod(k, 31) + 1
        k -= 186
    else:
        jy -= 1
        k += 179
        if r[0] == 1:
            k += 1
    return jy, 7 + _div(k, 30), _mod(k, 30) + 1


def to_jalaali(y, m, d):
    return _d2j(_g2d(y, m, d))


FA_MONTHS = ['', 'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
             'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند']
FA_DIGITS = str.maketrans('0123456789', '۰۱۲۳۴۵۶۷۸۹')


def fa_num(n):
    return str(n).translate(FA_DIGITS)


def jalali_str(iso):
    y, m, d = [int(x) for x in iso.split('-')]
    jy, jm, jd = to_jalaali(y, m, d)
    return '%s %s %s' % (fa_num(jd), FA_MONTHS[jm], fa_num(jy))


# ------------------------------------------------------------ tokenizer ---
TAG_RE = re.compile(r'<!--[\s\S]*?-->|</?[A-Za-z][A-Za-z0-9]*(?:\s[^<>]*)?/?>', re.S)
ATTR_RE = re.compile(r'''([A-Za-z_:][\w:.-]*)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?''')
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link',
        'meta', 'param', 'source', 'track', 'wbr'}


def tokenize(html):
    ev = []
    for m in TAG_RE.finditer(html):
        t = m.group(0)
        if t.startswith('<!--') or t.startswith('<!'):
            continue
        mm = re.match(r'</?\s*([A-Za-z][A-Za-z0-9]*)', t)
        if not mm:
            continue
        tag = mm.group(1).lower()
        attrs = {}
        for am in ATTR_RE.finditer(t[mm.end():]):
            k = am.group(1).lower()
            v = am.group(2)
            if v is None:
                attrs[k] = ''
            else:
                attrs[k] = v[1:-1] if v[:1] in '"\'' else v
        ev.append({'typ': 'close' if t.startswith('</') else 'open',
                   'tag': tag, 'attrs': attrs,
                   'sc': t.rstrip().endswith('/>'),
                   's': m.start(), 'e': m.end()})
    return ev


def match_close(ev, idx):
    tag = ev[idx]['tag']
    depth = 1
    for j in range(idx + 1, len(ev)):
        e = ev[j]
        if e['tag'] != tag:
            continue
        if e['typ'] == 'open' and not e['sc'] and tag not in VOID:
            depth += 1
        elif e['typ'] == 'close':
            depth -= 1
            if depth == 0:
                return j
    return None


def imbalance(ev):
    bal = Counter()
    for e in ev:
        if e['sc'] or e['tag'] in VOID:
            continue
        bal[e['tag']] += 1 if e['typ'] == 'open' else -1
    return {k: v for k, v in bal.items() if v != 0}


def strip_tags(s):
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', s)).strip()


# ------------------------------------------------------------- related ----
STOP = set(('راهنمای راهنما کامل جامع خرید تجهیزات صنعتی برای مهندسان '
            'کارشناسان تامین تامين انتخاب بررسی فنی تخصصی مقاله مقالات در از '
            'با و به یا را که این آن ها های می شود شده است هستند کند کنند دارد '
            'دارند شود توانید بین بر اساس طور نحوه چرا چگونه چیست کجا کدام چه '
            'هر یک دو سه خود تحت روی امور امورفنی پیشرو تجهیز فرتاک صنعتی‌سازی '
            'guide complete ultimate equipment industrial engineering selection '
            'review technical article articles for and the with from what how why '
            'a an of to in on vsDifference difference').split())
TOK_SPLIT = re.compile(r'[\s,;:.|/()«»"\'\-–—!?؟\[\]{}،؛]+')

# Zero-overlap pages -> hand-picked topical targets (verified indexable 2026-09-07)
MANUAL_RELATED = {
    'article-009.html': ['international-supply-contract-guide.html',
                         'kc-international-supply-contracts.html',
                         'industrial-procurement-documentation-guide.html'],
    'kc-flare-burner-equipment.html': ['kc-fire-suppression-agent-selection-guide.html',
                                      'kc-fm200-co2-foam-water.html',
                                      'fire-test-api-607.html'],
    'kc-industrial-laboratory-equipment.html': ['hplc-gc.html',
                                               'hart-calibration-training.html',
                                               'article-007.html'],
    'power-plant-industry-supply-guide.html': ['article-013.html',
                                              'kc-thermal-powerplant-equipment.html',
                                              'kc-steam-turbine-blade-erosion-prevention.html'],
    'shutdown-turnaround-industrial-guide.html': ['kc-pm.html',
                                                 'kc-pm-predictive-vs-preventive-strategy.html',
                                                 'kc-ups.html'],
}


def toks(text):
    out = []
    for w in TOK_SPLIT.split(text):
        w = w.strip().strip('.')
        if not w:
            continue
        wl = w.lower() if re.search(r'[A-Za-z]', w) else w
        if wl in STOP or len(wl) < 2:
            continue
        out.append(wl)
    return out


# ------------------------------------------------------------------ main ---
def main():
    dry = '--dry-run' in sys.argv

    # jalali self-test (known anchors; abort on drift)
    assert to_jalaali(2026, 3, 21) == (1405, 1, 1), to_jalaali(2026, 3, 21)
    assert to_jalaali(2026, 7, 15) == (1405, 4, 24), to_jalaali(2026, 7, 15)
    assert to_jalaali(2025, 3, 21) == (1404, 1, 1), to_jalaali(2025, 3, 21)

    files = sorted(glob.glob(KC + '/*.html'))
    sm = open('sitemap-knowledge-center.xml', encoding='utf-8').read()
    sm_urls = set(re.findall(r'<loc>(https://pishtaj\.ir/knowledge-center/[^<]+)</loc>', sm))

    # triage tiers for related tie-break
    tier = {}
    try:
        for line in open('_audit/KC-CONTENT-TRIAGE-2026-09-07.csv', encoding='utf-8').read().splitlines()[1:]:
            parts = line.split(',')
            if len(parts) >= 10:
                tier[parts[0].strip()] = parts[9].strip()
    except FileNotFoundError:
        pass

    html = {}
    noindex = set()
    for p in files:
        h = open(p, encoding='utf-8').read()
        html[p] = h
        if re.search(r'<meta[^>]+noindex', h):
            noindex.add(p)

    def url_of(p):
        return 'https://pishtaj.ir/' + p

    indexable = [p for p in files
                 if not p.endswith('index.html')
                 and p not in noindex
                 and url_of(p) in sm_urls]

    # ---- related candidate pool ----
    h1 = {}
    for p in indexable:
        m = re.search(r'<h1[^>]*>([\s\S]*?)</h1>', html[p], re.I)
        h1[p] = strip_tags(m.group(1)) if m else ''
    df = Counter()
    tok_cache = {}
    for p in indexable:
        ts = set(toks(h1[p]))
        tok_cache[p] = ts
        for t in ts:
            df[t] += 1

    def related_for(p, k=3):
        scored = []
        for q in indexable:
            if q == p:
                continue
            shared = tok_cache[p] & tok_cache[q]
            if not shared:
                continue
            s = sum(1.0 / df[t] for t in shared)
            tp = 0 if tier.get(q.split('/')[-1], '') == 'KEEP' else 1
            scored.append((-s, tp, q))
        scored.sort()
        out = [q for _, _, q in scored[:k]]
        if out:
            return out
        # zero token overlap: hand-verified topical map (all targets indexable)
        man = MANUAL_RELATED.get(p.split('/')[-1], [])
        out = [KC + '/' + t for t in man if KC + '/' + t in indexable]
        if out:
            return out
        return ['HUB']  # ultimate fallback: link to the KC hub

    def rel_href_title(q):
        if q == 'HUB':
            return 'index.html', 'همه مقالات مرکز دانش فنی'
        return q.split('/')[-1], h1[q][:90]

    # ---- markup builders ----
    def byline_html(pub, mod, author, minutes):
        return (
            '\n<div class="kc-byline" style="display:flex;flex-wrap:wrap;gap:8px 18px;'
            'align-items:center;font-size:13px;color:#64748b;background:#f8fafc;'
            'border:1px solid #e2e8f0;border-radius:14px;padding:10px 16px;margin:0 0 18px">'
            '<span>نویسنده: <b style="color:#334155">%s</b></span>'
            '<span>منتشرشده: <time datetime="%s">%s</time></span>'
            '<span>به‌روزرسانی: <time datetime="%s">%s</time></span>'
            '<span>زمان مطالعه: %s دقیقه</span>'
            '</div>\n'
        ) % (author, pub, jalali_str(pub), mod, jalali_str(mod), fa_num(minutes))

    def toc_html(items):
        lis = ''.join(
            '<li><a href="#%s" style="color:#0e7490;text-decoration:none">%s</a></li>' % (i, t)
            for i, t in items)
        return (
            '\n<nav class="kc-toc" aria-label="فهرست مطالب" style="background:#fff;'
            'border:1px solid #e2e8f0;border-radius:14px;padding:12px 18px;'
            'margin:0 0 20px;font-size:14px">'
            '<b style="display:block;margin-bottom:6px;color:#0f172a">فهرست مطالب</b>'
            '<ul style="margin:0;padding-right:18px;display:grid;gap:4px;color:#334155">%s</ul>'
            '\n</nav>\n' % lis)

    LI_A = ('<li style="margin:0"><a href="%s" style="color:#334155;text-decoration:none;'
            'border-bottom:1px solid #e2e8f0;padding:5px 0;display:block;line-height:1.7">%s</a></li>')

    def related_section_html(targets):
        lis = '\n'.join('  ' + LI_A % rel_href_title(q) for q in targets)
        return (
            '\n<section data-ptf-related="1" class="ptf-related" '
            'style="max-width:1100px;margin:0 auto;padding:34px 20px 6px">'
            '\n<h2 id="kc-related" style="font-size:17px;color:#0f172a;margin:0 0 14px;'
            'padding-bottom:8px;border-bottom:2px solid #ef4b1a;display:inline-block">'
            'مطالب مرتبط در مرکز دانش</h2>'
            '\n<ul style="list-style:none;padding:0;margin:0;display:grid;gap:0;'
            'grid-template-columns:repeat(auto-fill,minmax(260px,1fr));column-gap:26px;font-size:13.5px">'
            '\n%s\n</ul>\n</section>\n' % lis)

    def related_inner_html(targets):
        items = '\n'.join(
            '<a class="rel-item" href="%s"><b>%s</b><span>مرکز دانش فنی</span></a>'
            % rel_href_title(q) for q in targets)
        return ('\n<h2 id="kc-related">مطالب مرتبط</h2>'
                '\n<div class="related-articles">\n%s\n</div>\n' % items)

    # ---- per-file transform ----
    stats = Counter()
    log_rows = []
    errors = []
    samples = []

    for p in files:
        h = html[p]
        ops = []
        rel_targets = []

        # 0) shortest fix everywhere (incl. retired + hub)
        if 'shortest' in h:
            n = h.count('در shortest زمان ممکن')
            h = h.replace('در shortest زمان ممکن', 'در کوتاه‌ترین زمان ممکن')
            assert 'shortest' not in h, p
            ops.append('shortest×%d' % n)
            stats['shortest_files'] += 1

        if p.endswith('index.html') or p not in indexable:
            if h != html[p]:
                if not dry:
                    open(p, 'w', encoding='utf-8').write(h)
                stats['touched_retired_hub'] += 1
            continue

        if 'kc-byline' in h:
            # already unified (idempotent re-run): verify invariants only
            evf = tokenize(h)
            assert not imbalance(evf), p
            assert len([e for e in evf if e['tag'] == 'main' and e['typ'] == 'open'
                        and not e['sc']]) == 1, p
            assert 'shortest' not in h and 'kc-toc' in h, p
            stats['already_done'] += 1
            continue

        # family detection (body only, scripts/styles stripped)
        b = h[h.find('</nav>'):] if '</nav>' in h else h
        b = re.sub(r'<script[\s\S]*?</script>|<style[\s\S]*?</style>', ' ', b)
        has_main = bool(re.search(r'<main[ >]', b))
        has_art = bool(re.search(r'<article[ >]', b))
        has_wrap = 'article-wrap' in b
        has_rel = bool(re.search(r'مطالب مرتبط|مقالات مرتبط', b))

        # 1) renames
        ev = tokenize(h)
        renames = []  # (open_idx, new_tag, extra_attr)
        if not has_main and not has_art and has_wrap:
            fam = 'A'
            for i, e in enumerate(ev):
                if e['typ'] != 'open' or e['sc']:
                    continue
                cls = e['attrs'].get('class', '')
                if e['tag'] == 'div' and 'article-wrap' in cls.split():
                    renames.append((i, 'main', ' id="main-content"'))
                elif e['tag'] == 'div' and 'article-content' in cls.split():
                    renames.append((i, 'article', ''))
        elif has_art and not has_main:
            fam = 'B'
            stack = []
            for i, e in enumerate(ev):
                if e['typ'] == 'open' and not e['sc'] and e['tag'] not in VOID:
                    if e['tag'] == 'article':
                        for s in reversed(stack):
                            if s[1] == 'div':
                                renames.append((s[0], 'main', ' id="main-content"'))
                                break
                        break
                    stack.append((i, e['tag']))
                elif e['typ'] == 'close':
                    while stack and stack[-1][1] != e['tag']:
                        stack.pop()
                    if stack:
                        stack.pop()
        elif has_main and has_art:
            fam = 'GOOD'
        else:
            fam = 'ODD'  # nace: section containing h1 -> main, inner div -> article
            for i, e in enumerate(ev):
                if e['typ'] == 'open' and not e['sc'] and e['tag'] == 'section':
                    j = match_close(ev, i)
                    if j and '<h1' in h[e['e']:ev[j]['s']]:
                        renames.append((i, 'main', ' id="main-content"'))
                        for k in range(i + 1, j):
                            ek = ev[k]
                            if ek['typ'] == 'open' and not ek['sc'] and ek['tag'] == 'div':
                                renames.append((k, 'article', ''))
                                break
                        break
        if fam in ('A', 'B', 'ODD') and not renames:
            errors.append((p, 'no-rename-target'))
            continue

        edits = []
        for i, new_tag, extra in renames:
            j = match_close(ev, i)
            if j is None:
                errors.append((p, 'unmatched-' + ev[i]['tag']))
                break
            old_open = h[ev[i]['s']:ev[i]['e']]
            mm = re.match(r'<([A-Za-z][A-Za-z0-9]*)', old_open)
            new_open = '<' + new_tag + extra + old_open[mm.end():]
            edits.append((ev[i]['s'], ev[i]['e'], new_open))
            edits.append((ev[j]['s'], ev[j]['e'], '</' + new_tag + '>'))
        else:
            for s, e, rep in sorted(edits, reverse=True):
                h = h[:s] + rep + h[e:]
            if renames:
                ops.append('rename:%s' % fam)
                stats['rename_' + fam] += 1

        if errors and errors[-1][0] == p:
            continue

        # 2) article region + H2 scan (re-parse after rename)
        ev = tokenize(h)
        art_open = next(i for i, e in enumerate(ev)
                        if e['typ'] == 'open' and e['tag'] == 'article')
        art_close = match_close(ev, art_open)
        assert art_close is not None, p
        a_s, a_e = ev[art_open]['e'], ev[art_close]['s']

        h2s = []  # (open_idx, text, existing_id)
        for i, e in enumerate(ev):
            if e['typ'] == 'open' and e['tag'] == 'h2' and ev[i]['s'] >= a_s and ev[i]['s'] < a_e:
                j = match_close(ev, i)
                txt = strip_tags(h[e['e']:ev[j]['s']]) if j else ''
                h2s.append((i, txt, e['attrs'].get('id', '')))
        content_h2 = [(i, t, d) for i, t, d in h2s
                      if t and not re.search(r'مطالب مرتبط|مقالات مرتبط', t)]
        rel_h2 = [(i, t, d) for i, t, d in h2s
                  if t and re.search(r'مطالب مرتبط|مقالات مرتبط', t)]

        existing_ids = {e['attrs'].get('id') for e in ev if e['attrs'].get('id')}
        toc_items = []
        id_edits = []
        n = 0
        for i, t, d in content_h2:
            if d:
                toc_items.append((d, t[:90]))
                continue
            n += 1
            nid = 'kc-sec-%d' % n
            while nid in existing_ids:
                nid += '-x'
            existing_ids.add(nid)
            id_edits.append((ev[i]['s'] + 3, ev[i]['s'] + 3, ' id="%s"' % nid))
            toc_items.append((nid, t[:90]))
        for i, t, d in rel_h2:
            if not d and 'kc-related' not in existing_ids:
                id_edits.append((ev[i]['s'] + 3, ev[i]['s'] + 3, ' id="kc-related"'))
                existing_ids.add('kc-related')

        # 3) byline data
        pub = re.search(r'"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})', h)
        mod = re.search(r'"dateModified"\s*:\s*"(\d{4}-\d{2}-\d{2})', h)
        assert pub and mod, p + ' dates'
        am = re.search(r'"author"\s*:\s*\{\s*"@type"\s*:\s*"[^"]*"\s*,\s*"name"\s*:\s*"([^"]+)"', h)
        if not am:
            am = re.search(r'"author"\s*:\s*"([^"]+)"', h)
        author = am.group(1) if am else ORG
        art_words = len(re.findall(r'\S+', strip_tags(h[a_s:a_e])))
        minutes = max(1, int(math.ceil(art_words / 200.0)))

        insert = byline_html(pub.group(1), mod.group(1), author, minutes)
        if len(toc_items) >= 2:
            insert += toc_html(toc_items)
            ops.append('toc%d' % len(toc_items))
        else:
            ops.append('toc-skip%d' % len(toc_items))
        ops.append('byline')
        id_edits.append((a_s, a_s, insert))
        for s, e, rep in sorted(id_edits, reverse=True):
            h = h[:s] + rep + h[e:]
        stats['byline'] += 1

        # 4) related backfill
        if not has_rel:
            targets = related_for(p)
            assert targets, p
            rel_targets = [q if q == 'HUB' else q.split('/')[-1] for q in targets]
            if fam == 'A':
                ev2 = tokenize(h)
                ao = next(i for i, e in enumerate(ev2)
                          if e['typ'] == 'open' and e['tag'] == 'article')
                ac = match_close(ev2, ao)
                pos = ev2[ac]['s']
                h = h[:pos] + related_inner_html(targets) + h[pos:]
            else:
                mfoot = re.search(r'<footer[ >]', h)
                assert mfoot, p + ' footer'
                pos = mfoot.start()
                h = h[:pos] + related_section_html(targets) + h[pos:]
            ops.append('related×%d%s' % (len(targets), '-hub' if targets == ['HUB'] else ''))
            stats['related_hub' if targets == ['HUB'] else 'related_added'] += 1
            if len(samples) < 12:
                samples.append((p.split('/')[-1], rel_targets))
        else:
            ops.append('related-exists')

        # 5) verify
        evf = tokenize(h)
        imb = imbalance(evf)
        assert not imb, (p, imb)
        mains = [e for e in evf if e['tag'] == 'main' and e['typ'] == 'open' and not e['sc']]
        assert len(mains) == 1 and mains[0]['attrs'].get('id') == 'main-content', p
        assert h.count('id="main-content"') == 1, p
        assert 'shortest' not in h, p
        assert 'kc-byline' in h and h.count('<time datetime="') >= 2, p
        assert ('kc-toc' in h) == (len(toc_items) >= 2), p
        bb = h[h.find('</nav>'):] if '</nav>' in h else h
        bb = re.sub(r'<script[\s\S]*?</script>|<style[\s\S]*?</style>', ' ', bb)
        assert re.search(r'مطالب مرتبط|مقالات مرتبط', bb), p

        log_rows.append((p, fam, '|'.join(ops), ';'.join(rel_targets)))
        if h != html[p]:
            if not dry:
                open(p, 'w', encoding='utf-8').write(h)
            stats['touched'] += 1

    # ---- sitemap lastmods ----
    touched = [p for p, _, _, _ in log_rows]
    if touched and not dry:
        smp = 'sitemap-knowledge-center.xml'
        smx = open(smp, encoding='utf-8').read()
        for p in touched:
            url = url_of(p)
            smx2, n = re.subn(
                r'(<loc>%s</loc><lastmod>)\d{4}-\d{2}-\d{2}(</lastmod>)' % re.escape(url),
                r'\g<1>%s\g<2>' % TODAY, smx)
            assert n == 1, p
            smx = smx2
        open(smp, 'w', encoding='utf-8').write(smx)
        manp = '_tools/sitemap-lastmod.json'
        man = json.load(open(manp, encoding='utf-8'))
        for p in touched:
            man[p] = TODAY
        with open(manp, 'w', encoding='utf-8') as f:
            json.dump(man, f, ensure_ascii=False, indent=2)
            f.write('\n')
        six = 'sitemap-index.xml'
        sx = open(six, encoding='utf-8').read()
        sx2, n = re.subn(
            r'(<loc>https://pishtaj\.ir/sitemap-knowledge-center\.xml</loc><lastmod>)\d{4}-\d{2}-\d{2}(</lastmod>)',
            r'\g<1>%s\g<2>' % TODAY, sx)
        if n == 1:
            open(six, 'w', encoding='utf-8').write(sx2)
            stats['sitemap_index'] = 1

    if log_rows and not dry:
        with open('_audit/KC-PHASE1-LOG-2026-09-07.csv', 'w', encoding='utf-8') as f:
            f.write('file,family,ops,related_targets\n')
            for p, fam, ops, rt in log_rows:
                f.write('%s,%s,%s,%s\n' % (p, fam, ops, rt))

    print('indexable:', len(indexable), '| touched:', stats['touched'],
          '| retired/hub shortest-only:', stats['touched_retired_hub'])
    for k in sorted(stats):
        if k not in ('touched', 'touched_retired_hub'):
            print(' ', k, stats[k])
    print('SAMPLE related mappings:')
    for s, t in samples:
        print('  ', s, '->', t)
    if errors:
        print('ERRORS:')
        for p, e in errors:
            print('  ', p, e)
        sys.exit(1)


if __name__ == '__main__':
    main()
