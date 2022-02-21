import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import React from 'react'
import Wallet from './Wallet'
import Balance from './Balance'

import {
    SigningStargateClient
} from '@cosmjs/stargate'

import {
  Container,
  Button
} from 'react-bootstrap';

class App extends React.Component {
  constructor(props) {
    super(props);
    this.chainId = process.env.REACT_APP_CHAIN_ID
    this.rpcUrl = process.env.REACT_APP_RPC_URL
    this.restUrl = process.env.REACT_APP_REST_URL
    this.state = {}
  }

  async componentDidMount() {
    setTimeout(() => this.connect(), 1000)
  }

  async getBalance() {
    fetch(this.restUrl + "/cosmos/bank/v1beta1/balances/" + this.state.address)
      .then(res => res.json())
      .then(
        (result) => {
          this.setState({
            balance: result.balances.find(element => element.denom == 'uosmo')
          })
        },
        (error) => { }
      )
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

  render() {
    return (
      <Container>
        <header className="d-flex flex-wrap justify-content-center py-3 mb-4 border-bottom">
          <a href="/" className="d-flex align-items-center mb-3 mb-md-0 me-md-auto text-dark text-decoration-none">
            <span className="fs-4">REStake</span>
          </a>

          <ul className="nav nav-pills justify-content-end">
            {this.state.address &&
              <>
                <li className="nav-item">
                  <a className="nav-link disabled">{this.state.address} | <Balance coins={this.state.balance} /></a>
                </li>
                <li className="nav-item">
                  <a href="#" onClick={() => this.disconnect()} className="nav-link" aria-current="page">Disconnect</a>
                </li>
              </>
            }
          </ul>
        </header>
        {this.state.address &&
          <Wallet
            address={this.state.address}
            stargateClient={this.state.stargateClient} />
        }
        {!this.state.address &&
          <Button onClick={() => this.connect()}>
            Connect
          </Button>
        }
      </Container>
    )
  }
}

export default App;
