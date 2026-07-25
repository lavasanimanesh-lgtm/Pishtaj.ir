# Current Regression Evidence — v31.6.14

**Date:** 2026-07-17  
**Artifact:** current project bundle `v31.6.14` after image hardening  
**Runner:** `_tools/run-full-regression.js`  
**Audit:** `_tools/audit.py`

## Result

- regression files PASS: 146
- regression files FAIL: 0
- checks PASS: 3697
- checks FAIL: 0
- runner exit code: 0
- runner-reported version: v31.6.14
- audit: all checks PASS; no warnings
- prebroken: none
- hung: none
- soft: none

## Sprint evidence

- image dimensions/aspect ratio preserved;
- heavy images compressed and stripped;
- no application data or workflow changed.

## Release decision

`v31.6.14` is the Production candidate for image/audit hardening. FIN-WF-001, personal-cheque policy, staging and financial workflows remain outside this release.
