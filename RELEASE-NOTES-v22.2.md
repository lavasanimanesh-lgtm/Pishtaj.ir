# RELEASE NOTES — v22.2

Date: 2026-07-12
Status: Released build package
Package: `pishtaj-release-v22.2-audited-flat.zip`

---

## Summary
Sprint v22.2 moves from analysis-only AI assistance into the first deterministic engineering-calculation layer.

This release adds:
- calculation-run data model
- deterministic adapter layer
- formula/input/output persistence
- Control Valve phase 1 adapter for liquid-service calculations

It also carries forward all v22.1 foundation work, including:
- AI Technical Assistant request bundle builder
- Persian technical analysis
- missing-data / contradiction checklist
- technical case versioning and gate
- official SANA / ETS source hierarchy in FX sourcing

---

## Implemented

### 1) Version bump to v22.2
Updated code version markers to `v22.2` in:
- `crm/index.html`
- `crm/sw.js`
- `crm/clear-cache.html`
- all CRM script cache-busting query strings in `crm/index.html`

### 2) New module: Engineering Calculation Engine
New file:
- `crm/eng-calc.js`

Core delivered capabilities:
- `ptf_crm_calc_runs` data model
- deterministic adapter registry
- traceable formula table per run
- stored inputs / outputs / warnings / review status
- case linkage back to technical case record
- reusable run viewer and reload flow

### 3) Control Valve Phase 1 adapter
Adapter implemented:
- `control_valve_liquid_phase1`

Current deterministic outputs:
- dP
- FF
- liquid choked-flow threshold
- choked / non-choked decision
- Kv required
- Cv required
- cavitation risk classification
- optional line / port velocity checks
- actuator sizing shell when explicit actuator inputs are supplied

### 4) AI Technical Assistant integration
Updated:
- `crm/ai-tech-assistant.js`

Behavior:
- bundle + Persian analysis from v22.1 remain intact
- for supported cases, engineering calculation panel appears below analysis
- current supported family in v22.2:
  - control valve

### 5) Persistence / backup / sync coverage
Added to the shared local data ecosystem:
- `ptf_crm_techcases`
- `ptf_crm_calc_runs`

Wired into:
- `crm/sync.js`
- `crm/backup.js`
- `api/crm.php`
- `crm/golive.js`
- local backup export in `crm/index.html`

### 6) Official SANA / ETS source hierarchy retained
`api/fx-rates.php` now uses the approved hierarchy for SANA/ETS-related rates:
1. `sanarate.ir` / `fxmarketrate.cbi.ir`
2. `ice.ir`
3. `tgju.org`
4. `isat.ir` only as legacy emergency fallback

Additional notes:
- free market / gold / yuan free still come from TGJU
- response exposes `src_sana` and `src_market` for diagnostics
- CRM FX widget diagnostic text reflects the new hierarchy

---

## Important scope note
This is still a **foundation sprint**.
It is deterministic and traceable, but it is not yet the final Technical Proposal system.

Not included yet:
- English proposal composer
- proposal registration workflow
- PDF/DOCX technical proposal package
- non-control-valve equipment adapters
- mature vendor-specific actuator selection logic

---

## Validation
- JavaScript syntax check passed for:
  - `crm/eng-calc.js`
  - `crm/ai-tech-assistant.js`
  - `crm/fx.js`
  - `crm/sync.js`
  - `crm/backup.js`
  - `crm/golive.js`
- smoke test passed:
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
