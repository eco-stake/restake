# dev env
FROM node:alpine

RUN apk add --update python3 make g++ && rm -rf /var/cache/apk/*

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . ./

ENV NODE_ENV=development
ENV DIRECTORY_PROTOCOL=https
ENV DIRECTORY_DOMAIN=cosmos.directory

EXPOSE 3000
CMD npm run start
