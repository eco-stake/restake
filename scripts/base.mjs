import fs from 'fs'
import _ from 'lodash'

import { add, bignumber, floor, smaller, smallerEq } from 'mathjs'

import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { Slip10RawIndex, pathToString } from "@cosmjs/crypto";

import { Wallet } from "@ethersproject/wallet";
import { ETH } from "@tharsis/address-converter";
import Bech32 from "bech32";

import { MsgDelegate } from "cosmjs-types/cosmos/staking/v1beta1/tx.js";
import { MsgExec } from "cosmjs-types/cosmos/authz/v1beta1/tx.js";

import Network from '../src/utils/Network.mjs'
import AutostakeHealth from "../src/utils/AutostakeHealth.mjs";
import {coin, timeStamp, mapSync, executeSync, overrideNetworks} from '../src/utils/Helpers.mjs'
import EthSigner from '../src/utils/EthSigner.mjs';

import 'dotenv/config'

export class Autostake {
  constructor(){
    this.mnemonic = process.env.MNEMONIC
    if(!this.mnemonic){
      timeStamp('Please provide a MNEMONIC environment variable')
      process.exit()
    }
  }

  async run(networkNames){
    const networks = this.getNetworksData()
    for(const name of networkNames){
      if (name && !networks.map(el => el.name).includes(name)) return timeStamp('Invalid network name:', name)
    }
    const calls = networks.map(data => {
      return async () => {
        if(networkNames && networkNames.length && !networkNames.includes(data.name)) return
        if(data.enabled === false) return

        let client
        let health = new AutostakeHealth(data.healthCheck)
        health.started('⚛')
        try {
          client = await this.getClient(data, health)
        } catch (error) {
          return health.failed('Failed to connect', error.message)
        }

        if(!client) return health.success('Skipping')

        const { restUrl, usingDirectory } = client.network

        timeStamp('Using REST URL', restUrl)

        if(usingDirectory){
          timeStamp('You are using public nodes, script may fail with many delegations. Check the README to use your own')
          timeStamp('Delaying briefly to reduce load...')
          await new Promise(r => setTimeout(r, (Math.random() * 31) * 1000));
        }

        try {
          await this.runNetwork(client)
        } catch (error) {
          return health.failed('Autostake failed, skipping network', error.message)
        }
      }
    })
    await executeSync(calls, 1)
  }

  async runNetwork(client){
    timeStamp('Running autostake')
    const { network, health } = client 
    const balance = await this.checkBalance(client)
    if (!balance || smaller(balance, 1_000)) {
      return health.failed('Bot balance is too low')
    }

    timeStamp('Finding delegators...')
    const addresses = await this.getDelegations(client).then(delegations => {
      return delegations.map(delegation => {
        if (delegation.balance.amount === 0) return

        return delegation.delegation.delegator_address
      })
    })

    timeStamp("Checking", addresses.length, "delegators for grants...")
    let grantedAddresses = await this.getGrantedAddresses(client, addresses)

    timeStamp("Found", grantedAddresses.length, "delegators with valid grants...")

    let grantMessages = await this.getAutostakeMessages(client, grantedAddresses)
    await this.autostake(client, grantMessages)
    health.complete(network.prettyName, "finished")
  }

  async getClient(data, health) {
    let network = new Network(data)
    try {
      await network.load()
    } catch {
      return timeStamp('Unable to load network data for', network.name)
    }

    timeStamp('Starting', network.prettyName)

    const { wallet, botAddress, slip44 } = await this.getWallet(network)

    timeStamp('Bot address is', botAddress)

    if (network.slip44 && network.slip44 !== slip44) {
      timeStamp("!! You are not using the preferred derivation path !!")
      timeStamp("!! You should switch to the correct path unless you have grants. Check the README !!")
    }

    const operator = network.getOperatorByBotAddress(botAddress)
    if (!operator) return timeStamp('Not an operator')

    if (!network.authzSupport) return timeStamp('No Authz support')

    await network.connect()
    if (!network.restUrl) throw new Error('Could not connect to REST API')

    const client = await network.signingClient(wallet)
    client.registry.register("/cosmos.authz.v1beta1.MsgExec", MsgExec)

    return {
      network,
      operator,
      health,
      signingClient: client,
      queryClient: network.queryClient
    }
  }

