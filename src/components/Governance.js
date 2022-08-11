import React, { useState, useEffect, useReducer } from 'react';
import _ from 'lodash'

import {
  Spinner,
} from 'react-bootstrap'
import { useParams, useNavigate } from "react-router-dom";

import AlertMessage from './AlertMessage';
import Proposals from './Proposals';
import { executeSync } from '../utils/Helpers.mjs';
import ProposalModal from './ProposalModal';
import Proposal from '../utils/Proposal.mjs';
import Vote from '../utils/Vote.mjs';

function Governance(props) {
  const { address, wallet, network } = props
  const [showModal, setShowModal] = useState()
  const [proposal, setProposal] = useState()
  const [proposals, setProposals] = useState()
  const [tallies, setTallies] = useReducer(
    (tallies, newTallies) => (!newTallies ? {} : {...tallies, ...newTallies}),
    {}
  )
  const [votes, setVotes] = useReducer(
    (votes, newVotes) => (!newVotes ? {} : {...votes, ...newVotes}),
    {}
  )
  const [error, setError] = useState()
  const navigate = useNavigate();
  const params = useParams();

  const voteGrants = (wallet?.grants || []).filter(grant => {
    return grant.authorization['@type'] === '/cosmos.authz.v1beta1.GenericAuthorization' && 
      grant.authorization.msg === '/cosmos.gov.v1beta1.MsgVote'
  })

  useEffect(() => {
    setProposals(false)
    setTallies(false)
    setVotes(false)
    setError(false)
    getProposals({clearExisting: true})
  }, [network]);

  useEffect(() => {
    const interval = setInterval(() => {
      getProposals()
    }, 120_000);
    return () => clearInterval(interval);
  }, [network]);

  useEffect(() => {
    if(!proposals || !params.proposalId) return
    const prop = proposals.find(el => el.proposal_id === params.proposalId)
    if(prop){
      showProposal(prop)
    }else if(proposal){
      setProposal(null)
      closeProposal()
    }
  }, [proposals, params.proposalId])

  useEffect(() => {
    if(!proposals) return

    getTallies(proposals)

    if(address){
      getVotes(proposals)
    }
  }, [proposals]);

  useEffect(() => {
    setVotes(false)
    if(proposals && address){
      getVotes(proposals, {clearExisting: true})
    }
  }, [address]);

  async function getProposals(opts) {
    if(!props.queryClient) return
    const { clearExisting } = opts || {}

    try {
      let newProposals = await props.queryClient.getProposals()
      newProposals = newProposals.map(el => Proposal(el))
      setProposals(sortProposals(newProposals))
      setTallies(newProposals.reduce((sum, proposal) => {
        if (!_.every(Object.values(proposal.final_tally_result), el => el === '0')) {
          sum[proposal.proposal_id] = proposal.final_tally_result
        }
        return sum
      }, {}))
    } catch (error) {
      if (!proposals || clearExisting) setProposals([])
      setError(`Failed to load proposals: ${error.message}`);
    }
  }

  async function getTallies(proposals) {
    const calls = proposals.map((proposal) => {
      return () => {
        const { proposal_id, final_tally_result: result } = proposal
        if (tallies[proposal_id]) return

        const talliesInvalid = _.every(Object.values(result), el => el === '0')
        if (proposal.isVoting && talliesInvalid) {
          return props.queryClient.getProposalTally(proposal_id).then(result => {
            return setTallies({ [proposal_id]: result.tally })
          })
        }
      }
    });

    await executeSync(calls, 2)
  };

  async function getVotes(proposals, opts) {
    const { clearExisting } = opts || {}
    const calls = proposals.filter(el => el.status === 'PROPOSAL_STATUS_VOTING_PERIOD').map((proposal) => {
      return () => {
        const { proposal_id } = proposal
        if (votes[proposal_id] && !clearExisting) return

        return props.queryClient.getProposalVote(proposal_id, address).then(result => {
          return setVotes({ [proposal_id]: Vote(result.vote) })
        }).catch(error => { })
      }
    });

    await executeSync(calls, 2)
  };

  function showProposal(proposal){
    setProposal(proposal)
    setShowModal(true)
    if (proposal.proposal_id !== params.proposalId) {
      navigate(`/${network.name}/govern/${proposal.proposal_id}`)
    }
  }

  function closeProposal(){
    setShowModal(false)
    navigate(`/${network.name}/govern`)
  }

  function onVote(proposal, vote){
    setError(null)
    setVotes({
      [proposal.proposal_id]: vote
    })
    closeProposal()
  }

  function sortProposals(proposals){
    return _.sortBy(proposals, ({ proposal_id }) => {
      return 0 - parseInt(proposal_id)
    });
  }

  if (!proposals) {
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
      <AlertMessage message={error} />
    </>
  );

  return (
    <>
      {alerts}
      <div className="mb-2">
        <Proposals
          network={network}
          address={address}
          proposals={proposals}
          tallies={tallies}
          votes={votes}
          signingClient={props.signingClient}
          showProposal={showProposal}
          setError={setError}
          onVote={onVote} />
      </div>
      <ProposalModal
        show={showModal}
        proposal={proposal}
        network={network}
        wallet={wallet}
        address={address}
        tally={proposal && tallies[proposal.proposal_id]}
        vote={proposal && votes[proposal.proposal_id]}
        granters={voteGrants.map(el => el.granter)}
        favouriteAddresses={props.favouriteAddresses}
        queryClient={props.queryClient}
        signingClient={props.signingClient}
        closeProposal={closeProposal}
        onVote={onVote}
        setError={setError}
      />
    </>
  );
}

export default Governance;