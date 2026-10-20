#!/usr/bin/env bash
# Production build, then serve it locally with `astro preview` (static files from dist/).
#
# Usage: scripts/preview.sh [--no-build] [--port N]
#   --no-build  serve the existing build output as is
#   --port N    port to listen on (default 4321)
#
# Note: when Astro detects it is driven by an automated agent it may start the
# preview server in the background; stop it with `npx astro preview stop`.
set -euo pipefail
# shellcheck source=scripts/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

build=1 port=4321
while (($#)); do
  case "$1" in
    --no-build) build=0 ;;
    --port) port="${2:?--port needs a value}"; shift ;;
    -h|--help) sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "unknown option: $1 (see --help)" ;;
  esac
  shift
done

check_node
if ((build)); then
  "$REPO_ROOT/scripts/ci.sh" --skip-checks
fi
[[ -f "$DIST_DIR/index.html" ]] || die "no build in $DIST_DIR; run without --no-build"

info "Serving $DIST_DIR with: $APP_PREVIEW --port $port"
cd "$APP_DIR"
exec bash -c "$APP_PREVIEW --port $port"
