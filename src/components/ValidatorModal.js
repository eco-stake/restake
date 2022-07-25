import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from "react-router-dom";
import { bignumber } from 'mathjs'

import Validators from './Validators'
import ValidatorImage from './ValidatorImage'
import ValidatorLink from './ValidatorLink'
import AboutLedger from './AboutLedger';

import {
  Modal,
  Tab,
  Nav
} from 'react-bootstrap'

import ValidatorDelegate from './ValidatorDelegate';
import ValidatorProfile from './ValidatorProfile';
import ValidatorGrants from './ValidatorGrants';

function ValidatorModal(props) {
  const { redelegate, undelegate, validator, delegations, operators, network, validators, grants } = props
  const [selectedValidator, setSelectedValidator] = useState(!redelegate && validator);
  const [activeTab, setActiveTab] = useState();
  const navigate = useNavigate()
  const params = useParams();

  useEffect(() => {
    if(params.network !== network.name) return

    if (props.show && selectedValidator && validator?.operator_address === selectedValidator.operator_address && params.validator !== selectedValidator.operator_address) {
      navigate(`/${network.name}/${selectedValidator.operator_address}`)
    } else if (params.validator && props.show === false) {
      navigate(`/${network.name}`)
    }
  }, [props.show, params.validator, selectedValidator])

  useEffect(() => {
    if (props.activeTab && props.activeTab != activeTab) {
      setActiveTab(props.activeTab)
    } else if (redelegate || undelegate) {
      setActiveTab('delegate')
    } else if (!activeTab) {
      setActiveTab('profile')
    }
  }, [props.activeTab, redelegate, undelegate, selectedValidator])

  useEffect(() => {
    if (props.show) {
      setSelectedValidator(!redelegate && validator)
    }
  }, [validator, redelegate, props.show])

  const handleClose = () => {
    if (selectedValidator && (!validator || redelegate) && selectedValidator !== validator) {
      setSelectedValidator(null)
    } else {
      props.hideModal()
      setSelectedValidator(null)
    }
  }

  const selectValidator = (selectedValidator, opts) => {
    setSelectedValidator(selectedValidator)
    setActiveTab(opts.activeTab || 'profile')
  }

  const onDelegate = () => {
    props.onDelegate()
    props.hideModal()
  }

  const excludeValidators = () => {
    if (redelegate) {
      return [validator.operator_address]
    } else if (delegations) {
      return [...Object.keys(delegations)]
    }
  }

  const operator = () => {
    if (!operators || !selectedValidator) return

    return network.getOperator(selectedValidator.operator_address)
  }

  const availableBalance = () => {
    if (redelegate || undelegate) {
      return (props.delegations[validator.address] || {}).balance
    } else {
      return props.balance
    }
  }

  const rewards = () => {
    if (!props.rewards) return 0;
    const denom = network.denom;
    const validatorReward = props.rewards[selectedValidator.address];
    const reward = validatorReward && validatorReward.reward.find((el) => el.denom === denom)
    return reward ? bignumber(reward.amount) : 0
  }

  const commission = () => {
    if (!props.commission) return 0;
    const denom = network.denom;
    const validatorCommission = props.commission[selectedValidator.address];
    const commission = validatorCommission && validatorCommission.commission.find((el) => el.denom === denom)
    return commission ? bignumber(commission.amount) : 0
  }

  const actionText = () => {
    if (redelegate) return <span>Redelegate from <ValidatorLink validator={validator} /></span>
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
              modal={true}
              redelegate={redelegate}
              network={network}
              address={props.address}
              wallet={props.wallet}
              validators={validators}
              operators={operators}
              exclude={excludeValidators()}
              validatorApy={props.validatorApy}
              rewards={props.rewards}
              delegations={delegations}
              operatorGrants={props.grants}
              authzSupport={props.authzSupport}
              restakePossible={props.restakePossible}
              showValidator={selectValidator}
              manageButton={redelegate ? 'Redelegate' : 'Delegate'} />}
          {selectedValidator && (
            <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k)} id="validator-tabs">
              <Nav variant="tabs" className="mb-3 d-none d-sm-flex">
                <Nav.Item>
                  <Nav.Link role="button" eventKey="profile">Profile</Nav.Link>
                </Nav.Item>
                <Nav.Item>
                  <Nav.Link role="button" eventKey="delegate">Delegate</Nav.Link>
                </Nav.Item>
                {operator() && (
                  <Nav.Item>
                    <Nav.Link role="button" eventKey="restake">REStake</Nav.Link>
                  </Nav.Item>
                )}
                {network.authzSupport && operator() && (
                  <Nav.Item>
                    <Nav.Link role="button" eventKey="ledger">Ledger Instructions</Nav.Link>
                  </Nav.Item>
                )}
              </Nav>
              <select className="form-select w-100 mb-3 d-block d-sm-none" aria-label="Section" value={activeTab} onChange={(e) => setActiveTab(e.target.value)}>
                <option value="profile">Profile</option>
                <option value="delegate">Delegate</option>
                {operator() && (
                  <option value="restake">REStake</option>
                )}
                {network.authzSupport && operator() && (
                  <option value="ledger">Ledger Instructions</option>
                )}
              </select>
              <Tab.Content>
                <Tab.Pane eventKey="profile">
                  <ValidatorProfile
                    theme={props.theme}
                    network={network}
                    networks={props.networks}
                    validator={selectedValidator}
                    operator={operator()}
                    validatorApy={props.validatorApy} />
                </Tab.Pane>
                <Tab.Pane eventKey="delegate">
                  <ValidatorDelegate
                    redelegate={redelegate}
                    undelegate={undelegate}
                    network={network}
                    validator={validator}
                    selectedValidator={selectedValidator}
                    address={props.address}
                    wallet={props.wallet}
                    availableBalance={availableBalance()}
                    delegation={delegations[selectedValidator.operator_address]}
                    rewards={rewards()}
                    commission={commission()}
                    validatorApy={props.validatorApy}
                    stargateClient={props.stargateClient}
                    onDelegate={onDelegate} />
                </Tab.Pane>
                {operator() && (
                  <Tab.Pane eventKey="restake">
                    <ValidatorGrants
                      address={props.address}
                      wallet={props.wallet}
                      network={network}
                      operator={operator()}
                      grants={grants[operator()?.botAddress]}
                      delegation={delegations[selectedValidator.operator_address]}
                      rewards={rewards()}
                      authzSupport={props.authzSupport}
                      restakePossible={props.restakePossible}
                      stargateClient={props.stargateClient}
                      onGrant={props.onGrant}
                      onRevoke={props.onRevoke}
                      setError={props.setError}
                    />
                  </Tab.Pane>
                )}
                {network.authzSupport && operator() && (
                  <Tab.Pane eventKey="ledger">
                    <AboutLedger network={network} validator={selectedValidator} modal={false} />
                  </Tab.Pane>
                )}
              </Tab.Content>
            </Tab.Container>
          )}
        </Modal.Body>
      </Modal>
    </>
  );
}

export default ValidatorModal
