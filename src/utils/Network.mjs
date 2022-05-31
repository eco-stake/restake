import _ from 'lodash'
import { multiply, pow, format, bignumber } from 'mathjs'
import QueryClient from './QueryClient.mjs'
import SigningClient from './SigningClient.mjs'
import Operator from './Operator.mjs'
import Chain from './Chain.mjs'
import CosmosDirectory from './CosmosDirectory.mjs'

class Network {
  constructor(data) {
    this.data = data
    this.enabled = data.enabled
    this.experimental = data.experimental
    this.apyEnabled = data.apyEnabled
    this.name = data.path || data.name
    this.default = data.default
    this.directory = CosmosDirectory()

    this.rpcUrl = this.directory.rpcUrl(this.name) // only used for Keplr suggestChain
    this.restUrl = data.restUrl || this.directory.restUrl(this.name)

    this.usingDirectory = !![this.restUrl].find(el => {
      const match = el => el.match("cosmos.directory")
      if (Array.isArray(el)) {
        return el.find(match)
      } else {
        return match(el)
      }
    })
  }

  connectedDirectory() {
    const apis = this.chain ? this.chain.chainData['best_apis'] : this.data['best_apis']
    return apis && ['rest'].every(type => apis[type].length > 0)
  }

  async load() {
    this.chain = await Chain(this.data)
    this.validators = await this.directory.getValidators(this.name)
    this.operators = (this.data.operators || this.validators.filter(el => el.restake)).map(el => {
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
    this.estimatedApr = this.chain.estimatedApr
    this.authzSupport = this.chain.authzSupport
    const defaultGasPrice = format(bignumber(multiply(0.000000025, pow(10, this.decimals))), { notation: 'fixed' }) + this.denom
    this.gasPrice = this.data.gasPrice || defaultGasPrice
    this.gasPriceStep = this.data.gasPriceStep
    this.gasPricePrefer = this.data.gasPricePrefer
    this.gasModifier = this.data.gasModifier || 1.3
    this.txTimeout = this.data.txTimeout || 60_000
  }

  async connect() {
    try {
      this.queryClient = await QueryClient(this.chain.chainId, this.restUrl)
      this.restUrl = this.queryClient.restUrl
      this.connected = this.queryClient.connected && (!this.usingDirectory || this.connectedDirectory())
    } catch (error) {
      console.log(error)
      this.connected = false
    }
  }

  async getApy(validators, operators){
    const chainApr = this.chain.estimatedApr
    let validatorApy = {};
    for (const [address, validator] of Object.entries(validators)) {
      if(validator.jailed || validator.status !== 'BOND_STATUS_BONDED'){
        validatorApy[address] = 0
      }else{
        const commission = validator.commission.commission_rates.rate
        const operator = operators.find((el) => el.address === address)
        const periodPerYear = operator && this.chain.authzSupport ? operator.runsPerDay() * 365 : 1;
        const realApr = chainApr * (1 - commission);
        const apy = (1 + realApr / periodPerYear) ** periodPerYear - 1;
        validatorApy[address] = apy;
      }
    }
    return validatorApy;
  }

  signingClient(wallet, key, gasPrice) {
    if (!this.queryClient)
      return

    return SigningClient(this, gasPrice || this.gasPrice, wallet, key)
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
