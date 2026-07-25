# Phase 1 Progress — Workflow Hardening (Pass 5)

Date: 2026-07-11

## Focus of this pass
- offer edit vs revision behavior
- direct preview accessibility for saved offers
- in-app preview instead of forcing new tabs
- formal sales-file documents hardening (packing / inspection note)
- optional cost-to-sales-file linking from general expense entry

## Completed in this pass

### Offers / revision behavior
1. Saving an existing offer no longer always creates a new revision
2. Direct correction without new revision now applies to pre-sent / pre-comment states
3. Revision bump now happens only in revision-style states or explicit revision mode
4. Kanban cards now expose direct preview access

### Offer preview UX
5. Added direct in-app preview access for saved offers
6. Printable offer output now opens in a modal preview window (iframe srcdoc) instead of forcing a browser tab
7. Download/print action is accessible from inside the preview modal

### Formal sales-file documents (docsx)
8. Documents now support editing the same issued record instead of forcing a new one
9. Packing list / inspection note creation now supports better prefill from deal context
10. New packing/inspection issuance excludes already-used winning-offer items when refs are available
11. Address/location fields now expose AI translation helper buttons for English output
12. Formal document preview/print now uses in-app modal preview when preview helper exists
13. Signature/stamp rendering for formal docs improved toward consistency with company documents

### Cost linkage
14. General opex entry now can optionally link to a winning sales file/deal
15. If linked, the cost is mirrored into the sales file cost events for workflow visibility
16. Deleting linked opex removes mirrored cost event from the sales file

## Smoke status
Existing smoke tests still pass after this pass.

Result: PASS
