# -*- coding: utf-8 -*-
"""Phase 3 — Persian footer: new «تماس با ما» column + phone strip in the bottom bar.

Two footer shapes exist in the 670 Persian pages:
  * shell  — <footer data-ptf-shell="footer" id="ptf-site-footer">  (628 pages)
             icons use the .ptf-line-icon class styled by assets/css/site-shell.css
  * plain  — <footer class="footer">                               (42 knowledge-center pages)
             no #ptf-site-footer id, so icons must be styled inline
Both get the same contact column / bottom strip, with the icon markup matched
to the surrounding file so nothing renders unstyled.
"""
import sys, os, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _common import *          # noqa

SVG_CALL = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
            'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
            '<path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 '
            '2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 2 .7 2.9a2 2 0 01-.5 2.1L8 10a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.5'
            'c.9.3 1.9.6 2.9.7a2 2 0 011.7 2z"/></svg>')
SVG_MAIL = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
            'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
            '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>')
SVG_PIN = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
           'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
           '<rect x="5" y="3" width="14" height="18" rx="1"/>'
           '<path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/></svg>')

INLINE_ICO = ('display:inline-grid;place-items:center;width:22px;height:22px;flex:0 0 22px;'
              'border:1px solid rgba(148,163,184,.45);border-radius:8px;font-size:10px;font-weight:900;'
              'color:inherit;margin-left:6px;vertical-align:middle')

HEAD = ('<b style="color:#fff; font-size:16px; display:block; margin-bottom:16px; '
        'border-bottom:2px solid rgba(255,255,255,.1); padding-bottom:8px;">تماس با ما</b>')
LIST = 'style="display:grid; gap:14px; font-size:14px;"'
ROW = 'style="color:#cbd5e1; transition:.2s; display:block;"'
LBL = 'style="display:inline-flex;align-items:center;gap:4px;line-height:1.7;direction:rtl;"'
NUM = 'style="display:block; color:#ffb033; font-weight:900; font-size:15px; margin-top:2px;"'
ADDR = 'style="color:#94a3b8; font-size:13px; line-height:1.8; margin-top:2px;"'

FOOTER_BAR_OPEN = ('<div class="container" style="display:flex; justify-content:space-between; '
                   'align-items:center; flex-wrap:wrap; gap:15px; padding-top:1.5rem; '
                   'border-top:1px solid rgba(255,255,255,.08); font-size:13px; color:#64748b;">')
GRID_TAIL = 'مشاهده نظام تضمین کیفیت ←</a>\n      </div>\n    </div>'


def ico(svg, cls):
    return (f'<span class="{cls}" aria-hidden="true">{svg}</span>'
            if cls else f'<span style="{INLINE_ICO}">{svg}</span>')


def contact_col(cls):
    """«تماس با ما» column: commercial direct line + company line + email + address."""
    return (
        '      <div>\n'
        f'        {HEAD}\n'
        f'        <div {LIST}>\n'
        f'          <a href="tel:{OLD_LOCAL}" {ROW}><span {LBL}>{ico(SVG_CALL, cls)} خط مستقیم بازرگانی</span>'
        f'<b dir="ltr" {NUM}>{OLD_DASH}</b></a>\n'
        f'          <a href="tel:{NEW_LOCAL}" {ROW}><span {LBL}>{ico(SVG_CALL, cls)} شماره تماس شرکت</span>'
        f'<b dir="ltr" {NUM}>{NEW_DASH}</b></a>\n'
        f'          <a href="mailto:{EMAIL}" {ROW}><span {LBL}>{ico(SVG_MAIL, cls)} ایمیل رسمی</span>'
        f'<b dir="ltr" style="display:block; color:#cbd5e1; font-weight:800; font-size:13.5px; margin-top:2px;">'
        f'{EMAIL}</b></a>\n'
        f'          <div><span {LBL}>{ico(SVG_PIN, cls)} آدرس دفتر مرکزی</span>'
        f'<span {ADDR}>تهران، بلوار کوهک، مجتمع تجاری اداری طوبی، بلوک A اداری، طبقه ۱۶</span></div>\n'
        '        </div>\n'
        '      </div>\n'
    )


def bottom_strip():
    """Compact phone pair for the copyright bar."""
    s = ('<span style="display:inline-flex;align-items:center;gap:16px;flex-wrap:wrap;color:#94a3b8;">')
    for tel, dash, title in ((OLD_LOCAL, OLD_DASH, "خط مستقیم بازرگانی"),
                             (NEW_LOCAL, NEW_DASH, "شماره تماس شرکت")):
        s += (f'<a dir="ltr" href="tel:{tel}" title="{title}" aria-label="{title}: {dash}" '
              'style="color:#94a3b8;text-decoration:none;display:inline-flex;align-items:center;gap:6px;">'
              f'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
              f'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
              '<path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 '
              '2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 2 .7 2.9a2 2 0 01-.5 2.1L8 10a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.5'
              'c.9.3 1.9.6 2.9.7a2 2 0 011.7 2z"/></svg>'
              f'{dash}</a>')
    return s + '</span>\n      '


FOOTER_RE = re.compile(r'<footer.*?</footer>', re.S)
stats = {"shell": 0, "plain": 0, "i18n": 0, "skipped": 0}
changed = 0

for p in site_files():
    t = read(p)
    m = FOOTER_RE.search(t)
    if not m:
        stats["skipped"] += 1
        continue
    b = m.group(0)
    is_i18n = "shell-footer-heading" in b

    if is_i18n:
        # i18n footers already carry a contact column — add the company line to it.
        if NEW_INTL in b:
            stats["i18n"] += 1
            continue
        old = f'<a dir="ltr" href="tel:{OLD_INTL}">{OLD_SP}</a><br/>'
        if old not in b:
            stats["skipped"] += 1
            continue
        b = b.replace(old, old + f'<a dir="ltr" href="tel:{NEW_INTL}">{NEW_SP}</a><br/>')
        stats["i18n"] += 1
    else:
        # already carries the company number (shell, plain, or compact CRM bar) -> done
        if NEW_LOCAL in b or NEW_INTL in b:
            stats["already"] = stats.get("already", 0) + 1
            continue
        shell = 'id="ptf-site-footer"' in b
        cls = "ptf-line-icon" if shell else ""
        stats["shell" if shell else "plain"] += 1
        if GRID_TAIL not in b:
            raise SystemExit(f"grid tail anchor missing in {p}")
        b = b.replace(
            GRID_TAIL,
            'مشاهده نظام تضمین کیفیت ←</a>\n      </div>\n' + contact_col(cls) + '    </div>',
            1,
        )
        if FOOTER_BAR_OPEN not in b:
            raise SystemExit(f"bottom bar anchor missing in {p}")
        b = b.replace(FOOTER_BAR_OPEN, FOOTER_BAR_OPEN + "\n      " + bottom_strip(), 1)

    write(p, t[:m.start()] + b + t[m.end():])
    changed += 1

print(stats)
print("files changed:", changed)
