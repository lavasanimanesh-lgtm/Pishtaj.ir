#!/usr/bin/env python3
"""Rewrite real/ jpg|jpeg|png <img> to <picture> when a webp sibling exists. Idempotent."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKIP = {".git", "node_modules", "crm", "_tools", ".arena", "api"}
IMG_RE = re.compile(
    r'<img(?P<pre>[^>]*?)src="(?P<src>[^"]*assets/images/real/[^"]+\.(?:jpe?g|png))"(?P<post>[^>]*)>',
    re.I,
)


def webp_for(src: str) -> str | None:
    # assets/images/real/foo.jpg -> assets/images/real/webp/foo.webp
    # assets/images/real/pages/foo.jpg -> assets/images/real/pages/webp/foo.webp
    m = re.search(r"(assets/images/real/.+)\.(jpe?g|png)$", src, re.I)
    if not m:
        return None
    rel = m.group(1)
    parent, name = rel.rsplit("/", 1)
    if parent.endswith("/webp"):
        return None
    candidate = f"{parent}/webp/{name}.webp"
    disk = ROOT / candidate.split("assets/", 1)[-1]
    # candidate is assets/... so ROOT/assets/...
    disk = ROOT / candidate
    if disk.exists():
        prefix = src[: src.find("assets/")]
        return prefix + candidate
    return None


def repl(m: re.Match) -> str:
    full = m.group(0)
    if "data-webp=" in full or "<picture" in full:
        return full
    src = m.group("src")
    w = webp_for(src)
    if not w:
        return full
    pre = m.group("pre")
    post = m.group("post")
    img = f'<img{pre}src="{src}"{post} data-webp="1">'
    return f'<picture><source type="image/webp" srcset="{w}">{img}</picture>'


def main():
    n = 0
    files = 0
    for p in ROOT.rglob("*.html"):
        if any(x in p.parts for x in SKIP):
            continue
        html = p.read_text(encoding="utf-8", errors="ignore")
        new, c = IMG_RE.subn(repl, html)
        # slider backgrounds on homepage
        if p.name == "index.html" and p.parent == ROOT:
            def bg(mm):
                src = mm.group(1)
                w = webp_for(src)
                return mm.group(0) if not w else mm.group(0).replace(src, w)

            new2 = re.sub(
                r"url\('([^']+assets/images/real/[^']+\.(?:jpe?g|png))'\)",
                bg,
                new,
            )
            new2 = re.sub(
                r'data-bg="([^"]+assets/images/real/[^"]+\.(?:jpe?g|png))"',
                lambda mm: mm.group(0)
                if not webp_for(mm.group(1))
                else f'data-bg="{webp_for(mm.group(1))}"',
                new2,
            )
            new = new2
        if new != html:
            p.write_text(new, encoding="utf-8")
            files += 1
            n += c
    print("files", files, "img wraps", n)


if __name__ == "__main__":
    main()
