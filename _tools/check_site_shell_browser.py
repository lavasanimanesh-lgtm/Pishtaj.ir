#!/usr/bin/env python3
"""Optional browser smoke test. Requires playwright and a running static preview.
python _tools/check_site_shell_browser.py --base-url http://127.0.0.1:8000 --browser /path/to/chromium
No production form is submitted. External requests are blocked.
"""
import argparse
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--base-url', default='http://127.0.0.1:8000')
parser.add_argument('--browser', help='Optional existing Chromium executable')
args = parser.parse_args()
base = args.base_url.rstrip('/')
paths = ['/', '/services/products/pressure-transmitter.html', '/knowledge-center/kc-astm-a106-gr.html',
         '/brands/', '/search/', '/sitemap.html', '/rfq/', '/tools/control-valve-sizing/',
         '/en/', '/ar/', '/de/', '/fr/', '/ru/', '/tr/', '/zh/']
with sync_playwright() as playwright:
    options = {'headless': True, 'args': ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu']}
    if args.browser:
        options['executable_path'] = args.browser
    browser = playwright.chromium.launch(**options)
    checked = 0
    for width in [390, 800, 1440]:
        context = browser.new_context(viewport={'width': width, 'height': 900}, reduced_motion='reduce')
        context.route('**/*', lambda r: r.continue_() if urlsplit(r.request.url).netloc == urlsplit(base).netloc else r.abort())
        for path in paths:
            page = context.new_page()
            page.goto(base + path, wait_until='networkidle')
            assert page.locator('[data-ptf-shell="header"]').count() == 1, path
            assert page.locator('[data-ptf-shell="footer"]').count() == 1, path
            assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'), (width, path)
            if width == 390:
                page.locator('#menuToggle').click()
                assert page.locator('#menuToggle').get_attribute('aria-expanded') == 'true', path
                assert page.locator('#mainNav').is_visible(), path
                if path == '/services/products/pressure-transmitter.html':
                    page.locator('.nav-mega-trigger').click()
                    assert page.locator('.nav-products').evaluate("e => e.classList.contains('is-open')")
                    page.locator('.nav-mega-head').first.click()
                    assert page.locator('.nav-mega a[href$="seamless-pipe.html"]').is_visible()
            before = page.locator('#ptfThemeToggle').get_attribute('aria-pressed')
            page.locator('#ptfThemeToggle').click()
            assert page.locator('#ptfThemeToggle').get_attribute('aria-pressed') != before, path
            if width == 390:
                page.keyboard.press('Escape')
                assert page.locator('#menuToggle').get_attribute('aria-expanded') == 'false', path
            page.locator('#ptf-site-footer').scroll_into_view_if_needed()
            assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'), (width, path, 'footer')
            page.close()
            checked += 1
        context.close()
    context = browser.new_context(java_script_enabled=False, viewport={'width': 390, 'height': 900})
    page = context.new_page()
    page.goto(base + '/services/products/pressure-transmitter.html')
    assert page.locator('#mainNav a[href="/rfq/"]').is_visible()
    assert page.locator('[data-ptf-shell="footer"]').count() == 1
    context.close()
    browser.close()
print(f'{checked} responsive page checks plus no-JavaScript navigation passed.')
