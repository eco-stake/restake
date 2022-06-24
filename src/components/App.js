import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import React from 'react'
import _ from 'lodash'
import AlertMessage from './AlertMessage'
import NetworkSelect from './NetworkSelect'
import Delegations from './Delegations';
import Coins from './Coins'
import About from './About'

import { MsgGrant, MsgRevoke } from "cosmjs-types/cosmos/authz/v1beta1/tx.js";

import {
  Container,
  Button,
  Dropdown,
  ButtonGroup,
  Navbar,
  Nav
} from 'react-bootstrap';
import {
  Droplet,
  DropletFill,
  DropletHalf,
  CashCoin,
  Coin,
  Inboxes,
  Stars,
  WrenchAdjustableCircle,
  WrenchAdjustableCircleFill
} from 'react-bootstrap-icons'
import { CopyToClipboard } from 'react-copy-to-clipboard';
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
import Governance from './Governance';
import Networks from './Networks';

class App extends React.Component {
  constructor(props) {
    super(props);
    const favouriteJson = localStorage.getItem('favourites')
    this.state = {favourites: favouriteJson ? JSON.parse(favouriteJson) : []}
    this.connect = this.connect.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.connectKeplr = this.connectKeplr.bind(this);
    this.showNetworkSelect = this.showNetworkSelect.bind(this);
    this.getBalance = this.getBalance.bind(this);
    this.toggleFavourite = this.toggleFavourite.bind(this);
  }

  async componentDidMount() {
    this.connectKeplr()
    window.addEventListener("load", this.connectKeplr)
    window.addEventListener("keplr_keystorechange", this.connect)
  }

  async componentDidUpdate(prevProps, prevState) {
    if(!this.props.network) return

    if (this.state.keplr != prevState.keplr) {
      this.connect()
    } else if (this.props.network !== prevProps.network) {
      this.setState({ balance: undefined, address: undefined })
      this.connect()
    }
  }

  componentWillUnmount() {
    window.removeEventListener("load", this.connectKeplr)
    window.removeEventListener("keplr_keystorechange", this.connect)
  }

  showNetworkSelect() {
    this.setState({ showNetworkSelect: true })
  }

  connected() {
    return this.props.network?.connected && Object.values(this.props.validators).length > 0
  }

  connectKeplr() {
    if (this.state.keplr && !window.keplr) {
      this.setState({ keplr: false })
    } else if (!this.state.keplr && window.keplr) {
      this.setState({ keplr: true })
    }
  }

  disconnect(){
    localStorage.removeItem('connected')
    this.setState({
      address: null,
      balance: null,
      stargateClient: null
    })
  }

