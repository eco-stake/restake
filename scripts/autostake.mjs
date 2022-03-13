import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import Network from '../src/utils/Network.mjs'
import Operator from '../src/utils/Operator.mjs'
import {mapSync, executeSync, overrideNetworks} from '../src/utils/Helpers.mjs'

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
      console.log('Please provide a MNEMONIC environment variable')
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
          return console.log('Failed to connect', error.message)
        }

        if(!client) return console.log('Skipping')

        console.log('Using REST URL', client.network.restUrl)
        console.log('Using RPC URL', client.network.rpcUrl)

        if(!data.overriden) console.log('You are using public nodes, script may fail with many delegations. Check the README to use your own')

        console.log('Running autostake')
        await this.checkBalance(client)

        console.log('Finding delegators...')
        let delegations
        const addresses = await this.getDelegations(client).then(delegations => {
          return delegations.map(delegation => {
            if(delegation.balance.amount === 0) return

            return delegation.delegation.delegator_address
          })
        })

        console.log("Checking", addresses.length, "delegators for grants...")
        let grantedAddresses = await this.getGrantedAddresses(client, addresses)

        console.log("Found", grantedAddresses.length, "delegators with valid grants...")
        let calls = _.compact(grantedAddresses).map(item => {
          return async () => {
            try {
              await this.autostake(client, item, [client.operator.address])
            } catch (error) {
              console.log(item, 'ERROR: Skipping this run -', error.message)
            }
          }
        })
        await executeSync(calls, 1)
      }
    })
    await executeSync(calls, 1)
  }

  async getClient(data){
    const network = await Network(data)

    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(this.mnemonic, {
      prefix: network.prefix
    });

    const accounts = await wallet.getAccounts()
    const botAddress = accounts[0].address

    console.log(network.prettyName, 'bot address is', botAddress)

    const operatorData = data.operators.find(el => el.botAddress === botAddress)

    if(!operatorData) return console.log('Not an operator')
    if(!network.authzSupport) return console.log('No Authz support')
    if(!network.rpcUrl) return console.log('Could not connect to RPC API')
    if(!network.restUrl) return console.log('Could not connect to REST API')

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
          console.log("Bot balance is", balance.amount, balance.denom)
          if(balance.amount < 1_000){
            console.log('Bot balance is too low')
            process.exit()
          }
        },
        (error) => {
          console.log("ERROR:", error.message || error)
          process.exit()
        }
      )
  }

  getDelegations(client) {
    return client.queryClient.getAllValidatorDelegations(client.operator.address, 100, (pages) => {
      console.log("...batch", pages.length)
    }).catch(error => {
      console.log("ERROR:", error.message || error)
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
          console.log(item, 'Failed to get address')
        }
      }
    })
    let grantedAddresses = await mapSync(grantCalls, 100, (batch, index) => {
      console.log('...batch', index + 1)
    })
    return _.compact(grantedAddresses.flat())
  }

  getGrantValidators(client, delegatorAddress) {
    return client.queryClient.getGrants(client.operator.botAddress, delegatorAddress)
      .then(
        (result) => {
          if(result.claimGrant && result.stakeGrant){
            const grantValidators = result.stakeGrant.authorization.allow_list.address
            if(!grantValidators.includes(client.operator.address)){
              console.log(delegatorAddress, "Not autostaking for this validator, skipping")
              return
            }

            return grantValidators
          }
        },
        (error) => {
          console.log(delegatorAddress, "ERROR skipping this run:", error.message || error)
        }
      )
  }

  async autostake(client, address, validators){
    const totalRewards = await this.totalRewards(client, address, validators)

    const perValidatorReward = parseInt(totalRewards / validators.length)

    if(perValidatorReward < client.operator.data.minimumReward){
      console.log(address, perValidatorReward, client.network.denom, 'reward is too low, skipping')
      return
    }

    console.log(address, "Autostaking", perValidatorReward, client.network.denom, validators.length > 1 ? "per validator" : '')

    let messages = validators.map(el => {
      return this.buildRestakeMessage(address, el, perValidatorReward, client.network.denom)
    }).flat()

    let execMsg = this.buildExecMessage(client.operator.botAddress, messages)

    const memo = 'REStaked by ' + client.operator.moniker
    return client.signingClient.signAndBroadcast(client.operator.botAddress, [execMsg], undefined, memo).then((result) => {
      console.log(address, "Successfully broadcasted");
    }, (error) => {
      console.log(address, 'Failed to broadcast:', error.message)
      // Skip on failure
      // process.exit()
    })
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
    return client.queryClient.getRewards(address)
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
          console.log(address, "ERROR skipping this run:", error.message || error)
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
