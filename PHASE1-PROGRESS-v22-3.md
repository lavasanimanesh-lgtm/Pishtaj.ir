# Phase 1 Progress — Workflow Hardening (Pass 3)

Date: 2026-07-11

## Focus of this pass
- end-to-end consistency of foreign-currency offers/payments/invoices
- downstream propagation of recorded case costs
- archived project financial continuity
- remaining mixed `payments[]` vs `pays[]` read paths

## Completed in this pass

### Multi-currency / receivable consistency
1. Offer FX UI now stores:
   - currency
   - reference FX basis
   - reference FX rate
2. Offer list shows FX-origin metadata more clearly
3. Advance-payment receivable before invoice now supports:
   - multiple partial receipts
   - receipt deletion
   - remaining balance in IRR and document currency
4. After invoice issuance, advance receivable path is blocked and user is directed to invoice receivables
5. Receivable UI now explicitly states:
   - foreign-origin request may exist
   - but invoice IRR amount is the post-invoice collection benchmark

### Propagation / consistency fixes
6. Several remaining modules were normalized to read both `payments[]` and `pays[]` where needed
7. Invoice records now persist source offer currency metadata for better resilience if offer lookup is unavailable later
8. FX invoice summary helper now reads both payment arrays

### Project/archive finance
9. Net profit dialog now auto-includes recorded case costs
10. Archived and post-archive costs are included in project-cost calculations
11. Archived post-cost deletion now also cleans related cloud-linked attachments

## Smoke test coverage extended
The smoke script now verifies:
- shareholder salary propagation
- reminder ownership/shared visibility
- FX advance partial normalization
- archive/post-archive cost totals
- FX invoice summary over mixed `payments[]` + `pays[]`

Result: PASS
