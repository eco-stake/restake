import React from 'react';

import TooltipIcon from './TooltipIcon';

import Countdown from 'react-countdown';

import {
  ClockHistory
} from 'react-bootstrap-icons'

function CountdownRestake(props) {
  const { operator } = props

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
      return (
        <p>Validator will REStake in<br /><span>{string}</span></p>
      )
    }
  }
  return (
    <TooltipIcon icon={<ClockHistory className="p-0" />} identifier={operator.address}>
      <div className="mt-2 text-center">
        <Countdown
          date={nextRun()}
          renderer={countdownRenderer}
        />
      </div>
    </TooltipIcon>
  )
}

export default CountdownRestake;

