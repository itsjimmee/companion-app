#!/usr/bin/env bash
# Clone reference Python repos for porting V08 + gap viewer logic.
# Runs on Cloud Agent startup (see /.cursor/environment.json).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
REF_DIR="${ROOT}/reference"
mkdir -p "$REF_DIR"

clone_if_missing() {
  local url="$1"
  local dest="$2"
  if [ -d "${dest}/.git" ]; then
    echo "✓ $(basename "$dest") already present"
    return 0
  fi
  echo "Cloning $(basename "$dest")..."
  git clone --depth 1 "$url" "$dest"
}

# Public fork — always available
clone_if_missing \
  "https://github.com/itsjimmee/historical-gap-chart-viewer-public.git" \
  "${REF_DIR}/historical-gap-chart-viewer-public" || true

# Private V08 repo — needs Cursor GitHub App access OR GITHUB_PAT secret
if [ -d "${REF_DIR}/ticker-card-gui/.git" ]; then
  echo "✓ ticker-card-gui already present"
elif [ -n "${GITHUB_PAT:-}" ]; then
  clone_if_missing \
    "https://x-access-token:${GITHUB_PAT}@github.com/itsjimmee/ticker-card-gui.git" \
    "${REF_DIR}/ticker-card-gui" || echo "⚠ ticker-card-gui clone failed — check GITHUB_PAT scopes (repo)"
else
  echo "⚠ ticker-card-gui not cloned."
  echo "  Grant Cursor GitHub App access to itsjimmee/ticker-card-gui,"
  echo "  OR add a GITHUB_PAT secret (repo scope) in Cloud Agents → Secrets."
fi
