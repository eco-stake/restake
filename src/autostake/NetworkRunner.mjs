import _ from 'lodash'

import { add, subtract, bignumber, floor, smaller, smallerEq } from 'mathjs'

import { MsgDelegate } from "cosmjs-types/cosmos/staking/v1beta1/tx.js";
import { coin, timeStamp, mapSync, executeSync, parseGrants } from '../utils/Helpers.mjs'

export default class NetworkRunner {
  constructor(network, operator, signingClient, opts) {
    this.network = network
    this.operator = operator
    this.signingClient = signingClient
    this.queryClient = network.queryClient
    this.opts = _.merge({
      batchPageSize: 100,
      batchQueries: 25,
      batchTxs: 50,
      delegationsTimeout: 20000,
      queryTimeout: network.data.autostake?.delegatorTimeout || 5000, // deprecate delegatorTimeout
      queryThrottle: 100,
      gasModifier: 1.1,
    }, network.data.autostake, opts)
    this.batch = {}
    this.messages = []
    this.processed = {}
    this.errors = {}
    this.results = []
  }

  didSucceed() {
    return !this.allErrors().length && !this.error
  }

  allErrors() {
    return [
      ...this.queryErrors(),
      ...this.results.filter(el => el.error).map(el => el.message)
    ]
  }

  queryErrors() {
    return Object.entries(this.errors).map(([address, error]) => {
      return [address, error].join(': ')
    })
  }

  failedAddresses() {
    return [
      ...Object.keys(this.errors),
      ...this.results.filter(el => el.error).map(el => el.addresses).flat()
    ]
  }

  setError(address, error) {
    timeStamp(address, ':', error)
    this.errors[address] = error
  }

  async run(addresses) {
    try {
      timeStamp("Running with options:", this.opts)
      this.balance = await this.getBalance() || 0

      if (addresses) {
        timeStamp("Checking", addresses.length, "addresses for grants...")
      } else {
        timeStamp('Finding delegators...')
        addresses = await this.getDelegations().then(delegations => {
          return delegations.map(delegation => {
            if (delegation.balance.amount === 0) return

            return delegation.delegation.delegator_address
          })
        })
        timeStamp("Checking", addresses.length, "delegators for grants...")
      }

      let grantedAddresses = await this.getGrantedAddresses(addresses)

      timeStamp("Found", grantedAddresses.length, "addresses with valid grants...")
      if (grantedAddresses.length) {
        await this.autostake(grantedAddresses)
      }
      return true
    } catch (error) {
      this.error = error
      return false
    }
  }

  getBalance() {
    let timeout = this.opts.delegationsTimeout
    return this.queryClient.getBalance(this.operator.botAddress, this.network.denom, { timeout })
      .then(
        (balance) => {
          timeStamp("Bot balance is", balance.amount, balance.denom)
          return balance.amount
        },
        (error) => {
          throw new Error(`Failed to get balance: ${error.message || error}`)
        }
      )
  }

  getDelegations() {
    let timeout = this.opts.delegationsTimeout
    let pageSize = this.opts.batchPageSize
    return this.queryClient.getAllValidatorDelegations(this.operator.address, pageSize, { timeout }, (pages) => {
      timeStamp("...batch", pages.length)
      return this.throttleQuery()
    }).catch(error => {
      throw new Error(`Failed to get delegations: ${error.message || error}`)
    })
  }

  async getGrantedAddresses(addresses) {
    const { botAddress, address } = this.operator
    let timeout = this.opts.delegationsTimeout
    let pageSize = this.opts.batchPageSize
    let allGrants
    try {
      allGrants = await this.queryClient.getGranteeGrants(botAddress, { timeout, pageSize }, (pages) => {
        timeStamp("...batch", pages.length)
        return this.throttleQuery()
      })
    } catch (e) { }
    let grantCalls = addresses.map(item => {
      return async () => {
        if (allGrants) return this.parseGrantResponse(allGrants, botAddress, item, address)
        try {
          return await this.getGrants(item)
        } catch (error) {
          this.setError(item, `Failed to get grants: ${error.message}`)
        }
      }
    })
    let grantedAddresses = await mapSync(grantCalls, this.opts.batchQueries, (batch, index) => {
      timeStamp('...batch', index + 1)
      return this.throttleQuery()
    })
    return _.compact(grantedAddresses.flat())
  }

  getGrants(delegatorAddress) {
    const { botAddress, address } = this.operator
    let timeout = this.opts.queryTimeout
    return this.queryClient.getGrants(botAddress, delegatorAddress, { timeout })
      .then(
        (result) => {
          return this.parseGrantResponse(result, botAddress, delegatorAddress, address)
        },
        (error) => {
          this.setError(delegatorAddress, `ERROR failed to get grants: ${error.message || error}`)
        }
      )
  }

