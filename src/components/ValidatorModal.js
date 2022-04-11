import React, { useState, useEffect } from 'react';

import Validators from './Validators'
import ValidatorImage from './ValidatorImage'
import ValidatorLink from './ValidatorLink'
import AboutLedger from './AboutLedger';

import {
  Button,
  Modal,
  Tabs,
  Tab
} from 'react-bootstrap'

import ValidatorDelegate from './ValidatorDelegate';
import ValidatorProfile from './ValidatorProfile';

function ValidatorModal(props) {
  const { redelegate, undelegate, validator, delegations, operators, network, validators } = props
  const [selectedValidator, setSelectedValidator] = useState();
  const [activeTab, setActiveTab] = useState();

  useEffect(() => {
    if(props.activeTab && props.activeTab != activeTab){
      setActiveTab(props.activeTab)
    }else if(redelegate || undelegate){
      setActiveTab('delegate')
    }else if(!activeTab){
      setActiveTab('profile')
    }
  }, [props.activeTab, redelegate, undelegate, validator])

  useEffect(() => {
    setSelectedValidator(!redelegate && validator)
  }, [validator, redelegate])

  const handleClose = () => {
    if(selectedValidator && (!validator || redelegate) && selectedValidator !== validator){
      setSelectedValidator(null)
    }else{
      props.hideModal()
    }
  }

  const onDelegate = () => {
    props.onDelegate()
    props.hideModal()
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

  const availableBalance = () => {
    if(redelegate || undelegate){
      return (props.delegations[validator.address] || {}).balance
    }else{
      return props.balance
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

  return (
    <>
      <Modal size={selectedValidator ? 'lg' : 'lg'} show={props.show} onHide={handleClose}>
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
                <ValidatorProfile 
                  network={network}
                  validator={selectedValidator}
                  operator={operator()}
                  validatorApy={props.validatorApy} />
                <p className="text-end">
                  <Button variant="primary" onClick={() => { setActiveTab('delegate') }}>
                    {actionText()}
                  </Button>
                </p>
              </Tab>
              <Tab eventKey="delegate" title="Delegate">
                <ValidatorDelegate
                  redelegate={redelegate}
                  undelegate={undelegate}
                  network={network}
                  validator={validator}
                  selectedValidator={selectedValidator}
                  address={props.address}
                  availableBalance={availableBalance()}
                  stargateClient={props.stargateClient}
                  onDelegate={onDelegate} />
              </Tab>
              {network.authzSupport && operator() && (
                <Tab eventKey="ledger" title="Ledger Instructions">
                  <AboutLedger network={network} validator={selectedValidator} modal={false} />
                </Tab>
              )}
            </Tabs>
          )}
        </Modal.Body>
      </Modal>
    </>
  );
}

export default ValidatorModal
