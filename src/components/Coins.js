import _ from 'lodash'
import { format } from 'mathjs'

function Coins(props) {
  function amount(coins, decimals){
    if(props.inBaseDenom) return coins.amount

    if (!decimals) {
      decimals = 6
    }
    return format(_.round(coins.amount / Math.pow(10, decimals), precision(coins, decimals)), {notation: 'fixed'})
  }

  function denom(coins){
    if(!coins.denom) return

    if(coins.denom.startsWith('base')){
      return coins.denom.slice(4).toUpperCase()
    }else if(['u', 'a', 'n'].includes(coins.denom[0])){
      return coins.denom.slice(1).toUpperCase()
    }
    return coins.denom.toUpperCase()
  }

  if(!props.coins || !props.coins.denom){
    return null
  }

  function precision(coins, decimals){
    if(props.fullPrecision) return decimals;
    if(coins.amount >= (1000 * Math.pow(10, decimals))) return 2
    if(coins.amount >= (100 * Math.pow(10, decimals))) return 3
    return 6
  }

  return (
    <span className="coins">
      <span className="amount">{amount(props.coins, props.decimals)}</span>&nbsp;
      <span className="denom">{denom(props.coins, props.decimals)}</span>
    </span>
  )
}

export default Coins;
