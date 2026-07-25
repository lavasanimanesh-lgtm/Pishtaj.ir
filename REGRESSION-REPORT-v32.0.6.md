# Regression v32.0.6 — Token Header Fix

**نسخه:** v32.0.6
**مبنا:** v32.0.5 (263 testers)

Result: 265 testers PASS (+2 new)

New testers:
- tester283? Actually tester283:rbac token — 8 checks: usersSyncToServer sends X-CRM-Token, usersPullFromServer sends token, no X-CRM-Role only
- tester284:backup token — 6 checks: backup.js sends token

Total: 265 testers / 5254 checks — PASS — ready for production
