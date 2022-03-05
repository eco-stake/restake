import React, { useEffect, useReducer } from 'react';
import { useParams, useNavigate } from "react-router-dom";
import Network from '../utils/Network.mjs'
import { overrideNetworks } from '../utils/Helpers.mjs'
import App from './App';

import {
  Spinner
} from 'react-bootstrap';

import networksData from '../networks.json';

function NetworkFinder() {
  const params = useParams();
  const navigate = useNavigate()

  const [state, setState] = useReducer(
    (state, newState) => ({...state, ...newState}),
    {loading: true, networks: [], operators: [], validators: []}
  )

  const getNetworks = () => {
    let data = networksData
    try {
      let overrides = require('../networks.local.json')
      if(overrides) data = overrideNetworks(data, overrides)
    } catch (e) { }
    return data.filter(el => el.enabled !== false).reduce((a, v) => ({ ...a, [v.name]: v}), {})
  }

  const changeNetwork = (network, validators) => {
    const operators = Object.keys(validators).length ? network.getOperators(validators) : []
    setState({
      network: network,
      validators: validators,
      operators: operators
    })

    navigate("/" + network.name);
  }

  useEffect(() => {
    if(!Object.keys(state.networks).length){
      setState({loading: true})
      const networks = getNetworks()
      setState({networks: networks})
    }
  }, [state.networks])

  useEffect(() => {
    if(Object.keys(state.networks).length && !state.network){
      const networkName = params.network || Object.keys(state.networks)[0]
      const data = state.networks[networkName]
      if(params.network && !data){
        navigate("/" + Object.keys(state.networks)[0]);
      }
      if(!data){
        setState({loading: false})
        return
      }
      if(!params.network){
        navigate("/" + networkName);
      }
      Network(data).then(network => {
        setState({network: network})
      })
    }
  }, [state.networks, state.network, params.network, navigate])

  useEffect(() => {
    if(state.error) return

    if(state.network && (!Object.keys(state.validators).length)){
      if(!state.network.restClient.connected){
        return setState({
          loading: false
        })
      }

      state.network.getValidators().then(validators => {
        setState({
          validators,
          operators: state.network.getOperators(validators),
          loading: false
        })
      }, error => setState({loading: false, error: 'Unable to connect right now, try again'}))
    }
  }, [state.network])

  if (state.loading) {
    return (
      <div className="pt-5 text-center">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </div>
    )
  }

  if (state.error) {
    return (
      <p>Loading failed</p>
    )
  }

  if(!state.network){
    return <p>Page not found</p>
  }

  return <App networks={state.networks} network={state.network} operators={state.operators} validators={state.validators}
    changeNetwork={(network, validators) => changeNetwork(network, validators)} />;
}

export default NetworkFinder
