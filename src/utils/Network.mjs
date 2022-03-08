import _ from 'lodash'
import axios from 'axios'
import RestClient from './RestClient.mjs'
import SigningClient from './SigningClient.mjs'
import Operator from './Operator.mjs'

const Network = async (data) => {
  const restClient = await RestClient(data.chainId, data.restUrl)

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

  // Get Chain Registry to extract more information
  const chainData = () => {
    return axios.get('https://raw.githubusercontent.com/cosmos/chain-registry/master/' + data.name + '/chain.json')
      .then(res => res.data)
  }

  const tokenData = async () => {
    return axios.get('https://raw.githubusercontent.com/cosmos/chain-registry/master/' + data.name + '/assetlist.json')
      .then(res => res.data)
  }

  const chainRegistry = await chainData();
  const tokenRegistry = await tokenData();

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
    chainRegistry,
    tokenRegistry,
    data,
    restClient,
    signingClient,
    getValidators,
    getOperators,
    getOperator
  }
}

export default Network;
