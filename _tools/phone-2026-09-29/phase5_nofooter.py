# -*- coding: utf-8 -*-
"""Phase 5 — contact footer for the 8 CRM tool pages that ship without one.

These are internal utilities (recover / clear-cache / force-restore / sync-diagnostics /
device-reconnect / letterhead / financial guide / the CRM app itself), so they get a
compact one-line contact bar rather than the 5-column marketing footer — the numbers are
present on every page without shoving a marketing grid into a diagnostic tool.

The 4 noindex meta-refresh stubs (services/*-equipment, suppliers/valve-supplier) are
deliberately NOT touched: they redirect on load and are never rendered.
"""
import sys, os, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _common import *          # noqa

BAR = (
    '\n<footer class="footer" style="background:#111113; color:#94a3b8; padding:22px 0; '
    'border-top:4px solid var(--red); text-align:center; font-size:13px;">'
    '<div style="display:flex; justify-content:center; align-items:center; gap:18px; '
    'flex-wrap:wrap;">'
    '<span style="color:#fff; font-weight:900;">پیشرو تجهیز فرتاک</span>'
    f'<a dir="ltr" href="tel:{OLD_LOCAL}" title="خط مستقیم بازرگانی" '
    'style="color:#cbd5e1; text-decoration:none; display:inline-flex; align-items:center; gap:6px;">'
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
    'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    '<path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 '
    '2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 2 .7 2.9a2 2 0 01-.5 2.1L8 10a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.5'
    'c.9.3 1.9.6 2.9.7a2 2 0 011.7 2z"/></svg>'
    f'{OLD_DASH}</a>'
    f'<a dir="ltr" href="tel:{NEW_LOCAL}" title="شماره تماس شرکت" '
    'style="color:#ffb033; font-weight:800; text-decoration:none; display:inline-flex; '
    'align-items:center; gap:6px;">'
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
    'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    '<path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 '
    '2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 2 .7 2.9a2 2 0 01-.5 2.1L8 10a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.5'
    'c.9.3 1.9.6 2.9.7a2 2 0 011.7 2z"/></svg>'
    f'{NEW_DASH}</a>'
    f'<a href="mailto:{EMAIL}" style="color:#cbd5e1; text-decoration:none;">'
    f'{EMAIL}</a>'
    '</div></footer>\n'
)

SKIP = {"services/electrical-equipment/index.html", "services/instrumentation-equipment/index.html",
        "services/piping-equipment/index.html", "suppliers/valve-supplier.html"}

done = []
for p in site_files():
    rel = os.path.relpath(p, ROOT).replace(os.sep, "/")
    if rel in SKIP:
        continue
    t = read(p)
    if re.search(r'<footer.*?</footer>', t, re.S):
        continue
    if BAR.strip() in t:
        continue
    if not t.rstrip().lower().endswith("</body></html>"):
        # insert before the final </body>, whatever precedes it
        m = re.search(r'</body>', t)
        if not m:
            print("SKIP (no </body>):", rel)
            continue
        t = t[:m.start()] + BAR + t[m.start():]
    else:
        t = t.rstrip()[: -len("</body></html>")].rstrip() + "\n" + BAR + "</body></html>\n"
    write(p, t)
    done.append(rel)

print(f"compact contact footer added to {len(done)} pages:")
for d in done:
    print("   ", d)
print("\nskipped (noindex meta-refresh stubs, never rendered):")
for s in sorted(SKIP):
    print("   ", s)
