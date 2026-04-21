#!/bin/bash

PASS="✅" FAIL="❌"
errors=0

check() {
  local label="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    echo "$PASS $label ($actual)"
  else
    echo "$FAIL $label (expected $expected, got $actual)"
    ((errors++))
  fi
}

status() { curl -s -o /dev/null -w "%{http_code}" "$1"; }
location() { curl -s -o /dev/null -w "%{redirect_url}" "$1"; }

check "Landing page"     200 "$(status https://qabu.net/)"
check "favicon.ico"      200 "$(status https://qabu.net/favicon.ico)"
check "logo_dark.svg"    200 "$(status https://qabu.net/logo_dark.svg)"
check "logo_white.svg"   200 "$(status https://qabu.net/logo_white.svg)"
check "Privacy page"     200 "$(status https://qabu.net/privacy)"
check "Terms page"       200 "$(status https://qabu.net/terms)"
check "Auth /verify"     401 "$(status https://qabu.net/auth/verify)"
check "Auth /login"      302 "$(status https://qabu.net/auth/login)"
check "Onboarding"       302 "$(status https://qabu.net/onboarding)"

# Verify login redirects to Google
login_url=$(location https://qabu.net/auth/login)
if [[ "$login_url" == *"accounts.google.com"* ]]; then
  echo "$PASS Auth /login → Google OAuth"
else
  echo "$FAIL Auth /login → expected Google redirect, got: $login_url"
  ((errors++))
fi

echo
[ $errors -eq 0 ] && echo "All checks passed" || echo "$errors check(s) failed"
