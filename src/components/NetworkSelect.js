import React, { useState, useReducer, useEffect } from 'react';

import CosmosDirectory from '../utils/CosmosDirectory.mjs';
import Network from '../utils/Network.mjs'

import {
  Button,
  Modal,
  Form,
  Badge
} from 'react-bootstrap'

import Select from 'react-select';
import NetworkChecks from './NetworkChecks.js';
import NetworkImage from './NetworkImage.js';

function NetworkSelect(props) {
  const [show, setShow] = useState(props.show);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState();
  const [options, setOptions] = useReducer(
    (state, newState) => ({ ...state, ...newState }),
    { networks: [], operators: [], network: { value: '' } }
  )

  function handleOpen() {
    setSelectedNetwork(props.network);
    setShow(true);
  }

  function handleClose() {
    setSelectedNetwork();
    setShow(false);
    props.onHide();
  }

  function handleSubmit(event) {
    event.preventDefault();

    props.changeNetwork(selectedNetwork);
    handleClose();
  }

  function selectNetwork(newValue) {
    const network = props.networks[newValue.value.replace(/^(favourite-)/,'')];
    if (network) {
      setLoading(true);
      setError(false);
      network.load().then(() => {
        setSelectedNetwork(network);
        if (network.usingDirectory && !network.connectedDirectory()) {
          throw false;
        }
        return network.connect().then(() => {
          if (network.connected) {
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

  function selectedOption(){
    let networks = options.networks
    if(options.grouped){
      networks = options.grouped.map(el => el.options).flat()
    }
    return networks.find(el => el.value === options.network)
  }

  useEffect(() => {
    if (props.show && !show) {
      handleOpen()
    } else if (!props.show && show) {
      handleClose()
    }
  }, [props.show])

  useEffect(() => {
    const networks = Object.values(props.networks).sort((a, b) => a.name > b.name ? 1 : -1)
    const networkOptions = networks.map(network => {
      return {
        value: network.path,
        label: network.prettyName,
        image: network.image,
        operatorCount: network.operatorCount,
        authz: network.authzSupport,
        online: network.online,
        experimental: network.experimental
      }
    })
    const isFavourite = selectedNetwork && props.favourites && props.favourites.includes(selectedNetwork.path)
    setOptions({
      networks: networkOptions,
      network: isFavourite ? `favourite-${selectedNetwork.path}` : selectedNetwork && selectedNetwork.path,
      grouped: props.favourites && props.favourites.length > 0 && [
        {
          label: 'Favourites',
          options: networkOptions.filter(el => props.favourites.includes(el.value)).map(el => {
            return {...el, value: `favourite-${el.value}`}
          })
        },
        {
          label: 'All Networks',
          options: networkOptions
        }
      ]
    })
  }, [props.networks, selectedNetwork])

  const price = props.network?.baseAsset?.prices?.coingecko

  return (
    <>
      <Button onClick={handleOpen} variant="link" className="d-flex flex-nowrap text-nowrap align-items-center text-reset text-decoration-none border-secondary btn-outline-light" role="button">
        {props.network ? (
          <>
            <div className="avatar avatar-sm rounded-circle text-white">
              <img alt={props.network.prettyName} src={props.network.image} height={30} width={30} />
            </div>
            <div className="d-none d-md-block mx-2">
              <span className="h6">{props.network.prettyName}</span>
              {!!price?.usd && (
                <em className="text-muted small">&nbsp; ${price.usd.toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 2 })}</em>
              )}
            </div>
            <div className="d-none d-md-block ms-2">
              {props.network.authzSupport
                ? <Badge className="rounded-pill" bg="success">Authz</Badge>
                : <Badge className="rounded-pill text-decoration-line-through" bg="danger">Authz</Badge>
              }
            </div>
          </>
        ) : (
          <>
            <div className="d-none d-md-block ms-2">
              <span className="h6">Choose a Network</span>
            </div>
          </>
        )}
        <div className="ms-2">
          <i className="bi bi-chevron-down text-muted text-xs"></i>
        </div>
      </Button>
      <Modal show={show} onHide={handleClose}>
        <Modal.Header closeButton>
          <Modal.Title>Change Network</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSubmit}>
            {props.networks &&
              <div className="row mb-3">
                <div className="col">
                  <Select
                    value={selectedOption()}
                    isClearable={false}
                    name="network"
                    options={options.grouped || options.networks}
                    onChange={selectNetwork}
                    formatOptionLabel={network => (
                      <div className={'d-flex' + (!network.online ? ' text-muted' : '')}>
                        <div className="pe-2">
                          <NetworkImage network={network} width={30} height={30} alt={network.label} />
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
            {selectedNetwork && (
              <>
                <NetworkChecks network={selectedNetwork} error={error} />
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
              </>
            )}
          </Form>
        </Modal.Body>
      </Modal>
    </>
  );
}

export default NetworkSelect
