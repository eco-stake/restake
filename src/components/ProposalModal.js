import React from 'react';

import {
  Modal,
} from 'react-bootstrap'

import ProposalDetails from './ProposalDetails';

function ProposalModal(props) {
  const { show, proposal, tally, vote, network, address } = props

  const handleClose = () => {
    props.closeProposal()
  }

  if(!proposal) return null

  return (
    <>
      <Modal size="lg" show={show} onHide={handleClose}>
        <Modal.Header closeButton>
          <Modal.Title className="text-truncate pe-4">
            {proposal.content.title}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <ProposalDetails
            network={network}
            proposal={proposal}
            tally={tally}
            vote={vote}
            address={props.address}
            stargateClient={props.stargateClient}
            onVote={props.onVote} />
        </Modal.Body>
      </Modal>
    </>
  );
}

export default ProposalModal
