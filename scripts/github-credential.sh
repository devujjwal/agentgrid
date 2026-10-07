#!/bin/sh
# Git calls this helper only for this checkout. Credentials are returned to Git,
# never logged, persisted in this repository, or placed in a remote URL.
set -eu
[ "${1:-}" = get ] || exit 0
protocol=''
host=''
credential_path=''
while IFS= read -r line && [ -n "$line" ]; do
  case "$line" in
    protocol=*) protocol=${line#protocol=} ;;
    host=*) host=${line#host=} ;;
    path=*) credential_path=${line#path=} ;;
  esac
done
[ "$protocol" = https ] || exit 1
[ "$host" = github.com ] || exit 1
case "$credential_path" in
  devujjwal/agentgrid|devujjwal/agentgrid.git) ;;
  *) exit 1 ;;
esac
credential_token=$(gh auth token --hostname github.com --user devujjwal)
printf 'username=devujjwal\npassword=%s\n' "$credential_token"
