# RELEASE NOTES — v22.3

Date: 2026-07-12
Status: Released build package
Package: `pishtaj-release-v22.3-audited-flat.zip`

---

## Summary
Sprint v22.3 adds the first **Technical Proposal Composer** layer on top of:
- v22.1 AI Technical Assistant foundation
- v22.2 deterministic engineering-calculation layer

This release introduces:
- proposal entity + revision model
- English technical proposal draft generation
- proposal preview / PDF-print shell
- DOCX export shell
- official proposal registration workflow

---

## Implemented

### 1) Version bump to v22.3
Updated code version markers to `v22.3` in:
- `crm/index.html`
- `crm/sw.js`
- `crm/clear-cache.html`
- all CRM script cache-busting query strings in `crm/index.html`

### 2) New module: Technical Proposal Composer
New file:
- `crm/tech-proposals.js`

Core delivered capabilities:
- `ptf_crm_techproposals` data model
- proposal family number + revision number
- draft / official / superseded lifecycle
- linkage to:
  - technical case
  - analysis version
  - calc run
  - RFQ / request
- official proposal registration back into CRM records

### 3) English proposal draft generation
The composer now creates versioned English technical proposal drafts with sections:
- Executive Summary
- Process Data
- Design Basis
- Engineering Calculations
- Calculation Tables
- Charts and Graphs
- Equipment Selection Logic
- Recommended Model
- Technical Compliance Matrix
- Deviations
- Conclusion

### 4) Output shell
Current output layer includes:
- HTML preview
- browser print / save PDF flow through internal preview modal
- DOCX export endpoint

New server file:
- `api/tech-proposal-docx.php`

### 5) AI integration rules
Updated:
- `crm/ai-tech-assistant.js`
- `api/llm.php`

Behavior:
- LLM may generate **narrative English sections only**
- engineering calculations remain deterministic and independent
- proposal generation is blocked if:
  - Gate is not approved
  - critical missing data still exists
- official registration for supported control-valve cases requires an accepted calc review

### 6) Persistence / backup / sync coverage
Added to the shared data ecosystem:
- `ptf_crm_techproposals`

Wired into:
- `crm/sync.js`
- `crm/backup.js`
- `api/crm.php`
- `crm/golive.js`
- local backup export in `crm/index.html`

### 7) Previous v22.2 capabilities retained
Still included:
- deterministic calc adapter registry
- control-valve liquid phase-1 adapter
- `ptf_crm_calc_runs`
- official SANA / ETS source hierarchy in FX sourcing

---

## Important scope note
This is still an incremental sprint, not the final mature end-state.

Not included yet:
- full multi-family engineering engine beyond current control-valve phase 1
- complete charting maturity for all equipment families
- advanced proposal revision intelligence / diff workflow
- final polished enterprise DOCX layout with full branding fidelity across all edge cases

---

## Validation
- JavaScript syntax check passed for:
  - `crm/tech-proposals.js`
  - `crm/ai-tech-assistant.js`
  - `crm/eng-calc.js`
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
