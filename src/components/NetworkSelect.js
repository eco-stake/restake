import React, { useState, useReducer, useEffect } from 'react';

import CosmosDirectory from '../utils/CosmosDirectory.mjs';
import Network from '../utils/Network.mjs'
import TooltipIcon from './TooltipIcon.js';

import {
  Button,
  Modal,
  Form,
  Badge
} from 'react-bootstrap'

import { CheckCircle, XCircle } from "react-bootstrap-icons";

import Select from 'react-select';

function NetworkSelect(props) {
  const [show, setShow] = useState(props.show);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState();
  const [validators, setValidators] = useState([]);
  const [operatorCounts, setOperatorCounts] = useState({});
  const [options, setOptions] = useReducer(
    (state, newState) => ({ ...state, ...newState }),
    { networks: [], operators: [], network: { value: '' } }
  )

  function handleOpen() {
    setSelectedNetwork(props.network);
    setValidators(props.validators);
    CosmosDirectory().getOperatorCounts().then(counts => {
      setOperatorCounts(counts);
    });
    setShow(true);
  }

  function handleClose() {
    setShow(false);
    props.onHide();
  }

  function handleSubmit(event) {
    event.preventDefault();

    props.changeNetwork(selectedNetwork, validators);
    handleClose();
  }

  function selectNetwork(newValue) {
    const data = props.networks[newValue.value];
    if (data) {
      setLoading(true);
      setError(false);
      const network = new Network(data);
      network.load().then(() => {
        setSelectedNetwork(network);
        if (network.usingDirectory && !network.connectedDirectory()) {
          throw false;
        }
        return network.connect().then(() => {
          if (network.connected) {
            setValidators(network.getValidators());
            setLoading(false);
          } else {
            throw false;
          }
        });
      }).catch(error => {
        console.log(error);
        setError('Could not connect to this network. Try again later');
        setLoading(false);
      });
    }
  }

  function renderCheck({ title, failTitle, description, failDescription, state, successClass, failClass, identifier }){
    const className = state ? (successClass || 'success') : (failClass || 'warning')

    const content = (
      <div>
        {state ? (
          <CheckCircle className="me-2 mb-1" />
        ) : (
          <XCircle className="me-2 mb-1" />
        )}{state ? title : (failTitle || title)}
      </div>
    )
    
    return (
      <li key={identifier} className={`list-group-item list-group-item-${className}`}>
        <TooltipIcon
          icon={content}
          identifier={identifier}
          tooltip={state ? description : (failDescription || description)}
        />
      </li>
    )
  b}

  useEffect(() => {
    if (props.show && !show) {
      handleOpen()
    } else if (!props.show && show) {
      handleClose()
    }
  }, [props.show])

  useEffect(() => {
    const networks = Object.values(props.networks).sort((a, b) => a.name > b.name ? 1 : -1)
    setOptions({
      networks: networks.map(el => {
        const network = new Network(el)
        return {
          value: el.name,
          label: el.pretty_name,
          image: el.image,
          operatorCount: el.operators?.length || operatorCounts[el.name],
          authz: el.params?.authz,
          online: !network.usingDirectory || network.connectedDirectory(),
          experimental: network.experimental
        }
      }),
      network: selectedNetwork && selectedNetwork.name
    })
  }, [props.networks, selectedNetwork, operatorCounts])

  return (
    <>
      <Button onClick={handleOpen} variant="link" className="d-flex align-items-center text-reset text-decoration-none border-secondary btn-outline-light" role="button">
        <div className="avatar avatar-sm rounded-circle text-white">
          <img alt={props.network.prettyName} src={props.network.image} height={30} width={30} />
        </div>
        <div className="d-none d-sm-block ms-2">
          <span className="h6">{props.network.prettyName}</span>
        </div>
        <div className="d-none d-sm-block ms-2">
          {props.network.authzSupport
            ? <Badge className="rounded-pill" bg="success">Authz</Badge>
            : <Badge className="rounded-pill text-decoration-line-through" bg="danger">Authz</Badge>
          }
        </div>
        <div className="d-none d-md-block ms-md-2">
          <i className="bi bi-chevron-down text-muted text-xs"></i>
        </div>
      </Button>
      <Modal show={show} onHide={handleClose}>
        <Modal.Header closeButton>
          <Modal.Title>Change Network</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedNetwork &&
            <Form onSubmit={handleSubmit}>
              {props.networks &&
                <div className="row mb-3">
                  <div className="col">
                    <Select
                      value={options.networks.find(el => el.value === options.network)}
                      isClearable={false}
                      name="network"
                      options={options.networks}
                      onChange={selectNetwork}
                      formatOptionLabel={network => (
                        <div className={'d-flex' + (!network.online ? ' text-muted' : '')}>
                          <div className="pe-2">
                            <img src={network.image} width={30} height={30} alt={network.label} />
                          </div>
                          <div className="pt-1 me-auto">
                            <span className="ms-1">{network.label} {!network.online && <small>(Offline)</small>}</span>
                          </div>
                          <div className="text-end pt-1 d-none d-sm-block">
                            {network.operatorCount > 0 &&
                              <small>{network.operatorCount} Operator{network.operatorCount > 1 ? 's' : ''}</small>
                            }
                          </div>
                          <div className="text-end pt-1">
                            {network.authz
                              ? <Badge className={`ms-3 rounded-pill` + (!network.online ? ' opacity-50' : '')} bg="success">Authz</Badge>
                              : <Badge className={`ms-3 rounded-pill text-decoration-line-through` + (!network.online ? ' opacity-50' : '')} bg="danger">Authz</Badge>
                            }
                          </div>
                        </div>
                      )}
                      theme={(theme) => ({
                        ...theme,
                        colors: {
                          ...theme.colors,
                          neutral0: 'var(--bs-body-bg)',
                          neutral80: 'var(--bs-body)',
                          primary25: 'var(--bs-light)'
                        },
                      })}
                    />
                  </div>
                </div>
              }
              <ul className="list-group">
                {([
                  renderCheck({
                    title: 'API connected',
                    failTitle: 'API offline',
                    failDescription: error,
                    state: selectedNetwork.connected && !error,
                    failClass: 'danger',
                    identifier: 'network'
                  }),
                  renderCheck({
                    title: 'Authz support',
                    failTitle: 'No Authz support',
                    failDescription: "This network doesn't support Authz just yet. You can stake and compound manually for now and REStake will update automatically when support is added.",
                    state: selectedNetwork.authzSupport,
                    identifier: 'authz'
                  }),
                  renderCheck({
                    title: <span><strong>{selectedNetwork.operators?.length}</strong> REStake operators</span>,
                    failTitle: "No REStake operators",
                    failDescription: "There are no operators for this network yet. You can stake and compound manually in the meantime.",
                    state: selectedNetwork.operators?.length > 0,
                    identifier: 'operators'
                  }),
                  renderCheck({
                    title: 'Tested with REStake',
                    failTitle: 'Not tested with REStake',
                    failDescription: "This network was added to REStake automatically and has not been thoroughly tested yet.",
                    state: !selectedNetwork.experimental,
                    identifier: 'experimental'
                  })
                ])}
              </ul>
              <div className="text-center mt-4 mb-2">
                {!loading
                  ? !error && <Button type="submit" className="btn btn-primary btn-lg">Change network</Button>
                  : (
                    <Button className="btn-primary btn-lg mr-5" disabled>
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>&nbsp;
                      Updating...
                    </Button>
                  )}
              </div>
            </Form>
          }
        </Modal.Body>
      </Modal>
    </>
  );
}

export default NetworkSelect
