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

status()   { curl -s -o /dev/null -w "%{http_code}"    "$1"; }
post()     { curl -s -o /dev/null -w "%{http_code}" -X POST -H 'Content-Type: application/json' -d "$2" "$1"; }
location() { curl -s -o /dev/null -w "%{redirect_url}" "$1"; }
body()     { curl -s "$1"; }

# ---- Status-code checks ----
check "Landing page"        200 "$(status https://qabu.net/)"
check "favicon.ico"         200 "$(status https://qabu.net/favicon.ico)"
check "logo_dark.svg"       200 "$(status https://qabu.net/logo_dark.svg)"
check "logo_white.svg"      200 "$(status https://qabu.net/logo_white.svg)"
check "Privacy page"        200 "$(status https://qabu.net/privacy)"
check "Terms page"          200 "$(status https://qabu.net/terms)"
check "Auth /verify"        401 "$(status https://qabu.net/auth/verify)"
check "Auth /login"         302 "$(status https://qabu.net/auth/login)"
check "Onboarding (public)" 200 "$(status https://qabu.net/onboarding)"
check "Onboarding create-client unauth" 401 "$(post https://qabu.net/onboarding/create-client '{}')"
check "Onboarding availability check"   200 "$(status https://qabu.net/onboarding/available/drlipokatz)"
check "FB page signup"      302 "$(status https://qabu.net/facebook-page-signup)"
check "FB dispatcher"       403 "$(status https://qabu.net/facebook)"

# ---- Redirect targets ----
login_url=$(location https://qabu.net/auth/login)
if [[ "$login_url" == *"accounts.google.com"* ]]; then
  echo "$PASS Auth /login → Google OAuth"
else
  echo "$FAIL Auth /login → expected Google redirect, got: $login_url"
  ((errors++))
fi

# Invite validation is public and must reject a bogus code (proves the node
# service is reachable without auth and the invite gate is on).
invite_resp=$(curl -s -X POST -H 'Content-Type: application/json' -d '{"code":"bogus"}' \
              https://qabu.net/onboarding/validate-invite)
if [[ "$invite_resp" == *'"valid":false'* ]]; then
  echo "$PASS Onboarding invite gate rejects bogus code"
else
  echo "$FAIL Onboarding invite gate — expected valid:false, got: $invite_resp"
  ((errors++))
fi

fb_signup_url=$(location https://qabu.net/facebook-page-signup)
if [[ "$fb_signup_url" == *"/auth/login"* ]]; then
  echo "$PASS FB page signup → /auth/login (forward_auth)"
else
  echo "$FAIL FB page signup → expected /auth/login redirect, got: $fb_signup_url"
  ((errors++))
fi

http_redirect=$(location http://qabu.net/)
if [[ "$http_redirect" == https://* ]]; then
  echo "$PASS HTTP → HTTPS ($http_redirect)"
else
  echo "$FAIL HTTP → HTTPS (got: $http_redirect)"
  ((errors++))
fi

# Admin forward_auth — exercises the cross-VM admin auth chain via one
# canary client subdomain (clients-router → auth-verifier → /auth/login).
# Picks drlipokatz as the canary; if it's ever undeployed, change this.
admin_canary=drlipokatz.qabu.net
admin_url=$(location "https://$admin_canary/bab/admin/")
if [[ "$admin_url" == *"/auth/login"* ]]; then
  echo "$PASS Admin forward_auth via $admin_canary"
else
  echo "$FAIL Admin forward_auth via $admin_canary (got: $admin_url)"
  ((errors++))
fi

# ---- Content sniff ----
if [[ "$(body https://qabu.net/)" == *"Qab"* ]]; then
  echo "$PASS Landing page contains 'Qab'"
else
  echo "$FAIL Landing page missing 'Qab' branding"
  ((errors++))
fi

# ---- Hebrew landing page (qabu.co.il) ----
check "Hebrew landing page"  200 "$(status https://qabu.co.il/)"
if [[ "$(body https://qabu.co.il/)" == *"עין טל"* ]]; then
  echo "$PASS Hebrew landing page contains 'עין טל'"
else
  echo "$FAIL Hebrew landing page missing 'עין טל' content"
  ((errors++))
fi

# ---- TLS cert expiry (warn under 14 days) ----
cert_end=$(echo | openssl s_client -servername qabu.net -connect qabu.net:443 2>/dev/null \
          | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
if [ -n "$cert_end" ]; then
  days_left=$(( ( $(date -d "$cert_end" +%s) - $(date +%s) ) / 86400 ))
  if [ "$days_left" -gt 14 ]; then
    echo "$PASS TLS cert valid ($days_left days left)"
  else
    echo "$FAIL TLS cert expires in $days_left days"
    ((errors++))
  fi
else
  echo "$FAIL TLS cert check (could not read certificate)"
  ((errors++))
fi

echo
[ $errors -eq 0 ] && echo "All checks passed" || echo "$errors check(s) failed"
