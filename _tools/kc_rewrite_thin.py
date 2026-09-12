#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Rewrite fully-templated knowledge-center articles with real, topic-specific content.

Reads ARTICLES from kc_thin_content_a.py / kc_thin_content_b.py, rebuilds each page's
<article> body (intro + sections + FAQ), keeps head/JSON-LD/byline/signup/CTA/related-links,
and regenerates the FAQPage JSON-LD to match the new visible FAQs.
"""
import json, os, re

KC = os.path.join(os.path.dirname(__file__), '..', 'knowledge-center')

TOC_OPEN = '<nav class="kc-toc" aria-label="فهرست مطالب" style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:12px 18px;margin:0 0 20px;font-size:14px"><b style="display:block;margin-bottom:6px;color:#0f172a">فهرست مطالب</b><ul style="margin:0;padding-right:18px;display:grid;gap:4px;color:#334155">'
TOC_CLOSE = '</ul>\n</nav>'

def render_toc(sections):
    items = []
    for i, (title, _blocks) in enumerate(sections, start=1):
        items.append(f'<li><a href="#kc-sec-{i}" style="color:#0e7490;text-decoration:none">{title}</a></li>')
    items.append(f'<li><a href="#kc-sec-{len(sections)+1}" style="color:#0e7490;text-decoration:none">پرسش\u200cهای متداول</a></li>')
    return TOC_OPEN + ''.join(items) + TOC_CLOSE

def render_content(intro, sections, faqs):
    out = [intro]
    for i, (title, blocks) in enumerate(sections, start=1):
        out.append(f'<h2 id="kc-sec-{i}">{title}</h2>')
        out.extend(blocks)
    out.append(f'<h2 id="kc-sec-{len(sections)+1}">پرسش\u200cهای متداول</h2>')
    for q, a in faqs:
        out.append(f'<h3>{q}</h3>')
        out.append(f'<p>{a}</p>')
    return '\n'.join(out)

def render_faq_jsonld(faqs):
    obj = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "inLanguage": "fa-IR",
        "mainEntity": [
            {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}}
            for q, a in faqs
        ],
        "_ptf": "SEO-KC-REWRITE-v1"
    }
    return '<script type="application/ld+json">\n' + json.dumps(obj, ensure_ascii=False, indent=1) + '\n</script>'

def words_of(html):
    text = re.sub(r'<[^>]+>', ' ', html)
    return len(re.findall(r'[\u0600-\u06FF\uFB8A\u067E\u0686\u06AF\u06A9\u06BE\u200c]+|[A-Za-z][A-Za-z\-]{1,}', text))

def rewrite(article):
    f = article['file']
    path = os.path.join(KC, f)
    s = open(path, encoding='utf-8').read()

    # --- extract fixed regions ---
    am = re.search(r'<article[^>]*>', s)
    assert am, f
    article_open = am.group(0)
    head = s[:am.start()]
    body = s[am.end():]

    byline = re.search(r'<div class="kc-byline".*?</div>', body, re.S)
    assert byline, f
    # recompute reading time span inside byline
    by = byline.group(0)

    signup = re.search(r'<div style="background:linear-gradient\(135deg,#f8fafc,#fff\)[^>]*>.*?</a></div>', body, re.S)
    assert signup, f
    cta_start = body.find('<section class="kc-supply-cta"')
    assert cta_start > 0, f
    tail = body[cta_start:]  # CTA section + related links + </article> + rest

    # --- build new article ---
    toc = render_toc(article['sections'])
    content = render_content(article['intro'], article['sections'], article['faqs'])
    w = words_of(content)
    minutes = max(1, (w + 149) // 150)
    fa_digits = '۰۱۲۳۴۵۶۷۸۹'
    min_fa = ''.join(fa_digits[int(d)] for d in str(minutes))
    by_new = re.sub(r'(زمان مطالعه:\s*)[^<]*', r'\g<1>' + min_fa + ' دقیقه', by)

    new_article = article_open + '\n' + by_new + '\n' + toc + '\n' + content + '\n' + signup.group(0) + '\n' + tail

    # --- update FAQPage JSON-LD in head ---
    faq_jsonld = render_faq_jsonld(article['faqs'])
    head_new, n = re.subn(
        r'<script type="application/ld\+json">\s*\{\s*"@context":\s*"https://schema.org",\s*"@type":\s*"FAQPage".*?</script>',
        lambda m: faq_jsonld, head, flags=re.S)
    assert n == 1, f"FAQPage JSON-LD not found/unique in {f}: {n}"

    open(path, 'w', encoding='utf-8').write(head_new + new_article)
    return f, w

def main():
    import kc_thin_content_a as A
    import kc_thin_content_b as B
    import kc_thin_content_extra as X
    arts = A.ARTICLES + B.ARTICLES
    files = [a['file'] for a in arts]
    assert len(files) == len(set(files)), 'duplicate files'
    for a in arts:
        extra = X.EXTRA.get(a['file'], [])
        if extra:
            a = dict(a)
            a['sections'] = list(a['sections']) + extra
        f, w = rewrite(a)
        print(f"{w:5d} words   {f}")

if __name__ == '__main__':
    main()
