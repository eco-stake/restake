import axios from 'axios'

function CosmosDirectory(){
  const directoryProtocol = process.env.DIRECTORY_PROTOCOL
  const directoryDomain = process.env.DIRECTORY_DOMAIN
  const rpcBase = `${directoryProtocol}://rpc.${directoryDomain}`
  const restBase = `${directoryProtocol}://rest.${directoryDomain}`
  const chainsUrl = `${directoryProtocol}://registry.${directoryDomain}`

  function getChains(){
    return axios.get(chainsUrl)
      .then(res => res.data)
      .then(data => data.reduce((a, v) => ({ ...a, [v.directory]: v }), {}))
  }

  function getChainData(name) {
    return axios.get([chainsUrl, name, 'chain'].join('/'))
      .then(res => res.data)
  }

  async function getTokenData(name) {
    return axios.get([chainsUrl, name, 'assetlist'].join('/'))
      .then(res => res.data)
  }

  function rpcUrl(name){
    return rpcBase + '/' + name
  }

  function restUrl(name){
    return restBase + '/' + name
  }

  return {
    rpcUrl,
    restUrl,
    chainsUrl,
    getChains,
    getChainData,
    getTokenData
  }
}

export default CosmosDirectory