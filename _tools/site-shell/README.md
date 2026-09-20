# Shared homepage shell

The homepage-derived header/footer are rendered statically into 654 existing public pages, including eight locales. No browser fetch is required to see the landmarks or their links.

## Editing

- Edit `header-<lang>.html.inc` / `footer-<lang>.html.inc` here, **not individual rendered pages**.
- `home-shell-base.css` is a scoped snapshot of the original homepage header/footer styling. Put deliberate adjustments in `overrides.css`. Never import the entire homepage stylesheet into article/product pages.
- Shared interactions live in `assets/js/site-shell.js`. Existing `ptf-discover.js` still enhances product and language navigation; its mobile breakpoint is now 790px and hover no longer toggles the mobile accordion before a click.
- Run `python tools/sync_site_shell.py`, then `python tools/sync_site_shell.py --check`.
- The renderer updates cache-busting versions for the affected existing scripts and discover stylesheet. Increment `VERSION` for future releases.

## Scope and preservation

`preservation.json` contains hashes of the pre-migration HTML with header/footer removed and only the affected asset query versions normalized. The tests verify every other byte remains unchanged, including titles, canonical/hreflang, JSON-LD, article content, forms, CTAs and existing content scripts.

The file list deliberately excludes CRM/internal files and 46 retired/canonicalized stubs. New public pages must be deliberately enrolled with a pre-render preservation hash; the coverage test fails if a new public page is missed. This migration creates no new public content URLs and does not change sitemaps or redirects.

The local-language templates preserve existing localized navigation/footer copy, using the same visual structure as the Persian homepage rather than inventing untranslated destinations.

## Checks

```sh
python -m unittest discover -s tools -p 'test_*.py'
python tools/sync_site_shell.py --check
python _tools/seo_redirect_audit.py --strict
```

Optional browser regression (install `playwright` and Chromium in a development environment; run a static preview first):

```sh
python _tools/check_site_shell_browser.py --base-url http://127.0.0.1:8000 --browser /path/to/chromium
```

The build sources are denied by this directory's `.htaccess` and stored under the existing internal `_tools` tree. Generated CSS/JS and rendered HTML must ship together. Do not deploy `_tools` sources as public templates.

### Later content edits

Keep `preservation.json` as historical migration evidence. When an existing page is
intentionally strengthened later, record only that page's new protected-content
hash, date, reason and review report in `content-revisions.json`. The shell tests
use these explicit revisions while still requiring identical shared templates,
coverage and rendering idempotence. Do not refresh all hashes to hide unrelated
changes.
