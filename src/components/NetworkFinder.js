import _ from 'lodash'
import React, { useEffect, useReducer } from 'react';
import { useParams, useNavigate } from "react-router-dom";
import Network from '../utils/Network.mjs'
import CosmosDirectory from '../utils/CosmosDirectory.mjs'
import App from './App';
import AlertMessage from './AlertMessage'

import {
  Spinner
} from 'react-bootstrap';

import networksData from '../networks.json';

function NetworkFinder() {
  const params = useParams();
  const navigate = useNavigate()

  const directory = CosmosDirectory()

  const [state, setState] = useReducer(
    (state, newState) => ({...state, ...newState}),
    {loading: true, networks: {}, operators: [], validators: {}}
  )

  const getNetworks = async () => {
    let registryNetworks
    try {
      registryNetworks = await directory.getChains()
    } catch (error) {
      setState({error: error.message, loading: false})
      return {}
    }

    const networks = networksData.filter(el => el.enabled !== false).map(data => {
      const registryData = registryNetworks[data.name] || {}
      return {...registryData, ...data}
    })
    return _.compact(networks).reduce((a, v) => ({ ...a, [v.name]: v}), {})
  }

  const changeNetwork = (network) => {
    setState({
      network: network,
      validators: network.getValidators(),
      operators: network.getOperators()
    })
    navigate("/restake/" + network.name);
  }

  useEffect(() => {
    if(state.error) return
    if(!Object.keys(state.networks).length){
      setState({loading: true})
      getNetworks().then(networks => {
        setState({networks: networks})
      })
    }
  }, [state.networks])

  useEffect(() => {
    if(Object.keys(state.networks).length && !state.network){
      let networkName = params.network || Object.keys(state.networks)[0]
      let data = state.networks[networkName]
      if(params.network && !data){
        networkName = Object.keys(state.networks)[0]
        data = state.networks[networkName]
      }
      if(!data){
        setState({loading: false})
        return
      }
      if(_.isNil(params.network)) {
        navigate("/restake/" + networkName);
      }
      const network = new Network(data)
      network.load().then(() => {
        return network.connect().then(() => {
          if (network.connected) {
            setState({ network: network })
          } else {
            throw false
          }
        })
      }).catch(error => {
        console.log(error)
        setState({ network: network, loading: false })
      })
    }
  }, [state.networks, state.network, params.network, navigate])

  useEffect(() => {
    if(state.error) return
    if(!state.network || !state.network.connected) return
    if(state.network && (!Object.keys(state.validators).length)){
      setState({
        validators: state.network.getValidators(),
        operators: state.network.getOperators(),
        loading: false
      })
    }
  }, [state.network])

  useEffect(() => {
    const validatorAddresses = state.validators && Object.keys(state.validators)
    if(validatorAddresses && validatorAddresses.includes(params.validator)){
      setState({ validator: state.validators[params.validator] })
    }else if(state.validator){
      setState({ validator: null })
    }
  }, [state.validators, params.validator])

  if (state.error) {
    return <AlertMessage message={state.error} variant="danger" dismissible={false} />
  }

  if (state.loading) {
    return (
      <div className="pt-5 text-center">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </div>
    )
  }

  return <App networks={state.networks} network={state.network}
  operators={state.operators} validators={state.validators} validator={state.validator}
  changeNetwork={(network, validators) => changeNetwork(network, validators)}
  />;
}

export default NetworkFinder
