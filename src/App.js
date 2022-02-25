import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import React from 'react'
import RestClient from './RestClient'
import AlertMessage from './AlertMessage'
import Wallet from './Wallet'
import Coins from './Coins'
import SigningClient from './SigningClient'

import { MsgGrant, MsgRevoke } from "cosmjs-types/cosmos/authz/v1beta1/tx.js";
import { MsgExec } from "cosmjs-types/cosmos/authz/v1beta1/tx.js";

import {
  Container,
  Button,
  Badge,
  Spinner
} from 'react-bootstrap';
import { Check } from 'react-bootstrap-icons';
import {CopyToClipboard} from 'react-copy-to-clipboard';
import Countdown from 'react-countdown';
import GitHubButton from 'react-github-btn'
import PoweredByAkash from './assets/powered-by-akash.svg'

class App extends React.Component {
  constructor(props) {
    super(props);
    this.chainId = process.env.REACT_APP_CHAIN_ID
    this.validatorAddress = process.env.REACT_APP_VALIDATOR_ADDRESS
    this.rpcUrl = process.env.REACT_APP_RPC_URL
    this.restUrl = process.env.REACT_APP_REST_URL
    this.maxValidators = process.env.REACT_APP_MAX_VALIDATORS
    this.runTime = '01:00'
    this.minimumReward = {amount: 1_000, denom: 'uosmo'}
    this.restClient = RestClient(this.restUrl)
    this.state = {}
    this.connect = this.connect.bind(this);
    this.refresh = this.refresh.bind(this);
    this.countdownRenderer = this.countdownRenderer.bind(this);
  }

  componentDidMount() {
    this.getValidators()
    window.onload = async () => {
      if (!window.keplr) {
        this.setState({isLoaded: true, keplr: false})
      } else {
        this.setState({keplr: true})
        this.connect()
      }
    }
    window.addEventListener("keplr_keystorechange", this.refresh)
  }

  componentDidUpdate(prevProps, prevState){
    if(!this.state.keplr && window.keplr){
      this.setState({keplr: true})
      this.connect()
    }
  }

  componentWillUnmount() {
    window.removeEventListener("keplr_keystorechange", this.refresh)
  }

