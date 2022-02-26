import _ from 'lodash'

import ValidatorImage from './ValidatorImage'

import {
  Table,
  Button
} from 'react-bootstrap'

function Validators(props) {
  function otherDelegations(){
    if(!props.operator) return props.validators

    return _.omit(props.validators, props.operator.address)
  }

  function renderItem(item, variant){
    variant = variant ? 'table-' + variant : ''
    return (
      <tr key={item.operator_address} className={variant}>
        <td width={30}>
          <ValidatorImage validator={item} imageUrl={props.validatorImages[props.network.name][item.operator_address]} height={30} />
        </td>
        <td>{item.description.moniker}</td>
        <td>
          <Button onClick={() => props.selectValidator(item)}>
            Delegate
          </Button>
        </td>
      </tr>
    )
  }

  return (
    <>
      {props.operator && !props.operatorDelegation &&
      <p>Delegate to {props.operator.description.moniker} to enable auto REStake</p>
      }
      <Table>
        <tbody>
          {props.operator && !props.operatorDelegation && renderItem(props.operator.validatorData, 'primary')}
          {props.validators && Object.entries(otherDelegations()).map(([validator_address, item], i) => {
            const delegation = props.delegations && props.delegations[validator_address]
            if(delegation) return null

            return renderItem(item)
          })}
        </tbody>
      </Table>
    </>
  )
}

export default Validators;