  parseGrantResponse(grants, botAddress, delegatorAddress, validatorAddress) {
    const result = parseGrants(grants, botAddress, delegatorAddress)
    let grantValidators, maxTokens
    if (result.stakeGrant) {
      if (result.stakeGrant.authorization['@type'] === "/cosmos.authz.v1beta1.GenericAuthorization") {
        timeStamp(delegatorAddress, "Using GenericAuthorization, allowed")
        grantValidators = [validatorAddress];
      } else {
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

  async getAutostakeMessage(grantAddress) {
    const { address, grant } = grantAddress

    let timeout = this.opts.queryTimeout
    let withdrawAddress, totalRewards
    try {
      withdrawAddress = await this.queryClient.getWithdrawAddress(address, { timeout })
    } catch (error) {
      this.setError(address, `ERROR failed to get withdraw address: ${error.message || error}`)
      return
    }
    if (withdrawAddress && withdrawAddress !== address) {
      timeStamp(address, 'has a different withdraw address:', withdrawAddress)
      return
    }

    try {
      totalRewards = await this.totalRewards(address)
    } catch (error) {
      this.setError(address, `ERROR failed to get rewards: ${error.message || error}`)
      return
    }
    if (totalRewards === undefined) return

    let autostakeAmount = floor(totalRewards)

    if (smaller(bignumber(autostakeAmount), bignumber(this.operator.minimumReward))) {
      timeStamp(address, autostakeAmount, this.network.denom, 'reward is too low, skipping')
      return
    }

    if (grant.maxTokens) {
      if (smallerEq(grant.maxTokens, 0)) {
        timeStamp(address, grant.maxTokens, this.network.denom, 'grant balance is empty, skipping')
        return
      }
      if (smaller(grant.maxTokens, autostakeAmount)) {
        autostakeAmount = grant.maxTokens
        timeStamp(address, grant.maxTokens, this.network.denom, 'grant balance is too low, using remaining')
      }
    }

    timeStamp(address, "Can autostake", autostakeAmount, this.network.denom)

    return this.buildRestakeMessage(address, this.operator.address, autostakeAmount, this.network.denom)
  }

  async autostake(grantedAddresses) {
    let batchSize = this.opts.batchTxs
    timeStamp('Calculating and autostaking in batches of', batchSize)

    const calls = grantedAddresses.map((item, index) => {
      return async () => {
        let messages
        try {
          messages = await this.getAutostakeMessage(item)
        } catch (error) {
          this.setError(item.address, `ERROR Failed to get autostake message ${error.message}`)
        }
        this.processed[item.address] = true

        await this.sendInBatches(item.address, messages, batchSize, grantedAddresses.length)
      }
    })
    await executeSync(calls, this.opts.batchQueries)

    this.results = await Promise.all(this.messages)
  }

  async sendInBatches(address, messages, batchSize, total) {
    if (messages) {
      this.batch[address] = messages
    }

    const addresses = Object.keys(this.batch)
    const finished = (Object.keys(this.processed).length >= total && addresses.length > 0)
    if (addresses.length >= batchSize || finished) {
      const batch = Object.values(this.batch).flat()
      this.batch = {}

      const messages = [...this.messages]
      const promise = messages[messages.length - 1] || Promise.resolve()
      const sendTx = promise.then(() => {
        timeStamp('Sending batch', messages.length + 1)
        return this.sendMessages(addresses, batch)
      })
      this.messages.push(sendTx)
      return sendTx
    }
  }

  async sendMessages(addresses, messages) {
    try {
      const execMsg = this.buildExecMessage(this.operator.botAddress, messages)
      const memo = 'REStaked by ' + this.operator.moniker
      const gasModifier = this.opts.gasModifier
      const gas = await this.signingClient.simulate(this.operator.botAddress, [execMsg], memo, gasModifier);
      const fee = this.signingClient.getFee(gas).amount[0]
      if (smaller(bignumber(this.balance), bignumber(fee.amount))) {
        this.forceFail = true
        throw new Error(`Bot balance is too low (${this.balance}/${fee.amount}${fee.denom})`)
      }

      if (this.opts.dryRun) {
        const message = `DRYRUN: Would send ${messages.length} messages using ${gas} gas`
        timeStamp(message)
        this.balance = subtract(bignumber(this.balance), bignumber(fee.amount))
        return { message, addresses }
      } else {
        return await this.signingClient.signAndBroadcast(this.operator.botAddress, [execMsg], gas, memo).then((response) => {
          const message = `Sent ${messages.length} messages - ${response.transactionHash}`
          timeStamp(message)
          this.balance = subtract(bignumber(this.balance), bignumber(fee.amount))
          return { message, addresses }
        }, (error) => {
          const message = `Failed ${messages.length} messages - ${error.message}`
          timeStamp(message)
          return { message, addresses, error }
        })
      }
    } catch (error) {
      const message = `Failed ${messages.length} messages: ${error.message}`
      timeStamp(message)
      return { message, addresses, error }
    }
  }

  async throttleQuery(){
    if(!this.opts.queryThrottle) return 

    await new Promise(r => setTimeout(r, this.opts.queryThrottle));
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

  totalRewards(address) {
    let timeout = this.opts.queryTimeout
    return this.queryClient.getRewards(address, { timeout })
      .then(
        (rewards) => {
          const total = Object.values(rewards).reduce((sum, item) => {
            const reward = item.reward.find(el => el.denom === this.network.denom)
            if (reward && item.validator_address === this.operator.address) {
              return add(sum, bignumber(reward.amount))
            }
            return sum
          }, 0)
          return total
        }
      )
  }
}
