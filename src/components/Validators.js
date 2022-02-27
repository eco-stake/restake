import React, { useState } from 'react';
import _ from 'lodash'
import FuzzySearch from 'fuzzy-search'

import ValidatorImage from './ValidatorImage'

import {
  Table,
  Button
} from 'react-bootstrap'

function Validators(props) {
  const [filter, setFilter] = useState()

  function otherValidators(){
    if(!props.operator) return props.validators

    return _.omit(props.validators, props.operator.address)
  }

  function renderItem(item, variant){
    variant = variant ? 'table-' + variant : ''
    return (
      <tr key={item.operator_address} className={variant}>
        <td width={40}>
          <ValidatorImage validator={item} imageUrl={props.getValidatorImage(props.network, item.operator_address)} />
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

  function filterValidators(event){
    setFilter(event.target.value)
  }

  function filteredResults(){
    if(!props.validators) return {}

    const validators = otherValidators()
    if(!filter || filter === '') return validators

    const searcher = new FuzzySearch(
      Object.values(validators), ['description.moniker'],
      {sort: true}
    )

    const results =  searcher.search(filter)
    return results.reduce((a, v) => ({ ...a, [v.operator_address]: v}), {})
  }

  return (
    <>
      {props.operator && !props.operatorDelegation &&
      <p>Delegate to {props.operator.description.moniker} to enable auto REStake</p>
      }
      <input className="form-control mb-3" id="myInput" onKeyUp={filterValidators} type="text" placeholder="Search.." />
      <Table className="align-middle">
        <tbody>
          {props.operator && !props.operatorDelegation && renderItem(props.operator.validatorData, 'primary')}
          {Object.entries(filteredResults()).map(([validator_address, item], i) => {
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
