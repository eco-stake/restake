import React from 'react';

import TooltipIcon from './TooltipIcon';
import Coins from './Coins';

import Countdown from 'react-countdown';
import {
  ClockHistory
} from 'react-bootstrap-icons';

function RevokeRestake(props) {
  const { operator } = props

  const minimumReward = () => {
    return { amount: operator.data.minimumReward, denom: props.network.denom }
  }

  const nextRun = (delayHour) => {
    const now = new Date()
    if(!operator || !operator.data.runTime){
      return null
    }
    const runTime = operator.data.runTime.split(':')
    let day
    if(delayHour){
      day = now.getHours() > runTime[0] ? now.getDate() + 1 : now.getDate()
    }else{
      day = now.getHours() >= runTime[0] ? now.getDate() + 1 : now.getDate()
    }

    return new Date(
      now.getFullYear(),
      now.getMonth(),
      day,
      runTime[0],
      runTime[1],
      runTime[2] || 0
    )
  }

  const countdownRenderer = ({ hours, minutes, seconds, completed }) => {
    if (completed) {
      return <p>Running now. The next run will be at {operator.data.runTime} tomorrow</p>
    } else {
      let string = ''
      if(hours > 0) string = string.concat(hours + 'h ')
      if(minutes > 0) string = string.concat(minutes + 'm ')
      if(props.showSeconds) string = string.concat(seconds + 's')
      return (
        <p>Validator will REStake in<br /><span>{string}</span></p>
      )
    }
  }
  return (
    <TooltipIcon icon={<ClockHistory className={props.className} />} identifier={operator.address}>
      <div className="mt-2 text-center">
        <Countdown
          date={nextRun(true)}
          renderer={countdownRenderer}
        />
        <p><em>Minimum reward is <Coins coins={minimumReward()} decimals={props.network.decimals} /></em></p>
      </div>
    </TooltipIcon>
  )
}

export default RevokeRestake;

