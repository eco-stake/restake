FROM node:20-bookworm

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 build-essential \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=development

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci || npm install
COPY . .

ENV DIRECTORY_PROTOCOL=https
ENV DIRECTORY_DOMAIN=cosmos.directory

EXPOSE 3000

CMD ["npm", "run", "autostake"]