  async getWallet(network){
    let slip44
    if(network.data.autostake?.correctSlip44 || network.slip44 === 60){
      if(network.slip44 === 60) timeStamp('Found ETH coin type')
      slip44 = network.slip44 || 118
    }else{
      slip44 = network.data.autostake?.slip44 || 118
    }
    let hdPath = [
      Slip10RawIndex.hardened(44),
      Slip10RawIndex.hardened(slip44),
      Slip10RawIndex.hardened(0),
      Slip10RawIndex.normal(0),
      Slip10RawIndex.normal(0),
    ];
    slip44 != 118 && timeStamp('Using HD Path', pathToString(hdPath))

    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(this.mnemonic, {
      prefix: network.prefix,
      hdPaths: [hdPath]
    });

    if(network.slip44 === 60){
      return await this.getEthWallet(network, wallet)
    }

    const accounts = await wallet.getAccounts()
    const botAddress = accounts[0].address

    return { wallet, botAddress, slip44 }
  }

  async getEthWallet(network, signer){
    const wallet = Wallet.fromMnemonic(this.mnemonic);
    const ethereumAddress = await wallet.getAddress();
    const data = ETH.decoder(ethereumAddress);
    const botAddress = Bech32.encode(network.prefix, Bech32.toWords(data))

    return { wallet: EthSigner(signer, wallet), botAddress, slip44: 60 }
  }

  checkBalance(client) {
    return client.queryClient.getBalance(client.operator.botAddress, client.network.denom)
      .then(
        (balance) => {
          timeStamp("Bot balance is", balance.amount, balance.denom)
          return balance.amount
        },
        (error) => {
          client.health.error("Failed to get balance:", error.message || error)
        }
      )
  }

  getDelegations(client) {
    let batchSize = client.network.data.autostake?.batchQueries || 100
    return client.queryClient.getAllValidatorDelegations(client.operator.address, batchSize, (pages) => {
      timeStamp("...batch", pages.length)
    }).catch(error => {
      client.health.error("Failed to get delegations:", error.message || error)
      return []
    })
  }

  async getGrantedAddresses(client, addresses) {
    let batchSize = client.network.data.autostake?.batchQueries || 50
    let grantCalls = addresses.map(item => {
      return async () => {
        try {
          const grant = await this.getGrants(client, item)
          return grant ? { address: item, grant: grant } : undefined
        } catch (error) {
          client.health.error(item, 'Failed to get address', error.message)
        }
      }
    })
    let grantedAddresses = await mapSync(grantCalls, batchSize, (batch, index) => {
      timeStamp('...batch', index + 1)
    })
    return _.compact(grantedAddresses.flat())
  }

  getGrants(client, delegatorAddress) {
    let timeout = client.network.data.autostake?.delegatorTimeout || 5000
    return client.queryClient.getGrants(client.operator.botAddress, delegatorAddress, { timeout })
      .then(
        (result) => {
          if (result.stakeGrant) {
            if (result.stakeGrant.authorization['@type'] === "/cosmos.authz.v1beta1.GenericAuthorization") {
              timeStamp(delegatorAddress, "Using GenericAuthorization, allowed")
              return [client.operator.address];
            }

            const grantValidators = result.stakeGrant.authorization.allow_list.address
            if (!grantValidators.includes(client.operator.address)) {
              timeStamp(delegatorAddress, "Not autostaking for this validator, skipping")
              return
            }

            const maxTokens = result.stakeGrant.authorization.max_tokens

            return {
              maxTokens: maxTokens && bignumber(maxTokens.amount),
              validators: grantValidators,
            }
          }
        },
        (error) => {
          client.health.error(delegatorAddress, "ERROR skipping this run:", error.message || error)
        }
      )
  }

  async getAutostakeMessages(client, grantAddresses) {
    let batchSize = client.network.data.autostake?.batchQueries || 50
    let calls = grantAddresses.map(item => {
      return async () => {
        try {
          return await this.getAutostakeMessage(client, item)
        } catch (error) {
          client.health.error(item.address, 'Failed to get address', error.message)
        }
      }
    })
    let messages = await mapSync(calls, batchSize, (batch, index) => {
      // timeStamp('...batch', index + 1)
    })
    return _.compact(messages.flat())
  }

