import axios from 'axios'
import _ from 'lodash'
import fs from 'fs'

import RestClient from '../src/utils/RestClient.mjs'
import {findAsync} from '../src/utils/Helpers.mjs'

const registryConfig = (name) => {
  const generateConfig = (chain, tokens, existingConfig) => {
    const fees = chain.fees && chain.fees.fee_tokens && chain.fees.fee_tokens[0] || {}
    let gasPrice
      if(fees && fees.fixed_min_gas_price && fees.denom){
        gasPrice = fees.fixed_min_gas_price.toString() + fees.denom
      }
    let denom, image
    if(tokens){
      const asset = tokens.assets[0]
      if(asset){
        denom = asset.denom_units.find(el => el.exponent === 0)
        denom = denom && denom.denom
        const logos = asset.logo_URIs
        image = logos && (logos.svg || logos.png)
      }
    }
    if(!denom) denom = fees.denom
    return {
      "name": chain.chain_name,
      "prettyName": chain.pretty_name,
      "chainId": chain.chain_id,
      "prefix": chain.bech32_prefix,
      "denom": denom || existingConfig.denom,
      "restUrl": _.uniq(chain.apis.rest.map(el => el.address), existingConfig.restUrl),
      "rpcUrl": _.uniq(chain.apis.rpc.map(el => el.address.replace(/\/$/, '')), existingConfig.rpcUrl),
      "image": existingConfig.image || image,
      "gasPrice": existingConfig.gasPrice || gasPrice,
      "testAddress": existingConfig.testAddress,
      "operators": existingConfig.operators || []
    }
  }

  const chainData = () => {
    return axios.get('https://raw.githubusercontent.com/cosmos/chain-registry/master/' + name + '/chain.json')
      .then(res => res.data)
  }

  const tokenData = () => {
    return axios.get('https://raw.githubusercontent.com/cosmos/chain-registry/master/' + name + '/assetlist.json')
      .then(res => res.data)
  }

  const testGrants = (restUrl) => {
    return axios.get(restUrl + "/cosmos/authz/v1beta1/grants")
      .then(res => res.data)
      .then(data => data).catch(error => {
        return error.response && error.response.status === 400 // expect bad request
      })
  }

  const getNetworksData = () => {
    let response = fs.readFileSync('src/networks.json');
    return JSON.parse(response);
  }

  return {
    generateConfig,
    chainData,
    tokenData,
    testGrants,
    getNetworksData
  }
}

const chainName = process.argv[2]
const registry = registryConfig(chainName)
const networks = registry.getNetworksData().reduce((a, v) => ({ ...a, [v.name]: v}), {})
const existingConfig = networks[chainName]
const chain = await registry.chainData()
const tokens = await registry.tokenData()
const config = registry.generateConfig(chain, tokens, existingConfig)
let authzEnabled = false

if(config.restUrl.length){
  const restClient = await RestClient(config.chainId, config.restUrl)
  if(!restClient.restUrl) console.log('No API responses. Unable to check authz status')
  authzEnabled = await registry.testGrants(restClient.restUrl)
  if(restClient.restUrl && !authzEnabled) console.log('No authz support')
}
_.merge(config, {authzSupport: authzEnabled})
_.set(networks, chainName, config)
const newConfig = JSON.stringify(Object.values(networks), null, '  ')

fs.writeFileSync('src/networks.json', newConfig)
console.log('New config written, use git to rollback if needed')
