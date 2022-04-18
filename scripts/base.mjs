import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { Slip10RawIndex, pathToString } from "@cosmjs/crypto";
import Network from '../src/utils/Network.mjs'
import {coin, timeStamp, mapSync, executeSync, overrideNetworks} from '../src/utils/Helpers.mjs'

import { add, bignumber, floor, smaller, smallerEq } from 'mathjs'

import { MsgWithdrawDelegatorReward } from "cosmjs-types/cosmos/distribution/v1beta1/tx.js";
import { MsgDelegate } from "cosmjs-types/cosmos/staking/v1beta1/tx.js";
import { MsgExec } from "cosmjs-types/cosmos/authz/v1beta1/tx.js";

import fs from 'fs'
import _ from 'lodash'

import 'dotenv/config'

export class Autostake {
  constructor(){
    this.mnemonic = process.env.MNEMONIC
    if(!this.mnemonic){
      timeStamp('Please provide a MNEMONIC environment variable')
      process.exit()
    }
  }

  async run(networkName){
    const networks = this.getNetworksData()
    if(networkName && !networks.map(el => el.name).includes(networkName)) return timeStamp('Invalid network name:', networkName)
    const calls = networks.map(data => {
      return async () => {
        if(networkName && data.name !== networkName) return
        if(data.enabled === false) return

        let client
        try {
          client = await this.getClient(data)
        } catch (error) {
          return timeStamp('Failed to connect', error.message)
        }

        if(!client) return timeStamp('Skipping')

        const { restUrl, rpcUrl, usingDirectory } = client.network

        timeStamp('Using REST URL', restUrl)
        timeStamp('Using RPC URL', rpcUrl)

        if(usingDirectory){
          timeStamp('You are using public nodes, script may fail with many delegations. Check the README to use your own')
          timeStamp('Delaying briefly to reduce load...')
          await new Promise(r => setTimeout(r, (Math.random() * 31) * 1000));
        }

        try {
          await this.runNetwork(client)
        } catch (error) {
          return timeStamp('Autostake failed, skipping network', error.message)
        }
      }
    })
    await executeSync(calls, 1)
  }

  async runNetwork(client){
    timeStamp('Running autostake')
    const balance = await this.checkBalance(client)
    if (!balance || smaller(balance, 1_000)) {
      timeStamp('Bot balance is too low')
      return
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
    timeStamp(client.network.prettyName, "finished")
  }

  async getClient(data) {
    let network = new Network(data)
    let slip44
    await network.load()

    timeStamp('⚛')
    timeStamp('Starting', network.prettyName)

    if(network.data.autostake?.correctSlip44){
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

    const accounts = await wallet.getAccounts()
    const botAddress = accounts[0].address

    timeStamp('Bot address is', botAddress)

    const operator = network.getOperatorByBotAddress(botAddress)
    if (!operator) return timeStamp('Not an operator')

    if (network.slip44 && network.slip44 !== slip44) {
      timeStamp("!! You are not using the preferred derivation path !!")
      timeStamp("!! You should switch to the correct path unless you have grants. Check the README !!")
    }

    if (!network.authzSupport) return timeStamp('No Authz support')

    await network.connect()
    if (!network.rpcUrl) return timeStamp('Could not connect to RPC API')
    if (!network.restUrl) return timeStamp('Could not connect to REST API')

    const client = await network.signingClient(wallet)
    client.registry.register("/cosmos.authz.v1beta1.MsgExec", MsgExec)


    return {
      network,
      operator,
      signingClient: client,
      queryClient: network.queryClient
    }
  }

  checkBalance(client) {
    return client.queryClient.getBalance(client.operator.botAddress, client.network.denom)
      .then(
        (balance) => {
          timeStamp("Bot balance is", balance.amount, balance.denom)
          return balance.amount
        },
        (error) => {
          timeStamp("ERROR:", error.message || error)
        }
      )
  }

  getDelegations(client) {
    let batchSize = client.network.data.autostake?.batchQueries || 100
    return client.queryClient.getAllValidatorDelegations(client.operator.address, batchSize, (pages) => {
      timeStamp("...batch", pages.length)
    }).catch(error => {
      timeStamp("ERROR:", error.message || error)
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
          timeStamp(item, 'Failed to get address', error.message)
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
          if (result.claimGrant && result.stakeGrant) {
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
          timeStamp(delegatorAddress, "ERROR skipping this run:", error.message || error)
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
          timeStamp(item.address, 'Failed to get address', error.message)
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
          await client.signingClient.signAndBroadcast(client.operator.botAddress, batch, undefined, memo).then((result) => {
            timeStamp("Successfully broadcasted");
          }, (error) => {
            timeStamp('Failed to broadcast:', error.message)
          })
        } catch (error) {
          timeStamp('ERROR: Skipping batch:', error.message)
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
      typeUrl: "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward",
      value: MsgWithdrawDelegatorReward.encode(MsgWithdrawDelegatorReward.fromPartial({
        delegatorAddress: address,
        validatorAddress: validatorAddress
      })).finish()
    }, {
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
    const networkNames = networks.map(el => el.name)
    try {
      const overridesData = fs.readFileSync('src/networks.local.json');
      const overrides = overridesData && JSON.parse(overridesData) || {}
      Object.keys(overrides).forEach(key => {
        if(!networkNames.includes(key)) timeStamp('Invalid key in networks.local.json:', key)
      })
      return overrideNetworks(networks, overrides)
    } catch {
      timeStamp('Failed to parse networks.local.json, check JSON is valid')
      return networks
    }
  }
}
