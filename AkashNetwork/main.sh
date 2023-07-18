#!/bin/bash
# Telegram @Dimokus
# Discord Dimokus_
# 2023
apt install -y nano wget build-essential git make gcc nvme-cli ssh cron
export EDITOR=nano
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
if [[ -n $MNEMONIC ]]; then echo MNEMONIC="$MNEMONIC" > .env;fi
if [[ -n $MNEMONIC_BASE64 ]]; then echo MNEMONIC=`echo "$MNEMONIC_BASE64" | base64 -d` > .env;fi
if [[ -n $NETWORK_JSON_LINK ]] ; then wget -O /restake/src/networks.json $NETWORK_JSON_LINK;fi
npm run autostake
crontab -l > current_cron
echo "0 12 * * * /bin/bash -c 'cd /restake && npm run autostake' > /restake/restake.log 2>&1" >> ~/current_cron
crontab -l | cat - ~/current_cron | crontab -
service cron start
sleep infinity
