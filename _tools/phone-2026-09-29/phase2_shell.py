# -*- coding: utf-8 -*-
"""Phase 2 — site-shell templates (_tools/site-shell/*.inc) and the chat widget.

The .inc files are the authoring templates for the shell that is inlined into the
711 generated pages, so they must carry the same numbers or the next regeneration
reverts the change.
"""
import sys, os, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _common import *          # noqa

REPL = [
    # header call button -> company line
    ('<a class="header-call" href="tel:02146087679">021-46087679</a>',
     '<a class="header-call" href="tel:02191099242">021-91099242</a>'),
    ('<a class="header-call" dir="ltr" href="tel:+982146087679">+98 21 46087679</a>',
     '<a class="header-call" dir="ltr" href="tel:+982191099242">+98 21 91099242</a>'),
    # i18n footer contact column: add the company line next to the commercial one
    ('<a dir="ltr" href="tel:+982146087679">+98 21 46087679</a><br/>',
     '<a dir="ltr" href="tel:+982146087679">+98 21 46087679</a><br/>'
     '<a dir="ltr" href="tel:+982191099242">+98 21 91099242</a><br/>'),
    # chat widget copy
    ("☎️ خط ویژه: 021-46087679",
     "☎️ خط مستقیم بازرگانی: 021-46087679\n☎️ تلفن شرکت: 021-91099242"),
    ("'tel:02146087679'", "'tel:02191099242'"),
]

targets = (glob.glob(os.path.join(ROOT, "_tools", "site-shell", "*.inc"))
           + [os.path.join(ROOT, "assets", "js", "ptf-chat.js")])

totals, changed = {}, []
for p in targets:
    t = read(p)
    orig = t
    for old, new in REPL:
        n = t.count(old)
        if n:
            totals[old[:58]] = totals.get(old[:58], 0) + n
            t = t.replace(old, new)
    if t != orig:
        write(p, t)
        changed.append(os.path.relpath(p, ROOT))

for k, v in totals.items():
    print(f"{v:5d}  {k}")
print(f"\nchanged: {changed}")
