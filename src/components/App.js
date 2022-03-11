import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import React from 'react'
import _ from 'lodash'
import SigningClient from '../utils/SigningClient.mjs'
import AlertMessage from './AlertMessage'
import NetworkSelect from './NetworkSelect'
import Wallet from './Wallet'
import Coins from './Coins'
import ValidatorLink from './ValidatorLink'
import About from './About'

import { MsgGrant, MsgRevoke } from "cosmjs-types/cosmos/authz/v1beta1/tx.js";

import {
  Container,
  Button,
  Badge,
} from 'react-bootstrap';
import {CopyToClipboard} from 'react-copy-to-clipboard';
import GitHubButton from 'react-github-btn'
import Logo from '../assets/logo.png'
import Logo2x from '../assets/logo@2x.png'
import Logo3x from '../assets/logo@3x.png'

import PoweredByAkash from '../assets/powered-by-akash.svg'

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {validatorImages: {}}
    this.connect = this.connect.bind(this);
    this.showNetworkSelect = this.showNetworkSelect.bind(this);
    this.getValidatorImage = this.getValidatorImage.bind(this);
    this.loadValidatorImages = this.loadValidatorImages.bind(this);
  }

  async componentDidMount() {
    await this.setNetwork()
    window.onload = async () => {
      if (!window.keplr) {
        this.setState({keplr: false})
      } else {
        this.setState({keplr: true})
        this.connect()
      }
    }
    window.addEventListener("keplr_keystorechange", this.connect)
    if(this.props.operators){
      this.loadValidatorImages(this.props.network, _.compact(this.props.operators.map(el => el.validatorData)))
    }
    this.loadValidatorImages(this.props.network, this.props.validators)
  }

  async componentDidUpdate(prevProps){
    if(!this.state.keplr && window.keplr){
      this.setState({keplr: true})
      this.connect()
    }
    if(this.props.network !== prevProps.network){
      if(this.state.address){
        this.connect()
      }
      await this.setNetwork()
    }
  }

  componentWillUnmount() {
    window.removeEventListener("keplr_keystorechange", this.connect)
  }

  setNetwork(){
    const network = this.props.network
    if(!network) return

    return this.setState({
      error: false,
      chainId: network.chainId,
      denom: network.denom,
      restClient: network.restClient
    })
  }

  showNetworkSelect(){
    this.setState({showNetworkSelect: true})
  }

  async connect() {
    if(!this.props.network.connected){
      return this.setState({
        error: 'Could not connect to any available API servers'
      })
    }
    await window.keplr.enable(this.state.chainId);
    if (window.getOfflineSigner){
      const offlineSigner = await window.getOfflineSignerAuto(this.state.chainId)
      const key = await window.keplr.getKey(this.state.chainId);
      const stargateClient = await this.props.network.signingClient(offlineSigner, key)
      if(!stargateClient.connected){
        this.setState({
          error: 'Could not connect to any available RPC servers'
        })
        return
      }

      const address = await stargateClient.getAddress()

      stargateClient.registry.register("/cosmos.authz.v1beta1.MsgGrant", MsgGrant)
      stargateClient.registry.register("/cosmos.authz.v1beta1.MsgRevoke", MsgRevoke)
      this.setState({
        address: address,
        stargateClient: stargateClient,
        error: false
      })
      this.getBalance()
    }
  }

  async disconnect(){
    this.setState({
      address: null,
      stargateClient: null
    })
  }

  getValidatorImage(network, validatorAddress, expireCache){
    const images = this.state.validatorImages[network.name] || {}
    if(images[validatorAddress]){
      return images[validatorAddress]
    }
    return this.getValidatorImageCache(validatorAddress, expireCache)
  }

  getValidatorImageCache(validatorAddress, expireCache){
    const cache = localStorage.getItem(validatorAddress)
    if(!cache) return

    let cacheData = {}
    try {
      cacheData = JSON.parse(cache)
    } catch {
      cacheData.url = cache
    }
    if(!cacheData.url) return
    if(!expireCache) return cacheData.url

    const cacheTime = cacheData.time && new Date(cacheData.time)
    if(!cacheData.time) return

    const expiry = new Date() - 1000 * 60 * 60 * 24 * 3
    if(cacheTime >= expiry) return cacheData.url
  }

  async loadValidatorImages(network, validators) {
    this.setState((state, props) => ({
      validatorImages: _.set(state.validatorImages, network.name, state.validatorImages[network.name] || {})
    }));
    const calls = Object.values(validators).map(validator => {
      return () => {
        if(validator.description.identity && !this.getValidatorImage(network, validator.operator_address, true)){
          return fetch("https://keybase.io/_/api/1.0/user/lookup.json?fields=pictures&key_suffix=" + validator.description.identity)
            .then((response) => {
              return response.json();
            }).then((data) => {
              if(data.them && data.them[0] && data.them[0].pictures){
                const imageUrl = data.them[0].pictures.primary.url
                this.setState((state, props) => ({
                  validatorImages: _.set(state.validatorImages, [network.name, validator.operator_address], imageUrl)
                }));
                localStorage.setItem(validator.operator_address, JSON.stringify({url: imageUrl, time: +new Date()}))
              }
            }, error => { })
        }else{
          return null
        }
      }
    })
    const batchCalls = _.chunk(calls, 1);

    for (const batchCall of batchCalls) {
      await Promise.all(batchCall.map(call => call()))
    }
  }

  async getBalance() {
    this.state.restClient.getBalance(this.state.address, this.props.network.denom)
      .then(
        (balance) => {
          this.setState({
            balance: balance
          })
        }
      )
  }

  setCopied(){
    this.setState({copied: true})
    setTimeout(() => {
      this.setState({copied: false})
    }, 2000)
  }

  render() {
    return (
      <Container>
        <header className="d-flex flex-wrap justify-content-between py-3 mb-4 border-bottom">
          <div className="logo d-flex align-items-center mb-3 mb-md-0 text-dark text-decoration-none">
            <span onClick={() => this.setState({showAbout: true})} role="button" className="text-dark text-decoration-none">
              <img src={Logo} srcSet={`${Logo2x} 2x, ${Logo3x} 3x`} alt="REStake" />
            </span>
          </div>
          {this.state.address &&
          <ul className="nav nav-pills justify-content-end">
            <li className="nav-item d-none d-xl-block">
              <CopyToClipboard text={this.state.address}
                onCopy={() => this.setCopied()}>
                <span role="button"><span className={'nav-link disabled clipboard' + (this.state.copied ? ' copied' : '')}>{this.state.address}</span></span>
              </CopyToClipboard>
            </li>
            <li className="nav-item d-none d-md-block">
              <span className="nav-link">
                <Badge>
                  <Coins
                    coins={this.state.balance}
                    decimals={this.props.network.decimals}
                  />
                </Badge>
              </span>
            </li>
            {false && (
              <li className="nav-item">
                <Button onClick={() => this.disconnect()} className="nav-link btn-link" aria-current="page">Disconnect</Button>
              </li>
            )}
          </ul>
          }
          <div className="d-flex align-items-center mb-3 mb-md-0 text-dark text-decoration-none">
            <NetworkSelect show={this.state.showNetworkSelect} onHide={() => {this.setState({showNetworkSelect: false})}} networks={this.props.networks}
              network={this.props.network}
              validators={this.props.validators} getValidatorImage={this.getValidatorImage}
              changeNetwork={this.props.changeNetwork} loadValidatorImages={this.loadValidatorImages} />
          </div>
        </header>
        <div className="mb-5">
          <p className="lead fs-3 text-center mt-5 mb-5">REStake allows validators to <strong>auto-compound</strong> your <strong onClick={this.showNetworkSelect} className="text-decoration-underline" role="button">{this.props.network.prettyName}</strong> staking rewards for you</p>
          <AlertMessage message={this.state.error} variant="danger" dismissible={false} />
          {!this.state.address && (
            !this.state.keplr
              ? (
                <AlertMessage variant="warning" dismissible={false}>
                  Please install the <a href="https://chrome.google.com/webstore/detail/keplr/dmkamcknogkgcdfhhbddcghachkejeap?hl=en" target="_blank" rel="noreferrer">Keplr browser extension</a> using desktop Google Chrome.<br />WalletConnect and mobile support is coming soon.
                </AlertMessage>
              ) : (
                <div className="mb-5 text-center">
                  <Button onClick={this.connect}>
                    Connect Keplr
                  </Button>
                </div>
              )
          )}
          {this.state.address &&
          <>
            <Wallet
              network={this.props.network}
              address={this.state.address}
              operators={this.props.operators}
              validators={this.props.validators}
              balance={this.state.balance}
              getValidatorImage={this.getValidatorImage}
              restClient={this.state.restClient}
              stargateClient={this.state.stargateClient} />
          </>
          }
          <hr />
          <p className="mt-5 text-center">
            Enabling REStake will authorize the validator to send <em>WithdrawDelegatorReward</em> and <em>Delegate</em> transactions on your behalf for 1 year using <a href="https://docs.cosmos.network/master/modules/authz/" target="_blank" rel="noreferrer">Authz</a>.<br />
            They will only be authorised to delegate to their own validator. You can revoke the authorization at any time and everything is open source.
          </p>
          <p className="text-center mb-4">
            <strong>The validators will pay the transaction fees for you.</strong>
          </p>
          <p className="text-center mb-5">
            <Button onClick={() => this.setState({showAbout: true})} variant="outline-secondary">More info</Button>
          </p>
        </div>
        <footer className="d-flex flex-wrap justify-content-between align-items-center py-3 my-4 border-top">
          <a href="https://akash.network" target="_blank" rel="noreferrer" className="col-md-4 mb-0 text-muted">
            <img src={PoweredByAkash} alt="Powered by Akash" width={200} />
          </a>

          <a href="https://ecostake.com" target="_blank" rel="noreferrer" className="col-md-4 d-flex align-items-center justify-content-center me-lg-auto link-dark text-decoration-none">
            <span className="d-none d-sm-inline me-1">Built with 💚&nbsp;</span> by ECO Stake 🌱
          </a>

          <p className="col-md-4 mb-0 text-muted text-end justify-content-end d-none d-lg-flex">
            <GitHubButton href="https://github.com/eco-stake/restake" data-icon="octicon-star" data-size="large" data-show-count="true" aria-label="Star eco-stake/restake on GitHub">Star</GitHubButton>
          </p>
        </footer>
        <About show={this.state.showAbout} onHide={() => this.setState({showAbout: false})} />
      </Container>
    )
  }
}

export default App;
