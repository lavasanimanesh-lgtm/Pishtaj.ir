# Current Regression Evidence — v31.6.8

**Date:** 2026-07-17  
**Artifact:** current project bundle `v31.6.8` after FIN-WF-013 auto-settlement hardening  
**Runner:** `_tools/run-full-regression.js`  
**Audit:** `_tools/audit.py`

## Result

- changed JavaScript syntax: PASS
- regression files PASS: 143
- regression files FAIL: 0
- checks PASS: 3679
- checks FAIL: 0
- runner exit code: 0
- runner-reported version: v31.6.8
- prebroken: none
- hung: none
- soft: none

## Sprint evidence

- `tester163-v3164-invoice-pay-void.js`: PASS
- `tester164-v3165-fiscal-guards.js`: PASS
- `tester165-v3166-fiscal-date-canonical.js`: PASS
- `tester166-v3168-autosettle-reversal.js`: 6 PASS / 0 FAIL
- auto-settlement requires a reason;
- auto-settlement has an id and status;
- reversal path can reverse it without deleting the invoice.

## Audit warning

`audit.py` reports one non-error warning for heavy images. This remains a P2/P3 optimization item.

## Release decision

`v31.6.8` is the Production candidate for FIN-WF-013 auto-settlement hardening. FIN-WF-001 implementation, personal-cheque policy and staging remain outside this release.
