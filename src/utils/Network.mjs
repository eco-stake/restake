import _ from 'lodash'
import { multiply, pow, format, bignumber } from 'mathjs'
import QueryClient from './QueryClient.mjs'
import SigningClient from './SigningClient.mjs'
import ApyClient from '../ApyClient.mjs'
import Operator from './Operator.mjs'
import Chain from './Chain.mjs'
import CosmosDirectory from './CosmosDirectory.mjs'
import DesmosSigningClient from './DesmosSigningClient.mjs'

class Network {
  constructor(data) {
    this.SIGNERS = {
      desmos: DesmosSigningClient
    }

    this.data = data
    this.enabled = data.enabled
    this.apyEnabled = data.apyEnabled
    this.name = data.name
    this.directory = CosmosDirectory()

    this.rpcUrl = data.rpcUrl || this.directory.rpcUrl(data.name)
    this.restUrl = data.restUrl || this.directory.restUrl(data.name)

    this.usingDirectory = !![this.restUrl, this.rpcUrl].find(el => {
      const match = el => el.match("cosmos.directory")
      if (Array.isArray(el)) {
        return el.find(match)
      } else {
        return match(el)
      }
    })
  }

  async load() {
    this.chain = await Chain(this.data)
    this.validators = await this.directory.getValidators(this.data.name)
    this.operators = this.data.operators || this.validators.filter(el => el.restake).map(el => {
      return Operator(el)
    })
    this.prettyName = this.chain.prettyName
    this.chainId = this.chain.chainId
    this.prefix = this.chain.prefix
    this.slip44 = this.chain.slip44
    this.denom = this.chain.denom
    this.symbol = this.chain.symbol
    this.decimals = this.chain.decimals
    this.image = this.chain.image
    this.coinGeckoId = this.chain.coinGeckoId
    this.authzSupport = this.chain.authzSupport
    const defaultGasPrice = format(bignumber(multiply(0.000000025, pow(10, this.chain.decimals))), { notation: 'fixed' }) + this.chain.denom
    this.gasPrice = this.data.gasPrice || defaultGasPrice
    this.gasPriceStep = this.data.gasPriceStep
  }

  async connect() {
    try {
      this.queryClient = await QueryClient(this.chain.chainId, this.rpcUrl, this.restUrl)
      this.apyClient = ApyClient(this.chain, this.queryClient.rpcUrl, this.queryClient.restUrl)
      this.restUrl = this.queryClient.restUrl
      this.rpcUrl = this.queryClient.rpcUrl
      this.getApy = this.apyClient.getApy
      this.connected = this.queryClient.connected
    } catch (error) {
      console.log(error)
      this.connected = false
    }
  }

  signingClient(wallet, key) {
    if (!this.queryClient)
      return

    const client = this.SIGNERS[this.data.name] || SigningClient
    return client(this.queryClient.rpcUrl, this.gasPrice, wallet, key)
  }

  getOperator(operatorAddress) {
    return this.operators.find(elem => elem.address === operatorAddress)
  }

  getOperatorByBotAddress(botAddress) {
    return this.operators.find(elem => elem.botAddress === botAddress)
  }

  getOperators() {
    return this.sortOperators()
  }

  sortOperators() {
    const random = _.shuffle(this.operators)
    if (this.data.ownerAddress) {
      return _.sortBy(random, ({ address }) => address === this.data.ownerAddress ? 0 : 1)
    }
    return random
  }

  getValidators(opts) {
    opts = opts || {}
    return this.validators.filter(validator => {
      if (opts.status)
        return validator.status === opts.status
      return true
    }).reduce(
      (a, v) => ({ ...a, [v.operator_address]: v }),
      {}
    )
  }
}

export default Network;
