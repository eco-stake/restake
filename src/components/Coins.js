import _ from 'lodash'
import { divide, bignumber, round, format } from 'mathjs'

function Coins(props) {
  const { asset, coins, fullPrecision, inBaseDenom, hideValue, className } = props
  let { decimals, symbol, prices } = asset || {}
  const { coingecko } = prices || {}
  decimals = decimals ?? 6
  symbol = symbol || coins?.denom?.toUpperCase()

  function amount(coins){
    if(inBaseDenom) return coins.amount

    const prec = precision(coins)
    return separator(format(round(divide(bignumber(coins.amount), Math.pow(10, decimals)), prec), {notation: 'fixed'}))
  }

  function value(coins){
    return (coins.amount / Math.pow(10, decimals) * coingecko.usd).toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })
  }

  function separator(stringNum) {
    var str = stringNum.split(".");
    str[0] = str[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return str.join(".");
}

  if(!coins || !coins.denom){
    return null
  }

  function precision(coins){
    if(fullPrecision) return decimals;
    if(props.precision) return props.precision;
    if(coins.amount >= (1000 * Math.pow(10, decimals))) return 2
    if(coins.amount >= (100 * Math.pow(10, decimals))) return 3
    return 6
  }

  return (
    <span className={['d-inline-block m-0 coins', className].join(' ')}>
      <span>
        <span className="amount">{amount(coins)}</span>&nbsp;
        <small className="denom">{symbol}</small>
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
