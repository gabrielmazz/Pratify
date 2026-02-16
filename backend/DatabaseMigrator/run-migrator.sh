#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
BACKEND_PROJECT="$BACKEND_DIR/backend.csproj"

if ! dotnet ef --version >/dev/null 2>&1; then
  echo "dotnet-ef nao encontrado. Instale com: dotnet tool install --global dotnet-ef"
  exit 1
fi

echo "Aplicando migrations pendentes no banco..."
dotnet ef database update --project "$BACKEND_PROJECT" --startup-project "$BACKEND_PROJECT"
