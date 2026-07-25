# Phase 1 Progress — Workflow Hardening (Pass 4)

Date: 2026-07-11

## Focus of this pass
- deeper propagation consistency from foreign offer → advance → invoice → receivable
- downstream reflection of archived / post-archive financial changes
- residual mixed payment-array read paths

## Completed in this pass

### FX / invoice / receivable chain
1. Strengthened foreign-offer context display in invoice list
2. Strengthened receivables panel with foreign-origin explanatory info and FX summary context
3. Invoice creation now stores source offer currency metadata on the invoice record
4. Advance-payment panel is now blocked after invoice issuance for that offer/request
   - user is redirected conceptually to invoice-based receivable handling

### Payment-array consistency
5. Additional remaining modules normalized to read both:
   - `payments[]`
   - `pays[]`
6. This reduces risk of mismatched outstanding balances, collection ratios, and stage logic

### Cost propagation
7. Recorded case costs are auto-included in the net-profit dialog
8. Archive/post-archive costs are included in project-cost logic
9. Cloud-linked attachments tied to deleted cost entries are cleaned through delete-batch paths

## Smoke coverage
Extended smoke script still passes after this pass, including FX invoice summary.

Result: PASS
