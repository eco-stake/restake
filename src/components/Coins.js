import _ from 'lodash'

function Coins(props) {
  function amount(coins, decimals){
    if (!decimals) {
      decimals = 6
    }
    const precision = coins.amount >= (100 * Math.pow(10, decimals)) ? 2 : 6
    return _.round(coins.amount / Math.pow(10, decimals), precision)
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

  return (
    <span className="coins">
      <span className="amount">{amount(props.coins, props.decimals)}</span>&nbsp;
      <span className="denom">{denom(props.coins, props.decimals)}</span>
    </span>
  )
}

export default Coins;