  async connect(manual) {
    if (this.props.network && !this.connected()) {
      return this.setState({
        error: 'Could not connect to any available API servers'
      })
    }

    if(manual && !this.state.keplr){
      return this.setState({
        keplrError: true
      })
    }

    if(localStorage.getItem('connected') !== '1'){
      if(manual){
        localStorage.setItem('connected', '1')
      }else{
        return
      }
    }

    const { network } = this.props
    if(!network) return

    const chainId = network.chainId

    try {
      if (window.keplr) {
        if (network.gasPricePrefer) {
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

        const accounts = await offlineSigner.getAccounts();
        const address = accounts[0].address;

        stargateClient.registry.register("/cosmos.authz.v1beta1.MsgGrant", MsgGrant)
        stargateClient.registry.register("/cosmos.authz.v1beta1.MsgRevoke", MsgRevoke)
        this.setState({
          address: address,
          accountName: key.name,
          stargateClient: stargateClient,
          error: false
        })
        this.getBalance()
      } catch (e) {
        console.log(e)
        return this.setState({
          error: 'Failed to connect to signer: ' + e.message
        })
      }
    }
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

  toggleFavourite(network){
    const { favourites } = this.state
    let newFavourites
    if(favourites.includes(network.path)){
      newFavourites = favourites.filter(el => el !== network.path)
    }else{
      newFavourites = [...favourites, network.path]
    }
    localStorage.setItem('favourites', JSON.stringify(newFavourites))
    this.setState({ favourites: newFavourites })
  }

  async getBalance() {
    if(!this.state.address) return

    this.props.queryClient.getBalance(this.state.address, this.props.network.denom)
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
    if (themeChoice === 'auto') {
      icon = <DropletHalf {...iconProps} />
      switchTo = theme === 'dark' ? 'light' : 'dark'
    } else {
      icon = themeChoice === 'dark' ? <DropletFill {...iconProps} /> : <Droplet {...iconProps} />
      switchTo = themeDefault !== theme ? 'auto' : theme === 'dark' ? 'light' : 'dark'
    }
    const tooltip = `Switch to ${switchTo} mode`
    return (
      <span>
        <TooltipIcon icon={icon} tooltip={tooltip} placement="left" />
      </span>
    )
  }

  networkIcon() {
    let icon, mode
    let iconProps = {
      size: '1.4em',
      className: 'mx-2 mx-md-3',
      role: 'button',
      onClick: () => this.props.changeNetworkMode(mode)
    }
    if (this.props.directory.testnet) {
      iconProps.className = iconProps.className + ' text-warning'
      icon = <WrenchAdjustableCircleFill {...iconProps} />
      mode = 'mainnet'
    } else {
      iconProps.className = iconProps.className + ' text-muted'
      icon = <WrenchAdjustableCircle {...iconProps} />
      mode = 'testnet'
    }
    const tooltip = `Switch to ${mode}`
    return (
      <span className="text-reset">
        <TooltipIcon icon={icon} tooltip={tooltip} placement="left" />
      </span>
    )
  }

  render() {
    return (
      <Container>
        <header className="">
          <div className="d-flex justify-content-between align-items-center py-3 border-bottom">
            <div className="logo d-flex align-items-end text-reset text-decoration-none">
              <span onClick={() => this.props.setActive('networks')} role="button" className="text-reset text-decoration-none">
                {this.props.theme === 'light'
                  ? (
                    <img src={Logo} srcSet={`${Logo2x} 2x, ${Logo3x} 3x`} alt="REStake" />
                  ) : (
                    <img src={LogoWhite} srcSet={`${LogoWhite2x} 2x, ${LogoWhite3x} 3x`} alt="REStake" />
                  )}
              </span>
              {this.props.directory.testnet && (
                <small className="ms-2 text-muted">testnet</small>
              )}
            </div>
            <div className="d-flex align-items-center text-reset text-decoration-none">
              <p className="lead fs-6 text-center m-0 px-5 d-lg-block d-none">
                REStake allows validators to <strong onClick={() => this.setState({ showAbout: true })} className="text-decoration-underline" role="button">auto-compound</strong> your {this.props.network && <strong onClick={this.showNetworkSelect} className="text-decoration-underline" role="button">{this.props.network.prettyName}</strong>} staking rewards
              </p>
            </div>
            <div className="d-flex align-items-center text-reset text-decoration-none">
              {this.networkIcon()}
              {this.themeIcon()}
              <NetworkSelect show={this.state.showNetworkSelect} onHide={() => { this.setState({ showNetworkSelect: false }) }} networks={this.props.networks}
                network={this.props.network}
                validators={this.props.validators}
                changeNetwork={this.props.changeNetwork} />
            </div>
          </div>
          <div className="d-flex justify-content-between border-bottom">
            <Navbar className={`navbar navbar-expand ${this.props.theme === 'dark' ? 'navbar-dark' : 'navbar-light'}`}>
              <div className="justify-content-center">
                <Nav activeKey={this.props.active} onSelect={(e) => this.props.setActive(e)}>
                      <div className="nav-item pe-2 border-end">
                        <Nav.Link eventKey="networks">
                          <Stars className="mb-1 me-1" /> Explore
                        </Nav.Link>
                      </div>
                  {this.props.network && (
                    <>
                      <div className="nav-item px-2 border-end">
                        <Nav.Link eventKey="delegations">
                          <Coin className="mb-1 me-1" /> Delegate
                        </Nav.Link>
                      </div>
                      <div className="nav-item ps-2">
                        <Nav.Link eventKey="governance">
                          <Inboxes className="mb-1 me-1" /> Govern
                        </Nav.Link>
                      </div>
                    </>
                  )}
                </Nav>
              </div>
            </Navbar>
            <nav className={`navbar navbar-expand-lg ${this.props.theme === 'dark' ? 'navbar-dark' : 'navbar-light'}`}>
              <div className="justify-content-center">
                <ul className="navbar-nav">
                  {this.props.network && this.state.address ? (
                    <>
                      <li className="nav-item pe-3 pt-2 border-end d-none d-lg-block">
                        <CopyToClipboard text={this.state.address}
                          onCopy={() => this.setCopied()}>
                          <span role="button"><span className={'small d-block clipboard' + (this.state.copied ? ' copied' : '')}>{this.state.address}</span></span>
                        </CopyToClipboard>
                      </li>
                      <li className="nav-item ps-3 pt-1">
                        <Dropdown as={ButtonGroup}>
                          <Dropdown.Toggle size="sm" className="rounded" id="dropdown-custom-1">
                            <Coins
                              coins={this.state.balance}
                              decimals={this.props.network.decimals}
                              className="me-1 d-none d-sm-inline"
                            />
                            <CashCoin className="d-inline d-sm-none" />
                          </Dropdown.Toggle>
                          <Dropdown.Menu>
                            <Dropdown.Header>{this.state.accountName || 'Wallet'}</Dropdown.Header>
                            <Dropdown.Item>
                              <CopyToClipboard text={this.state.address}
                                onCopy={() => this.setCopied()}>
                                <span role="button"><span style={{ maxWidth: 200 }} className={'small d-block text-truncate clipboard' + (this.state.copied ? ' copied' : '')}>{this.state.address}</span></span>
                              </CopyToClipboard>
                            </Dropdown.Item>
                            <Dropdown.Divider />
                            <Dropdown.Item onClick={this.disconnect}>Disconnect</Dropdown.Item>
                          </Dropdown.Menu>
                        </Dropdown>
                      </li>
                    </>
                  ) : this.props.network && (
                    <>
                      <li className="nav-item ps-3">
                        <Button onClick={() => this.connect(true)} className="btn-sm">Connect</Button>
                      </li>
                    </>
                  )}
                </ul>
              </div>
            </nav>
          </div>
        </header>
        <div className="my-4">
          {this.props.network?.experimental && (
            <AlertMessage variant="info" dismissible={false}>
              This network was added to REStake automatically and has not been thoroughly tested yet. <a href="https://github.com/eco-stake/restake/issues" target="_blank">Raise an issue</a> if you have any problems.
            </AlertMessage>
          )}
          <AlertMessage message={this.state.error} variant="danger" dismissible={false} />
          {!this.state.keplr && this.state.keplrError && (
            <AlertMessage variant="warning" dismissible={true} onClose={() => this.setState({keplrError: false})}>
              Please install the <a href="https://chrome.google.com/webstore/detail/keplr/dmkamcknogkgcdfhhbddcghachkejeap?hl=en" target="_blank" rel="noreferrer">Keplr browser extension</a> using desktop Google Chrome.<br />WalletConnect and mobile support is coming soon.
            </AlertMessage>
          )}
          {this.props.active === 'networks' && (
            <Networks 
              networks={Object.values(this.props.networks)} 
              changeNetwork={this.props.changeNetwork} 
              favourites={this.state.favourites} 
              toggleFavourite={this.toggleFavourite} />
          )}
          {this.props.active === 'governance' && (
          <Governance
            network={this.props.network}
            address={this.state.address}
            queryClient={this.props.queryClient}
            stargateClient={this.state.stargateClient} />
          )}
          {this.props.active === 'delegations' &&
            <>
              <Delegations
                network={this.props.network}
                address={this.state.address}
                balance={this.state.balance}
                operators={this.props.operators}
                validators={this.props.validators}
                validator={this.props.validator}
                getBalance={this.getBalance}
                queryClient={this.props.queryClient}
                stargateClient={this.state.stargateClient} />
            </>
          }
          <hr />
          <p className="mt-5 text-center">
            Enabling REStake will authorize the validator to send <em>Delegate</em> transactions on your behalf for 1 year <a href="https://docs.cosmos.network/master/modules/authz/" target="_blank" rel="noreferrer" className="text-reset">using Authz</a>.<br />
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
            <a href={`https://${this.props.directory.domain}`} target="_blank" className="text-reset text-decoration-none d-block small">
              <span className="d-none d-sm-inline">Interchain APIs from</span> <u>cosmos.directory</u>
            </a>
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
