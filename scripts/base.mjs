import fs from 'fs'
import _ from 'lodash'

import { add, bignumber, floor, smaller, smallerEq } from 'mathjs'

import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { Slip10RawIndex, pathToString } from "@cosmjs/crypto";

import { Wallet as EthWallet } from "@ethersproject/wallet";

import { MsgDelegate } from "cosmjs-types/cosmos/staking/v1beta1/tx.js";
import { MsgExec } from "cosmjs-types/cosmos/authz/v1beta1/tx.js";

import Network from '../src/utils/Network.mjs'
import Wallet from '../src/utils/Wallet.mjs';
import AutostakeHealth from "../src/utils/AutostakeHealth.mjs";
import {coin, timeStamp, mapSync, executeSync, overrideNetworks, parseGrants} from '../src/utils/Helpers.mjs'
import EthSigner from '../src/utils/EthSigner.mjs';

import 'dotenv/config'

export class Autostake {
  constructor(opts){
    this.opts = opts || {}
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
        let health = new AutostakeHealth(data.healthCheck, { dryRun: this.opts.dryRun })
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

    await this.autostake(client, grantedAddresses)
  }

  async getClient(data, health) {
    let network = new Network(data)
    try {
      await network.load()
    } catch {
      return timeStamp('Unable to load network data for', network.name)
    }

    timeStamp('Starting', network.prettyName)

    const { signer, slip44 } = await this.getSigner(network)
    const wallet = new Wallet(network, signer)
    const botAddress = await wallet.getAddress()

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

    const client = wallet.signingClient
    client.registry.register("/cosmos.authz.v1beta1.MsgExec", MsgExec)

    return {
      network,
      operator,
      health,
      signingClient: client,
      queryClient: network.queryClient
    }
  }

  async getSigner(network){
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

    let signer = await DirectSecp256k1HdWallet.fromMnemonic(this.mnemonic, {
      prefix: network.prefix,
      hdPaths: [hdPath]
    });

    if(network.slip44 === 60){
      const ethSigner = EthWallet.fromMnemonic(this.mnemonic);
      signer = EthSigner(signer, ethSigner, network.prefix)
    }

    return { signer, slip44 }
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
    const { botAddress, address } = client.operator
    let allGrants
    try {
      allGrants = await client.queryClient.getGranteeGrants(botAddress)
    } catch (e) {  }
    let grantCalls = addresses.map(item => {
      return async () => {
        if(allGrants) return this.parseGrantResponse(allGrants, botAddress, item, address)
        try {
          return await this.getGrants(client, item)
        } catch (error) {
          client.health.error(item, 'Failed to get grants', error.message)
        }
      }
    })
    let batchSize = client.network.data.autostake?.batchQueries || 50
    let grantedAddresses = await mapSync(grantCalls, batchSize, (batch, index) => {
      timeStamp('...batch', index + 1)
    })
    return _.compact(grantedAddresses.flat())
  }

  getGrants(client, delegatorAddress) {
    const { botAddress, address } = client.operator
    let timeout = client.network.data.autostake?.delegatorTimeout || 5000
    return client.queryClient.getGrants(botAddress, delegatorAddress, { timeout })
      .then(
        (result) => {
          return this.parseGrantResponse(result, botAddress, delegatorAddress, address)
        },
        (error) => {
          client.health.error(delegatorAddress, "ERROR skipping this run:", error.message || error)
        }
      )
  }

  parseGrantResponse(grants, botAddress, delegatorAddress, validatorAddress){
    const result = parseGrants(grants, botAddress, delegatorAddress)
    let grantValidators, maxTokens
    if (result.stakeGrant) {
      if (result.stakeGrant.authorization['@type'] === "/cosmos.authz.v1beta1.GenericAuthorization") {
        timeStamp(delegatorAddress, "Using GenericAuthorization, allowed")
        grantValidators = [validatorAddress];
      }else{
        grantValidators = result.stakeGrant.authorization.allow_list.address
        if (!grantValidators.includes(validatorAddress)) {
          timeStamp(delegatorAddress, "Not autostaking for this validator, skipping")
          return
        }
        maxTokens = result.stakeGrant.authorization.max_tokens
      }

      const grant = {
        maxTokens: maxTokens && bignumber(maxTokens.amount),
        validators: grantValidators,
      }
      return { address: delegatorAddress, grant: grant }
    }
  }

