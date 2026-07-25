# Current Regression Evidence — v31.6.15

**Date:** 2026-07-17  
**Artifact:** current project bundle `v31.6.15` after sync pull auth hotfix  
**Runner:** `_tools/run-full-regression.js`  
**Audit:** `_tools/audit.py`

## Result

- regression files PASS: 147
- regression files FAIL: 0
- checks PASS: 3703
- checks FAIL: 0
- runner exit code: 0
- runner-reported version: v31.6.15
- audit: all checks PASS, no warnings
- prebroken: none
- hung: none
- soft: none

## Production error evidence

- `manifest.json` 403 fixed in the previous auth/manifest hotfix.
- `auth_login` can issue an initial token without a pre-existing token.
- `data_pull` now carries `X-CRM-Token`.
- sync waits with bounded retry before pulling when login token is not ready.

## Release decision

`v31.6.15` is the Production candidate for the observed sync 401 loop. FIN-WF-001 full implementation, personal-cheque policy and staging remain outside this release.
