import _ from 'lodash'
import React, { useEffect, useState, useReducer } from 'react';
import { useParams, useNavigate, useMatch } from "react-router-dom";
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
  const govMatch = useMatch("/:network/govern/*");
  const grantMatch = useMatch("/:network/grants");

  const networkMode = process.env.TESTNET_MODE === '1' ? 'testnet' : 'mainnet'
  const directory = getDirectory()

  const LS_THEME_KEY = "restake-theme";
  const LS_THEME = localStorage.getItem(LS_THEME_KEY)

  const [theme, setTheme] = useState()
  const [themeChoice, setThemeChoice] = useState(LS_THEME || 'auto')
  const [themeDefault, setThemeDefault] = useState('light')
  const [state, setState] = useReducer(
    (state, newState) => ({...state, ...newState}),
    {loading: true, networks: {}, operators: [], validators: {}, networkMode, directory}
  )

  function getDirectory() {
    let testnet = networkMode === 'testnet';
    if (params.network && !testnet) {
      const data = networksData.find(el => el.name === params.network);
      if (data && data.testnet) {
        testnet = true;
      }
    }
    return CosmosDirectory(testnet);
  }

  async function getNetworks() {
    let registryNetworks, operatorAddresses;
    try {
      registryNetworks = await state.directory.getChains();
      operatorAddresses = await state.directory.getOperatorAddresses();
    } catch (error) {
      setState({ error: error.message, loading: false });
      return {};
    }

    const networks = Object.values(registryNetworks).map(data => {
      const networkData = networksData.find(el => el.name === data.path);
      if (networkData && networkData.enabled === false)
        return;
      if (!data.image || data.status === 'killed')
        return;

      if (!networkData)
        data.experimental = true;

      return new Network({ ...data, ...networkData }, operatorAddresses[data.path]);
    });
    return _.compact(networks).reduce((a, v) => ({ ...a, [v.path]: v }), {});
  }

  function changeNetworkMode(networkMode) {
    let domain = networkMode === 'testnet' ? process.env.TESTNET_DOMAIN : process.env.MAINNET_DOMAIN;
    if (domain) {
      window.location.replace('https://' + domain);
    } else {
      const directory = CosmosDirectory(networkMode === 'testnet');
      setState({ networkMode, directory, active: 'networks', network: null, queryClient: null, networks: {}, validators: {}, operators: [] });
    }
  }

  function changeNetwork(network) {
    if(!network) return

    setState({
      network: network,
      queryClient: network.queryClient,
      validators: network.getValidators(),
      operators: network.getOperators(),
      loading: false
    });
    if (govMatch) {
      setActive('governance', network);
    } else if(grantMatch && network.authzSupport) {
      setActive('grants', network);
    } else {
      setActive('delegations', network);
    }
  }

  function setActive(active, network) {
    network = network || state.network;
    switch (active) {
      case 'grants':
        navigate("/" + network.path + '/grants');
        break;
      case 'governance':
        navigate("/" + network.path + '/govern');
        break;
      case 'delegations':
        navigate("/" + network.path);
        break;
      default:
        navigate("/");
        break;
    }
    setState({ active });

    const body = document.querySelector('#root');
    body.scrollIntoView({}, 500);
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

    if (localStorage.getItem(LS_THEME_KEY) !== themeChoice) {
      localStorage.setItem(LS_THEME_KEY, themeChoice)
    }

    return () => {
      matchMedia && matchMedia.removeEventListener('change', setThemeEvent)
    }
  }, [themeChoice])

  useEffect(() => {
    if (theme) {
      const themeLink = document.getElementById("theme-style");
      const themeName = theme === 'dark' ? DARK_THEME : LIGHT_THEME
      themeLink.setAttribute("href", `https://cdn.jsdelivr.net/npm/bootswatch@5.1.3/dist/${themeName}/bootstrap.min.css`);
      document.body.classList.toggle('dark-theme', theme === 'dark');
    }
  }, [theme])

  useEffect(() => {
    if (state.error) return
    if (!Object.keys(state.networks).length) {
      setState({ loading: true })
      getNetworks().then(networks => {
        setState({ networks: networks })
      })
    }
  }, [state.networks])

  useEffect(() => {
    if (!params.network) {
      setState({ active: 'networks' })
    }
  }, [govMatch, params.network])

  useEffect(() => {
    if (Object.keys(state.networks).length && (!state.network || state.network.path !== params.network)) {
      let networkName = params.network
      const network = state.networks[networkName]
      if (!network) {
        navigate("/");
        setState({ loading: false })
        return
      }
      if (params.network != networkName) {
        navigate("/" + networkName);
      }
      network.load().then(() => {
        return network.connect().then(() => {
          if (network.connected) {
            setState({
              active: grantMatch ? 'grants' : govMatch ? 'governance' : 'delegations',
              network: network,
              queryClient: network.queryClient,
              validators: network.getValidators(),
              operators: network.getOperators(),
              loading: false
            })
          } else {
            throw false
          }
        })
      }).catch(error => {
        console.log(error)
        changeNetwork(network)
      })
    }
  }, [state.networks, state.network, params.network, navigate])

  useEffect(() => {
    if (params.validator && state.validators[params.validator]) {
      setState({ validator: state.validators[params.validator] })
    } else if (state.validator) {
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

  return <App networks={state.networks} network={state.network} active={state.active} queryClient={state.queryClient}
    networkMode={state.networkMode} directory={state.directory} changeNetworkMode={changeNetworkMode}
    operators={state.operators} validators={state.validators} validator={state.validator}
    changeNetwork={(network, validators) => changeNetwork(network, validators)} setActive={setActive}
    theme={theme} themeChoice={themeChoice} themeDefault={themeDefault} setThemeChoice={setThemeChoice}
  />;
}

export default NetworkFinder