  async getAutostakeMessage(client, grantAddress) {
    const { address, grant } = grantAddress

    let timeout = client.network.data.autostake?.delegatorTimeout || 5000
    const withdrawAddress = await client.queryClient.getWithdrawAddress(address, { timeout })
    if(withdrawAddress && withdrawAddress !== address){
      timeStamp(address, 'has a different withdraw address:', withdrawAddress)
      return
    }

    const totalRewards = await this.totalRewards(client, address)

    if(totalRewards === undefined) return

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

    timeStamp(address, "Can autostake", autostakeAmount, client.network.denom)

    return this.buildRestakeMessage(address, client.operator.address, autostakeAmount, client.network.denom)
  }

  async autostake(client, grantedAddresses) {
    const { network, health } = client
    let batchSize = network.data.autostake?.batchTxs || 50
    timeStamp('Calculating and autostaking in batches of', batchSize)

    this.batch = []
    this.messages = []
    this.processed = {}

    const calls = grantedAddresses.map((item, index) => {
      return async () => {
        let messages
        try {
          messages = await this.getAutostakeMessage(client, item)
        } catch (error) {
          health.error(item.address, 'Failed to get autostake message', error.message)
        }
        this.processed[item.address] = true

        await this.sendInBatches(client, messages, batchSize, grantedAddresses.length)
      }
    })
    let querySize = network.data.autostake?.batchQueries || _.clamp(batchSize, 50)
    await executeSync(calls, querySize)

    const results = await Promise.all(this.messages)
    const errors = results.filter(result => result.error)
    timeStamp(`${network.prettyName} summary:`);
    for (let [index, result] of results.entries()) {
      timeStamp(`TX ${index + 1}:`, result.message);
    }
    health.complete(`${network.prettyName} finished: Sent ${results.length - errors.length}/${results.length} messages`)
  }

  async sendInBatches(client, messages, batchSize, total){
    if (messages) {
      this.batch = this.batch.concat(messages)
    }

    const finished = (Object.keys(this.processed).length >= total && this.batch.length > 0)
    if (this.batch.length >= batchSize || finished) {
      const batch = this.batch
      this.batch = []

      const messages = [...this.messages]
      const promise = messages[messages.length - 1] || Promise.resolve()
      const sendTx = promise.then(() => {
        timeStamp('Sending batch', messages.length + 1)
        return this.sendMessages(client, batch)
      })
      this.messages.push(sendTx)
      return sendTx
    }
  }

  async sendMessages(client, messages){
    try {
      const execMsg = this.buildExecMessage(client.operator.botAddress, messages)
      const memo = 'REStaked by ' + client.operator.moniker
      const gasModifier = client.network.data.autostake?.gasModifier || 1.1
      const gas = await client.signingClient.simulate(client.operator.botAddress, [execMsg], memo, gasModifier);
      if (this.opts.dryRun) {
        const message = `DRYRUN: Would send ${messages.length} TXs using ${gas} gas`
        timeStamp(message)
        return { message }
      } else {
        return await client.signingClient.signAndBroadcast(client.operator.botAddress, [execMsg], gas, memo).then((response) => {
          const message = `Sent ${messages.length} messages - ${response.transactionHash}`
          timeStamp(message)
          return { message }
        }, (error) => {
          const message = `Failed ${messages.length} messages - ${error.message}`
          client.health.error(message)
          return { message, error }
        })
      }
    } catch (error) {
      const message = `Failed ${messages.length} TXs: ${error.message}`
      client.health.error(message)
      return { message, error }
    }
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
