import React, { useState, useEffect } from 'react';

import {
  Modal,
  Table,
  Form,
  Button
} from 'react-bootstrap'

import {
  XCircle,
  Eye,
  Key
} from 'react-bootstrap-icons'
import CopyToClipboard from 'react-copy-to-clipboard';

function AddressModal(props) {
  const { show, network, networks, favouriteAddresses, updateFavouriteAddresses } = props
  const [newAddress, setNewAddress] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [selectedNetwork, setSelectedNetwork] = useState(network)

  const networkAddresses = (selectedNetwork && favouriteAddresses[selectedNetwork.path]) || []

  useEffect(() => {
    setSelectedNetwork(network)
  }, [network])

  function onHide(){
    props.onHide()
  }

  function updateAddress(address, label){
    updateFavouriteAddresses({...favouriteAddresses, [network.path]: networkAddresses.map(data => {
      if(data.address === address){
        return {...data, label}
      }
      return data
    })})
  }

  function removeAddress(address){
    updateFavouriteAddresses({...favouriteAddresses, [network.path]: networkAddresses.filter(data => data.address !== address)})
  }

  function addAddress(){
    if(!validNewAddress()) return

    updateFavouriteAddresses({...favouriteAddresses, [network.path]: [...networkAddresses, {address: newAddress, label: newLabel}]})
    setNewAddress('')
    setNewLabel('')
  }

  function validNewAddress(){
    return newAddress !== '' && !networkAddresses.some(el => el.address === newAddress)
  }

  return (
    <>
      <Modal size="lg" show={show} onHide={() => onHide()}>
        <Modal.Header closeButton>
          <Modal.Title>Saved Addresses</Modal.Title>
        </Modal.Header>
        <Modal.Body className="small">
          <select className="form-select mb-2" aria-label="Network" value={selectedNetwork?.path} onChange={(e) => setSelectedNetwork(networks.find(el => el.path === e.target.value))}>
            {networks.map(network => {
              return <option key={network.path} value={network.path}>{network.prettyName}</option>
            })}
          </select>
          {selectedNetwork && (
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
                      <td>
                        <CopyToClipboard text={address}>
                          <span role="button">{address}</span>
                        </CopyToClipboard>
                      </td>
                      <td><Form.Control value={label || ''} onChange={(e) => updateAddress(address, e.target.value)} /></td>
                      <td>
                        <XCircle role="button" onClick={() => removeAddress(address)} />
                        {props.wallet?.address === address && (
                          <span className="ps-2"><Key /></span>
                        )}
                        {props.address === address && (
                          <span className="ps-2"><Eye /></span>
                        )}
                      </td>
                    </tr>
                  )
                })}
                <tr>
                  <td><Form.Control placeholder={`${selectedNetwork.prefix}1...`} value={newAddress} isInvalid={newAddress !== '' && !validNewAddress()} onChange={(e) => setNewAddress(e.target.value)} /></td>
                  <td><Form.Control value={newLabel} onChange={(e) => setNewLabel(e.target.value)} /></td>
                  <td><Button variant="secondary" size="sm" onClick={addAddress}>Save</Button></td>
                </tr>
              </tbody>
            </Table>
          )}
        </Modal.Body>
      </Modal>
    </>
  );
}

export default AddressModal
