FROM node:20 as builder

WORKDIR /usr/src/app
COPY package*.json .
RUN npm install --production

FROM node:20-slim

WORKDIR /usr/src/app
COPY --from=builder /usr/src/app .
COPY . .

EXPOSE 4000

CMD ["npm", "start"]
