#!/usr/bin/env bash
# =============================================================================
# ci-gate-step.sh — گیت CI قبل از FTP (ROADMAP-THIN-CLIENT-MAXIMAL → T0-3)
# =============================================================================
# چرا این فایل وجود دارد: تا v34.8.34، گیت CI (‎`run-ci-gate.js`‎ + arch-guard) فقط «دستی/محلی»
# اجرا می‌شد و هیچ workflow آن را صدا نمی‌زد (یافتهٔ F-1 در
# ARENA-THIN-CLIENT-STATUS-AUDIT-2026-08-28.md). نتیجه: هر کامیت می‌توانست بایپس
# localStorage (تخلف A10) یا ناهماهنگی نسخه را بدون مانع وارد main/staging کند.
#
# منطق در مخزن نگه داشته می‌شود (قابل تست محلی) تا YAML گیت‌هاب فقط صدا بزند:
#   - name: CI gate (testers + arch-guard) — pre-FTP
#     env:
#       PTF_GATE_POLICY: ${{ vars.CI_GATE_POLICY || 'block' }}
#     run: bash _tools/ci/ci-gate-step.sh
#
# رفتار:
#   • گیت = node _tools/uat/run-ci-gate.js (خودش arch-guard + node --check + php -l را هم اجرا می‌کند)
#   • خروجی کامل چاپ می‌شود؛ خط جمع‌بندی «=== CI gate: N PASS / M FAIL ===» استخراج می‌شود
#   • نبودِ خط جمع‌بندی = شکست (حتی با exit 0) — ضدِ «پاسِ گمراه‌کننده»
#   • سیاست block (پیش‌فرض) ⇒ قرمز = توقف استقرار؛ سیاست warn ⇒ فقط ::warning:: و ادامه
#
# درِ اضطراری: متغیر Actions با نام CI_GATE_POLICY مقدار warn ⇒ گیت هشدار می‌دهد ولی متوقف نمی‌کند.
# تست: bash _tools/ci/ci-gate-step.sh --self-test
# =============================================================================
set -uo pipefail

SCRIPT_PATH="$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || printf '%s' "${BASH_SOURCE[0]}")"

summary() {
  [ -n "${GITHUB_STEP_SUMMARY:-}" ] || return 0
  [ -w "${GITHUB_STEP_SUMMARY}" ] || return 0
  printf '%s\n' "$*" >>"${GITHUB_STEP_SUMMARY}"
}

# ---------- اجرای واقعی ----------
main() {
  local root="${1:?root}" policy="${2:-block}" cmd="${3:-node _tools/uat/run-ci-gate.js}"
  local log out status=0 pass_n=0 fail_n=0 counts=""

  echo "── ci-gate-step · root=${root} · policy=${policy} ──"
  log="$(mktemp "${TMPDIR:-/tmp}/ptf-ci-gate-XXXXXX.log")"

  ( cd "$root" && bash -c "$cmd" ) >"$log" 2>&1
  status=$?
  out="$(cat "$log")"
  rm -f "$log"

  counts="$(printf '%s\n' "$out" | sed -n 's/^=== CI gate: \([0-9]\{1,\}\) PASS \/ \([0-9]\{1,\}\) FAIL ===$/\1 \2/p' | tail -1)"
  if [ -n "$counts" ]; then
    pass_n="${counts%% *}"; fail_n="${counts##* }"
    [ "$status" -ne 0 ] && [ "$fail_n" -eq 0 ] && fail_n=1   # exit غیرصفر یعنی چیزی خراب است
    [ "$status" -eq 0 ] && [ "$fail_n" -ne 0 ] && status=1   # شمارش قرمز حتی با exit صفر ⇒ شکست
  elif [ "$status" -eq 0 ]; then
    status=70
    out="${out}"$'\n'"⛔ خط جمع‌بندی «=== CI gate: N PASS / M FAIL ===» پیدا نشد — گیت ناقص اجرا شده (شکست حساب می‌شود)."
  fi

  printf '%s\n' "$out"

  if [ "$status" -eq 0 ]; then
    summary "| گیت CI (pre-FTP) | ✅ سبز — ${pass_n} PASS / 0 FAIL · سیاست \`${policy}\` |"
    echo "ci-gate-step: PASS (${pass_n} تستر سبز)"
    return 0
  fi

  echo "ci-gate-step: FAIL exit=${status} pass=${pass_n} fail=${fail_n}"
  if [ "$policy" = "warn" ]; then
    echo "::warning title=گیت CI قرمز (سیاست warn)::${pass_n} PASS / ${fail_n} FAIL — استقرار ادامه یافت؛ این حالت باید موقتی باشد"
    summary "| گیت CI (pre-FTP) | ⚠️ ${pass_n} PASS / ${fail_n} FAIL — سیاست \`warn\`: استقرار ادامه یافت |"
    return 0
  fi

  echo "::error title=گیت CI قرمز — استقرار مسدود شد::${pass_n} PASS / ${fail_n} FAIL (exit=${status}) — جزئیات در لاگ همین گام"
  summary "| گیت CI (pre-FTP) | ⛔ ${pass_n} PASS / ${fail_n} FAIL — استقرار مسدود شد (exit=${status}) |"
  summary ""
  summary '```'
  printf '%s\n' "$out" | grep -E '^( • |  ✘ |⛔|FAIL )' | head -80 | summary_from_stdin
  summary '```'
  return 1
}

