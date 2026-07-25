# Current Regression Evidence — v31.6.10

**Date:** 2026-07-17  
**Artifact:** current project bundle `v31.6.10` after FIN-WF-015 data quality dashboard  
**Runner:** `_tools/run-full-regression.js`  
**Audit:** `_tools/audit.py`

## Result

- changed JavaScript syntax: PASS
- regression files PASS: 145
- regression files FAIL: 0
- checks PASS: 3692
- checks FAIL: 0
- runner exit code: 0
- runner-reported version: v31.6.10
- prebroken: none
- hung: none
- soft: none

## Sprint evidence

- `tester168-v3170-data-quality.js`: 6 PASS / 0 FAIL
- data quality dashboard is read-only;
- invoice/payable date and link gaps are reported;
- missing FX rate and cheque ownership are reported;
- ambiguous procurement mappings are surfaced;
- no data mutation or automatic migration occurs.

## Audit warning

`audit.py` reports one non-error warning for heavy images. This remains a P2/P3 optimization item.

## Release decision

`v31.6.10` is the Production candidate for FIN-WF-015 read-only data quality reporting. FIN-WF-001 implementation, personal-cheque policy and staging remain outside this release.
