import React, { useState, useReducer, useEffect } from 'react';
import _ from 'lodash'
import FuzzySearch from 'fuzzy-search'
import { round } from 'mathjs'

import { format, add } from 'mathjs'

import Coins from "./Coins";
import ValidatorImage from './ValidatorImage'
import TooltipIcon from './TooltipIcon'

import {
  Table,
  Button,
  Spinner,
  Nav,
  Spinner,
  Badge
} from 'react-bootstrap'
import { XCircle } from "react-bootstrap-icons";

import ValidatorName from "./ValidatorName";
import ValidatorServices from './ValidatorServices';
import REStakeStatus from './REStakeStatus';

function Validators(props) {
  const { address, wallet, network, validators, operators, delegations, operatorGrants } = props

  const [filter, setFilter] = useReducer(
    (state, newState) => ({ ...state, ...newState }),
    {keywords: '', status: 'active', group: 'delegated'}
  )
  const [results, setResults] = useState([])

  const showCommission = results && Object.values(results).find(el => el.isValidatorOperator(address))

  useEffect(() => {
    if(delegations && filter.group !== 'delegated'){
      return setFilter({ group: 'delegated' })
    }
  }, [Object.keys(delegations || {}).length]);

  useEffect(() => {
    let filtered = filteredValidators(validators, filter)
    let group = filter.group
    while(filtered.length < 1 && group !== 'all'){
      group = 'all'
      filtered = filteredValidators(validators, {...filter, group})
      if(filtered.length > 0 || group === 'all'){
        return setFilter({ group })
      }
    }
    setResults(filtered)
  }, [validators, operators, delegations, operatorGrants, filter]);

  function sortValidators(validators){
    validators = _.sortBy(validators, ({ operator_address: address }) => {
      const delegation = delegations && delegations[address]
      return 0 - (delegation?.balance?.amount || 0)
    });
    return _.sortBy(validators, ({ operator_address: address }) => {
      if(network.data.ownerAddress === address) return -5

      const delegation = delegations && delegations[address]
      const operator = operators && operators.find(el => el.address === address)

      if (delegation) {
        return operator ? -2 : -1
      } else {
        return operator ? 0 : 1
      }
    });
  }

  function filterValidators(event){
    setFilter({keywords: event.target.value})
  }

  function filteredValidators(validators, filter){
    let searchResults
    if (props.exclude){
      searchResults = Object.values(_.omit(validators, props.exclude))
    }else{
      searchResults = Object.values(validators)
    }
    const { keywords, status, group } = filter

    if(status){
      searchResults = searchResults.filter(result => {
        if (status === 'active') {
          return result.status === 'BOND_STATUS_BONDED'
        } else if (status === 'inactive') {
          return result.status !== 'BOND_STATUS_BONDED'
        } else {
          return true
        }
      })
    }

    searchResults = filterByGroup(searchResults, group)

    if (!keywords || keywords === '') return sortValidators(searchResults)

    const searcher = new FuzzySearch(
      searchResults, ['description.moniker'],
      { sort: true }
    )

    return searcher.search(keywords)
  }

  function filterByGroup(validators, group){
    switch (group) {
      case 'delegated':
        validators = validators.filter(({operator_address: address}) => {
          return delegations && delegations[address]
        })
        break;
    }
    return validators
  }

  function operatorForValidator(validatorAddress) {
    return operators.find((el) => el.address === validatorAddress);
  }

  function renderValidator(validator) {
    const validatorAddress = validator.operator_address
    const delegation = delegations && delegations[validatorAddress];
    const validatorOperator = validator.isValidatorOperator(address)
    const rewards =
      props.rewards && props.rewards[validatorAddress];
    const denomRewards = rewards && rewards.reward.find(
      (reward) => reward.denom === network.denom
    );
    const commission = props.commission && props.commission[validatorAddress]
    const denomCommission = commission && commission.commission.find(
      (commission) => commission.denom === network.denom
    );
    const operator = operatorForValidator(validatorAddress);
    const grants = operator && operatorGrants[operator.botAddress]

    let rowVariant
    if (validatorOperator) rowVariant = 'table-info'

    const delegationBalance = (delegation && delegation.balance) || {
      amount: 0,
      denom: network.denom,
    };

    let badge
    if (validator.jailed) {
      badge = { bg: 'danger', text: 'Jailed' }
    } else if (!validator.active) {
      badge = { bg: 'light', text: 'Inactive' }
    }

    return (
      <tr key={validatorAddress} className={rowVariant}>
        <td className="px-1" width={30}>
          <ValidatorImage
            validator={validator}
            width={30}
            height={30}
          />
        </td>
        <td className="ps-1 text-break">
          <div role="button" onClick={() => props.showValidator(validator, { activeTab: 'profile' })}>
            <div className="d-flex align-items-start align-items-sm-center justify-content-end flex-column flex-sm-row gap-1 gap-sm-3">
              <ValidatorName validator={validator} className="me-auto" />
              {badge ? <small><Badge bg={badge.bg} className="opacity-75">{badge.text}</Badge></small> : null}
              <div className="text-muted small d-none d-md-block">#{validator.rank}</div>
            </div>
          </div>
        </td>
        <td className="text-center">
          <REStakeStatus
            network={network}
            validator={validator}
            operator={operator}
            delegation={delegation}
            rewards={rewards}
            grants={grants}
            authzSupport={props.authzSupport}
            onClick={() => props.showValidator(validator, { activeTab: 'stake' })}
          />
        </td>
        {network.apyEnabled && (
          <td className="text-center">
            <span role="button" onClick={() => props.showValidator(validator, { activeTab: 'stake' })}>
              {props.validatorApy[validatorAddress] !== undefined
                ? <small>{round(props.validatorApy[validatorAddress] * 100, 1).toLocaleString() + "%"}</small>
                : "-"
              }
            </span>
          </td>
        )}
        <td className={network.apyEnabled ? 'text-center d-none d-lg-table-cell' : 'text-center'}>
          <small>{format(validator.commission.commission_rates.rate * 100, 2)}%</small>
        </td>
        {Object.keys(delegations || {}).length ? (
          <td className={filter.group === 'delegated' ? '' : 'd-none d-sm-table-cell'}>
            {delegations ? (
              delegationBalance?.amount ? (
                <div role="button" onClick={() => props.showValidator(validator, { activeTab: 'stake' })}>
                  <small>
                    <Coins
                      coins={delegationBalance}
                      asset={network.baseAsset}
                      precision={3}
                    />
                  </small>
                </div>
              ) : null
            ) : address &&  (
              <Spinner animation="border" role="status" className="spinner-border-sm text-secondary">
                <span className="visually-hidden">Loading...</span>
              </Spinner>
            )}
          </td>
        ) : null}
        {filter.group === 'delegated' && (
          <>
            {!props.modal && (
              <td className="d-none d-md-table-cell">
                {props.rewards ? denomRewards && (
                  <div role="button" onClick={() => props.showValidator(validator, { activeTab: 'stake' })}>
                    <small>
                      <Coins
                        key={denomRewards.denom}
                        coins={denomRewards}
                        asset={network.baseAsset}
                        precision={3}
                      />
                    </small>
                  </div>
                ) : address && (
                  <Spinner animation="border" role="status" className="spinner-border-sm text-secondary">
                    <span className="visually-hidden">Loading...</span>
                  </Spinner>
                )}
              </td>
            )}
            </>
          )}
          {!props.modal && showCommission && (
          <td className="d-none d-md-table-cell">
            {denomCommission ? (
              <div role="button" onClick={() => props.showValidator(validator, { activeTab: 'stake' })}>
                <small>
                  <Coins
                    key={denomCommission.denom}
                    coins={denomCommission}
                    asset={network.baseAsset}
                    precision={3}
                  />
                </small>
              </div>
            ) : validatorOperator && (
              <Spinner animation="border" role="status" className="spinner-border-sm text-secondary">
                <span className="visually-hidden">Loading...</span>
              </Spinner>
            )}
          </td>
        )}
        {!props.modal && (
          <td className={filter.group === 'delegated' ? 'd-none d-sm-table-cell' : ''}>
            <div className="d-grid justify-content-end align-items-center">
              <ValidatorServices validator={validator} network={network} show={['stakingrewards', 'nodes']} theme={props.theme} />
            </div>
          </td>
        )}
        <td className="d-none d-sm-table-cell" width={60}>
          <div className="d-grid justify-content-end align-items-center">
            {props.buttonText ? (
              <Button size="sm" onClick={() => props.showValidator(validator, {activeTab: 'stake'})}>
                {props.buttonText}
              </Button>
            ) : props.manageControl ? props.manageControl({validator, operator, delegation, rewards, grants, filter}) : null}
          </div>
        </td>
      </tr>
    );
  }

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-start mb-3 position-relative">
        <div className="d-none d-sm-flex">
          <div className="input-group">
            <input className="form-control border-right-0 border" onChange={filterValidators} value={filter.keywords} type="text" placeholder="Search.." style={{maxWidth: 150}} />
            <span className="input-group-append">
              <button className="btn btn-light text-dark border-left-0 border" type="button" onClick={() => setFilter({keywords: ''})}>
                <XCircle />
              </button>
            </span>
          </div>
        </div>
        <div className="w-100 d-flex d-sm-none mb-2">
          <div className="input-group">
            <input className="form-control border-right-0 border" onChange={filterValidators} value={filter.keywords} type="text" placeholder="Search.." />
            <span className="input-group-append">
              <button className="btn btn-light text-dark border-left-0 border" type="button" onClick={() => setFilter({keywords: ''})}>
                <XCircle />
              </button>
            </span>
          </div>
        </div>
        <div className={`${!props.modal && 'd-md-flex'} d-none justify-content-center align-self-center`}>
          <Nav fill variant="pills" activeKey={filter.group} className={`flex-row${props.modal ? ' small' : ''}`} onSelect={(e) => setFilter({group: e})}>
            <Nav.Item>
              <Nav.Link eventKey="delegated" disabled={filteredValidators(validators, {...filter, group: 'delegated'}).length < 1}>My Delegations</Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="all">All Validators</Nav.Link>
            </Nav.Item>
          </Nav>
        </div>
        <div className={`d-flex ${!props.modal && 'd-md-none'} justify-content-center`}>
          <select className="form-select w-auto h-auto" aria-label="Delegation group" value={filter.group} onChange={(e) => setFilter({group: e.target.value})}>
            <option value="delegated" disabled={filteredValidators(validators, {...filter, group: 'delegated'}).length < 1}>My Delegations</option>
            <option value="all">All Validators</option>
          </select>
        </div>
        <div className="d-flex justify-content-end">
          <select className="form-select w-auto h-auto" aria-label="Validator status" value={filter.status} onChange={(e) => setFilter({status: e.target.value})}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>
      {results.length > 0 &&
        <Table className="align-middle table-striped">
          <thead>
            <tr>
              <th colSpan={2}>Validator</th>
              <th className="text-center">REStake</th>
              {network.apyEnabled && (
                <th className="text-center">
                  <TooltipIcon
                    icon={<span className="text-decoration-underline">APY</span>}
                    identifier="delegations-apy"
                  >
                    <div className="mt-2 text-center">
                      <p>Based on commission, compounding frequency and recent block times.</p>
                      <p>This is a best case scenario and may not be 100% accurate.</p>
                    </div>
                  </TooltipIcon>
                </th>
              )}
              <th className={network.apyEnabled ? 'text-center d-none d-lg-table-cell' : 'text-center'}>Fee</th>
              {Object.keys(delegations || {}).length ? (
                <th className={filter.group === 'delegated' ? '' : 'd-none d-sm-table-cell'}>Delegation</th>
              ) : null}
              {filter.group === 'delegated' && (
                <>
                  {!props.modal && (
                    <th className="d-none d-md-table-cell">Rewards</th>
                  )}
                </>
              )}
              {!props.modal && showCommission && (
                <th className="d-none d-md-table-cell">Commission</th>
              )}
              {!props.modal && (
                <th className={filter.group === 'delegated' ? 'd-none d-sm-table-cell' : ''}></th>
              )}
              <th className="d-none d-sm-table-cell"></th>
            </tr>
          </thead>
          <tbody>
            {results.map(item => renderValidator(item))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}></td>
              <td className="text-center"></td>
              {network.apyEnabled && (
                <td className="text-center"></td>
              )}
              <td className={network.apyEnabled ? 'text-center d-none d-lg-table-cell' : 'text-center'}></td>
              {Object.keys(delegations || {}).length ? (
                <td className={filter.group === 'delegated' ? '' : 'd-none d-sm-table-cell'}>
                  <strong className="small">
                    <Coins
                      coins={{
                        amount: results.reduce((sum, result) => {
                          const delegation = delegations && delegations[result.operator_address]
                          if (!delegation) return sum

                          return add(sum, delegation.balance.amount)
                        }, 0),
                        denom: network.denom
                      }}
                      asset={network.baseAsset}
                      precision={3}
                    />
                  </strong>
                </td>
              ) : null}
              {filter.group === 'delegated' && (
                <>
                  {!props.modal && (
                    <td className="d-none d-md-table-cell">
                      {props.rewards && (
                        <strong className="small">
                          <Coins
                            coins={{
                              amount: results.reduce((sum, result) => {
                                const reward = props.rewards[result.operator_address]?.reward?.find(el => el.denom === network.denom)
                                if (!reward) return sum

                                return add(sum, reward.amount)
                              }, 0),
                              denom: network.denom
                            }}
                            asset={network.baseAsset}
                            precision={3}
                          />
                        </strong>
                      )}
                    </td>
                  )}
                </>
              )}
              {!props.modal && showCommission && (
                <td className="d-none d-md-table-cell">
                  {props.commission && (
                    <strong className="small">
                      <Coins
                        coins={{
                          amount: results.reduce((sum, result) => {
                            const commission = props.commission[result.operator_address]?.commission?.find(el => el.denom === network.denom)
                            if (!commission) return sum

                            return add(sum, commission.amount)
                          }, 0),
                          denom: network.denom
                        }}
                        asset={network.baseAsset}
                        precision={3}
                      />
                    </strong>
                  )}
                </td>
              )}
              {!props.modal && (
                <td className={filter.group === 'delegated' ? 'd-none d-sm-table-cell' : ''}></td>
              )}
              <td className="d-none d-sm-table-cell"></td>
            </tr>
          </tfoot>
        </Table>
      }
      {results.length < 1 &&
        <p className="text-center my-5"><em>No validators found</em></p>
      }
    </>
  )
}

export default Validators;
