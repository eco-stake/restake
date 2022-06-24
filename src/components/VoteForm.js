import React, { useState } from 'react';
import _ from 'lodash'

import {
  Form,
  Button
} from 'react-bootstrap'
import Vote from '../utils/Vote.mjs';


function VoteForm(props) {
  const { proposal, vote, address, setError } = props
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

  const [choice, setChoice] = useState()
  const [loading, setLoading] = useState()

  if (vote && !choice) {
    setChoice(vote.option)
  }

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
      voter: address,
      option: choice,
      options: [
        {
          choice,
          weight: "1.000000000000000000"
        }
      ]
    })

    const message = {
      typeUrl: "/cosmos.gov.v1beta1.MsgVote",
      value: {
        proposalId: proposal.proposal_id,
        voter: address,
        option: newVote.optionValue
      }
    }

    console.log(message)

    props.stargateClient.signAndBroadcast(address, [message]).then((result) => {
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
    if (!address || !proposal.isVoting) return false

    return choice && (!vote || (vote && voteChanged))
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
                            disabled={!proposal.isVoting}
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