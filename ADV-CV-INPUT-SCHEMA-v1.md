# Advanced Control Valve Input Schema — v1

**Date:** 2026-07-21  
**Status:** Locked preview implemented in `/tools/`; calculation engine not yet enabled.  
**Scope:** Input schema and report outline for Advanced Control Valve Sizing.

---

## 1) Purpose

This document defines the required input structure for the future non-free Advanced Control Valve Sizing tool. The current implementation exposes the schema as a locked preview only.

---

## 2) Input groups

### 2.1 Project and tag data

- Project name
- RFQ / inquiry number
- Tag number
- Service description
- Quantity
- Revision
- Prepared by / company

### 2.2 Operating cases

The tool must support at least three operating cases:

- Minimum flow
- Normal flow
- Maximum flow

For each case:

- Flow rate
- Flow unit
- Upstream pressure P1
- Downstream pressure P2
- Temperature

### 2.3 Fluid data

For liquid:

- Fluid name
- Specific gravity / density
- Viscosity
- Vapor pressure Pv
- Critical pressure Pc

For gas / steam:

- Molecular weight
- Compressibility Z
- Specific heat ratio k
- Flow basis
- Steam condition if applicable

### 2.4 Piping data

- Inlet pipe size and schedule / ID
- Outlet pipe size and schedule / ID
- Reducer / expander presence
- Velocity limits

### 2.5 Valve data

- Valve type
- Candidate body size
- Pressure class
- Body material
- Trim material
- Flow characteristic
- FL / Fd / Xt
- Leakage class

### 2.6 Actuator data

- Fail action
- Shutoff differential pressure
- Seat / plug diameter
- Packing friction
- Seating force
- Safety factor

### 2.7 Brand library

Initial candidate brands:

- Fisher / Emerson
- Samson
- Masoneilan / Baker Hughes
- Flowserve Valtek
- Neles / Metso

Exact model recommendation requires verified vendor data.

---

## 3) Completeness rule

The future tool must not generate a full report until required fields are complete.

Minimum required for a liquid preliminary run:

- Flow
- P1 / P2
- Temperature
- SG or density
- Pv
- Pc
- FL

If missing:

- Show missing data checklist
- Allow saving draft
- Block final report

---

## 4) Paid English report outline

The report must be in English and include:

1. Cover page and report ID
2. Design basis
3. Input summary
4. Calculation method
5. Min / normal / max case tables
6. Cv / Kv results
7. Choked flow check
8. Cavitation / flashing assessment
9. Velocity checks
10. Actuator sizing shell
11. Brand / series candidate matrix
12. Charts
13. Formula trace
14. Assumptions and missing data
15. Warnings and limitations
16. Disclaimer
17. RFQ conversion CTA

---

## 5) Next implementation phase

Recommended next sprint:

```text
ADV-CV-SCHEMA-UI-001
```

Scope:

- Create a real locked input form UI.
- Allow entering schema data but keep calculation/report locked.
- Add completeness checklist.
- Do not generate PDF yet.

---

## 6) Implemented preliminary calculation phase — ADV-CV-PRELIM-CALC-001

**Implemented in:** v31.7.49  
**Scope:** licensed/session-granted users only; on-screen preliminary liquid normal-case calculation; no final report and no PDF.

Formula basis for the current preliminary run:

```text
ΔP = P1 - P2
FF = 0.96 - 0.28 × sqrt(Pv / Pc)
ΔP_choked = FL² × (P1 - FF × Pv)
choked = ΔP >= ΔP_choked
Kv_nonchoked = Q × sqrt(SG / ΔP)
Kv_choked = Q × sqrt(SG) / (FL × sqrt(P1 - FF × Pv))
Cv = 1.156 × Kv
cavitation margin = P2 - Pv
severity = ΔP / ΔP_choked
```

Assumptions in this phase:

- Liquid only.
- Normal operating case only.
- Q in m³/h.
- P1, P2, Pv and Pc on an absolute bar(a) basis.
- SG relative to water.
- FL from vendor/datasheet.
- No viscosity correction, reducer/pipe velocity correction, noise calculation, actuator sizing or final brand/model selection yet.

The output is explicitly marked as preliminary and remains separate from the future non-free English report engine.

---

