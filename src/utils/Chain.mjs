import { compareVersions, validate } from 'compare-versions';
import ChainAsset from "./ChainAsset.mjs";

const Chain = (data) => {
  const assets = data.assets?.map(el => ChainAsset(el)) || []
  const baseAsset = assets[0]
  const { cosmos_sdk_version } = data.versions || {}
  const sdk46OrLater = validate(cosmos_sdk_version) && compareVersions(cosmos_sdk_version, '0.46') >= 0
  const sdkAuthzAminoSupport = sdk46OrLater
  const authzSupport = data.authzSupport ?? data.params?.authz
  const apiVersions = {
    gov: sdk46OrLater ? 'v1' : 'v1beta1',
    ...data.apiVersions || {}
  }

  return {
    ...data,
    prettyName: data.prettyName || data.pretty_name,
    chainId: data.chainId || data.chain_id,
    prefix: data.prefix || data.bech32_prefix,
    slip44: data.slip44 || 118,
    estimatedApr: data.params?.calculated_apr,
    authzSupport,
    authzAminoSupport: data.authzAminoSupport ?? sdkAuthzAminoSupport ?? false,
    apiVersions,
    denom: data.denom || baseAsset?.base?.denom,
    display: data.display || baseAsset?.display?.denom,
    symbol: data.symbol || baseAsset?.symbol,
    decimals: data.decimals || baseAsset?.decimals,
    image: data.image || baseAsset?.image,
    coinGeckoId: baseAsset?.coingecko_id,
    assets,
    baseAsset
  }
}

export default Chain;
