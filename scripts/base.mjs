import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { Slip10RawIndex, pathToString } from "@cosmjs/crypto";
import Network from '../src/utils/Network.mjs'
import {timeStamp, mapSync, executeSync, overrideNetworks} from '../src/utils/Helpers.mjs'

import {
  coin
} from '@cosmjs/stargate'

import { MsgWithdrawDelegatorReward } from "cosmjs-types/cosmos/distribution/v1beta1/tx.js";
import { MsgDelegate } from "cosmjs-types/cosmos/staking/v1beta1/tx.js";
import { MsgExec } from "cosmjs-types/cosmos/authz/v1beta1/tx.js";

import fs from 'fs'
import _ from 'lodash'

export class Autostake {
  constructor(){
    this.mnemonic = process.env.MNEMONIC
    if(!this.mnemonic){
      timeStamp('Please provide a MNEMONIC environment variable')
      process.exit()
    }
  }

  async run(networkName){
    const calls = this.getNetworksData().map(data => {
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

        timeStamp('Using REST URL', client.network.restUrl)
        timeStamp('Using RPC URL', client.network.rpcUrl)

        if(!data.overriden) timeStamp('You are using public nodes, script may fail with many delegations. Check the README to use your own')

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
    if (!balance || balance < 1_000) {
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

    let grantMessages = await this.getAutostakeMessages(client, grantedAddresses, [client.operator.address])
    await this.autostake(client, grantMessages)
    timeStamp(client.network.prettyName, "finished")
  }

  async getClient(data) {
    let network = await Network(data, true)
    let slip44

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

    if (network.slip44 && network.slip44 !== slip44) {
      timeStamp("!! You are not using the preferred derivation path !!")
      timeStamp("!! You should switch to the correct path unless you have grants. Check the README !!")
    } 

    const operatorData = data.operators.find(el => el.botAddress === botAddress)

    if (!operatorData) return timeStamp('Not an operator')
    if (!network.authzSupport) return timeStamp('No Authz support')

    network = await Network(data)
    if (!network.rpcUrl) return timeStamp('Could not connect to RPC API')
    if (!network.restUrl) return timeStamp('Could not connect to REST API')

    const client = await network.signingClient(wallet)
    client.registry.register("/cosmos.authz.v1beta1.MsgExec", MsgExec)

    const validators = await network.getValidators()
    const operators = network.getOperators(validators)
    const operator = network.getOperatorByBotAddress(operators, botAddress)

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
          const validators = await this.getGrantValidators(client, item)
          return validators ? item : undefined
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

  getGrantValidators(client, delegatorAddress) {
    let timeout = client.network.data.autostake?.delegatorTimeout || 5000
    return client.queryClient.getGrants(client.operator.botAddress, delegatorAddress, { timeout })
      .then(
        (result) => {
          if (result.claimGrant && result.stakeGrant) {
            const grantValidators = result.stakeGrant.authorization.allow_list.address
            if (!grantValidators.includes(client.operator.address)) {
              timeStamp(delegatorAddress, "Not autostaking for this validator, skipping")
              return
            }

            return grantValidators
          }
        },
        (error) => {
          timeStamp(delegatorAddress, "ERROR skipping this run:", error.message || error)
        }
      )
  }

  async getAutostakeMessages(client, addresses, validators) {
    let batchSize = client.network.data.autostake?.batchQueries || 50
    let calls = addresses.map(item => {
      return async () => {
        try {
          return await this.getAutostakeMessage(client, item, validators)
        } catch (error) {
          timeStamp(item, 'Failed to get address', error.message)
        }
      }
    })
    let messages = await mapSync(calls, batchSize, (batch, index) => {
      // timeStamp('...batch', index + 1)
    })
    return _.compact(messages.flat())
  }

  async getAutostakeMessage(client, address, validators) {
    const totalRewards = await this.totalRewards(client, address, validators)

    const perValidatorReward = parseInt(totalRewards / validators.length)

    if (perValidatorReward < client.operator.data.minimumReward) {
      timeStamp(address, perValidatorReward, client.network.denom, 'reward is too low, skipping')
      return
    }

    let timeout = client.network.data.autostake?.delegatorTimeout || 5000
    const withdrawAddress = await client.queryClient.getWithdrawAddress(address, { timeout })
    if(withdrawAddress && withdrawAddress !== address){
      timeStamp(address, 'has a different withdraw address:', withdrawAddress)
      return
    }

    timeStamp(address, "Can autostake", perValidatorReward, client.network.denom, validators.length > 1 ? "per validator" : '')

    let messages = validators.map(el => {
      return this.buildRestakeMessage(address, el, perValidatorReward, client.network.denom)
    }).flat()

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

  totalRewards(client, address, validators) {
    let timeout = client.network.data.autostake?.delegatorTimeout || 5000
    return client.queryClient.getRewards(address, { timeout })
      .then(
        (rewards) => {
          const total = Object.values(rewards).reduce((sum, item) => {
            const reward = item.reward.find(el => el.denom === client.network.denom)
            if (reward && validators.includes(item.validator_address)) {
              return sum + parseInt(reward.amount)
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
      const overrides = overridesData && JSON.parse(overridesData)
      return overrideNetworks(networks, overrides)
    } catch {
      return networks
    }
  }
}
