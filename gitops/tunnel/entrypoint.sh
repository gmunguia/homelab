#!/bin/sh
set -e

if [ -n "$CLOUDFLARE_TOKEN" ]; then
	TOKEN="$CLOUDFLARE_TOKEN"
elif [ -n "$CLOUDFLARE_TOKEN_SECRET_FILE" ]; then
	TOKEN=$(cat "$CLOUDFLARE_TOKEN_SECRET_FILE")
else
	echo "Error: Neither CLOUDFLARE_TOKEN is set nor CLOUDFLARE_TOKEN_SECRET_FILE is set and valid." >&2
	exit 1
fi

exec cloudflared tunnel --no-autoupdate run --token "$TOKEN"
