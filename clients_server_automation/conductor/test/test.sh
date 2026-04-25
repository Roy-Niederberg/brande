#!/bin/bash
cd "$(dirname "$0")"

# ── Build ─────────────────────────────────────────────────────────────────────
g++ -std=c++20 -O2 -o /conductor    /src/main.cpp
g++ -std=c++20 -O2 -o /testclient   /test/test-client.cpp

# ── Mock docker + curl (override real ones) ───────────────────────────────────
cp fake-docker.sh /usr/local/bin/docker && chmod +x /usr/local/bin/docker
cp fake-curl.sh   /usr/local/bin/curl   && chmod +x /usr/local/bin/curl

# ── Setup dirs ────────────────────────────────────────────────────────────────
mkdir -p /home/brande/app/clients /home/brande/app/config /run/qabu
echo '' > /home/brande/app/config/base-docker-compose.yml

# ── Start conductor ───────────────────────────────────────────────────────────
/conductor &
CONDUCTOR_PID=$!

for i in $(seq 30); do
  [ -S /run/qabu/conductor.sock ] && break
  sleep 0.1
done
if [ ! -S /run/qabu/conductor.sock ]; then
  echo "FATAL: conductor socket never appeared"
  kill $CONDUCTOR_PID 2>/dev/null
  exit 1
fi

# ── Test helpers ──────────────────────────────────────────────────────────────
PASS=0; FAIL=0

check() {
  local label=$1 expected=$2 actual=$3
  if [ "$actual" = "$expected" ]; then
    echo "  PASS: $label"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $label (expected '$expected', got '$actual')"
    FAIL=$((FAIL + 1))
  fi
}

req() { /testclient "$1"; }

# ── Tests ─────────────────────────────────────────────────────────────────────
echo "=== Conductor Tests ==="

echo "[Validation]"
check "too short (2 chars)  -> err 400" "err 400" "$(req 'ab 1')"
check "starts with digit    -> err 400" "err 400" "$(req '1aaaa 1')"
check "starts with dash     -> err 400" "err 400" "$(req '-aaaa 1')"
check "ends with dash       -> err 400" "err 400" "$(req 'aaaa- 1')"
check "uppercase            -> err 400" "err 400" "$(req 'AAAAA 1')"

echo "[Create]"
check "valid subdomain      -> ok"      "ok"      "$(req 'testclient 1')"
check "duplicate            -> err 409" "err 409" "$(req 'testclient 1')"

echo "[Filesystem]"
check "client dir created"     "yes" "$([ -d /home/brande/app/clients/testclient ] && echo yes || echo no)"
check "docker-compose copied"  "yes" "$([ -f /home/brande/app/clients/testclient/docker-compose.yml ] && echo yes || echo no)"

echo "[Budget]"
req 'client2test 1' > /dev/null
req 'client3test 1' > /dev/null
req 'client4test 1' > /dev/null
req 'client5test 1' > /dev/null
check "over budget (6 > 5)  -> err 507" "err 507" "$(req 'onemore 1')"

# ── Cleanup ───────────────────────────────────────────────────────────────────
kill $CONDUCTOR_PID 2>/dev/null

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
