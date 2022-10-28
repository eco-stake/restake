import React from 'react';

import TooltipIcon from './TooltipIcon';

import Countdown from 'react-countdown';

import Coins from './Coins';

function CountdownRestake(props) {
  const { operator, network, maxAmount, icon } = props

  const nextRun = () => {
    if(!operator) return null
    return operator.nextRun()
  }


  const countdownRenderer = ({ hours, minutes, seconds, completed }) => {
    let string = nextRun()?.fromNow(false)
    if (props.renderText) return props.renderText(string)

    return (
      <div><span>{string}</span></div>
    )
  }

  if(!nextRun()) return null

  return (
    icon ? (
      <TooltipIcon icon={icon} identifier={operator.address} rootClose={props.rootClose}>
        <div className="mt-2 text-center">
          <Countdown
            date={nextRun().unix()}
            renderer={countdownRenderer}
          />
          {maxAmount && (
            <p>Grant remaining: <Coins coins={{amount: maxAmount, denom: props.network.denom}} asset={network.baseAsset} fullPrecision={true} hideValue={true} /></p>
          )}
        </div>
      </TooltipIcon>
    ): (
      <div className={props.className}>
        <Countdown
          date={nextRun().unix()}
          renderer={countdownRenderer}
        />
        {maxAmount && (
          <div>Grant remaining: <Coins coins={{amount: maxAmount, denom: props.network.denom}} asset={network.baseAsset} fullPrecision={true} hideValue={true} /></div>
        )}
      </div>
    )
  )
}

export default CountdownRestake;

