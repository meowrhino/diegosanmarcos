#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

BUTTERCHURN_VERSION="${BUTTERCHURN_VERSION:-${1:-3.0.0-beta.5}}"
BUTTERCHURN_PRESETS_VERSION="${BUTTERCHURN_PRESETS_VERSION:-${2:-3.0.0-beta.4}}"

BUTTERCHURN_URL="https://unpkg.com/butterchurn@${BUTTERCHURN_VERSION}/dist/butterchurn.js"
PRESETS_URL="https://unpkg.com/butterchurn-presets@${BUTTERCHURN_PRESETS_VERSION}/dist/base.min.js"

mkdir -p "${ROOT_DIR}/vendor/butterchurn" "${ROOT_DIR}/vendor/butterchurn-presets"

curl -fL "${BUTTERCHURN_URL}" -o "${ROOT_DIR}/vendor/butterchurn/butterchurn.js"
curl -fL "${PRESETS_URL}" -o "${ROOT_DIR}/vendor/butterchurn-presets/base.min.js"

echo "Vendored dependencies updated:"
echo "- butterchurn ${BUTTERCHURN_VERSION}"
echo "- butterchurn-presets ${BUTTERCHURN_PRESETS_VERSION}"