## 7) Implemented liquid multi-case phase — ADV-CV-LIQUID-MULTICASE-001

**Implemented in:** v31.7.55  
**Scope:** licensed/session-granted users only; on-screen preliminary liquid calculation for Min / Normal / Max cases; no final report and no PDF.

Additions in this phase:

- Calculation of any entered Min / Normal / Max liquid case.
- Normal case remains mandatory; Min/Max are optional but recommended for envelope review.
- Per-case output table:
  - Q
  - P1 / P2
  - ΔP
  - ΔP_choked
  - Choked-flow flag
  - Kv
  - Cv
  - Severity
  - Optional opening percentage when rated/candidate Cv is entered
- Governing case selection by maximum calculated Cv.
- Preliminary selected Cv suggestion = governing Cv × 1.10.
- Formula trace for governing case.

Limitations retained:

- Liquid only.
- No gas / steam / two-phase calculation yet.
- No viscosity correction beyond warning.
- No reducer / pipe velocity correction yet.
- No actuator sizing.
- No final brand/model selection.
- No final English PDF/report generation.

---

## 8) Implemented pipe velocity / reducer preliminary phase — ADV-CV-VELOCITY-REDUCER-001

**Implemented in:** v31.7.56  
**Scope:** licensed/session-granted users only; on-screen preliminary liquid pipe velocity and reducer sanity checks; no final report and no PDF.

Additions in this phase:

- Parse inlet/outlet pipe entries in common preliminary formats:
  - `NPS 4`
  - `4 in`
  - `DN100`
  - `ID 102 mm`
  - bare millimetre values when unambiguous
- Calculate preliminary line velocity per liquid case:

```text
v = (Q / 3600) / (π × (ID/1000)^2 / 4)
```

- Display `Vin` and `Vout` in m/s for Min / Normal / Max cases.
- Show reducer ratio:

```text
reducer ratio = min(inlet ID, outlet ID) / max(inlet ID, outlet ID)
```

- Warn for:
  - velocity above 3 m/s as caution
  - velocity above 5 m/s as high
  - velocity below 0.3 m/s as low/rangeability review
  - reducer / expander ratio below 0.8, requiring future Fp / FLp correction

Limitations retained:

- IDs are preliminary estimates unless explicit ID is entered.
- NPS mapping is approximate and should be replaced by project pipe class/vendor data in final report.
- Fp / FLp reducer correction is not yet applied numerically.
- No reducer/noise/final valve-size correction yet.
- No final English PDF/report generation.

---

## 9) Implemented cavitation / flashing severity phase — ADV-CV-CAVITATION-SEVERITY-001

**Implemented in:** v31.7.57  
**Scope:** licensed/session-granted users only; on-screen preliminary liquid cavitation/flashing severity classification; no final report and no PDF.

Additions in this phase:

- Per-case cavitation/flashing risk class:
  - Low
  - Watch
  - Medium risk
  - High cavitation risk
  - Choked / severe
  - Flashing likely
- Overall cavitation risk summary based on the highest-risk operating case.
- Per-case risk badge in the Min / Normal / Max table.
- Preliminary recommendations for severe or flashing conditions:
  - anti-cavitation trim review
  - staged pressure drop review
  - downstream pressure / ΔP mitigation review
  - vendor data check for FL, Fp, FLp and noise limits

Important limitation:

This is not a final IEC/ISA cavitation/noise calculation. Final report still requires verified vendor data, project limits and server-side report generation.

---

## 10) Implemented actuator sizing shell phase — ADV-CV-ACTUATOR-SHELL-001

**Implemented in:** v31.7.58  
**Scope:** licensed/session-granted users only; on-screen preliminary actuator thrust shell; no final report and no PDF.

Additions in this phase:

- New actuator inputs:
  - actuator type / preliminary family
  - instrument air supply pressure
  - actuator safety factor
  - shutoff differential pressure
  - seat / plug diameter
  - packing / friction force
  - fail action
- Preliminary thrust model:

```text
seat area = π × d² / 4
fluid force = ΔP_shutoff × 0.1 × seat area
required thrust = (fluid force + packing/friction) × safety factor
equivalent pneumatic area = required thrust / (supply barg × 0.1)
equivalent diaphragm diameter = sqrt(4 × area / π)
```

