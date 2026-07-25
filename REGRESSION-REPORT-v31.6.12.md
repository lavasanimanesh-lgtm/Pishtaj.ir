# Current Regression Evidence — v31.6.12

**Date:** 2026-07-17  
**Artifact:** current project bundle `v31.6.12` after TECHDEBT-005 codegen unification  
**Runner:** `_tools/run-full-regression.js`  
**Audit:** `_tools/audit.py`

## Result

- regression files PASS: 146
- regression files FAIL: 0
- checks PASS: 3697
- checks FAIL: 0
- runner exit code: 0
- runner-reported version: v31.6.12
- prebroken: none
- hung: none
- soft: none

## Sprint evidence

- local duplicate generator removed from AI Workbench;
- central unified generator remains the only operational codegen path;
- `tester169-v3171-codegen-unification.js`: 5 PASS / 0 FAIL.

## Audit warning

`audit.py` reports one non-error warning for heavy images. This remains a P2/P3 optimization item.

## Release decision

`v31.6.12` is the Production candidate for TECHDEBT-005 codegen unification. FIN-WF-001 implementation, personal-cheque policy, staging and architectural consolidation remain outside this release.
