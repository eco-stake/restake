import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import PoweredByAkash from './assets/powered-by-akash.svg'
import React from 'react'
import Wallet from './Wallet'
import Coins from './Coins'

import {
    SigningStargateClient
} from '@cosmjs/stargate'
import { MsgGrant, MsgRevoke } from "cosmjs-types/cosmos/authz/v1beta1/tx";

import {
  Container,
  Button,
  Badge
} from 'react-bootstrap';
import { Check } from 'react-bootstrap-icons';
import {CopyToClipboard} from 'react-copy-to-clipboard';


import GitHubButton from 'react-github-btn'

class App extends React.Component {
  constructor(props) {
    super(props);
    this.chainId = process.env.REACT_APP_CHAIN_ID
    this.rpcUrl = process.env.REACT_APP_RPC_URL
    this.restUrl = process.env.REACT_APP_REST_URL
    this.maxValidators = process.env.REACT_APP_MAX_VALIDATORS
    this.state = {}
    this.connect = this.connect.bind(this);
    this.refresh = this.refresh.bind(this);
  }

  componentDidMount() {
    window.onload = async () => {
      if (!window.keplr) {
        this.setState({isLoaded: true, error: 'Please install Keplr extension'})
      } else {
        this.connect()
      }
    }
    window.addEventListener("keplr_keystorechange", this.refresh)
  }

  componentWillUnmount() {
    window.removeEventListener("keplr_keystorechange", this.refresh)
  }

  async getBalance() {
    fetch(this.restUrl + "/cosmos/bank/v1beta1/balances/" + this.state.address)
      .then(res => res.json())
      .then(
        (result) => {
          this.setState({
            balance: result.balances.find(element => element.denom === 'uosmo') || {denom: 'uosmo', amount: 0}
          })
        },
        (error) => { }
      )
  }

  async refresh() {
    console.log('Refresh')
    this.connect()
  }

  async connect() {
    await window.keplr.enable(this.chainId);
    if (window.getOfflineSigner){
      const offlineSigner = window.getOfflineSigner(this.chainId)
      const accounts = await offlineSigner.getAccounts()

      const stargateClient = await SigningStargateClient.connectWithSigner(
        this.rpcUrl,
        offlineSigner
      )
      stargateClient.registry.register("/cosmos.authz.v1beta1.MsgGrant", MsgGrant)
      stargateClient.registry.register("/cosmos.authz.v1beta1.MsgRevoke", MsgRevoke)
      this.setState({
        address: accounts[0].address,
        stargateClient: stargateClient
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

  setCopied(){
    this.setState({copied: true})
    setTimeout(() => {
      this.setState({copied: false})
    }, 2000)
  }

  render() {
    return (
      <Container>
        <header className="d-flex flex-wrap justify-content-center py-3 mb-4 border-bottom">
          <div className="d-flex align-items-center mb-3 mb-md-0 me-md-auto text-dark text-decoration-none">
            <a href="/" className="text-dark text-decoration-none">
              <span className="fs-4">REStake</span>
            </a>
            <a href="https://ecostake.com" target="_blank" rel="noreferrer" className="moniker text-dark text-decoration-none">
              <small>by ECO Stake 🌱</small>
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
          {this.state.address &&
          <>
            <p className="text-center">
              Enabling REStake will authorize ECO Stake 🌱 to send <em>WithdrawDelegatorReward</em> and <em>Delegate</em> transactions on your behalf for 1 year, for the validators you specify.
            </p>
            <p className="text-center mb-5">
              ECO Stake 🌱  will pay the claim and delegate transaction fees for you. You can revoke the authorization at any time and everything is open source.
            </p>
            <Wallet
              address={this.state.address}
              stargateClient={this.state.stargateClient} />
          </>
          }
          {!this.state.address &&
            <div className="text-center">
              <Button onClick={this.connect}>
                Connect
              </Button>
            </div>
          }
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
