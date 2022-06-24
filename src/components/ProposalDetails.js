import React, { useState } from 'react';
import Moment from 'react-moment';

import {
  Table,
} from 'react-bootstrap'

import Coins from './Coins';
import ProposalProgress from './ProposalProgress';
import VoteForm from './VoteForm';
import AlertMessage from './AlertMessage';

function ProposalDetails(props) {
  const { proposal, tally, vote, network } = props
  const [error, setError] = useState()

  const { title, description } = proposal.content

  const fixDescription = description.replace(/\/n/g, '\n').split(/\\n/).join('\n')

  return (
    <>
      {error &&
        <AlertMessage variant="danger" className="text-break small">
          {error}
        </AlertMessage>
      }
      <div className="row">
        <div className="col">
          <Table>
            <tbody className="table-sm small">
              <tr>
                <td scope="row">ID</td>
                <td className="text-break">#{proposal.proposal_id}</td>
              </tr>
              <tr>
                <td scope="row">Status</td>
                <td>{proposal.statusHuman}</td>
              </tr>
              <tr>
                <td scope="row">Type</td>
                <td>{proposal.typeHuman}</td>
              </tr>
              {!proposal.isDeposit && (
                <>
                  <tr>
                    <td scope="row">Submit time</td>
                    <td>
                      <Moment format="LLL">
                        {proposal.submit_time}
                      </Moment>
                    </td>
                  </tr>
                  <tr>
                    <td scope="row">Voting end time</td>
                    <td>
                      <Moment format="LLL">
                        {proposal.voting_end_time}
                      </Moment>
                    </td>
                  </tr>
                </>
              )}
              {proposal.isDeposit && (
                <>
                  <tr>
                    <td scope="row">Deposit end time</td>
                    <td>
                      <Moment format="LLL">
                        {proposal.deposit_end_time}
                      </Moment>
                    </td>
                  </tr>
                  <tr>
                    <td scope="row">Total deposit</td>
                    <td>
                      {proposal.total_deposit.map(coins => {
                        return <Coins key={coins.denom} coins={coins} decimals={network.decimals} />
                      })}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </Table>
        </div>
        {props.address && (
          <div className="col">
            <p className="mb-2"><strong>Your Vote</strong></p>
            <VoteForm
              network={network}
              proposal={proposal}
              vote={vote}
              address={props.address}
              stargateClient={props.stargateClient}
              onVote={props.onVote}
              setError={setError} />
          </div>
        )}
      </div>
      <div className="mb-4 mt-2">
        <ProposalProgress
          proposal={proposal}
          tally={tally}
          height={25} />
      </div>
      <div className="row mt-3">
        <div className="col">
          <h5 className="mb-3">{title}</h5>
          <p style={{ whiteSpace: 'pre-wrap' }}>
            {fixDescription}
          </p>
        </div>
      </div>
    </>
  )
}

export default ProposalDetails