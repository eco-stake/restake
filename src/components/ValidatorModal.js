import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from "react-router-dom";
import { bignumber } from 'mathjs'

import Validators from './Validators'
import ValidatorImage from './ValidatorImage'
import ValidatorLink from './ValidatorLink'
import AboutLedger from './AboutLedger';

import {
  Modal,
  Tabs,
  Tab
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
    if (props.show && selectedValidator && validator?.operator_address === selectedValidator.operator_address && params.validator !== selectedValidator.operator_address) {
      navigate(`/${network.name}/${selectedValidator.operator_address}`)
    } else if (params.validator && !props.show) {
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
    }
  }

  const selectValidator = (selectedValidator) => {
    setSelectedValidator(selectedValidator)
    setActiveTab('profile')
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
              selectValidator={(selectedValidator) => selectValidator(selectedValidator)} />}
          {selectedValidator && (
            <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k)} id="validator-tabs" className="mb-3">
              <Tab eventKey="profile" title="Profile">
                <ValidatorProfile
                  network={network}
                  validator={selectedValidator}
                  operator={operator()}
                  validatorApy={props.validatorApy} />
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
                  delegation={delegations[selectedValidator.operator_address]}
                  rewards={rewards()}
                  validatorApy={props.validatorApy}
                  stargateClient={props.stargateClient}
                  onDelegate={onDelegate} />
              </Tab>
              {operator() && (
                <Tab eventKey="restake" title="REStake">
                  <ValidatorGrants
                    address={props.address}
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
                </Tab>
              )}
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
