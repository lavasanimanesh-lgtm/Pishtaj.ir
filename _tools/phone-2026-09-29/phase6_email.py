# -*- coding: utf-8 -*-
"""Phase 6 — contact mailbox: Info@pishrotajheez.ir (dead domain) -> info@pishtaj.ir

NOTE (2026-09-29, follow-up): the first run of this phase wrote "ifo@pishtaj.ir" — a typo
that dropped the "n" of the mailbox name. That misspelling was repaired site-wide back to
info@pishtaj.ir. The misspelled form is still listed in VARIANTS below (built at runtime so
it is not spelled out anywhere in the repo) so re-running this phase keeps the site correct.

Touches every live, outward-facing surface:
  * 724 site pages (707 .html + 17 extensionless knowledge-center/article-0NN) — footers + JSON-LD
  * _tools/site-shell/*.inc templates and the page generators, so a regeneration keeps the address
  * live JS: chat widget + CRM outward documents (quotation requests, letters, offers, RFQ notes)
  * api/contact.php Bcc
  * customer-facing downloads and the SEO NAP citation table

Deliberately NOT touched (they are not the company contact address):
  * no-reply@pishtaj.ir          — mail() From: sender in api/contact.php
  * lavasani.manesh@gmail.com    — the mailbox contact-form submissions are delivered TO
  * *_@arsalan.ir, *@gserviceaccount.com, uat@pishtaj.test, placeholder addresses
  * _audit/ , RELEASE-NOTES-*    — historical records
"""
import sys, os, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _common import *          # noqa

TYPO = EMAIL.replace("info@", "ifo@")   # the 2026-09-29 misspelling (dropped "n")

VARIANTS = ["Info@pishrotajheez.ir", "info@pishrotajheez.ir", TYPO, "Info@pishtaj.ir"]

EXTRA = [
    "_tools/site-shell", "_tools/gen-i18n-pages.py",
    "assets/js", "crm", "api",
    "assets/downloads/PTF-Corporate-Catalog-2026.txt",
    "ARENA-SEO-P4-OFFSITE-AUTHORITY-PLAYBOOK-2026-09-11.md",
    "README-راهنمای-هاست.txt", "README-راهنما-نصب.txt",
]
KEEP_DIRS = ("/.git/", "/_audit/", "/_human_test/", "/_personas/", "/node_modules/",
             "/_tools/phone-2026-09-29/")

targets = set(site_files((".html",)))
for e in EXTRA:
    p = os.path.join(ROOT, e)
    if os.path.isfile(p):
        targets.add(p)
    else:
        for dp, _dn, fn in os.walk(p):
            for n in fn:
                targets.add(os.path.join(dp, n))

# the extensionless article pages are not returned by site_files(exts) for non-html callers
for dp, _dn, fn in os.walk(ROOT):
    for n in fn:
        f = os.path.join(dp, n)
        if n in VARIANTS or os.path.splitext(n)[1] in (".js", ".py", ".md", ".txt", ".inc", ".php", ".xml"):
            targets.add(f)

TARGETS = sorted(t for t in targets
                 if os.path.isfile(t)
                 and not any(k in "/" + os.path.relpath(t, ROOT).replace(os.sep, "/") for k in KEEP_DIRS))

per_file, total = {}, {}
for p in TARGETS:
    try:
        t = read(p)
    except (UnicodeDecodeError, OSError):
        continue
    orig, c = t, 0
    for v in VARIANTS:
        n = t.count(v)
        if n:
            total[v] = total.get(v, 0) + n
            c += n
            t = t.replace(v, EMAIL)
    if t != orig:
        write(p, t)
        per_file[os.path.relpath(p, ROOT)] = c

print("replacements by variant:")
for k, v in total.items():
    print(f"   {v:5d}  {k}")
print(f"   {sum(total.values()):5d}  -> {EMAIL}")
print(f"\nfiles changed: {len(per_file)}")
