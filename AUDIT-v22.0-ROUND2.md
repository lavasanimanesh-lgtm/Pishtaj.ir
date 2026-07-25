# AUDIT v22.0 — Round 2 Deep Review

Date: 2026-07-11
Reviewer: Arena.ai Agent Mode
Status: Deep audit continued after first remediation wave.

---

## Scope of Round 2
Focused audit on modules the client had specifically questioned or that were high-risk after Round 1:

1. Reminders / notifications / “My Day”
2. Jalali date picker usage consistency
3. Shareholders / duty salary monthly application
4. Letters / offers / buycompare date inputs
5. FX display consistency

---

## Findings & Actions

### A) Reminder visibility and targeting
**Finding:** prior delivery was incomplete.
- default “my reminders” existed
- but robust user-targeting model did not exist
- due reminder notifications could target the current session user incorrectly
- dashboard / badges were not consistently user-scoped

**Action completed:**
- owner/shared-user model implemented
- reminder creation now defaults to creator only
- optional multi-user selection added
- due notifications now target actual assigned users
- dashboard “My Day”, reminder badge and analyzer overdue count were aligned with user scope

---

### B) Jalali date picker position / broken reminder date display
**Finding:** valid.
- calendar trigger placement could visually interfere with date display in reminder UI

**Action completed:**
- Jalali picker redesigned
- trigger moved below/outside the input field
- added explicit “📅 انتخاب از تقویم” and “امروز” buttons
- popup opens below the field, not over the date text

---

### C) Incomplete Jalali adoption across CRM
**Finding:** after deeper scan, several legacy `type="date"` usages still existed in business forms.
Affected examples included:
- bulk buy supplier due date
- inbound letters due date
- offer date / offer validity
- AI cheque due date preview form

**Action completed:**
- migrated these remaining functional date fields to the Jalali helper flow
- selection is now Jalali in UI, while storage remains ISO where required

**Result:**
- remaining `type="date"` usages are no longer present in business forms (only CSS selectors remain)

---

### D) Duty shareholder salary edit had no applied effect
**Finding:** valid.
- editing shareholder salary updated the master shareholder record
- but previously applied salary rows for the selected month were skipped, not updated
- linked OPEX row also stayed stale

**Action completed:**
- added month-level sync logic
- changing salary now updates existing monthly salary transaction for that month
- linked OPEX salary row updates too
- monthly apply now supports create/update/no-change paths

---

### E) FX / gold / Sana
**Finding:**
- gold-in-rial logic had been wrong in prior delivery and was corrected in Round 1
- Sana fallback to `isat.ir` exists in code
- live network behavior still depends on server access

**Current status:**
- code-level remediation is in place
- operational verification still requires real-server test because remote endpoints may timeout or be blocked

---

## Smoke Verification Performed
A lightweight Node-based smoke script was added and executed for:

1. Shareholder salary propagation
2. Reminder ownership / shared-user visibility

**Result:** PASS

Script:
- `_tools/audit-v22-smoke.js`

---

## Current Confidence Level
### High confidence on:
- package structure
- safe cache clear behavior
- reminder ownership/visibility logic
- Jalali picker positioning in audited forms
- shareholder duty salary propagation
- gold-in-rial correctness

### Still requires live-environment validation:
- external FX endpoints and Sana fallback reachability from hosting server
- full end-to-end UI regression on deployed host/browser cache/PWA behavior

---

## Recommendation Before Development Phase
The package is now in a **much safer state** than the prior delivery, and the previously disputed fixes were not just reviewed but materially corrected.

Recommended next step before feature development:
1. Deploy this audited package on staging/live clone
2. Perform short live regression checklist on:
   - reminders
   - shareholder salary edit + monthly apply
   - Jalali date fields in reminders/offers/letters/bulk buy
   - FX widget source reachability

After that, development phase can start with significantly higher confidence.
