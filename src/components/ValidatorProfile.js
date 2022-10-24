import _ from 'lodash'
import React from 'react';
import { round } from 'mathjs'

import ValidatorLink from './ValidatorLink'
import Coins from './Coins'
import TooltipIcon from './TooltipIcon'

import {
  Table,
  Spinner,
} from 'react-bootstrap'

import {
  XCircle,
  HeartPulse
} from 'react-bootstrap-icons'
import ValidatorServices from './ValidatorServices';
import ValidatorNetworks from './ValidatorNetworks';
import OperatorLastRestake from './OperatorLastRestake';
import Address from './Address';

function ValidatorProfile(props) {
  const { validator, operator, network, networks, registryData, lastExec } = props

  const status = () => {
    if (!validator) return

    const status = validator.active ? 'Active' : validator.jailed ? 'Jailed' : validator.active != null ? 'Inactive' : 'Unknown'
    let className = validator.active ? '' : 'text-danger'

    return <span className={className}>{status}</span>
  }

  const minimumReward = () => {
    return {
      amount: operator.minimumReward,
      denom: network.denom
    }
  }

  function uptime() {
    if(!validator.uptime) return 

    const period = validator.uptime_periods.slice(-1)[0]
    const blockPeriod = validator.missed_blocks_periods.slice(-1)[0]
    return <span>{_.round(period.uptime * 100, 2)}% <small>(missed {blockPeriod.missed.toLocaleString()} of {blockPeriod.blocks.toLocaleString()} blocks)</small></span>
  }

  return (
    <>
      <div className="row">
        <div className="col small">
          <Table>
            <tbody>
              <tr>
                <td scope="row">Validator Address</td>
                <td className="text-break"><Address address={validator.operator_address} /></td>
              </tr>
              {!validator.active && (
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
              <tr>
                <td scope="row">REStake</td>
                <td>
                  {!!operator ? (
                    <Table className="m-0 table-sm small">
                      <tbody>
                        <tr>
                          <td>Frequency</td>
                          <td>{operator.runTimesString()}</td>
                        </tr>
                        <tr>
                          <td className={network.authzSupport ? '' : 'border-bottom-0'}>Minimum rewards</td>
                          <td className={network.authzSupport ? '' : 'border-bottom-0'}><Coins coins={minimumReward()} asset={network.baseAsset} fullPrecision={true} hideValue={true} /></td>
                        </tr>
                        {network.authzSupport && (
                          <tr>
                            <td className="border-bottom-0">Last REStake</td>
                            <td className={'border-bottom-0'}>
                              <OperatorLastRestake operator={operator} lastExec={lastExec} />
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </Table>
                  ) :
                    <TooltipIcon icon={<XCircle className="opacity-50" />} identifier={validator.operator_address} tooltip="This validator is not a REStake operator" />
                  }
                </td>
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
                        ? <span>{round(props.validatorApy[validator.operator_address] * 100, 2).toLocaleString()}%</span>
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
                <td><span>{validator.commission.commission_rates.rate * 100}%</span></td>
              </tr>
              <tr>
                <td scope="row">Rank</td>
                <td><span>#{validator.rank}</span></td>
              </tr>
              <tr>
                <td scope="row">Voting power</td>
                <td><span><Coins coins={{ amount: validator.tokens, denom: network.denom }} asset={network.baseAsset} /></span></td>
              </tr>
            </tbody>
          </Table>
        </div>
        <div className="col small">
          <Table>
            <tbody>
              <tr>
                <td scope="row">Contact</td>
                <td><a href={`mailto:${validator.description?.security_contact}`}>{validator.description?.security_contact}</a></td>
              </tr>
              {!!validator.description?.website && (
                <tr>
                  <td scope="row">Website</td>
                  <td className="text-break"><ValidatorLink className="text-decoration-underline" validator={validator}>{validator.description.website}</ValidatorLink></td>
                </tr>
              )}
              <tr>
                <td className="align-middle" scope="row">Profiles</td>
                <td>
                  <ValidatorServices validator={validator} network={network} theme={props.theme} exclude={['nodes']} />
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
            </tbody>
          </Table>
          <p>
            {validator.description?.details}
          </p>
          {Object.entries(validator.public_nodes || {}).length > 0 && (
            <>
              <p className="mb-2 d-flex align-items-center gap-1"><HeartPulse /><strong>Public Nodes</strong></p>
              <Table className="table-sm">
                <tbody>
                  {Object.entries(validator.public_nodes).map(([type, nodes]) => {
                    return (
                      <tr key={type}>
                        <td>
                          {type.toUpperCase()}
                        </td>
                        <td className="list-group list-group-flush flex-fill">
                          {nodes.map(api => {
                            return <a href={api.address} target="_blank" className="text-reset text-decoration-underline">{api.address}</a>
                          }).reduce((prev, curr) => [prev, <br />, curr])}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
            </>
          )}
        </div>
      </div>
    </>
  )
}

export default ValidatorProfile