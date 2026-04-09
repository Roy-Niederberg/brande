#!/bin/bash
set -euo pipefail

REGISTRY="registry.gitlab.com/rny3/brande"
SVC=$(basename "${1%/}")

if [ ! -d "services/$SVC" ]; then
  echo "Error: services/$SVC not found"
  exit 1
fi

# 1. Detect latest version from git tags
# Look for tags like 'landing_page-v0.1.0'
LATEST_TAG=$(git tag -l "$SVC-v*" --sort=-v:refname | head -n1)

if [ -z "$LATEST_TAG" ]; then
  VERSION="v0.1.0"
  echo "No previous tag found for $SVC. Starting with $VERSION."
else
  # Extract version part (0.1.0) and increment last digit
  # Handles format service-v0.1.0
  CURRENT_VERSION=$(echo "$LATEST_TAG" | sed "s/^$SVC-v//")
  
  # Split version parts (e.g. 0.1.0 -> major=0, minor=1, patch=0)
  IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"
  VERSION="v$MAJOR.$MINOR.$((PATCH + 1))"
  echo "Latest tag: $LATEST_TAG (v$MAJOR.$MINOR.$PATCH)"
fi

echo "Proposed new version: $VERSION"
read -p "Build and tag $SVC:$VERSION? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

echo "=== Building $SVC ($VERSION) ==="

# 2. Docker build and push
docker build --target production \
  -t "$REGISTRY/$SVC:$VERSION" \
  -t "$REGISTRY/$SVC:latest" \
  "services/$SVC/"

echo "=== Pushing $SVC:$VERSION ==="
docker push "$REGISTRY/$SVC:$VERSION"
docker push "$REGISTRY/$SVC:latest"

# 3. Create and push the new git tag
NEW_TAG="$SVC-$VERSION"
echo "=== Tagging $NEW_TAG ==="
git tag "$NEW_TAG"
git push origin "$NEW_TAG"

echo "=== Done: $SVC ($VERSION) ==="
