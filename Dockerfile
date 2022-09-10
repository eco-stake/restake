# dev env
FROM node:17-slim

RUN apt-get update && apt-get install -y python3 make g++

ENV NODE_ENV=development

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . ./

ENV DIRECTORY_PROTOCOL=https
ENV DIRECTORY_DOMAIN=cosmos.directory

EXPOSE 3000
CMD npm run start
