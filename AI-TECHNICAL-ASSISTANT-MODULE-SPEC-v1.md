# AI Technical Assistant Module — CRM Specification v1

Date: 2026-07-12
Status: Approved working specification based on client requirements
Language of source requirement: Persian

---

## 1) Goal
Build an **AI Technical Assistant** inside CRM that, after selecting a supply request, can:

1. Analyze all related technical information and produce a **Persian technical summary**
2. Produce a **formal English Technical Proposal** only after user confirmation

---

## 2) Input Scope
The module must read and analyze:

- request form data
- user-entered textual notes
- all attached files, including:
  - Datasheet
  - Specification
  - RFQ
  - Requisition
  - Drawing
  - P&ID
  - Vendor List
  - PDF
  - Excel
  - Word
  - images

---

## 3) Stage 1 — Request Analysis

### Processing pipeline
1. load all request-related metadata
2. load all related attachments
3. extract text/content from each source
4. normalize and deduplicate extracted facts
5. identify equipment type/category
6. identify critical process/design data
7. detect missing or contradictory information
8. generate procurement and technical recommendations

### Required Persian output
- equipment introduction
  - equipment type
  - application
  - probable installation/service context
  - mentioned standards
- key technical data
  - size
  - class
  - material
  - pressure
  - temperature
  - flow
  - fluid
  - other key parameters
- ambiguity / missing data list
- supply path recommendation
  - suitable brands
  - likely manufacturers
  - acceptable alternatives
  - important RFQ notes

---

## 4) Stage 2 — Technical Proposal Preparation
This stage is gated and must run only after user confirmation.

UI button:
- `Prepare Technical Proposal`

### Rule
LLM must NOT generate engineering calculations directly.
Engineering calculations must be produced by a **separate engineering calculation engine**.

---

## 5) Engineering Calculation Engine

### Approved clarification — mandatory calculation depth
For every equipment family, calculations must be:
- based on the **relevant engineering standards, codes, and accepted vendor/manufacturer sizing practice** for that equipment
- **complete for that equipment type**, not partial or cosmetic
- sufficient for a real technical recommendation, not just a generic summary

In other words:
- if it is a **control valve**, all normally required control-valve engineering checks and sizing steps must be performed
- if it is a **pump**, all pump-related hydraulic/selection calculations required for a real recommendation must be performed
- if it is an **on-off valve**, all required valve selection / pressure / torque / sizing / operating suitability checks must be performed
- if it is a **flow meter**, all relevant sizing / velocity / pressure-drop / meter-selection calculations must be performed
- and likewise for each supported equipment category

The module must therefore be **equipment-aware** and run the full calculation package appropriate to that equipment family.

### Must support connection to calculation engines for examples such as:

#### Control Valve
- Cv Calculation
- Valve Sizing
- Noise Prediction
- Choked Flow Check
- Cavitation Check
- Actuator Sizing

#### Flow Meter
- Orifice Sizing
- Flow Velocity Calculation
- Reynolds Number
- Pressure Drop Calculation
- Meter Selection

#### PSV
- Relief Load Calculation
- Orifice Sizing

#### Heat Exchanger
- Duty Calculation
- LMTD
- Area Estimation

#### Pipe
- Velocity
- Pressure Drop
- Schedule Selection

### Hard constraints
- no approximate numbers without user approval
- no hidden assumptions
- formulas must be traceable
- inputs/outputs must be stored
- results must be reviewable and reproducible

---

## 6) Technical Proposal Output Structure
The proposal must be in **English** and include:

- Executive Summary
- Process Data
- Design Basis
- Engineering Calculations
- Calculation Tables
- Charts and Graphs
- Equipment Selection Logic
- Recommended Model
- Technical Compliance Matrix
- Deviations
- Conclusion

### Output formats
- PDF
- DOCX

Each output must include:
- company logo
- request number
- date
- version number

---

