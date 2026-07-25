# Current Regression Evidence — v31.6.11

**Date:** 2026-07-17  
**Artifact:** current project bundle `v31.6.11` after FIN-WF-016 recognition policy deliverable  
**Runner:** `_tools/run-full-regression.js`  
**Audit:** `_tools/audit.py`

## Result

- regression files PASS: 145
- regression files FAIL: 0
- checks PASS: 3692
- checks FAIL: 0
- runner exit code: 0
- runner-reported version: v31.6.11
- prebroken: none
- hung: none
- soft: none

## Sprint evidence

- recognition policy document added;
- reconciliation report template added;
- no schema, workflow or data mutation;
- linked/unlinked cost and supplier-liability recognition rules documented.

## Audit warning

`audit.py` reports one non-error warning for heavy images. This remains a P2/P3 optimization item.

## Release decision

`v31.6.11` is the Production candidate for FIN-WF-016 documentation and reconciliation policy. FIN-WF-001 implementation, personal-cheque policy and staging remain outside this release.
