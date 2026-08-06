#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""SEO performance foundation for public site: metrics script, image dimensions/loading.
Excludes crm/ and api/ by design.
"""
from pathlib import Path
import re, subprocess, urllib.parse, posixpath
from functools import lru_cache

ROOT = Path('.')
EXCLUDE = ('crm/','api/','_audit/','_tools/','_human_test/','_personas/','ptf-snapshots/','docs-deploy/')
IMG_EXT = {'.jpg','.jpeg','.png','.webp','.gif','.bmp'}


def public_html_files():
    return sorted(p for p in ROOT.rglob('*.html') if not any(str(p).startswith(x) for x in EXCLUDE))


def rel_from_file(file_path: Path, target: str) -> str:
    return posixpath.relpath(target, file_path.parent.as_posix()).replace('\\','/')


def add_metrics(tx: str, file_path: Path) -> str:
    if 'ptf-metrics.js' in tx:
        return tx
    src = rel_from_file(file_path, 'assets/js/ptf-metrics.js')
    tag = f'<script src="{src}" defer></script>\n'
    if re.search(r'</body\s*>', tx, re.I):
        return re.sub(r'\s*</body\s*>', '\n' + tag + '</body>', tx, count=1, flags=re.I)
    return tx + '\n' + tag


def local_src_to_path(file_path: Path, src: str):
    src = src.strip()
    if not src or src.startswith(('data:', 'http://', 'https://', '//')) or '${' in src or "' +" in src:
        return None
    parsed = urllib.parse.urlparse(src)
    if parsed.scheme:
        return None
    raw_path = urllib.parse.unquote(parsed.path)
    if raw_path.startswith('/'):
        candidate = ROOT / raw_path.lstrip('/')
    else:
        candidate = file_path.parent / raw_path
    try:
        candidate = candidate.resolve().relative_to(ROOT.resolve())
    except Exception:
        return None
    p = ROOT / candidate
    return p if p.exists() and p.is_file() else None

@lru_cache(maxsize=None)
def image_size(path_str: str):
    p = Path(path_str)
    ext = p.suffix.lower()
    try:
        if ext == '.svg':
            s = p.read_text(encoding='utf-8', errors='ignore')[:2000]
            mw = re.search(r'\bwidth=["\']([0-9.]+)', s)
            mh = re.search(r'\bheight=["\']([0-9.]+)', s)
            if mw and mh:
                return int(float(mw.group(1))), int(float(mh.group(1)))
            vb = re.search(r'viewBox=["\'][^"\']*?\s+([0-9.]+)\s+([0-9.]+)["\']', s)
            if vb:
                return int(float(vb.group(1))), int(float(vb.group(2)))
            return None
        if ext not in IMG_EXT:
            return None
        out = subprocess.check_output(['identify', '-format', '%w %h', str(p)], stderr=subprocess.DEVNULL, text=True, timeout=5)
        w, h = out.strip().split()[:2]
        return int(w), int(h)
    except Exception:
        return None


def add_attr(tag: str, name: str, value: str) -> str:
    if re.search(r'\b' + re.escape(name) + r'\s*=', tag, re.I):
        return tag
    return re.sub(r'\s*/?>$', f' {name}="{value}"' + (' />' if tag.rstrip().endswith('/>') else '>'), tag, count=1)


def optimize_images(tx: str, file_path: Path) -> str:
    def repl(m):
        tag = m.group(0)
        out = tag
        # Add lazy loading to images that do not explicitly opt into eager/high priority.
        if not re.search(r'\bloading\s*=', out, re.I) and not re.search(r'fetchpriority\s*=\s*["\']high', out, re.I):
            out = add_attr(out, 'loading', 'lazy')
        if re.search(r'\bwidth\s*=', out, re.I) and re.search(r'\bheight\s*=', out, re.I):
            return out
        sm = re.search(r'\bsrc\s*=\s*(["\'])(.*?)\1', out, re.I|re.S)
        if not sm:
            return out
        p = local_src_to_path(file_path, sm.group(2))
        if not p:
            return out
        sz = image_size(str(p))
        if not sz:
            return out
        w, h = sz
        if not re.search(r'\bwidth\s*=', out, re.I):
            out = add_attr(out, 'width', str(w))
        if not re.search(r'\bheight\s*=', out, re.I):
            out = add_attr(out, 'height', str(h))
        return out
    return re.sub(r'<img\b[^>]*>', repl, tx, flags=re.I|re.S)

changed_metrics = []
changed_images = []
for p in public_html_files():
    tx = p.read_text(encoding='utf-8', errors='ignore')
    tx2 = add_metrics(tx, p)
    if tx2 != tx:
        changed_metrics.append(str(p))
    tx3 = optimize_images(tx2, p)
    if tx3 != tx2:
        changed_images.append(str(p))
    if tx3 != tx:
        p.write_text(tx3, encoding='utf-8')

print(f'metrics_pages={len(changed_metrics)}')
print(f'image_pages={len(changed_images)}')
