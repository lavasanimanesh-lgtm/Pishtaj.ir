#!/usr/bin/env bash
# =============================================================================
# post-deploy-hash-check.sh — گیت صحت استقرار بعد از FTP (ROADMAP-THIN-CLIENT → T0-4)
# =============================================================================
# چرا: حادثهٔ «نسخهٔ مخلوط» (۲۰۲۶-۰۸-۲۷، گزارش ARENA-STORAGE-INDEPENDENCE-RCA-2026-08-26.md):
# index.html جدید روی هاست و فایل‌های js قدیمی — چون هیچ گامی بعد از آپلود بررسی نمی‌کرد
# که «فایل زنده == فایل کامیت». این اسکریپت همان مقایسه را انجام می‌دهد:
#   هش ۵–۶ فایل حیاتیِ زنده (staging/production) با هش همان فایل در working tree
#   (پس از تزریق بنر استیجینگ) مقایسه می‌شود؛ نابرابری = استقرار ناقص/کش‌شده ⇒ شکست.
#
# استفاده در workflow (بعد از گام Deploy via FTP):
#   - name: Post-deploy integrity check (live == commit)
#     env:
#       PTF_GATE_POLICY: ${{ vars.CI_GATE_POLICY || 'block' }}
#     run: |
#       bash _tools/ci/post-deploy-hash-check.sh \
#         --base https://staging.pishtaj.ir \
#         --files "crm/index.html crm/sw.js crm/sales-domain-v2.js crm/leads.js crm/client-server.js api/sales-domain.php"
#
# ورودی‌ها (فلگ > متغیر محیطی > پیش‌فرض):
#   --base URL        پایهٔ محیط (PTF_DEPLOY_BASE)
#   --files "…"       فهرست فایل‌های نسبی نسبت به ریشهٔ مخزن (PTF_DEPLOY_FILES)
#   --retries N       تلاش‌های مجدد برای هر فایل، پیش‌فرض ۵ (انتشار FTP + کش هاست)
#   --sleep S         فاصلهٔ تلاش‌ها به ثانیه، پیش‌فرض 12
#   --timeout S       سقف هر درخواست، پیش‌فرض 25
#   --policy block|warn  (PTF_GATE_POLICY) — warn: فقط هشدار، استقرار قرمز نمی‌شود
#   --no-cache-buster    حذف پارامتر کش‌شکن (برای میزبانی‌ای که query را در کش لحاظ نمی‌کند)
#
# تست: bash _tools/ci/post-deploy-hash-check.sh --self-test
# =============================================================================
set -uo pipefail

SCRIPT_PATH="$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || printf '%s' "${BASH_SOURCE[0]}")"
ROOT_DIR="$(git -C "$(dirname "$SCRIPT_PATH")" rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT_DIR" ] || ROOT_DIR="$(cd "$(dirname "$SCRIPT_PATH")/../.." && pwd)"

BASE="${PTF_DEPLOY_BASE:-}"
FILES="${PTF_DEPLOY_FILES:-crm/sw.js crm/sales-domain-v2.js crm/leads.js crm/client-server.js api/sales-domain.php}"
RETRIES=5
SLEEP_S=12
TIMEOUT=25
POLICY="${PTF_GATE_POLICY:-block}"
CACHE_BUSTER=1
PROBE="${PTF_DEPLOY_PROBE:-0}"
PROBE_PATH="${PTF_DEPLOY_PROBE_PATH:-api/deploy-probe.php}"
EXPECT_VERSION="${PTF_EXPECT_VERSION:-}"
[ "$PROBE" = "1" ] || [ "$PROBE" = "0" ] || PROBE=0
SELF_TEST=0

