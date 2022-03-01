import axios from 'axios'

const registryConfig = (name) => {
  const generateConfig = (chain, tokens) => {
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
      "denom": denom,
      "restUrl": chain.apis.rest.map(el => el.address),
      "rpcUrl": chain.apis.rpc.map(el => el.address.replace(/\/$/, '')),
      "image": image,
      "gasPrice": gasPrice,
      "testAddress": null,
      "operators": []
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

  return {
    chainData,
    tokenData,
    generateConfig
  }
}

const chainName = process.argv[2]
const registry = registryConfig(chainName)
const chain = await registry.chainData()
const tokens = await registry.tokenData()
const config = registry.generateConfig(chain, tokens)
console.log(JSON.stringify(config, null, '\t'))
