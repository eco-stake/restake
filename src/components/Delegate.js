import DelegateForm from './DelegateForm'
import Validators from './Validators'
import ValidatorImage from './ValidatorImage'
import ValidatorLink from './ValidatorLink'
import Coins from './Coins'
import TooltipIcon from './TooltipIcon'

import React, { useState, useRef } from 'react';

import {
  Dropdown,
  Button,
  Modal,
  OverlayTrigger,
  Tooltip,
  Table,
  Spinner
} from 'react-bootstrap'

import {
  XCircle
} from 'react-bootstrap-icons'

function Delegate(props) {
  const [show, setShow] = useState(false);
  const [selectedValidator, setSelectedValidator] = useState(!props.redelegate && props.validator);

  const handleOpen = () => {
    setShow(true)
    if (!props.validator || props.redelegate) {
      setSelectedValidator(null)
    }
  }

  const onDelegate = () => {
    props.onDelegate()
    setShow(false)
  }

  const excludeValidators = () => {
    if (props.redelegate) {
      return [props.validator.operator_address]
    } else if (props.delegations) {
      return Object.keys(props.delegations)
    }
  }

  const operator = () => {
    if (!props.operators || !selectedValidator) return

    return props.network.getOperator(props.operators, selectedValidator.operator_address)
  }

  const website = () => {
    if (!selectedValidator) return

    return selectedValidator.description && selectedValidator.description.website
  }

  const securityContact = () => {
    if (!selectedValidator) return

    return selectedValidator.description && selectedValidator.description.security_contact
  }

  const bondedTokens = () => {
    if (!selectedValidator) return

    const amount = parseInt(selectedValidator.tokens)
    return <Coins coins={{ amount: amount, denom: props.network.denom }} />
  }

  const minimumReward = () => {
    return {
      amount: operator().data.minimumReward,
      denom: props.network.denom
    }
  }

  const actionText = () => {
    if (props.redelegate) return 'Redelegate'
    if (props.undelegate) return 'Undelegate'
    if (props.validator) {
      return 'Delegate'
    } else {
      return 'Add Validator'
    }
  }

  const button = () => {
    if (props.children) {
      return (
        <span role="button" onClick={handleOpen}>
          {props.children}
        </span>
      )
    } else {
      if (props.button) {
        const button = (
          <Button variant={props.variant || 'secondary'} size={props.size} onClick={handleOpen}>
            {actionText()}
          </Button>
        )
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
              >{button}</OverlayTrigger>
            ) : button}
          </>
        )
      } else {
        return (
          <Dropdown.Item onClick={handleOpen}>
            {actionText()}
          </Dropdown.Item>
        )
      }
    }
  }

  return (
    <>
      {button()}
      <Modal size={selectedValidator ? '' : 'lg'} show={show} onHide={() => setShow(false)}>
        <Modal.Header closeButton>
          <Modal.Title>
            {selectedValidator
              ? (
                <>
                  <ValidatorImage validator={selectedValidator} imageUrl={props.getValidatorImage(props.network, selectedValidator.operator_address)} className="me-2" />
                  <ValidatorLink validator={selectedValidator} className="ms-2" />
                </>
              ) : actionText()
            }
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {!selectedValidator &&
            <Validators
              redelegate={props.redelegate}
              network={props.network}
              operators={props.operators}
              exclude={excludeValidators()}
              validators={props.validators}
              validatorApy={props.validatorApy}
              getValidatorImage={props.getValidatorImage}
              delegations={props.delegations}
              selectValidator={(selectedValidator) => setSelectedValidator(selectedValidator)} />}
          {selectedValidator && (
            <>
              <Table>
                <tbody className="table-sm">
                  {!!website() && (
                    <tr>
                      <td scope="row">Website</td>
                      <td><ValidatorLink validator={selectedValidator}>{website()}</ValidatorLink></td>
                    </tr>
                  )}
                  <tr>
                    <td scope="row">Commission</td>
                    <td>{selectedValidator.commission.commission_rates.rate * 100}%</td>
                  </tr>
                  {props.network.data.apyEnabled !== false && (
                    <tr>
                      <td scope="row">
                        <TooltipIcon
                          icon={<span className="p-0 text-decoration-underline">APY</span>}
                          identifier="delegations-apy"
                        >
                          <div className="mt-2 text-center">
                            <p>Based on commission, compounding frequency and estimated block times.</p>
                            <p>This is an estimate and best case scenario.</p>
                          </div>
                        </TooltipIcon>
                      </td>
                      <td>
                        {Object.keys(props.validatorApy).length > 0
                          ? props.validatorApy[selectedValidator.operator_address]
                            ? Math.round(props.validatorApy[selectedValidator.operator_address] * 100) + "%"
                            : ""
                          : (
                            <Spinner animation="border" role="status" className="spinner-border-sm text-secondary">
                              <span className="visually-hidden">Loading...</span>
                            </Spinner>
                          )}
                      </td>
                    </tr>
                  )}
                  {!!securityContact() && (
                    <tr>
                      <td scope="row">Contact</td>
                      <td><a href={`mailto:${securityContact()}`}>{securityContact()}</a></td>
                    </tr>
                  )}
                  <tr>
                    <td scope="row">Voting power</td>
                    <td>{bondedTokens()}</td>
                  </tr>
                  <tr>
                    <td scope="row">REStake</td>
                    <td>
                      {!!operator() ? (
                        <small>{operator().runTimesString()} (<Coins coins={minimumReward()} denom={props.network.denom} decimals={props.network.decimals} /> min)</small>
                      ) :
                        <TooltipIcon icon={<XCircle className="opacity-50 p-0" />} identifier={selectedValidator.operator_address} tooltip="This validator is not a REStake operator" />
                      }
                    </td>
                  </tr>
                </tbody>
              </Table>
              <p>{selectedValidator.description.details}</p>
              <hr />
              <h5 className="mb-3">
                {props.redelegate
                  ? <span>Redelegate from <ValidatorLink validator={props.validator} /></span>
                  : actionText()
                }
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
                onDelegate={onDelegate} />
            </>
          )}
        </Modal.Body>
      </Modal>
    </>
  );
}

export default Delegate
