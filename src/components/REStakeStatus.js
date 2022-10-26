import React from "react";
import _ from "lodash";
import CountdownRestake from "./CountdownRestake";
import TooltipIcon from "./TooltipIcon";

import { CheckCircle, XCircle, ClockHistory, Clock } from "react-bootstrap-icons";
import { joinString } from "../utils/Helpers.mjs";

function REStakeStatus(props) {
  const { network, validator, operator, delegation, grants, className } = props
  
  function content(){
    if (operator) {
      if (delegation && grants?.grantsValid) {
        return (
          <CountdownRestake
            network={network}
            operator={operator}
            maxAmount={grants.maxTokens}
            className={className}
            icon={grants.maxTokens ? <ClockHistory className={joinString('p-0', className)} /> : <Clock className={joinString('p-0', className)} />}
            renderText={(string) => <p>Validator will REStake in<br /><span>{string}</span></p>}
            rootClose={true}
          />
        )
      } else {
        return (
          <TooltipIcon
            icon={<CheckCircle className={joinString(`text-success`, className)} />}
            identifier={validator.operator_address}
            rootClose={true}
            tooltip="This validator can REStake your rewards"
          />
        )
      }
    } else {
      return (
        <TooltipIcon
          icon={<XCircle className={joinString(`opacity-50`, className)} />}
          identifier={validator.operator_address}
          rootClose={true}
          tooltip="This validator is not a REStake operator"
        />
      )
    }
  }

  return (
    <span role={props.onClick ? 'button' : ''} onClick={props.onClick}>
      {content()}
    </span>
  )
}

export default REStakeStatus