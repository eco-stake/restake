import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import Network from '../src/utils/Network.mjs'
import Operator from '../src/utils/Operator.mjs'
import {filterAsync} from '../src/utils/Helpers.mjs'

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

  async run(){
    const calls = this.getNetworksData().map(data => {
      return async () => {
        console.log('Checking', data.name)
        const client = await this.getClient(data)
        if(!client) return

        console.log('Running autostake')
        await this.checkBalance(client)
        let delegations
        const addresses = await this.getDelegations(client).then(delegations => {
          return delegations.map(delegation => {
            if(delegation.balance.amount === 0) return

            return delegation.delegation.delegator_address
          })
        })

        const grantedAddresses = await filterAsync(addresses, (address) => {
          return this.getGrantValidators(client, address).then(validators => {
            return !!validators
          })
        })

        let calls = _.compact(grantedAddresses).map(item => {
          return async () => {
            await this.autostake(client, item, [client.operator.address])
          }
        })
        await this.executeSync(calls, 1)
      }
    })
    await this.executeSync(calls, 1)
  }

  async executeSync(calls, count){
    const batchCalls = _.chunk(calls, count);
    for (const batchCall of batchCalls) {
      await Promise.all(batchCall.map(call => call()))
    }
  }

  getNetworksData(){
    let response = fs.readFileSync('src/networks.json');
    return JSON.parse(response);
  }

  async getClient(data){
    const network = await Network(data)
    if(!network.connected) return null

    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(this.mnemonic, {
      prefix: network.prefix
    });

    const accounts = await wallet.getAccounts()
    const botAddress = accounts[0].address
    console.log('Your bot address for', data.name, 'is', botAddress)

    const client = await network.signingClient(wallet)
    if(!client.connected) return null

    client.registry.register("/cosmos.authz.v1beta1.MsgExec", MsgExec)
    const operatorData = data.operators.find(el => el.botAddress === botAddress)

    if(!operatorData){
      return null
    }

    const operator = Operator(operatorData)

    return{
      network: network,
      operator: operator,
      signingClient: client,
      restClient: network.restClient
    }
  }

  checkBalance(client) {
    return client.restClient.getBalance(client.operator.botAddress, client.network.denom)
      .then(
        (balance) => {
          console.log("Bot balance is", balance.amount, balance.denom)
          if(balance.amount < 1_000){
            console.log('Bot balance is too low')
            process.exit()
          }
        },
        (error) => {
          console.log("ERROR:", error)
          process.exit()
        }
      )
  }

  getDelegations(client) {
    return client.restClient.getValidatorDelegations(client.operator.address, 1_000)
      .then(
        (delegations) => {
          console.log("Checking", delegations.length, "delegators for grants..")
          return delegations
        },
        (error) => {
          console.log("ERROR:", error)
          process.exit()
        }
      )
  }

  getGrantValidators(client, delegatorAddress) {
    return client.restClient.getGrants(client.operator.botAddress, delegatorAddress)
      .then(
        (result) => {
          if(result.claimGrant || result.stakeGrant){
            console.log(delegatorAddress, "Grants found")
            if(result.claimGrant && result.stakeGrant){
              const grantValidators = result.stakeGrant.authorization.allow_list.address
              if(!grantValidators.includes(client.operator.address)){
                console.log(delegatorAddress, "Not autostaking for this validator, skipping")
                return
              }
              console.log(delegatorAddress, "Grants valid")

              return grantValidators
            }else{
              console.log(delegatorAddress, "Grants invalid")
            }
          }
        },
        (error) => {
          console.log("ERROR:", error)
          process.exit()
        }
      )
  }

  async autostake(client, address, validators){
    const totalRewards = await this.totalRewards(client, address, validators)
    const perValidatorReward = parseInt(totalRewards / validators.length)
    console.log(address, "Total rewards", totalRewards, client.network.denom)
    console.log(address, "Autostaking", perValidatorReward, client.network.denom, "per validator")

    if(perValidatorReward < client.operator.data.minimumReward){
      console.log(address, 'Reward is too low, skipping')
      return
    }

    let messages = validators.map(el => {
      return [{
        typeUrl: "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward",
        value: MsgWithdrawDelegatorReward.encode(MsgWithdrawDelegatorReward.fromPartial({
          delegatorAddress: address,
          validatorAddress: el
        })).finish()
      }, {
        typeUrl: "/cosmos.staking.v1beta1.MsgDelegate",
        value: MsgDelegate.encode(MsgDelegate.fromPartial({
          delegatorAddress: address,
          validatorAddress: el,
          amount: coin(perValidatorReward, client.network.denom)
        })).finish()
      }]
    }).flat()

    let execMsg = {
      typeUrl: "/cosmos.authz.v1beta1.MsgExec",
      value: {
        grantee: client.operator.botAddress,
        msgs: messages
      }
    }

    const memo = 'REStaked by ' + client.operator.moniker
    return client.signingClient.signAndBroadcast(client.operator.botAddress, [execMsg], undefined, memo).then((result) => {
      console.log(address, "Successfully broadcasted");
    }, (error) => {
      console.log(address, 'Failed to broadcast:', error)
      process.exit()
    })
  }

  totalRewards(client, address, validators){
    return client.restClient.getRewards(address)
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
          console.log(address, "ERROR:", error)
          process.exit()
        }
      )
  }
}

const autostake = new Autostake();
autostake.run()
