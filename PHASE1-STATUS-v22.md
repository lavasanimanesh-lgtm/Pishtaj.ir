# Phase 1 Status — Sales File & Archive Hardening

Date: 2026-07-11
Basis: `PTF-MASTER-HANDOVER.md` used as architectural guidance; actual current state verified from code and audited package.

## Completed in this pass

### Workflow hardening
1. Real-buy correction path improved
   - explicit edit action on already-registered real buys
2. Advance-payment correction exposed inside sales-file workflow
3. Personal cheque visibility enforced
4. TC financial behavior aligned with CO in item grid / validity workflow

### Archive / post-archive hardening
5. Archived project now shows total case costs
6. Archived project supports controlled post-archive costs for privileged roles:
   - warranty / after-delivery service / repair / logistics / other
   - add / edit / delete
   - attachment upload
   - change-log recording
7. Sales file drawer now includes financial integrity strip:
   - advance payment
   - real-buy coverage
   - direct costs
   - invoice/open amount
   - archive readiness
8. Sales file drawer now exposes direct-cost correction actions:
   - edit
   - upload attachment
   - delete

## Still intentionally left for next sub-steps
- deeper scenario validation of archived lost-case restrictions vs business expectations
- optional enhancement of audit/change-log wording for post-archive cost actions
- broader end-to-end regression after deployment on real server
