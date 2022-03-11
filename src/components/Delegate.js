import React, { useState, useRef } from "react";
import {
  Dropdown,
  Button,
  Modal,
  OverlayTrigger,
  Tooltip,
} from "react-bootstrap";
import DelegateForm from "./DelegateForm";
import Validators from "./Validators";
import ValidatorImage from "./ValidatorImage";
import ValidatorLink from "./ValidatorLink";

function Delegate(props) {
  const [show, setShow] = useState(false);
  const [selectedValidator, setSelectedValidator] = useState(
    !props.redelegate && props.validator
  );
  const target = useRef(null);

  const handleOpen = () => {
    setShow(true);
    if (!props.validator || props.redelegate) {
      setSelectedValidator(null);
    }
  };

  const onDelegate = () => {
    props.onDelegate();
    setShow(false);
  };

  const excludeValidators = () => {
    if (props.redelegate) {
      return [props.validator.operator_address];
    }
    if (props.delegations) {
      return Object.keys(props.delegations);
    }
  };

  const actionText = () => {
    if (props.redelegate) return "Redelegate";
    if (props.undelegate) return "Undelegate";
    if (props.validator) {
      return "Delegate";
    }
    return "Add Validator";
  };

  const button = () => {
    if (props.children) {
      return (
        <span role="button" onClick={handleOpen}>
          {props.children}
        </span>
      );
    }
    if (props.button) {
      const button = (
        <Button
          variant={props.variant || "secondary"}
          size={props.size}
          onClick={handleOpen}
        >
          {actionText()}
        </Button>
      );
      return (
        <>
          {props.tooltip && props.validator ? (
            <OverlayTrigger
              key={props.validator.operator_address}
              placement="top"
              overlay={
                <Tooltip id={`tooltip-${props.validator.operator_address}`}>
                  {props.tooltip}
                </Tooltip>
              }
            >
              {button}
            </OverlayTrigger>
          ) : (
            button
          )}
        </>
      );
    }
    return <Dropdown.Item onClick={handleOpen}>{actionText()}</Dropdown.Item>;
  };

  return (
    <>
      {button()}
      <Modal
        size={selectedValidator ? "" : "lg"}
        show={show}
        onHide={() => setShow(false)}
      >
        <Modal.Header closeButton>
          <Modal.Title>
            {selectedValidator ? (
              <>
                <ValidatorImage
                  validator={selectedValidator}
                  imageUrl={props.getValidatorImage(
                    props.network,
                    selectedValidator.operator_address
                  )}
                  className="me-2"
                />
                <ValidatorLink validator={selectedValidator} className="ms-2" />
              </>
            ) : (
              actionText()
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {!selectedValidator && (
            <Validators
              inflation={props.inflation}
              blocksPerYear={props.blocksPerYear}
              redelegate={props.redelegate}
              network={props.network}
              operators={props.operators}
              exclude={excludeValidators()}
              validators={props.validators}
              getValidatorImage={props.getValidatorImage}
              delegations={props.delegations}
              selectValidator={(selectedValidator) =>
                setSelectedValidator(selectedValidator)
              }
            />
          )}
          {selectedValidator && (
            <>
              <p>{selectedValidator.description.details}</p>
              <h5 className="mb-3">
                {props.redelegate ? (
                  <span>
                    Redelegate from
                    <ValidatorLink validator={props.validator} />
                  </span>
                ) : (
                  actionText()
                )}
              </h5>
              <DelegateForm
                redelegate={props.redelegate}
                undelegate={props.undelegate}
                network={props.network}
                validator={props.validator}
                selectedValidator={selectedValidator}
                address={props.address}
                availableBalance={props.availableBalance}
                stargateClient={props.stargateClient}
                onDelegate={onDelegate}
              />
            </>
          )}
        </Modal.Body>
      </Modal>
    </>
  );
}

export default Delegate;
