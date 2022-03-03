import React, { useState } from 'react';
import _ from 'lodash'
import FuzzySearch from 'fuzzy-search'

import Coins from './Coins'
import ValidatorImage from './ValidatorImage'
import TooltipIcon from './TooltipIcon'

import {
  Table,
  Button
} from 'react-bootstrap'

import {
  CheckCircle, XCircle
} from 'react-bootstrap-icons'

function Validators(props) {
  const [filter, setFilter] = useState()

  function operatorValidators(){
    return _.pick(props.validators, props.operators.map(el => el.address))
  }

  function otherValidators(){
    return _.omit(props.validators, props.operators.map(el => el.address))
  }

  function filterValidators(event){
    setFilter(event.target.value)
  }

  function filteredResults(validators){
    if(!validators) return {}

    if(props.exclude) validators = _.omit(validators, props.exclude)

    if(!filter || filter === '') return validators

    const searcher = new FuzzySearch(
      Object.values(validators), ['description.moniker'],
      {sort: true}
    )

    const results =  searcher.search(filter)
    return results.reduce((a, v) => ({ ...a, [v.operator_address]: v}), {})
  }

  function renderItem(item, isOperator){
    let variant = isOperator ? 'warning' : null
    variant = variant ? 'table-' + variant : ''
    return (
      <tr key={item.operator_address} className={variant}>
        <td>
          <div className="row">
            <div className="col-1 me-2">
              <ValidatorImage validator={item} imageUrl={props.getValidatorImage(props.network, item.operator_address)} />
            </div>
            <div className="col pt-1">
              <span className="align-middle">{item.description.moniker}</span>
            </div>
          </div>
        </td>
        <td className="text-center">
          {isOperator
            ? <TooltipIcon icon={<CheckCircle className="text-success" />} identifier={item.operator_address}
              tooltip="This validator can auto-compound your rewards" />
            : <TooltipIcon icon={<XCircle className="opacity-50" />} identifier={item.operator_address}
              tooltip="This validator is not a REStake operator" />
          }
        </td>
        <td className="text-end">
          <Button onClick={() => props.selectValidator(item)}>
            {props.redelegate ? 'Redelegate' : 'Delegate'}
          </Button>
        </td>
      </tr>
    )
  }

  const filteredOperators = Object.entries(filteredResults(operatorValidators()))
  const filteredValidators = Object.entries(filteredResults(otherValidators()))

  return (
    <>
      <input className="form-control mb-3" id="myInput" onKeyUp={filterValidators} type="text" placeholder="Search.." />
      {(filteredOperators.length > 0 || filteredValidators.length > 0) &&
        <Table className="align-middle">
          <tbody>
            <tr>
              <th>Validator</th>
              <th className="text-center">REStake</th>
              <th></th>
            </tr>
            {filteredOperators.map(([validator_address, item], i) => renderItem(item, true))}
            {filteredValidators.map(([validator_address, item], i) => renderItem(item))}
          </tbody>
        </Table>
      }
      {filteredOperators.length < 1 && filteredValidators.length < 1 &&
        <p>No results found</p>
      }
    </>
  )
}

export default Validators;
