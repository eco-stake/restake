import _ from 'lodash'
import RestClient from './RestClient.mjs'
import SigningClient from './SigningClient.mjs'
import Operator from './Operator.mjs'

const Network = async (data) => {
  console.log(data);
  const restClient = await RestClient(data.chainId, data.restUrl, data.rpcUrl)
  console.log(restClient)

  const signingClient = (wallet, key) => {
    const gasPrice = data.gasPrice || '0.0025' + data.denom
    return SigningClient(data.rpcUrl, data.chainId, gasPrice, wallet, key)
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
    prettyName: data.prettyName,
    chainId: data.chainId,
    prefix: data.prefix,
    gasPrice: data.gasPrice,
    denom: data.denom,
    restUrl: restClient.restUrl,
    rpcUrl: data.rpcUrl,
    operators: data.operators,
    authzSupport: data.authzSupport,
    data,
    restClient,
    signingClient,
    getValidators,
    getOperators,
    getOperator
  }
}

export default Network;
