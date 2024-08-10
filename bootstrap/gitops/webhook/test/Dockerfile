FROM node:20-alpine AS node
FROM docker:dind

ENV DOCKER_HOST="tcp://docker:2376"
ENV DOCKER_CERT_PATH=/certs/client

COPY --from=node /usr/lib /usr/lib
COPY --from=node /usr/local/lib /usr/local/lib
COPY --from=node /usr/local/include /usr/local/include
COPY --from=node /usr/local/bin /usr/local/bin

RUN apk add --no-cache \
  git \
  ca-certificates
