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

SHA=$(git rev-parse HEAD)
SHORT=$(git rev-parse --short HEAD)

TAGS=(-t "$REGISTRY/$SVC:latest" -t "$REGISTRY/$SVC:$SHORT")
[ -n "$EXTRA_TAG" ] && TAGS+=(-t "$REGISTRY/$SVC:$EXTRA_TAG")

echo "=== Building $SVC ($SHORT${EXTRA_TAG:+, $EXTRA_TAG}) ==="
docker build --target production \
  --label "org.opencontainers.image.revision=$SHA" \
  "${TAGS[@]}" "$DIR/"

echo "=== Pushing ==="
docker push "$REGISTRY/$SVC:latest"
docker push "$REGISTRY/$SVC:$SHORT"
[ -n "$EXTRA_TAG" ] && docker push "$REGISTRY/$SVC:$EXTRA_TAG"

echo "=== Done: $SVC ==="
