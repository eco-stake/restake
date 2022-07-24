import axios from 'axios'

function CosmosDirectory(testnet){
  const protocol = process.env.DIRECTORY_PROTOCOL || 'https'
  const mainnetDomain = process.env.DIRECTORY_DOMAIN || 'cosmos.directory'
  const testnetDomain = process.env.DIRECTORY_DOMAIN_TESTNET || 'testcosmos.directory'
  const domain = testnet ? testnetDomain : mainnetDomain
  const rpcBase = `${protocol}://rpc.${domain}`
  const restBase = `${protocol}://rest.${domain}`
  const chainsUrl = `${protocol}://chains.${domain}`
  const validatorsUrl = `${protocol}://validators.${domain}`

  function rpcUrl(name){
    return rpcBase + '/' + name
  }

  function restUrl(name){
    return restBase + '/' + name
  }

  function getChains(){
    return axios.get(chainsUrl)
      .then(res => res.data)
      .then(data => Array.isArray(data) ? data : data.chains) // deprecate
      .then(data => data.reduce((a, v) => ({ ...a, [v.path]: v }), {}))
  }

  function getChainData(name) {
    return axios.get([chainsUrl, name].join('/'))
      .then(res => res.data.chain)
  }

  async function getTokenData(name) {
    return axios.get([chainsUrl, name, 'assetlist'].join('/'))
      .then(res => res.data)
  }

  function getValidators(chainName){
    return axios.get(validatorsUrl + '/chains/' + chainName)
      .then(res => res.data.validators)
  }

  function getRegistryValidator(validatorName) {
    return axios.get(validatorsUrl + '/' + validatorName)
      .then(res => res.data.validator)
  }

  function getOperatorAddresses(){
    return axios.get(validatorsUrl)
      .then(res => res.data)
      .then(data => Array.isArray(data) ? data : data.validators) // deprecate
      .then(data => data.reduce((sum, validator) => {
        validator.chains.forEach(chain => {
          sum[chain.name] = sum[chain.name] || {}
          if(chain.restake){
            sum[chain.name][chain.address] = chain.restake
          }
        }, {})
        return sum
      }, {}))
  }

  return {
    testnet,
    domain,
    rpcUrl,
    restUrl,
    getChains,
    getChainData,
    getTokenData,
    getValidators,
    getRegistryValidator,
    getOperatorAddresses
  }
}

export default CosmosDirectory