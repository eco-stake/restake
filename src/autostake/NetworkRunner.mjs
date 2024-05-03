import _ from 'lodash'

import { add, subtract, bignumber, floor, smaller, smallerEq } from 'mathjs'

import { MsgDelegate } from "cosmjs-types/cosmos/staking/v1beta1/tx.js";
import { coin, mapSync, executeSync, parseGrants, createLogger } from '../utils/Helpers.mjs'

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

    this.logger = createLogger('network_runner').child({ chain: network.name })
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
    this.logger.error(error, { address })
    this.errors[address] = error
  }

  async run(addresses) {
    try {
      this.logger.info('Running with options', this.opts)
      this.balance = await this.getBalance() || 0

      let grantedAddresses = await this.getAddressesFromGrants(addresses)
      if(grantedAddresses === false){
        this.logger.warn('All grants query not supported, falling back to checking delegators...')
        grantedAddresses = await this.getAddressesFromDelegators(addresses)
      }

      this.logger.info('Found addresses with valid grants...', { count: grantedAddresses.length})
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
          this.logger.info('Fetched bot balance', balance)
          return balance.amount
        },
        (error) => {
          throw new Error(`Failed to get balance: ${error.message || error}`)
        }
      )
  }

  async getAddressesFromGrants(addresses) {
    const { botAddress, address } = this.operator
    let timeout = this.opts.delegationsTimeout
    let pageSize = this.opts.batchPageSize
    let allGrants
    try {
      this.logger.info('Finding all grants...')
      allGrants = await this.queryClient.getGranteeGrants(botAddress, { timeout, pageSize }, (pages) => {
        this.logger.info('...batch', { length: pages.length })
        return this.throttleQuery()
      })
    } catch (error) {
      if(error.response?.status === 501){
        return false
      }else{
        throw new Error('Failed to load grants')
      }
    }
    if (addresses){
      this.logger.info('Checking addresses for grants...', { length: addresses.length })
    } else {
      addresses = allGrants.map(grant => grant.granter)
    }
    let addressGrants = _.uniq(addresses).map(item => {
      return this.parseGrantResponse(allGrants, botAddress, item, address)
    })
    return _.compact(addressGrants.flat())
  }

  async getAddressesFromDelegators(addresses) {
    if (!addresses) {
      this.logger.info('Finding delegators...')
      addresses = await this.getDelegations().then(delegations => {
        return delegations.map(delegation => {
          if (delegation.balance.amount === 0) return

          return delegation.delegation.delegator_address
        })
      })
      this.logger.info('Checking delegators for grants...', { length: addresses.length })
    } else {
      this.logger.info('Checking addresses for grants...', { length: addresses.length })
    }
    let grantCalls = _.uniq(addresses).map(item => {
      return async () => {
        try {
          return await this.getGrantsIndividually(item)
        } catch (error) {
          this.setError(item, `Failed to get grants: ${error.message}`)
        }
      }
    })
    let grantedAddresses = await mapSync(grantCalls, this.opts.batchQueries, (batch, index) => {
      this.logger.info('...batch', { count: index + 1 })
      return this.throttleQuery()
    })
    return _.compact(grantedAddresses.flat())
  }

  getDelegations() {
    let timeout = this.opts.delegationsTimeout
    let pageSize = this.opts.batchPageSize
    return this.queryClient.getAllValidatorDelegations(this.operator.address, pageSize, { timeout }, (pages) => {
      this.logger.info('...batch', { count: pages.length })
      return this.throttleQuery()
    }).catch(error => {
      throw new Error(`Failed to get delegations: ${error.message || error}`)
    })
  }

  getGrantsIndividually(delegatorAddress) {
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
        grantValidators = [validatorAddress];
      } else {
        const { allow_list, deny_list } = result.stakeGrant.authorization
        if(allow_list?.address){
          grantValidators = allow_list?.address || []
        }else if(deny_list?.address){
          grantValidators = deny_list.address.includes(validatorAddress) || deny_list.address.includes('') ? [] : [validatorAddress]
        }else{
          grantValidators = []
        }
        if (!grantValidators.includes(validatorAddress)) {
          this.logger.info('Not autostaking for this validator, skipping', { delegatorAddress })
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
      this.logger.info('Wallet has a different withdraw address', {
        withdrawAddress,
        address
      })
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
      this.logger.info('Reward is too low, skipping', {
        address,
        amount: autostakeAmount,
        denom: this.network.denom, 
      })
      return
    }

    if (grant.maxTokens) {
      if (smallerEq(grant.maxTokens, 0)) {
        this.logger.info('Grant balance is empty, skipping', {
          address,
          maxTokens: grant.maxToken,
          denom: this.network.denom,
        })
        return
      }
      if (smaller(grant.maxTokens, autostakeAmount)) {
        autostakeAmount = grant.maxTokens
        this.logger.info('Grant balance is too low, using remaining', {
          address,
          maxTokens: grant.maxToken,
          denom: this.network.denom,
        })
      }
    }

    this.logger.info('Can autostake', {
      address,
      amount: autostakeAmount,
      denom: this.network.denom,
    })

    return this.buildRestakeMessage(address, this.operator.address, autostakeAmount, this.network.denom)
  }

  async autostake(grantedAddresses) {
    let batchSize = this.opts.batchTxs
    this.logger.info('Calculating and autostaking in batches', { batchSize })

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
        this.logger.info('Sending batch', { batch: messages.length + 1 })
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
        this.logger.info('DRYRUN: Would send messages using gas', {
          messages: messages.length,
          gas,
        })
        this.balance = subtract(bignumber(this.balance), bignumber(fee.amount))
        return { message, addresses }
      } else {
        return await this.signingClient.signAndBroadcast(this.operator.botAddress, [execMsg], gas, memo).then((response) => {
          const message = `Sent ${messages.length} messages - ${response.transactionHash}`
          this.logger.info('Sent messages', {
            transactionHash: response.transactionHash,
            length: messages.length,
          })
          this.balance = subtract(bignumber(this.balance), bignumber(fee.amount))
          return { message, addresses }
        }, (error) => {
          const message = `Failed ${messages.length} messages - ${error.message}`
          this.logger.info('Failed messages', {
            error: error.message,
            length: messages.length,
          })
          return { message, addresses, error }
        })
      }
    } catch (error) {
      const message = `Failed ${messages.length} messages: ${error.message}`
      this.logger.info('Failed messages', {
        error: error.message,
        length: messages.length,
      })
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
