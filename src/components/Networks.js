import React, { useState, useEffect } from 'react';
import _ from 'lodash'
import FuzzySearch from 'fuzzy-search'

import {
  Row,
  Col,
  Card,
  Nav
} from 'react-bootstrap'
import { XCircle, BookmarkStar, BookmarkStarFill } from "react-bootstrap-icons";
import NetworkChecks from './NetworkChecks';
import NetworkImage from './NetworkImage';

function Networks(props) {
  const { networks, favourites } = props

  const [filter, setFilter] = useState({keywords: '', group: 'favourites'})
  const [results, setResults] = useState([])

  useEffect(() => {
    let filtered = filteredNetworks(networks, filter)
    let group = filter.group
    while(filtered.length < 1 && group !== 'all'){
      group = 'all'
      filtered = filteredNetworks(networks, {...filter, group})
      if(filtered.length > 0 || group === 'all'){
        return setFilter({ ...filter, group })
      }
    }
    setResults(filtered)
  }, [networks, filter]);

  function filterNetworks(event){
    setFilter({...filter, keywords: event.target.value})
  }

  function filteredNetworks(networks, filter){
    let searchResults = networks
    const { keywords, group } = filter

    switch (group) {
      case 'favourites':
        searchResults = searchResults.filter((network) => favourites.includes(network.path))
        break;
    }

    if (!keywords || keywords === '') return searchResults

    const searcher = new FuzzySearch(
      searchResults, ['prettyName', 'keywords'],
      { sort: true }
    )

    return searcher.search(keywords)
  }

  async function changeNetwork(network){
    if(!network.online) return 

    await network.load()
    await network.connect()
    props.changeNetwork(network)
  }

  function toggleFavourite(network){
    props.toggleFavourite(network)
  }

  function renderFavourite(network){
    const favourited = favourites.includes(network.path)
    const className="text-success favourite-" + (favourited ? 'on' : 'off')
    return (
      <div className={className}>
        <BookmarkStarFill width={20} height={20} className="on" />
        <BookmarkStar width={20} height={20} className="off" />
      </div>
    )
  }

  function renderNetworks(networks, opts){
    return (
      <Row xs={1} sm={2} lg={3} xxl={4} className="g-4 justify-content-center">
        {networks.map((network) => (
          <Col key={network.path} className={network.online ? '' : 'opacity-50'}>
            <Card>
              <span onClick={() => toggleFavourite(network)} role="button" className="text-right position-absolute top-0 end-0 py-1 px-2" style={{ zIndex: 2 }}>
                {renderFavourite(network)}
              </span>
              <span role={ network.online ? "button" : "" } className="stretched-link" onClick={() => changeNetwork(network)}>
                <Row className="g-0">
                  <Col xs={3} className="text-center">
                    <NetworkImage network={network} width={60} height={60} className="m-2 shadow overflow-hidden rounded-circle" />
                  </Col>
                  <Col xs={9}>
                    <Card.Body>
                      <Card.Title className="text-truncate">{network.prettyName}</Card.Title>
                      <NetworkChecks network={network} className="small" skipConnected={true} style={{position: 'relative', zIndex: 2}} />
                    </Card.Body>
                  </Col>
                </Row>
              </span>
            </Card>
          </Col>
        ))}
      </Row>
    )
  }

  return (
    <>
      <div className="d-flex flex-nowrap justify-content-center align-items-start mb-3 position-relative">
        <div className="flex-fill flex-md-grow-0 me-2 me-md-5 mb-2 mb-md-0">
          <div className="input-group">
            <input className="form-control border-right-0 border" onChange={filterNetworks} value={filter.keywords} type="text" placeholder="Search.." />
            <span className="input-group-append">
              <button className="btn btn-light text-dark border-left-0 border" type="button" onClick={() => setFilter({...filter, keywords: ''})}>
                <XCircle />
              </button>
            </span>
          </div>
        </div>
        <div className="d-lg-flex d-none position-absolute mx-auto justify-content-center align-self-center">
          <Nav fill variant="pills" activeKey={filter.group} className={`flex-row${props.modal ? ' small' : ''}`} onSelect={(e) => setFilter({...filter, group: e})}>
            <Nav.Item>
              <Nav.Link eventKey="favourites" disabled={filteredNetworks(networks, {...filter, group: 'favourites'}).length < 1}>Favourites</Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="all">All Networks</Nav.Link>
            </Nav.Item>
          </Nav>
        </div>
        <div className="d-flex d-lg-none justify-content-end">
          <select className="form-select w-auto h-auto d-lg-none" aria-label="Network group" value={filter.group} onChange={(e) => setFilter({...filter, group: e.target.value})}>
            <option value="favourites" disabled={filteredNetworks(networks, {...filter, group: 'favourites'}).length < 1}>Favourites</option>
            <option value="all">All</option>
          </select>
        </div>
        <div className="flex-fill d-none d-lg-flex justify-content-end">
        </div>
      </div>
      {renderNetworks(results)}
    </>
  );
}

export default Networks;