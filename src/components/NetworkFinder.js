import _ from 'lodash'
import React, { useEffect, useState, useReducer } from 'react';
import { useParams, useNavigate } from "react-router-dom";
import Network from '../utils/Network.mjs'
import CosmosDirectory from '../utils/CosmosDirectory.mjs'
import App from './App';
import AlertMessage from './AlertMessage'

import {
  Spinner
} from 'react-bootstrap';

import networksData from '../networks.json';

const LIGHT_THEME = 'cosmo'
const DARK_THEME = 'superhero'

function NetworkFinder() {
  const params = useParams();
  const navigate = useNavigate()

  const directory = CosmosDirectory()

  const LS_THEME_KEY = "restake-theme";
  const LS_THEME = localStorage.getItem(LS_THEME_KEY)

  const [theme, setTheme] = useState()
  const [themeChoice, setThemeChoice] = useState(LS_THEME || 'auto')
  const [themeDefault, setThemeDefault] = useState('light')
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

    const networks = Object.values(registryNetworks).map(data => {
      const networkData = networksData.find(el => el.name === data.path)
      if(networkData && networkData.enabled === false) return 
      if(!data.image) return

      if(!networkData) data.experimental = true

      return {...data, ...networkData}
    })
    return _.compact(networks).reduce((a, v) => ({ ...a, [v.path]: v}), {})
  }

  const changeNetwork = (network) => {
    setState({
      network: network,
      validators: network.getValidators(),
      operators: network.getOperators()
    })

    navigate("/" + network.name);
  }

  useEffect(() => {
    const setThemeEvent = (event) => {
      setTheme(event.matches ? "dark" : "light")
      setThemeDefault(event.matches ? "dark" : "light")
    }
    const matchMedia = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)')
    if (themeChoice !== 'auto') {
      setTheme(themeChoice)
    } else if (matchMedia) {
      matchMedia.addEventListener('change', setThemeEvent);
      setThemeEvent(matchMedia)
    } else {
      setTheme('light')
    }

    if(localStorage.getItem(LS_THEME_KEY) !== themeChoice){
      localStorage.setItem(LS_THEME_KEY, themeChoice)
    }

    return () => {
      matchMedia && matchMedia.removeEventListener('change', setThemeEvent)
    }
  }, [themeChoice])

  useEffect(() => {
    if(theme){
      const themeLink = document.getElementById("theme-style");
      const themeName = theme === 'dark' ? DARK_THEME : LIGHT_THEME
      themeLink.setAttribute("href", `https://cdn.jsdelivr.net/npm/bootswatch@5.1.3/dist/${themeName}/bootstrap.min.css`);
      document.body.classList.toggle('dark-theme', theme === 'dark');
    }
  }, [theme])

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
      const networks = Object.values(state.networks)
      const defaultNetwork = (networks.find(el => el.default === true) || networks[0])
      let networkName = params.network || defaultNetwork.name
      let data = state.networks[networkName]
      if(params.network && !data){
        networkName = Object.keys(state.networks)[0]
        data = state.networks[networkName]
      }
      if(!data){
        setState({loading: false})
        return
      }
      if(params.network != networkName){
        navigate("/" + networkName);
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
  theme={theme} themeChoice={themeChoice} themeDefault={themeDefault} setThemeChoice={setThemeChoice}
  />;
}

export default NetworkFinder
