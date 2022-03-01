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
    return data.operators.map(operator => {
      const validator = validators[operator.address]
      return Operator(operator, validator)
    })
  }

  const getValidators = () => {
    return restClient.getValidators()
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
    data,
    restClient,
    signingClient,
    getValidators,
    getOperators,
    getOperator
  }
}

export default Network;
