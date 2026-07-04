#!/bin/bash
# Per-VM table of running containers with their git SHA + image build date.
# SHA comes from the org.opencontainers.image.revision label set by build.sh.

VMS=(
  "main          brande@129.159.134.3"
  "clients-1     brande@129.159.159.251"
)

REMOTE='docker ps --format "{{.Names}}|{{.Image}}|{{.Label \"org.opencontainers.image.revision\"}}|{{.Status}}" \
  | while IFS="|" read n i r s; do
      d=$(docker image inspect --format "{{.Created}}" "$i" 2>/dev/null)
      printf "%s\t%.7s\t%.19s\t%s\t%s\n" "$n" "$r" "$d" "$s" "$i"
    done'

for vm in "${VMS[@]}"; do
  label=${vm%% *}
  host=${vm##* }
  echo "=== $label ($host) ==="
  printf "NAME\tSHA\tBUILT\tSTATUS\tIMAGE\n"
  ssh -n -o ConnectTimeout=5 "$host" "$REMOTE" 2>/dev/null
  echo
done | column -t -s $'\t'
