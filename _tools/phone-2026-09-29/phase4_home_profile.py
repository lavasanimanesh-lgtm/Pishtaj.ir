# -*- coding: utf-8 -*-
"""Phase 4 — surface the new company line where the commercial line is introduced.

  * index.html  : a «تلفن شرکت» card next to «خط مستقیم بازرگانی» in the contact grid
  * about/company-profile : a row in the official profile table
Both reuse the exact card/row markup of the block they sit in.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _common import *          # noqa

CARD = (
    '            <a href="tel:{tel}" style="background:#fff; border:1px solid var(--line); '
    'padding:18px; border-radius:20px; text-align:center; transition:.25s; box-shadow:0 8px 20px rgba(0,0,0,.03);">\n'
    '              <span class="ptf-ico md" aria-hidden="true" style="margin-bottom:8px">'
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
    'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'
    '<path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 '
    '2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 2 .7 2.9a2 2 0 01-.5 2.1L8 10a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.5'
    'c.9.3 1.9.6 2.9.7a2 2 0 011.7 2z"/></svg></span>\n'
    '              <strong style="display:block; color:#1e293b; font-size:15px;">{label}</strong>\n'
    '              <span style="color:var(--red); font-weight:900; font-size:16px; direction:ltr; '
    'display:block; margin-top:4px;">{dash}</span>\n'
    '            </a>\n'
)

home = os.path.join(ROOT, "index.html")
t = read(home)
# anchor = the commercial card in the home contact grid (ends right before the mobile card)
anchor = CARD.format(tel=OLD_LOCAL, label="خط مستقیم بازرگانی", dash=OLD_DASH)
new_card = CARD.format(tel=NEW_LOCAL, label="تلفن شرکت", dash=NEW_DASH)
assert new_card not in t, "home already patched"
if t.count(anchor) != 1:
    raise SystemExit(f"home contact card anchor count = {t.count(anchor)}")
t = t.replace(anchor, anchor + new_card, 1)
write(home, t)
print("index.html: company-line card added")

prof = os.path.join(ROOT, "about", "company-profile", "index.html")
t = read(prof)
row_old = (f'<tr><th>تلفن</th><td><a href="tel:{OLD_LOCAL}">{OLD_DASH}</a></td></tr>')
row_new = (f'<tr><th>خط مستقیم بازرگانی</th><td><a href="tel:{OLD_LOCAL}">{OLD_DASH}</a></td></tr>'
           f'<tr><th>تلفن شرکت</th><td><a href="tel:{NEW_LOCAL}">{NEW_DASH}</a></td></tr>')
if t.count(row_old) != 1:
    raise SystemExit(f"profile phone row count = {t.count(row_old)}")
t = t.replace(row_old, row_new, 1)
write(prof, t)
print("about/company-profile: phone row split into commercial + company")
