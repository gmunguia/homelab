FROM busybox:1.35.0-uclibc AS busybox
FROM timberio/vector:0.40.X-alpine

COPY --from=busybox /bin/sh /bin/sh
COPY --from=busybox /bin/cat /bin/cat

COPY entrypoint.sh /entrypoint.sh
COPY vector.yml /etc/vector/vector.yaml

ENTRYPOINT [ "/entrypoint.sh" ]