while [ $# -gt 0 ]; do
  case "$1" in
    --base) BASE="$2"; shift 2 ;;
    --files) FILES="$2"; shift 2 ;;
    --retries) RETRIES="$2"; shift 2 ;;
    --sleep) SLEEP_S="$2"; shift 2 ;;
    --timeout) TIMEOUT="$2"; shift 2 ;;
    --policy) POLICY="$2"; shift 2 ;;
    --probe) PROBE=1; shift ;;
    --probe-path) PROBE=1; PROBE_PATH="$2"; shift 2 ;;
    --expect-version) EXPECT_VERSION="$2"; shift 2 ;;
    --no-cache-buster) CACHE_BUSTER=0; shift ;;
    --self-test) SELF_TEST=1; shift ;;
    *) echo "⛔ فلگ ناشناخته: $1"; exit 2 ;;
  esac
done

sha_of() { # stdin → hash (بدون وابستگی به نام باینری)
  if command -v sha256sum >/dev/null 2>&1; then sha256sum | cut -d' ' -f1
  elif command -v shasum >/dev/null 2>&1; then shasum -a 256 | cut -d' ' -f1
  elif command -v openssl >/dev/null 2>&1; then openssl dgst -sha256 | awk '{print $NF}'
  else return 127; fi
}

sha1_of() { # stdin → sha1 (قالب پروب سرور)
  if command -v sha1sum >/dev/null 2>&1; then sha1sum | cut -d' ' -f1
  elif command -v shasum >/dev/null 2>&1; then shasum | cut -d' ' -f1
  elif command -v openssl >/dev/null 2>&1; then openssl dgst -sha1 | awk '{print $NF}'
  else return 127; fi
}

# ---------- پروب سروری: هش فایل‌های PHP/JS از خودِ هاست (T0-4) ----------
# فایل‌های PHP را نمی‌توان روی HTTP هش خام گرفت (اجرا یا مسدود می‌شوند)، پس
# api/deploy-probe.php فهرست ثابتی از فایل‌های کلیدی را روی سرور هش می‌کند.
check_probe() {
  local base="$1" probe_path="${2:-api/deploy-probe.php}" body tmp status attempt
  local url="$base/${probe_path#/}"
  [ "$CACHE_BUSTER" = 1 ] && url="$url?ptfcb=${GITHUB_RUN_ID:-$(date +%s)}"

  if ! command -v curl >/dev/null 2>&1; then
    echo "::error::curl روی این رانر نیست — پروب صحت استقرار قابل انجام نیست"
    return 2
  fi
  body=""; status=1
  for attempt in $(seq 1 "$RETRIES"); do
    tmp="$(mktemp "${TMPDIR:-/tmp}/ptf-probe-XXXXXX")"
    if curl -fsSL --compressed --max-time "$TIMEOUT" -o "$tmp" "$url" 2>/dev/null && [ -s "$tmp" ]; then
      body="$(cat "$tmp")"; rm -f "$tmp"; status=0; break
    fi
    rm -f "$tmp"
    [ "$attempt" -lt "$RETRIES" ] && { echo "… پروب: پاسخ آماده نیست (تلاش ${attempt}/${RETRIES})"; sleep "$SLEEP_S"; }
  done
  if [ "$status" -ne 0 ]; then
    echo "::error::پروب استقرار خوانده نشد — $url (۴۰۳ ⇒ فایل در allowlist \`api/.htaccess\` نیست؛ ۴۰۴ ⇒ فایل دیپلوی نشده)"
    return 1
  fi

  local declared
  declared="$(printf '%s\n' "$body" | head -1 | sed -n 's/^# ptf-deploy-probe-v1 version=\(v\{0,1\}[0-9.]*\)$/\1/p')"
  if [ -z "$declared" ]; then
    echo "::error::پروب استقرار پاسخ مورد انتظار را نداد (خط اول باید «# ptf-deploy-probe-v1 version=…» باشد) — نسخهٔ PHP روی هاست کهنه است"
    return 1
  fi
  echo "· پروب: نسخهٔ اعلامی سرور = ${declared}"
  if [ -n "$EXPECT_VERSION" ] && [ "$EXPECT_VERSION" != "$declared" ] && [ "v$EXPECT_VERSION" != "$declared" ] && [ "$EXPECT_VERSION" != "${declared#v}" ]; then
    echo "::error::پروب نسخهٔ ${declared} را اعلام کرد، انتظار ${EXPECT_VERSION} — VERSION.json زنده با کامیت یکی نیست"
    return 1
  fi

  local rc=0 line sha bytes rel extra loc
  while IFS= read -r line; do
    case "$line" in ''|'#'*) continue ;; esac
    sha="$(printf '%s' "$line" | cut -f1)"; bytes="$(printf '%s' "$line" | cut -f2)"
    rel="$(printf '%s' "$line" | cut -f3)"; extra="$(printf '%s' "$line" | cut -f4)"
    [ -z "$rel" ] && continue
    if [ "$bytes" = "-1" ] || [ "$extra" = "MISSING" ]; then
      echo "::error file=$rel::فایل روی سرور پیدا نشد (پروب آن را MISSING گزارش کرد) — دیپلوی ناقص"
      summary "| \`$rel\` (پروب) | ⛔ روی سرور غایب |"
      rc=1; continue
    fi
    if [ ! -f "$ROOT_DIR/$rel" ]; then
      echo "::error file=$rel::فایل در working tree نیست — مقایسه ممکن نیست"
      summary "| \`$rel\` (پروب) | ⛔ در checkout نیست |"
      rc=1; continue
    fi
    loc="$(sha1_of <"$ROOT_DIR/$rel")" || { echo "::error::ابزار sha1 در دسترس نیست"; return 2; }
    if [ "$loc" = "$sha" ]; then
      echo "✅ ${rel} — پروب سرور == کامیت (${sha:0:12}…, ${bytes}B)"
      summary "| \`$rel\` (پروب) | ✅ یکسان |"
    else
      echo "::error file=$rel::پروب سرور با کامیت یکی نیست — server=${sha:0:12}… commit=${loc:0:12}… serverBytes=${bytes} commitBytes=$(wc -c <"$ROOT_DIR/$rel" | tr -d ' ') — فایل کهنه روی هاست"
      summary "| \`$rel\` (پروب) | ⛔ کهنه روی هاست |"
      rc=1
    fi
  done <<<"$(printf '%s\n' "$body")"
  return $rc
}

