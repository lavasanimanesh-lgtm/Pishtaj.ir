# Phase 1 — Multi-Currency Hardening Notes

Date: 2026-07-11

## Client concerns addressed in this pass

1. Foreign-currency offers could appear as IRR in practice
2. Multi-currency workflow needed re-check from offer → payment → invoice
3. For won offers before invoice, FX-day payment logic needed stronger handling
4. Once invoice is issued for a foreign request, invoice amount must become the receivable benchmark in IRR

## Fixes applied

### A) Offer currency selector / anchor compatibility
The audited Jalali migration had changed date field IDs from:
- `ofDate` → `ofDateJ`
- `ofValid` → `ofValidJ`

But the currency injection logic in `offers-pro.js` still searched old IDs, which could prevent currency UI from being injected and saved correctly.

**Fixed:**
- currency injection updated to new form anchors
- foreign-offer currency selection restored

### B) Offer-level FX basis capture
Added explicit support in offer form for foreign offers:
- proposal currency
- FX basis:
  - free
  - sana
  - agreed/custom
- reference FX rate (currency → IRR)

Stored on offer record as reference metadata for cleaner process traceability.

### C) Offer list visibility
Foreign offers now show not just amount/currency, but also reference FX metadata when available.

### D) Advance payment before invoice (won offer stage)
Advance-payment receivable logic was strengthened:
- partial receipts now supported
- multiple receipts can be recorded
- for FX offers, each receipt stores:
  - IRR amount
  - document-currency equivalent
  - day rate
  - basis type
- remaining receivable is tracked in:
  - IRR
  - document currency
- receipt entries can be removed if entered by mistake

### E) Invoice benchmark behavior
When an invoice exists:
- receivable display explicitly treats invoice IRR amount as the benchmark
- for foreign-origin requests, UI now clarifies:
  - request/offer may have been FX
  - but invoice amount in IRR becomes the receivable reference

### F) Payment-sum consistency
Several modules used only `payments[]` and ignored `pays[]` or vice versa.
This could create inconsistent outstanding balances.

**Hardened modules to sum both where needed:**
- receivables
- customer open balance
- analyzer
- commission
- sales file stage/closure logic
- scoring
- workflow checks

## Important note
The current product model still distinguishes two real process stages:

1. **Before invoice**
   - winning offer / advance / FX-linked receivable logic

2. **After invoice**
   - invoice in IRR becomes the financial receivable benchmark
   - collections reduce invoice balance in IRR

This is now much closer to the process described by the client.
