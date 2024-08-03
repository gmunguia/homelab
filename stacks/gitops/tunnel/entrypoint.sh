#!/bin/sh

TOKEN=$(cat "$CLOUDFLARED_TOKEN_SECRET_FILE")

exec cloudflared tunnel --no-autoupdate run --token "$TOKEN"
