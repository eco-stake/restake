import React, { useState, useEffect } from 'react';
import Moment from 'react-moment';
import _ from 'lodash'
import FuzzySearch from 'fuzzy-search'

import {
  Table,
  Button,
  Nav,
} from 'react-bootstrap'
import { XCircle } from "react-bootstrap-icons";

import ProposalProgress from './ProposalProgress';
import { PROPOSAL_STATUSES } from '../utils/Proposal.mjs';

function Proposals(props) {
  const { proposals, tallies, votes } = props

  const [filter, setFilter] = useState({keywords: '', status: '', group: 'voting'})
  const [results, setResults] = useState([])

  useEffect(() => {
    let filtered = filteredProposals(proposals, filter)
    let group = filter.group
    while(filtered.length < 1 && group !== 'all'){
      group = 'all'
      filtered = filteredProposals(proposals, {...filter, group})
      if(filtered.length > 0 || group === 'all'){
        return setFilter({ ...filter, group })
      }
    }
    setResults(filtered)
  }, [proposals, filter]);

  function sortProposals(proposals){
    return _.sortBy(proposals, ({ proposal_id }) => {
      return 0 - parseInt(proposal_id)
    });
  }

  function filterProposals(event){
    setFilter({...filter, keywords: event.target.value})
  }

  function filteredProposals(proposals, filter){
    let searchResults = proposals
    const { keywords, status, group } = filter

    if(status){
      searchResults = searchResults.filter(result => {
        return result.status === status
      })
    }

    searchResults = filterByGroup(searchResults, group)

    if (!keywords || keywords === '') return sortProposals(searchResults)

    const searcher = new FuzzySearch(
      searchResults, ['content.title'],
      { sort: true }
    )

    return searcher.search(keywords)
  }

  function filterByGroup(proposals, group){
    switch (group) {
      case 'voting':
        proposals = proposals.filter((proposal) => proposal.isVoting)
        break;
    }
    return proposals
  }

  function renderProposal(proposal) {
    const proposalId = proposal.proposal_id
    const vote = votes[proposalId]
    return (
      <tr key={proposalId}>
        <td className="d-none d-md-table-cell">{proposalId}</td>
        <td>
          <span role="button" onClick={() => props.showProposal(proposal)}>
            {proposal.content.title}
          </span>
        </td>
        <td className="d-none d-lg-table-cell text-center text-nowrap">
          {proposal.statusHuman}
        </td>
        <td className="d-none d-md-table-cell text-center text-nowrap">
          <Moment fromNow>
            {proposal.isDeposit ? proposal.deposit_end_time : proposal.voting_end_time}
          </Moment>
        </td>
        <td className="d-none d-lg-table-cell text-center">
          {proposal.isVoting && (
            vote ? vote.optionHuman : <XCircle className="opacity-50" />
          )}
        </td>
        <td className="d-none d-md-table-cell text-center">
          <ProposalProgress
            proposal={proposal}
            tally={tallies[proposalId]} />
        </td>
        <td>
          <div className="d-grid gap-2 d-md-flex justify-content-end">
            <Button size="sm" onClick={() => props.showProposal(proposal)}>
              View
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <>
      <div className="d-flex flex-wrap justify-content-center align-items-start mb-3 position-relative">
        <div className="d-none d-md-flex me-5">
          <div className="input-group">
            <input className="form-control border-right-0 border" onChange={filterProposals} value={filter.keywords} type="text" placeholder="Search.." />
            <span className="input-group-append">
              <button className="btn btn-light text-dark border-left-0 border" type="button" onClick={() => setFilter({...filter, keywords: ''})}>
                <XCircle />
              </button>
            </span>
          </div>
        </div>
        <div className="w-100 d-flex d-md-none mb-2">
          <div className="input-group">
            <input className="form-control border-right-0 border" onChange={filterProposals} value={filter.keywords} type="text" placeholder="Search.." />
            <span className="input-group-append">
              <button className="btn btn-light text-dark border-left-0 border" type="button" onClick={() => setFilter({...filter, keywords: ''})}>
                <XCircle />
              </button>
            </span>
          </div>
        </div>
        <div className="d-lg-flex d-none position-absolute mx-auto justify-content-center align-self-center">
          <Nav fill variant="pills" activeKey={filter.group} className={`${props.modal ? ' small' : ''}`} onSelect={(e) => setFilter({...filter, group: e})}>
            <Nav.Item>
              <Nav.Link eventKey="voting" disabled={filteredProposals(proposals, {...filter, group: 'voting'}).length < 1}>Voting Period</Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="all">All Proposals</Nav.Link>
            </Nav.Item>
          </Nav>
        </div>
        <div className="d-flex d-lg-none justify-content-center">
          <select className="form-select w-auto h-auto" aria-label="Proposal group" value={filter.group} onChange={(e) => setFilter({...filter, group: e.target.value})}>
            <option value="voting" disabled={filteredProposals(proposals, {...filter, group: 'voting'}).length < 1}>Voting Period</option>
            <option value="all">All</option>
          </select>
        </div>
        <div className="flex-fill d-flex justify-content-end">
          <select className="form-select w-auto h-auto" aria-label="Proposal status" value={filter.status} onChange={(e) => setFilter({...filter, status: e.target.value})}>
            {Object.entries(PROPOSAL_STATUSES).map(([key, value]) => {
              return (
                <option key={key} value={key}>{value}</option>
              )
            })}
          </select>
        </div>
      </div>
      {results.length > 0 &&
        <Table className="align-middle table-striped">
          <thead>
            <tr>
              <th className="d-none d-md-table-cell">#</th>
              <th>Proposal</th>
              <th className="d-none d-lg-table-cell text-center">Status</th>
              <th className="d-none d-md-table-cell text-center">End Time</th>
              <th className="d-none d-lg-table-cell text-center">Voted</th>
              <th className="d-none d-md-table-cell text-center">Progress</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {results.map(item => renderProposal(item))}
          </tbody>
        </Table>
      }
      {results.length < 1 &&
        <p className="text-center my-5"><em>No proposals found</em></p>
      }
    </>
  )
}

export default Proposals;
