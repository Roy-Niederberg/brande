#!/bin/bash

PASS="✅" FAIL="❌" SKIP="⚠️ " NONE="⚪"
errors=0
total=0
healthy=0

CLIENTS_DIR="$(dirname "$0")/clients"

status()   { curl -s -o /dev/null -w "%{http_code}"    --max-time 10 "$1"; }
location() { curl -s -o /dev/null -w "%{redirect_url}" --max-time 10 "$1"; }
ctype()    { curl -sI --max-time 10 "$1" | tr -d '\r' \
             | awk 'tolower($1)=="content-type:"{print tolower($2)}'; }
body()     { curl -s --max-time 10 "$1"; }

for dir in "$CLIENTS_DIR"/*/; do
  c=$(basename "$dir")
  host="$c.qabu.net"
  echo "$c:"

  ((total++))
  fails=0

  # widget.js — 200 + JS content-type (catches mis-routing to site)
  s=$(status "https://$host/widget.js")
  ct=$(ctype "https://$host/widget.js")
  if [ "$s" = 200 ] && [[ "$ct" == *javascript* ]]; then
    echo "  $PASS widget.js"
  else
    echo "  $FAIL widget.js (status=$s, content-type=$ct)"
    ((errors++)); ((fails++))
  fi

  # /taken — confirms services-router is alive (returns body "true")
  s=$(status "https://$host/taken")
  if [ "$s" = 200 ] && [ "$(body "https://$host/taken")" = "true" ]; then
    echo "  $PASS /taken"
  else
    echo "  $FAIL /taken (status=$s)"
    ((errors++)); ((fails++))
  fi

  # / — site profile is VM-local, so we can't predict. Warn, don't fail.
  s=$(status "https://$host/")
  if [ "$s" = 200 ]; then
    echo "  $PASS /"
  else
    echo "  $SKIP / (status=$s — site profile may be off)"
  fi

  # .qabu.co.il — optional Hebrew-branded mirror. Absent is NOT an error: it
  # just means this client has no co.il record/routing yet. Neutral marker, no
  # effect on fails/errors. widget.js proves the *.qabu.co.il block routes.
  ils="$c.qabu.co.il"
  s=$(status "https://$ils/widget.js")
  ct=$(ctype "https://$ils/widget.js")
  if [ "$s" = 200 ] && [[ "$ct" == *javascript* ]]; then
    echo "  $PASS .co.il widget.js"
  else
    echo "  $NONE .co.il (none — status=$s)"
  fi

  [ $fails -eq 0 ] && ((healthy++))
done

echo
if [ $errors -eq 0 ]; then
  echo "$healthy/$total clients healthy — all checks passed"
else
  echo "$healthy/$total clients healthy — $errors check(s) failed"
fi
