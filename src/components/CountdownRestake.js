import React from 'react';

import TooltipIcon from './TooltipIcon';

import Countdown from 'react-countdown';

import Coins from './Coins';

function CountdownRestake(props) {
  const { operator, network, maxAmount, icon } = props

  const nextRun = () => {
    if(!operator) return null
    return operator.nextRun() + (60 * 1000)
  }


  const countdownRenderer = ({ hours, minutes, seconds, completed }) => {
    if (completed) {
      return <p>Validator is restaking now</p>
    } else {
      let string = ''
      if(hours > 0) string = string.concat(hours + 'h ')
      if(minutes > 0) string = string.concat(minutes + (hours > 0 ? 'm ' : ' minutes '))
      if(props.showSeconds) string = string.concat(seconds + 's')
      if(string === '') return <p>Validator is restaking now</p>
      if(props.renderText) return props.renderText(string)

      return (
        <div><span>in {string}</span></div>
      )
    }
  }
  return (
    icon ? (
      <TooltipIcon icon={icon} identifier={operator.address} rootClose={props.rootClose}>
        <div className="mt-2 text-center">
          <Countdown
            date={nextRun()}
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
          date={nextRun()}
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

