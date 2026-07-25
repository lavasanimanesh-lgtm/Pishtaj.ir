# Current Regression Evidence — v31.6.16

**Date:** 2026-07-17  
**Artifact:** current project bundle `v31.6.16` after US-436 light surplus activation  
**Runner:** `_tools/run-full-regression.js`  
**Audit:** `_tools/audit.py`

## Result

- regression files PASS: 148
- regression files FAIL: 0
- checks PASS: 3710
- checks FAIL: 0
- runner exit code: 0
- runner-reported version: v31.6.16
- audit: all checks PASS, no warnings
- prebroken: none
- hung: none
- soft: none

## Sprint evidence

- surplus module is runtime-loaded and routed;
- `ptf_crm_surplus` is included in sync, backup and API whitelist;
- search filter is applied to rendered rows;
- reservation/sold quantities and source provenance are retained;
- hook is event-driven and has no `setInterval`.

## Release decision

`v31.6.16` is the Production candidate for US-436 lightweight surplus inventory. Full warehouse scope, US-437, FIN-WF-001 and personal-cheque policy remain outside this release.