- If shutoff ΔP is missing, max calculated operating ΔP is used as a fallback with warning.
- If seat / plug diameter is missing, the main valve calculation still runs but actuator shell is marked incomplete.
- Rotary valves show a warning that torque sizing is not covered by this thrust-equivalent shell.
- Fail Close / Fail Open cases show direction/spring-action review warnings.

Important limitations:

- This is not final actuator sizing.
- Spring sizing, torque sizing, yoke/packing friction model, seating force and vendor actuator selection are not final.
- Final selection must be validated by actuator/valve manufacturer data.

---

## 11) Implemented preliminary noise detail phase — ADV-CV-NOISE-DETAIL-001

**Implemented in:** v31.7.59  
**Scope:** licensed/session-granted users only; on-screen preliminary liquid noise risk screening; no final report and no PDF.

Additions in this phase:

- Per-case preliminary noise risk index.
- Per-case risk classes:
  - Low noise risk
  - Watch noise
  - Medium noise risk
  - High noise risk
  - Severe noise risk
- Overall noise risk summary based on the highest-risk operating case.
- Per-case `Noise risk` badge in the Min / Normal / Max table.
- Preliminary recommendations:
  - low-noise trim review
  - multi-stage trim / staged pressure drop review
  - outlet velocity and pipe size review
  - vendor / IEC 60534-8 detailed noise calculation requirement

Important limitation:

This is not a final dBA calculation. Final acoustic prediction still requires IEC 60534-8 method, acoustic efficiency, pipe schedule, insulation condition, observer distance, valve vendor data and project noise limits.

---

## 12) Implemented English on-screen report preview — ADV-CV-REPORT-PREVIEW-001

**Implemented in:** v31.7.60  
**Scope:** licensed/session-granted users only; on-screen English report preview; no PDF, no download and no final report number.

The preview includes:

1. Project and tag data
2. Design basis
3. Preliminary liquid sizing case results
4. Governing result
5. Actuator sizing shell
6. Preliminary warnings
7. Risk review recommendations
8. Formula trace for governing case
9. Missing / incomplete data
10. Assumptions and limitations

Important limitation:

The preview is intentionally marked `PREVIEW ONLY — NOT A FINAL REPORT`. It is not a contractual design document and must not be used as a final sizing report. PDF export and server-side report generation remain locked for later phases.

---

## 13) Implemented locked structured report payload — ADV-CV-REPORT-DATA-LOCK-001

**Implemented in:** v31.7.61  
**Scope:** licensed/session-granted users only; structured report data prepared in browser memory for future server-side report generation; no PDF, no download and no server submission.

The payload schema is:

```text
ADV-CV-REPORT-PAYLOAD-v1
```

The payload includes:

- report metadata
- entitlement summary
- project and tag data
- grouped inputs
- compact preliminary calculations
- governing case
- risk summaries
- actuator shell
- formula trace
- readiness status
- blocked reasons
- assumptions and limitations
- deterministic checksum

Readiness checks are stricter than the on-screen preliminary calculation and include Min / Normal / Max cases, fluid data, piping data, valve data, actuator data and parseable pipe IDs.

Important limitation:

This payload is still a locked preview payload. It is not submitted to the server, does not consume a paid report quota, does not generate a PDF and does not create a final report number.

---

## 14) Implemented server report draft scaffold — ADV-CV-SERVER-REPORT-SCAFFOLD-001

**Implemented in:** v31.7.62  
**Scope:** licensed/session-granted users only; locked report payload can be submitted to server as a draft; no final report, no PDF, no download and no paid quota consumption.

Server endpoint:

```text
api/tools.php?action=report_draft_create
```

Validation steps:

- verify short-lived tools grant
- validate payload schema `ADV-CV-REPORT-PAYLOAD-v1`
- ensure payload status is `LOCKED_PREVIEW_PAYLOAD`
- ensure `final=false`, `pdf=false`, `download=false`, `serverSideReport=false`
- recompute stable payload checksum server-side
- store only a locked report draft in runtime data

Runtime file:

```text
crm/data/tool_report_drafts.json
```

Important limitation:

This is only a server scaffold for future report generation. It does not generate a final report number, does not create PDF, does not consume license quota and does not unlock online payment.
