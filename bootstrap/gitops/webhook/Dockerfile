FROM docker:20.10 as docker
FROM alpine/git:2.45.2 as git

FROM node:20 as builder

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --omit=dev

FROM node:20-slim

COPY --from=docker /usr/local/bin/docker /usr/bin/
COPY --from=git /usr/bin/git /usr/bin/

WORKDIR /usr/src/app
COPY --from=builder /usr/src/app ./
COPY . .

EXPOSE 4000

CMD ["npm", "start"]
