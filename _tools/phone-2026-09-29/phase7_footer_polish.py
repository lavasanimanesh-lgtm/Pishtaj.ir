# -*- coding: utf-8 -*-
"""Phase 7 — footer polish.

A) Icon side.  assets/css/style.css carries
       .footer a[href^="tel"]{direction:ltr;display:inline-block}
   which flips EVERY tel: anchor in the footer to LTR. The «خط مستقیم بازرگانی» and
   «شماره تماس شرکت» rows are tel: links, so their icon+label line was laid out LTR
   and the icon sat on the LEFT of the label — while the mailto: and address rows
   stayed RTL with the icon on the right. Pinning direction:rtl on the label line
   makes every row render icon-on-the-right regardless of the href scheme.

B) Label.  «تلفن شرکت» -> «شماره تماس شرکت» across the public contact surfaces
   (footers, home card, profile table, chat widget, assistant prompt, tooltips).

   Deliberately NOT renamed: the CRM's own coTels field label
   ("🏢 تلفن شرکت (coTels)" in crm/contact-sync-diag.js) and its tests — that is an
   unrelated internal data field, not the company's published contact line.
"""
import sys, os, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _common import *          # noqa

LBL_OLD = 'style="display:inline-flex;align-items:center;gap:4px;line-height:1.7;"'
LBL_NEW = 'style="display:inline-flex;align-items:center;gap:4px;line-height:1.7;direction:rtl;"'

NEW_LABEL = "شماره تماس شرکت"

# public surfaces: every site page + the two user-facing chat/assistant files
targets = list(site_files((".html",)))
targets += [os.path.join(ROOT, "assets", "js", "ptf-chat.js"),
            os.path.join(ROOT, "api", "chat-llm.php")]

tally = {"icon_side": 0, "label": 0, "icon_files": set(), "label_files": set()}

for p in targets:
    if not os.path.exists(p):
        continue
    t = read(p)
    rel = os.path.relpath(p, ROOT)
    orig = t
    n = t.count(LBL_OLD)
    if n:
        t = t.replace(LBL_OLD, LBL_NEW)
        tally["icon_side"] += n
        tally["icon_files"].add(rel)
    m = t.count("تلفن شرکت")
    if m:
        t = t.replace("تلفن شرکت", NEW_LABEL)
        tally["label"] += m
        tally["label_files"].add(rel)
    if t != orig:
        write(p, t)

print(f"label lines pinned to RTL (icon on the right): {tally['icon_side']} in {len(tally['icon_files'])} files")
print(f"«تلفن شرکت» -> «{NEW_LABEL}»: {tally['label']} in {len(tally['label_files'])} files")
