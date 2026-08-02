# -*- coding: utf-8 -*-
"""ابزار کمکی برای افزودن پاراگراف‌های تکمیلی و بررسی تعداد کلمه"""
import re, html

def wc(path):
    c = open(path, encoding='utf-8', errors='ignore').read()
    body = re.search(r'<body[^>]*>(.*?)</body>', c, re.S).group(1)
    body = re.sub(r'<header.*?</header>', '', body, flags=re.S)
    body = re.sub(r'<footer.*?</footer>', '', body, flags=re.S)
    body = re.sub(r'<script.*?</script>', '', body, flags=re.S)
    text = re.sub(r'<[^>]+>', ' ', body)
    return len(html.unescape(text).split())

def extend(path, extra_html):
    c = open(path, encoding='utf-8').read()
    c = c.replace('<h2>جمع‌بندی</h2>', extra_html + '<h2>جمع‌بندی</h2>', 1)
    open(path, 'w', encoding='utf-8').write(c)
    return wc(path)
