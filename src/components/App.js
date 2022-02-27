import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import React from 'react'
import _ from 'lodash'
import SigningClient from '../utils/SigningClient'
import AlertMessage from './AlertMessage'
import NetworkSelect from './NetworkSelect'
import Wallet from './Wallet'
import Coins from './Coins'
import ValidatorLink from './ValidatorLink'

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
    this.getValidatorImage = this.getValidatorImage.bind(this);
    this.loadValidatorImages = this.loadValidatorImages.bind(this);
  }

  async componentDidMount() {
    await this.setNetworkAndOperator()
    window.onload = async () => {
      if (!window.keplr) {
        this.setState({keplr: false})
      } else {
        this.setState({keplr: true})
        this.connect()
      }
    }
    window.addEventListener("keplr_keystorechange", this.connect)
    if(this.props.operator){
      this.loadValidatorImages(this.props.network, [this.props.operator.validatorData])
    }
    this.loadValidatorImages(this.props.network, this.props.validators)
  }

  async componentDidUpdate(prevProps){
    if(!this.state.keplr && window.keplr){
      this.setState({keplr: true})
      this.connect()
    }
    if(this.props.network !== prevProps.network || this.props.operator !== prevProps.operator){
      this.connect()
      await this.setNetworkAndOperator()
    }
  }

  componentWillUnmount() {
    window.removeEventListener("keplr_keystorechange", this.connect)
  }

  setNetworkAndOperator(){
    const network = this.props.network
    const operator = this.props.operator
    if(!network) return

    return this.setState({
      chainId: network.chainId,
      denom: network.denom,
      validatorAddress: operator && operator.address,
      rpcUrl: network.rpcUrl,
      maxValidators: operator && operator.data.maxValidators,
      restClient: network.restClient
    })
  }

  async connect() {
    await window.keplr.enable(this.state.chainId);
    if (window.getOfflineSigner){
      const offlineSigner = await window.getOfflineSignerAuto(this.state.chainId)
      const key = await window.keplr.getKey(this.state.chainId);
      const stargateClient = await SigningClient(this.props.network, offlineSigner, key)
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

  getValidatorImage(network, validatorAddress){
    const images = this.state.validatorImages[network.name] || {}
    if(images[validatorAddress]){
      return images[validatorAddress]
    }
    return localStorage.getItem(validatorAddress)
  }

  async loadValidatorImages(network, validators) {
    this.setState((state, props) => ({
      validatorImages: _.set(state.validatorImages, network.name, state.validatorImages[network.name] || {})
    }));
    const calls = Object.values(validators).map(validator => {
      return () => {
        if(validator.description.identity && !this.getValidatorImage(network, validator.operator_address)){
          return fetch("https://keybase.io/_/api/1.0/user/lookup.json?fields=pictures&key_suffix=" + validator.description.identity)
            .then((response) => {
              return response.json();
            }).then((data) => {
              if(data.them && data.them[0] && data.them[0].pictures){
                const imageUrl = data.them[0].pictures.primary.url
                this.setState((state, props) => ({
                  validatorImages: _.set(state.validatorImages, [network.name, validator.operator_address], imageUrl)
                }));
                localStorage.setItem(validator.operator_address, imageUrl)
              }
            })
        }else{
          return null
        }
      }
    })
    const batchCalls = _.chunk(calls, 1);

    for (const batchCall of batchCalls) {
      await Promise.all(batchCall.map(call => call())) // makes a hundred calls in series
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

  getMaxValidatorText(){
    if(this.state.maxValidators){
      return 'up to ' + this.state.maxValidators
    }else{
      return 'multiple'
    }
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
          <div className="logo d-flex align-items-center mb-3 mb-md-0 me-md-auto text-dark text-decoration-none">
            <a href="/" className="text-dark text-decoration-none">
              <img src={Logo} srcSet={`${Logo2x} 2x, ${Logo3x} 3x`} alt="REStake" />
            </a>
            {false && this.props.operator &&
            <ValidatorLink operator={this.props.operator} className="moniker d-none d-md-block">
              <small>by {this.props.operator.moniker}</small>
            </ValidatorLink>
            }
          </div>
          <div className="d-flex align-items-center mb-3 mb-md-0 me-md-auto text-dark text-decoration-none">
            <NetworkSelect networks={this.props.networks}
              network={this.props.network} operator={this.props.operator}
              validators={this.props.validators} getValidatorImage={this.getValidatorImage}
              changeNetwork={this.props.changeNetwork} loadValidatorImages={this.loadValidatorImages} />
          </div>
          <ul className="nav nav-pills justify-content-end">
            {this.state.address &&
            <>
              <li className="nav-item d-none d-xl-block">
                <CopyToClipboard text={this.state.address}
                  onCopy={() => this.setCopied()}>
                  <span role="button"><span className={'nav-link disabled clipboard' + (this.state.copied ? ' copied' : '')}>{this.state.address}</span></span>
                </CopyToClipboard>
              </li>
              <li className="nav-item d-none d-md-block">
                <span className="nav-link">
                  <Badge><Coins coins={this.state.balance} /></Badge>
                </span>
              </li>
              {false && (
              <li className="nav-item">
                <Button onClick={() => this.disconnect()} className="nav-link btn-link" aria-current="page">Disconnect</Button>
              </li>
              )}
            </>
            }
          </ul>
        </header>
        <div className="mb-5">
          <p className="lead fs-3 text-center mt-5 mb-5"><strong><ValidatorLink operator={this.props.operator} fallback="REStake" /></strong> auto-compounds your <strong>{this.props.network.prettyName}</strong> staking earnings <strong>once per day</strong>, for <strong>{this.getMaxValidatorText()}</strong> validators. </p>
          {this.props.operator && (
            <>
              <p className="mt-5 text-center">
                Enabling REStake will authorize <strong><ValidatorLink operator={this.props.operator} /></strong> to send <em>WithdrawDelegatorReward</em> and <em>Delegate</em> transactions on your behalf for 1 year, for the validators you specify.
              </p>
              <p className="text-center mb-5">
                You can revoke the authorization at any time and everything is open source. <strong><ValidatorLink operator={this.props.operator} /> will pay the transaction fees for you.</strong>
              </p>
            </>
          )}
          {false &&
          <Button variant="link-secondary" onClick={() => this.setState({showAbout: true})}>Read more</Button>
          }
          {!this.state.address && (
            !this.state.keplr
              ? (
                <AlertMessage variant="warning">
                  Please install the <a href="https://chrome.google.com/webstore/detail/keplr/dmkamcknogkgcdfhhbddcghachkejeap?hl=en" target="_blank" rel="noreferrer">Keplr browser extension</a> using desktop Google Chrome. WalletConnect and mobile support is coming soon.
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
              operator={this.props.operator}
              address={this.state.address}
              validators={this.props.validators}
              getValidatorImage={this.getValidatorImage}
              restClient={this.state.restClient}
              stargateClient={this.state.stargateClient} />
          </>
          }
        </div>
        <footer className="d-flex flex-wrap justify-content-between align-items-center py-3 my-4 border-top">
          <a href="https://akash.network" target="_blank" rel="noreferrer" className="col-md-4 mb-0 text-muted">
            <img src={PoweredByAkash} alt="Powered by Akash" width={250} />
          </a>

          <a href="https://ecostake.com" target="_blank" rel="noreferrer" className="col-md-4 d-flex align-items-center justify-content-center mb-3 mb-md-0 me-md-auto link-dark text-decoration-none">
            Built with 💚 by ECO Stake 🌱
          </a>

          <p className="col-md-4 mb-0 text-muted text-end justify-content-end">
            <GitHubButton href="https://github.com/eco-stake/restake" data-icon="octicon-star" data-size="large" data-show-count="true" aria-label="Star eco-stake/restake on GitHub">Star</GitHubButton>
          </p>
        </footer>
      </Container>
    )
  }
}

export default App;
