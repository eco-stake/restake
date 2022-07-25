import _ from 'lodash'

function Coins(props) {
  const { asset, coins, fullPrecision, inBaseDenom, className } = props
  const { decimals, symbol } = asset

  function amount(coins){
    if(inBaseDenom) return coins.amount

    const prec = precision(coins, decimals)
    return _.round(coins.amount / Math.pow(10, decimals), prec).toLocaleString(undefined, {maximumFractionDigits: prec})
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
    <span className={['coins', className].join(' ')}>
      <span className="amount">{amount(coins)}</span>&nbsp;
      <span className="denom">{symbol}</span>
    </span>
  )
}

export default Coins;
