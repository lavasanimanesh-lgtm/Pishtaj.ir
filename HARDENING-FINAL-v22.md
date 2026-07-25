# Hardening Final Report — v22 Audited Package

Date: 2026-07-12
Status: Hardening phase complete — stop point reached before next development/backlog phase

---

## 1) Scope completed in hardening phase

### A. Delivery / deployment safety
- fixed broken package structure (flat deployable archive)
- removed nested legacy root issue
- created audited deployable package

### B. Data safety
- fixed dangerous cache-clear behavior that could wipe CRM browser data
- changed cache-clear to safe targeted cleanup

### C. Customer visibility / ownership
- fixed `My Customers` filter logic
- aligned visibility with `owner || crBy`
- fixed senior-role mine/all behavior

### D. Reminders / notifications
- owner + shared-user model added
- default reminder visibility = creator only
- optional extra users can be added
- due notifications now target actual assigned users
- reminder badges / My Day / reminder lists aligned with ownership logic

### E. Jalali date workflow
- date picker redesigned to avoid broken visual overlap
- trigger moved out of the input area
- multiple important workflow date fields migrated away from legacy direct date inputs

### F. Shareholders / duty salary
- fixed salary-change propagation bug
- applied monthly salary record now updates when master salary changes
- linked OPEX row updates too

### G. Sales file / archive workflow
- financial integrity strip added to sales file drawer
- better visibility of:
  - advance status
  - real-buy coverage
  - direct costs
  - invoice/open amount
  - archive readiness
- direct cost events now support:
  - add
  - edit
  - delete
  - attachment handling
- post-archive costs added for privileged roles:
  - warranty
  - after-delivery service
  - repair/replacement
  - reverse logistics
  - other
- post-archive cost changes are logged in archive change log

### H. Real buy workflow
- explicit correction path for existing real-buy rows
- better linkage of cost and profit behavior
- stronger warnings for incomplete real-buy coverage before closure/archive

### I. Multi-currency hardening
- repaired currency UI injection after Jalali migration
- added FX reference basis/rate capture on offers
- improved foreign-offer display context
- strengthened pre-invoice foreign advance-payment logic:
  - multiple partial receipts
  - receipt deletion
  - remaining IRR + document-currency tracking
- post-invoice rule clarified and enforced in workflow:
  - invoice IRR amount becomes receivable benchmark
- harmonized use of `payments[]` and `pays[]` across major modules

### J. Offer lifecycle hardening
- direct correction vs revision logic improved
- pre-sent corrections do not automatically create a new revision
- explicit revision path remains available
- direct preview access for saved offers added

### K. In-app preview hardening
- offers preview now uses internal modal instead of requiring a browser tab
- docsx preview uses internal modal when helper exists
- analyzer / listtools / contracts / letters printable outputs also support internal modal preview paths

### L. Formal sales-file documents (`docsx`)
- official docs support editing same record instead of always issuing a new one
- better case-context prefill
- AI helper button for English translation of address/location fields
- remaining-item filtering for official packing list / inspection note strengthened
- if all eligible items are already consumed, user is guided to edit the prior document instead of issuing a pointless new one
- official packing list moved to landscape for more realistic print layout
- sales-file drawer now shows official document coverage warnings

### M. Privacy / ownership
- issued cheques now visible only to their creator
- cheque actions restricted to the creator

### N. Cheque print hardening
- richer Sayadi cheque form fields added
- draft preview before final save added
- single and bulk cheque print preview added
- finalized cheque now creates/updates personal reminder entry
- cheque clear/delete updates linked reminder state

### O. Print/signature stability
- compacted signature/tail block in offer print templates
- reduced chance of signature alone spilling onto page 2 when content still fits page 1
- grouped terms + signature in tail blocks with page-break avoidance

---

## 2) Validation completed

### Static validation
- repeated syntax checks across modified JS modules: PASS

### Smoke validation
Current smoke script covers:
- shareholder salary propagation
- reminder ownership/shared visibility
- partial FX advance normalization
- archived/post-archive cost totals
- FX invoice summary over mixed `payments[]` and `pays[]`

Result: PASS

File:
- `_tools/audit-v22-smoke.js`

---

## 3) Hardening-phase conclusion
The system is now significantly more robust in the operational areas that were risky or inconsistent.

This hardening phase has moved the package from:
- fragile / inconsistent / partially misleading workflow behavior

to:
- audited / corrected / materially harder to break in day-to-day usage

---

## 4) What is intentionally left for next development/backlog phase
These items are no longer treated as urgent hardening blockers. They are now proper **development backlog** items:

1. AI Technical Assistant module implementation
2. Full engineering calculation engine integration by equipment family
3. richer proposal/version comparison UX
4. broader report/export redesign
5. deeper deterministic automated regression suite across all modules
6. further aesthetic redesign of some print layouts beyond current hardening-level fixes
7. advanced archive/business policies if the client wants stricter process gates

---

## 5) Stop point
Per client instruction, hardening phase is considered complete here.

Next step should be:
- new development phase
- backlog implementation
- especially AI Technical Assistant and remaining product expansion
