function Balance(props) {
  function amount(coins){
    return coins.amount / 1000000.0
  }

  function denom(coins){
    return coins.denom.slice(1).toUpperCase()
  }

  if(!props.coins){
    return null
  }

  return (
    <span className="balance">
      <span className="amount">{amount(props.coins)}</span>&nbsp;
      <span className="denom">{denom(props.coins)}</span>
    </span>
  )
}

export default Balance;
