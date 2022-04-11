import React from 'react';
import Coins from './Coins';

import DelegateForm from './DelegateForm'
import ValidatorLink from './ValidatorLink'

import {
  Table
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
      <h5 className="mb-3">
        {redelegate
          ? <span>Redelegate from <ValidatorLink validator={validator} /></span>
          : actionText()
        }
      </h5>
      <Table>
        <tbody className="table-sm small">
          <tr>
            <td scope="row">Current Delegation</td>
            <td className="text-break"><Coins coins={props.delegation?.balance} denom={network.denom} /></td>
          </tr>
          <tr>
            <td scope="row">Current Rewards</td>
            <td>
              <Coins coins={{ amount: props.rewards, denom: network.denom }} decimals={network.decimals} />
            </td>
          </tr>
        </tbody>
      </Table>
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