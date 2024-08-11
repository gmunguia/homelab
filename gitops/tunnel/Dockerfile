FROM busybox:1.35.0-uclibc AS busybox
FROM cloudflare/cloudflared:2024.6.1

COPY --from=busybox /bin/sh /bin/sh
COPY --from=busybox /bin/cat /bin/cat
COPY --from=busybox /bin/env /bin/env
COPY --from=busybox /bin/sort /bin/sort
COPY --from=busybox /bin/ls /bin/ls

COPY entrypoint.sh /entrypoint.sh

ENTRYPOINT [ "/entrypoint.sh" ]
