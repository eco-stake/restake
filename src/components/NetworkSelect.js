import React, { useState, useReducer, useEffect } from 'react';

import Network from '../utils/Network.mjs'
import ValidatorImage from './ValidatorImage'

import {
  Button,
  Modal,
  Form,
  Badge
} from 'react-bootstrap'

import Select from 'react-select';

function NetworkSelect(props) {
  const [show, setShow] = useState(props.show);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState();
  const [validators, setValidators] = useState([]);
  const [options, setOptions] = useReducer(
    (state, newState) => ({...state, ...newState}),
    {networks: [], operators: [], network: {value: ''}}
  )

  const {loadValidatorImages} = props

  const handleOpen = () => {
    setSelectedNetwork(props.network)
    setValidators(props.validators)
    setShow(true)
  }

  const handleClose = () => {
    setShow(false)
    props.onHide()
  }

  const handleSubmit = (event) => {
    event.preventDefault();

    props.changeNetwork(selectedNetwork, validators)
    handleClose()
  }

  useEffect(() => {
    if(props.show && !show){
      handleOpen()
    }else if(!props.show && show){
      handleClose()
    }
  }, [props.show])

  useEffect(() => {
    const networks = Object.values(props.networks).sort((a, b) => a.name > b.name ? 1 : -1)
    setOptions({
      networks: networks.map(el => {
        return {value: el.name, label: el.pretty_name, image: el.image, operators: el.operators, authz: el.authzSupport}
      }),
      network: selectedNetwork && {
        value: selectedNetwork.name,
        label: selectedNetwork.prettyName,
        image: selectedNetwork.image,
        operators: selectedNetwork.operators,
        authz: selectedNetwork.authzSupport
      }
    })
  }, [props.networks, selectedNetwork])

  const selectNetwork = (newValue) => {
    const data = props.networks[newValue.value]
    if(data){
      setLoading(true)
      setError(false)
      Network(data, true).then(network => {
        setSelectedNetwork(network)
      })
      Network(data).then(network => {
        setSelectedNetwork(network)
        setValidators({})
        network.getValidators().then(data => {
          setValidators(data)
          loadValidatorImages(network, data)
          setLoading(false)
        }, (error) => {
          setError('Unable to connect to this network currently. Try again later.')
          setLoading(false)
        })
      }, (error) => {
        setError('Unable to connect to this network currently. Try again later.')
        setLoading(false)
      })
    }
  }

  return (
    <>
      <Button onClick={handleOpen} variant="link" className="d-flex align-items-center text-dark text-decoration-none border-secondary btn-outline-light" role="button">
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
                  value={options.network}
                  isClearable={false}
                  name="network"
                  options={options.networks}
                  onChange={selectNetwork}
                  formatOptionLabel={network => (
                    <div className="row">
                      <div className="col-1">
                        <img src={network.image} width={30} height={30} alt={network.label} />
                      </div>
                      <div className="col pt-1">
                        <span className="ms-1">{network.label}</span>
                      </div>
                      <div className="col text-end pt-1">
                        {network.operators.length > 0 &&
                        <small>{network.operators.length} Operator{network.operators.length > 1 ? 's' : ''}</small>
                        }
                        {network.authz
                          ? <Badge className="ms-3 rounded-pill" bg="success">Authz</Badge>
                          : <Badge className="ms-3 rounded-pill text-decoration-line-through" bg="danger">Authz</Badge>
                        }
                      </div>
                    </div>
                  )}/>
              </div>
            </div>
            }
            {error &&
              <p><em>{error}</em></p>
            }
            {!error && !selectedNetwork.authzSupport &&
              <p><em>This network does not support Authz yet. You can manually stake and compound for now</em></p>
            }
            {!error && selectedNetwork.authzSupport && selectedNetwork.getOperators(validators).length < 1 &&
              <p><em>This network supports Authz but there are no operators just yet. You can manually REStake for now</em></p>
            }
            {!loading
              ? !error && <Button type="submit" className="btn btn-primary">Change</Button>
              : (
                <Button className="btn-sm btn-primary mr-5" disabled>
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>&nbsp;
                  Updating...
                </Button>
              )}
          </Form>
          }
        </Modal.Body>
      </Modal>
    </>
  );
}

export default NetworkSelect
