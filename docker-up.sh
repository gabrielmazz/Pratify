#!/usr/bin/env bash

set -o errexit
set -o pipefail
set -o nounset

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
RESET='\033[0m'

say()  { echo -e "$*"; }
step() { echo -e "${BLUE}${BOLD}▶ $*${RESET}"; }
ok()   { echo -e "${GREEN}✔${RESET} $*"; }
warn() { echo -e "${YELLOW}⚠ $*${RESET}"; }
die()  { echo -e "${RED}Erro:${RESET} $*" >&2; exit 1; }

has_cmd() {
  command -v "$1" >/dev/null 2>&1
}

usage() {
  cat <<'EOF'
Uso: bash docker-up.sh [opcoes]

Sobe os containers do projeto com Docker Compose, ja com build por padrao.
Quando o backend e iniciado, o script tambem aplica as migrations pendentes.

Opcoes:
  --all             Sobe dbPostgres + backend + frontend (padrao)
  --backend-only    Sobe somente dbPostgres + backend
  --db-only         Sobe somente dbPostgres
  --no-build        Nao executa build antes de subir
  --recreate        Forca recriacao dos containers
  --logs            Abre logs ao final da subida
  --help, -h        Mostra esta ajuda

Exemplos:
  bash docker-up.sh
  bash docker-up.sh --backend-only
  bash docker-up.sh --no-build --logs
EOF
}

run_backend_migrations() {
  step "Aplicando migrations pendentes do backend..."
  "${COMPOSE_CMD[@]}" exec -T backend bash DatabaseMigrator/run-migrator.sh
  ok "Migrations do backend aplicadas."
}

show_published_port() {
  local service="$1"
  local internal_port="$2"
  local label="$3"
  local published=""

  published="$("${COMPOSE_CMD[@]}" port "$service" "$internal_port" 2>/dev/null || true)"
  if [[ -n "$published" && "$published" != ":0" ]]; then
    ok "${label} exposto em ${published}."
  else
    warn "${label} nao teve porta publicada no host. Verifique conflito de porta e rode com --recreate."
  fi
}

wait_for_container_state() {
  local service="$1"
  local expected="$2"
  local timeout="${3:-90}"
  local container_id=""
  local state=""

  container_id="$("${COMPOSE_CMD[@]}" ps -q "$service" 2>/dev/null | head -n1 || true)"
  [[ -n "$container_id" ]] || {
    warn "Nao foi possivel localizar o container do servico '${service}'."
    return 1
  }

  for ((i = 0; i < timeout; i++)); do
    state="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null || true)"
    if [[ "$state" == "$expected" ]]; then
      ok "Servico '${service}' em estado '${expected}'."
      return 0
    fi
    sleep 1
  done

  warn "Timeout aguardando '${service}' ficar em '${expected}'. Estado atual: ${state:-desconhecido}."
  return 1
}

wait_for_http() {
  local url="$1"
  local label="$2"
  local timeout="${3:-60}"
  local code=""

  has_cmd curl || {
    warn "curl nao encontrado. Pulando verificacao HTTP de ${label}."
    return 0
  }

  step "Validando acesso HTTP de ${label}..."
  for ((i = 0; i < timeout; i++)); do
    code="$(curl -s -o /dev/null -w '%{http_code}' "$url" || true)"
    case "$code" in
      200|204|401|403|404)
        ok "${label} respondeu HTTP ${code}."
        return 0
        ;;
    esac
    sleep 1
  done

  warn "Nao houve resposta HTTP util de ${label} em ${timeout}s."
  return 1
}

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "Este diretorio nao e um repositorio Git."

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

[[ -f docker-compose.yaml ]] || die "Arquivo 'docker-compose.yaml' nao encontrado na raiz do projeto."
if [[ -f .env ]]; then
  # Carrega portas e outras variaveis usadas apenas para resumo final.
  set -a
  # shellcheck disable=SC1091
  source ./.env
  set +a
