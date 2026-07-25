# Phase 1 Progress — Workflow Hardening (Pass 6)

Date: 2026-07-11

## Focus of this pass
- saved-offer preview accessibility
- revision vs direct correction behavior
- formal sales-file document workflow tightening
- in-app preview consistency
- sales-file document action clarity

## Completed in this pass

### Offers
1. Saved offers now have direct preview access without forcing the user into the edit form preview path
2. Kanban offer cards now expose direct preview and print-template actions
3. Offer edit/save behavior now distinguishes:
   - direct correction (no new revision)
   - explicit/new revision path
4. Pre-sent corrections no longer automatically inflate revision count

### In-app preview
5. Printable offers now open in an internal modal preview window instead of forcing a browser tab
6. The preview modal provides a direct print / save-PDF path
7. Formal sales-file docs (`docsx`) also use in-app preview when the preview helper exists

### Formal sales-file docs
8. Packing list / inspection notice official actions are now surfaced more clearly in the sales-file action strip
9. Existing formal docs now expose direct edit paths on the same issued document
10. New official docs prefill more from sales-file / client context
11. Remaining-item filtering for PL/IN issuance is reinforced via refs-based exclusion on new issuance
12. Address/location fields now include AI English-translation helper buttons
13. Signature/stamp rendering in formal docs improved toward company-document consistency

### Opex linkage
14. General expense entry can optionally target a winning sales file
15. Linked expense is mirrored into that sales file for workflow visibility
16. Deleting linked expense removes mirrored sales-file cost event

## Status
This pass continues the process-hardening focus and reduces day-to-day operational friction in offer review and formal post-award document handling.