summary() {
  [ -n "${GITHUB_STEP_SUMMARY:-}" ] || return 0
  [ -w "${GITHUB_STEP_SUMMARY}" ] || return 0
  printf '%s\n' "$*" >>"${GITHUB_STEP_SUMMARY}"
}

# ---------- بررسی یک فایل ----------
# خروجی: 0 یکسان، 1 نابرابر/غایب، 2 ابزار لازم نبود
check_one() {
  local spec="$1" base="$2" url expected actual tmp_live attempt rc
  local rel="$spec" urlpath="$spec" local_path
  # قالب «مسیر-محلی|/مسیر-یوآرآی» برای فایل‌هایی که روی هاست آدرس دیگری دارند
  # (crm/index.html ⇒ /crm/ چون canonicalize با ۳۰۱ از /index.html می‌گذرد)
  case "$spec" in
    *'|'*) rel="${spec%%|*}"; urlpath="${spec#*|}" ;;
  esac
  local_path="$ROOT_DIR/$rel"

  if ! command -v curl >/dev/null 2>&1; then
    echo "::error::curl روی این رانر نیست — بررسی صحت استقرار قابل انجام نیست (بی‌صدا سبز حساب نمی‌شود)"
    return 2
  fi
  if [ ! -f "$local_path" ]; then
    echo "::error file=$rel::فایل در working tree پیدا نشد — مخزن ناقص است"
    return 1
  fi

  expected="$(sha_of <"$local_path")" || { echo "::error::هیچ ابزار sha در دسترس نیست (sha256sum/shasum/openssl)"; return 2; }
  url="$base/${urlpath#/}"
  [ "$CACHE_BUSTER" = 1 ] && url="$url?ptfcb=${GITHUB_RUN_ID:-$(date +%s)}"

  actual=""
  for attempt in $(seq 1 "$RETRIES"); do
    rc=0
    tmp_live="$(mktemp "${TMPDIR:-/tmp}/ptf-live-XXXXXX")"
    curl -fsSL --compressed --max-time "$TIMEOUT" -o "$tmp_live" "$url" 2>/dev/null || rc=$?
    if [ "$rc" -eq 0 ] && [ -s "$tmp_live" ]; then
      actual="$(sha_of <"$tmp_live")"
      if [ "$actual" = "$expected" ]; then
        rm -f "$tmp_live"
        echo "✅ ${rel} — زنده == کامیت (${expected:0:12}…)"
        return 0
      fi
    else
      rm -f "$tmp_live"
      [ "$attempt" -lt "$RETRIES" ] && { echo "… ${rel}: HTTP خطا (curl rc=${rc}) — تلاش ${attempt}/${RETRIES}"; sleep "$SLEEP_S"; continue; }
      echo "::error file=$rel::فایل زنده خوانده نشد (curl rc=${rc}) — ${url}"
      return 1
    fi
    rm -f "$tmp_live"
    [ "$attempt" -lt "$RETRIES" ] && { echo "… ${rel}: تفاوت هش — تلاش ${attempt}/${RETRIES}"; sleep "$SLEEP_S"; }
  done

  # نابرابری پایدار: تشخیص اندازه + اولین بایت متفاوت برای گزارش قابل‌فهم
  tmp_live="$(mktemp "${TMPDIR:-/tmp}/ptf-live-XXXXXX")"
  curl -fsSL --compressed --max-time "$TIMEOUT" -o "$tmp_live" "$url" 2>/dev/null || true
  local sz_live sz_local first_diff=""
  sz_live="$(wc -c <"$tmp_live" 2>/dev/null | tr -d ' ')"
  sz_local="$(wc -c <"$local_path" | tr -d ' ')"
  if [ -s "$tmp_live" ]; then
    first_diff="$(cmp -l "$local_path" "$tmp_live" 2>/dev/null | head -1 | awk '{print " (اولین بایت متفاوت: #" $1 ")"}')"
  fi
  rm -f "$tmp_live"
  echo "::error file=$rel::فایل زنده با کامیت یکی نیست — expected=${expected:0:12}… actual=${actual:-none} localBytes=${sz_local} liveBytes=${sz_live:-0}${first_diff} — استقرار ناقص یا کش هاست"
  return 1
}

