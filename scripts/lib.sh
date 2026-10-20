# shellcheck shell=bash
# Shared helpers for scripts/*.sh. Source it; don't run it.
#
# Project-specific settings live outside the scripts:
#   deploy.config   app directory, output directory and install/check/build/dev commands
#   .nvmrc          Node version

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Local checkout of the design system (used while @abrycta/akari is not on GitHub Packages,
# and for local development afterwards). See scripts/link-akari.sh.
AKARI_DIR="${AKARI_DIR:-$REPO_ROOT/../akari}"
AKARI_PACKAGE="${AKARI_PACKAGE:-@abrycta/akari}"

# shellcheck source=deploy.config
source "$REPO_ROOT/deploy.config"
APP_DIR="$(cd "$REPO_ROOT/$APP_DIR" && pwd)"
DIST_DIR="$APP_DIR/${DIST_DIR:-dist}"

if [[ -t 1 ]]; then
  _c_bold=$'\033[1m' _c_red=$'\033[31m' _c_yellow=$'\033[33m' _c_green=$'\033[32m' _c_off=$'\033[0m'
else
  _c_bold='' _c_red='' _c_yellow='' _c_green='' _c_off=''
fi

info() { printf '%s==>%s %s\n' "$_c_bold" "$_c_off" "$*"; }
ok()   { printf '%s ok%s %s\n' "$_c_green" "$_c_off" "$*"; }
warn() { printf '%swarn:%s %s\n' "$_c_yellow" "$_c_off" "$*" >&2; }
die()  { printf '%serror:%s %s\n' "$_c_red" "$_c_off" "$*" >&2; exit 1; }

have() { command -v "$1" >/dev/null 2>&1; }

# Run a deploy.config command string inside APP_DIR.
app_run() { (cd "$APP_DIR" && bash -c "$1"); }

# Fail unless the active Node major version matches .nvmrc.
check_node() {
  have node || die "node not found. Install Node $(cat "$REPO_ROOT/.nvmrc") (e.g. 'nvm install' or 'fnm use')."
  have npm || die "npm not found (it ships with Node)."
  local want have_v
  want="$(tr -d ' v\n' <"$REPO_ROOT/.nvmrc")"
  have_v="$(node -p 'process.versions.node')"
  if [[ "${have_v%%.*}" != "${want%%.*}" ]]; then
    die "Node $have_v is active but .nvmrc wants $want. Run 'nvm use' (or 'fnm use') in $REPO_ROOT."
  fi
  ok "node $have_v, npm $(npm -v)"
}

# Use the local Akari checkout? Default: yes outside CI when the checkout exists.
# AKARI_LOCAL=1 forces it, AKARI_LOCAL=0 uses the registry (GitHub Packages).
akari_local() {
  case "${AKARI_LOCAL:-auto}" in
    1|true) return 0 ;;
    0|false) return 1 ;;
  esac
  [[ "${CI:-}" != true && -f "$AKARI_DIR/package.json" ]]
}

# Install dependencies: lockfile-exact from the registry, or with Akari symlinked
# from the checkout (`npm install --no-save <dir>`: package.json and the lockfile
# are left alone, so the semver range stays what CI installs).
install_deps() {
  if akari_local; then
    info "Installing dependencies with $AKARI_PACKAGE linked from $AKARI_DIR"
    [[ -d "$AKARI_DIR/dist" ]] || warn "$AKARI_DIR/dist is missing; build the design system first (npm run build there)"
    (cd "$APP_DIR" && npm install --no-save "$(cd "$AKARI_DIR" && pwd)")
  else
    info "Installing dependencies: $APP_INSTALL"
    app_run "$APP_INSTALL"
  fi
}

# Install when node_modules is missing or older than the lockfile, or when the
# Akari link is missing in local mode.
ensure_deps() {
  local marker="$APP_DIR/node_modules/.package-lock.json"
  if [[ ! -f "$marker" || "$APP_DIR/package-lock.json" -nt "$marker" ]] ||
    { akari_local && [[ ! -L "$APP_DIR/node_modules/$AKARI_PACKAGE" ]]; }; then
    install_deps
  fi
  ok "dependencies up to date"
}
