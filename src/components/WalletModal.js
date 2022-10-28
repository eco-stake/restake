import React, { useState, useEffect } from 'react';
import _ from 'lodash'

import {
  Modal,
  Tab,
  Nav,
  Table,
  Button
} from 'react-bootstrap'

import Address from './Address.js';
import Coins from './Coins.js';
import Favourite from './Favourite.js';
import SavedAddresses from './SavedAddresses.js';

function WalletModal(props) {
  const { show, network, wallet, favouriteAddresses } = props
  const [activeTab, setActiveTab] = useState(props.activeTab || wallet ? 'wallet' : 'saved')

  useEffect(() => {
    if (props.activeTab && props.activeTab != activeTab) {
      setActiveTab(props.activeTab)
    }else if (!props.show){
      setActiveTab()
    }
  }, [props.show])

  function onHide() {
    props.onHide()
  }

  if(!network) return null

  // const balances = _.sortBy((props.balances || []).map(balance => {
  const balances = _.sortBy((props.balances || []).filter(el => el.denom === network.denom).map(balance => {
    const asset = network.assets.find(a => a.base?.denom === balance.denom)
    return {
      ...balance,
      asset
    }
  }), ({ asset }) => {
    if(!asset) return 0
    if(network.denom === asset.base?.denom) return -2
    return -1
  })

  return (
    <>
      <Modal size="lg" show={show} onHide={() => onHide()}>
        <Modal.Header closeButton>
          <Modal.Title>Wallet</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k)} id="wallet-tabs">
            <Nav variant="tabs" className="small mb-3 d-flex">
              <Nav.Item>
                <Nav.Link role="button" eventKey="wallet" disabled={!wallet}>Wallet</Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link role="button" eventKey="saved">Saved Addresses</Nav.Link>
              </Nav.Item>
            </Nav>
            <Tab.Content>
              <Tab.Pane eventKey="wallet" className="small">
                {wallet && (
                  <>
                  <Table>
                    <tbody>
                      <tr>
                        <td scope="row">Wallet Provider</td>
                        <td className="text-break">
                          <div className="d-flex gap-2">
                            {props.signerProvider?.label || 'None'}
                          </div>
                        </td>
                      </tr>
                      {wallet.name && (
                        <tr>
                          <td scope="row">Wallet Name</td>
                          <td className="text-break">
                            <div className="d-flex gap-2">
                              {wallet.name}
                            </div>
                          </td>
                        </tr>
                      )}
                      <tr>
                        <td scope="row">Address</td>
                        <td className="text-break">
                          <div className="d-flex gap-2">
                            <Address address={wallet.address} />
                            <Favourite
                              favourites={favouriteAddresses[network.path] || []}
                              value={wallet.address}
                              label={props.address === wallet?.address && wallet.name}
                              toggle={props.toggleFavouriteAddress} />
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td scope="row">Balance</td>
                        <td className="text-break">
                          {balances.map(balance => {
                            return (
                              <div key={balance.denom} className="d-flex align-items-center gap-2">
                                <Coins coins={balance} asset={balance.asset} />
                              </div>
                            )
                          })}
                        </td>
                      </tr>
                    </tbody>
                  </Table>
                  <div className="d-flex justify-content-end gap-2">
                    <Button variant="secondary" disabled={wallet.address === props.address} onClick={() => props.setAddress(wallet.address)}>
                      {wallet.address === props.address ? 'Viewing wallet' : 'View wallet'}
                    </Button>
                    <Button variant="primary" onClick={() => setActiveTab('saved')}>
                      Saved addresses
                    </Button>
                  </div>
                  </>
                )}
              </Tab.Pane>
              <Tab.Pane eventKey="saved" className="small">
                <SavedAddresses
                  network={props.network}
                  networks={props.networks}
                  address={props.address}
                  wallet={props.wallet}
                  favouriteAddresses={props.favouriteAddresses}
                  updateFavouriteAddresses={props.updateFavouriteAddresses}
                  setAddress={props.setAddress}
                />
              </Tab.Pane>
            </Tab.Content>
          </Tab.Container>
        </Modal.Body>
      </Modal>
    </>
  );
}

export default WalletModal
