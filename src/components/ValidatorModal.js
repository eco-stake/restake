import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from "react-router-dom";
import moment from 'moment'

import ValidatorImage from './ValidatorImage'
import ValidatorLink from './ValidatorLink'
import AboutLedger from './AboutLedger';

import {
  Modal,
  Tab,
  Nav,
  Button
} from 'react-bootstrap'

import ValidatorStake from './ValidatorStake';
import ValidatorProfile from './ValidatorProfile';

function ValidatorModal(props) {
  const { validator, delegations, operators, network, validators, grants } = props
  const navigate = useNavigate()
  const params = useParams();
  const [activeTab, setActiveTab] = useState(params.section || 'profile');
  const [registryData, setRegistryData] = useState({})
  const [lastExec, setLastExec] = useState()

  let operator
  if (operators && validator){
    operator = network.getOperator(validator.operator_address);
  }

  useEffect(() => {
    setRegistryData()
    setLastExec()
  }, [validator]);

  useEffect(() => {
    if(registryData == null){
      getRegistryData()
      const interval = setInterval(() => {
        getRegistryData()
      }, 15_000);
      return () => clearInterval(interval);
    }
  }, [validator, registryData]);

  useEffect(() => {
    if(lastExec == null){
      getLastExec(2)
      const interval = setInterval(() => {
        getLastExec()
      }, 60_000);
      return () => clearInterval(interval);
    }
  }, [operator, lastExec])

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
  }, [props.show, activeTab, validator])

  useEffect(() => {
    if (props.activeTab && props.activeTab != activeTab) {
      setTab(props.activeTab)
    } else if (params.section && params.section != activeTab) {
      const section = ['delegate', 'restake'].includes(params.section) ? 'stake' : params.section
      setTab(section)
    } else if (!activeTab) {
      setTab('profile')
    } else if (!props.show){
      setTab()
    }
  }, [props.show])
  
  function setTab(tab){
    setActiveTab(tab)
  }

  function handleClose() {
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

  function getLastExec(emptyResponseRetries) {
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
      } else if(emptyResponseRetries && lastExec == null) {
        getLastExec(emptyResponseRetries - 1)
      } else if(lastExec == null) {
        setLastExec(false)
      }
    })
  }

  return (
    <>
      <Modal size='lg' show={props.show} onHide={handleClose}>
        <Modal.Header closeButton>
          <Modal.Title>
            <div className="d-flex align-items-center gap-2">
              <ValidatorImage validator={validator} />
              <ValidatorLink validator={validator} />
            </div>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {validator && (
            <Tab.Container activeKey={activeTab} onSelect={(k) => setTab(k)} id="validator-tabs">
              <Nav variant="tabs" className="small mb-3 d-flex">
                <Nav.Item>
                  <Nav.Link role="button" eventKey="profile">Profile</Nav.Link>
                </Nav.Item>
                <Nav.Item>
                  <Nav.Link role="button" eventKey="stake">Stake</Nav.Link>
                </Nav.Item>
                {network.authzSupport && !network.authzAminoSupport && operator && (
                  <Nav.Item className="d-none d-md-flex">
                    <Nav.Link role="button" eventKey="ledger">Ledger</Nav.Link>
                  </Nav.Item>
                )}
              </Nav>
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
                <Tab.Pane eventKey="stake">
                  <ValidatorStake
                    network={network}
                    validator={validator}
                    operator={operator}
                    lastExec={lastExec}
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
                    onDelegate={props.onDelegate}
                    onClaimRewards={props.onClaimRewards}
                    onGrant={props.onGrant}
                    onRevoke={props.onRevoke}
                  />
                </Tab.Pane>
                {network.authzSupport && !network.authzAminoSupport && operator && (
                  <Tab.Pane eventKey="ledger">
                    <AboutLedger network={network} validator={validator} modal={false} />
                  </Tab.Pane>
                )}
              </Tab.Content>
            </Tab.Container>
          )}
          {activeTab === 'profile' && (
            <div className="d-flex justify-content-end gap-2">
              <Button variant="primary" onClick={() => setTab('stake')}>
                Stake
              </Button>
            </div>
          )}
        </Modal.Body>
      </Modal>
    </>
  );
}

export default ValidatorModal
