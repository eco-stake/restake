import DelegateForm from './DelegateForm'

import React, { useState, useEffect } from 'react';

import {
  Dropdown,
  Modal
} from 'react-bootstrap'

function AddValidator(props) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(!!props.message)
  }, [props.message]);

  return (
    <>
      <Dropdown.Item onClick={() => setShow(true)}>Delegate</Dropdown.Item>
      <Modal show={show} onHide={() => setShow(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Delegate</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {props.validator && (
            <DelegateForm
              validator={props.validator}
              address={props.address}
              stargateClient={props.stargateClient}
              onDelegate={props.onDelegate} />
          )}
        </Modal.Body>
      </Modal>
    </>
  );
}

export default AddValidator
