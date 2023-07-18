#!/bin/bash
# Telegram @Dimokus
# Discord Dimokus_
# 2023
TZ=Europe/Kiev && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone
apt install -y build-essential git make gcc nvme-cli nodejs 
node --version
npm --version
sleep 5
git clone https://github.com/eco-stake/restake
cd restake
npm install
echo $MNEMONIC > .env
npm run autostake
sleep infinity
