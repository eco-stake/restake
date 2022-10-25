import React, { useState, useEffect } from 'react';

import {
  Modal,
  Table,
  Form,
  Button,
  Dropdown
} from 'react-bootstrap'

import {
  PlusCircle,
  Eye,
  Key,
  Gear
} from 'react-bootstrap-icons'
import Address from './Address.js';
import TooltipIcon from './TooltipIcon.js';

function SavedAddresses(props) {
  const { network, networks, wallet, favouriteAddresses, updateFavouriteAddresses } = props
  const [newAddress, setNewAddress] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [selectedNetwork, setSelectedNetwork] = useState(network)

  const networkAddresses = (selectedNetwork && favouriteAddresses[selectedNetwork.path]) || []

  useEffect(() => {
    setSelectedNetwork(network)
  }, [network])

  function setAddress(address) {
    if (selectedNetwork.path === network.path) {
      props.setAddress(address)
    }
  }

  function updateAddress(address, label) {
    updateFavouriteAddresses({
      ...favouriteAddresses, [network.path]: networkAddresses.map(data => {
        if (data.address === address) {
          return { ...data, label }
        }
        return data
      })
    })
  }

  function removeAddress(address) {
    updateFavouriteAddresses({ ...favouriteAddresses, [network.path]: networkAddresses.filter(data => data.address !== address) })
  }

  function addAddress(event) {
    event.preventDefault()
    if (!validNewAddress()) return

    updateFavouriteAddresses({ ...favouriteAddresses, [network.path]: [...networkAddresses, { address: newAddress, label: newLabel }] })
    setNewAddress('')
    setNewLabel('')
  }

  function validNewAddress() {
    return newAddress !== '' && !networkAddresses.some(el => el.address === newAddress)
  }

  return (
    <>
      <p>Save addresses here to easily find and view them, and carry out any granted actions in the REStake UI on their behalf.</p>
      <p>Select 'View address' for any saved address to enter View mode and see REStake as they would - useful for monitoring other addresses quickly!</p>
      <p>If a saved address has granted you any permissions, REStake will detect them and enable the relevant features. This can make it very easy to manage staking and governance for multiple wallets.</p>
      <select className="form-select mb-2" aria-label="Network" value={selectedNetwork?.path} onChange={(e) => setSelectedNetwork(networks.find(el => el.path === e.target.value))}>
        {networks.map(network => {
          return <option key={network.path} value={network.path}>{network.prettyName}</option>
        })}
      </select>
      {selectedNetwork && (
        <>
          <Form onSubmit={addAddress}>
            <Table className="align-middle table-striped">
              <thead>
                <tr>
                  <th>Address</th>
                  <th>Label</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {networkAddresses.map(({ label, address }) => {
                  return (
                    <tr key={address}>
                      <td className="text-break">
                        <Address address={address} onClick={() => props.address !== address && setAddress(address)} as={props.address === address && 'strong'} />
                      </td>
                      <td><Form.Control size="sm" value={label || ''} onChange={(e) => updateAddress(address, e.target.value)} /></td>
                      <td>
                        <div className="d-flex justify-content-end align-items-center gap-3">
                          {props.wallet?.address === address && (
                            <TooltipIcon
                              icon={<Key />}
                              identifier={`${address}-wallet`}
                              tooltip="This is your connected wallet"
                            />
                          )}
                          {props.address === address && (
                            <TooltipIcon
                              icon={<Eye />}
                              identifier={`${address}-view`}
                              tooltip="This is the address you are viewing"
                            />
                          )}
                          <Dropdown>
                            <Dropdown.Toggle
                              variant="secondary"
                              size="sm"
                            >
                              <Gear />
                            </Dropdown.Toggle>
                            <Dropdown.Menu>
                              <Dropdown.Item as="button" disabled={props.address === address} onClick={() => setAddress(address)}>
                                {props.address === address ? 'Viewing address' : 'View address'}
                              </Dropdown.Item>
                              <Dropdown.Item as="button" onClick={() => removeAddress(address)}>
                                Remove saved address
                              </Dropdown.Item>
                            </Dropdown.Menu>
                            </Dropdown>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                <tr>
                  <td><Form.Control size="sm" placeholder={`${selectedNetwork.prefix}1...`} value={newAddress} required={true} isInvalid={newAddress !== '' && !validNewAddress()} onChange={(e) => setNewAddress(e.target.value)} /></td>
                  <td><Form.Control size="sm" placeholder="Label" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} /></td>
                  <td>
                    <div className="text-end">
                      <Button type="submit" variant="secondary" size="sm">
                        <span className="d-none d-sm-inline">Add address</span>
                        <PlusCircle className="d-inline d-sm-none" />
                      </Button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </Table>
          </Form>
        </>
      )}
    </>
  );
}

export default SavedAddresses