  async getAutostakeMessage(client, grantAddress) {
    const { address, grant } = grantAddress
    const totalRewards = await this.totalRewards(client, address)

    let autostakeAmount = floor(totalRewards)

    if (smaller(bignumber(autostakeAmount), bignumber(client.operator.minimumReward))) {
      timeStamp(address, autostakeAmount, client.network.denom, 'reward is too low, skipping')
      return
    }

    if (grant.maxTokens){
      if(smallerEq(grant.maxTokens, 0)) {
        timeStamp(address, grant.maxTokens, client.network.denom, 'grant balance is empty, skipping')
        return
      }
      if(smaller(grant.maxTokens, autostakeAmount)) {
        autostakeAmount = grant.maxTokens
        timeStamp(address, grant.maxTokens, client.network.denom, 'grant balance is too low, using remaining')
      }
    }

    let timeout = client.network.data.autostake?.delegatorTimeout || 5000
    const withdrawAddress = await client.queryClient.getWithdrawAddress(address, { timeout })
    if(withdrawAddress && withdrawAddress !== address){
      timeStamp(address, 'has a different withdraw address:', withdrawAddress)
      return
    }

    timeStamp(address, "Can autostake", autostakeAmount, client.network.denom)

    let messages = this.buildRestakeMessage(address, client.operator.address, autostakeAmount, client.network.denom)

    return this.buildExecMessage(client.operator.botAddress, messages)
  }

  async autostake(client, messages) {
    let batchSize = client.network.data.autostake?.batchTxs || 50
    let batches = _.chunk(_.compact(messages), batchSize)
    if(batches.length){
      timeStamp('Sending', messages.length, 'messages in', batches.length, 'batches of', batchSize)
    }
    let calls = batches.map((batch, index) => {
      return async () => {
        try {
          timeStamp('...batch', index + 1)
          const memo = 'REStaked by ' + client.operator.moniker
          const gasModifier = client.network.data.autostake?.gasModifier || 1.1
          const gas = await client.signingClient.simulate(client.operator.botAddress, batch, memo, gasModifier);
          await client.signingClient.signAndBroadcast(client.operator.botAddress, batch, gas, memo).then((result) => {
            timeStamp("Successfully broadcasted");
          }, (error) => {
            client.health.error('Failed to broadcast:', error.message)
          })
        } catch (error) {
          client.health.error('ERROR: Skipping batch:', error.message)
        }
      }
    })
    await executeSync(calls, 1)
  }

  buildExecMessage(botAddress, messages) {
    return {
      typeUrl: "/cosmos.authz.v1beta1.MsgExec",
      value: {
        grantee: botAddress,
        msgs: messages
      }
    }
  }

  buildRestakeMessage(address, validatorAddress, amount, denom) {
    return [{
      typeUrl: "/cosmos.staking.v1beta1.MsgDelegate",
      value: MsgDelegate.encode(MsgDelegate.fromPartial({
        delegatorAddress: address,
        validatorAddress: validatorAddress,
        amount: coin(amount, denom)
      })).finish()
    }]
  }

  totalRewards(client, address) {
    let timeout = client.network.data.autostake?.delegatorTimeout || 5000
    return client.queryClient.getRewards(address, { timeout })
      .then(
        (rewards) => {
          const total = Object.values(rewards).reduce((sum, item) => {
            const reward = item.reward.find(el => el.denom === client.network.denom)
            if (reward && item.validator_address === client.operator.address) {
              return add(sum, bignumber(reward.amount))
            }
            return sum
          }, 0)
          return total
        },
        (error) => {
          timeStamp(address, "ERROR skipping this run:", error.message || error)
          return 0
        }
      )
  }

  getNetworksData() {
    const networksData = fs.readFileSync('src/networks.json');
    const networks = JSON.parse(networksData);
    try {
      const overridesData = fs.readFileSync('src/networks.local.json');
      const overrides = overridesData && JSON.parse(overridesData) || {}
      return overrideNetworks(networks, overrides)
    } catch (error) {
      timeStamp('Failed to parse networks.local.json, check JSON is valid', error.message)
      return networks
    }
  }
}
