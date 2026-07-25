# AUDIT v22.0 — Workflow Expert Review

Date: 2026-07-11
Reviewer: Arena.ai Agent Mode
Scope: end-to-end expert review of business workflow with focus on:
- request registration
- supplier RFQ cycle
- winning offer / sales file
- real buy / direct project costs
- advance payment / receivables
- archive behavior and post-archive corrections
- personal cheque visibility

---

## Executive Conclusion

This was not just a cosmetic review. The workflow had a number of **real operational risks**:

1. **Some critical corrections already existed in code but were hard to reach in workflow**
2. **Some important actions were possible in data model but not exposed enough in UI**
3. **At least one material workflow bug existed for techno-commercial offers (TC)**
4. **One visibility/privacy issue existed in issued cheques**

I applied a new remediation pass on the most actionable/high-impact issues discovered during this workflow audit.

---

## What Was Verified / Interpreted by Expert Domain

### A) Sales workflow experts
Reviewed transitions:
- request
- offer drafting
- win / post-award
- real-buy registration
- delivery / invoice / closure

### B) Procurement experts
Reviewed:
- quote collection
- supplier comparison
- real-buy registration and corrections
- payable creation behavior

### C) Finance/control experts
Reviewed:
- advance payment handling
- receivables relation
- direct project costs
- shareholder duty salary propagation

### D) Document/archive governance experts
Reviewed:
- archive eligibility
- post-archive document edits
- traceability / change logs

---

## Findings and Fixes

### 1) Real buy existed, but correcting it was not workflow-friendly
**Finding:**
In the compare/real-buy table, once a real purchase row existed, the row became mostly display-only. That is operationally weak because purchase data is one of the most likely things users must correct.

**Risk:**
- user enters wrong supplier / wrong rate / wrong delivery commitment / wrong final price
- correction path is unclear
- workflow confidence drops

**Fix applied:**
- added explicit **"✏️ اصلاح خرید"** action directly on existing real-buy rows
- this reuses the existing correction path (`cmpBuy`) which already replaces the old purchase for that item and updates payable logic via `ptfPayableUpsert`

**Status:** fixed

---

### 2) Techno-commercial (TC) offers had a serious financial UI inconsistency
**Finding:**
`TC` offers were treated as financial offers in multiple computations, but the line-item editor in `offers.js` rendered price columns only for `CO`, not `TC`.

**Why this matters:**
This can directly explain symptoms like:
- advance payment showing `0`
- total values not behaving as expected
- financial fields on TC behaving inconsistently

**Root cause:**
`offRenderItems()` used:
- `var isCO = _offState.kind === 'CO';`

while multiple other parts of the system already treated `TC` as financial.

**Fix applied:**
- item grid financial behavior now applies to both:
  - `CO`
  - `TC`
- validity date UI/save path was also aligned for `TC`

**Status:** fixed

---

### 3) Advance payment correction was available in receivables, but not visible enough in the sales-file workflow
**Finding:**
The data-level edit path existed (`ptfAdvanceOpen(...)`), but workflow visibility inside post-award/sales-file context was weak.

**Fix applied:**
- added explicit **"💰 اصلاح پیش‌پرداخت"** action in the sales-file real-buy workflow panel when a winning offer exists

**Status:** fixed

---

### 4) Issued cheques were not restricted to the creator in reminder view
**Finding:**
The cheque module (`cheques.js`) was branded as a personal module, but the display logic used all cheque records, not only the current user's records.

**Risk:**
- other users could see issued cheques that were not theirs
- privacy and operational ownership issue

**Fix applied:**
- reminder-panel cheque list now shows only current user's cheques
- pass/delete controls enforce creator ownership

**Status:** fixed

---

## Important Workflow Behaviors Confirmed

### Archive: adding documents after archive
This is already supported for privileged roles:
- `admin`
- `chairman`
- `commercial`
- `ceo`

There is also change logging on archived project document modifications.

### Archive: lost/no-invoice cases
Archived projects with `closeKind = lost` are intentionally locked against later document additions for all users.
This is a design choice, not an accidental bug.

### Direct project costs after archive
**Gap still exists:**
The current workflow strongly supports direct project costs while the record is an active sales file (`deal`), but there is no equally explicit and mature path for **post-archive warranty/service costs** to continue accumulating in the archived project as financial events.

This is not a one-line bug; it is a **workflow design gap** and should be handled in the development phase.

---

## Expert Assessment of Remaining Risks

These are now more in the category of **phase-development hardening**, not immediate blocking bugs:

1. **Post-archive cost lifecycle**
   - warranty costs / post-delivery service costs on archived projects need a first-class workflow

2. **Cross-module correction transparency**
   - when a real buy / advance / project cost changes, the user should clearly understand where downstream numbers update

3. **Process dashboards**
   - sales file could benefit from a clearer “financial integrity strip” showing:
     - advance status
     - invoice status
     - real-buy coverage
     - cost coverage
     - archive readiness

---

## My Confidence After This Review

### I am now comfortable saying:
The system is no longer in the state of “hidden serious defects everywhere” that the previous delivery suggested.

### More precise statement:
- critical deploy/cache/data-loss defects were already handled in earlier rounds
- reminder/date/shareholder corrections were handled
- this workflow pass fixed additional process-critical issues
- what remains is mostly **process hardening and feature maturity**, not obvious silent corruption in the reviewed paths

---

## Recommendation

At this point, it is reasonable to move into the **development phase**, with the next development stream focused on:

1. **post-archive finance / warranty / after-sales corrections**
2. **workflow hardening for sales file financial visibility**
3. **better correction UX for downstream-linked data**

---

## Files touched in this workflow review round

- `crm/buycompare.js`
- `crm/offers.js`
- `crm/cheques.js`
- plus prior audited files from earlier rounds

---

## Final Bottom Line

Your concern about the overall workflow was justified.
There were real workflow design and correction-path issues.

After this review and remediation pass:
- the workflow is significantly more trustworthy
- the corrected package is suitable for entering the next development phase
- but the next phase should be **targeted process hardening**, not random feature expansion
