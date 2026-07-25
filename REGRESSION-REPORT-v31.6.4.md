# Current Regression Evidence — v31.6.4

**Date:** 2026-07-17  
**Artifact:** current project bundle `v31.6.4` after FIN-WF-006 receipt reversal implementation  
**Runner:** `_tools/run-full-regression.js`  
**Audit:** `_tools/audit.py`

## Result

- changed JavaScript syntax: PASS
- regression files PASS: 140
- regression files FAIL: 0
- checks PASS: 3657
- checks FAIL: 0
- runner exit code: 0
- runner-reported version: v31.6.4
- prebroken: none
- hung: none
- soft: none

## FIN-WF-006 evidence

- `tester163-v3164-invoice-pay-void.js`: 14 PASS / 0 FAIL
- invoice is retained;
- original receipt is marked voided with reason;
- negative reversal event is appended;
- duplicate reversal is blocked;
- locked fiscal year is blocked;
- unauthorized sales role is blocked.

## Audit warning

`audit.py` reports one non-error warning for heavy images. This remains a P2/P3 optimization item.

## Release decision

`v31.6.4` is the Production candidate for customer receipt reversal. FIN-WF-001 implementation, personal-cheque policy and staging remain outside this release.