else
  warn "Arquivo .env nao encontrado. O Docker Compose ainda pode usar variaveis do ambiente atual."
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD=(docker compose)
elif has_cmd docker-compose; then
  COMPOSE_CMD=(docker-compose)
else
  die "Docker Compose nao encontrado. Instale 'docker compose' ou 'docker-compose'."
fi

docker info >/dev/null 2>&1 || die "Docker nao esta acessivel. Verifique se o daemon/Docker Desktop esta iniciado."

MODE="all"
BUILD="yes"
RECREATE="no"
FOLLOW_LOGS="no"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --all) MODE="all"; shift ;;
    --backend-only) MODE="backend"; shift ;;
    --db-only) MODE="db"; shift ;;
    --no-build) BUILD="no"; shift ;;
    --recreate) RECREATE="yes"; shift ;;
    --logs) FOLLOW_LOGS="yes"; shift ;;
    --help|-h) usage; exit 0 ;;
    *) die "Flag desconhecida: $1" ;;
  esac
done

TARGET_SERVICES=("dbPostgres" "backend" "frontend")
case "$MODE" in
  all) TARGET_SERVICES=("dbPostgres" "backend" "frontend") ;;
  backend) TARGET_SERVICES=("dbPostgres" "backend") ;;
  db) TARGET_SERVICES=("dbPostgres") ;;
  *) die "Modo invalido: $MODE" ;;
esac

UP_ARGS=(up -d)
[[ "$BUILD" == "yes" ]] && UP_ARGS+=(--build)
[[ "$RECREATE" == "yes" ]] && UP_ARGS+=(--force-recreate)
UP_ARGS+=("${TARGET_SERVICES[@]}")

say ""
say "${BOLD}Repositorio:${RESET} $(basename "$REPO_ROOT")"
say "${BOLD}Modo:${RESET} ${MODE}"
say "${BOLD}Servicos:${RESET} ${TARGET_SERVICES[*]}"
say "${BOLD}Build:${RESET} ${BUILD}"
say "${BOLD}Recreate:${RESET} ${RECREATE}"

step "Validando docker-compose.yaml..."
"${COMPOSE_CMD[@]}" config >/dev/null
ok "Compose valido."

step "Subindo containers..."
"${COMPOSE_CMD[@]}" "${UP_ARGS[@]}"

step "Resumo de status atual..."
"${COMPOSE_CMD[@]}" ps

if [[ " ${TARGET_SERVICES[*]} " == *" dbPostgres "* ]]; then
  wait_for_container_state "dbPostgres" "healthy" 90 || true
  show_published_port "dbPostgres" "5432" "PostgreSQL" || true
fi

if [[ " ${TARGET_SERVICES[*]} " == *" backend "* ]]; then
  wait_for_container_state "backend" "running" 90 || true
  run_backend_migrations
  show_published_port "backend" "${API_PORT:-5017}" "Backend" || true
  wait_for_http "http://localhost:${API_PORT:-5017}/api/auth/me" "backend" 60 || true
fi

if [[ " ${TARGET_SERVICES[*]} " == *" frontend "* ]]; then
  wait_for_container_state "frontend" "running" 90 || true
  show_published_port "frontend" "${FRONTEND_PORT:-8080}" "Frontend" || true
  wait_for_http "http://localhost:${FRONTEND_PORT:-8080}" "frontend" 60 || true
fi

say ""
ok "Stack Docker iniciada."
say "Banco Docker no host: localhost:${POSTGRES_PORT:-5433}"
say "Comandos uteis:"
say "  ${COMPOSE_CMD[*]} ps"
say "  ${COMPOSE_CMD[*]} logs -f backend"
say "  ${COMPOSE_CMD[*]} logs -f frontend"
say "  ${COMPOSE_CMD[*]} down"

if [[ "$FOLLOW_LOGS" == "yes" ]]; then
  say ""
  step "Abrindo logs dos servicos selecionados..."
  "${COMPOSE_CMD[@]}" logs -f "${TARGET_SERVICES[@]}"
fi
