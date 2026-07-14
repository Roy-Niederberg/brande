#!/bin/bash
#
# Fast HTTP health check for every client under clients/. Add --chat for a live
# LLM smoke test: it says hello + asks a question against each prod agent and
# verifies via ssh that events.jsonl shows the gatekeeper answered the greeting
# and a Gemini flash model answered the question. --chat is opt-in because it
# fires real LLM calls (burns quota), appends real lines to each client's
# events.jsonl (which the notifier emails), and needs ssh to the client VM.

PASS="✅" FAIL="❌" SKIP="⚠️ " NONE="⚪"
errors=0
total=0
healthy=0

CLIENTS_DIR="$(dirname "$0")/clients"

# All current clients live on the one Oracle client VM. If clients ever spread
# across VMs, this needs a per-client host lookup (like check_versions.sh).
VM="brande@129.159.159.251"
CHAT=0
[ "$1" = "--chat" ] && CHAT=1

status()   { curl -s -o /dev/null -w "%{http_code}"    --max-time 10 "$1"; }
location() { curl -s -o /dev/null -w "%{redirect_url}" --max-time 10 "$1"; }
ctype()    { curl -sI --max-time 10 "$1" | tr -d '\r' \
             | awk 'tolower($1)=="content-type:"{print tolower($2)}'; }
body()     { curl -s --max-time 10 "$1"; }
clientlang() { sed -n 's/.*"lang"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$1" 2>/dev/null | head -1; }

# Say hello (gatekeeper should answer directly) + ask a business question
# (should escalate to the main model). Then read the two event lines off the VM
# and check routing. Prints both replies for a human sanity-check of the text.
chat_smoke() {
  local c="$1" host="$2" lang="$3" url="https://$2/prompt-composer/ask"
  local id="smoke-$(date +%s)-$RANDOM" greet mainq
  local gid="$id-g" mid="$id-m"
  if [ "$lang" = he ]; then greet="שלום"; mainq="מהן שעות הפעילות שלכם?"
  else                      greet="Hello"; mainq="What are your opening hours?"; fi

  local ask='{"mod":"widget","conversation_id":"%s","chat":[{"role":"user","content":"%s"}]}'
  local gres mres
  gres=$(curl -s --max-time 60 -X POST "$url" -H 'Content-Type: application/json' -d "$(printf "$ask" "$gid" "$greet")")
  mres=$(curl -s --max-time 60 -X POST "$url" -H 'Content-Type: application/json' -d "$(printf "$ask" "$mid" "$mainq")")

  local ev gline mline
  ev=$(ssh -o ConnectTimeout=10 "$VM" "grep -h -e '$gid' -e '$mid' ~/app/clients/$c/logs/events.jsonl 2>/dev/null")
  gline=$(printf '%s\n' "$ev" | grep -F "$gid")
  mline=$(printf '%s\n' "$ev" | grep -F "$mid")

  # Greeting: gatekeeper replied directly — "gk" present, "main" absent.
  if printf '%s' "$gline" | grep -q '"gk":' && ! printf '%s' "$gline" | grep -q '"main":'; then
    echo "  $PASS chat: gatekeeper answered greeting"
  else
    echo "  $FAIL chat: greeting didn't resolve at gatekeeper (${gline:-no event line})"
    ((errors++)); ((fails++))
  fi
  echo "     ↳ \"$greet\" → $gres"

  # Business question: escalated and a Gemini flash / flash-lite model answered.
  if printf '%s' "$mline" | grep -qE '"main":"[^"]*flash'; then
    echo "  $PASS chat: main model answered — $(printf '%s' "$mline" | grep -oE '"main":"[^"]*"')"
  else
    echo "  $FAIL chat: main model didn't answer (${mline:-no event line})"
    ((errors++)); ((fails++))
  fi
  echo "     ↳ \"$mainq\" → $mres"
}

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

  # Live LLM smoke (opt-in) — real chat against the prod agent + ssh event check
  [ $CHAT -eq 1 ] && chat_smoke "$c" "$host" "$(clientlang "$dir/private/client-config.json")"

  [ $fails -eq 0 ] && ((healthy++))
done

echo
if [ $errors -eq 0 ]; then
  echo "$healthy/$total clients healthy — all checks passed"
else
  echo "$healthy/$total clients healthy — $errors check(s) failed"
fi
