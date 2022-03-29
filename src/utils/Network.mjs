import _ from 'lodash'
import QueryClient from './QueryClient.mjs'
import SigningClient from './SigningClient.mjs'
import ApyClient from '../ApyClient.mjs'
import Operator from './Operator.mjs'
import Chain from './Chain.mjs'
import CosmosDirectory from './CosmosDirectory.mjs'

const Network = async (data, withoutQueryClient) => {

  const chain = await Chain(data)
  const directory = CosmosDirectory()
  const operators = data.operators || (await directory.getOperators(data.name)).map(el => {
    return {
      address: el.address,
      botAddress: el.restake.address,
      runTime: el.restake.run_time,
      minimumReward: el.restake.minimum_reward
    }
  })

  const rpcUrl = data.rpcUrl || directory.rpcUrl(data.name)
  const restUrl = data.restUrl || directory.restUrl(data.name)

  let queryClient
  if(!withoutQueryClient){
    queryClient = await QueryClient(chain.chainId, rpcUrl, restUrl)
  }

  const signingClient = (wallet, key) => {
    if(!queryClient) return 

    const gasPrice = data.gasPrice || '0.0025' + chain.denom
    return SigningClient(queryClient.rpcUrl, chain.chainId, gasPrice, wallet, key)
  }

  const apyClient = queryClient && ApyClient(chain, queryClient.rpcUrl, queryClient.restUrl)

  const getOperator = (operators, operatorAddress) => {
    return operators.find(elem => elem.address === operatorAddress)
  }

  const getOperatorByBotAddress = (operators, botAddress) => {
    return operators.find(elem => elem.botAddress === botAddress)
  }

  const getOperators = (validators) => {
    return sortOperators().map(operator => {
      const validator = validators[operator.address]
      return Operator(operator, validator)
    })
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
    opts.status = opts.status || 'BOND_STATUS_BONDED'
    return queryClient.getAllValidators(150, opts)
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
    gasPrice: data.gasPrice,
    denom: chain.denom,
    symbol: chain.symbol,
    decimals: chain.decimals,
    image: chain.image,
    coinGeckoId: chain.coinGeckoId,
    testAddress: data.testAddress,
    restUrl: queryClient && queryClient.restUrl,
    rpcUrl: queryClient && queryClient.rpcUrl,
    operators: operators,
    authzSupport: chain.authzSupport,
    data,
    chain,
    queryClient,
    getApy: apyClient && apyClient.getApy,
    signingClient,
    getValidators,
    getOperators,
    getOperator,
    getOperatorByBotAddress
  }
}

export default Network;
