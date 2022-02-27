import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import SigningClient from '../src/SigningClient.mjs'
import RestClient from '../src/RestClient.mjs'
import Network from '../src/Network.mjs'
import Operator from '../src/Operator.mjs'

import {
  coin
} from '@cosmjs/stargate'

import { MsgWithdrawDelegatorReward } from "cosmjs-types/cosmos/distribution/v1beta1/tx.js";
import { MsgDelegate } from "cosmjs-types/cosmos/staking/v1beta1/tx.js";
import { MsgExec } from "cosmjs-types/cosmos/authz/v1beta1/tx.js";

import fs from 'fs'

class Autostake {
  constructor(){
    this.mnemonic = process.env.MNEMONIC
    if(!this.mnemonic){
      console.log('Please provide a MNEMONIC environment variable')
      process.exit()
    }
  }

  async run(addresses){
    this.getNetworksData().forEach(async (data) => {
      const client = await this.getClient(data)
      if(!client) return

      console.log('Running autostake bot', client.operator.botAddress)
      if(addresses !== undefined){
        addresses = Array.isArray(addresses) ? addresses : [addresses]
        console.log('for addresses', addresses)
      }
      await this.checkBalance(client)
      let delegations
      if(!addresses){
        delegations = await this.getDelegations(client)
      }
      this.getGrantsAndAutostake(client, delegations, addresses)
    })
  }

  getNetworksData(){
    let response = fs.readFileSync('public/networks.json');
    return JSON.parse(response);
  }

  async getClient(data){
    const network = Network(data)
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(this.mnemonic, {
      prefix: network.prefix
    });
    const client = await SigningClient(network, wallet)
    client.registry.register("/cosmos.authz.v1beta1.MsgExec", MsgExec)
    const botAddress = await client.getAddress()
    const operatorData = data.operators.find(el => el.botAddress === botAddress)

    if(!operatorData){
      return null
    }

    const operator = Operator(operatorData)

    return{
      network: network,
      operator: operator,
      rpcUrl: network.rpcUrl,
      restUrl: network.restUrl,
      validatorAddress: operator.address,
      maxValidators: operator.data.maxValidators,
      minimumReward: operator.data.minimumReward,
      signingClient: client,
      restClient: RestClient(network.restUrl)
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

  getGrantsAndAutostake(client, delegations, addresses) {
    addresses = addresses === undefined ? delegations : addresses
    addresses.forEach(item => {
      if(item.balance && item.balance.amount === 0) return

      const delegatorAddress = item.delegation ? item.delegation.delegator_address : item
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
                if(grantValidators.size > client.operator.data.maxValidators){
                  console.log(delegatorAddress, "Autostaking for too many validators, skipping")
                  return
                }
                console.log(delegatorAddress, "Can autostake for:", grantValidators)

                return this.autostake(client, delegatorAddress, grantValidators)
              }else{
                console.log(delegatorAddress, "Missing required grants")
              }
            }
          },
          (error) => {
            console.log("ERROR:", error)
            process.exit()
          }
        )
    })
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

    const gas = validators.reduce((sum, el) => {
      return 200_000
    }, 0)
    const memo = 'REStaked by ' + client.operator.moniker
    return client.signingClient.signAndBroadcast(client.operator.botAddress, [execMsg], gas, memo).then((result) => {
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
