#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <client>"
  echo "Clients: drlipokatz eintal yomialpurrer ofirfichman"
}

client="${1:-}"
if [[ -z "$client" ]]; then
  usage
  exit 1
fi

case "$client" in
  drlipokatz|eintal|yomialpurrer)
    host="brande@129.159.159.251"
    ;;
  ofirfichman)
    host="brande@[2600:1900:4040:704::]"
    ;;
  *)
    echo "Unknown or undeployed client: $client" >&2
    usage
    exit 1
    ;;
esac

root="$(git rev-parse --show-toplevel)"
local_dir="$root/clients/$client"
remote_dir="~/app/clients/$client"

mkdir -p "$local_dir/private" "$local_dir/data"

echo "Syncing $client from $host:$remote_dir"
rsync -a --delete "$host:$remote_dir/private/" "$local_dir/private/"
rsync -a --delete "$host:$remote_dir/data/" "$local_dir/data/"

echo
echo "git diff --stat for clients/$client/private and clients/$client/data:"
git -C "$root" diff --stat -- "clients/$client/private" "clients/$client/data"
