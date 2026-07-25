# Advanced Engineering Tools Catalog — Specification v1

**Date:** 2026-07-21  
**Status:** Design / locked preview implemented in `tools/`  
**Scope:** Roadmap of paid advanced tools for industrial engineers in Piping, Electrical, Instrumentation, Pumps, Flow Measurement and Process Equipment.

---

## 1) Commercial policy

- Public/free users get **initial on-screen calculations only**.
- PDF reports, professional charts, formula trace and project-ready outputs require activation.
- Until online payment gateway is implemented, activation is by manual invoice/license code.
- PTF staff can use internal staff license codes free of charge.

---

## 2) Tool families

### 2.1 Control Valve Advanced

Priority: P0 / first paid tool.

Planned scope:

- Liquid / Gas / Steam sizing
- Min / Normal / Max operating cases
- Cv / Kv
- Choked flow
- Cavitation / flashing
- Velocity checks
- Actuator shell
- Valve characteristic
- Brand / series candidate matrix
- English standard report with charts

### 2.2 Piping Advanced

Planned scope:

- Pipe velocity
- Pressure drop
- Schedule / wall thickness selection
- MAWP / B31.3 quick check
- Corrosion allowance
- Pipe class selection aid
- MTO / weight report

### 2.3 Pump Selection

Planned scope:

- Flow / head
- NPSHa / NPSHr margin
- Power estimate
- Efficiency assumptions
- Pump family recommendation
- Curve / operating point report

### 2.4 Flow Meter / Orifice

Planned scope:

- Velocity
- Reynolds number
- Beta ratio
- Differential pressure
- Orifice preliminary sizing
- Meter type selection matrix

### 2.5 Electrical Engineering

Planned scope:

- Cable sizing
- Voltage drop
- Short-circuit withstand
- Transformer sizing
- Switchgear selection checks
- Motor feeder basics

### 2.6 Instrumentation

Planned scope:

- Transmitter range selection
- DP level calculations
- Accuracy / turndown checks
- Control loop preliminary checks
- SIL checklist placeholder

---

## 3) Report standard

Paid reports should be in English and include:

1. Cover / report ID
2. Project and tag data
3. Input summary
4. Design basis
5. Calculation tables
6. Formula trace
7. Charts
8. Warnings / assumptions
9. Brand or model candidate table where vendor data exists
10. Disclaimer
11. RFQ conversion CTA

---

## 4) Locking rule

Advanced tools are visible as a roadmap and commercial offer, but actual execution/reporting remains locked until entitlement is confirmed.

```text
Free preview → visible
Advanced full run → license required
PDF report → license required
Staff use → internal staff license code
```

---

## 5) Next implementation recommendation

Next low-risk sprint after catalog preview:

```text
ADV-CV-INPUT-SCHEMA-001
```

Scope:

- Build locked advanced control valve input schema UI.
- No final calculation yet.
- No paid PDF yet.
- Validate input completeness and show missing fields.
