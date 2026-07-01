#!/bin/bash
set -euo pipefail

REGISTRY="registry.gitlab.com/rny3/brande"
EXTRA_TAG=""

while [ $# -gt 0 ]; do
  case "$1" in
    -t) EXTRA_TAG="$2"; shift 2 ;;
    *)  SVC="${SVC:-$1}"; shift ;;
  esac
done

if [ -z "${SVC:-}" ]; then
  echo "Usage: $0 [-t <tag>] <service>"
  exit 1
fi

SVC=$(basename "${SVC%/}")
DIR="$(cd "$(dirname "$0")" && pwd)/$SVC"

if [ ! -d "$DIR" ]; then
  echo "Error: $DIR not found"
  exit 1
fi

if [ ! -f /proc/sys/fs/binfmt_misc/qemu-aarch64 ]; then
  echo "=== Registering QEMU arm64 emulation (binfmt_misc) ==="
  docker run --privileged --rm multiarch/qemu-user-static --reset -p yes >/dev/null
fi

SHA=$(git rev-parse HEAD)
SHORT=$(git rev-parse --short HEAD)

TAGS=(-t "$REGISTRY/$SVC:latest" -t "$REGISTRY/$SVC:$SHORT")
[ -n "$EXTRA_TAG" ] && TAGS+=(-t "$REGISTRY/$SVC:$EXTRA_TAG")

echo "=== Building & pushing $SVC ($SHORT${EXTRA_TAG:+, $EXTRA_TAG}) [amd64+arm64] ==="
docker buildx build --target production \
  --platform linux/amd64,linux/arm64 \
  --label "org.opencontainers.image.revision=$SHA" \
  --push \
  "${TAGS[@]}" "$DIR/"

echo "=== Done: $SVC ==="
