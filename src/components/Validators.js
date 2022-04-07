import React, { useState, useEffect } from 'react';
import _ from 'lodash'
import FuzzySearch from 'fuzzy-search'
import ValidatorImage from './ValidatorImage'
import TooltipIcon from './TooltipIcon'

import {
  Table,
  Button,
  Spinner,
  Tab,
  Tabs
} from 'react-bootstrap'

import {
  CheckCircle, XCircle
} from 'react-bootstrap-icons'
import ValidatorName from './ValidatorName';

function Validators(props) {
  const { validators, operators } = props

  const [filter, setFilter] = useState()
  const [results, setResults] = useState([])

  useEffect(() => {
    if (!validators) return

    setResults(filteredValidators())
  }, [filter, validators, operators]);

  function filterValidators(event){
    setFilter(event.target.value)
  }

  function filteredValidators(){
    let searchResults = validators
    if (props.exclude) searchResults = _.omit(searchResults, props.exclude)

    if (!filter || filter === '') return Object.values(searchResults)

    const searcher = new FuzzySearch(
      Object.values(searchResults), ['description.moniker'],
      { sort: true }
    )

    return searcher.search(filter)
  }

  function statusResults(status){
    return results.filter(result => {
      if(status === 'active'){
        return result.status === 'BOND_STATUS_BONDED'
      }else{
        return result.status !== 'BOND_STATUS_BONDED'
      }
    })
  }

  function renderItem(item, isActive){
    const address = item.operator_address
    const isOperator = operators.map(el => el.address).includes(address)
    let variant = null
    variant = variant ? 'table-' + variant : ''
    return (
      <tr key={address} className={variant}>
        {isActive && (
          <td>{item.rank}</td>
        )}
        <td>
          <div className="row">
            <div className="col-1 me-2">
              <ValidatorImage validator={item} width={30} height={30} />
            </div>
            <div className="col">
              <span className="align-middle"><ValidatorName validator={item} hideWarning={true} /></span>
            </div>
          </div>
        </td>
        {!isActive && (
          <td>{item.jailed ? 'Jailed' : ''}</td>
        )}
        <td className="text-center">
          {isOperator
            ? <TooltipIcon icon={<CheckCircle className="text-success" />} identifier={address}
              tooltip="This validator can REStake your rewards" />
            : <TooltipIcon icon={<XCircle className="opacity-50" />} identifier={address}
              tooltip="This validator is not a REStake operator" />
          }
        </td>
        {isActive && props.network.data.apyEnabled !== false && (
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
      <Tabs defaultActiveKey="active" id="validators-tabs" className="mb-3">
        {['active', 'inactive'].map(status => {
          return (
            <Tab key={status} eventKey={status} title={_.startCase(status)}>
              {statusResults(status).length > 0 &&
                <Table className="align-middle">
                  <tbody>
                    <tr>
                      {status === 'active' && (
                        <th>#</th>
                      )}
                      <th>Validator</th>
                      {status !== 'active' && (
                        <th>Status</th>
                      )}
                      <th className="text-center">REStake</th>
                      {status === 'active' && props.network.apyEnabled !== false && (
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
                    {statusResults(status).map(item => renderItem(item, status === 'active'))}
                  </tbody>
                </Table>
              }
              {statusResults(status).length < 1 &&
                <p>No results found</p>
              }
            </Tab>
          )
        })}
      </Tabs>
    </>
  )
}

export default Validators;
