# Backlog Family Map — v22 Audited Development Baseline

Date: 2026-07-12
Purpose: regroup backlog and user stories into coherent development families after hardening phase.

---

## Family A — Workflow Integrity & Event Sequencing
Scope:
- request lifecycle
- win / post-award transitions
- delivery / invoice / closure / archive gates
- forbidden retroactive transitions

Primary references:
- `BACKLOG-INTEGRITY-AGILITY-R14.md`
- `BACKLOG-SALESFILE-SOURCE-OF-TRUTH-R12.md`
- `BACKLOG-SALESFILE-ARCHIVE-BUGS-R15.md`

Representative items:
- BUG-031
- US-440
- US-441
- US-442
- US-443

Current state:
- major hardening completed
- remaining work = deeper productization and rule refinement, not emergency repair

---

## Family B — Sales File / Archive / Document Governance
Scope:
- sales file as post-award source of truth
- official packing / inspection documents
- post-archive corrections
- archive traceability

Primary references:
- `BACKLOG-SALESFILE-SOURCE-OF-TRUTH-R12.md`
- `BACKLOG-SALESFILE-ARCHIVE-BUGS-R15.md`

Current state:
- hardening completed on core workflow
- remaining work = print-design maturity, richer archive business policies, deeper formal-doc UX

---

## Family C — Multi-Currency & Financial Consistency
Scope:
- offer currency
- FX basis/rates
- advance payments
- invoice / receivable benchmark rules
- project profit consistency

Primary references:
- `CASESTUDY-REALBUY-FX-R8.md`
- `BACKLOG-FINANCE-UX-R13.md`
- `CASESTUDY-POSTAWARD-COSTS-R10.md`

Current state:
- critical inconsistencies hardened
- remaining work = richer finance UX, stronger deterministic automated regression, more visible auditability for end users

---

## Family D — Operational Agility & Correction UX
Scope:
- direct correction vs revision
- real-buy correction
- cost correction
- fast preview / print
- low-friction data maintenance

Primary references:
- `BACKLOG-INTEGRITY-AGILITY-R14.md`
- `BACKLOG-POST-R9-REVIEW.md`

Current state:
- major friction reduced
- remaining work = further simplification and better discoverability of correction paths

---

## Family E — Reminder / Notification / Personal Workflows
Scope:
- reminders
- shared visibility
- due notifications
- personal cheque reminders
- My Day / dashboard cues

Primary references:
- `BACKLOG-ENGAGEMENT-R4.md`
- `BACKLOG-HUMAN-TEST-FINDINGS.md`

Current state:
- hardening completed for ownership/visibility logic
- remaining work = richer notification preferences and escalation policies

---

## Family F — Formal AI Technical Assistant
Scope:
- request analysis
- document intelligence
- engineering calculation engine integration
- technical proposal versioning

Primary reference:
- `AI-TECHNICAL-ASSISTANT-MODULE-SPEC-v1.md`

Current state:
- specification approved
- implementation not started
- should be treated as a dedicated development stream, not a hardening task

---

## Family G — Lead & Supplier Discovery / Market Intelligence
Scope:
- valuable lead discovery from trusted public sources
- credible supplier discovery for requested equipment
- source governance
- evidence packaging
- score + dedup + human approval

Primary references:
- `LEAD-SUPPLIER-FINDER-SPEC-v1.md`
- `AI-TECHNICAL-ASSISTANT-MODULE-SPEC-v1.md` (related but separate stream)

Current state:
- specification drafted
- implementation not started
- should be treated as a separate controlled intelligence module, not a raw crawler

---

## Family H — Security / Deployment / Platform
Scope:
- safe release packaging
- cache/PWA behavior
- proxy/API hardening
- future JWT/HMAC maturity

Primary references:
- `PTF-MASTER-HANDOVER.md`
- `HARDENING-FINAL-v22.md`

Current state:
- hardening completed for release structure and dangerous cache behavior
- remaining work = backend token/security evolution, host-level operational controls

---

## Recommended Development Order After Hardening
1. Family F — AI Technical Assistant foundation
2. Family G — Lead & Supplier Discovery framework
3. Family B — Formal document/print maturity
4. Family C — Finance UX and traceability depth
5. Family A — Additional deterministic gate/rule refinement
6. Family D/E — Usability acceleration and notification refinement
7. Family H — platform/security hardening phase 2
