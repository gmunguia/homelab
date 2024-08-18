FROM docker:20.10 AS docker

FROM node:20 AS builder

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --omit=dev

FROM node:20-slim

COPY --from=docker /usr/local/bin/docker /usr/bin/

RUN apt-get update && \
    apt-get install --no-install-recommends -y git ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app
COPY --from=builder /usr/src/app ./
COPY . .

EXPOSE 4000

ENTRYPOINT [ "./entrypoint.sh" ]
CMD ["npm", "start"]
