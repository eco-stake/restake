import _ from 'lodash'
import React, { useState, useEffect } from 'react';

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
import ValidatorServices from './ValidatorServices';
import ValidatorNetworks from './ValidatorNetworks';

function ValidatorProfile(props) {
  const { validator, operator, network, networks } = props
  const [registryData, setRegistryData] = useState({})

  useEffect(() => {
    if(validator?.path && network.directory){
      network.directory.getRegistryValidator(validator.path).then(data => {
        setRegistryData(data)
      })
    }else{
      setRegistryData({})
    }
  }, [validator]);

  const active = () => {
    if(!validator) return false

    return validator.status === 'BOND_STATUS_BONDED' && !validator.jailed
  }

  const status = () => {
    if(!validator) return

    let status = ''
    let className = 'p-0'
    if(active()){
      status = 'Active'
    }else{
      status = 'Inactive'
      className += ' text-danger'
    }
    if(validator.jailed){
      status += ' (JAILED)' 
      className += ' text-danger'
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
    return <Coins coins={{ amount: amount, denom: network.denom }} asset={network.baseAsset} />
  }

  const minimumReward = () => {
    return {
      amount: operator.minimumReward,
      denom: network.denom
    }
  }

  const uptime = () => {
    if(!validator.uptime_periods?.length) return null

    const period = validator.uptime_periods.slice(-1)[0]
    const blockPeriod = validator.missed_blocks_periods.slice(-1)[0]
    return <span className="p-0">{_.round(period.uptime * 100, 2)}% (missed {blockPeriod.missed.toLocaleString()} of {blockPeriod.blocks.toLocaleString()} blocks)</span>
  }

  return (
    <>
      <Table>
        <tbody className="table-sm small">
          <tr>
            <td scope="row">Validator Address</td>
            <td className="text-break"><span className="p-0">{validator.operator_address}</span></td>
          </tr>
          {!active() && (
            <tr>
              <td scope="row">Status</td>
              <td>{status()}</td>
            </tr>
          )}
          {uptime() && (
            <tr>
              <td scope="row">Uptime</td>
              <td>{uptime()}</td>
            </tr>
          )}
          {!!website() && (
            <tr>
              <td scope="row">Website</td>
              <td className="text-break"><ValidatorLink className="text-decoration-underline p-0" validator={validator}>{website()}</ValidatorLink></td>
            </tr>
          )}
          <tr>
            <td className="align-middle" scope="row">Profiles</td>
            <td>
              <ValidatorServices validator={validator} network={network} theme={props.theme} />
            </td>
          </tr>
          {validator?.path && (
            <tr>
              <td className="align-middle" scope="row">Networks</td>
              <td className="w-75">
                <ValidatorNetworks validator={validator} registryData={registryData} network={network} networks={networks} />
              </td>
            </tr>
          )}
          <tr>
            <td scope="row">REStake</td>
            <td>
              {!!operator ? (
                <span className="p-0">{operator.runTimesString()} (<Coins coins={minimumReward()} asset={network.baseAsset} fullPrecision={true} hideValue={true} /> min)</span>
              ) :
                <TooltipIcon icon={<XCircle className="opacity-50 p-0" />} identifier={validator.operator_address} tooltip="This validator is not a REStake operator" />
              }
            </td>
          </tr>
          {network.apyEnabled && (
            <tr>
              <td scope="row">
                <TooltipIcon
                  icon={<span className="p-0 text-decoration-underline">APY</span>}
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
                    ? <span className="p-0">{Math.round(props.validatorApy[validator.operator_address] * 100).toLocaleString()}%</span>
                    : "-"
                  : (
                    <Spinner animation="border" role="status" className="spinner-border-sm text-secondary">
                      <span className="visually-hidden">Loading...</span>
                    </Spinner>
                  )}
              </td>
            </tr>
          )}
          <tr>
            <td scope="row">Commission</td>
            <td><span className="p-0">{validator.commission.commission_rates.rate * 100}%</span></td>
          </tr>
          <tr>
            <td scope="row">Voting power</td>
            <td><span className="p-0">{bondedTokens()}</span></td>
          </tr>
          <tr>
            <td scope="row">Rank</td>
            <td><span className="p-0">#{validator.rank}</span></td>
          </tr>
          {!!securityContact() && (
            <tr>
              <td scope="row">Contact</td>
              <td><a className="p-0" href={`mailto:${securityContact()}`}>{securityContact()}</a></td>
            </tr>
          )}
        </tbody>
      </Table>
      <p>{validator.description.details}</p>
    </>
  )
}

export default ValidatorProfile