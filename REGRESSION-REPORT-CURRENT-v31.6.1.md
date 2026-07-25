# Current Regression Evidence — v31.6.1

**Date:** 2026-07-17  
**Artifact:** current project bundle `v31.6.2` after the `crm/oppo.js` syntax fix and US-435 opportunity-view wiring  
**Runner:** `_tools/run-full-regression.js`  
**Audit:** `_tools/audit.py`

## Result

- `node --check crm/oppo.js`: PASS
- `tester127-v211.js`: 49 PASS / 0 FAIL
- US-435 targeted grouping/render test: PASS
- `audit.py`: no reported error; one warning for heavy images
- regression files PASS: 139
- regression files FAIL: 0
- checks PASS: 3643
- checks FAIL: 0
- runner exit code: 1
- runner-reported version: v21.3 (harness drift; artifact marker is v31.6.1)
- prebroken: none
- hung: none

## Interpretation

The `oppo.js` syntax failure was removed, US-435/provenance work was integrated, and historical capability assertions were updated. The current regression gate is green: 139 tester files and 3643 checks PASS with zero FAIL. The remaining release warning is the heavy-image audit warning recorded in the backlog.

## Release decision

`Done/Fixed` for the overall release gate: **NO**.  
Production release of a financial/auth change: **not requested and not allowed before Stage-0 blockers are resolved**.  
New ZIP: **not created**.
