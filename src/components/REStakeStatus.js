import React from "react";
import _ from "lodash";
import CountdownRestake from "./CountdownRestake";
import TooltipIcon from "./TooltipIcon";

import { XCircle } from "react-bootstrap-icons";
import { joinString } from "../utils/Helpers.mjs";

function REStakeStatus(props) {
  const { network, validator, operator, delegation, grants, tooltip, className } = props
  
  function content(){
    if (operator) {
      if (delegation && grants?.grantsValid) {
        return (
          <CountdownRestake
            network={network}
            operator={operator}
            maxAmount={grants.maxTokens}
            className={className}
            icon={<small className="text-nowrap text-success">{operator.frequency()}</small>}
            renderText={(string) => <p>Validator will REStake in<br /><span>{string}</span></p>}
            rootClose={true}
          />
        )
      } else {
        return (
          <TooltipIcon
            icon={<small className="text-nowrap text-decoration-underline">{operator.frequency()}</small>}
            identifier={validator.operator_address}
            rootClose={true}
            tooltip={tooltip || "This validator can REStake your rewards"}
          />
        )
      }
    } else {
      return (
        <TooltipIcon
          icon={<XCircle className={joinString(`opacity-50`, className)} />}
          identifier={validator.operator_address}
          rootClose={true}
          tooltip={tooltip || "This validator is not a REStake operator"}
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