summary_from_stdin() {
  [ -n "${GITHUB_STEP_SUMMARY:-}" ] || { cat >/dev/null; return 0; }
  [ -w "${GITHUB_STEP_SUMMARY}" ] || { cat >/dev/null; return 0; }
  cat >>"${GITHUB_STEP_SUMMARY}"
}

# ---------- خودآزمون ----------
self_test() {
  local tmp rc=0 root
  tmp="$(mktemp -d "${TMPDIR:-/tmp}/ptf-gate-selftest-XXXXXX")" || { echo "mktemp failed"; return 2; }
  trap 'rm -rf "$tmp"' RETURN
  root="$(cd "$(dirname "$SCRIPT_PATH")/../.." && pwd)"

  printf '#!/usr/bin/env bash\nprintf "=== CI gate: 150 PASS / 0 FAIL ===\\n"\nexit 0\n' >"$tmp/ok.sh"
  printf '#!/usr/bin/env bash\nprintf " • crm/x.js missing\\n=== CI gate: 149 PASS / 1 FAIL ===\\n"\nexit 1\n' >"$tmp/bad.sh"
  printf '#!/usr/bin/env bash\nprintf "no summary line here\\n"\nexit 0\n' >"$tmp/silent.sh"
  printf '#!/usr/bin/env bash\nprintf "boom\\n"\nexit 3\n' >"$tmp/crash.sh"
  printf '#!/usr/bin/env bash\nprintf "=== CI gate: 148 PASS / 2 FAIL ===\\n"\nexit 0\n' >"$tmp/liar.sh"
  chmod +x "$tmp"/*.sh

  check() { # $1=توضیح $2=exit انتظار $3=فیکسچر $4=سیاست
    local got
    ( cd "$root" && PTF_GATE_POLICY="$4" CI_GATE_CMD="bash $tmp/$3" bash "$SCRIPT_PATH" ) >/dev/null 2>&1
    got=$?
    if [ "$got" = "$2" ]; then echo "PASS $1 [exit=$got]"; else echo "FAIL $1 — expected exit=$2 got=$got"; rc=1; fi
  }

  check "گیت سبز ⇒ exit 0"                    0 ok.sh     block
  check "گیت قرمز + سیاست block ⇒ exit 1"      1 bad.sh    block
  check "گیت قرمز + سیاست warn ⇒ exit 0"       0 bad.sh    warn
  check "بدون خط جمع‌بندی ⇒ شکست"              1 silent.sh block
  check "کرش گیت ⇒ شکست"                       1 crash.sh  block
  check "«دروغ‌گوی سبز» (exit0 ولی FAIL>0) ⇒ شکست" 1 liar.sh block
  check "سیاست نامعتبر ⇒ exit 2"               2 ok.sh     nonsense

  echo "──"
  if [ "$rc" = 0 ]; then echo "SELF-TEST: ALL PASSED (ci-gate-step)"; else echo "SELF-TEST: FAIL"; fi
  return "$rc"
}

# ---------- مسیر اصلی ----------
if [ "${1:-}" = "--self-test" ]; then
  self_test
  exit $?
fi
if [ "${1:-}" = "--policy" ]; then
  PTF_GATE_POLICY="${2:-block}"
  shift 2 || true
fi

ROOT_DIR="$(git -C "$(dirname "$SCRIPT_PATH")" rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT_DIR" ] || ROOT_DIR="$(cd "$(dirname "$SCRIPT_PATH")/../.." && pwd)"

POLICY="${PTF_GATE_POLICY:-block}"
if [ "$POLICY" != "block" ] && [ "$POLICY" != "warn" ]; then
  echo "⛔ PTF_GATE_POLICY باید block یا warn باشد (گرفته شد: $POLICY)"
  exit 2
fi
main "$ROOT_DIR" "$POLICY" "${CI_GATE_CMD:-node _tools/uat/run-ci-gate.js}"
exit $?
