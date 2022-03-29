import CosmosDirectory from './CosmosDirectory.mjs'

const Chain = async (data) => {
  const directory = CosmosDirectory()

  const chainData = await directory.getChainData(data.name);
  const tokenData = await directory.getTokenData(data.name);

  const getChainInfo = () => {
    return {
      prettyName: data.prettyName || chainData.pretty_name,
      chainId: data.chainId || chainData.chain_id,
      prefix: data.prefix || chainData.bech32_prefix,
      slip44: data.slip44 || chainData.slip44 || 118,
      authzSupport: !!data.authzSupport
    }
  }

  const getTokenInfo = () => {
    const asset = tokenData.assets[0]
    const base = asset.denom_units.find(el => el.denom === asset.base)
    const token = asset.denom_units.find(el => el.denom === asset.display)
    return {
      denom: data.denom || base.denom,
      symbol: data.symbol || token.denom,
      decimals: data.decimals || token.exponent || 6,
      image: data.image || (asset.logo_URIs && (asset.logo_URIs.png || asset.logo_URIs.svg)),
      coinGeckoId: asset.coingecko_id
    }
  }

  const {
    prettyName,
    chainId,
    prefix,
    slip44,
    authzSupport
  } = getChainInfo()

  const {
    denom,
    symbol,
    decimals,
    image,
    coinGeckoId
  } = getTokenInfo()

  return {
    prettyName,
    chainId,
    prefix,
    slip44,
    authzSupport,
    denom,
    symbol,
    decimals,
    image,
    coinGeckoId,
    chainData,
    tokenData
  }
}

export default Chain;
