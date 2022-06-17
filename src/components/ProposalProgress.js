import React from 'react';
import _ from 'lodash'
import { add, divide, format } from 'mathjs'

import { add, divide, multiply } from 'mathjs'

import {
  OverlayTrigger, 
  Tooltip,
  ProgressBar
} from 'react-bootstrap'

function ProposalProgress(props) {
  const { proposal, tally } = props
  const { proposal_id, status } = proposal

  if (!tally) return null
  if (status === 'PROPOSAL_STATUS_DEPOSIT_PERIOD') return null

  const variants = {
    'yes': 'success',
    'abstain': 'info',
    'no': 'danger',
    'no_with_veto': 'danger'
  }
  const total = Object.values(tally).reduce((sum, value) => add(sum, value), 0)
  if(total === 0) return null

  const progress = Object.keys(tally).reduce((sum, key) => {
    sum[key] = multiply(divide(tally[key], total), 100)
    return sum
  }, {})
  return (
    <OverlayTrigger
      overlay={
        <Tooltip id={`tooltip-progress-${proposal_id}`}>
          {Object.entries(progress).map(([key, value]) => {
            return <p key={key} className="mb-2">{[_.startCase(key), format(value, { precision: 2, notation: 'fixed' })].join(': ')}%</p>
          })}
        </Tooltip>
      }
    >
      <ProgressBar style={{height: props.height || 15}}>
        {Object.entries(progress).map(([key, value]) => {
          return (
            <ProgressBar variant={variants[key]} now={value} key={key} label={`${format(value, { precision: 0, notation: 'fixed' })}%`} />
          )
        })}
      </ProgressBar>
    </OverlayTrigger>
  )
}

export default ProposalProgress;
