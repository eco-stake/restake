import ChainAsset from "./ChainAsset.mjs";

const Chain = async (data, directory) => {
  const chainData = await directory.getChainData(data.name);

  const assets = chainData.assets.map(el => ChainAsset(el))
  const baseAsset = assets[0]

  return {
    prettyName: data.prettyName || chainData.pretty_name,
    chainId: data.chainId || chainData.chain_id,
    prefix: data.prefix || chainData.bech32_prefix,
    slip44: data.slip44 || chainData.slip44 || 118,
    estimatedApr: chainData.params?.calculated_apr,
    authzSupport: data.authzSupport ?? chainData.params?.authz,
    denom: data.denom || baseAsset.base?.denom,
    display: data.display || baseAsset.display?.denom,
    symbol: data.symbol || baseAsset.symbol,
    decimals: data.decimals || baseAsset.decimals,
    image: data.image || baseAsset.image,
    coinGeckoId: baseAsset.coingecko_id,
    services: chainData.services,
    explorers: chainData.explorers,
    assets,
    baseAsset,
    chainData
  }
}

export default Chain;
