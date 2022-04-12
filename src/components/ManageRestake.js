import React from "react";
import _ from "lodash";
import CountdownRestake from "./CountdownRestake";
import TooltipIcon from "./TooltipIcon";

import { Button, OverlayTrigger, Tooltip } from "react-bootstrap";

import { CheckCircle, XCircle } from "react-bootstrap-icons";

function ManageRestake(props) {
  const { validator, operator, delegation, grants, network, authzSupport, restakePossible } = props

  return (
    <>
      {operator ? (
        authzSupport && delegation ? (
          grants.grantsValid ? (
            <span role="button" onClick={props.openGrants}>
            <CountdownRestake
              network={network}
              operator={operator}
              maxAmount={grants.maxTokens}
            />
            </span>
          ) : restakePossible ? (
              <OverlayTrigger
                key={operator.address}
                placement="top"
                overlay={
                  <Tooltip id={`tooltip-${operator.address}`}>
                    {grants.grantsExist ? 'Update grants to re-enable REStake' : 'Authorize validator to REStake for you'}
                  </Tooltip>
                }
              >
                <Button className="mr-5" onClick={props.openGrants} size={props.size} disabled={props.disabled} variant={grants.grantsExist ? 'danger' : 'success'}>
                  {grants.grantsExist ? 'Fix' : 'Enable'}
                </Button>
              </OverlayTrigger>
          ) : (
            <TooltipIcon
              icon={<CheckCircle className="text-success" />}
              identifier={validator.operator_address}
              tooltip="This validator can REStake your rewards"
            />
          )
        ) : (
          <TooltipIcon
            icon={<CheckCircle className="text-success" />}
            identifier={validator.operator_address}
            tooltip="This validator can REStake your rewards"
          />
        )
      ) : (
        <TooltipIcon
          icon={<XCircle className="opacity-50" />}
          identifier={validator.operator_address}
          tooltip="This validator is not a REStake operator"
        />
      )}
    </>
  )
}

export default ManageRestake;
