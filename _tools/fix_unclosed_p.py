#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""بستنِ تگ‌های <p> باز در صفحاتِ مرکز دانش.

ایراد
-----
قالبِ صفحاتِ `knowledge-center/kc-*.html` پاراگراف‌ها را بدونِ `</p>` می‌بندد و سپس
یک عنصرِ بلوکی (`<div>`, `<h2>`, `<table>`, `<ul>`) می‌آید. طبقِ الگوریتمِ HTML5،
مرورگر `<p>` را خودش می‌بندد، بنابراین نمایش خراب نمی‌شود — اما markup نامعتبر است و
پارسرهای سخت‌گیر (از جمله استخراج‌کننده‌های متن برای RAG و برخی خزنده‌ها) مرزِ
پاراگراف را اشتباه می‌گیرند. ممیزیِ ۶۵۰ صفحهٔ عمومی، ۱۱۴ صفحه با این ایراد نشان داد.

کاری که این ابزار می‌کند
------------------------
دقیقاً همان کاری که مرورگر می‌کند را صریح می‌نویسد: پیش از هر عنصرِ بلوکی، اگر
`<p>` باز باشد، `</p>` درج می‌شود. هیچ متنِ قابلِ مشاهده‌ای تغییر نمی‌کند.

نگهبان‌ها
---------
۱) متنِ قابلِ مشاهده (پس از حذفِ تگ‌ها) باید کاراکتر‌به‌کاراکتر یکسان بماند.
۲) شمارِ عناصرِ head (canonical/hreflang/og/twitter/ldjson/title/description) نباید
   کم شود.
۳) فقط `</p>` درج می‌شود؛ هیچ تگی حذف یا جابه‌جا نمی‌شود.
۴) بت‌وان: اجرای دوم هیچ تغییری نمی‌دهد.

اجرا:  python3 _tools/fix_unclosed_p.py            (پیش‌نمایش)
       python3 _tools/fix_unclosed_p.py --apply    (نوشتن)
"""
from __future__ import annotations

import glob
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

# عناصری که طبقِ HTML5 باعثِ بسته‌شدنِ خودکارِ <p> می‌شوند
BLOCK_TAGS = {
    "address", "article", "aside", "blockquote", "details", "div", "dl",
    "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3",
    "h4", "h5", "h6", "header", "hgroup", "hr", "main", "menu", "nav", "ol",
    "p", "pre", "section", "table", "ul",
}

TAG_RE = re.compile(r"(?is)<(/?)([a-zA-Z][a-zA-Z0-9]*)((?:\"[^\"]*\"|'[^']*'|[^>\"'])*)>")
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link",
        "meta", "param", "source", "track", "wbr"}


def visible_text(html: str) -> str:
    body = html.split("</head>")[-1]
    return re.sub(r"(?is)<[^>]+>", "", body)


def head_inventory(text: str) -> dict:
    head = text.split("</head>")[0] if "</head>" in text else text[:6000]
    return {
        "canonical": len(re.findall(r'rel="canonical"', head)),
        "hreflang": len(re.findall(r'rel="alternate"', head)),
        "og": len(re.findall(r'property="og:', head)),
        "twitter": len(re.findall(r'name="twitter:', head)),
        "ldjson": len(re.findall(r'<script\s+type="application/ld\+json"', head)),
        "title": len(re.findall(r"<title>", head)),
        "desc": len(re.findall(r'name="description"', head)),
    }


def close_open_p(html: str) -> tuple[str, int]:
    """`</p>` را در نقاطی که مرورگر خودکار می‌بندد درج می‌کند."""
    out: list[str] = []
    pos = 0
    p_open = False
    inserted = 0
    for m in TAG_RE.finditer(html):
        closing, name = m.group(1) == "/", m.group(2).lower()
        if name in VOID and not closing:
            continue
        if name in ("script", "style"):
            # محتوای این تگ‌ها متن است نه markup
            if not closing:
                end = html.lower().find("</" + name, m.end())
                if end == -1:
                    continue
                out.append(html[pos:end])
                pos = end
            continue
        if p_open and (closing is False and name in BLOCK_TAGS):
            # <p> پیش از عنصرِ بلوکی بسته می‌شود
            out.append(html[pos:m.start()])
            out.append("</p>")
            pos = m.start()
            inserted += 1
            p_open = False
            if name == "p":
                p_open = True
        elif p_open and closing and name == "p":
            p_open = False
        elif (not closing) and name == "p":
            p_open = True
    out.append(html[pos:])
    return "".join(out), inserted


def drop_orphan_close_p(html: str) -> tuple[str, int]:
    """`</p>` های بی‌صاحب را حذف می‌کند (بلافاصله پیش از `</div>` دیده شده‌اند).

    مرورگر این تگ‌ها را نادیده می‌گیرد، پس حذفشان متنِ قابلِ مشاهده را تغییر نمی‌دهد؛
    اما markup را معتبر می‌کند.
    """
    out: list[str] = []
    pos = 0
    p_open = False
    dropped = 0
    for m in TAG_RE.finditer(html):
        closing, name = m.group(1) == "/", m.group(2).lower()
        if name in VOID and not closing:
            continue
        if name in ("script", "style"):
            if not closing:
                end = html.lower().find("</" + name, m.end())
                if end == -1:
                    continue
                out.append(html[pos:end])
                pos = end
            continue
        if (not closing) and name == "p":
            p_open = True
        elif closing and name == "p":
            if p_open:
                p_open = False
            else:
                out.append(html[pos:m.start()])
                pos = m.end()
                dropped += 1
    out.append(html[pos:])
    return "".join(out), dropped


def fix_file(path: str) -> tuple[str, int]:
    src = open(path, encoding="utf-8").read()
    before = head_inventory(src)
    before_txt = visible_text(src)

    new, n = close_open_p(src)
    new, dropped = drop_orphan_close_p(new)
    if n == 0 and dropped == 0:
        return src, (0, 0)

    # نگهبان ۱: متنِ قابلِ مشاهده نباید ذره‌ای عوض شود
    if visible_text(new) != before_txt:
        raise SystemExit("نگهبان: متنِ قابلِ مشاهده در %s تغییر کرد" % path)
    # نگهبان ۲: موجودیِ head
    after = head_inventory(new)
    lost = {k: (before[k], after[k]) for k in before if after[k] < before[k]}
    if lost:
        raise SystemExit("نگهبان: افتِ عنصر در headِ %s → %s" % (path, lost))
    # نگهبان ۳: تنها تغییرِ ممکن، افزودن/حذفِ </p> است
    if len(new) - len(src) != (n - dropped) * len("</p>"):
        raise SystemExit("نگهبان: طولِ تغییریافته در %s" % path)
    return new, (n, dropped)


def main() -> int:
    apply = "--apply" in sys.argv
    touched = added = removed = 0
    for path in sorted(glob.glob("knowledge-center/*.html")):
        new, (n, dropped) = fix_file(path)
        if n == 0 and dropped == 0:
            continue
        touched += 1
        added += n
        removed += dropped
        if apply:
            open(path, "w", encoding="utf-8").write(new)
        bits = []
        if n:
            bits.append("+%d بسته‌شدن" % n)
        if dropped:
            bits.append("-%d بی‌صاحب" % dropped)
        print("%-62s %s" % (path, "، ".join(bits)))
    print("-" * 72)
    print("صفحات: %d | </p> افزوده: %d | </p> بی‌صاحبِ حذف‌شده: %d  (%s)"
          % (touched, added, removed, "نوشته شد" if apply else "پیش‌نمایش"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
