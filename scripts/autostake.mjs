import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import SigningClient from '../src/SigningClient.mjs'
import RestClient from '../src/RestClient.mjs'

import {
  coin
} from '@cosmjs/stargate'

import { MsgWithdrawDelegatorReward } from "cosmjs-types/cosmos/distribution/v1beta1/tx.js";
import { MsgDelegate } from "cosmjs-types/cosmos/staking/v1beta1/tx.js";

class Autostake {
  constructor(){
    this.rpcUrl = process.env.REACT_APP_RPC_URL
    this.restUrl = process.env.REACT_APP_REST_URL
    this.validatorAddress = process.env.REACT_APP_VALIDATOR_ADDRESS
    this.botAddress = process.env.REACT_APP_BOT_ADDRESS
    this.maxValidators = process.env.REACT_APP_MAX_VALIDATORS
    this.mnemonic = process.env.MNEMONIC
    this.restClient = RestClient(this.restUrl)
    this.minimumReward = 1_000
    if(!this.mnemonic){
      console.log('Please provide a MNEMONIC environment variable')
      process.exit()
    }
  }

  async run(addresses){
    console.log('Running autostake bot', this.botAddress)
    if(addresses !== undefined){
      addresses = Array.isArray(addresses) ? addresses : [addresses]
      console.log('for addresses', addresses)
    }
    await this.getClient()
    await this.getBalance()
    if(!addresses){
      await this.getDelegations()
    }
    this.getGrantsAndAutostake(addresses)
  }

  async getClient(){
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(this.mnemonic, {
      prefix: "osmo",
    });
    this.client = await SigningClient(this.rpcUrl, wallet)
    const address = await this.client.getAddress()
    if(!this.botAddress === address){
      console.log('botAddress does not match MNEMONIC')
      process.exit()
    }
  }

  getBalance() {
    return this.restClient.getBalance(this.botAddress)
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

  getDelegations() {
    return this.restClient.getValidatorDelegations(this.validatorAddress, 1_000)
      .then(
        (delegations) => {
          this.delegations = delegations
          console.log("Checking", this.delegations.length, "delegators for grants..")
        },
        (error) => {
          console.log("ERROR:", error)
          process.exit()
        }
      )
  }

  getGrantsAndAutostake(addresses) {
    addresses = addresses === undefined ? this.delegations : addresses
    addresses.forEach(item => {
      if(item.balance && item.balance.amount === 0) return

      const delegatorAddress = item.delegation ? item.delegation.delegator_address : item
      return this.restClient.getGrants(this.botAddress, delegatorAddress)
        .then(
          (result) => {
            if(result.claimGrant || result.stakeGrant){
              console.log(delegatorAddress, "Grants found")
              if(result.claimGrant && result.stakeGrant){
                const grantValidators = result.stakeGrant.authorization.allow_list.address
                if(!grantValidators.includes(this.validatorAddress)){
                  console.log(delegatorAddress, "Not autostaking for this validator, skipping")
                  return
                }
                if(grantValidators.size > this.maxValidators){
                  console.log(delegatorAddress, "Autostaking for too many validators, skipping")
                  return
                }
                console.log(delegatorAddress, "Can autostake for:", grantValidators)

                return this.autostake(delegatorAddress, grantValidators)
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

  async autostake(address, validators){
    const totalRewards = await this.totalRewards(address, validators)
    const perValidatorReward = parseInt(totalRewards / validators.length)
    console.log(address, "Total rewards", totalRewards, "uosmo")
    console.log(address, "Autostaking", perValidatorReward, "uosmo per validator")

    if(perValidatorReward < this.minimumReward){
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
          amount: coin(perValidatorReward, 'uosmo')
        })).finish()
      }]
    }).flat()

    let execMsg = {
      typeUrl: "/cosmos.authz.v1beta1.MsgExec",
      value: {
        grantee: this.botAddress,
        msgs: messages
      }
    }

    return this.client.signAndBroadcast(this.botAddress, [execMsg], 800_000, 'REStaked by ECO Stake 🌱').then((result) => {
      console.log(address, "Successfully broadcasted");
    }, (error) => {
      console.log(address, 'Failed to broadcast:', error)
      process.exit()
    })
  }

  totalRewards(address, validators){
    return this.restClient.getRewards(address)
      .then(
        (rewards) => {
          const total = Object.values(rewards).reduce((sum, item) => {
            const reward = item.reward.find(el => el.denom === 'uosmo')
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
