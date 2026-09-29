# -*- coding: utf-8 -*-
"""Phase 1 — retarget every call ICON to the new company line 021-91099242,
rename the "خط ویژه بازرگانی" label, and update the generated dock in site-shell.js.

Scope of this phase (anchors only, never a bare phone string):
  * <a class="floating-call" href="tel:02146087679" ...>   (floating call button)
  * <a href="tel:02146087679" data-ptf-event="dock_call">  (mobile dock button)
  * <a class="header-call" ...>021-46087679</a>            (header call button)
The old number keeps its plain-text / own-link role elsewhere (contact card,
footer, profile table, JSON-LD).
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _common import *          # noqa

TARGETS = (
    site_files((".html",))
    + [os.path.join(ROOT, "assets", "js", "site-shell.js"),
       os.path.join(ROOT, "api", "careers.php")]
)

REPL = [
    # --- floating call button -------------------------------------------------
    ('<a class="floating-call" href="tel:02146087679"',
     '<a class="floating-call" href="tel:02191099242"'),
    # --- mobile dock call button (hardcoded + JS-generated) -------------------
    ('<a href="tel:02146087679" data-ptf-event="dock_call"',
     '<a href="tel:02191099242" data-ptf-event="dock_call"'),
    # --- header call button (fa / intl) : link AND the number it shows --------
    ('<a class="header-call" href="tel:02146087679">021-46087679</a>',
     '<a class="header-call" href="tel:02191099242">021-91099242</a>'),
    ('<a class="header-call" dir="ltr" href="tel:+982146087679">+98 21 46087679</a>',
     '<a class="header-call" dir="ltr" href="tel:+982191099242">+98 21 91099242</a>'),
    # --- label rename ---------------------------------------------------------
    ("خط ویژه بازرگانی", "خط مستقیم بازرگانی"),
    ("خط ویژه", "خط مستقیم"),
]

totals = {}
changed = []
for p in TARGETS:
    if not os.path.exists(p):
        continue
    t = read(p)
    orig = t
    for old, new in REPL:
        n = t.count(old)
        if n:
            totals[old[:60]] = totals.get(old[:60], 0) + n
            t = t.replace(old, new)
    if t != orig:
        write(p, t)
        changed.append(os.path.relpath(p, ROOT))

for k, v in totals.items():
    print(f"{v:5d}  {k}")
print(f"\nchanged files: {len(changed)}")
for c in changed[:12]:
    print("   ", c)
if len(changed) > 12:
    print("    ...")
