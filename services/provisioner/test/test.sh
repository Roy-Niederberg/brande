#!/bin/bash
set -e
cd "$(dirname "$0")"

URL=http://localhost:4321
SECRET=dev
PASS=0
FAIL=0

scaffold() {
  curl -s -o /dev/null -w '%{http_code}' -X POST "$URL/scaffold" \
    -H 'Content-Type: application/json' \
    -H "X-Provision-Secret: $1" \
    -d "$2"
}

check() {
  local label=$1 expected=$2 actual=$3
  if [ "$actual" = "$expected" ]; then
    echo "  PASS: $label (got $actual)"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $label (expected $expected, got $actual)"
    FAIL=$((FAIL + 1))
  fi
}

# Start server
docker compose up -d --build --wait

echo "=== Provisioner Tests ==="

# 1. Wrong secret
echo "[Auth]"
code=$(scaffold "wrong" '{"subdomain":"aaaaa","tier":1}')
check "wrong secret -> 403" 403 "$code"

# 2. Validation
echo "[Validation]"
code=$(scaffold "$SECRET" '{"tier":1}')
check "missing subdomain -> 400" 400 "$code"

code=$(scaffold "$SECRET" '{"subdomain":"aaaaa","tier":0}')
check "tier 0 -> 400" 400 "$code"

code=$(scaffold "$SECRET" '{"subdomain":"aaaaa"}')
check "missing tier -> 400" 400 "$code"

# 3. Successful scaffold
echo "[Scaffold]"
code=$(scaffold "$SECRET" '{"subdomain":"testclient","tier":1}')
check "create testclient -> 200" 200 "$code"

# 4. Duplicate
code=$(scaffold "$SECRET" '{"subdomain":"testclient","tier":1}')
check "duplicate -> 409" 409 "$code"

# 5. Fill up budget (max_tier=5, used=1, add 4 more)
code=$(scaffold "$SECRET" '{"subdomain":"client2test","tier":1}')
check "create client2test -> 200" 200 "$code"
code=$(scaffold "$SECRET" '{"subdomain":"client3test","tier":1}')
check "create client3test -> 200" 200 "$code"
code=$(scaffold "$SECRET" '{"subdomain":"client4test","tier":1}')
check "create client4test -> 200" 200 "$code"
code=$(scaffold "$SECRET" '{"subdomain":"client5test","tier":1}')
check "create client5test -> 200" 200 "$code"

# 6. Over budget
echo "[Capacity]"
code=$(scaffold "$SECRET" '{"subdomain":"onemore","tier":1}')
check "over budget -> 507" 507 "$code"

# Cleanup
docker compose down -v

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
