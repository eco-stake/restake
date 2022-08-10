import ChainAsset from "./ChainAsset.mjs";

const Chain = (data) => {
  const assets = data.assets?.map(el => ChainAsset(el)) || []
  const baseAsset = assets[0]

  return {
    prettyName: data.prettyName || data.pretty_name,
    chainId: data.chainId || data.chain_id,
    prefix: data.prefix || data.bech32_prefix,
    slip44: data.slip44 || data.slip44 || 118,
    estimatedApr: data.params?.calculated_apr,
    authzSupport: data.authzSupport ?? data.params?.authz,
    denom: data.denom || baseAsset?.base?.denom,
    display: data.display || baseAsset?.display?.denom,
    symbol: data.symbol || baseAsset?.symbol,
    decimals: data.decimals || baseAsset?.decimals,
    image: data.image || baseAsset?.image,
    coinGeckoId: baseAsset?.coingecko_id,
    services: data.services,
    explorers: data.explorers,
    assets,
    baseAsset,
    data
  }
}

export default Chain;
