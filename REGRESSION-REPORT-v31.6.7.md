# Current Regression Evidence — v31.6.7

**Date:** 2026-07-17  
**Artifact:** current project bundle `v31.6.7` after FIN-WF-010 safe orphan purge  
**Runner:** `_tools/run-full-regression.js`  
**Audit:** `_tools/audit.py`

## Result

- changed JavaScript syntax: PASS
- regression files PASS: 142
- regression files FAIL: 0
- checks PASS: 3673
- checks FAIL: 0
- runner exit code: 0
- runner-reported version: v31.6.7
- prebroken: none
- hung: none
- soft: none

## Sprint evidence

- `tester114-v198.js`: 20 PASS / 0 FAIL
- orphan purge requires preview fingerprint;
- operational orphan records are deletable only after fresh preview;
- invoice/payable orphan records are quarantined, not physically deleted;
- locked-year financial records remain protected;
- archived chains remain protected.

## Audit warning

`audit.py` reports one non-error warning for heavy images. This remains a P2/P3 optimization item.

## Release decision

`v31.6.7` is the Production candidate for FIN-WF-010 safe orphan cleanup. FIN-WF-001 implementation, personal-cheque policy and staging remain outside this release.
