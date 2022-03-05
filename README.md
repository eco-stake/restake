# [REStake](https://restake.app)

REStake allows delegators to grant permission for a validator to compound their rewards, and provides a script validators can run to find their granted delegators and send the compounding transactions automatically.

REStake is also a convenient staking tool, allowing you to claim and compound your rewards individually or in bulk. This can save transaction fees and time, and many more features are planned.

[![](./docs/screenshot.png)](https://restake.app)

Try it out at [restake.app](https://restake.app).

## How it works / Authz

Authz is a new feature for Tendermint chains which lets you grant permission to another wallet to carry out certain transactions for you. These transactions are sent by the grantee on behalf of the granter, meaning the validator will send and pay for the TX, but actions will affect your wallet (such as claiming rewards). 

REStake specifically lets you grant a validator permission to send `WithdrawDelegatorReward` and `Delegate` transactions for their validator only (note `WithdrawDelegatorReward` is technically not restricted to a single validator). The validator cannot send any other transaction types, and has no other access to your wallet. You authorise this using Keplr as normal.

A script is also provided which allows a validator to automatically search their delegators, check each for the required grants, and if applicable carry out the claim and delegate transactions on their behalf in a single transaction. This script should be run daily, and the time you will run it can be specified when you [add your operator](#become-an-operator).

## Limitations

- As of writing, Ledger is unable to send the necessary transactions to enable Authz. This is purely due to the way transactions are sent to a Ledger device and a workaround should be possible soon.
- Authz is also not fully supported yet. Many chains are yet to update. The REStake UI will fall back to being a manual staking app with useful manual compounding features.
- Currently REStake needs the browser extension version of Keplr, but WalletConnect and Keplr iOS functionality will be added ASAP.

## Become an operator

Becoming an operator is extremely easy. You need to do three things:

### Setup a bot wallet

Generate a new hot wallet you will use to automatically carry out the staking transactions. The mnemonic will need to be provided to the script so **use a dedicated wallet and only keep enough funds for transaction fees**.

You only need a single mnemonic for multiple Cosmos chains, and the script will check each network in the [networks.json](./src/networks.json) file for a matching bot address. 

### Setup the autostaking script and run daily

You can run the autostaking script using `docker-compose` or using `npm` directly. In both cases you will need to provide your mnemonic in a `MNEMONIC` environment variable. 

Instructions are provided for Docker Compose and will be expanded later.

### Install Docker and Docker Compose

Best bet is to follow the Docker official guides. Install Docker first, then Docker Compose.

Docker: [docs.docker.com/get-docker](https://docs.docker.com/get-docker/)

Docker Compose: [docs.docker.com/compose/install](https://docs.docker.com/compose/install/)

### Clone the repository and setup .env

Clone the repository and copy the sample `.env` file ready for your mnemonic.

```
git clone https://github.com/eco-stake/restake
cd restake
cp .env.sample .env
```

**Populate your new .env file with your mnemonic.**

### Running the script (to see if everything works correctly)

Running the autostake script manually is then simple.

Note you might need `sudo` depending on your docker install.

```
docker-compose run app npm run autostake
```

Pass a network name to run the script for a single network at a time.

```
docker-compose run app npm run autostake osmosis
```

### Updating your local version

REStake is MVP. Very MVP. Updates are happening all the time and there are bugs that still need fixing. Make sure you update often.

Update your local repository and pre-build your Docker containers with the following commands:

```
git pull
docker-compose build
```

### Setting up Cron to make sure the script runs daily

You should setup your script to run at the same time each day using `crontab`

```
crontab -e

0 21 * * * /bin/bash -c "cd restake && docker-compose run app npm run autostake" > ./restake.log 2>&1
```

Don't forget to [update often](#updating-your-local-version)!

## Submiting your operator

### Setup your REStake operator

You now need to update the [networks.json](./src/networks.json) file at `./src/networks.json` to add your operator to any networks you want to auto-compound for. Check the existing file for examples, but the operators array is simple:

```
"operators": [{
  "address": "osmovaloper1u5v0m74mql5nzfx2yh43s2tke4mvzghr6m2n5t",
  "botAddress": "osmo1yxsmtnxdt6gxnaqrg0j0nudg7et2gqczed559y",
  "runTime": "21:00",
  "minimumReward": 1000
},
```

`address` is your validator's address, and `botAddress` is the address from your new hot wallet you generated earlier. Repeat this for all networks you want to REStake for.

Note that the `botAddress` is the address which will be granted by the delegator to carry out their restaking transactions if it wasn't clear.

#### Submit your operator

You can now submit your `networks.json` update to the repository in a pull request which will be merged and deployed as soon as possible.

## Adding/updating a network

A script is included to generate the config needed to add a new chain from the [Chain Registry](https://github.com/cosmos/chain-registry). It will update the config file in-place, retaining the important information like operators etc. It can be used to update and add a chain, just check the changes with Git.

Make sure you match the directory name from Chain Registry.

```
docker-compose run app npm run registryConfig cosmoshub
```

## Running the UI

Run the UI using docker with one line:

```
docker run -p 80:80 -t ghcr.io/eco-stake/restake
```

Alternative run from source using `docker-compose up` or `npm start`.

## Ethos

The REStake UI is both validator and network agnostic. Any validator can be added as an operator and run this tool to provide an auto-compounding service to their delegators, but they can also run their own UI if they choose and adjust the branding to suit themselves. 

For this to work, we need a common source of chain information, and a common source of 'operator' information. Currently this the [networks.json](./src/networks.json) file in this repository. A helper script is included to add a chain from the [Chain Registry](https://github.com/cosmos/chain-registry), and this integration will be taken further soon.

If you fork this repository to provide your own UI, please keep up to date with the upstream to ensure you have the latest [networks.json](./src/networks.json) to include all operators. Some honesty is needed until we have a more decentralised solution.

## Disclaimer

The initial version of REStake was built quickly to take advantage of the new authz features. I'm personally not a React or Javascript developer, and this project leans extremely heavily on the [CosmJS project](https://github.com/cosmos/cosmjs) and other fantastic codebases like [Keplr Wallet](https://github.com/chainapsis/keplr-wallet) and [Osmosis Zone frontend](https://github.com/osmosis-labs/osmosis-frontend). It functions very well and any attack surface is very limited however. Any contributions, suggestions and ideas from the community are extremely welcome.

## ECO Stake 🌱

ECO Stake is a climate positive validator, but we care about the Cosmos ecosystem too. We built REStake to make it easy for all validators to run an autocompounder with Authz, and it's one of many projects we work on in the ecosystem. [Delegate with us](https://ecostake.com) to support more projects like this.

