#!/usr/bin/env bash
# The full verification pipeline, as run by CI and before a manual deploy:
# install, checks (project pages, astro check, lint, format), production build, size guard,
# then the Playwright smoke tests against the build.
# Commands and the output directory come from deploy.config. Outside CI, Akari
# is linked from the local checkout (see install_deps in scripts/lib.sh).
#
# Usage: scripts/ci.sh [--skip-checks] [--skip-e2e] [--clean]
#   --skip-checks  only build and run the size guard (implies --skip-e2e)
#   --skip-e2e     skip the browser smoke tests (APP_E2E)
#   --clean        always do a clean install (the default when CI=true)
# Env: BUILD_SHA  commit to stamp into the build (defaults to git HEAD)
set -euo pipefail
# shellcheck source=scripts/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

checks=1 e2e=1 clean=0
[[ "${CI:-}" == true ]] && clean=1
while (($#)); do
  case "$1" in
    --skip-checks) checks=0 e2e=0 ;;
    --skip-e2e) e2e=0 ;;
    --clean) clean=1 ;;
    -h|--help) sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "unknown option: $1 (see --help)" ;;
  esac
  shift
done

check_node
if ((clean)); then
  info "Clean install"
  rm -rf "$APP_DIR/node_modules"
  install_deps
else
  ensure_deps
fi

if ((checks)); then
  info "Checks: $APP_CHECKS"
  app_run "$APP_CHECKS"
fi

info "Build: $APP_BUILD"
rm -rf "$DIST_DIR"
app_run "$APP_BUILD"
[[ -f "$DIST_DIR/index.html" ]] || die "build did not produce $DIST_DIR/index.html (check DIST_DIR in deploy.config)"
"$REPO_ROOT/scripts/check-size.sh" "$DIST_DIR"

if ((e2e)) && [[ -n "${APP_E2E:-}" ]]; then
  info "Smoke tests: $APP_E2E"
  app_run "$APP_E2E"
fi
