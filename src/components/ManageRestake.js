import React from "react";
import _ from "lodash";

import { Button, OverlayTrigger, Tooltip } from "react-bootstrap";

import { WrenchAdjustable, Magic } from "react-bootstrap-icons";
import REStakeStatus from "./REStakeStatus";

function ManageRestake(props) {
  const { validator, operator, delegation, grants, network, restakePossible } = props

  return (
    <>
      {restakePossible && operator && !grants?.grantsValid && (delegation || grants?.grantsExist) ? (
        <OverlayTrigger
          key={operator.address}
          placement="top"
          rootClose={true}
          overlay={
            <Tooltip id={`tooltip-${operator.address}`}>
              {grants.grantsExist ? delegation ? 'Update grants to re-enable REStake' : 'Delegate to this validator to enable REStake' : 'Authorize validator to REStake for you'}
            </Tooltip>
          }
        >
          <Button className={`mr-5 ${props.className ? props.className : ''}`} onClick={props.openGrants} size={props.size} disabled={props.disabled} variant={grants.grantsExist ? 'danger' : 'success'}>
            <span className="d-inline d-md-none">{grants.grantsExist ? <WrenchAdjustable /> : <Magic />}</span>
            <span className="d-none d-md-inline">{grants.grantsExist ? 'Fix' : 'Enable'}</span>
          </Button>
        </OverlayTrigger>
      ) : (
          <REStakeStatus
            network={network}
            validator={validator}
            operator={operator}
            delegation={delegation}
            grants={grants}
            className={props.className}
            onClick={props.openGrants}
          />
      )}
    </>
  )
}

export default ManageRestake;