# ---------- خودآزمون (سرور محلی + پروب ساختگی) ----------
self_test() {
  command -v node >/dev/null 2>&1 || { echo "SKIP self-test: node نیست"; return 0; }
  local tmp rc=0 port pid i out
  tmp="$(mktemp -d "${TMPDIR:-/tmp}/ptf-hashcheck-selftest-XXXXXX")" || { echo "mktemp failed"; return 2; }
  trap 'rm -rf "$tmp"' RETURN
  mkdir -p "$tmp/live/crm" "$tmp/live/api" "$tmp/repo/crm" "$tmp/repo/_tools/ci"
  cp "$SCRIPT_PATH" "$tmp/repo/_tools/ci/"
  printf 'sw-v34.8.35 marker\n' >"$tmp/repo/crm/sw.js"
  printf 'client-server marker\n' >"$tmp/repo/crm/client-server.js"
  cp "$tmp/repo/crm/sw.js" "$tmp/live/crm/sw.js"
  cp "$tmp/repo/crm/client-server.js" "$tmp/live/crm/client-server.js"

  # پروب ساختگی — حالت‌ها: ok | stale | missing | noheader
  write_probe() {
    local mode="${1:-ok}" h_sw h_cs
    if [ "$mode" = "stale" ]; then h_sw="$(printf 'STALE\n' | sha1_of)"; else h_sw="$(sha1_of <"$tmp/repo/crm/sw.js")"; fi
    h_cs="$(sha1_of <"$tmp/repo/crm/client-server.js")"
    printf '# ptf-deploy-probe-v1 version=%s\n' "${PROBE_VERSION:-v34.8.35}" >"$tmp/live/api/deploy-probe.php"
    if [ "$mode" = "noheader" ]; then printf '# unexpected output\n' >"$tmp/live/api/deploy-probe.php"; return 0; fi
    printf '%s\t%s\tcrm/sw.js\n' "$h_sw" "$(wc -c <"$tmp/repo/crm/sw.js" | tr -d ' ')" >>"$tmp/live/api/deploy-probe.php"
    if [ "$mode" = "missing" ]; then
      printf -- '-1\t-1\tcrm/client-server.js\tMISSING\n' >>"$tmp/live/api/deploy-probe.php"
    else
      printf '%s\t%s\tcrm/client-server.js\n' "$h_cs" "$(wc -c <"$tmp/repo/crm/client-server.js" | tr -d ' ')" >>"$tmp/live/api/deploy-probe.php"
    fi
    return 0
  }

  cat >"$tmp/server.js" <<'JS'
const http=require('http'),fs=require('fs'),path=require('path');
const dir=process.argv[2];
const s=http.createServer((req,res)=>{
  const u=decodeURIComponent((req.url||'/').split('?')[0]);
  const f=path.join(dir,u);
  if(!f.startsWith(dir)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);res.end('not found');return;}
  res.writeHead(200,{'content-type':'text/plain; charset=utf-8'});
  fs.createReadStream(f).pipe(res);
});
s.listen(0,'127.0.0.1',()=>{console.log(String(s.address().port));});
JS

  node "$tmp/server.js" "$tmp/live" >"$tmp/port" 2>"$tmp/server.err" &
  pid=$!
  port=""
  for i in $(seq 1 50); do
    port="$(tr -d '[:space:]' <"$tmp/port")"
    [ -n "$port" ] && break
    sleep 0.1
  done
  if [ -z "$port" ]; then kill "$pid" 2>/dev/null; echo "FAIL self-test: سرور محلی بالا نیامد: $(cat "$tmp/server.err")"; return 1; fi

  run() { # $1=exit انتظار $2=توضیح  (CASE_FILES / EXTRA ست می‌شوند)
    local got
    ( cd "$tmp/repo" && bash "$tmp/repo/_tools/ci/post-deploy-hash-check.sh" \
        --base "http://127.0.0.1:${port}" --files "${CASE_FILES:-}" --retries 1 --sleep 0 ${EXTRA:-} ) >"$tmp/log" 2>&1
    got=$?
    if [ "$got" = "$1" ]; then echo "PASS $2 [exit=$got]"; else echo "FAIL $2 — expected exit=$1 got=$got"; sed 's/^/      | /' "$tmp/log" | head -8; rc=1; fi
  }

  CASE_FILES="crm/sw.js" EXTRA="" run 0 "زنده == کامیت ⇒ exit 0"
  printf 'STALE-BYTES\n' >"$tmp/live/crm/sw.js"
  CASE_FILES="crm/sw.js" EXTRA="" run 1 "زنده قدیمی ⇒ شکست (block)"
  CASE_FILES="crm/sw.js" EXTRA="--policy warn" run 0 "زنده قدیمی + warn ⇒ exit 0"
  CASE_FILES="crm/does-not-exist.js" EXTRA="" run 1 "۴۰۴ ⇒ شکست"
  cp "$tmp/repo/crm/sw.js" "$tmp/live/crm/sw.js"
  CASE_FILES="crm/sw.js|/crm/sw.js" EXTRA="" run 0 "نگاشت مسیر|یوآرآی ⇒ exit 0"

  # ── پروب سروری (T0-4: هش فایل‌های PHP/JS از خودِ هاست) ──
  write_probe ok
  CASE_FILES="" EXTRA="--probe" run 0 "پروب: همه یکسان ⇒ exit 0"
  write_probe stale
  CASE_FILES="" EXTRA="--probe" run 1 "پروب: هش کهنه روی هاست ⇒ شکست"
  CASE_FILES="" EXTRA="--probe --policy warn" run 0 "پروب: کهنه + سیاست warn ⇒ exit 0"
  write_probe missing
  CASE_FILES="" EXTRA="--probe" run 1 "پروب: فایل غایب روی هاست ⇒ شکست"
  write_probe ok
  CASE_FILES="" EXTRA="--probe --expect-version v99.0.0" run 1 "پروب: نسخهٔ اعلامی ناهمخوان ⇒ شکست"
  CASE_FILES="" EXTRA="--probe --probe-path api/nope.php" run 1 "پروب: ۴۰۴ ⇒ شکست (نه بی‌صدا سبز)"
  PROBE_VERSION="bogus" write_probe ok
  CASE_FILES="" EXTRA="--probe" run 1 "پروب: هدر نسخهٔ نامعتبر ⇒ شکست"
  PROBE_VERSION="" write_probe noheader
  CASE_FILES="" EXTRA="--probe" run 1 "پروب: بدون هدر نسخه ⇒ شکست"

  kill "$pid" 2>/dev/null
  wait "$pid" 2>/dev/null
  echo "──"
  [ "$rc" = 0 ] && echo "SELF-TEST: ALL PASSED (post-deploy-hash-check)" || echo "SELF-TEST: FAIL"
  return "$rc"
}

