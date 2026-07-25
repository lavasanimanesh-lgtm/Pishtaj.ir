# Install Hotfix — v22.0 Audited Flat Package

## Important
This corrected package is **flat** and is intended to be extracted directly into the target web root.

## Recommended Steps

1. Take a backup of the current site/files.
2. Extract the corrected zip directly into `public_html` (or your live web root).
3. Ensure the live files land like this:
   - `public_html/crm/index.html`
   - `public_html/crm/sw.js`
   - `public_html/api/...`
   - `public_html/assets/...`
4. Open:
   - `yourdomain/crm/clear-cache.html`
5. Run safe cache clear once.
6. Reload CRM and confirm visible version badge.

## Important Validation
After extraction, **do not** see this path as your active deployment root:
- `public_html/project_v21_9/...`

If files are inside that nested folder, the deployment is in the wrong place.
