#!/usr/bin/env bash
# Fail if the build output breaks GitHub Pages limits: no file over 100 MiB
# (GitHub rejects it) and a published site under 1 GB.
# https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
#
# Usage: scripts/check-size.sh [DIR]   (default: DIST_DIR from deploy.config)
# Env:   MAX_FILE_BYTES (default 104857600), MAX_TOTAL_KIB (default 1000000)
set -euo pipefail
# shellcheck source=scripts/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

dir="${1:-$DIST_DIR}"
max_bytes="${MAX_FILE_BYTES:-104857600}"
max_total_kib="${MAX_TOTAL_KIB:-1000000}"

[[ -d "$dir" ]] || die "$dir does not exist. Build first (scripts/ci.sh or npm run build)."

count="$(find "$dir" -type f | wc -l | tr -d ' ')"
big="$(find "$dir" -type f -size +"${max_bytes}"c)"
total_kib="$(du -sk "$dir" | cut -f1)"

info "Size guard: $dir ($count files, $((total_kib / 1024)) MiB total)"

status=0
if [[ -n "$big" ]]; then
  warn "files over $((max_bytes / 1048576)) MiB (GitHub rejects these):"
  while IFS= read -r f; do
    printf '  %s (%s MiB)\n' "${f#"$dir"/}" "$(( $(wc -c <"$f") / 1048576 ))" >&2
  done <<<"$big"
  status=1
fi
if (( total_kib > max_total_kib )); then
  warn "site is $((total_kib / 1024)) MiB, over the 1 GB GitHub Pages limit"
  status=1
fi

if (( status != 0 )); then
  die "size guard failed"
fi
ok "size guard passed (largest files below)"
# awk instead of head: head closes the pipe early, which fails under pipefail.
find "$dir" -type f -exec du -k {} + | sort -rn | awk 'NR <= 3' | while read -r kib f; do
  printf '  %6s KiB  %s\n' "$kib" "${f#"$dir"/}"
done
