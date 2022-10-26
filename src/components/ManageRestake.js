import React from "react";
import _ from "lodash";

import REStakeStatus from "./REStakeStatus";

function ManageRestake(props) {
  const { validator, operator, delegation, grants, network, restakePossible } = props

  let tooltip
  if(restakePossible && operator && !grants?.grantsValid && (delegation || grants?.grantsExist)){
    tooltip = grants.grantsExist ? delegation ? 'Update grants to re-enable REStake' : 'Delegate to this validator to enable REStake' : 'Authorize validator to REStake for you'
  }

  return (
    <>
      <REStakeStatus
        network={network}
        validator={validator}
        operator={operator}
        delegation={delegation}
        grants={grants}
        tooltip={tooltip}
        className={props.className}
        onClick={props.openGrants}
      />
    </>
  )
}

export default ManageRestake;
