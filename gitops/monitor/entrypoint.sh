#!/bin/sh

set -e

if [ -n "$AXIOM_TOKEN_FILE" ]; then
	AXIOM_TOKEN=$(cat "$AXIOM_TOKEN_FILE")
else
	echo "Error: AXIOM_TOKEN_FILE '$AXIOM_TOKEN_FILE' is invalid." >&2
	exit 1
fi

export AXIOM_TOKEN
exec /usr/local/bin/vector "$@"
