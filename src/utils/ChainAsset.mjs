function ChainAsset(data) {
  const { symbol, base, display, image } = data
  const decimals = display?.exponent ?? 6

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