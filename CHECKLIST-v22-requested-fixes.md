# Checklist — Requested Fixes Review (v22.0)

Date: 2026-07-11

## Result Summary

### 1) Petty cash expenses must support edit/delete
**Status in prior delivery:** DONE
- Edit button exists in `crm/petty.js`
- Delete button exists in `crm/petty.js`
- Relevant logic found around:
  - `pettyEdit(...)`
  - `pettyDel(...)`

### 2) Reminders should default to the creator, unless additional users are selected
**Status in prior delivery:** PARTIAL / NOT COMPLETE
- Default “my reminders” filter existed
- But reminders had no proper multi-user assignment UI
- Reminder ownership used display name, not robust user targeting
- Due reminder notifications were incorrectly sent to the current session user instead of actual target users

**Fixed now:** YES
- Added owner/assignee model for reminders
- Added optional multi-user selection in reminder creation
- Default remains: creator only
- Reminder list, badge, dashboard widget and due notifications now respect owner/shared users

### 3) Persian calendar under date fields
**Status in prior delivery:** PARTIAL
- Jalali date picker exists in `crm/datex.js`
- It is used in reminder and lead forms
- It is not a full global replacement for every date field in the CRM

### 4) FX widget displayed values as toman while they were actually rial
**Status in prior delivery:** DONE
- Widget labels in `crm/fx.js` are rial
- API `api/fx-rates.php` sets `unit = rial`
- Old non-rial cache is explicitly rejected

### 5) Sana source issue / fallback to another source like isat.ir
**Status in prior delivery:** DONE IN CODE
- Fallback to `https://isat.ir/api/v1/public/rates` exists in `api/fx-rates.php`
- However live connectivity depends on server/network availability

### 6) Gold should be displayed in rial instead of yuan
**Status in prior delivery:** BUGGY / INCORRECT
- Prior code displayed a rial field, but its calculation was wrong
- It multiplied gold by USD rate instead of using the rial value directly

**Fixed now:** YES
- `gold18_rial` now uses the source rial value directly

### 7) EUR → USD conversion should be added
**Status in prior delivery:** DONE
- `eur_usd` is computed in `api/fx-rates.php`
- Display exists in `crm/fx.js`

---

## Additional Late Finding

### 8) Changing salary of duty shareholders had no effective result in applied monthly salary
**Status in prior delivery:** INCOMPLETE / PRACTICALLY BROKEN
- Editing shareholder master salary could save
- But when salary for that month had already been applied, re-running monthly salary mostly skipped existing records
- So the changed salary did not propagate to the existing shareholder salary transaction / linked opex row

**Fixed now:** YES
- Added sync logic for the selected month
- When a duty shareholder salary changes, existing monthly salary transaction for that month is automatically updated
- Linked OPEX row is also updated
- Monthly apply now supports:
  - new creation
  - update if amount changed
  - skip only if no change is needed

## Final Verdict
Not all requested fixes were correctly completed by the previous agent.

The most important incomplete/wrong items were:
1. Reminder multi-user assignment and correct targeting
2. Gold-in-rial calculation correctness
3. Duty-shareholder salary change propagation to monthly applied salary records

These have now been corrected in the audited package.
