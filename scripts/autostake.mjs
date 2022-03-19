import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
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

class Autostake {
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

        timeStamp('Running autostake')
        await this.checkBalance(client)

        timeStamp('Finding delegators...')
        const addresses = await this.getDelegations(client).then(delegations => {
          return delegations.map(delegation => {
            if(delegation.balance.amount === 0) return

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
    })
    await executeSync(calls, 1)
  }

  async getClient(data){
    let network = await Network(data, true)

    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(this.mnemonic, {
      prefix: network.prefix
    });

    const accounts = await wallet.getAccounts()
    const botAddress = accounts[0].address

    timeStamp(network.prettyName, 'bot address is', botAddress)

    const operatorData = data.operators.find(el => el.botAddress === botAddress)

    if(!operatorData) return timeStamp('Not an operator')
    if(!network.authzSupport) return timeStamp('No Authz support')

    network = await Network(data)
    if(!network.rpcUrl) return timeStamp('Could not connect to RPC API')
    if(!network.restUrl) return timeStamp('Could not connect to REST API')

    const client = await network.signingClient(wallet)
    client.registry.register("/cosmos.authz.v1beta1.MsgExec", MsgExec)

    const validators = await network.getValidators()
    const operators = network.getOperators(validators)
    const operator = network.getOperatorByBotAddress(operators, botAddress)

    return{
      network: network,
      operator: operator,
      signingClient: client,
      queryClient: network.queryClient
    }
  }

  checkBalance(client) {
    return client.queryClient.getBalance(client.operator.botAddress, client.network.denom)
      .then(
        (balance) => {
          timeStamp("Bot balance is", balance.amount, balance.denom)
          if(balance.amount < 1_000){
            timeStamp('Bot balance is too low')
            process.exit()
          }
        },
        (error) => {
          timeStamp("ERROR:", error.message || error)
          process.exit()
        }
      )
  }

  getDelegations(client) {
    return client.queryClient.getAllValidatorDelegations(client.operator.address, 100, (pages) => {
      timeStamp("...batch", pages.length)
    }).catch(error => {
      timeStamp("ERROR:", error.message || error)
      process.exit()
    })
  }

  async getGrantedAddresses(client, addresses){
    let grantCalls = addresses.map(item => {
      return async () => {
        try {
          const validators = await this.getGrantValidators(client, item)
          return validators ? item : undefined
        } catch (error) {
          timeStamp(item, 'Failed to get address')
        }
      }
    })
    let grantedAddresses = await mapSync(grantCalls, 50, (batch, index) => {
      timeStamp('...batch', index + 1)
    })
    return _.compact(grantedAddresses.flat())
  }

  getGrantValidators(client, delegatorAddress) {
    return client.queryClient.getGrants(client.operator.botAddress, delegatorAddress, {timeout: 5000})
      .then(
        (result) => {
          if(result.claimGrant && result.stakeGrant){
            const grantValidators = result.stakeGrant.authorization.allow_list.address
            if(!grantValidators.includes(client.operator.address)){
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

  async getAutostakeMessages(client, addresses, validators){
    let calls = addresses.map(item => {
      return async () => {
        try {
          return await this.getAutostakeMessage(client, item, validators)
        } catch (error) {
          timeStamp(item, 'Failed to get address')
        }
      }
    })
    let messages = await mapSync(calls, 50, (batch, index) => {
      // timeStamp('...batch', index + 1)
    })
    return _.compact(messages.flat())
  }

  async getAutostakeMessage(client, address, validators){
    const totalRewards = await this.totalRewards(client, address, validators)

    const perValidatorReward = parseInt(totalRewards / validators.length)

    if(perValidatorReward < client.operator.data.minimumReward){
      timeStamp(address, perValidatorReward, client.network.denom, 'reward is too low, skipping')
      return
    }

    timeStamp(address, "Can autostake", perValidatorReward, client.network.denom, validators.length > 1 ? "per validator" : '')

    let messages = validators.map(el => {
      return this.buildRestakeMessage(address, el, perValidatorReward, client.network.denom)
    }).flat()

    return this.buildExecMessage(client.operator.botAddress, messages)
  }

  async autostake(client, messages){
    let batchSize = 50
    let batches = _.chunk(_.compact(messages), batchSize)
    timeStamp('Sending', messages.length, 'messages in', batches.length, 'batches of', batchSize)
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

  buildExecMessage(botAddress, messages){
    return {
      typeUrl: "/cosmos.authz.v1beta1.MsgExec",
      value: {
        grantee: botAddress,
        msgs: messages
      }
    }
  }

  buildRestakeMessage(address, validatorAddress, amount, denom){
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

  totalRewards(client, address, validators){
    return client.queryClient.getRewards(address, {timeout: 5000})
      .then(
        (rewards) => {
          const total = Object.values(rewards).reduce((sum, item) => {
            const reward = item.reward.find(el => el.denom === client.network.denom)
            if(reward && validators.includes(item.validator_address)){
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

  getNetworksData(){
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

const autostake = new Autostake();
const networkName = process.argv[2]
autostake.run(networkName)
