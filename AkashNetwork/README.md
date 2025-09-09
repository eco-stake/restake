## Deploy Restake on Akash Network

> [Short guides](https://github.com/DecloudNodesLab/Guides) about deploying on [Akash Network](https://akash.network/). 

Copy [deploy.yml](/AkashNetwork/deploy.yml) and insert to [Cloudmos](https://deploy.cloudmos.io/).

#### Available variables: </br>
`SSH_PASS` - for activate ssh connection. </br>
`MNEMONIC` - passing  phrase mnemonic to container  explicitly, without encryption. </br>
`MNEMONIC_BASE64` - passing the phrase mnemonic to the container, as a BASE64 encrypted string. </br>
`NETWORK_JSON_LINK` - A RAW (or direct) link to your networks.json file, by default the repository's [networks.json](/src/networks.json) is used. </br>
`NETWORK_LOCAL_JSON_LINK` -  A RAW (or direct) link to your networks.local.json file </br>
`CRONTAB` - the frequency of jobs in crontab, for example, to run every day at **21:00**, you should use `0 21 * * *`</br>
`RUN_ARG`- fill in if you want to run only selected chains, for example `"RUN_ARG=akash osmosis"`</br>

#### Example:
![image](https://github.com/Dimokus88/restake/assets/23629420/d45d290b-a4b4-496b-b43b-b04169e250c9)

**Use Akash Network! =)**
