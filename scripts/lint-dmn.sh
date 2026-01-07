set -euo pipefail

SEARCH_PATH="${1:-spec/decision}"

if [ ! -d "$SEARCH_PATH" ]; then
  echo "[dmn] skip: $SEARCH_PATH not found"
  exit 0
fi

docker run --rm \
  -v "$(pwd)":/work \
  -w /work \
  ghcr.io/red6/dmn-check:latest \
  --searchPath="/work/${SEARCH_PATH}"