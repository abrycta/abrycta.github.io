#!/usr/bin/env bash
# Local development: check tools, install dependencies, start the Astro dev
# server (APP_DEV in deploy.config).
#
# Usage: scripts/dev.sh [--host] [--akari-local] [-- <extra dev-server args>]
#   --host         listen on all interfaces (open the site from a phone on your LAN)
#   --akari-local  force the local design-system checkout (the default outside CI
#                  when ../akari exists; AKARI_LOCAL=0 uses GitHub Packages instead)
set -euo pipefail
# shellcheck source=scripts/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

host=0 akari_local=0 extra=()
while (($#)); do
  case "$1" in
    --host) host=1 ;;
    --akari-local) akari_local=1 ;;
    --) shift; extra=("$@"); break ;;
    -h|--help) sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "unknown option: $1 (see --help)" ;;
  esac
  shift
done

info "Checking prerequisites"
check_node
((akari_local)) && export AKARI_LOCAL=1
ensure_deps
"$REPO_ROOT/scripts/link-akari.sh" status

dev_cmd="$APP_DEV"
((host)) && dev_cmd+=" --host"
for arg in ${extra[@]+"${extra[@]}"}; do dev_cmd+=" $(printf '%q' "$arg")"; done
info "Starting dev server: $dev_cmd (Ctrl-C to stop)"
cd "$APP_DIR"
exec bash -c "$dev_cmd"
