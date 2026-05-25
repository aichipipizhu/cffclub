#!/usr/bin/env bash
set -Eeuo pipefail

REPO_URL="${REPO_URL:-https://github.com/aichipipizhu/cffclub.git}"
BRANCH="${BRANCH:-main}"
APP_DIR="${APP_DIR:-/opt/cffclub}"
APP_NAME="${APP_NAME:-kabuda}"
PORT="${PORT:-3000}"
DATABASE_URL="${DATABASE_URL:-}"
AUTH_SECRET="${AUTH_SECRET:-}"
SEED=0
SKIP_STARTUP=0

usage() {
  cat <<'USAGE'
Usage: bash scripts/deploy.sh [options]

Options:
  --repo-url URL        Git repository URL. Defaults to the production repo.
  --branch NAME        Git branch to deploy. Defaults to main.
  --app-dir PATH       Application directory. Defaults to /opt/cffclub.
  --app-name NAME      PM2 process name. Defaults to kabuda.
  --port PORT          Next.js port. Defaults to 3000.
  --database-url URL   MySQL DATABASE_URL to write into .env.
  --auth-secret VALUE  AUTH_SECRET to write into .env.
  --seed               Run prisma db seed after migrations.
  --skip-startup       Skip PM2 systemd startup configuration.
  -h, --help           Show this help.

You can also pass the same values as environment variables:
REPO_URL, BRANCH, APP_DIR, APP_NAME, PORT, DATABASE_URL, AUTH_SECRET.
USAGE
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --repo-url)
      REPO_URL="${2:?Missing value for --repo-url}"
      shift 2
      ;;
    --branch)
      BRANCH="${2:?Missing value for --branch}"
      shift 2
      ;;
    --app-dir)
      APP_DIR="${2:?Missing value for --app-dir}"
      shift 2
      ;;
    --app-name)
      APP_NAME="${2:?Missing value for --app-name}"
      shift 2
      ;;
    --port)
      PORT="${2:?Missing value for --port}"
      shift 2
      ;;
    --database-url)
      DATABASE_URL="${2:?Missing value for --database-url}"
      shift 2
      ;;
    --auth-secret)
      AUTH_SECRET="${2:?Missing value for --auth-secret}"
      shift 2
      ;;
    --seed)
      SEED=1
      shift
      ;;
    --skip-startup)
      SKIP_STARTUP=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

write_step() {
  printf '\n==> %s\n' "$1"
}

die() {
  echo "ERROR: $*" >&2
  exit 1
}

ensure_command() {
  local name="$1"
  local install_hint="$2"

  if ! command -v "$name" >/dev/null 2>&1; then
    die "$name is required. $install_hint"
  fi
}

