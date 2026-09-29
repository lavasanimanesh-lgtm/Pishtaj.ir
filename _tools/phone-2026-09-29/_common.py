# -*- coding: utf-8 -*-
"""Shared constants for the 021-91099242 phone update (2026-09-29)."""
import re, glob, os

OLD_LOCAL = "02146087679"          # tel: href digits
OLD_INTL  = "+982146087679"
OLD_DASH  = "021-46087679"
OLD_SP    = "+98 21 46087679"

NEW_LOCAL = "02191099242"
NEW_INTL  = "+982191099242"
NEW_DASH  = "021-91099242"
NEW_SP    = "+98 21 91099242"

_PERS = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")
OLD_FA = "۰۲۱-۴۶۰۸۷۶۷۹"
NEW_FA = NEW_DASH.translate(_PERS)          # ۰۲۱-۹۱۰۹۹۲۴۲
NEW_FA_NODASH = NEW_LOCAL.translate(_PERS)  # ۰۲۱۹۱۰۹۹۲۴۲

# --- contact mailbox (2026-09-29) --------------------------------------------
OLD_EMAIL = "Info@pishrotajheez.ir"
EMAIL = "info@pishtaj.ir"

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def site_files(exts=(".html",)):
    """All site pages, skipping tooling/audit/human-test trees.

    Also picks up extensionless HTML pages (knowledge-center/article-0NN) — they are
    served directly and carry the same header/footer shell.
    """
    out = []
    for e in exts:
        out += glob.glob(os.path.join(ROOT, "**", "*" + e), recursive=True)
    if ".html" in exts:
        for f in glob.glob(os.path.join(ROOT, "**", "*"), recursive=True):
            if not os.path.isfile(f) or os.path.splitext(f)[1]:
                continue
            try:
                with open(f, encoding="utf-8", errors="ignore") as fh:
                    if "<html" in fh.read(400).lower():
                        out.append(f)
            except OSError:
                pass
    skip = ("/.git/", "/_tools/", "/_audit/", "/_human_test/", "/_personas/", "/node_modules/")
    res = []
    for f in out:
        p = "/" + os.path.relpath(f, ROOT).replace(os.sep, "/")
        if any(s in p for s in skip):
            continue
        res.append(f)
    return sorted(set(res))


def read(p):
    return open(p, encoding="utf-8").read()


def write(p, t):
    open(p, "w", encoding="utf-8").write(t)


def sub_n(text, old, new, expected=None, label=""):
    n = text.count(old)
    if expected is not None and n != expected:
        raise SystemExit(f"MISMATCH [{label}]: expected {expected} of {old!r}, found {n}")
    if n:
        text = text.replace(old, new)
    return text, n
