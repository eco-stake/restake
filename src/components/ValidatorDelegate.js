import React from 'react';
import Coins from './Coins';
import TooltipIcon from './TooltipIcon'

import DelegateForm from './DelegateForm'
import ValidatorLink from './ValidatorLink'

import {
  Table,
  Spinner
} from 'react-bootstrap'

function ValidatorDelegate(props) {
  const {redelegate, undelegate, network, validator, selectedValidator, onDelegate, availableBalance } = props

  const actionText = () => {
    if(redelegate) return 'Redelegate'
    if(undelegate) return 'Undelegate'
    return 'Delegate'
  }

  return (
    <>
      <Table>
        <tbody className="table-sm small">
          {network.data.apyEnabled !== false && (
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
                  ? props.validatorApy[selectedValidator.operator_address]
                    ? <span>{Math.round(props.validatorApy[selectedValidator.operator_address] * 100)}%</span>
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
            <td scope="row">Current Delegation</td>
            <td className="text-break"><Coins coins={props.delegation?.balance} decimals={network.decimals} fullPrecision={true} /></td>
          </tr>
          <tr>
            <td scope="row">Current Rewards</td>
            <td>
              <Coins coins={{ amount: props.rewards, denom: network.denom }} decimals={network.decimals} fullPrecision={true} />
            </td>
          </tr>
        </tbody>
      </Table>
      <h5 className="mb-3">
        {redelegate
          ? <span>Redelegate from <ValidatorLink validator={validator} /></span>
          : actionText()
        }
      </h5>
      <DelegateForm
        redelegate={redelegate}
        undelegate={undelegate}
        network={network}
        validator={validator}
        selectedValidator={selectedValidator}
        address={props.address}
        availableBalance={availableBalance}
        stargateClient={props.stargateClient}
        onDelegate={onDelegate} />
    </>
  )
}

export default ValidatorDelegate