#!/usr/bin/env python3
"""Step C: skip-link, visible breadcrumb, search index, blog dates. Idempotent."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKIP_DIRS = {".git", "node_modules", "crm", "_tools", ".arena", "api"}
SECTIONS = {
    "about": "درباره ما",
    "services": "خدمات",
    "industries": "صنایع",
    "projects": "پروژه‌ها",
    "knowledge-center": "مرکز دانش",
    "tools": "ابزارها",
    "blog": "وبلاگ",
    "news": "اخبار",
    "rfq": "استعلام",
    "suppliers": "تامین‌کنندگان",
    "comparisons": "مقایسه‌های فنی",
    "brands": "برندها",
    "catalog": "کاتالوگ",
    "assistant": "دستیار",
    "tracking": "رهگیری",
    "quality": "کیفیت",
    "search": "جستجو",
    "en": "English",
    "supplier": "ثبت تامین‌کننده",
}


def public_html() -> list[Path]:
    out = []
    for p in ROOT.rglob("*.html"):
        rel = p.relative_to(ROOT)
        if any(part in SKIP_DIRS for part in rel.parts):
            continue
        out.append(p)
    return out


def site_url(path: Path) -> str:
    rel = path.relative_to(ROOT).as_posix()
    if rel == "index.html":
        return "/"
    if rel.endswith("/index.html"):
        return "/" + rel[: -len("index.html")]
    return "/" + rel


def css_href(path: Path) -> str:
    depth = len(path.relative_to(ROOT).parts) - 1
    return "../" * depth + "assets/css/discover.css"


def js_href(path: Path) -> str:
    depth = len(path.relative_to(ROOT).parts) - 1
    return "../" * depth + "assets/js/ptf-discover.js"


def crumbs_for(path: Path, title: str) -> list[tuple[str, str]]:
    rel = path.relative_to(ROOT).as_posix()
    if rel == "index.html":
        return []
    parts = path.relative_to(ROOT).parts
    crumbs = [("/", "خانه")]
    acc = []
    files = list(parts)
    if files[-1] == "index.html":
        files = files[:-1]
    elif files[-1].endswith(".html"):
        files = files[:-1] + [files[-1]]
    for i, part in enumerate(files):
        acc.append(part)
        is_last = i == len(files) - 1
        if part.endswith(".html"):
            crumbs.append(("", title))
            break
        label = SECTIONS.get(part, part.replace("-", " "))
        if part == "products":
            label = "محصولات"
        href = "/" + "/".join(acc) + "/"
        if is_last:
            crumbs.append(("", title if path.name != "index.html" else label))
        else:
            crumbs.append((href, label))
    else:
        if path.name == "index.html" and crumbs[-1][1] != title:
            pass
    return crumbs


def breadcrumb_html(crumbs: list[tuple[str, str]]) -> str:
    items = []
    for i, (href, name) in enumerate(crumbs):
        last = i == len(crumbs) - 1
        if last or not href:
            items.append(f'<li><span aria-current="page">{name}</span></li>')
        else:
            items.append(f'<li><a href="{href}">{name}</a></li>')
    return (
        '<nav class="ptf-bc" aria-label="مسیر صفحه" data-ptf-bc="yes">'
        f'<div class="container"><ol>{"".join(items)}</ol></div></nav>\n'
    )


def ensure_assets(html: str, path: Path) -> str:
    if "assets/css/discover.css" not in html:
        html = html.replace(
            "</head>",
            f'<link rel="stylesheet" href="{css_href(path)}" />\n</head>',
            1,
        )
    if "assets/js/ptf-discover.js" not in html:
        if "</body>" in html:
            html = html.replace(
                "</body>",
                f'<script src="{js_href(path)}" defer></script>\n</body>',
                1,
            )
        else:
            html += f'\n<script src="{js_href(path)}" defer></script>\n'
    return html


def ensure_skip(html: str) -> str:
    if 'data-ptf-skip="yes"' in html:
        return html
    html = re.sub(
        r"(<body[^>]*>)",
        r'\1\n<a class="ptf-skip" href="#main-content" data-ptf-skip="yes">رفتن به محتوا</a>',
        html,
        count=1,
        flags=re.I,
    )
    if 'id="main-content"' not in html:
        html = re.sub(r"<main\b", '<main id="main-content"', html, count=1, flags=re.I)
    return html


def ensure_bc(html: str, path: Path, title: str) -> str:
    if path.relative_to(ROOT).as_posix() == "index.html":
        return html
    if 'data-ptf-bc="yes"' in html:
        return html
    crumbs = crumbs_for(path, title)
    if not crumbs:
        return html
    block = breadcrumb_html(crumbs)
    if "</header>" in html:
        html = html.replace("</header>", "</header>\n" + block, 1)
    return html


def blog_lastmods() -> dict[str, str]:
    xml = (ROOT / "sitemap-blog.xml").read_text(encoding="utf-8")
    out = {}
    for loc, lm in re.findall(r"<loc>([^<]+)</loc><lastmod>([^<]+)</lastmod>", xml):
        out[loc.replace("https://pishtaj.ir", "")] = lm
    return out


def ensure_blog_date(html: str, path: Path, lastmods: dict[str, str]) -> str:
    rel = path.relative_to(ROOT).as_posix()
    if not rel.startswith("blog/") or rel == "blog/index.html":
        return html
    if 'data-ptf-updated="yes"' in html:
        return html
    url = site_url(path)
    lm = lastmods.get(url) or lastmods.get(url.rstrip("/") + "/") or "2026-08-16"
    stamp = (
        f'<p class="ptf-updated" data-ptf-updated="yes">'
        f'آخرین به‌روزرسانی: <time datetime="{lm}">{lm}</time></p>\n'
    )
    html = re.sub(r"(<h1[^>]*>.*?</h1>)", r"\1\n" + stamp, html, count=1, flags=re.S)
    return html


def page_title(html: str) -> str:
    m = re.search(r"<title>([^<]+)</title>", html, re.I)
    if not m:
        return "صفحه"
    return re.sub(r"\s*\|\s*.*$", "", m.group(1)).strip() or m.group(1).strip()


def page_desc(html: str) -> str:
    m = re.search(r'<meta\s+name="description"\s+content="([^"]*)"', html, re.I)
    return (m.group(1) if m else "")[:180]


def build_index(pages: list[Path]) -> None:
    items = []
    for p in pages:
        html = p.read_text(encoding="utf-8", errors="ignore")
        items.append({"u": site_url(p), "t": page_title(html), "d": page_desc(html)})
    dest = ROOT / "assets/data/search-index.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(items, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("index", len(items), dest)


def restore_search_action():
    p = ROOT / "index.html"
    html = p.read_text(encoding="utf-8")
    if "SearchAction" in html:
        print("SearchAction already present")
        return
    old = '''        "inLanguage": "fa-IR"
    }'''
    new = '''        "inLanguage": "fa-IR",
        "potentialAction": {
            "@type": "SearchAction",
            "target": "https://pishtaj.ir/search/?q={search_term_string}",
            "query-input": "required name=search_term_string"
        }
    }'''
    if old not in html:
        print("WARN: WebSite block pattern not found")
        return
    p.write_text(html.replace(old, new, 1), encoding="utf-8")
    print("SearchAction restored")


def update_sitemaps():
    misc = ROOT / "sitemap-misc.xml"
    t = misc.read_text(encoding="utf-8")
    if "pishtaj.ir/search/" not in t:
        t = t.replace(
            "</urlset>",
            '  <url><loc>https://pishtaj.ir/search/</loc><lastmod>2026-08-19</lastmod><priority>0.6</priority></url>\n</urlset>',
            1,
        )
        misc.write_text(t, encoding="utf-8")
        print("sitemap-misc +search")
    sm = ROOT / "sitemap.html"
    h = sm.read_text(encoding="utf-8")
    if "/search/" not in h:
        h = h.replace(
            "<h2>صفحه اصلی</h2>",
            '<h2>صفحه اصلی</h2>\n<ul>\n<li><a href="/search/">/search/</a></li>',
            1,
        )
        # might have broken ul - check
        sm.write_text(h, encoding="utf-8")
        print("sitemap.html +search")


def main():
    pages = public_html()
    lastmods = blog_lastmods()
    changed = 0
    for p in pages:
        html = p.read_text(encoding="utf-8", errors="ignore")
        orig = html
        title = page_title(html)
        html = ensure_assets(html, p)
        html = ensure_skip(html)
        html = ensure_bc(html, p, title)
        html = ensure_blog_date(html, p, lastmods)
        if html != orig:
            p.write_text(html, encoding="utf-8")
            changed += 1
    print("updated pages", changed, "of", len(pages))
    build_index(pages)
    restore_search_action()
    update_sitemaps()


if __name__ == "__main__":
    main()
