#!/bin/sh
set -e

if [ -n "$GITHUB_WEBHOOK_SECRET_SECRET_FILE" ] && [ -f "$GITHUB_WEBHOOK_SECRET_SECRET_FILE" ]; then
	GITHUB_WEBHOOK_SECRET=$(cat "$GITHUB_WEBHOOK_SECRET_SECRET_FILE")
	export GITHUB_WEBHOOK_SECRET
else
	echo "Error: GITHUB_WEBHOOK_SECRET_SECRET_FILE '${GITHUB_WEBHOOK_SECRET_SECRET_FILE}' is invalid." >&2
	exit 1
fi

if [ "${1}" = "npm" ]; then
	exec "$@"
fi

if [ "${1}" = "node" ]; then
	exec "$@"
fi

exec npm start
