#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""KC Phase 1b (2026-09-07): move the 55 stray lead blocks (<h2>+<p> sitting
between hero </section> and <main>) inside <article>, right after the TOC,
with id="kc-lead" + prepended TOC entry. Second pass: id backfill for every
remaining id-less <h2> in the body (related headings -> kc-related, else kc-x-N).

Idempotent: skips files with no stray block; id pass skips H2s that have ids.
Usage: python3 _tools/kc_phase1b_stray_lead.py [--dry-run]
"""
import re
import sys
import glob

import sys as _s
_s.path.insert(0, '_tools')
from kc_phase1_unify import tokenize, imbalance, strip_tags  # noqa: E402

DRY = '--dry-run' in sys.argv
LEAD_RE = re.compile(r'\A\s*<h2>([\s\S]*?)</h2>\s*<p>([\s\S]*?)</p>\s*\Z')
H2OPEN_RE = re.compile(r'<h2(?![^>]*\sid=)([ >])')


def main():
    stats = {'moved': 0, 'rel_ids': 0, 'x_ids': 0}
    log = []
    for p in sorted(glob.glob('knowledge-center/*.html')):
        if p.endswith('index.html'):
            continue
        h = open(p, encoding='utf-8').read()
        if re.search(r'<meta[^>]+noindex', h):
            continue
        ops = []
        mi = h.find('<main')
        assert mi > 0, p
        hero_end = h.rfind('</section>', 0, mi)
        seg = h[hero_end + len('</section>'):mi] if hero_end > 0 else ''
        m = LEAD_RE.match(seg)
        if m:
            if DRY:
                stats['moved'] += 1
                continue
            lead_text = strip_tags(m.group(1))
            assert 'kc-lead' not in h, p
            block = '\n<h2 id="kc-lead">%s</h2>\n<p>%s</p>\n' % (m.group(1).strip(), m.group(2).strip())
            # cut stray region (leave single newline)
            h = h[:hero_end + len('</section>')] + '\n' + h[mi:]
            # insertion point: after TOC nav close, else after byline div
            ai = h.find('<article')
            assert ai > 0, p
            ti = h.find('<nav class="kc-toc"', ai)
            if ti > 0:
                tc = h.find('</nav>', ti)
                assert tc > 0, p
                pos = tc + len('</nav>')
                ul = h.find('<ul', ti)
                assert ti < ul < tc, p
                ul_end = h.find('>', ul) + 1
                li = ('<li><a href="#kc-lead" style="color:#0e7490;text-decoration:none">%s</a></li>'
                      % lead_text[:90])
                h = h[:ul_end] + li + h[ul_end:]
                pos += len(li)
                h = h[:pos] + block + h[pos:]
            else:
                bi = h.find('<div class="kc-byline"', ai)
                assert bi > 0, p
                bc = h.find('</div>', bi) + len('</div>')
                h = h[:bc] + block + h[bc:]
            ops.append('lead-moved')
            stats['moved'] += 1

        # second pass: id-less H2 backfill (body only)
        body_start = h.find('</nav>')
        n = 0
        while True:
            mm = H2OPEN_RE.search(h, body_start)
            if not mm:
                break
            hs, kind = mm.start(), mm.group(1)
            hc = h.find('</h2>', hs)
            assert hc > 0, p
            txt = strip_tags(h[mm.end():hc])
            if re.search(r'مطالب مرتبط|مقالات مرتبط', txt):
                nid = 'kc-related'
                if 'id="kc-related"' in h:
                    nid = 'kc-related-2'
                    assert 'id="kc-related-2"' not in h, p
                ops.append('rel-id')
                stats['rel_ids'] += 1
            else:
                n += 1
                nid = 'kc-x-%d' % n
                while 'id="%s"' % nid in h:
                    nid += '-y'
                ops.append('x-id')
                stats['x_ids'] += 1
            ins = ' id="%s"%s' % (nid, kind)
            h = h[:hs + 3] + ins + h[mm.end():]
            body_start = hs + 3 + len(ins)

        if ops and not DRY:
            ev = tokenize(h)
            assert not imbalance(ev), p
            assert h.count('<main') == 1, p
            mi2 = h.find('<main')
            he2 = h.rfind('</section>', 0, mi2)
            if he2 > 0:
                assert LEAD_RE.match(h[he2 + len('</section>'):mi2]) is None, p
            open(p, 'w', encoding='utf-8').write(h)
            log.append((p, '|'.join(ops)))
        elif ops:
            log.append((p, '|'.join(ops)))

    print('moved:', stats['moved'], '| rel_ids:', stats['rel_ids'], '| x_ids:', stats['x_ids'])
    if log and not DRY:
        with open('_audit/KC-PHASE1B-LOG-2026-09-07.csv', 'w', encoding='utf-8') as f:
            f.write('file,ops\n')
            for p, ops in log:
                f.write('%s,%s\n' % (p, ops))
    if DRY:
        print('files needing work:', len(log))


if __name__ == '__main__':
    main()
