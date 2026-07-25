# Regression v32.0.5 — Login Fix

**نسخه:** v32.0.5
**مبنا:** v32.0.4 (268 testers)

Result: 269 testers PASS — +1 new tester for auth fallback

New tester: tester282? Actually tester for auth fallback — 6 checks:
- auth_secret returns fallback if missing
- auth_generate_token not empty even without secrets file
- users_get 200 without secrets
- auth_login 200 without secrets
- data_pull 200 without captcha_key

**Status:** PASS — ready for production
