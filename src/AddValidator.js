import Validators from './Validators'
import DelegateForm from './DelegateForm'

import React, { useState, useEffect } from 'react';

import {
  Button,
  Modal
} from 'react-bootstrap'

function AddValidator(props) {
  const [show, setShow] = useState(false);
  const [validator, setValidator] = useState();

  useEffect(() => {
    setShow(!!props.message)
  }, [props.message]);

  const handleOpen = () => {
    setShow(true)
    setValidator(null)
  }

  return (
    <>
      <Button className="btn-secondary" onClick={handleOpen}>
        Add Validator
      </Button>
      <Modal show={show} onHide={() => setShow(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Add Validator</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {!validator &&
          <Validators
            operator={props.operator}
            validators={props.validators}
            delegations={props.delegations}
            operatorDelegation={props.operatorDelegation}
            selectValidator={(validator) => setValidator(validator)} /> }
          {validator && (
            <DelegateForm
              validator={validator}
              address={props.address}
              stargateClient={props.stargateClient}
              onDelegate={props.onAddValidator} />
          )}
        </Modal.Body>
      </Modal>
    </>
  );
}

export default AddValidator
