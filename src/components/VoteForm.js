import React, { useState, useEffect } from 'react';
import _ from 'lodash'

import {
  Form,
  Button
} from 'react-bootstrap'
import { MsgVote } from "cosmjs-types/cosmos/gov/v1beta1/tx.js";

import Vote from '../utils/Vote.mjs';
import { buildExecMessage } from '../utils/Helpers.mjs';


function VoteForm(props) {
  const { proposal, vote, address, wallet, granter, setError } = props
  const { proposal_id } = proposal

  const choices = {
    'VOTE_OPTION_YES': 'Yes',
    'VOTE_OPTION_NO': 'No',
    'VOTE_OPTION_NO_WITH_VETO': 'No with Veto',
    'VOTE_OPTION_ABSTAIN': 'Abstain'
  }

  const choiceIndices = {
    'VOTE_OPTION_YES': 1,
    'VOTE_OPTION_NO': 3,
    'VOTE_OPTION_NO_WITH_VETO': 4,
    'VOTE_OPTION_ABSTAIN': 2
  }

  const [choice, setChoice] = useState(vote?.option)
  const [loading, setLoading] = useState()

  useEffect(() => {
    setChoice(vote?.option)
  }, [vote])

  function handleVoteChange(event) {
    setChoice(event.target.name)
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!choice) {
      return setError('Please choose an option')
    }

    setLoading(true)
    setError()

    const newVote = Vote({
      proposal_id: proposal_id,
      voter: granter || wallet.address,
      option: choice,
      options: [
        {
          choice,
          weight: "1.000000000000000000"
        }
      ]
    })

    let message
    const value = {
      proposalId: proposal.proposal_id,
      voter: newVote.voter,
      option: newVote.optionValue
    }
    if(granter){
      message = buildExecMessage(wallet.address, [{
        typeUrl: "/cosmos.gov.v1beta1.MsgVote",
        value: MsgVote.encode(MsgVote.fromPartial(value)).finish()
      }])
    }else{
      message = {
        typeUrl: "/cosmos.gov.v1beta1.MsgVote",
        value: value
      }
    }

    console.log(message)

    props.stargateClient.signAndBroadcast(wallet.address, [message]).then((result) => {
      console.log("Successfully broadcasted:", result);
      setLoading(false)
      setError(null)
      props.onVote(proposal, newVote)
    }, (error) => {
      console.log('Failed to broadcast:', error)
      setLoading(false)
      setError(error.message)
    })
  }

  const voteChanged = vote && vote.option !== choice

  function canVote() {
    if (!wallet?.address || !proposal.isVoting) return false
    if (!hasPermission()) return false

    return choice && (!vote || (vote && voteChanged))
  }

  function hasPermission(){
    return wallet && wallet.hasPermission(granter || wallet.address, 'Vote')
  }

  function buttonText() {
    if (!proposal.isVoting) return proposal.isDeposit ? 'Voting not started' : 'Voting ended'

    return vote ? voteChanged ? 'Change vote' : 'Voted' : 'Vote'
  }


  return (
    <>
      <Form onSubmit={handleSubmit}>
        <Form.Group className="border-top pt-2 my-2">
          <div className="row pe-lg-5">
            {_.chunk(Object.entries(choices), 2).map((group, index) => {
              return (
                <div key={index} className="col-12 col-md-6">
                  {group.map(([key, value]) => {
                    const voteChoice = vote && key === vote.option
                    return (
                      <div key={`vote-${key}`} className="mb-2">
                        <Form.Check type='radio' id={`vote-${key}`}>
                          <Form.Check.Input type='radio'
                            name={key}
                            checked={key === choice}
                            disabled={!proposal.isVoting || !hasPermission()}
                            onChange={handleVoteChange}
                          />
                          <Form.Check.Label className="d-block text-nowrap">
                            {voteChoice ? <strong>{value}</strong> : value}
                          </Form.Check.Label>
                        </Form.Check>
                      </div>
                    )
                  })}
                </div>
              )
            }).flat()}
          </div>
        </Form.Group>
        <p className="text-end">
          {!loading
            ? (
              <Button type="submit" disabled={!canVote()} className="btn btn-primary">
                {buttonText()}
              </Button>
            ) : (
              <Button className="btn btn-primary" type="button" disabled>
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>&nbsp;
              </Button>
            )}
        </p>
      </Form>
    </>
  )
}

export default VoteForm