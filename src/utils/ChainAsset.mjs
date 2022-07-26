function ChainAsset(data) {
  const { symbol } = data
  const base = data.denom_units.find(el => el.denom === data.base)
  const display = data.denom_units.find(el => el.denom === data.display)
  const decimals = display?.exponent ?? 6
  const logo_URIs = data.logo_URIs
  const image = logo_URIs && (logo_URIs.svg || logo_URIs.png)

  return {
    ...data,
    symbol,
    base,
    display,
    decimals,
    image
  }
}

export default ChainAsset