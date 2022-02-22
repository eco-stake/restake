import _ from 'lodash'

function Coins(props) {
  function amount(coins){
    return _.round(coins.amount / 1000000.0, 6)
  }

  function denom(coins){
    return coins.denom.slice(1).toUpperCase()
  }

  if(!props.coins){
    return null
  }

  return (
    <span className="coins">
      <span className="amount">{amount(props.coins)}</span>&nbsp;
      <span className="denom">{denom(props.coins)}</span>
    </span>
  )
}

export default Coins;
