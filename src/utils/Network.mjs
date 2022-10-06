import _ from 'lodash'
import { multiply, pow, format, bignumber } from 'mathjs'
import {
  GasPrice,
} from "@cosmjs/stargate";
import QueryClient from './QueryClient.mjs'
import Validator from './Validator.mjs'
import Operator from './Operator.mjs'
import Chain from './Chain.mjs'
import CosmosDirectory from './CosmosDirectory.mjs'

class Network {
  constructor(data, operatorAddresses) {
    this.data = data
    this.enabled = data.enabled
    this.experimental = data.experimental
    this.operatorAddresses = operatorAddresses || {}
    this.operatorCount = data.operators?.length || this.estimateOperatorCount()
    this.name = data.path || data.name
    this.path = data.path || data.name
    this.image = data.image
    this.prettyName = data.prettyName || data.pretty_name
    this.default = data.default
    this.testnet = data.testnet || data.network_type === 'testnet'
    this.setChain(this.data)

    this.directory = CosmosDirectory(this.testnet)
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
    this.online = !this.usingDirectory || this.connectedDirectory()
  }

  connectedDirectory() {
    const proxy_status = this.chain ? this.chain['proxy_status'] : this.data['proxy_status']
    return proxy_status && ['rest'].every(type => proxy_status[type])
  }

  estimateOperatorCount() {
    if(!this.operatorAddresses) return 0 
    return Object.keys(this.operatorAddresses).filter(el => this.allowOperator(el)).length
  }

  allowOperator(address){
    const allow = this.data.allowOperators
    const block = this.data.blockOperators
    if(allow && !allow.includes(address)) return false
    if(block && block.includes(address)) return false
    return true
  }

  async load() {
    const chainData = await this.directory.getChainData(this.data.name);
    this.setChain({...this.data, ...chainData})
    this.validators = (await this.directory.getValidators(this.name)).map(data => {
      return Validator(this, data)
    })
    this.operators = (this.data.operators || this.validators.filter(el => el.restake && this.allowOperator(el.operator_address))).map(data => {
      return Operator(this, data)
    })
    this.operatorCount = this.operators.length
  }

  async setChain(data){
    this.chain = Chain(data)
    this.prettyName = this.chain.prettyName
    this.chainId = this.chain.chainId
    this.prefix = this.chain.prefix
    this.slip44 = this.chain.slip44
    this.assets = this.chain.assets
    this.baseAsset = this.chain.baseAsset
    this.denom = this.chain.denom
    this.display = this.chain.display
    this.symbol = this.chain.symbol
    this.decimals = this.chain.decimals
    this.image = this.chain.image
    this.coinGeckoId = this.chain.coinGeckoId
    this.estimatedApr = this.chain.estimatedApr
    this.apyEnabled = data.apyEnabled !== false && !!this.estimatedApr && this.estimatedApr > 0
    this.authzSupport = this.chain.authzSupport
    this.authzAminoSupport = this.chain.authzAminoSupport
    this.defaultGasPrice = this.decimals && format(bignumber(multiply(0.000000025, pow(10, this.decimals))), { notation: 'fixed', precision: 4}) + this.denom
    this.gasPrice = this.data.gasPrice || this.defaultGasPrice
    if(this.gasPrice){
      this.gasPriceAmount = GasPrice.fromString(this.gasPrice).amount.toString()
      this.gasPriceStep = this.data.gasPriceStep || {
        "low": multiply(this.gasPriceAmount, 0.5),
        "average": multiply(this.gasPriceAmount, 1),
        "high": multiply(this.gasPriceAmount, 2)
      }
    }
    this.gasPricePrefer = this.data.gasPricePrefer
    this.gasModifier = this.data.gasModifier || 1.5
    this.txTimeout = this.data.txTimeout || 60_000
    this.keywords = this.buildKeywords()
  }

  async connect(opts) {
    try {
      this.queryClient = await QueryClient(this.chain.chainId, this.restUrl, { connectTimeout: opts?.timeout })
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
        const periodPerYear = operator && this.chain.authzSupport ? operator.runsPerDay(this.data.maxPerDay) * 365 : 1;
        const realApr = chainApr * (1 - commission);
        const apy = (1 + realApr / periodPerYear) ** periodPerYear - 1;
        validatorApy[address] = apy;
      }
    }
    return validatorApy;
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
    return (this.validators || []).filter(validator => {
      if (opts.status)
        return validator.status === opts.status
      return true
    }).reduce(
      (a, v) => ({ ...a, [v.operator_address]: v }),
      {}
    )
  }

  suggestChain(){
    const currency = {
      coinDenom: this.symbol,
      coinMinimalDenom: this.denom,
      coinDecimals: this.decimals
    }
    if(this.coinGeckoId){
      currency.coinGeckoId = this.coinGeckoId
    }
    const data = {
      rpc: this.rpcUrl,
      rest: this.restUrl,
      chainId: this.chainId,
      chainName: this.prettyName,
      stakeCurrency: currency,
      bip44: { coinType: this.slip44 },
      walletUrlForStaking: "https://restake.app/" + this.name,
      bech32Config: {
        bech32PrefixAccAddr: this.prefix,
        bech32PrefixAccPub: this.prefix + "pub",
        bech32PrefixValAddr: this.prefix + "valoper",
        bech32PrefixValPub: this.prefix + "valoperpub",
        bech32PrefixConsAddr: this.prefix + "valcons",
        bech32PrefixConsPub: this.prefix + "valconspub"
      },
      currencies: [currency],
      feeCurrencies: [currency],
      gasPriceStep: this.gasPriceStep
    }
    if(this.data.keplrFeatures){
      data.features = this.data.keplrFeatures
    }
    return data
  }

  buildKeywords(){
    return _.compact([
      ...this.chain?.keywords || [], 
      this.authzSupport && 'authz',
      this.authzAminoSupport && 'full authz ledger',
    ])
  }
}

export default Network;
