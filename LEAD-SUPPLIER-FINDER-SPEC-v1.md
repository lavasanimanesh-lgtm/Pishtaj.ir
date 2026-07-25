# Lead & Supplier Finder Module — Product / Architecture Specification v1

Date: 2026-07-12
Status: Drafted for approval before implementation
Scope owner: CRM product architecture

---

## 1) Goal
Design a CRM module that can intelligently discover:

1. **valuable customer leads**
2. **credible suppliers**

from public, reliable, recent, and relevant sources, then present them for human review and, if approved, register them into CRM.

This module must **not** behave like a blind scraper.
It must behave like a **market-intelligence assistant with explainability, scoring, deduplication, and human approval**.

---

## 2) Two Core Submodules

### A. Lead Finder
Purpose:
- discover **high-value potential customers / projects / buyers / EPC actors / plant operators / contractors**
- identify companies that are likely to issue RFQs, procure equipment, or run projects related to the user’s requested scope

### B. Supplier Finder
Purpose:
- discover **credible candidate suppliers / manufacturers / distributors / integrators**
- for a requested equipment family or specific item
- with evidence of relevant technical capability, product fit, or market activity

---

## 3) High-Level Principles

### Mandatory principles
- no blind auto-registration
- no invented facts
- no low-trust opaque scoring
- no registration without human review/approval
- no hidden data origin
- no use of unlawful/private/non-public data

### System must always provide
- source links
- evidence snippets
- confidence / score
- reason for recommendation
- duplicate detection result
- recommended CRM action

---

## 4) Lead Finder — Problem Definition

### Inputs
User must be able to define one or more of these:
- target industry
- product/equipment family
- keywords
- project type
- geography
- time window (default: last 12 months)
- target company types:
  - owner/operator
  - EPC contractor
  - subcontractor
  - consultant
  - manufacturer-buyer
  - plant buyer / procurement department

### Example intent
- find companies active in gas-phase development
- find steel companies with repeated tenders in the last year
- find petrochemical operators expanding capacity
- find EPCs likely to issue instrumentation/piping/valve RFQs

---

## 5) Supplier Finder — Problem Definition

### Inputs
User must be able to define:
- equipment type
- detailed technical keywords
- standards
- materials
- brand preferences / exclusions
- geography / logistics preference
- domestic / foreign preference
- exact requested item or request reference

### Example intent
- find reliable suppliers for control valves for gas service
- find manufacturers/distributors of specific pressure transmitters
- find suppliers with past exposure to certain brands / standards

---

## 6) Approved Source Families
This module should work only on **approved source families**.

### A. Lead source families
1. public official company announcements
2. public project award announcements
3. public industrial news portals
4. public procurement / tender announcements
5. public exchange / disclosure platforms
6. public operator / EPC / contractor newsrooms
7. public government / ministry / industry organization releases

### B. Supplier source families
1. official manufacturer websites
2. official distributor / representative sites
3. vendor approval / qualification announcements
4. public procurement participation records
5. public industrial directories
6. public product catalogs / datasheets
7. public certifications / standards / accreditations

### C. Source governance rule
Each source must be classified before production use by:
- trust level
- update frequency
- parsing difficulty
- legal/operational acceptability

---

## 7) Source Trust Model
Each discovered lead/supplier must be traceable to source quality.

### Trust classes
- **T1 — official primary source**
  - company itself / official project owner / official exchange / official procurement source
- **T2 — strong secondary source**
  - recognized industrial news outlet / credible public market intelligence source
- **T3 — weak supporting source**
  - third-party directory / lower-confidence listing / non-authoritative mention

### Rule
- no candidate should be auto-promoted to “valuable/credible” based only on T3
- T3 may support, but should not be the sole basis

---

## 8) Lead Discovery Pipeline

1. query planning
2. source selection by trust family
3. content collection
4. article/page/document parsing
5. company/entity extraction
6. project/action extraction
7. role inference:
   - owner / EPC / operator / buyer / contractor
8. equipment relevance inference
9. recency evaluation
10. duplicate detection against CRM
11. scoring
12. evidence packaging
13. human review queue
14. optional CRM registration

---

## 9) Supplier Discovery Pipeline

1. query planning by equipment request
2. approved-source selection
3. source crawling / retrieval
4. product/manufacturer capability extraction
5. standard/brand/spec fit detection
6. domestic/foreign classification
7. evidence extraction
8. duplicate detection against CRM supplier base
9. scoring
10. human review queue
11. optional CRM supplier registration

---

## 10) Lead Scoring Model
Score should be explainable, not black-box only.

