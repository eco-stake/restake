import React, { useState, useEffect } from 'react';
import _ from 'lodash'
import FuzzySearch from 'fuzzy-search'
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

  function filteredOperators(){
    const results = _.pick(props.validators, props.operators.map(el => el.address))
    return Object.entries(filteredResults(results))
  }

  function filteredValidators(){
    const results = _.omit(props.validators, props.operators.map(el => el.address))
    return Object.entries(filteredResults(results))
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
    const address = item.operator_address
    let variant = isOperator ? 'warning' : null
    variant = variant ? 'table-' + variant : ''
    return (
      <tr key={address} className={variant}>
        <td>
          <div className="row">
            <div className="col-1 me-2">
              <ValidatorImage validator={item} imageUrl={props.getValidatorImage(props.network, address)} width={30} height={30} />
            </div>
            <div className="col">
              <span className="align-middle">{item.description.moniker}</span>
            </div>
          </div>
        </td>
        <td className="text-center">
          {isOperator
            ? <TooltipIcon icon={<CheckCircle className="text-success" />} identifier={address}
              tooltip="This validator can REStake your rewards" />
            : <TooltipIcon icon={<XCircle className="opacity-50" />} identifier={address}
              tooltip="This validator is not a REStake operator" />
          }
        </td>
        {props.network.data.apyEnabled !== false && (
          <td className="d-none d-lg-table-cell text-center">
            {Object.keys(props.validatorApy).length > 0
              ? props.validatorApy[address]
                ? <small>{Math.round(props.validatorApy[address] * 100) + "%"}</small>
                : ""
              : (
                <Spinner animation="border" role="status" className="spinner-border-sm text-secondary">
                  <span className="visually-hidden">Loading...</span>
                </Spinner>
              )}
          </td>
        )}
        <td className="text-end ps-5">
          <Button size="sm" onClick={() => props.selectValidator(item)}>
            {props.redelegate ? 'Redelegate' : 'Delegate'}
          </Button>
        </td>
      </tr>
    )
  }

  return (
    <>
      <input className="form-control mb-3" id="myInput" onKeyUp={filterValidators} type="text" placeholder="Search.." />
      {(filteredOperators().length > 0 || filteredValidators().length > 0) &&
        <Table className="align-middle">
          <tbody>
            <tr>
              <th>Validator</th>
              <th className="text-center">REStake</th>
              {props.network.apyEnabled !== false && (
                <th>
                  <TooltipIcon
                    icon={<span className="text-decoration-underline">APY</span>}
                    identifier="validators-apy"
                  >
                    <div className="mt-2 text-center">
                      <p>Based on commission, compounding frequency and estimated block times.</p>
                      <p>This is an estimate and best case scenario.</p>
                    </div>
                  </TooltipIcon>
                </th>
              )}
              <th></th>
            </tr>
            {filteredOperators().map(([validator_address, item], i) => renderItem(item, true))}
            {filteredValidators().map(([validator_address, item], i) => renderItem(item))}
          </tbody>
        </Table>
      }
      {filteredOperators().length < 1 && filteredValidators().length < 1 &&
        <p>No results found</p>
      }
    </>
  )
}

export default Validators;