## 7) Charts / Visuals
If sufficient data exists, automatically produce charts such as:
- Pressure vs Flow
- Cv Curves
- Operating Envelope
- Performance Curves

---

## 8) Quality Control Before Final Generation
Before final issue, system must perform:
1. completeness check
2. contradiction check
3. engineering result validation
4. warning generation when critical data is missing

### Mandatory rule
If critical information is missing, final report generation must be blocked.
Instead, system must output a **required-information checklist** for the user.

---

## 9) Architecture Rules
- file-analysis layer must be separated from engineering-calculation layer
- calculation engine must be independent from LLM
- all calculations must be stored in database
- reproducibility is mandatory
- all outputs must be versioned
- all actions must be recorded in audit log

---

## 10) Prohibitions
- using unapproved assumed values
- generating estimated engineering calculations without sufficient data
- generating final report while vital data is incomplete
- replacing engineering engine with direct LLM answers

---

## 11) Proposed CRM Architecture Mapping

### Layer A — Request Ingestion
Suggested module responsibilities:
- collect request metadata
- resolve attachments
- create unified technical case bundle

### Layer B — Document Intelligence
Suggested responsibilities:
- OCR / parsing
- table extraction
- text chunking
- fact extraction
- deduplication
- contradiction detection

### Layer C — Technical Reasoning
Suggested responsibilities:
- classify equipment type
- map required variables per equipment family
- create missing-data checklist
- prepare engineering-engine input package

### Layer D — Engineering Engine
Suggested responsibilities:
- execute deterministic calculations
- store formulas, inputs, outputs
- produce tables/curves

### Layer E — Proposal Composer
Suggested responsibilities:
- combine validated extracted data + calculation outputs
- generate English proposal draft
- export PDF/DOCX
- version outputs

---

## 12) Proposed Data Objects
Suggested storage objects/keys (naming may change during implementation):

- technical cases
- extracted source facts
- file parsing results
- contradiction reports
- missing-data checklists
- calc runs
- calc inputs
- calc outputs
- proposal versions
- generated charts
- audit trail entries

---

## 13) Recommended Implementation Order
1. request bundle and attachment ingestion
2. file parsing and fact extraction
3. Persian technical summary + missing-data checklist
4. approval gate for proposal generation
5. engineering engine adapter layer
6. first equipment family implementation (suggested: control valve)
7. English technical proposal generator
8. PDF/DOCX exporter
9. charts and final QA layer

---

## 14) Approval, Proposal Registration, and Revision Workflow

### Approval gate
After the Persian technical analysis is shown to the user, the user must be able to:
- review the summary
- review missing-data warnings
- review contradictions
- decide whether the case is ready for technical-proposal preparation

### Registration as official technical proposal
If the user confirms the generated technical proposal, the system must be able to:
- register it as the **official Technical Proposal** of that request inside CRM
- assign version / revision number
- store the full generated output, structured extracted facts, calculation package, charts, and metadata
- link it directly to the source request and all related files

### Revision / re-submission loop
If later any of the following occurs:
- client comments are received
- technical corrections are needed
- additional files are uploaded
- missing information becomes available
- the user manually edits request data

then the user must be able to:
- resubmit the request to the AI Technical Assistant
- request **proposal revision**, not just new first-time generation
- preserve prior versions/revisions
- compare old and new versions if needed
- regenerate the technical proposal using the updated information set

### Mandatory behavior
- first approved proposal = base version
- each later approved correction = new revision/version
- all revisions must remain retrievable
- all revision requests and outputs must be audit-logged
- no previous approved engineering run or proposal version may be silently overwritten

## 15) Acceptance Direction
Module is considered acceptable only if:
- it can clearly separate known facts from missing facts
- it does not invent engineering inputs
- it blocks final proposal generation when critical data is incomplete
- it stores engineering runs and proposal versions in a reproducible way
- it records all activity in audit logs

---

## 15) Development Note
This document is treated as the governing scope for the future AI Technical Assistant module unless superseded by a newer client-approved spec.
