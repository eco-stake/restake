import _ from 'lodash'
import RestClient from './RestClient.mjs'
import SigningClient from './SigningClient.mjs'
import Operator from './Operator.mjs'
import Chain from './Chain.mjs'

const Network = async (data) => {

  const chain = await Chain(data)
  const restClient = await RestClient(chain.chainId, data.restUrl)

  const signingClient = (wallet, key) => {
    const gasPrice = data.gasPrice || '0.0025' + chain.denom
    return SigningClient(data.rpcUrl, chain.chainId, gasPrice, wallet, key)
  }

  const getOperator = (operators, operatorAddress) => {
    return operators.find(elem => elem.address === operatorAddress)
  }

  const getOperators = (validators) => {
    return sortOperators().map(operator => {
      const validator = validators[operator.address]
      return Operator(operator, validator)
    })
  }

  const sortOperators = () => {
    const random = _.shuffle(data.operators)
    if(data.ownerAddress){
      return _.sortBy(random, ({address}) => address === data.ownerAddress ? 0 : 1)
    }
    return random
  }

  const getValidators = () => {
    return restClient.getAllValidators(150)
  }

  return {
    connected: restClient.connected,
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
    restUrl: restClient.restUrl,
    rpcUrl: data.rpcUrl,
    operators: data.operators,
    authzSupport: data.authzSupport,
    data,
    chain,
    restClient,
    signingClient,
    getValidators,
    getOperators,
    getOperator
  }
}

export default Network;
