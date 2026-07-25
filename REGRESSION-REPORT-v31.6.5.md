# Current Regression Evidence — v31.6.5

**Date:** 2026-07-17  
**Artifact:** current project bundle `v31.6.5` after FIN-WF-004 guard completion  
**Runner:** `_tools/run-full-regression.js`  
**Audit:** `_tools/audit.py`

## Result

- changed JavaScript syntax: PASS
- regression files PASS: 141
- regression files FAIL: 0
- checks PASS: 3663
- checks FAIL: 0
- runner exit code: 0
- runner-reported version: v31.6.5
- prebroken: none
- hung: none
- soft: none

## Sprint evidence

- `tester163-v3164-invoice-pay-void.js`: 14 PASS / 0 FAIL
- `tester164-v3165-fiscal-guards.js`: 6 PASS / 0 FAIL
- customer invoice/receipt locked-year guards present;
- shareholder/salary/draw locked-year guards present;
- fiscal amendment path remains separate.

## Audit warning

`audit.py` reports one non-error warning for heavy images. This remains a P2/P3 optimization item.

## Release decision

`v31.6.5` is the Production candidate for the FIN-WF-004 guard completion. FIN-WF-001 implementation, personal-cheque policy and staging remain outside this release.
