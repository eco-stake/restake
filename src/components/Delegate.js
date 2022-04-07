import DelegateForm from './DelegateForm'
import Validators from './Validators'
import ValidatorImage from './ValidatorImage'
import ValidatorLink from './ValidatorLink'
import Coins from './Coins'
import TooltipIcon from './TooltipIcon'

import React, { useState } from 'react';

import {
  Dropdown,
  Button,
  Modal,
  OverlayTrigger,
  Tooltip,
  Table,
  Spinner,
  Tabs,
  Tab
} from 'react-bootstrap'

import {
  XCircle
} from 'react-bootstrap-icons'

function Delegate(props) {
  const { redelegate, undelegate, validator, delegations, operators, network, validators } = props
  const [show, setShow] = useState(false);
  const [selectedValidator, setSelectedValidator] = useState(!redelegate && validator);
  const [activeTab, setActiveTab] = useState(props.activeTab || (redelegate || undelegate) ? 'delegate' : 'profile');

  const handleOpen = () => {
    setShow(true)
    if (!validator || redelegate) {
      setSelectedValidator(null)
    }
  }

  const onDelegate = () => {
    props.onDelegate()
    setShow(false)
  }

  const excludeValidators = () => {
    if (redelegate) {
      return [validator.operator_address]
    } else if (delegations) {
      return [...Object.keys(delegations), ...operators.map(el => el.address)]
    }
  }

  const operator = () => {
    if (!operators || !selectedValidator) return

    return network.getOperator(selectedValidator.operator_address)
  }

  const active = () => {
    if(!selectedValidator) return false

    return selectedValidator.status === 'BOND_STATUS_BONDED' && !selectedValidator.jailed
  }

  const status = () => {
    if(!selectedValidator) return

    let status = ''
    let className = ''
    if(active()){
      status = 'Active'
    }else{
      status = 'Inactive'
      className = 'text-danger'
    }
    if(selectedValidator.jailed){
      status += ' (JAILED)' 
      className = 'text-danger'
    }

    return <span className={className}>{status}</span>
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
    return <Coins coins={{ amount: amount, denom: network.denom }} />
  }

  const minimumReward = () => {
    return {
      amount: operator().minimumReward,
      denom: network.denom
    }
  }

  const actionText = () => {
    if (redelegate) return 'Redelegate'
    if (undelegate) return 'Undelegate'
    if (validator) {
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
            {props.tooltip && validator ? (
              <OverlayTrigger
                key={validator.operator_address}
                placement="top"
                overlay={
                  <Tooltip id={`tooltip-${validator.operator_address}`}>
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
                  <ValidatorImage validator={selectedValidator} className="me-2" />
                  <ValidatorLink validator={selectedValidator} hideWarning={true} className="ms-2" />
                </>
              ) : actionText()
            }
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {!selectedValidator &&
            <Validators
              redelegate={redelegate}
              network={network}
              operators={operators}
              exclude={excludeValidators()}
              validators={validators}
              validatorApy={props.validatorApy}
              delegations={delegations}
              selectValidator={(selectedValidator) => setSelectedValidator(selectedValidator)} />}
          {selectedValidator && (
            <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k)} id="validator-tabs" className="mb-3">
              <Tab eventKey="profile" title="Profile">
                <Table>
                  <tbody className="table-sm">
                    {active() && (
                      <tr>
                        <td scope="row">Rank</td>
                        <td>#{selectedValidator.rank}</td>
                      </tr>
                    )}
                    {!active() && (
                      <tr>
                        <td scope="row">Status</td>
                        <td>{status()}</td>
                      </tr>
                    )}
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
                    {network.data.apyEnabled !== false && (
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
                              : "-"
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
                          <small>{operator().runTimesString()} (<Coins coins={minimumReward()} denom={network.denom} decimals={network.decimals} /> min)</small>
                        ) :
                          <TooltipIcon icon={<XCircle className="opacity-50 p-0" />} identifier={selectedValidator.operator_address} tooltip="This validator is not a REStake operator" />
                        }
                      </td>
                    </tr>
                  </tbody>
                </Table>
                <p>{selectedValidator.description.details}</p>
              </Tab>
              <Tab eventKey="delegate" title="Delegate">
                <h5 className="mb-3">
                  {redelegate
                    ? <span>Redelegate from <ValidatorLink validator={validator} /></span>
                    : actionText()
                  }
                </h5>
                <DelegateForm
                  redelegate={redelegate}
                  undelegate={undelegate}
                  network={network}
                  validator={validator}
                  selectedValidator={selectedValidator}
                  address={props.address}
                  availableBalance={props.availableBalance}
                  stargateClient={props.stargateClient}
                  onDelegate={onDelegate} />
              </Tab>
            </Tabs>
          )}
        </Modal.Body>
      </Modal>
    </>
  );
}

export default Delegate