ensure_node_version() {
  local raw major minor
  raw="$(node --version)"
  if [[ ! "$raw" =~ ^v([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
    die "Cannot parse Node.js version: $raw"
  fi

  major="${BASH_REMATCH[1]}"
  minor="${BASH_REMATCH[2]}"
  if [ "$major" -lt 18 ] || { [ "$major" -eq 18 ] && [ "$minor" -lt 18 ]; }; then
    die "Node.js 18.18+ is required. Node.js 20 LTS or 22 LTS is recommended. Current: $raw"
  fi
}

ensure_pm2() {
  if ! command -v pm2 >/dev/null 2>&1; then
    write_step "Installing PM2"
    npm install -g pm2
  fi

  ensure_command pm2 "Run: npm install -g pm2"
}

ensure_parent_dir() {
  local parent_dir
  parent_dir="$(dirname "$APP_DIR")"

  if [ ! -d "$parent_dir" ] && [ "$(id -u)" -eq 0 ]; then
    mkdir -p "$parent_dir"
  elif [ ! -d "$parent_dir" ] && command -v sudo >/dev/null 2>&1; then
    sudo mkdir -p "$parent_dir"
    sudo chown "$USER":"$USER" "$parent_dir"
  elif [ ! -d "$parent_dir" ]; then
    die "$parent_dir does not exist. Create it first or run with sudo."
  fi

  if [ "$(id -u)" -ne 0 ] && [ ! -d "$APP_DIR" ] && [ ! -w "$parent_dir" ]; then
    if command -v sudo >/dev/null 2>&1; then
      sudo mkdir -p "$APP_DIR"
      sudo chown "$USER":"$USER" "$APP_DIR"
    else
      die "$parent_dir is not writable. Create $APP_DIR first or run with sudo."
    fi
  elif [ "$(id -u)" -ne 0 ] && [ -d "$APP_DIR" ] && [ ! -w "$APP_DIR" ]; then
    if command -v sudo >/dev/null 2>&1; then
      sudo chown "$USER":"$USER" "$APP_DIR"
    else
      die "$APP_DIR is not writable. Fix ownership first or run with sudo."
    fi
  fi
}

set_env_value() {
  local file="$1"
  local key="$2"
  local value="$3"
  local escaped tmp

  if [ -z "$value" ]; then
    return
  fi

  escaped="${value//\\/\\\\}"
  escaped="${escaped//\"/\\\"}"
  tmp="$(mktemp)"
  awk -v key="$key" -v line="$key=\"$escaped\"" '
    BEGIN { replaced = 0 }
    $0 ~ "^" key "=" {
      print line
      replaced = 1
      next
    }
    { print }
    END {
      if (!replaced) {
        print line
      }
    }
  ' "$file" > "$tmp"
  mv "$tmp" "$file"
}

ensure_env_file() {
  local env_path="$1"
  local example_path
  example_path="$(dirname "$env_path")/.env.example"

  if [ ! -f "$env_path" ]; then
    if [ -f "$example_path" ]; then
      cp "$example_path" "$env_path"
    else
      touch "$env_path"
    fi
  fi

  set_env_value "$env_path" "DATABASE_URL" "$DATABASE_URL"
  set_env_value "$env_path" "AUTH_SECRET" "$AUTH_SECRET"

  if ! grep -Eq '^DATABASE_URL="mysql://.+"' "$env_path" ||
     grep -q 'kabuda_user:kabuda_password' "$env_path" ||
     ! grep -Eq '^AUTH_SECRET=".{24,}"' "$env_path" ||
     grep -q 'replace-with-a-long-random-secret' "$env_path"; then
    die "Update $env_path with a real DATABASE_URL and a long AUTH_SECRET, or pass --database-url and --auth-secret."
  fi
}

configure_pm2_startup() {
  if [ "$SKIP_STARTUP" -eq 1 ]; then
    return
  fi

  if ! command -v systemctl >/dev/null 2>&1; then
    echo "systemd was not detected. Skipping PM2 startup configuration." >&2
    return
  fi

  write_step "Configuring PM2 startup"
  if [ "$(id -u)" -eq 0 ]; then
    pm2 startup systemd
  elif command -v sudo >/dev/null 2>&1; then
    sudo env PATH="$PATH" pm2 startup systemd -u "$USER" --hp "$HOME"
  else
    echo "sudo is required to configure PM2 startup. Rerun with sudo or --skip-startup." >&2
  fi
  pm2 save
}

write_step "Checking required tools"
ensure_command git "Install it with: sudo apt install -y git"
ensure_command node "Install Node.js 20 LTS or 22 LTS before deploying."
ensure_command npm "Install Node.js 20 LTS or 22 LTS before deploying."
ensure_node_version
ensure_pm2

write_step "Preparing application directory"
ensure_parent_dir
if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR"
  git fetch origin
  git checkout "$BRANCH"
  git pull --ff-only origin "$BRANCH"
elif [ -d "$APP_DIR" ] && [ "$(find "$APP_DIR" -mindepth 1 -maxdepth 1 | head -n 1)" ]; then
  die "$APP_DIR exists but is not a Git checkout. Move it away or pass a different --app-dir."
else
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi

write_step "Checking production environment variables"
ensure_env_file "$APP_DIR/.env"

write_step "Installing project dependencies"
npm ci

write_step "Applying database migrations"
npx prisma migrate deploy

if [ "$SEED" -eq 1 ]; then
  write_step "Seeding initial data"
  npm run seed
fi

write_step "Building Next.js application"
npm run build

write_step "Starting or restarting PM2 process"
export NODE_ENV=production
export PORT
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 restart "$APP_NAME" --update-env
else
  pm2 start ecosystem.config.cjs --only "$APP_NAME"
fi
pm2 save
configure_pm2_startup

printf '\nDeployment finished.\n'
printf 'App:      %s\n' "$APP_NAME"
printf 'Path:     %s\n' "$APP_DIR"
printf 'Branch:   %s\n' "$BRANCH"
printf 'URL:      http://127.0.0.1:%s\n' "$PORT"
