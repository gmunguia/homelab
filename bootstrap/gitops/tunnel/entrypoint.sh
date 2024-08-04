#!/bin/sh

TOKEN=$(cat "$CLOUDFLARE_TOKEN_SECRET_FILE")

exec cloudflared tunnel --no-autoupdate run --token "$TOKEN"