if [ "$SELF_TEST" = 1 ]; then
  self_test
  exit $?
fi

if [ "$POLICY" != "block" ] && [ "$POLICY" != "warn" ]; then
  echo "⛔ PTF_GATE_POLICY باید block یا warn باشد (گرفته شد: $POLICY)"
  exit 2
fi
if [ -z "$BASE" ]; then
  echo "⛔ --base لازم است (یا PTF_DEPLOY_BASE)"
  exit 2
fi
BASE="${BASE%/}"

echo "── post-deploy-hash-check · base=${BASE} · policy=${POLICY} · retries=${RETRIES} · probe=${PROBE} ──"
summary "| **بررسی صحت استقرار** (${BASE}) | |"
summary "|---|---|"

fail=0
if [ "$PROBE" = "1" ]; then
  if check_probe "$BASE" "$PROBE_PATH"; then
    summary "| \`$PROBE_PATH\` (پروب سرور) | ✅ یکسان |"
  else
    pst=$?
    [ "$pst" = 2 ] && TOOL_MISSING=1
    fail=1
  fi
fi

for f in $FILES; do
  if check_one "$f" "$BASE"; then
    summary "| \`${f}\` | ✅ یکسان |"
  else
    st=$?
    summary "| \`${f}\` | ⛔ نابرابر/غایب (rc=${st}) |"
    [ "$st" = 2 ] && TOOL_MISSING=1
    fail=1
  fi
done

if [ "$fail" = 0 ]; then
  echo "post-deploy-hash-check: PASS — همهٔ فایل‌های زنده با کامیت یکی‌اند"
  exit 0
fi

if [ "$POLICY" = "warn" ]; then
  echo "::warning title=بررسی صحت استقرار ناموفق (سیاست warn)::حداقل یک فایل زنده با کامیت یکی نیست — استقرار ادامه یافت"
  exit 0
fi
if [ -n "${TOOL_MISSING:-}" ]; then
  echo "::error::بررسی صحت استقرار امکان‌پذیر نبود (ابزار لازم نبود) — بی‌صدا سبز حساب نشد"
fi
echo "::error::استقرار ناقص است: حداقل یک فایل حیاتی روی ${BASE} با کامیت یکی نیست. Ctrl+Shift+R کافی نیست — دیپلوی را تکرار کنید."
exit 1
