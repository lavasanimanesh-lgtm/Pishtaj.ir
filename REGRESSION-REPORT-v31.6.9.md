# Current Regression Evidence — v31.6.9

**Date:** 2026-07-17  
**Artifact:** current project bundle `v31.6.9` after FIN-WF-012 supplier reconciliation  
**Runner:** `_tools/run-full-regression.js`  
**Audit:** `_tools/audit.py`

## Result

- changed JavaScript syntax: PASS
- regression files PASS: 144
- regression files FAIL: 0
- checks PASS: 3686
- checks FAIL: 0
- runner exit code: 0
- runner-reported version: v31.6.9
- prebroken: none
- hung: none
- soft: none

## Sprint evidence

- `tester167-v3169-supplier-reconcile.js`: 7 PASS / 0 FAIL
- official supplier invoices, linked legacy purchases, opening adjustments and unlinked legacy obligations are shown separately;
- report is read-only and performs no migration or automatic correction.

## Audit warning

`audit.py` reports one non-error warning for heavy images. This remains a P2/P3 optimization item.

## Release decision

`v31.6.9` is the Production candidate for FIN-WF-012 supplier reconciliation. FIN-WF-001 implementation, personal-cheque policy and staging remain outside this release.