### Suggested dimensions
- recency
- project relevance
- equipment relevance
- procurement probability
- company scale / seriousness
- source trust
- role strength in project
- repeated activity signal
- geographic fit
- strategic-fit to PTF portfolio

### Output
- overall lead score
- dimension-level subscores
- explanation text in Persian

---

## 11) Supplier Scoring Model
### Suggested dimensions
- technical fit to requested equipment
- product specificity
- standards compliance evidence
- brand/manufacturer/distributor credibility
- source trust
- procurement-history signal
- logistics/geography fit
- domestic/foreign suitability
- completeness of public technical information
- certification/approval evidence

### Output
- overall supplier score
- dimension-level subscores
- explanation text in Persian

---

## 12) Deduplication Rules
Both leads and suppliers must be checked before CRM registration.

### Matching candidates against CRM should use
- normalized company name
- English/Persian variants
- website domain
- phone numbers
- email domain
- national/company identifiers if available
- known aliases

### Result classes
- exact duplicate
- probable duplicate
- related but distinct entity
- new entity

### Human decision
If probable duplicate:
- user must decide whether to:
  - merge
  - ignore
  - register as new

---

## 13) Lead Finder Output
For each candidate lead, show:
- company name
- role in market/project
- why it is relevant
- evidence snippet(s)
- source trust level
- source links
- activity date(s)
- suggested lead score
- recommended next action
- duplicate check result

### Actions
- save as lead
- dismiss
- mark for later review
- merge with existing lead/customer

---

## 14) Supplier Finder Output
For each candidate supplier, show:
- supplier/company name
- supplier type (manufacturer/distributor/integrator/etc.)
- matching equipment/product area
- standards/brand fit
- evidence snippet(s)
- source trust level
- source links
- suggested supplier score
- domestic/foreign suggestion
- duplicate check result

### Actions
- save as supplier
- dismiss
- mark for later review
- merge with existing supplier

---

## 15) Human Review Requirement
This module must always remain **human-in-the-loop**.

### No direct auto-registration rule
The system may discover, score, and prepare candidates.
But actual CRM registration must require user approval.

### Exception (optional future phase)
Only after strong product maturity and per-role permission policy, an opt-in auto-draft queue may be considered.
Not in phase 1.

---

## 16) UX Requirements

### Lead Finder UI
- search form
- filters
- source/time filters
- result cards
- evidence panel
- score explanation
- duplicate status
- one-click register button with confirmation

### Supplier Finder UI
- request/equipment selector
- search filters
- result cards
- evidence panel
- fit explanation
- score explanation
- duplicate status
- one-click register button with confirmation

### Common UX rules
- must be fast
- must support deep rerun / refine query
- must support saving review sessions
- must support comparing candidates
- must support export of candidate shortlist

---

## 17) Audit and Traceability
Every important action must be audit-logged, including:
- search request
- selected source set
- candidate discovery
- candidate scoring
- human approval/rejection
- CRM registration
- merge decision
- manual override

---

## 18) Data Model Expectations
Suggested logical objects:
- discovery jobs
- source documents/pages
- extracted entities
- evidence snippets
- scored lead candidates
- scored supplier candidates
- dedup results
- review decisions
- registration actions

---

## 19) Risk Controls

### Must prevent
- hallucinated company/project relationships
- fake vendor credibility
- weak-source-only recommendations
- stale, irrelevant, or non-industrial lead pollution
- supplier spam entering master database

### Mandatory rule
If confidence is weak or evidence is insufficient, system must say so clearly and avoid strong recommendation language.

---

## 20) Recommended Delivery Phases

### Phase 1 — Framework and controlled discovery
- source governance
- query pipeline
- evidence extraction
- candidate scoring
- dedup check
- manual CRM registration

### Phase 2 — Deeper intelligence
- richer role inference
- project-value inference
- supplier-fit reasoning improvements
- better comparison views

### Phase 3 — Optimization
- analyst feedback loops
- score calibration from CRM outcomes
- ranking improvements

---

## 21) Suggested Epic / Story Family
This should be treated as a dedicated development family, for example:
- `Lead & Supplier Discovery / Market Intelligence`

Suggested story groups:
- source governance
- lead discovery
- supplier discovery
- scoring
- dedup/merge
- review queue
- CRM registration
- audit/reporting

---

## 22) Final Product Rule
This module is acceptable only if it helps users discover:
- **valuable leads**
- **credible suppliers**

with:
- trustworthy source evidence
- transparent logic
- low noise
- safe human approval gates

It must behave like a **specialized industrial intelligence assistant**, not a noisy generic web scraper.
