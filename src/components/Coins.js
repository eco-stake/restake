import _ from 'lodash'

function Coins(props) {
  const { asset, coins, fullPrecision, inBaseDenom, hideValue, className } = props
  const { decimals, symbol, prices } = asset
  const { coingecko } = prices || {}

  function amount(coins){
    if(inBaseDenom) return coins.amount

    const prec = precision(coins, decimals)
    return _.round(coins.amount / Math.pow(10, decimals), prec).toLocaleString(undefined, {maximumFractionDigits: prec})
  }

  function value(coins){
    return (coins.amount / Math.pow(10, decimals) * coingecko.usd).toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })
  }

  if(!coins || !coins.denom){
    return null
  }

  function precision(coins){
    if(fullPrecision) return decimals;
    if(coins.amount >= (1000 * Math.pow(10, decimals))) return 2
    if(coins.amount >= (100 * Math.pow(10, decimals))) return 3
    return 6
  }

  return (
    <span className={['d-inline-block m-0 coins', className].join(' ')}>
      <span>
        <span className="amount">{amount(coins)}</span>&nbsp;
        <span className="denom">{symbol}</span>
      </span>
      {!!coingecko?.usd && !hideValue && !!coins.amount && (
        <>
          <br />
          <em className="text-muted">
            <span className="amount">${value(coins)}</span>
          </em>
        </>
      )}
    </span>
  )
}

export default Coins;
