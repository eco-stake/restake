import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from "react-router-dom";
import moment from 'moment'

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
  const { validator, delegations, operators, network, validators, grants } = props
  const navigate = useNavigate()
  const params = useParams();
  const [activeTab, setActiveTab] = useState(params.section || 'profile');
  const [activeAction, setActiveAction] = useState()
  const [registryData, setRegistryData] = useState({})
  const [lastExec, setLastExec] = useState()

  let operator
  if (operators && validator){
    operator = network.getOperator(validator.operator_address);
  }

  useEffect(() => {
    getRegistryData()
    const interval = setInterval(() => {
      getRegistryData()
    }, 15_000);
    return () => clearInterval(interval);
  }, [validator]);

  useEffect(() => {
    setLastExec()
    getLastExec()
    const interval = setInterval(() => {
      getLastExec()
    }, 60_000);
    return () => clearInterval(interval);
  }, [operator])

  useEffect(() => {
    if(params.network !== network.name) return

    const shouldShow = props.show && validator
    const shouldChangeValidator = params.validator !== validator?.operator_address
    const shouldChangeTab = activeTab === 'profile' ? !!params.section : params.section !== activeTab
    const shouldChangeUrl = shouldShow && (shouldChangeValidator || shouldChangeTab)
    if (shouldChangeUrl) {
      navigate(`/${network.name}/${validator.operator_address}${activeTab === 'profile' ? '' : `/${activeTab}`}`)
    } else if (params.validator && props.show === false) {
      navigate(`/${network.name}`)
    }
  }, [props.show, params.validator, params.section, activeTab, validator])

  useEffect(() => {
    if (props.activeTab && props.activeTab != activeTab) {
      setTab(props.activeTab)
    } else if (params.section && params.section != activeTab) {
      setTab(params.section)
    } else if (!activeTab) {
      setTab('profile')
    }
  }, [props.activeTab, validator])
  
  function setTab(tab){
    setActiveAction()
    setActiveTab(tab)
  }

  function handleClose() {
    props.hideModal();
  }

  function onDelegate() {
    props.onDelegate();
    props.hideModal();
  }

  function getRegistryData(){
    if(validator?.path && network.directory){
      network.directory.getRegistryValidator(validator.path).then(data => {
        setRegistryData(data)
      })
    }else{
      setRegistryData({})
    }
  }

  function getLastExec() {
    if(!operator || !network.authzSupport){
      setLastExec()
      return
    }

    network.queryClient.getTransactions([
      { key: 'events', value: `message.action='/cosmos.authz.v1beta1.MsgExec'` },
      { key: 'events', value: `message.sender='${operator.botAddress}'` }
    ], {
      pageSize: 1,
      order: 2,
      retries: 3,
      timeout: 15_000
    }).then(data => {
      if (data.tx_responses?.length > 0) {
        setLastExec(moment(data.tx_responses[0].timestamp))
      } else {
        setLastExec(false)
      }
    })
  }

  return (
    <>
      <Modal size='lg' show={props.show} onHide={handleClose}>
        <Modal.Header closeButton>
          <Modal.Title>
            <>
              <ValidatorImage validator={validator} className="me-2" />
              <ValidatorLink validator={validator} hideWarning={true} className="ms-2" />
            </>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {validator && (
            <Tab.Container activeKey={activeTab} onSelect={(k) => setTab(k)} id="validator-tabs">
              <Nav variant="tabs" className="small mb-3 d-none d-sm-flex">
                <Nav.Item>
                  <Nav.Link role="button" eventKey="profile">Profile</Nav.Link>
                </Nav.Item>
                <Nav.Item>
                  <Nav.Link role="button" eventKey="delegate">Delegate</Nav.Link>
                </Nav.Item>
                {operator && (
                  <Nav.Item>
                    <Nav.Link role="button" eventKey="restake">REStake</Nav.Link>
                  </Nav.Item>
                )}
                {network.authzSupport && !network.authzAminoSupport && operator && (
                  <Nav.Item>
                    <Nav.Link role="button" eventKey="ledger">Ledger</Nav.Link>
                  </Nav.Item>
                )}
              </Nav>
              <select className="form-select w-100 mb-3 d-block d-sm-none" aria-label="Section" value={activeTab} onChange={(e) => setTab(e.target.value)}>
                <option value="profile">Profile</option>
                <option value="delegate">Delegate</option>
                {operator && (
                  <option value="restake">REStake</option>
                )}
                {network.authzSupport && !network.authzAminoSupport && operator && (
                  <option value="ledger">Ledger Instructions</option>
                )}
              </select>
              <Tab.Content>
                <Tab.Pane eventKey="profile">
                  <ValidatorProfile
                    theme={props.theme}
                    network={network}
                    networks={props.networks}
                    validator={validator}
                    operator={operator}
                    registryData={registryData}
                    lastExec={lastExec}
                    validatorApy={props.validatorApy} />
                </Tab.Pane>
                <Tab.Pane eventKey="delegate">
                  <ValidatorDelegate
                    action={activeAction}
                    network={network}
                    validator={validator}
                    validators={validators}
                    operators={operators}
                    address={props.address}
                    wallet={props.wallet}
                    balance={props.balance}
                    delegations={delegations}
                    rewards={props.rewards}
                    grants={props.grants}
                    commission={props.commission}
                    validatorApy={props.validatorApy}
                    authzSupport={props.authzSupport}
                    restakePossible={props.restakePossible}
                    signingClient={props.signingClient}
                    onChangeAction={setActiveAction}
                    onDelegate={onDelegate}
                    onClaimRewards={props.onClaimRewards} />
                </Tab.Pane>
                {operator && (
                  <Tab.Pane eventKey="restake">
                    <ValidatorGrants
                      address={props.address}
                      wallet={props.wallet}
                      network={network}
                      operator={operator}
                      lastExec={lastExec}
                      grants={grants[operator?.botAddress]}
                      delegation={delegations[validator.operator_address]}
                      rewards={props.rewards && props.rewards[validator.address]}
                      validatorApy={props.validatorApy}
                      authzSupport={props.authzSupport}
                      restakePossible={props.restakePossible}
                      signingClient={props.signingClient}
                      onGrant={props.onGrant}
                      onRevoke={props.onRevoke}
                      setError={props.setError}
                    />
                  </Tab.Pane>
                )}
                {network.authzSupport && operator && (
                  <Tab.Pane eventKey="ledger">
                    <AboutLedger network={network} validator={validator} modal={false} />
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
