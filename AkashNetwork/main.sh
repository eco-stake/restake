#!/bin/bash
# Telegram @Dimokus
# Discord Dimokus_
# 2023
TZ=Europe/Kiev && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone
apt install -y build-essential git make gcc nvme-cli ssh
curl -sL https://deb.nodesource.com/setup_18.x -o /tmp/nodesource_setup.sh
# read the script file and when you're sure it's safe run it
chmod +x /tmp/nodesource_setup.sh
/tmp/nodesource_setup.sh
apt install nodejs -y
node --version
npm --version
sleep 5
if [[ -n $SSH_PASS ]] ; then apt install -y ssh; echo "PermitRootLogin yes" >> /etc/ssh/sshd_config && (echo ${SSH_PASS}; echo ${SSH_PASS}) | passwd root && service ssh restart; fi
git clone https://github.com/eco-stake/restake
cd restake
npm install
echo MNEMONIC="$MNEMONIC" > .env
npm run autostake
sleep infinity
