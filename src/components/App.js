import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import React from 'react'
import _ from 'lodash'
import AlertMessage from './AlertMessage'
import NetworkSelect from './NetworkSelect'
import Wallet from './Wallet'
import Coins from './Coins'
import About from './About'

import { MsgGrant, MsgRevoke } from "cosmjs-types/cosmos/authz/v1beta1/tx.js";

import {
  Container,
  Button,
  Badge,
} from 'react-bootstrap';
import {
  Droplet,
  DropletFill,
  DropletHalf
} from 'react-bootstrap-icons'
import {CopyToClipboard} from 'react-copy-to-clipboard';
import GitHubButton from 'react-github-btn'
import Logo from '../assets/logo.png'
import Logo2x from '../assets/logo@2x.png'
import Logo3x from '../assets/logo@3x.png'
import LogoWhite from '../assets/logo-white.png'
import LogoWhite2x from '../assets/logo-white@2x.png'
import LogoWhite3x from '../assets/logo-white@3x.png'

import PoweredByAkash from '../assets/powered-by-akash.svg'
import PoweredByAkashWhite from '../assets/powered-by-akash-white.svg'
import TooltipIcon from './TooltipIcon';

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {}
    this.connect = this.connect.bind(this);
    this.showNetworkSelect = this.showNetworkSelect.bind(this);
    this.getBalance = this.getBalance.bind(this);
  }

  async componentDidMount() {
    this.connectKeplr()
    window.addEventListener("load", this.connectKeplr)
    window.addEventListener("keplr_keystorechange", this.connect)
  }

  async componentDidUpdate(prevProps, prevState){
    if(this.state.keplr != prevState.keplr){
      this.connect()
    }else if(this.props.network && this.props.network !== prevProps.network){
      this.setState({ balance: undefined, address: undefined })
      this.connect()
    }
  }

  componentWillUnmount() {
    window.removeEventListener("load", this.connectKeplr)
    window.removeEventListener("keplr_keystorechange", this.connect)
  }

  showNetworkSelect(){
    this.setState({showNetworkSelect: true})
  }

  connected() {
    return this.props.network.connected && Object.values(this.props.validators).length > 0
  }

  connectKeplr() {
    if (this.state.keplr && !window.keplr) {
      this.setState({ keplr: false })
    } else if(!this.state.keplr && window.keplr){
      this.setState({ keplr: true })
    }
  }

  async connect() {
    if (!this.connected()) {
      return this.setState({
        error: 'Could not connect to any available API servers'
      })
    }
    const { network } = this.props
    const chainId = network.chainId
    try {
      if (window.keplr) {
        if(network.gasPricePrefer){
          window.keplr.defaultOptions = {
            sign: { preferNoSetFee: true }
          }
        }
        await window.keplr.enable(chainId);
      }
    } catch (e) {
      console.log(e.message, e)
      await this.suggestChain(network)
    }
    if (window.getOfflineSigner) {
      try {
        const offlineSigner = await window.getOfflineSignerAuto(chainId)
        const key = await window.keplr.getKey(chainId);
        const stargateClient = await network.signingClient(offlineSigner, key, network.gasPricePrefer)

        const address = await stargateClient.getAddress()

        stargateClient.registry.register("/cosmos.authz.v1beta1.MsgGrant", MsgGrant)
        stargateClient.registry.register("/cosmos.authz.v1beta1.MsgRevoke", MsgRevoke)
        this.setState({
          address: address,
          stargateClient: stargateClient,
          queryClient: network.queryClient,
          error: false
        })
        this.getBalance()
      } catch (e) {
        console.log(e)
        return this.setState({
          error: 'Failed to connect to signing client. API may be down.',
          loading: false
        })
      }
    }
  }

  async disconnect() {
    this.setState({
      address: null,
      stargateClient: null
    })
  }

  suggestChain(network) {
    if (!window.keplr) return
    const currency = {
      coinDenom: network.symbol,
      coinMinimalDenom: network.denom,
      coinDecimals: network.decimals,
      coinGeckoId: network.coinGeckoId
    }
    return window.keplr.experimentalSuggestChain({
      rpc: network.rpcUrl,
      rest: network.restUrl,
      chainId: network.chainId,
      chainName: network.prettyName,
      stakeCurrency: currency,
      bip44: { coinType: network.slip44 },
      walletUrlForStaking: "https://restake.app/" + network.name,
      bech32Config: {
        bech32PrefixAccAddr: network.prefix,
        bech32PrefixAccPub: network.prefix + "pub",
        bech32PrefixValAddr: network.prefix + "valoper",
        bech32PrefixValPub: network.prefix + "valoperpub",
        bech32PrefixConsAddr: network.prefix + "valcons",
        bech32PrefixConsPub: network.prefix + "valconspub"
      },
      currencies: [currency],
      feeCurrencies: [currency],
      gasPriceStep: network.gasPriceStep
    })
  }

  async getBalance() {
    this.state.queryClient.getBalance(this.state.address, this.props.network.denom)
      .then(
        (balance) => {
          this.setState({
            balance: balance
          })
        }
      )
  }

  setCopied() {
    this.setState({ copied: true })
    setTimeout(() => {
      this.setState({ copied: false })
    }, 2000)
  }

  themeIcon() {
    const { theme, themeChoice, themeDefault, setThemeChoice } = this.props
    let icon, switchTo
    let iconProps = {
      size: '1.4em',
      className: 'me-3',
      role: 'button',
      onClick: () => setThemeChoice(switchTo)
    }
    if(themeChoice === 'auto'){
      icon = <DropletHalf {...iconProps} />
      switchTo = theme === 'dark' ? 'light' : 'dark'
    }else{
      icon = themeChoice === 'dark' ? <DropletFill {...iconProps} /> : <Droplet {...iconProps} />
      switchTo = themeDefault !== theme ? 'auto' : theme === 'dark' ? 'light' : 'dark'
    }
    const tooltip = `Switch to ${switchTo} mode`
    return (
      <TooltipIcon icon={icon} tooltip={tooltip} placement="left" />
    )
  }

  render() {
    return (
      <Container>
        <header className="d-flex flex-wrap justify-content-between py-3 mb-4 border-bottom">
          <div className="logo d-flex align-items-center mb-3 mb-md-0 text-reset text-decoration-none">
            <span onClick={() => this.setState({ showAbout: true })} role="button" className="text-reset text-decoration-none">
              {this.props.theme === 'light'
               ? (
                  <img src={Logo} srcSet={`${Logo2x} 2x, ${Logo3x} 3x`} alt="REStake" />
               ) : (
                  <img src={LogoWhite} srcSet={`${LogoWhite2x} 2x, ${LogoWhite3x} 3x`} alt="REStake" />
               )}
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
              <li className="nav-item d-none d-lg-block d-xl-none">
                <CopyToClipboard text={this.state.address}
                  onCopy={() => this.setCopied()}>
                  <span role="button"><span style={{maxWidth: 300}} className={'nav-link disabled small d-block text-truncate clipboard' + (this.state.copied ? ' copied' : '')}>{this.state.address}</span></span>
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
          <div className="d-flex align-items-center mb-3 mb-md-0 text-reset text-decoration-none">
            {this.themeIcon()}
            <NetworkSelect show={this.state.showNetworkSelect} onHide={() => { this.setState({ showNetworkSelect: false }) }} networks={this.props.networks}
              network={this.props.network}
              validators={this.props.validators}
              changeNetwork={this.props.changeNetwork} />
          </div>
        </header>
        <div className="mb-5">
          <p className="lead fs-3 text-center mt-5 mb-5">
            REStake allows validators to <strong onClick={() => this.setState({ showAbout: true })} className="text-decoration-underline" role="button">auto-compound</strong> your <strong onClick={this.showNetworkSelect} className="text-decoration-underline" role="button">{this.props.network.prettyName}</strong> staking rewards for you
          </p>
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
                validator={this.props.validator}
                balance={this.state.balance}
                getBalance={this.getBalance}
                queryClient={this.state.queryClient}
                stargateClient={this.state.stargateClient} />
            </>
          }
          <hr />
          <p className="mt-5 text-center">
            Enabling REStake will authorize the validator to send <em>WithdrawDelegatorReward</em> and <em>Delegate</em> transactions on your behalf for 1 year <a href="https://docs.cosmos.network/master/modules/authz/" target="_blank" rel="noreferrer" className="text-reset">using Authz</a>.<br />
            They will only be authorized to delegate to their own validator. You can revoke the authorization at any time and everything is open source.
          </p>
          <p className="text-center mb-4">
            <strong>The validators will pay the transaction fees for you.</strong>
          </p>
          <p className="text-center mb-5">
            <Button onClick={() => this.setState({ showAbout: true })} variant="outline-secondary">More info</Button>
          </p>
        </div>
        <footer className="d-flex flex-wrap justify-content-between align-items-center py-3 my-4 border-top">
          <a href="https://akash.network" target="_blank" rel="noreferrer" className="col-md-4 mb-0 text-muted">
            {this.props.theme === 'light'
            ? (
              <img src={PoweredByAkash} alt="Powered by Akash" width={200} />
            ) : (
              <img src={PoweredByAkashWhite} alt="Powered by Akash" width={200} />
            )}
          </a>

          <div className="col-md-4 align-items-center text-center me-lg-auto">
            <a href="https://ecostake.com" target="_blank" rel="noreferrer" className="text-reset text-decoration-none d-block mb-2">
              <span className="d-none d-sm-inline">Built with 💚&nbsp;</span> by ECO Stake 🌱
            </a>
            {this.props.network?.usingDirectory && (
              <a href="https://cosmos.directory" target="_blank" className="text-reset text-decoration-none d-block small">
                <span className="d-none d-sm-inline">Interchain with</span> cosmos.directory
              </a>
            )}
          </div>

          <p className="col-md-4 mb-0 text-muted text-end justify-content-end d-none d-lg-flex">
            {this.props.theme === 'light'
              ? (
                <GitHubButton href="https://github.com/eco-stake/restake" data-icon="octicon-star" data-size="large" data-show-count="true" aria-label="Star eco-stake/restake on GitHub">Star</GitHubButton>
              ) : (
                <GitHubButton href="https://github.com/eco-stake/restake" data-icon="octicon-star" data-size="large" data-show-count="true" aria-label="Star eco-stake/restake on GitHub" data-color-scheme="no-preference: dark; light: dark; dark: dark;">Star</GitHubButton>
              )}
          </p>
        </footer>
        <About show={this.state.showAbout} onHide={() => this.setState({ showAbout: false })} />
      </Container>
    )
  }
}

export default App;
