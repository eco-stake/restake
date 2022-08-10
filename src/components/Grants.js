import React, { useState, useEffect, useReducer } from 'react';
import _ from 'lodash'
import FuzzySearch from 'fuzzy-search'
import Moment from 'react-moment';

import {
  Spinner,
  Table,
  Nav,
  Button
} from 'react-bootstrap'
import { XCircle } from "react-bootstrap-icons";

import AlertMessage from './AlertMessage';
import RevokeGrant from './RevokeGrant';
import Coins from './Coins';
import GrantModal from './GrantModal';
import Favourite from './Favourite';

function Grants(props) {
  const { address, wallet, network, operators, validators, grants } = props
  const [error, setError] = useState()
  const [showModal, setShowModal] = useState()
  const [grantsLoading, setGrantLoading] = useReducer(
    (grantsLoading, newGrantsLoading) => ({...grantsLoading, ...newGrantsLoading}),
    {}
  )

  const [filter, setFilter] = useState({keywords: '', group: 'granter'})
  const [results, setResults] = useState([])

  const isNanoLedger = props.wallet?.getIsNanoLedger()

  useEffect(() => {
    if(!grants) return

    let filtered = filteredGrants(grants, filter)
    let group = filter.group
    while(filtered.length < 1 && group !== 'grantee'){
      group = 'grantee'
      filtered = filteredGrants(grants, {...filter, group})
      if(filtered.length > 0 || group === 'all'){
        return setFilter({ ...filter, group })
      }
    }
    setResults(filtered)
  }, [grants, filter]);

  function sortGrants(grants){
    return _.sortBy(grants, ({ expiration }) => {
      return new Date(expiration)
    });
  }

  function filterGrants(event){
    setFilter({...filter, keywords: event.target.value})
  }

  function filteredGrants(grants, filter){
    let searchResults = grants
    const { keywords, group } = filter

    searchResults = filterByGroup(searchResults, group)

    if (!keywords || keywords === '') return sortGrants(searchResults)

    const searcher = new FuzzySearch(
      searchResults, ['grantee', 'granter', 'authorization.@type', 'authorization.msg'],
      { sort: true }
    )

    return searcher.search(keywords)
  }

  function filterByGroup(grants, group){
    switch (group) {
      case 'grantee':
        grants = grants.grantee
        break;
      case 'granter':
        grants = grants.granter
        break;
    }
    return grants
  }

  function validatorForGrantAddress(grantAddress){
    const operator = operators.find(el => el.botAddress === grantAddress)
    if(!operator) return null

    return validators[operator.address]
  }

  function renderGrantData(grant){
    const maxTokens = grant.authorization.max_tokens
    switch (grant.authorization['@type']) {
      case "/cosmos.staking.v1beta1.StakeAuthorization":
        return (
          <small>
            Maximum: {maxTokens ? <Coins coins={maxTokens} asset={network.baseAsset} fullPrecision={true} hideValue={true} /> : 'unlimited'}<br />
            Validators: {grant.authorization.allow_list.address.join(', ')}
          </small>
        )
      case "/cosmos.authz.v1beta1.GenericAuthorization":
        return (
          <small>
            Message: {grant.authorization.msg.split('.').slice(-1)[0]}
          </small>
        )
    }
  }

  function closeModal(){
    setShowModal(false)
  }

  function onGrant(grantee, grant){
    setError(false)
    closeModal()
    props.onGrant(grantee, grant)
  }

  function onRevoke(grantee, msgTypes){
    setError(false)
    props.onRevoke(grantee, msgTypes)
  }

  function renderGrant(grant) {
    const { granter, grantee, authorization, expiration } = grant

    const validator = filter.group === 'granter' && validatorForGrantAddress(grant.grantee)
    const favourite = props.favouriteAddresses && props.favouriteAddresses.find(el => el.address === (filter.group === 'granter' ? grantee : granter))
    const grantId = `${granter}-${grantee}-${authorization['@type']}-${authorization.msg}`
    return (
      <tr key={grantId}>
        <td className="text-break">
          {filter.group === 'grantee' ? (
            <div className="d-flex">
              <Favourite favourites={props.favouriteAddresses} value={granter} toggle={props.toggleFavouriteAddress} />
              <span className="ps-2">{favourite?.label || granter}</span>
            </div>
          ) : (
            validator ? validator.moniker : favourite?.label || grantee
          )}
        </td>
        <td>
          {authorization['@type'].split('.').slice(-1)[0]}
        </td>
        <td className="d-none d-lg-table-cell">
          {renderGrantData(grant)}
        </td>
        <td className="d-none d-md-table-cell">
          <Moment format="LLL">
            {expiration}
          </Moment>
        </td>
        {filter.group === 'granter' && (
          <td>
            <div className="d-grid gap-2 d-md-flex justify-content-end">
              {!grantsLoading[grantId] ? (
                <RevokeGrant
                  address={address}
                  wallet={wallet}
                  grantAddress={grantee}
                  button={true}
                  size="sm"
                  grants={[grant]}
                  stargateClient={props.stargateClient}
                  onRevoke={onRevoke}
                  setLoading={(loading) =>
                    setGrantLoading({ [grantId]: loading })
                  }
                  setError={setError}
                />
              ) : (
                <Button className="btn-sm btn-danger mr-5" disabled>
                  <span
                    className="spinner-border spinner-border-sm"
                    role="status"
                    aria-hidden="true"
                  ></span>
                  &nbsp;
                </Button>
              )}
            </div>
          </td>
        )}
      </tr>
    );
  }

  if (!grants) {
    return (
      <div className="text-center">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </div>
    );
  }

  const alerts = (
    <>
      {!props.grantQuerySupport && (
        <AlertMessage variant="warning">This network doesn't fully support this feature just yet. <span role="button" className="text-decoration-underline" onClick={props.showFavouriteAddresses}>Save addresses</span> to see them here.</AlertMessage>
      )}
      {props.grantQuerySupport && isNanoLedger && (
        <AlertMessage
          variant="warning"
          dismissible={false}
        >
          <p>Ledger devices can't send Authz transactions just yet. Full support will be enabled as soon as it is possible.</p>
          <p className="mb-0"><span onClick={() => setShowModal(true)} role="button" className="text-reset text-decoration-underline">A manual workaround is possible using the CLI.</span></p>
        </AlertMessage>
        )}
      <AlertMessage message={error} />
    </>
  );

  return (
    <>
      {alerts}
      <div className="mb-2">
        <div className="d-flex flex-wrap justify-content-center align-items-start mb-3 position-relative">
          <div className="d-none d-md-flex me-5">
            <div className="input-group">
              <input className="form-control border-right-0 border" onChange={filterGrants} value={filter.keywords} type="text" placeholder="Search.." />
              <span className="input-group-append">
                <button className="btn btn-light text-dark border-left-0 border" type="button" onClick={() => setFilter({ ...filter, keywords: '' })}>
                  <XCircle />
                </button>
              </span>
            </div>
          </div>
          <div className="w-100 d-flex d-md-none mb-2">
            <div className="input-group">
              <input className="form-control border-right-0 border" onChange={filterGrants} value={filter.keywords} type="text" placeholder="Search.." />
              <span className="input-group-append">
                <button className="btn btn-light text-dark border-left-0 border" type="button" onClick={() => setFilter({ ...filter, keywords: '' })}>
                  <XCircle />
                </button>
              </span>
            </div>
          </div>
          <div className="d-lg-flex d-none position-absolute mx-auto justify-content-center align-self-center">
            <Nav fill variant="pills" activeKey={filter.group} className={`${props.modal ? ' small' : ''}`} onSelect={(e) => setFilter({ ...filter, group: e })}>
              <Nav.Item>
                <Nav.Link eventKey="granter" disabled={filteredGrants(grants, { ...filter, group: 'granter' }).length < 1}>Granted by me</Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="grantee" disabled={filteredGrants(grants, { ...filter, group: 'grantee' }).length < 1}>Granted to me</Nav.Link>
              </Nav.Item>
            </Nav>
          </div>
          <div className="d-flex d-lg-none justify-content-center">
            <select className="form-select w-auto h-auto" aria-label="Grant group" value={filter.group} onChange={(e) => setFilter({ ...filter, group: e.target.value })}>
              <option value="granter" disabled={filteredGrants(grants, { ...filter, group: 'granter' }).length < 1}>Granted by me</option>
              <option value="grantee" disabled={filteredGrants(grants, { ...filter, group: 'grantee' }).length < 1}>Granted to me</option>
            </select>
          </div>
          <div className="flex-fill d-flex justify-content-end">
            <Button variant="primary" disabled={!wallet?.hasPermission(address, 'Grant')} onClick={() => setShowModal(true)}>
              {address && !isNanoLedger ? 'New Grant' : 'CLI/Ledger Instructions'}
            </Button>
          </div>
        </div>
        {results.length > 0 &&
          <Table className="align-middle table-striped">
            <thead>
              <tr>
                <th>{filter.group === 'grantee' ? 'Granter' : 'Grantee'}</th>
                <th>Type</th>
                <th className="d-none d-lg-table-cell">Data</th>
                <th className="d-none d-md-table-cell">Expiration</th>
                {filter.group === 'granter' && (
                  <th></th>
                )}
              </tr>
            </thead>
            <tbody>
              {results.map(item => renderGrant(item))}
            </tbody>
          </Table>
        }
        {results.length < 1 &&
          <p className="text-center my-5"><em>No grants found</em></p>
        }
      </div>
      <GrantModal
        show={showModal}
        network={props.network}
        address={props.address}
        wallet={props.wallet}
        favouriteAddresses={props.favouriteAddresses}
        stargateClient={props.stargateClient}
        onHide={closeModal}
        onGrant={onGrant}
      />
    </>
  );
}

export default Grants;