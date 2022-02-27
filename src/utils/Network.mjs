import RestClient from './RestClient.mjs'
import Operator from './Operator.mjs'

const Network = (data) => {
  const restClient = RestClient(data.restUrl)

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
    name: data.name,
    prettyName: data.prettyName,
    chainId: data.chainId,
    prefix: data.prefix,
    gasPrice: data.gasPrice,
    denom: data.denom,
    restUrl: data.restUrl,
    rpcUrl: data.rpcUrl,
    operators: data.operators,
    data,
    restClient,
    getValidators,
    getOperators,
    getOperator
  }
}

export default Network;
