import React from 'react';

import ValidatorLink from './ValidatorLink'
import Coins from './Coins'
import TooltipIcon from './TooltipIcon'

import {
  Table,
  Spinner,
} from 'react-bootstrap'

import {
  XCircle
} from 'react-bootstrap-icons'

function ValidatorProfile(props) {
  const { validator, operator, network } = props

  const active = () => {
    if(!validator) return false

    return validator.status === 'BOND_STATUS_BONDED' && !validator.jailed
  }

  const status = () => {
    if(!validator) return

    let status = ''
    let className = ''
    if(active()){
      status = 'Active'
    }else{
      status = 'Inactive'
      className = 'text-danger'
    }
    if(validator.jailed){
      status += ' (JAILED)' 
      className = 'text-danger'
    }

    return <span className={className}>{status}</span>
  }

  const website = () => {
    if (!validator) return

    return validator.description && validator.description.website
  }

  const securityContact = () => {
    if (!validator) return

    return validator.description && validator.description.security_contact
  }

  const bondedTokens = () => {
    if (!validator) return

    const amount = validator.tokens
    return <Coins coins={{ amount: amount, denom: network.denom }} decimals={network.decimals} />
  }

  const minimumReward = () => {
    return {
      amount: operator.minimumReward,
      denom: network.denom
    }
  }
  return (
    <>
      <Table>
        <tbody className="table-sm small">
          {active() && (
            <tr>
              <td scope="row">Rank</td>
              <td><span>#{validator.rank}</span></td>
            </tr>
          )}
          <tr>
            <td scope="row">Validator Address</td>
            <td className="text-break"><span>{validator.operator_address}</span></td>
          </tr>
          {!active() && (
            <tr>
              <td scope="row">Status</td>
              <td>{status()}</td>
            </tr>
          )}
          {!!website() && (
            <tr>
              <td scope="row">Website</td>
              <td><ValidatorLink className="text-decoration-underline" validator={validator}>{website()}</ValidatorLink></td>
            </tr>
          )}
          <tr>
            <td scope="row">Commission</td>
            <td><span>{validator.commission.commission_rates.rate * 100}%</span></td>
          </tr>
          {network.apyEnabled && (
            <tr>
              <td scope="row">
                <TooltipIcon
                  icon={<span className="text-decoration-underline">APY</span>}
                  identifier="delegations-apy"
                >
                  <div className="mt-2 text-center">
                    <p>Based on commission, compounding frequency and estimated block times.</p>
                    <p>This is an estimate and best case scenario.</p>
                  </div>
                </TooltipIcon>
              </td>
              <td>
                {Object.keys(props.validatorApy).length > 0
                  ? props.validatorApy[validator.operator_address]
                    ? <span>{Math.round(props.validatorApy[validator.operator_address] * 100).toLocaleString()}%</span>
                    : "-"
                  : (
                    <Spinner animation="border" role="status" className="spinner-border-sm text-secondary">
                      <span className="visually-hidden">Loading...</span>
                    </Spinner>
                  )}
              </td>
            </tr>
          )}
          {!!securityContact() && (
            <tr>
              <td scope="row">Contact</td>
              <td><a href={`mailto:${securityContact()}`}>{securityContact()}</a></td>
            </tr>
          )}
          <tr>
            <td scope="row">Voting power</td>
            <td><span>{bondedTokens()}</span></td>
          </tr>
          <tr>
            <td scope="row">REStake</td>
            <td>
              {!!operator ? (
                <span>{operator.runTimesString()} (<Coins coins={minimumReward()} decimals={network.decimals} /> min)</span>
              ) :
                <TooltipIcon icon={<XCircle className="opacity-50" />} identifier={validator.operator_address} tooltip="This validator is not a REStake operator" />
              }
            </td>
          </tr>
        </tbody>
      </Table>
      <p>{validator.description.details}</p>
    </>
  )
}

export default ValidatorProfile