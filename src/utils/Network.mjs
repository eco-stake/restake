import _ from 'lodash'
import { multiply, pow } from 'mathjs'
import QueryClient from './QueryClient.mjs'
import SigningClient from './SigningClient.mjs'
import ApyClient from '../ApyClient.mjs'
import Operator from './Operator.mjs'
import Chain from './Chain.mjs'
import CosmosDirectory from './CosmosDirectory.mjs'
import DesmosSigningClient from './DesmosSigningClient.mjs'

const Network = async (data, withoutQueryClient) => {
  const SIGNERS = {
    desmos: DesmosSigningClient
  }

  const chain = await Chain(data)
  const directory = CosmosDirectory()
  const validators = await directory.getValidators(data.name)
  const operators = data.operators || validators.filter(el => el.restake).map(el => {
    return Operator(el)
  })

  const rpcUrl = data.rpcUrl || directory.rpcUrl(data.name)
  const restUrl = data.restUrl || directory.restUrl(data.name)

  const usingDirectory = !![restUrl, rpcUrl].find(el => {
    const match = el => el.match("cosmos.directory")
    if(Array.isArray(el)){
      return el.find(match)
    }else{
      return match(el)
    }
  })

  const defaultGasPrice = multiply(0.000000025, pow(10, chain.decimals)).toString() + chain.denom

  let queryClient
  if(!withoutQueryClient){
    queryClient = await QueryClient(chain.chainId, rpcUrl, restUrl)
  }

  const signingClient = (wallet, key) => {
    if(!queryClient) return 
    
    const gasPrice = data.gasPrice || defaultGasPrice
    const client = SIGNERS[data.name] || SigningClient
    return client(queryClient.rpcUrl, gasPrice, wallet, key)
  }

  const apyClient = queryClient && ApyClient(chain, queryClient.rpcUrl, queryClient.restUrl)

  const getOperator = (operatorAddress) => {
    return operators.find(elem => elem.address === operatorAddress)
  }

  const getOperatorByBotAddress = (botAddress) => {
    return operators.find(elem => elem.botAddress === botAddress)
  }

  const getOperators = () => {
    return sortOperators()
  }

  const sortOperators = () => {
    const random = _.shuffle(operators)
    if(data.ownerAddress){
      return _.sortBy(random, ({address}) => address === data.ownerAddress ? 0 : 1)
    }
    return random
  }

  const getValidators = (opts) => {
    opts = opts || {}
    return validators.filter(validator => {
      if(opts.status) return validator.status === opts.status
      return true
    }).reduce(
      (a, v) => ({ ...a, [v.operator_address]: v }),
      {}
    )
  }

  return {
    connected: queryClient && queryClient.connected,
    enabled: data.enabled,
    apyEnabled: data.apyEnabled,
    name: data.name,
    prettyName: chain.prettyName,
    chainId: chain.chainId,
    prefix: chain.prefix,
    slip44: chain.slip44,
    gasPrice: data.gasPrice || defaultGasPrice,
    denom: chain.denom,
    symbol: chain.symbol,
    decimals: chain.decimals,
    image: chain.image,
    coinGeckoId: chain.coinGeckoId,
    testAddress: data.testAddress,
    restUrl: queryClient && queryClient.restUrl,
    rpcUrl: queryClient && queryClient.rpcUrl,
    authzSupport: chain.authzSupport,
    validators,
    operators,
    data,
    chain,
    queryClient,
    usingDirectory,
    getApy: apyClient && apyClient.getApy,
    signingClient,
    getValidators,
    getOperators,
    getOperator,
    getOperatorByBotAddress
  }
}

export default Network;
