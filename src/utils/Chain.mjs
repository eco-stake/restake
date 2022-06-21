import CosmosDirectory from './CosmosDirectory.mjs'

const Chain = async (data, directory) => {
  const chainData = await directory.getChainData(data.name);
  const tokenData = await directory.getTokenData(data.name);

  const asset = tokenData.assets[0]
  const base = asset.denom_units.find(el => el.denom === asset.base)
  const token = asset.denom_units.find(el => el.denom === asset.display)

  return {
    prettyName: data.prettyName || chainData.pretty_name,
    chainId: data.chainId || chainData.chain_id,
    prefix: data.prefix || chainData.bech32_prefix,
    slip44: data.slip44 || chainData.slip44 || 118,
    estimatedApr: chainData.params?.calculated_apr,
    authzSupport: data.authzSupport ?? chainData.params?.authz,
    denom: data.denom || base.denom,
    symbol: data.symbol || token.denom,
    decimals: data.decimals || token.exponent || 6,
    image: data.image || (asset.logo_URIs && (asset.logo_URIs.png || asset.logo_URIs.svg)),
    coinGeckoId: asset.coingecko_id,
    chainData,
    tokenData
  }
}

export default Chain;
