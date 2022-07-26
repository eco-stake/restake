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
    setSelectedNetwork(network)
  }

  function setAddress(address){
    if(selectedNetwork.path === network.path){
      props.setAddress(address)
    }
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

  function addAddress(event){
    event.preventDefault()
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
                          <span role="button" onClick={() => setAddress(address)}>{props.address === address ? <strong>{address}</strong> : address}</span>
                          {props.wallet?.address === address && (
                            <span className="ms-2"><Key /></span>
                          )}
                          {props.address === address && (
                            <span className="ms-2"><Eye /></span>
                          )}
                        </td>
                        <td><Form.Control size="sm" value={label || ''} onChange={(e) => updateAddress(address, e.target.value)} /></td>
                        <td>
                          <div className="d-flex justify-content-between">
                            <XCircle role="button" onClick={() => removeAddress(address)} />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  <tr>
                    <td><Form.Control size="sm" placeholder={`${selectedNetwork.prefix}1...`} value={newAddress} required={true} isInvalid={newAddress !== '' && !validNewAddress()} onChange={(e) => setNewAddress(e.target.value)} /></td>
                    <td colSpan="2"><Form.Control size="sm" placeholder="Label" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} /></td>
                  </tr>
                </tbody>
              </Table>
              <div className="text-end"><Button type="submit" variant="secondary">Save new address</Button></div>
              </Form>
            </>
          )}
        </Modal.Body>
      </Modal>
    </>
  );
}

export default AddressModal
