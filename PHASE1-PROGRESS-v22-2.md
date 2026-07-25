# Phase 1 Progress — Workflow Hardening (Pass 2)

Date: 2026-07-11

## Completed in this pass

### Multi-currency workflow hardening
1. Repaired foreign-offer currency UI anchoring after Jalali form migration
2. Added reference FX basis capture on offers:
   - free
   - sana
   - agreed/custom
3. Improved offer-list visibility for FX-origin offers
4. Strengthened pre-invoice advance-payment logic for FX offers:
   - multiple partial receipts
   - IRR + document-currency tracking
   - remaining amount in both IRR and document currency
   - deletion of mistaken receipt entries
5. Clarified post-invoice rule:
   - invoice IRR amount is the receivable benchmark
6. Normalized several modules to read both `payments[]` and `pays[]`

### Sales file / archive hardening
7. Sales file financial strip added:
   - advance payment
   - real-buy coverage
   - direct costs
   - invoice/open amount
   - archive readiness
8. Real-buy rows now expose explicit correction action
9. Direct project costs now support:
   - edit
   - delete
   - attachment management
10. Archived projects now support controlled post-archive costs:
   - warranty
   - after-delivery service
   - repair/replacement
   - reverse logistics
   - other
11. Archived project cost actions now also support cloud-linked attachment cleanup on delete
12. Archived project keeps explicit `wonOffer` reference for more reliable downstream logic

### Profit integrity
13. Net-profit dialog now automatically includes recorded case costs
14. Additional unrecorded costs can still be entered manually on top
15. Project profit hook now includes archive/post-archive costs in the evaluated project cost base

### Privacy / role behavior
16. Issued cheques are restricted to the creator's own view and actions

## Smoke coverage
Extended smoke validation now covers:
- shareholder salary propagation
- reminder ownership/shared visibility
- FX advance partial normalization
- archive/post-archive cost total calculation

Script:
- `_tools/audit-v22-smoke.js`

Result: PASS
