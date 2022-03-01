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
  const [selectedOperator, setSelectedOperator] = useState();
  const [validators, setValidators] = useState([]);
  const [options, setOptions] = useReducer(
    (state, newState) => ({...state, ...newState}),
    {networks: [], operators: [], network: {value: ''}, operator: {value: ''}}
  )

  const {loadValidatorImages} = props

  const handleOpen = () => {
    setSelectedNetwork(props.network)
    setSelectedOperator(props.operator)
    setValidators(props.validators)
    setShow(true)
  }

  const handleSubmit = (event) => {
    event.preventDefault();

    props.changeNetwork(selectedNetwork, selectedOperator, validators)
    setShow(false)
  }

  useEffect(() => {
    const networks = Object.values(props.networks).sort((a, b) => a.name > b.name ? 1 : -1)
    setOptions({
      networks: networks.map(el => {
        return {value: el.name, label: el.prettyName, image: el.image}
      }),
      network: selectedNetwork && {
        value: selectedNetwork.name,
        label: selectedNetwork.prettyName,
        image: selectedNetwork.data.image
      }
    })
  }, [props.networks, selectedNetwork])

  useEffect(() => {
    if(!validators || !Object.keys(validators).length) return null

    const validator = selectedOperator && validators[selectedOperator.address]
    const operators = selectedNetwork.getOperators(validators)
    setOptions({
      operators: operators.map(el => {
        const validator = validators[el.address]
        if(!validator) return null

        return {value: el.address, label: validator.description.moniker, validator: validator}
      }),
      operator: selectedOperator && validator && {
        value: selectedOperator.address,
        label: validator.description.moniker,
        validator: validator
      }
    })
  }, [selectedNetwork, selectedOperator, validators])

  const selectNetwork = (newValue) => {
    const data = props.networks[newValue.value]
    if(data){
      setLoading(true)
      setError(false)
      Network(data).then(network => {
        setSelectedNetwork(network)
        setValidators({})
        setSelectedOperator(null)
        network.getValidators().then(data => {
          setValidators(data)
          const operators = network.getOperators(data)
          loadValidatorImages(network, operators.map(el => el.validatorData))
          loadValidatorImages(network, data)
          setSelectedOperator(operators[0])
          setLoading(false)
        }).catch(error => {
          setError('Unable to connect to this network currently. Try again later.')
          setLoading(false)
        })
      })
    }
  }

  const selectOperator = (newValue) => {
    const operators = selectedNetwork.getOperators(validators)
    const operator = selectedNetwork.getOperator(operators, newValue.value)
    if(operator){
      setSelectedOperator(operator)
    }
  }

  return (
    <>
      <Button onClick={handleOpen} variant="link" className="d-flex align-items-center text-dark text-decoration-none border-secondary btn-outline-light" role="button">
        <div className="avatar avatar-sm rounded-circle text-white">
          <img alt={props.network.prettyName} src={props.network.data.image} height={30} width={30} />
        </div>
        {props.operator && (
          <div className="col p-0 avatar avatar-sm rounded-circle text-white">
            <ValidatorImage validator={props.operator.validatorData} imageUrl={props.getValidatorImage(props.network, props.operator.address)} height={30} width={30} />
          </div>
        )}
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
                <label className="form-label">Network</label>
                <Select
                  value={options.network}
                  isClearable={false}
                  name="network"
                  options={options.networks}
                  onChange={selectNetwork}
                  formatOptionLabel={network => (
                    <div className="image-option">
                      <img src={network.image} width={30} height={30} alt={network.label} />
                      <span className="ms-2">{network.label}</span>
                    </div>
                  )}/>
              </div>
            </div>
            }
            {selectedNetwork.getOperators(validators).length > 0 &&
              <div className="row mb-3">
                <label className="form-label">Operator</label>
                <div className="col">
                  <Select
                    value={options.operator}
                    required={true}
                    isClearable={false}
                    name="operator"
                    options={options.operators}
                    onChange={selectOperator}
                    formatOptionLabel={operator => (
                      <div className="image-option">
                        <ValidatorImage validator={operator.validator} imageUrl={props.getValidatorImage(selectedNetwork, operator.value)} height={30} width={30} />
                        <span className="ms-2">{operator.label}</span>
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
