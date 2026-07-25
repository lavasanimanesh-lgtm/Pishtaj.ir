# Current Regression Evidence — v31.6.6

**Date:** 2026-07-17  
**Artifact:** current project bundle `v31.6.6` after FIN-WF-007 canonical date completion  
**Runner:** `_tools/run-full-regression.js`  
**Audit:** `_tools/audit.py`

## Result

- changed JavaScript syntax: PASS
- regression files PASS: 142
- regression files FAIL: 0
- checks PASS: 3672
- checks FAIL: 0
- runner exit code: 0
- runner-reported version: v31.6.6
- prebroken: none
- hung: none
- soft: none

## Sprint evidence

- `tester163-v3164-invoice-pay-void.js`: PASS
- `tester164-v3165-fiscal-guards.js`: PASS
- `tester165-v3166-fiscal-date-canonical.js`: 9 PASS / 0 FAIL
- Latin, Persian and Arabic fiscal-year extraction: PASS
- fiscal report, orphan purge and invoice/receipt guards use canonical year helper.

## Audit warning

`audit.py` reports one non-error warning for heavy images. This remains a P2/P3 optimization item.

## Release decision

`v31.6.6` is the Production candidate for FIN-WF-007 canonical date handling. FIN-WF-001 implementation, personal-cheque policy and staging remain outside this release.
