# Current Regression Evidence — v31.6.3

**Date:** 2026-07-17  
**Artifact:** current project bundle `v31.6.3` after the Production manifest/auth hotfix  
**Runner:** `_tools/run-full-regression.js`  
**Audit:** `_tools/audit.py`

## Result

- `node --check` changed JavaScript files: PASS
- regression files PASS: 139
- regression files FAIL: 0
- checks PASS: 3643
- checks FAIL: 0
- runner exit code: 0
- runner-reported version: v31.6.3
- prebroken: none
- hung: none
- soft: none

## Hotfix evidence

- `crm/manifest.json` remains valid JSON.
- root `.htaccess` exempts `manifest.json` from the sensitive JSON block.
- `api/crm.php` does not require a pre-existing token for `auth_login` (`scope: none`).
- financial `data_push/data_pull` token enforcement remains active.

## Audit warning

`audit.py` reports one non-error warning for heavy images. This remains a P2/P3 optimization item and does not create a syntax, XML/JSON, link, or security audit error.

## Release decision

`v31.6.3` is the Production hotfix package for the observed manifest 403 and initial auth/data-pull 401. FIN-WF-001 implementation and financial mutation policy remain outside this hotfix.