  async connect() {
    await window.keplr.enable(this.chainId);
    if (window.getOfflineSigner){
      const offlineSigner = await window.getOfflineSignerAuto(this.chainId)
      const key = await window.keplr.getKey(this.chainId);
      const stargateClient = await SigningClient(this.rpcUrl, offlineSigner, key)
      const address = await stargateClient.getAddress()

      stargateClient.registry.register("/cosmos.authz.v1beta1.MsgGrant", MsgGrant)
      stargateClient.registry.register("/cosmos.authz.v1beta1.MsgRevoke", MsgRevoke)
      stargateClient.registry.register("/cosmos.authz.v1beta1.MsgExec", MsgExec)
      this.setState({
        address: address,
        stargateClient: stargateClient,
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

  async refresh() {
    console.log('Refresh')
    this.connect()
  }

  async getValidators() {
    this.setState({loading: true})

    this.restClient.getValidators().then(
      (validators) => {
        const operator = validators[this.validatorAddress]
        this.setState({ validators: validators, operator: operator, loading: false });
      },
      (error) => {
        this.setState({ error, loading: false });
      }
    )
  }

  async getBalance() {
    this.restClient.getBalance(this.state.address)
      .then(
        (balance) => {
          this.setState({
            balance: balance
          })
        },
        (error) => { }
      )
  }

  nextRun(delayHour){
    const now = new Date()
    const runTime = this.runTime.split(':')
    let day
    if(delayHour){
      day = now.getHours() > runTime[0] ? now.getDate() + 1 : now.getDate()
    }else{
      day = now.getHours() >= runTime[0] ? now.getDate() + 1 : now.getDate()
    }

    return new Date(
      now.getFullYear(),
      now.getMonth(),
      day,
      runTime[0],
      runTime[1],
      runTime[2] || 0
    )
  }

  countdownRenderer({ hours, minutes, seconds, completed }){
    if (completed) {
      return <p>Auto REStake is running right now. The next run will be at {this.runTime} tomorrow</p>
    } else {
      let string = ''
      if(hours > 0) string = string.concat(hours + ' hours, ')
      if(minutes > 0) string = string.concat(minutes + ' minutes and ')
      string = string.concat(seconds + ' seconds')
      return (
        <p className="text-center">Auto REStake will run in <span>{string}</span></p>
      )
    }
  }


  setCopied(){
    this.setState({copied: true})
    setTimeout(() => {
      this.setState({copied: false})
    }, 2000)
  }

  render() {
    if (this.state.loading) {
      return (
        <div className="pt-5 text-center">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
        </div>
      )
    }
    if (this.state.error) {
      return (
        <p>Loading failed: {this.state.error}</p>
      )
    }

    if(!this.state.operator){
      return <p>Operator not found</p>
    }

    return (
      <Container>
        <header className="d-flex flex-wrap justify-content-center py-3 mb-4 border-bottom">
          <div className="d-flex align-items-center mb-3 mb-md-0 me-md-auto text-dark text-decoration-none">
            <a href="/" className="text-dark text-decoration-none">
              <span className="fs-4">REStake</span>
            </a>
            <a href={this.state.operator.description.website} target="_blank" rel="noreferrer" className="moniker text-dark text-decoration-none">
              <small>by {this.state.operator.description.moniker}</small>
            </a>
          </div>
          <ul className="nav nav-pills justify-content-end">
            {this.state.address &&
            <>
              <li className="nav-item">
                <CopyToClipboard text={this.state.address}
                  onCopy={() => this.setCopied()}>
                  <span role="button"><span className="nav-link disabled">{this.state.copied && <Check />}&nbsp;{this.state.address}</span></span>
                </CopyToClipboard>
              </li>
              <li className="nav-item">
                <span className="nav-link">
                  <Badge><Coins coins={this.state.balance} /></Badge>
                </span>
              </li>
              <li className="nav-item">
                <a href="#" onClick={() => this.disconnect()} className="nav-link" aria-current="page">Disconnect</a>
              </li>
            </>
            }
          </ul>
        </header>
        <div className="mb-5">
          <p className="lead text-center mb-4">REStake auto-compounds your <strong>Osmosis</strong> staking earnings <strong>once per day</strong>, for up to <strong>{this.maxValidators}</strong> different validators.</p>
          <p className="text-center">
            Enabling REStake will authorize <a href={this.state.operator.description.website} target="_blank" rel="noreferrer" className="text-dark text-decoration-none">{this.state.operator.description.moniker}</a> to send <em>WithdrawDelegatorReward</em> and <em>Delegate</em> transactions on your behalf for 1 year, for the validators you specify.
          </p>
          <p className="text-center mb-5">
            <a href={this.state.operator.description.website} target="_blank" rel="noreferrer" className="text-dark text-decoration-none">{this.state.operator.description.moniker}</a> will pay the transaction fees for you. You can revoke the authorization at any time and everything is open source.
          </p>
          {this.state.address &&
          <>
            <Wallet
              operator={this.state.operator}
              address={this.state.address}
              validators={this.state.validators}
              restClient={this.restClient}
              stargateClient={this.state.stargateClient} />
            <div className="text-center">
              <Countdown
                date={this.nextRun(true)}
                renderer={this.countdownRenderer}
              />
              <p><em>The minimum reward is <Coins coins={this.minimumReward} /></em></p>
            </div>
          </>
          }
          {!this.state.address && (
            !this.state.keplr
              ? (
                <AlertMessage variant="warning">
                  Please install the <a href="https://chrome.google.com/webstore/detail/keplr/dmkamcknogkgcdfhhbddcghachkejeap?hl=en" target="_blank" rel="noreferrer">Keplr browser extension</a> using desktop Google Chrome. WalletConnect and mobile support is coming soon.
                </AlertMessage>
              ) : (
                <div className="text-center">
              <Button onClick={this.connect}>
                Connect Keplr
              </Button>
            </div>
              )
          )}
        </div>
        <footer className="d-flex flex-wrap justify-content-between align-items-center py-3 my-4 border-top">
          <a href="https://akash.network" target="_blank" rel="noreferrer" className="col-md-4 mb-0 text-muted">
            <img src={PoweredByAkash} alt="Powered by Akash" />
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
