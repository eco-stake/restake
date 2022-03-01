import React, { useEffect, useReducer } from 'react';
import { useParams, useNavigate } from "react-router-dom";
import Network from '../utils/Network.mjs'
import App from './App';

import {
  Spinner
} from 'react-bootstrap';

import data from '../networks.json';

function NetworkFinder() {
  const params = useParams();
  const navigate = useNavigate()

  const [state, setState] = useReducer(
    (state, newState) => ({...state, ...newState}),
    {loading: true, networks: [], operators: [], validators: []}
  )

  const getNetworks = () => {
    return data.filter(el => el.enabled !== false).reduce((a, v) => ({ ...a, [v.name]: v}), {})
  }

  const changeNetwork = (network, operator, validators) => {
    setState({
      network: network,
      operator: operator,
      validators: validators,
      operators: Object.keys(validators).length && network.getOperators(validators)
    })

    if(operator){
      navigate("/" + network.name + "/" + operator.address);
    }else{
      navigate("/" + network.name);
    }
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
      if(!data){
        setState({loading: false})
        return
      }
      if(!params.network){
        let url = "/" + networkName
        url = data.operators.length ? (url + "/" + data.operators[0].address) : url
        navigate(url);
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
          operator: undefined,
          loading: false
        })
      }, error => setState({loading: false, error: error}))
    }
  }, [state.network])

  useEffect(() => {
    if(state.operators.length && !state.operator){
      let operator
      if(params.operator){
        operator = state.network.getOperator(state.operators, params.operator)
      }
      if(!operator) operator = state.operators[0]
      if(operator && params.operator !== operator.address){
        navigate("/" + state.network.name + "/" + operator.address);
      }
      setState({operator: operator})
    }
  }, [state.operators, state.operator, params, state.network, navigate])

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

  return <App networks={state.networks} network={state.network} operators={state.operators} operator={state.operator} validators={state.validators}
    changeNetwork={(network, operator, validators) => changeNetwork(network, operator, validators)} />;
}

export default NetworkFinder
