import React, { useState, useEffect, useReducer } from 'react';
import _ from 'lodash'
import FuzzySearch from 'fuzzy-search'
import { Bech32 } from '@cosmjs/encoding'

import { add } from 'mathjs'

import Coins from "./Coins";
import ClaimRewards from "./ClaimRewards";
import RevokeRestake from "./RevokeRestake";
import ValidatorImage from './ValidatorImage'
import TooltipIcon from './TooltipIcon'

import {
  Table,
  Button,
  Spinner,
  Dropdown, 
  OverlayTrigger, 
  Tooltip,
  Nav
} from 'react-bootstrap'
import { FilterSquare, XCircle } from "react-bootstrap-icons";
import { useParams, useNavigate } from "react-router-dom";

import ValidatorName from "./ValidatorName";
import ManageRestake from "./ManageRestake";
import AlertMessage from './AlertMessage';
import Proposals from './Proposals';
import { executeSync, mapSync } from '../utils/Helpers.mjs';
import ProposalModal from './ProposalModal';
import Proposal from '../utils/Proposal.mjs';
import Vote from '../utils/Vote.mjs';

function Governance(props) {
  const { address, network } = props
  const [showModal, setShowModal] = useState()
  const [proposal, setProposal] = useState()
  const [proposals, setProposals] = useState()
  const [tallies, setTallies] = useReducer(
    (tallies, newTallies) => ({...tallies, ...newTallies}),
    {}
  )
  const [votes, setVotes] = useReducer(
    (votes, newVotes) => ({...votes, ...newVotes}),
    {}
  )
  const [error, setError] = useState()
  const navigate = useNavigate();
  const params = useParams();

  useEffect(() => {
    setProposals()
    setTallies({})
    setVotes({})

    getProposals()
  }, [props.queryClient]);

  useEffect(() => {
    const interval = setInterval(() => {
      getProposals()
    }, 120_000);
    return () => clearInterval(interval);
  }, []);

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
  }, [proposals]);

  useEffect(() => {
    if(!proposals || !address) return

    getVotes(proposals)
  }, [proposals, address]);

  async function getProposals(hideError) {
    if(!props.queryClient) return

    props.queryClient.getProposals().then(async (proposals) => {
      proposals = proposals.map(el => Proposal(el))
      setProposals(sortProposals(proposals))
      setTallies(proposals.reduce((sum, proposal) => {
        if (!_.every(Object.values(proposal.final_tally_result), el => el === '0')) {
          sum[proposal.proposal_id] = proposal.final_tally_result
        }
        return sum
      }, {}))
    },
      (error) => {
        if(!proposals) setProposals([])
        if (!hideError) {
          this.setState({
            error: `Failed to load proposals: ${error.message}`,
          });
        }
      }
    )
  }

  async function getTallies(proposals) {
    const calls = proposals.map((proposal) => {
      return () => {
        const { proposal_id, final_tally_result: result } = proposal
        if (tallies[proposal_id]) return

        if (_.every(Object.values(result), el => el === '0')) {
          return props.queryClient.getProposalTally(proposal_id).then(result => {
            return setTallies({ [proposal_id]: result.tally })
          }).catch(error => { })
        } else {
          return setTallies({ [proposal_id]: result })
        }
      }
    });

    await executeSync(calls, 2)
  };

  async function getVotes(proposals) {
    const calls = proposals.filter(el => el.status === 'PROPOSAL_STATUS_VOTING_PERIOD').map((proposal) => {
      return () => {
        const { proposal_id } = proposal
        if (votes[proposal_id]) return

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
          stargateClient={props.stargateClient}
          showProposal={showProposal}
          setError={setError}
          onVote={onVote} />
      </div>
      <ProposalModal
        show={showModal}
        proposal={proposal}
        network={props.network}
        address={props.address}
        tally={proposal && tallies[proposal.proposal_id]}
        vote={proposal && votes[proposal.proposal_id]}
        stargateClient={props.stargateClient}
        closeProposal={closeProposal}
        onVote={onVote}
        setError={setError}
      />
    </>
  );
}

export default Governance;