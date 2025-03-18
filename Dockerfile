FROM node:20.15-alpine as builder

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci --only=production

COPY . ./

FROM node:20.15-alpine
WORKDIR /usr/src/app

COPY --from=builder /usr/src/app /usr/src/app

ENV NODE_ENV=production
ENV DIRECTORY_PROTOCOL=https
ENV DIRECTORY_DOMAIN=cosmos.directory

RUN addgroup -S p2p && adduser -S p2p-restake -G p2p

RUN chown -R p2p-restake:p2p /usr/src/app

USER p2p

CMD ["npm", "run", "autostake"]

