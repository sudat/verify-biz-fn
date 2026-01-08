#!/usr/bin/env bash
set -euo pipefail

SEARCH_PATH="${1:-spec/decision}"

if [ ! -d "$SEARCH_PATH" ]; then
  echo "[dmn] skip: $SEARCH_PATH not found"
  exit 0
fi

# docker がPATHに無いならスキップ
if ! command -v docker >/dev/null 2>&1; then
  echo "[dmn] skip: docker not found"
  exit 0
fi

# docker が見えても、WSL連携無しなどで実行できないケースがあるのでスキップ
if ! docker --version >/dev/null 2>&1; then
  echo "[dmn] skip: docker command not usable"
  exit 0
fi

# daemon に繋がらないならスキップ（Docker Desktop未起動など）
if ! docker info >/dev/null 2>&1; then
  echo "[dmn] skip: docker daemon not available"
  exit 0
fi

docker run --rm \
  -v "$(pwd)":/work \
  -w /work \
  ghcr.io/red6/dmn-check:latest \
  --searchPath="/work/${SEARCH_PATH}"
