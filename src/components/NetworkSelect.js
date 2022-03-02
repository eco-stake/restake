import React, { useState, useReducer, useEffect } from 'react';

import Network from '../utils/Network.mjs'
import ValidatorImage from './ValidatorImage'

import {
  Button,
  Modal,
  Form
} from 'react-bootstrap'

import Select from 'react-select';

function NetworkSelect(props) {
  const [show, setShow] = useState(false);
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

  const handleSubmit = (event) => {
    event.preventDefault();

    props.changeNetwork(selectedNetwork, validators)
    setShow(false)
  }

  useEffect(() => {
    const networks = Object.values(props.networks).sort((a, b) => a.name > b.name ? 1 : -1)
    setOptions({
      networks: networks.map(el => {
        return {value: el.name, label: el.prettyName, image: el.image, operators: el.operators}
      }),
      network: selectedNetwork && {
        value: selectedNetwork.name,
        label: selectedNetwork.prettyName,
        image: selectedNetwork.data.image,
        operators: selectedNetwork.data.operators
      }
    })
  }, [props.networks, selectedNetwork])

  const selectNetwork = (newValue) => {
    const data = props.networks[newValue.value]
    if(data){
      setLoading(true)
      setError(false)
      Network(data).then(network => {
        setSelectedNetwork(network)
        setValidators({})
        network.getValidators().then(data => {
          setValidators(data)
          loadValidatorImages(network, data)
          setLoading(false)
        }).catch(error => {
          setError('Unable to connect to this network currently. Try again later.')
          setLoading(false)
        })
      })
    }
  }

  return (
    <>
      <Button onClick={handleOpen} variant="link" className="d-flex align-items-center text-dark text-decoration-none border-secondary btn-outline-light" role="button">
        <div className="avatar avatar-sm rounded-circle text-white">
          <img alt={props.network.prettyName} src={props.network.data.image} height={30} width={30} />
        </div>
        <div className="d-none d-sm-block ms-2">
          <span className="h6">{props.network.prettyName}</span>
        </div>
        <div className="d-none d-md-block ms-md-2">
          <i className="bi bi-chevron-down text-muted text-xs"></i>
        </div>
      </Button>
      <Modal show={show} onHide={() => setShow(false)}>
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
                      {network.operators.length > 0 &&
                      <div className="col text-end pt-1">
                        <small>{network.operators.length} Operators</small>
                      </div>
                      }
                    </div>
                  )}/>
              </div>
            </div>
            }
            {error &&
              <p><em>{error}</em></p>
            }
            {!error && selectedNetwork.getOperators(validators).length < 1 &&
              <p><em>There are no operators for this network just yet. You can manually REStake for now</em></p>
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
