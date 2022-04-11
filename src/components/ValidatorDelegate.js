import React from 'react';

import DelegateForm from './DelegateForm'
import ValidatorLink from './ValidatorLink'

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