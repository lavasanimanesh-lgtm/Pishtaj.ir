# RELEASE NOTES — v22.1

Date: 2026-07-12
Status: Released build package
Package: `pishtaj-release-v22.1-audited-flat.zip`

---

## Summary
Sprint v22.1 starts the **AI Technical Assistant Foundation** phase.

This release does **not** yet generate final technical proposals and does **not** run engineering calculations.
It delivers the Stage-1 foundation required by the approved specification:

- request bundle builder
- attachment inventory resolver
- Persian technical analysis
- missing-data / contradiction checklist
- analysis persistence and versioning shell
- approval gate before Technical Proposal stage

---

## Included

### 1) Version bump to v22.1
Updated CRM version markers from `v22.0` to `v22.1` in:
- `crm/index.html`
- `crm/sw.js`
- `crm/clear-cache.html`
- all CRM script cache-busting query strings in `crm/index.html`

### 2) New module: AI Technical Assistant Foundation
New file:
- `crm/ai-tech-assistant.js`

Added inside AI Workbench:
- new default tab: `🧠 دستیار فنی`

Main delivered capabilities:
- select an RFQ/request
- build a technical case bundle from:
  - RFQ metadata
  - structured line items
  - attachment inventory
  - optional analyst note
- store technical cases in CRM local data:
  - key: `ptf_crm_techcases`
- create versioned Persian technical analyses
- keep bundle version and analysis version separately
- show:
  - scope guess
  - equipment family summary
  - extracted key data
  - missing-data list
  - critical-missing list
  - contradiction flags
  - supply-path guidance
- allow Gate approval only when critical missing data is cleared

### 3) Structured LLM endpoint for Stage-1 analysis
Updated:
- `api/llm.php`

New action:
- `techcase`

Purpose:
- analyze a request bundle
- return structured Persian JSON
- explicitly forbid engineering calculations and invented values

### 4) Safe fallback behavior
If live AI analysis is unavailable:
- the module falls back to a heuristic local analysis shell
- bundle persistence and versioning still work
- users still get a missing-data checklist and technical case record

### 5) Backup coverage
Updated backup payload to include:
- `techCases: getData('ptf_crm_techcases')`

### 6) Official SANA / ETS source hierarchy
Updated `api/fx-rates.php` to use the approved source priority for SANA/ETS-related rates:
1. `sanarate.ir` / `fxmarketrate.cbi.ir` as official primary
2. `ice.ir` as official fallback
3. `tgju.org` as public fallback
4. `isat.ir` only as legacy emergency fallback

Additional notes:
- free market / gold / yuan free still come from TGJU
- response now exposes `src_sana` and `src_market` for diagnostics
- CRM FX widget diagnostic text was updated to reflect the new hierarchy

---

## Not included yet
These remain outside v22.1 foundation scope:
- deterministic engineering calculation engine
- control-valve sizing engine
- formal English Technical Proposal composer
- PDF/DOCX technical proposal outputs
- official proposal registration workflow

---

## Validation
- JavaScript syntax check passed for:
  - `crm/ai-tech-assistant.js`
  - `crm/ai-workbench.js`
- existing smoke test passed:
  - `_tools/audit-v22-smoke.js`

---

## Packaging
This package is **flat-root deployable**.
After extraction, the live file structure must land like this:
- `public_html/crm/index.html`
- `public_html/crm/sw.js`
- `public_html/api/...`
- `public_html/assets/...`

Do **not** deploy into:
- `public_html/project_v21_9/...`

---

## Current release family
- `HARDENING-FINAL-v22.md`
- `PTF-MASTER-HANDOVER.md`
- `ROADMAP-10-SPRINTS-v22.1-to-v23.0.md`
- `AI-TECHNICAL-ASSISTANT-MODULE-SPEC-v1.md`
- `LEAD-SUPPLIER-FINDER-SPEC-v1.md`
