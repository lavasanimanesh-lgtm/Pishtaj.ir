# 10-Sprint Development Roadmap — v22.1 to v23.0

Date: 2026-07-12
Status: Locked planning document after hardening phase
Purpose: define the next 10 development sprints in a coherent order so work can resume quickly without re-planning.

---

## Guiding principle
Now that the hardening phase is complete, the next 10 sprints should prioritize:

1. **AI Technical Assistant foundation**
2. **Engineering-calculation infrastructure**
3. **Lead & Supplier Discovery / Market Intelligence**
4. **Formal proposal/versioning maturity**
5. **Operational trust, reporting, and deterministic validation**

---

# Sprint v22.1
## Title
AI Technical Assistant — Foundation & Request Analysis

## Scope
- request bundle builder
- attachment inventory resolver
- file parsing pipeline shell
- Persian technical summary
- missing-data / contradiction checklist
- analysis persistence + versioning shell
- approval gate before Technical Proposal stage

## Stories
- US-AI-01
- US-AI-02
- US-AI-03
- US-AI-04
- US-AI-05
- US-AI-06
- US-AI-07
- US-AI-08
- US-AI-09
- US-AI-10 (foundation only)

---

# Sprint v22.2
## Title
Engineering Calculation Engine — Core Adapter Layer + Control Valve Phase 1

## Scope
- calculation-run data model
- deterministic calc adapter layer
- formula/input/output persistence
- control valve package phase 1:
  - Cv
  - sizing
  - choked flow
  - cavitation
  - actuator sizing

## Stories
- US-AI-11
- US-AI-12
- US-AI-13
- US-AI-14

---

# Sprint v22.3
## Title
Technical Proposal Composer — English Proposal v1 + PDF/DOCX Versioning

## Scope
- proposal entity
- proposal versioning / revision model
- English proposal section composer
- PDF output
- DOCX output
- request/proposal linkage in CRM
- approved proposal registration workflow

## Stories
- US-AI-15
- US-AI-16
- US-AI-17
- US-AI-18
- US-AI-19

---

# Sprint v22.4
## Title
Lead Finder — Source Governance + Candidate Discovery Foundation

## Scope
- lead discovery source registry
- trust-level classification
- discovery job object
- evidence capture
- lead scoring v1
- duplicate detection against CRM
- review queue

## Stories
- US-LF-01
- US-LF-02
- US-LF-03
- US-LF-04
- US-LF-05

---

# Sprint v22.5
## Title
Supplier Finder — Equipment-Based Supplier Discovery Foundation

## Scope
- supplier discovery source registry
- supplier candidate extraction
- technical-fit scoring v1
- domestic/foreign suitability
- duplicate detection against supplier base
- review queue

## Stories
- US-SF-01
- US-SF-02
- US-SF-03
- US-SF-04
- US-SF-05

---

# Sprint v22.6
## Title
Engineering Calculation Expansion — Pump / Flow Meter / Pipe / PSV

## Scope
- add equipment-family adapters and rules
- required-input checklists by family
- deterministic calculation persistence
- reusable calculation-table renderer

## Stories
- US-AI-20
- US-AI-21
- US-AI-22
- US-AI-23

---

# Sprint v22.7
## Title
Revision Intelligence — Client Comment Rework Loop + Proposal Comparison

## Scope
- comment-driven revision workflow
- proposal comparison view
- diff summary
- regeneration from updated sources
- revision chain auditability

## Stories
- US-AI-24
- US-AI-25
- US-AI-26

---

# Sprint v22.8
## Title
Formal Document & Output Maturity

## Scope
- final polish for technical proposal print layouts
- charts/graphs embedding
- output consistency rules
- formal company branding consistency across AI-generated outputs
- improvement of preview/download UX if still needed

## Stories
- US-AI-27
- US-AI-28
- US-AI-29

---

# Sprint v22.9
## Title
Market Intelligence Maturity + Reporting

## Scope
- lead/supplier shortlist export
- ranking explanation improvements
- analyst feedback loop shell
- better review queue filtering
- audit/reporting dashboards for discovered candidates

## Stories
- US-LF-06
- US-LF-07
- US-SF-06
- US-SF-07

---

# Sprint v23.0
## Title
Integrated QA / Regression / Productization Checkpoint

## Scope
- full scenario QA over AI assistant + lead/supplier finder + existing CRM workflow
- deterministic test expansion
- release-quality handover for post-v23 development
- backlog reprioritization checkpoint

## Stories
- US-QA-01
- US-QA-02
- US-QA-03

---

## Development Order Rationale
This order is intentional:
1. first build AI analysis foundation
2. then deterministic calculation infrastructure
3. then proposal registration
4. then market-intelligence modules
5. then deepen equipment families
6. then harden revision and reporting UX
7. finally do integrated QA checkpoint

---

## Note
This roadmap is a planning baseline, not proof of implementation. Actual sprint delivery should be reflected in:
- release notes
- handover updates
- audited package content
