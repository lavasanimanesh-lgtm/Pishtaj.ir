# Install Guide — v22.2 Audited Flat Package

## Important
This package is **flat** and must be extracted directly into the target web root.

## Recommended Steps
1. Take a full backup of the current site/files.
2. Extract the zip directly into `public_html` or your live web root.
3. Make sure the live paths become:
   - `public_html/crm/index.html`
   - `public_html/crm/sw.js`
   - `public_html/api/...`
   - `public_html/assets/...`
4. Open:
   - `yourdomain/crm/clear-cache.html`
5. Run safe cache clear once.
6. Reload CRM.
7. Confirm the visible version badge shows:
   - `v22.2`
8. Open AI Workbench and confirm:
   - `🧠 دستیار فنی`
   - calculation panel appears for supported control-valve cases

## Important Validation
After extraction, you must **not** see this as your active deployment root:
- `public_html/project_v21_9/...`

If files land there, deployment is wrong and the release was extracted one folder too deep.

## Notes
- This release includes the first deterministic engineering-calculation layer.
- It does **not** yet generate final Technical Proposal outputs.
- It does **not** yet support all equipment families.
