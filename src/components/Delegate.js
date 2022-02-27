import DelegateForm from './DelegateForm'
import ValidatorImage from './ValidatorImage'
import ValidatorLink from './ValidatorLink'

import React, { useState, useEffect } from 'react';

import {
  Dropdown,
  Modal
} from 'react-bootstrap'

function Delegate(props) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(!!props.message)
  }, [props.message]);

  return (
    <>
      {props.children
        ? <span role="button" onClick={() => setShow(true)}>{props.children}</span>
        : <Dropdown.Item onClick={() => setShow(true)}>Delegate</Dropdown.Item>
      }
      <Modal show={show} onHide={() => setShow(false)}>
        <Modal.Header closeButton>
          <Modal.Title>
            {props.validator
              ? (
                <>
                  <ValidatorImage validator={props.validator} imageUrl={props.getValidatorImage(props.network, props.validator.operator_address)} />
                  <ValidatorLink validator={props.validator} className="ms-2" />
                </>
              ) : "Add Validator"
            }
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {props.validator && (
            <>
              <p>{props.validator.description.details}</p>
              <h5 className="mb-3">Delegate</h5>
              <DelegateForm
                network={props.network}
                validator={props.validator}
                address={props.address}
                stargateClient={props.stargateClient}
                onDelegate={props.onDelegate} />
            </>
          )}
        </Modal.Body>
      </Modal>
    </>
  );
}

export default Delegate
