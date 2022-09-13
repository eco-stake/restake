import React, { useState, useEffect } from 'react';
import _ from 'lodash'
import { pow, multiply, divide, subtract, bignumber } from 'mathjs'

import { MsgSend } from "cosmjs-types/cosmos/bank/v1beta1/tx";

import {
  Modal,
  Button,
  Form,
} from 'react-bootstrap'

import AlertMessage from './AlertMessage';
import { buildExecableMessage, buildExecMessage, coin } from '../utils/Helpers.mjs';
import Coins from './Coins';

function SendModal(props) {
  const { show, network, address, wallet } = props
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState()
  const [state, setState] = useState({recipientValue: '', customRecipientValue: '', memoValue: ''});

  const denom = network && network.symbol
  const step = 1 / pow(10, network?.decimals || 6)

  useEffect(() => {
    setState({
      ...state,
      recipientValue: '',
      customRecipientValue: '',
      amountValue: '',
      memoValue: '',
    })
    setError(null)
  }, [address])

  function handleInputChange(e) {
    setState({ ...state, [e.target.name]: e.target.value });
  }

  function showLoading(isLoading) {
    setLoading(isLoading)
    props.setLoading && props.setLoading(isLoading)
  }

  function handleSubmit(event) {
    event.preventDefault()
    if(!valid()) return

    showLoading(true)


    const coinValue = coinAmount()

    const messages = [
      buildSendMsg(address, recipient(), [coinValue])
    ]
    console.log(messages)

    props.signingClient.signAndBroadcast(wallet.address, messages, null, state.memoValue).then((result) => {
      console.log("Successfully broadcasted:", result);
      showLoading(false)
      setState({
        recipientValue: '',
        customRecipientValue: '',
        amountValue: '',
        memoValue: '',
      })
      props.onSend(recipient(), coinValue);
    }, (error) => {
      console.log('Failed to broadcast:', error)
      showLoading(false)
      setError('Failed to broadcast: ' + error.message)
    })
  }

  function handleClose() {
    setError(null)
    props.onHide();
  }

  function buildSendMsg(address, recipient, amount) {
    let message = buildExecableMessage(MsgSend, "/cosmos.bank.v1beta1.MsgSend", {
      fromAddress: address,
      toAddress: recipient,
      amount: amount
    }, wallet?.address !== address)
    if(wallet?.address !== address){
      return buildExecMessage(wallet.address, [message])
    }
    return message
  }

  async function setAvailableAmount(){
    setError(null)
    const decimals = pow(10, network.decimals)
    const coinValue = coin(multiply(props.balance.amount, 0.95), network.denom)
    const message = buildSendMsg(address, recipient(), [coinValue])
    props.signingClient.simulate(wallet.address, [message]).then(gas => {
      const gasPrice = props.signingClient.getFee(gas).amount[0].amount
      const amount = divide(subtract(bignumber(props.balance.amount), gasPrice), decimals)

      setState({...state, amountValue: amount > 0 ? amount : 0})
    }, error => {
      console.log(error)
      setError(error.message)
    })
  }

  function recipient(){
    return state.recipientValue === 'custom' ? state.customRecipientValue : state.recipientValue
  }

  function coinAmount(){
    if(!state.amountValue) return null

    const decimals = pow(10, network.decimals)
    const denomAmount = multiply(state.amountValue, decimals)
    if(denomAmount > 0){
      return coin(denomAmount, network.denom)
    }
  }

  function valid(){
    if(!state.recipientValue) return true
    return validRecipient() && coinAmount() && wallet?.hasPermission(address, 'Send')
  }

  function validAmount(){
    if(!state.amountValue) return true

    return !!coinAmount()
  }

  function validRecipient(){
    const value = state.recipientValue === 'custom' ? state.customRecipientValue : state.recipientValue
    if(!value) return true;

    return !network.prefix || value.startsWith(network.prefix)
  }

  function favourites(){
    return props.favouriteAddresses.filter(el => el.address !== props.address)
  }

  return (
    <>
      <Modal show={show} onHide={handleClose}>
        <Modal.Header closeButton>
          <Modal.Title className="text-truncate pe-4">Send</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error &&
            <AlertMessage variant="danger" className="text-break small">
              {error}
            </AlertMessage>
          }
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Recipient</Form.Label>
              <select className="form-select" name="recipientValue" aria-label="Recipient" value={state.recipientValue} onChange={handleInputChange}>
                <option value='' disabled>Choose address</option>
                {favourites().length > 0 && (
                  <optgroup label="Favourites">
                    {favourites().map(({ label, address }) => {
                      if (props.address === address) return null

                      return (
                        <option key={address} value={address}>{label || address}</option>
                      )
                    })}
                  </optgroup>
                )}
                <option value='custom'>Custom</option>
              </select>
              {state.recipientValue === 'custom' && (
                <Form.Control placeholder={`${network.prefix}1...`} className="mt-1" type="text" name='customRecipientValue' required={true} value={state.customRecipientValue} isInvalid={!validRecipient()} onChange={handleInputChange} />
              )}
            </Form.Group>
            {recipient() && (
              <>
                <Form.Group className="mb-3">
                  <Form.Label>Amount</Form.Label>
                  <div className="mb-3">
                    <div className="input-group">
                      <Form.Control name="amountValue" type="number" min={0} step={step} placeholder="10" required={true} isInvalid={!validAmount()} value={state.amountValue} onChange={handleInputChange} />
                      <span className="input-group-text">{denom}</span>
                    </div>
                    {props.balance &&
                      <div className="form-text text-end"><span role="button" onClick={() => setAvailableAmount()}>
                        Available: <Coins coins={props.balance} asset={network.baseAsset} fullPrecision={true} hideValue={true} />
                      </span></div>
                    }
                  </div>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Memo</Form.Label>
                  <Form.Control name="memoValue" as="textarea" rows={3} value={state.memoValue} onChange={handleInputChange} />
                </Form.Group>
                <p className="text-end">
                  {!loading
                    ? (
                      <Button type="submit" className="btn btn-primary ms-2" disabled={!valid()}>Send {coinAmount() && <Coins coins={coinAmount()} asset={network.baseAsset} fullPrecision={true} hideValue={true} />}</Button>
                    )
                    : <Button className="btn btn-primary" type="button" disabled>
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>&nbsp;
                    </Button>
                  }
                </p>
              </>
            )}
          </Form>
        </Modal.Body>
      </Modal>
    </>
  );
}

export default SendModal
